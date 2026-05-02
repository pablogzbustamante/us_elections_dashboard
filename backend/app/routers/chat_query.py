import groq as groq_sdk
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.services.nlq.llm_parser import parse_query
from app.services.nlq.validator import validate
from app.services.nlq.executor import execute_query

router = APIRouter(prefix="/chat", tags=["chat"])

_FALLBACK_RESPONSE = {
    "assistantMessage": (
        "I could not interpret the request safely. "
        "Please rephrase it with clearer fields, filters, or geography."
    ),
    "structuredQuery": None,
    "results": [],
    "visualization": None,
    "isAmbiguous": False,
}


class ChatRequest(BaseModel):
    message: str
    conversationHistory: list[dict] = []


@router.post("/query")
async def chat_query(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured. Add it to backend/.env.",
        )

    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long (max 1000 chars).")

    # 1. Parse natural language → structured query via Groq LLM
    try:
        structured = await parse_query(
            message,
            req.conversationHistory,
            settings.groq_api_key,
            settings.groq_model,
        )
    except groq_sdk.AuthenticationError:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is invalid.")
    except groq_sdk.RateLimitError:
        return {**_FALLBACK_RESPONSE, "assistantMessage": "Rate limit reached. Please try again in a moment."}
    except (groq_sdk.APITimeoutError, groq_sdk.APIConnectionError):
        return {**_FALLBACK_RESPONSE, "assistantMessage": "Groq API timed out. Please try again."}
    except Exception:
        return _FALLBACK_RESPONSE

    # 2. Handle ambiguity before executing
    if structured.ambiguity.is_ambiguous:
        return {
            "assistantMessage": structured.ambiguity.clarifying_question or structured.interpretation,
            "structuredQuery": structured.model_dump(),
            "results": [],
            "visualization": {"type": "none"},
            "isAmbiguous": True,
        }

    # 3. Validate the structured query
    ok, err = validate(structured)
    if not ok:
        if err and err.startswith("CLARIFICATION:"):
            msg = err[len("CLARIFICATION:"):].strip()
            return {
                "assistantMessage": msg,
                "structuredQuery": structured.model_dump(),
                "results": [],
                "visualization": {"type": "none"},
                "isAmbiguous": True,
            }
        return {
            "assistantMessage": err or "Could not process that query.",
            "structuredQuery": structured.model_dump(),
            "results": [],
            "visualization": {"type": "none"},
            "isAmbiguous": False,
        }

    # 4. Execute the safe query
    try:
        results = await execute_query(db, structured)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query execution error: {exc}")

    # 5. Build response
    if not results:
        assistant_msg = (
            structured.interpretation
            + "\n\nNo counties matched all your filters. "
            + "Try relaxing one condition, such as the margin threshold or income cutoff."
        )
    else:
        assistant_msg = structured.interpretation + f"\n\nFound {len(results)} matching counties."

    return {
        "assistantMessage": assistant_msg,
        "structuredQuery": structured.model_dump(),
        "results": results,
        "visualization": {"type": structured.visualization_type or "table"},
        "isAmbiguous": False,
    }
