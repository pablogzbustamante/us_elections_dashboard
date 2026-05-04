from sqlalchemy import String, SmallInteger, Integer, BigInteger, Text, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class DimState(Base):
    __tablename__ = "dim_state"

    state_abbr: Mapped[str] = mapped_column(String(2), primary_key=True)
    state_name: Mapped[str] = mapped_column(String(100))

    counties: Mapped[list["DimCounty"]] = relationship(back_populates="state")


class DimCounty(Base):
    __tablename__ = "dim_county"

    fips: Mapped[str] = mapped_column(String(5), primary_key=True)
    state_abbr: Mapped[str] = mapped_column(String(2), ForeignKey("dim_state.state_abbr"))
    county_name: Mapped[str] = mapped_column(String(160))
    county_type: Mapped[str | None] = mapped_column(String(60))
    county_search_text: Mapped[str | None] = mapped_column(Text)

    state: Mapped["DimState"] = relationship(back_populates="counties")
    aliases: Mapped[list["CountyAlias"]] = relationship(back_populates="county")


class CountyAlias(Base):
    __tablename__ = "county_alias"
    __table_args__ = (
        UniqueConstraint("source_file", "source_state_raw", "source_county_name_raw"),
    )

    alias_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    fips: Mapped[str] = mapped_column(String(5), ForeignKey("dim_county.fips"))
    source_file: Mapped[str] = mapped_column(String(120))
    source_state_raw: Mapped[str | None] = mapped_column(Text)
    source_county_name_raw: Mapped[str] = mapped_column(Text)
    normalized_state: Mapped[str | None] = mapped_column(Text)
    normalized_county_name: Mapped[str] = mapped_column(Text)
    match_method: Mapped[str] = mapped_column(String(20), default="unresolved")
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 4))

    county: Mapped["DimCounty"] = relationship(back_populates="aliases")


class DimElection(Base):
    __tablename__ = "dim_election"
    __table_args__ = (UniqueConstraint("election_year", "office", "election_type", "country"),)

    election_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    election_year: Mapped[int] = mapped_column(Integer)
    office: Mapped[str] = mapped_column(String(80))
    election_type: Mapped[str | None] = mapped_column(String(60))
    country: Mapped[str] = mapped_column(String(80), default="United States")


class DimParty(Base):
    __tablename__ = "dim_party"
    __table_args__ = (UniqueConstraint("party_name"),)

    party_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    party_name: Mapped[str] = mapped_column(String(100))
    party_code: Mapped[str] = mapped_column(String(30), unique=True)
    ideology_label: Mapped[str | None] = mapped_column(String(80))

    candidates: Mapped[list["DimCandidate"]] = relationship(back_populates="party")


class DimCandidate(Base):
    __tablename__ = "dim_candidate"
    __table_args__ = (UniqueConstraint("candidate_name", "party_id"),)

    candidate_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    party_id: Mapped[int | None] = mapped_column(SmallInteger, ForeignKey("dim_party.party_id"))
    candidate_name: Mapped[str] = mapped_column(String(160))

    party: Mapped["DimParty"] = relationship(back_populates="candidates")


class DimIndicator(Base):
    __tablename__ = "dim_indicator"

    indicator_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    indicator_code: Mapped[str] = mapped_column(String(120), unique=True)
    indicator_name: Mapped[str] = mapped_column(String(220))
    category: Mapped[str] = mapped_column(String(80))
    unit: Mapped[str] = mapped_column(String(60))
    value_type: Mapped[str] = mapped_column(String(20))


class DimEducationLevel(Base):
    __tablename__ = "dim_education_level"
    __table_args__ = (UniqueConstraint("level_order"),)

    education_level_id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    education_level_code: Mapped[str] = mapped_column(String(60), unique=True)
    education_level_name: Mapped[str] = mapped_column(String(160))
    level_order: Mapped[int] = mapped_column(SmallInteger)


class DimReligiousGroup(Base):
    __tablename__ = "dim_religious_group"
    __table_args__ = (UniqueConstraint("group_name"),)

    group_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    group_name: Mapped[str] = mapped_column(String(240))
    group_search_text: Mapped[str | None] = mapped_column(Text)


class DimRuccCode(Base):
    __tablename__ = "dim_rucc_code"

    code: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    description: Mapped[str] = mapped_column(String(200))


class DimUicCode(Base):
    __tablename__ = "dim_uic_code"

    code: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    description: Mapped[str] = mapped_column(String(200))
