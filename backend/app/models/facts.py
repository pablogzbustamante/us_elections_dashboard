from sqlalchemy import String, Integer, Text, DateTime, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.database import Base


class FactCountyCandidateVotes(Base):
    __tablename__ = "fact_county_candidate_votes"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    election_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_election.election_id"), primary_key=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_candidate.candidate_id"), primary_key=True)
    votes: Mapped[int | None] = mapped_column(Integer)
    vote_pct: Mapped[float | None] = mapped_column(Numeric(8, 4))
    is_winner: Mapped[bool | None] = mapped_column(Boolean)
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactCountyElectionSummary(Base):
    __tablename__ = "fact_county_election_summary"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    election_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_election.election_id"), primary_key=True)
    total_votes: Mapped[int | None] = mapped_column(Integer)
    winner_candidate_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("dim_candidate.candidate_id"))
    winner_name_raw: Mapped[str | None] = mapped_column(Text)
    margin_votes: Mapped[int | None] = mapped_column(Integer)
    margin_pct: Mapped[float | None] = mapped_column(Numeric(8, 4))
    competitiveness_score: Mapped[float | None] = mapped_column(Numeric(10, 4))
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactCountyElectionWinnerHistory(Base):
    __tablename__ = "fact_county_election_winner_history"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    election_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_election.election_id"), primary_key=True)
    winner_candidate_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("dim_candidate.candidate_id"))
    winner_name_raw: Mapped[str | None] = mapped_column(Text)
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactCountyMetric(Base):
    __tablename__ = "fact_county_metric"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    indicator_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_indicator.indicator_id"), primary_key=True)
    period_label: Mapped[str] = mapped_column(String(50), primary_key=True)
    metric_value: Mapped[float | None] = mapped_column(Numeric(18, 6))
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactCountyEducation(Base):
    __tablename__ = "fact_county_education"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    period_label: Mapped[str] = mapped_column(String(50), primary_key=True)
    education_level_id: Mapped[int] = mapped_column(Integer, ForeignKey("dim_education_level.education_level_id"), primary_key=True)
    adults_count: Mapped[int | None] = mapped_column(Integer)
    adults_pct: Mapped[float | None] = mapped_column(Numeric(8, 4))
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactCountyUrbanClass(Base):
    __tablename__ = "fact_county_urban_class"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    classification_year: Mapped[int] = mapped_column(Integer, primary_key=True)
    rural_urban_code: Mapped[int | None] = mapped_column(Integer)
    urban_influence_code: Mapped[int | None] = mapped_column(Integer)
    urban_category: Mapped[str | None] = mapped_column(String(100))
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactCountyReligion(Base):
    __tablename__ = "fact_county_religion"

    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"), primary_key=True)
    group_code: Mapped[str] = mapped_column(String(50), ForeignKey("dim_religious_group.group_code"), primary_key=True)
    congregations: Mapped[int | None] = mapped_column(Integer)
    adherents: Mapped[int | None] = mapped_column(Integer)
    pct_total_adherents: Mapped[float | None] = mapped_column(Numeric(8, 4))
    pct_total_population: Mapped[float | None] = mapped_column(Numeric(8, 4))
    source_file: Mapped[str | None] = mapped_column(Text)
    loaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
