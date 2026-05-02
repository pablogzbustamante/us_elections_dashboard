# Maps user-facing field names → DB columns used in the flat CTE
# Tuple: (cte_prefix, column_alias_in_outer_select)
FIELD_MAP: dict[str, str] = {
    # Geography (handled separately)
    "county":  "county_name",
    "state":   "state_abbr",
    "fips":    "fips",
    # Election 2024
    "winner_2024":          "winner_2024",
    "trump_pct":            "trump_pct",
    "harris_pct":           "harris_pct",
    "margin_2024":          "margin_2024",
    "total_votes_2024":     "total_votes",
    "votes_trump_2024":     "votes_trump",
    "votes_harris_2024":    "votes_harris",
    "competitiveness_score":"competitiveness_score",
    # Election 2020
    "winner_2020":          "winner_2020",
    "trump_pct_2020":       "trump_pct_2020",
    "biden_pct_2020":       "biden_pct_2020",
    "margin_2020":          "margin_2020",
    "swing_2020_2024":      "swing_2020_2024",
    # Demographics / metrics
    "population":                       "population",
    "population_density":               "population_density",
    "age_65_plus":                      "age_65_plus",
    "age_under_18":                     "age_under_18",
    "age_under_5":                      "age_under_5",
    "hispanic_or_latino":               "hispanic_or_latino",
    "white_alone":                      "white_alone",
    "black_alone":                      "black_alone",
    "asian_alone":                      "asian_alone",
    "american_indian_alaska_native":    "american_indian_alaska_native",
    "native_hawaiian_pacific_islander": "native_hawaiian_pacific_islander",
    "two_or_more_races":                "two_or_more_races",
    "foreign_born":                     "foreign_born",
    # Economics
    "median_household_income": "median_household_income",
    "per_capita_income":       "per_capita_income",
    "homeownership_rate":      "homeownership_rate",
    "median_home_value":       "median_home_value",
    "households":              "households",
    "housing_units":           "housing_units",
    # Education
    "bachelor_degree_or_higher": "bachelor_degree_or_higher",
    "high_school_or_higher":     "high_school_or_higher",
    # Misc
    "mean_travel_time": "mean_travel_time",
    "percent_female":   "percent_female",
    "veterans":         "veterans",
    "language_noneng":  "language_noneng",
    # Religion
    "religious_adherence":             "religious_adherence",
    "evangelical_adherence":           "evangelical_adherence",
    "catholic_adherence":              "catholic_adherence",
    "mainline_protestant_adherence":   "mainline_protestant_adherence",
    "other_religion_adherence":        "other_religion_adherence",
    # Campaign scoring (computed)
    "opportunity_score":   "opportunity_score",
    "risk_score":          "risk_score",
    "priority_score":      "priority_score",
    "recommended_action":  "recommended_action",
}

ALLOWED_FIELDS = set(FIELD_MAP.keys())
ALLOWED_OPERATORS = {"=", "!=", ">", ">=", "<", "<=", "between", "contains"}

# Rejected SQL keywords (safety)
BLOCKED_KEYWORDS = {
    "select", "insert", "update", "delete", "drop", "alter", "truncate",
    "create", "exec", "execute", "union", "from", "where", "join",
    "xp_", "sp_", "--", "/*", "*/", "';", '";',
}
