"""
Calls the Groq API to parse a natural-language query into a StructuredQuery.
Uses json_object response format so the model outputs a valid JSON blob directly.
"""
import json
import re
from groq import AsyncGroq
from .schema import StructuredQuery

_SYSTEM_PROMPT = """You are a US election analytics assistant. Parse the user's natural language query into a structured JSON object for county-level analysis.

AVAILABLE FIELDS (use EXACTLY these names in filters/metrics/sort):

Election 2024:
- winner_2024: who won (use value "Trump" or "Harris")
- trump_pct: Trump vote % (0-100)
- harris_pct: Harris vote % (0-100)
- margin_2024: UNSIGNED margin % (0-100, always positive regardless of winner)
- total_votes_2024: total votes cast
- competitiveness_score: 0-100, higher = more competitive

Election 2020:
- winner_2020: "Trump" or "Biden"
- trump_pct_2020, biden_pct_2020, margin_2020

Derived:
- swing_2020_2024: Trump % gain from 2020→2024 (positive = moved right)

Demographics:
- population, population_density, age_65_plus, age_under_18, age_under_5
- hispanic_or_latino, white_alone, black_alone, asian_alone
- american_indian_alaska_native, native_hawaiian_pacific_islander, two_or_more_races
- foreign_born

Economics:
- median_household_income (USD), per_capita_income (USD)
- homeownership_rate (%), median_home_value (USD), households, housing_units

Education:
- bachelor_degree_or_higher (%), high_school_or_higher (%)

Religion:
- religious_adherence (%), evangelical_adherence (%), catholic_adherence (%)
- mainline_protestant_adherence (%), other_religion_adherence (%)

Misc:
- mean_travel_time (minutes), percent_female (%), veterans (count), language_noneng (%)

Campaign:
- opportunity_score, risk_score, priority_score, recommended_action

SEMANTIC MAPPINGS (apply these automatically):
- "competitive" / "close race" / "cerrado" → margin_2024 <= 5
- "toss-up" → margin_2024 <= 2
- "low income" / "bajo ingreso" → median_household_income < 55000
- "high income" / "alto ingreso" → median_household_income > 75000
- "high education" / "alta educación" → bachelor_degree_or_higher > 30
- "low education" / "baja educación" → bachelor_degree_or_higher < 20
- "Trump stronghold" → winner_2024 = "Trump" AND margin_2024 >= 15
- "Harris stronghold" → winner_2024 = "Harris" AND margin_2024 >= 15
- "swing county" / "swung" → margin_2024 <= 5
- "Hispanic population" / "población hispana" → hispanic_or_latino field
- "ganó Trump" → winner_2024 = "Trump"
- "ganó Harris" → winner_2024 = "Harris"
- "perdió por poco" / "lost by a little" / "menos de 5 puntos" → margin_2024 <= 5
- "competitive counties" → margin_2024 <= 5
- "defend" / "defender" → recommended_action = "Defend"
- "invest" / "invertir" → recommended_action = "Invest"

INTENT VALUES:
- search_counties: finding counties that match criteria
- compare_regions: comparing states or regions
- county_profile: detailed profile of one county
- rank_campaign_priorities: ranking counties by campaign value
- explain_metric: explaining what a metric means
- recommend_strategy: campaign strategy recommendation
- unsupported: cannot answer

NOTES:
- margin_2024 is always UNSIGNED. "Harris lost by less than 5" = winner_2024 = Trump AND margin_2024 < 5
- "Harris won by less than 5" = winner_2024 = Harris AND margin_2024 < 5
- State names/abbreviations: convert full names to 2-letter codes (Texas→TX, Florida→FL, etc.)
- Default limit: 50. Max: 200.
- For "prioritize" / "rank" / "campaign strategy" requests → use rank_campaign_priorities intent
- If ambiguous (e.g. "important counties" without party context), set is_ambiguous=true

RESPOND ONLY with a valid JSON object (no markdown, no extra text):
{
  "intent": "search_counties",
  "language": "en",
  "geography": {
    "level": "national",
    "states": [],
    "counties": []
  },
  "filters": [
    {"field": "margin_2024", "operator": "<=", "value": 5}
  ],
  "metrics": ["margin_2024", "median_household_income", "hispanic_or_latino"],
  "sort": {"field": "priority_score", "direction": "desc"},
  "limit": 50,
  "visualization_type": "table",
  "campaign_frame": {
    "party": "neutral",
    "objective": "invest"
  },
  "ambiguity": {
    "is_ambiguous": false,
    "clarifying_question": null
  },
  "interpretation": "I interpreted your request as: ..."
}"""


async def parse_query(
    message: str,
    conversation_history: list[dict],
    api_key: str,
    model: str = "llama-3.3-70b-versatile",
) -> StructuredQuery:
    client = AsyncGroq(api_key=api_key)

    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for turn in conversation_history[-6:]:  # last 6 turns for context
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)})
    messages.append({"role": "user", "content": message})

    completion = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )

    raw = (completion.choices[0].message.content or "").strip()

    # Strip markdown code fences if the model adds them despite json_object mode
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError(f"Groq returned non-JSON: {raw[:200]}")

    return StructuredQuery(**data)
