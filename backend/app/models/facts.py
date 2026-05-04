from sqlalchemy import String, SmallInteger, Integer, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class FactCountyCandidateVotes(Base):
    __tablename__ = "fact_county_candidate_votes"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    election_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("dim_election.election_id"), primary_key=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_candidate.candidate_id"), primary_key=True)
    votes: Mapped[int | None] = mapped_column(Integer)
    vote_pct: Mapped[float | None] = mapped_column(Numeric(10, 6))
    is_winner: Mapped[bool | None] = mapped_column(Boolean)


class FactCountyElectionSummary(Base):
    __tablename__ = "fact_county_election_summary"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    election_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("dim_election.election_id"), primary_key=True)
    total_votes: Mapped[int | None] = mapped_column(Integer)
    winner_candidate_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("dim_candidate.candidate_id"))
    winner_name_raw: Mapped[str | None] = mapped_column(String(160))
    margin_votes: Mapped[int | None] = mapped_column(Integer)
    margin_pct: Mapped[float | None] = mapped_column(Numeric(10, 6))
    competitiveness_score: Mapped[float | None] = mapped_column(Numeric(10, 6))


class FactCountyMetric(Base):
    __tablename__ = "fact_county_metric"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    indicator_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("dim_indicator.indicator_id"), primary_key=True)
    period_label: Mapped[str] = mapped_column(String(50), primary_key=True)
    metric_value: Mapped[float | None] = mapped_column(Numeric(20, 4))


class FactCountyEducation(Base):
    __tablename__ = "fact_county_education"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    period_label: Mapped[str] = mapped_column(String(50), primary_key=True)
    education_level_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("dim_education_level.education_level_id"), primary_key=True)
    adults_count: Mapped[int | None] = mapped_column(Integer)
    adults_pct: Mapped[float | None] = mapped_column(Numeric(10, 4))


class FactCountyUrbanClass(Base):
    __tablename__ = "fact_county_urban_class"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    classification_year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    rural_urban_code: Mapped[int | None] = mapped_column(SmallInteger, ForeignKey("dim_rucc_code.code"))
    urban_influence_code: Mapped[int | None] = mapped_column(SmallInteger, ForeignKey("dim_uic_code.code"))


class FactCountyReligion(Base):
    __tablename__ = "fact_county_religion"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    group_code: Mapped[str] = mapped_column(String(20), ForeignKey("dim_religious_group.group_code"), primary_key=True)
    congregations: Mapped[int | None] = mapped_column(Integer)
    adherents: Mapped[int | None] = mapped_column(Integer)
    pct_total_adherents: Mapped[float | None] = mapped_column(Numeric(10, 4))
    pct_total_population: Mapped[float | None] = mapped_column(Numeric(10, 4))
