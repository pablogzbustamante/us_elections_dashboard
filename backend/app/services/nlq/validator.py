from typing import Tuple, Optional
from .schema import StructuredQuery
from .aliases import ALLOWED_FIELDS, ALLOWED_OPERATORS, BLOCKED_KEYWORDS


def validate(query: StructuredQuery) -> Tuple[bool, Optional[str]]:
    """Returns (is_valid, error_message). Mutates query to enforce limits."""

    if query.ambiguity.is_ambiguous:
        return False, f"CLARIFICATION: {query.ambiguity.clarifying_question}"

    if query.intent == "unsupported":
        return False, (
            "This type of request is not supported. Try asking about counties, "
            "election results, demographics, income, education, or campaign strategy."
        )

    # Enforce limit bounds
    query.limit = max(1, min(query.limit, 500))

    # Validate filters
    for f in query.filters:
        if f.field not in ALLOWED_FIELDS:
            return False, (
                f"Field '{f.field}' is not available. "
                f"Use fields like: winner_2024, margin_2024, median_household_income, "
                f"hispanic_or_latino, bachelor_degree_or_higher, population_density, etc."
            )

        if f.operator not in ALLOWED_OPERATORS:
            return False, f"Operator '{f.operator}' is not supported."

        # SQL injection check on string values
        if isinstance(f.value, str):
            val_lower = f.value.lower().strip()
            for kw in BLOCKED_KEYWORDS:
                if kw in val_lower:
                    return False, "Invalid filter value."

        if f.operator == "between":
            if not isinstance(f.value, list) or len(f.value) != 2:
                return False, (
                    f"The 'between' operator for '{f.field}' requires a list of [min, max]."
                )

    # Drop unknown metrics silently
    query.metrics = [m for m in query.metrics if m in ALLOWED_FIELDS]

    # Drop unknown sort field silently
    if query.sort and query.sort.field not in ALLOWED_FIELDS:
        query.sort = None

    return True, None
