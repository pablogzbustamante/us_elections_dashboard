from sqlalchemy import String, Integer, Text, DateTime, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.database import Base


class DimState(Base):
    __tablename__ = "dim_state"

    state_abbr: Mapped[str] = mapped_column(String(2), primary_key=True)
    state_name: Mapped[str] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    division: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    counties: Mapped[list["DimCounty"]] = relationship(back_populates="state")


class DimCounty(Base):
    __tablename__ = "dim_county"

    fips: Mapped[str] = mapped_column(String(5), primary_key=True)
    state_abbr: Mapped[str] = mapped_column(String(2), ForeignKey("dim_state.state_abbr"))
    county_name: Mapped[str] = mapped_column(String(150))
    county_type: Mapped[str | None] = mapped_column(String(50))
    county_search_text: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    state: Mapped["DimState"] = relationship(back_populates="counties")
    aliases: Mapped[list["CountyAlias"]] = relationship(back_populates="county")


class CountyAlias(Base):
    __tablename__ = "county_alias"

    alias_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"))
    source_file: Mapped[str | None] = mapped_column(Text)
    source_state_raw: Mapped[str | None] = mapped_column(Text)
    source_county_name_raw: Mapped[str] = mapped_column(Text)
    normalized_state: Mapped[str | None] = mapped_column(Text)
    normalized_county_name: Mapped[str] = mapped_column(Text)
    match_method: Mapped[str | None] = mapped_column(String(50))
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    county: Mapped["DimCounty"] = relationship(back_populates="aliases")


class DimElection(Base):
    __tablename__ = "dim_election"
    __table_args__ = (UniqueConstraint("election_year", "office", "election_type", "country"),)

    election_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    election_year: Mapped[int] = mapped_column(Integer)
    office: Mapped[str] = mapped_column(String(100))
    election_type: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100), default="United States")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DimParty(Base):
    __tablename__ = "dim_party"

    party_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    party_name: Mapped[str] = mapped_column(String(150))
    party_code: Mapped[str] = mapped_column(String(20), unique=True)
    ideology_label: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    candidates: Mapped[list["DimCandidate"]] = relationship(back_populates="party")


class DimCandidate(Base):
    __tablename__ = "dim_candidate"

    candidate_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    party_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("dim_party.party_id"))
    candidate_name: Mapped[str] = mapped_column(String(150))
    candidate_search_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    party: Mapped["DimParty"] = relationship(back_populates="candidates")


class DimIndicator(Base):
    __tablename__ = "dim_indicator"

    indicator_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    indicator_code: Mapped[str] = mapped_column(String(100), unique=True)
    indicator_name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100))
    unit: Mapped[str | None] = mapped_column(String(50))
    source_file: Mapped[str | None] = mapped_column(Text)
    value_type: Mapped[str | None] = mapped_column(String(50))
    business_use: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DimEducationLevel(Base):
    __tablename__ = "dim_education_level"

    education_level_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    education_level_code: Mapped[str] = mapped_column(String(100), unique=True)
    education_level_name: Mapped[str] = mapped_column(String(200))
    level_order: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DimReligiousGroup(Base):
    __tablename__ = "dim_religious_group"

    group_code: Mapped[str] = mapped_column(String(50), primary_key=True)
    group_name: Mapped[str] = mapped_column(String(200))
    tradition: Mapped[str | None] = mapped_column(String(100))
    group_search_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
