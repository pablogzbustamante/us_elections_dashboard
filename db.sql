-- ============================================================
-- Electoral Dashboard – PostgreSQL DDL
-- ============================================================

\c electoral_dashboard

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Staging tables
-- ============================================================

CREATE TABLE IF NOT EXISTS stg_elections_raw (
  raw_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  objectid VARCHAR(30),
  county_name VARCHAR(160),
  state_name VARCHAR(100),
  state_abbr VARCHAR(10),
  fips VARCHAR(20),
  votes_tot VARCHAR(30),
  votes_trump VARCHAR(30),
  votes_harris VARCHAR(30),
  votes_stein VARCHAR(30),
  pct_trump VARCHAR(30),
  pct_harris VARCHAR(30),
  pct_stein VARCHAR(30),
  winner_2024 VARCHAR(120),
  winner_2020 VARCHAR(120),
  winner_2016 VARCHAR(120),
  load_batch_id VARCHAR(80),
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stg_elections_fips ON stg_elections_raw (fips);
CREATE INDEX idx_stg_elections_state_county ON stg_elections_raw (state_abbr, county_name);
CREATE INDEX idx_stg_elections_names_trgm ON stg_elections_raw USING gin ((county_name || ' ' || state_name || ' ' || COALESCE(winner_2024,'') || ' ' || COALESCE(winner_2020,'') || ' ' || COALESCE(winner_2016,'')) gin_trgm_ops);

CREATE TABLE IF NOT EXISTS stg_population_density_raw (
  raw_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  county VARCHAR(160),
  state VARCHAR(100),
  fips_code VARCHAR(20),
  population VARCHAR(40),
  area VARCHAR(40),
  density VARCHAR(40),
  load_batch_id VARCHAR(80),
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stg_density_fips ON stg_population_density_raw (fips_code);
CREATE INDEX idx_stg_density_state_county ON stg_population_density_raw (state, county);

CREATE TABLE IF NOT EXISTS stg_demographics_raw (
  raw_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  county VARCHAR(160),
  state VARCHAR(100),
  age_pct_65_older VARCHAR(40),
  age_pct_under_18 VARCHAR(40),
  age_pct_under_5 VARCHAR(40),
  education_bachelors_degree_or_higher VARCHAR(40),
  education_high_school_or_higher VARCHAR(40),
  employment_nonemployer_establishments VARCHAR(40),
  ethnicities_american_indian_alaska_native_alone VARCHAR(40),
  ethnicities_asian_alone VARCHAR(40),
  ethnicities_black_alone VARCHAR(40),
  ethnicities_hispanic_or_latino VARCHAR(40),
  ethnicities_native_hawaiian_pacific_islander_alone VARCHAR(40),
  ethnicities_two_or_more_races VARCHAR(40),
  ethnicities_white_alone VARCHAR(40),
  ethnicities_white_alone_not_hispanic_latino VARCHAR(40),
  housing_homeownership_rate VARCHAR(40),
  housing_households VARCHAR(40),
  housing_housing_units VARCHAR(40),
  housing_median_value_owner_occupied_units VARCHAR(40),
  housing_persons_per_household VARCHAR(40),
  income_median_household_income VARCHAR(40),
  income_per_capita_income VARCHAR(40),
  misc_foreign_born VARCHAR(40),
  misc_land_area VARCHAR(40),
  misc_language_other_than_english_home VARCHAR(40),
  misc_living_same_house_1_year VARCHAR(40),
  misc_manufacturers_shipments VARCHAR(40),
  misc_mean_travel_time_work VARCHAR(40),
  misc_percent_female VARCHAR(40),
  misc_veterans VARCHAR(40),
  population_2020 VARCHAR(40),
  population_2010 VARCHAR(40),
  population_per_square_mile VARCHAR(40),
  sales_accommodation_food_services VARCHAR(40),
  sales_retail_sales VARCHAR(40),
  employment_firms_total VARCHAR(40),
  employment_firms_women_owned VARCHAR(40),
  employment_firms_men_owned VARCHAR(40),
  employment_firms_minority_owned VARCHAR(40),
  employment_firms_nonminority_owned VARCHAR(40),
  employment_firms_veteran_owned VARCHAR(40),
  employment_firms_nonveteran_owned VARCHAR(40),
  load_batch_id VARCHAR(80),
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stg_demo_state_county ON stg_demographics_raw (state, county);

CREATE TABLE IF NOT EXISTS stg_education_raw (
  raw_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fips_code VARCHAR(20),
  state VARCHAR(20),
  area_name VARCHAR(160),
  rural_urban_code_2003 VARCHAR(20),
  urban_influence_code_2003 VARCHAR(20),
  rural_urban_code_2013 VARCHAR(20),
  urban_influence_code_2013 VARCHAR(20),
  city_suburb_town_rural_2013 VARCHAR(80),
  less_than_hs_count_1970 VARCHAR(40),
  hs_only_count_1970 VARCHAR(40),
  some_college_count_1970 VARCHAR(40),
  college_4yr_count_1970 VARCHAR(40),
  less_than_hs_pct_1970 VARCHAR(40),
  hs_only_pct_1970 VARCHAR(40),
  some_college_pct_1970 VARCHAR(40),
  college_4yr_pct_1970 VARCHAR(40),
  less_than_hs_count_1980 VARCHAR(40),
  hs_only_count_1980 VARCHAR(40),
  some_college_count_1980 VARCHAR(40),
  college_4yr_count_1980 VARCHAR(40),
  less_than_hs_pct_1980 VARCHAR(40),
  hs_only_pct_1980 VARCHAR(40),
  some_college_pct_1980 VARCHAR(40),
  college_4yr_pct_1980 VARCHAR(40),
  less_than_hs_count_1990 VARCHAR(40),
  hs_only_count_1990 VARCHAR(40),
  some_college_assoc_count_1990 VARCHAR(40),
  bachelors_or_higher_count_1990 VARCHAR(40),
  less_than_hs_pct_1990 VARCHAR(40),
  hs_only_pct_1990 VARCHAR(40),
  some_college_assoc_pct_1990 VARCHAR(40),
  bachelors_or_higher_pct_1990 VARCHAR(40),
  less_than_hs_count_2000 VARCHAR(40),
  hs_only_count_2000 VARCHAR(40),
  some_college_assoc_count_2000 VARCHAR(40),
  bachelors_or_higher_count_2000 VARCHAR(40),
  less_than_hs_pct_2000 VARCHAR(40),
  hs_only_pct_2000 VARCHAR(40),
  some_college_assoc_pct_2000 VARCHAR(40),
  bachelors_or_higher_pct_2000 VARCHAR(40),
  less_than_hs_count_2015_19 VARCHAR(40),
  hs_only_count_2015_19 VARCHAR(40),
  some_college_assoc_count_2015_19 VARCHAR(40),
  bachelors_or_higher_count_2015_19 VARCHAR(40),
  less_than_hs_pct_2015_19 VARCHAR(40),
  hs_only_pct_2015_19 VARCHAR(40),
  some_college_assoc_pct_2015_19 VARCHAR(40),
  bachelors_or_higher_pct_2015_19 VARCHAR(40),
  load_batch_id VARCHAR(80),
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stg_education_fips ON stg_education_raw (fips_code);
CREATE INDEX idx_stg_education_state_area ON stg_education_raw (state, area_name);

CREATE TABLE IF NOT EXISTS stg_religion_raw (
  raw_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fips VARCHAR(20),
  state_name VARCHAR(100),
  county_name VARCHAR(160),
  group_code VARCHAR(20),
  group_name VARCHAR(240),
  congregations VARCHAR(40),
  adherents VARCHAR(40),
  adherents_pct_total_adherents VARCHAR(40),
  adherents_pct_total_population VARCHAR(40),
  load_batch_id VARCHAR(80),
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stg_religion_fips ON stg_religion_raw (fips);
CREATE INDEX idx_stg_religion_group_code ON stg_religion_raw (group_code);

-- ============================================================
-- Dimension tables
-- ============================================================

CREATE TABLE IF NOT EXISTS dim_state (
  state_abbr CHAR(2) NOT NULL PRIMARY KEY,
  state_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dim_county (
  fips CHAR(5) NOT NULL PRIMARY KEY,
  state_abbr CHAR(2) NOT NULL REFERENCES dim_state(state_abbr),
  county_name VARCHAR(160) NOT NULL,
  county_type VARCHAR(60),
  county_search_text VARCHAR(320),
  UNIQUE (state_abbr, county_name)
);

CREATE INDEX idx_dim_county_state ON dim_county (state_abbr);
CREATE INDEX idx_dim_county_search_trgm ON dim_county USING gin (county_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS county_alias (
  alias_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fips CHAR(5) NOT NULL REFERENCES dim_county(fips),
  source_file VARCHAR(120) NOT NULL,
  source_state_raw VARCHAR(100),
  source_county_name_raw VARCHAR(180) NOT NULL,
  normalized_state VARCHAR(100),
  normalized_county_name VARCHAR(180),
  match_method VARCHAR(20) NOT NULL DEFAULT 'unresolved'
    CHECK (match_method IN ('exact_fips','exact_state_county','alias','manual','unresolved')),
  confidence_score NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_file, source_state_raw, source_county_name_raw)
);

CREATE INDEX idx_county_alias_fips ON county_alias (fips);

CREATE TABLE IF NOT EXISTS dim_election (
  election_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  election_year SMALLINT NOT NULL,
  office VARCHAR(80) NOT NULL DEFAULT 'President',
  election_type VARCHAR(60) NOT NULL DEFAULT 'General',
  country VARCHAR(80) NOT NULL DEFAULT 'United States',
  UNIQUE (election_year, office, election_type, country)
);

CREATE INDEX idx_election_year ON dim_election (election_year);

CREATE TABLE IF NOT EXISTS dim_party (
  party_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  party_name VARCHAR(100) NOT NULL UNIQUE,
  party_code VARCHAR(30) UNIQUE,
  ideology_label VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS dim_candidate (
  candidate_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  party_id SMALLINT REFERENCES dim_party(party_id),
  candidate_name VARCHAR(160) NOT NULL,
  UNIQUE (candidate_name, party_id)
);

CREATE INDEX idx_candidate_party ON dim_candidate (party_id);

-- ============================================================
-- Fact tables
-- ============================================================

CREATE TABLE IF NOT EXISTS fact_county_candidate_votes (
  fips CHAR(5) NOT NULL REFERENCES dim_county(fips),
  election_id SMALLINT NOT NULL REFERENCES dim_election(election_id),
  candidate_id INT NOT NULL REFERENCES dim_candidate(candidate_id),
  votes INT,
  vote_pct NUMERIC(10,6) CHECK (vote_pct IS NULL OR vote_pct BETWEEN 0 AND 100),
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (fips, election_id, candidate_id)
);

CREATE INDEX idx_votes_candidate ON fact_county_candidate_votes (candidate_id);
CREATE INDEX idx_votes_election_candidate ON fact_county_candidate_votes (election_id, candidate_id);
CREATE INDEX idx_votes_fips_election ON fact_county_candidate_votes (fips, election_id);
CREATE INDEX idx_votes_pct ON fact_county_candidate_votes (vote_pct);

CREATE TABLE IF NOT EXISTS fact_county_election_summary (
  fips CHAR(5) NOT NULL REFERENCES dim_county(fips),
  election_id SMALLINT NOT NULL REFERENCES dim_election(election_id),
  total_votes INT,
  winner_candidate_id INT REFERENCES dim_candidate(candidate_id),
  winner_name_raw VARCHAR(160),
  margin_votes INT,
  margin_pct NUMERIC(10,6) CHECK (margin_pct IS NULL OR margin_pct BETWEEN 0 AND 100),
  competitiveness_score NUMERIC(10,6) CHECK (competitiveness_score IS NULL OR competitiveness_score BETWEEN 0 AND 1),
  PRIMARY KEY (fips, election_id)
);

CREATE INDEX idx_summary_election_winner ON fact_county_election_summary (election_id, winner_candidate_id);
CREATE INDEX idx_summary_margin ON fact_county_election_summary (margin_pct);
CREATE INDEX idx_summary_competitiveness ON fact_county_election_summary (competitiveness_score);

CREATE TABLE IF NOT EXISTS dim_indicator (
  indicator_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  indicator_code VARCHAR(120) NOT NULL UNIQUE,
  indicator_name VARCHAR(220) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit VARCHAR(60) NOT NULL,
  value_type VARCHAR(20) NOT NULL
    CHECK (value_type IN ('count','percent','currency','ratio','density','area','minutes','index'))
);

CREATE INDEX idx_indicator_category ON dim_indicator (category);

CREATE TABLE IF NOT EXISTS fact_county_metric (
  fips CHAR(5) NOT NULL REFERENCES dim_county(fips),
  indicator_id SMALLINT NOT NULL REFERENCES dim_indicator(indicator_id),
  period_label VARCHAR(30) NOT NULL DEFAULT 'current',
  metric_value NUMERIC(20,4),
  PRIMARY KEY (fips, indicator_id, period_label)
);

CREATE INDEX idx_metric_indicator_period ON fact_county_metric (indicator_id, period_label);
CREATE INDEX idx_metric_value ON fact_county_metric (indicator_id, metric_value);

CREATE TABLE IF NOT EXISTS dim_education_level (
  education_level_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  education_level_code VARCHAR(60) NOT NULL UNIQUE,
  education_level_name VARCHAR(160) NOT NULL,
  level_order SMALLINT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS fact_county_education (
  fips CHAR(5) NOT NULL REFERENCES dim_county(fips),
  period_label VARCHAR(30) NOT NULL,
  education_level_id SMALLINT NOT NULL REFERENCES dim_education_level(education_level_id),
  adults_count INT,
  adults_pct NUMERIC(10,4) CHECK (adults_pct IS NULL OR adults_pct BETWEEN 0 AND 100),
  PRIMARY KEY (fips, period_label, education_level_id)
);

CREATE INDEX idx_education_period_level ON fact_county_education (period_label, education_level_id);
CREATE INDEX idx_education_pct ON fact_county_education (education_level_id, adults_pct);

CREATE TABLE IF NOT EXISTS dim_rucc_code (
  code        SMALLINT    NOT NULL PRIMARY KEY,
  description VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_uic_code (
  code        SMALLINT    NOT NULL PRIMARY KEY,
  description VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_county_urban_class (
  fips                  CHAR(5)  NOT NULL REFERENCES dim_county(fips),
  classification_year   SMALLINT NOT NULL,
  rural_urban_code      SMALLINT REFERENCES dim_rucc_code(code),
  urban_influence_code  SMALLINT REFERENCES dim_uic_code(code),
  PRIMARY KEY (fips, classification_year)
);

CREATE INDEX idx_urban_class_rucc ON fact_county_urban_class (rural_urban_code);
CREATE INDEX idx_urban_class_uic  ON fact_county_urban_class (urban_influence_code);

CREATE TABLE IF NOT EXISTS dim_religious_group (
  group_code VARCHAR(20) NOT NULL PRIMARY KEY,
  group_name VARCHAR(240) NOT NULL UNIQUE,
  group_search_text VARCHAR(360)
);

CREATE TABLE IF NOT EXISTS fact_county_religion (
  fips CHAR(5) NOT NULL REFERENCES dim_county(fips),
  group_code VARCHAR(20) NOT NULL REFERENCES dim_religious_group(group_code),
  congregations INT,
  adherents INT,
  pct_total_adherents NUMERIC(10,4) CHECK (pct_total_adherents IS NULL OR pct_total_adherents BETWEEN 0 AND 100),
  pct_total_population NUMERIC(10,4) CHECK (pct_total_population IS NULL OR pct_total_population BETWEEN 0 AND 100),
  PRIMARY KEY (fips, group_code)
);

CREATE INDEX idx_religion_group ON fact_county_religion (group_code);
CREATE INDEX idx_religion_adherents ON fact_county_religion (adherents);
CREATE INDEX idx_religion_pct_population ON fact_county_religion (pct_total_population);

-- ============================================================
-- Views
-- ============================================================

CREATE OR REPLACE VIEW vw_county_election_2024 AS
SELECT
  c.fips,
  c.county_name,
  c.state_abbr,
  s.state_name,
  es.total_votes,
  es.winner_name_raw,
  es.margin_votes,
  es.margin_pct,
  es.competitiveness_score,
  MAX(v.votes)   FILTER (WHERE cand.candidate_name = 'Trump')  AS votes_trump,
  MAX(v.vote_pct) FILTER (WHERE cand.candidate_name = 'Trump')  AS pct_trump,
  MAX(v.votes)   FILTER (WHERE cand.candidate_name = 'Harris') AS votes_harris,
  MAX(v.vote_pct) FILTER (WHERE cand.candidate_name = 'Harris') AS pct_harris,
  MAX(v.votes)   FILTER (WHERE cand.candidate_name = 'Stein')  AS votes_stein,
  MAX(v.vote_pct) FILTER (WHERE cand.candidate_name = 'Stein')  AS pct_stein
FROM dim_county c
JOIN dim_state s ON s.state_abbr = c.state_abbr
JOIN dim_election e ON e.election_year = 2024
  AND e.office = 'President'
  AND e.election_type = 'General'
LEFT JOIN fact_county_election_summary es ON es.fips = c.fips AND es.election_id = e.election_id
LEFT JOIN fact_county_candidate_votes v  ON v.fips = c.fips  AND v.election_id = e.election_id
LEFT JOIN dim_candidate cand ON cand.candidate_id = v.candidate_id
GROUP BY c.fips, c.county_name, c.state_abbr, s.state_name,
         es.total_votes, es.winner_name_raw, es.margin_votes,
         es.margin_pct, es.competitiveness_score;

CREATE OR REPLACE VIEW vw_county_religion_top_group AS
SELECT DISTINCT ON (fr.fips)
  fr.fips,
  rg.group_code,
  rg.group_name,
  fr.congregations,
  fr.adherents,
  fr.pct_total_population
FROM fact_county_religion fr
JOIN dim_religious_group rg ON rg.group_code = fr.group_code
ORDER BY fr.fips, fr.adherents DESC;

-- ============================================================
-- Seed data
-- ============================================================

INSERT INTO dim_party (party_name, party_code, ideology_label) VALUES
  ('Republican Party',  'REP', 'Right'),
  ('Democratic Party',  'DEM', 'Center-left'),
  ('Green Party',       'GRN', 'Left'),
  ('Unknown',           'UNK', NULL)
ON CONFLICT (party_name) DO NOTHING;

INSERT INTO dim_candidate (party_id, candidate_name)
SELECT p.party_id, v.cname
FROM (VALUES
  ('REP', 'Trump'),
  ('DEM', 'Harris'),
  ('GRN', 'Stein')
) AS v(pcode, cname)
JOIN dim_party p ON p.party_code = v.pcode
ON CONFLICT (candidate_name, party_id) DO NOTHING;

INSERT INTO dim_election (election_year, office, election_type, country) VALUES
  (2016, 'President', 'General', 'United States'),
  (2020, 'President', 'General', 'United States'),
  (2024, 'President', 'General', 'United States')
ON CONFLICT (election_year, office, election_type, country) DO NOTHING;

INSERT INTO dim_education_level (education_level_code, education_level_name, level_order) VALUES
  ('less_than_high_school',    'Less than a high school diploma', 1),
  ('high_school_only',         'High school diploma only',        2),
  ('some_college_or_associate','Some college or associate degree', 3),
  ('bachelors_or_higher',      'Bachelor degree or higher',       4)
ON CONFLICT (education_level_code) DO NOTHING;

INSERT INTO dim_rucc_code (code, description) VALUES
  (1, 'Metro – Counties in metro areas of 1 million pop or more'),
  (2, 'Metro – Counties in metro areas of 250,000 to 1 million pop'),
  (3, 'Metro – Counties in metro areas of fewer than 250,000 pop'),
  (4, 'Nonmetro – Urban pop 20,000+, adjacent to a metro area'),
  (5, 'Nonmetro – Urban pop 20,000+, not adjacent to a metro area'),
  (6, 'Nonmetro – Urban pop 2,500–19,999, adjacent to a metro area'),
  (7, 'Nonmetro – Urban pop 2,500–19,999, not adjacent to a metro area'),
  (8, 'Nonmetro – Completely rural or <2,500 urban pop, adjacent to metro'),
  (9, 'Nonmetro – Completely rural or <2,500 urban pop, not adjacent to metro')
ON CONFLICT (code) DO NOTHING;

INSERT INTO dim_uic_code (code, description) VALUES
  (1,  'In large metro areas of 1+ million residents'),
  (2,  'In small metro areas of less than 1 million residents'),
  (3,  'Micropolitan area adjacent to large metro area'),
  (4,  'Noncore adjacent to large metro area with own town of 10,000+'),
  (5,  'Micropolitan area not adjacent to a metro area'),
  (6,  'Noncore adjacent to large metro area with no town >= 2,500'),
  (7,  'Micropolitan area adjacent to small metro area'),
  (8,  'Noncore adjacent to small metro area with own town of 10,000+'),
  (9,  'Noncore adjacent to small metro area with no town >= 2,500'),
  (10, 'Micropolitan area not adjacent to a metro or micro area'),
  (11, 'Noncore adjacent to micro area (not adjacent to metro)'),
  (12, 'Noncore not adjacent to metro or micro area')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Migration: drop removed columns
-- Run against an existing database (safe to re-run on fresh installs where columns don't exist)
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON dim_state;
DROP TRIGGER IF EXISTS set_updated_at ON dim_county;
DROP FUNCTION IF EXISTS trg_set_updated_at();

ALTER TABLE dim_state               DROP COLUMN IF EXISTS region;
ALTER TABLE dim_state               DROP COLUMN IF EXISTS division;
ALTER TABLE dim_state               DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_state               DROP COLUMN IF EXISTS updated_at;
ALTER TABLE dim_county              DROP COLUMN IF EXISTS latitude;
ALTER TABLE dim_county              DROP COLUMN IF EXISTS longitude;
ALTER TABLE dim_county              DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_county              DROP COLUMN IF EXISTS updated_at;
ALTER TABLE dim_election            DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_party               DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_candidate           DROP COLUMN IF EXISTS candidate_search_text;
ALTER TABLE dim_candidate           DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_indicator           DROP COLUMN IF EXISTS business_use;
ALTER TABLE dim_indicator           DROP COLUMN IF EXISTS source_file;
ALTER TABLE dim_indicator           DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_education_level     DROP COLUMN IF EXISTS created_at;
ALTER TABLE dim_religious_group     DROP COLUMN IF EXISTS tradition;
ALTER TABLE dim_religious_group     DROP COLUMN IF EXISTS created_at;
ALTER TABLE fact_county_candidate_votes     DROP COLUMN IF EXISTS source_file;
ALTER TABLE fact_county_candidate_votes     DROP COLUMN IF EXISTS loaded_at;
ALTER TABLE fact_county_election_summary    DROP COLUMN IF EXISTS source_file;
ALTER TABLE fact_county_election_summary    DROP COLUMN IF EXISTS loaded_at;
ALTER TABLE fact_county_metric      DROP COLUMN IF EXISTS source_file;
ALTER TABLE fact_county_metric      DROP COLUMN IF EXISTS loaded_at;
ALTER TABLE fact_county_education   DROP COLUMN IF EXISTS source_file;
ALTER TABLE fact_county_education   DROP COLUMN IF EXISTS loaded_at;
ALTER TABLE fact_county_urban_class DROP COLUMN IF EXISTS urban_category;
ALTER TABLE fact_county_urban_class DROP COLUMN IF EXISTS source_file;
ALTER TABLE fact_county_urban_class DROP COLUMN IF EXISTS loaded_at;
ALTER TABLE fact_county_religion    DROP COLUMN IF EXISTS source_file;
ALTER TABLE fact_county_religion    DROP COLUMN IF EXISTS loaded_at;

-- ============================================================
-- Structural migrations (existing databases only)
-- ============================================================

-- Drop redundant winner-history table; data is in fact_county_election_summary
DROP TABLE IF EXISTS fact_county_election_winner_history CASCADE;

-- Create RUCC/UIC dimension tables if not already created above
CREATE TABLE IF NOT EXISTS dim_rucc_code (
  code        SMALLINT    NOT NULL PRIMARY KEY,
  description VARCHAR(200) NOT NULL
);
CREATE TABLE IF NOT EXISTS dim_uic_code (
  code        SMALLINT    NOT NULL PRIMARY KEY,
  description VARCHAR(200) NOT NULL
);


-- Add FK constraints (will error if already present — safe to skip on re-runs)
DO $$ BEGIN
  ALTER TABLE fact_county_urban_class
    ADD CONSTRAINT fk_urban_rucc FOREIGN KEY (rural_urban_code) REFERENCES dim_rucc_code(code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE fact_county_urban_class
    ADD CONSTRAINT fk_urban_uic  FOREIGN KEY (urban_influence_code) REFERENCES dim_uic_code(code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add missing composite index on candidate votes (idempotent)
CREATE INDEX IF NOT EXISTS idx_votes_fips_election ON fact_county_candidate_votes (fips, election_id);
CREATE INDEX IF NOT EXISTS idx_urban_class_rucc    ON fact_county_urban_class (rural_urban_code);
CREATE INDEX IF NOT EXISTS idx_urban_class_uic     ON fact_county_urban_class (urban_influence_code);

-- Fix competitiveness_score CHECK constraint: values are 0-1, not 0-100
DO $$ BEGIN
  ALTER TABLE fact_county_election_summary
    DROP CONSTRAINT IF EXISTS fact_county_election_summary_competitiveness_score_check;
  ALTER TABLE fact_county_election_summary
    ADD CONSTRAINT fact_county_election_summary_competitiveness_score_check
      CHECK (competitiveness_score IS NULL OR competitiveness_score BETWEEN 0 AND 1);
EXCEPTION WHEN others THEN NULL; END $$;