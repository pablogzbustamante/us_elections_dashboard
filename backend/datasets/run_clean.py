"""Ejecuta toda la lógica de limpieza y produce los CSVs en cleaned/."""
import pandas as pd
import numpy as np
import unicodedata
import os
import re

BASE = "backend/datasets"
OUT  = "backend/datasets/cleaned"
os.makedirs(OUT, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────────────
def normalize_str(s):
    if pd.isna(s):
        return s
    return unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii").strip()

def clean_edu_num(val):
    if pd.isna(val) or str(val).strip() == "":
        return np.nan
    return float(str(val).replace(",", "").strip())

def rucc_label(code):
    try:
        c = int(float(code))
    except (ValueError, TypeError):
        return "Unknown"
    if c == 1:   return "Metro Large"
    elif c == 2: return "Metro Medium"
    elif c == 3: return "Metro Small"
    elif c <= 5: return "Nonmetro Adjacent"
    elif c <= 7: return "Nonmetro Nonadjacent"
    else:        return "Rural Remote"

# ── 1. Elections ─────────────────────────────────────────────────────────────
el = pd.read_csv(f"{BASE}/elections_data.csv", encoding="utf-8-sig", dtype={"FIPS": str})
el["FIPS"] = el["FIPS"].str.strip().str.zfill(5)
el.drop(columns=["OBJECTID"], inplace=True)
el.columns = [
    "county_name", "state_name", "state_abbr", "fips",
    "votes_tot", "votes_trump", "votes_harris", "votes_stein",
    "pct_trump", "pct_harris", "pct_stein",
    "winner_2024", "winner_2020", "winner_2016",
]
for col in ["pct_trump", "pct_harris", "pct_stein"]:
    el[col] = el[col] * 100
el["votes_stein"] = el["votes_stein"].fillna(0).astype("Int64")
el["pct_stein"]   = el["pct_stein"].fillna(0.0)
mask_null = el["votes_tot"].isna()
el.loc[mask_null, "votes_trump"]  = el.loc[mask_null, "votes_trump"].fillna(0)
el.loc[mask_null, "votes_harris"] = el.loc[mask_null, "votes_harris"].fillna(0)
el.loc[mask_null, "votes_tot"] = (
    el.loc[mask_null, "votes_trump"]
    + el.loc[mask_null, "votes_harris"]
    + el.loc[mask_null, "votes_stein"]
)
def infer_winner(row):
    if pd.isna(row["winner_2024"]):
        cands = {"Trump": row["pct_trump"], "Harris": row["pct_harris"], "Stein": row["pct_stein"]}
        return max(cands, key=cands.get) if any(v > 0 for v in cands.values()) else "Unknown"
    return row["winner_2024"]

["winner_2024"] = el.apply(infer_winner, axis=1)
el["winner_2020"] = el["winner_2020"].fillna("Unknown")
el["winner_2016"] = el["winner_2016"].fillna("Unknown")
for c in ["votes_tot", "votes_trump", "votes_harris"]:
    el[c] = pd.to_numeric(el[c], errors="coerce").fillna(0).astype("Int64")
el["margin_votes"]         = (el["votes_trump"] - el["votes_harris"]).abs()
el["margin_pct"]           = (el["pct_trump"] - el["pct_harris"]).abs().round(4)
el["competitiveness_score"] = (100 - el["margin_pct"]).round(4)
for c in ["pct_trump", "pct_harris", "pct_stein", "margin_pct", "competitiveness_score"]:
    el[c] = el[c].fillna(0.0)
el.to_csv(f"{OUT}/elections_clean.csv", index=False)
print(f"elections        rows={len(el):>7}  nulls={el.isnull().sum().sum():>5}")

# ── 2. Demographics ───────────────────────────────────────────────────────────
dem = pd.read_csv(f"{BASE}/DemographicsData.csv", encoding="utf-8-sig")
dem.columns = [c.replace("\t", "\t ") for c in dem.columns]
rename_map = {
    "County": "county_name", "State": "state_name",
    "Age.Percent 65 and Older": "age_pct_65_older",
    "Age.Percent Under 18 Years": "age_pct_under_18",
    "Age.Percent Under 5 Years": "age_pct_under_5",
    "Education.Bachelor's Degree or Higher": "edu_bachelors_pct",
    "Education.High School or Higher": "edu_hs_or_higher_pct",
    "Employment.Nonemployer Establishments": "employment_nonemployer_estab",
    "Ethnicities.American Indian and Alaska Native Alone": "ethnicity_native_pct",
    "Ethnicities.Asian Alone": "ethnicity_asian_pct",
    "Ethnicities.Black Alone": "ethnicity_black_pct",
    "Ethnicities.Hispanic or Latino": "ethnicity_hispanic_pct",
    "Ethnicities.Native Hawaiian and Other Pacific Islander Alone": "ethnicity_pacific_islander_pct",
    "Ethnicities.Two or More Races": "ethnicity_two_or_more_pct",
    "Ethnicities.White Alone": "ethnicity_white_pct",
    "Ethnicities.White Alone\t not Hispanic or Latino": "ethnicity_white_nonhispanic_pct",
    "Housing.Homeownership Rate": "housing_homeownership_pct",
    "Housing.Households": "housing_households",
    "Housing.Housing Units": "housing_units",
    "Housing.Median Value of Owner-Occupied Units": "housing_median_value",
    "Housing.Persons per Household": "housing_persons_per_hh",
    "Income.Median Houseold Income": "income_median_household",
    "Income.Per Capita Income": "income_per_capita",
    "Miscellaneous.Foreign Born": "misc_foreign_born_pct",
    "Miscellaneous.Land Area": "misc_land_area_sqmi",
    "Miscellaneous.Language Other than English at Home": "misc_lang_noneng_pct",
    "Miscellaneous.Living in Same House +1 Years": "misc_same_house_1yr_pct",
    "Miscellaneous.Manufacturers Shipments": "misc_manuf_shipments",
    "Miscellaneous.Mean Travel Time to Work": "misc_mean_travel_time_min",
    "Miscellaneous.Percent Female": "misc_pct_female",
    "Miscellaneous.Veterans": "misc_veterans",
    "Population.2020 Population": "population_2020",
    "Population.2010 Population": "population_2010",
    "Population.Population per Square Mile": "population_density",
    "Sales.Accommodation and Food Services Sales": "sales_food_services",
    "Sales.Retail Sales": "sales_retail",
    "Employment.Firms.Total": "firms_total",
    "Employment.Firms.Women-Owned": "firms_women_owned",
    "Employment.Firms.Men-Owned": "firms_men_owned",
    "Employment.Firms.Minority-Owned": "firms_minority_owned",
    "Employment.Firms.Nonminority-Owned": "firms_nonminority_owned",
    "Employment.Firms.Veteran-Owned": "firms_veteran_owned",
    "Employment.Firms.Nonveteran-Owned": "firms_nonveteran_owned",
}
dem.rename(columns=rename_map, inplace=True)
sentinel_cols = [
    "employment_nonemployer_estab", "housing_units", "housing_median_value",
    "misc_manuf_shipments", "misc_veterans", "sales_food_services", "sales_retail",
]
for col in sentinel_cols:
    if col in dem.columns:
        dem.loc[dem[col] == -1, col] = np.nan
numeric_cols = dem.select_dtypes(include="number").columns.tolist()
dem[numeric_cols] = dem.groupby("state_name")[numeric_cols].transform(lambda s: s.fillna(s.median()))
dem[numeric_cols] = dem[numeric_cols].fillna(dem[numeric_cols].median())
suffixes = r"\s+(County|Parish|Borough|Municipality|Census Area|City and Borough|City|Town|Village|District)$"
dem["county_clean"] = dem["county_name"].str.replace(suffixes, "", regex=True, flags=re.IGNORECASE).str.strip()
dem.to_csv(f"{OUT}/demographics_clean.csv", index=False)
print(f"demographics     rows={len(dem):>7}  nulls={dem.isnull().sum().sum():>5}")

# ── 3. Population density ─────────────────────────────────────────────────────
pop = pd.read_csv(f"{BASE}/PopulationDensityData.csv", encoding="utf-8-sig", dtype={"FIPS Code": str})
pop.columns = ["county_name", "state_name", "fips", "population", "area_sqmi", "density_per_sqmi"]
pop["fips"] = pop["fips"].str.strip()
pop.loc[pop["fips"] == "02-", "fips"] = "02270"
pop["fips"] = pop["fips"].str.zfill(5)
for c in ["population", "area_sqmi", "density_per_sqmi"]:
    pop[c] = pd.to_numeric(pop[c], errors="coerce")
pop["density_per_sqmi"] = (pop["population"] / pop["area_sqmi"].replace(0, np.nan)).round(2)
pop["log_density"] = np.log1p(pop["density_per_sqmi"]).round(4)
pop.to_csv(f"{OUT}/population_density_clean.csv", index=False)
print(f"population_density rows={len(pop):>7}  nulls={pop.isnull().sum().sum():>5}")

# ── 4. Education + Urban class ────────────────────────────────────────────────
edu = pd.read_csv(f"{BASE}/education.csv", encoding="utf-8-sig", dtype={"FIPS Code": str})
edu["FIPS Code"] = edu["FIPS Code"].str.strip().str.zfill(5)
is_agg = edu["FIPS Code"].str.endswith("000") | (edu["Area name"] == "United States")
edu = edu[~is_agg].copy()

urban_raw = ["FIPS Code", "State", "Area name",
             "2003 Rural-urban Continuum Code", "2003 Urban Influence Code",
             "2013 Rural-urban Continuum Code", "2013 Urban Influence Code",
             "City/Suburb/Town/Rural 2013"]
urban = edu[urban_raw].copy()
urban.columns = ["fips","state_abbr","area_name","rucc_2003","uic_2003","rucc_2013","uic_2013","urban_category_2013"]
for c in ["rucc_2003","uic_2003","rucc_2013","uic_2013"]:
    urban[c] = pd.to_numeric(urban[c], errors="coerce")
for c in ["rucc_2003","uic_2003","rucc_2013","uic_2013"]:
    urban[c] = urban.groupby("state_abbr")[c].transform(
        lambda s: s.fillna(s.mode().iloc[0] if not s.mode().empty else np.nan)
    )
    urban[c] = urban[c].fillna(urban[c].mode().iloc[0])
urban["urban_category_2013"] = urban["urban_category_2013"].fillna("Unknown")
urban["rucc_2013_label"] = urban["rucc_2013"].apply(rucc_label)
urban.to_csv(f"{OUT}/urban_class_clean.csv", index=False)
print(f"urban_class      rows={len(urban):>7}  nulls={urban.isnull().sum().sum():>5}")

years  = ["1970", "1980", "1990", "2000", "2015-19"]
levels = {
    "less_than_hs":        ["Less than a high school diploma"],
    "hs_only":             ["High school diploma only"],
    "some_college":        ["Some college (1-3 years)", "Some college or associate's degree"],
    "bachelors_or_higher": ["Four years of college or higher", "Bachelor's degree or higher"],
}
cols_lower = {c.lower(): c for c in edu.columns}
records = []
for _, row in edu.iterrows():
    for yr in years:
        for level_code, col_variants in levels.items():
            cnt_col = next(
                (cols_lower[k] for k in cols_lower
                 if any(v.lower() in k for v in col_variants) and yr in k and "percent" not in k),
                None,
            )
            pct_col = next(
                (cols_lower[k] for k in cols_lower
                 if any(v.lower() in k for v in col_variants) and yr in k and "percent" in k),
                None,
            )
            records.append({
                "fips": row["FIPS Code"], "state_abbr": row["State"], "area_name": row["Area name"],
                "period": yr, "level_code": level_code,
                "adults_count": clean_edu_num(row[cnt_col]) if cnt_col else np.nan,
                "adults_pct":   clean_edu_num(row[pct_col]) if pct_col else np.nan,
            })
edu_long = pd.DataFrame(records)
period_order = {"1970": 1970, "1980": 1980, "1990": 1990, "2000": 2000, "2015-19": 2017}
edu_long["period_num"] = edu_long["period"].map(period_order)
edu_long = edu_long.sort_values(["fips", "level_code", "period_num"])
for col in ["adults_count", "adults_pct"]:
    edu_long[col] = edu_long.groupby(["fips", "level_code"])[col].transform(
        lambda s: s.interpolate(method="linear", limit_direction="both")
    )
    edu_long[col] = edu_long.groupby(["period", "level_code"])[col].transform(
        lambda s: s.fillna(s.median())
    )
edu_long["adults_count"] = edu_long["adults_count"].round(0).astype("Int64")
edu_long["adults_pct"]   = edu_long["adults_pct"].clip(0, 100)
edu_long.to_csv(f"{OUT}/education_clean.csv", index=False)
print(f"education        rows={len(edu_long):>7}  nulls={edu_long.isnull().sum().sum():>5}")

# ── 5. Religion ───────────────────────────────────────────────────────────────
rel = pd.read_csv(f"{BASE}/religion_data.csv", encoding="latin-1", dtype={"fips": str}, low_memory=False)
bad = rel["fips"].isna() | (~rel["fips"].str.strip().str.match(r"^\d{5}$", na=False))
rel = rel[~bad].copy()
rel["fips"] = rel["fips"].str.strip().str.zfill(5)
for col in ["adherents_pct_total_adherents", "adherents_pct_total_population"]:
    rel[col] = pd.to_numeric(
        rel[col].astype(str).str.replace("%", "", regex=False).str.strip().replace({"": "nan"}),
        errors="coerce",
    )
rel["adherents"]     = pd.to_numeric(rel["adherents"],     errors="coerce")
rel["congregations"] = pd.to_numeric(rel["congregations"], errors="coerce")
rel["adherents"] = rel.groupby(["group_code", "state_name"])["adherents"].transform(lambda s: s.fillna(s.median()))
rel["adherents"] = rel.groupby("group_code")["adherents"].transform(lambda s: s.fillna(s.median()))
mask_still = rel["adherents"].isna() & rel["congregations"].notna() & (rel["congregations"] > 0)
rel.loc[mask_still, "adherents"] = rel.loc[mask_still, "congregations"]
rel["adherents"]     = rel["adherents"].fillna(0).round(0).astype("Int64")
rel["congregations"] = rel["congregations"].fillna(0).astype("Int64")

ct = rel.groupby("fips")["adherents"].sum().rename("cnt")
rel = rel.join(ct, on="fips")
mask_a = rel["adherents_pct_total_adherents"].isna() & (rel["cnt"] > 0)
rel.loc[mask_a, "adherents_pct_total_adherents"] = (
    rel.loc[mask_a, "adherents"] / rel.loc[mask_a, "cnt"] * 100
).round(4)
rel.drop(columns=["cnt"], inplace=True)

pop_lookup = pd.read_csv(f"{OUT}/population_density_clean.csv", usecols=["fips","population"], dtype={"fips": str})
rel = rel.merge(pop_lookup, on="fips", how="left")
mask_p = rel["adherents_pct_total_population"].isna() & (rel["population"] > 0)
rel.loc[mask_p, "adherents_pct_total_population"] = (
    rel.loc[mask_p, "adherents"] / rel.loc[mask_p, "population"] * 100
).round(4)
rel.drop(columns=["population"], inplace=True)
for c in ["adherents_pct_total_adherents", "adherents_pct_total_population"]:
    rel[c] = rel[c].clip(0, 100).fillna(0.0)
rel["group_name"]  = rel["group_name"].apply(normalize_str)
rel["county_name"] = rel["county_name"].apply(normalize_str)
rel.to_csv(f"{OUT}/religion_clean.csv", index=False)
print(f"religion         rows={len(rel):>7}  nulls={rel.isnull().sum().sum():>5}")
