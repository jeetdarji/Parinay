# File: models/profile.py
# Purpose: Pydantic v2 model mirroring a row of the Supabase `profiles` table.
# Phase: 2 — Backend Base + Matching Engine

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class ProfileModel(BaseModel):
    """A single profile row from the `profiles` table.

    Every field name matches the Phase 1 schema exactly. All columns that are
    nullable in PostgreSQL are Optional[...] = None here. Fields with database
    defaults carry the same default in Python so partial payloads validate.
    """

    # Identity ---------------------------------------------------------------
    id: Optional[str] = None              # UUID as string; None for unsaved
    matchmaker_id: Optional[str] = None
    is_dummy: bool = False

    # Personal ---------------------------------------------------------------
    first_name: str
    last_name: str
    gender: str                           # 'Male' | 'Female' | 'Other'
    date_of_birth: Optional[date] = None
    age: Optional[int] = None             # computed in DB — never set by Python

    # Contact ----------------------------------------------------------------
    email: Optional[str] = None
    phone: Optional[str] = None
    city: str
    country: str = "India"

    # Physical ---------------------------------------------------------------
    height_cm: Optional[int] = None
    complexion: Optional[str] = None

    # Education --------------------------------------------------------------
    ug_college: Optional[str] = None
    ug_degree: Optional[str] = None
    pg_college: Optional[str] = None
    pg_degree: Optional[str] = None

    # Career -----------------------------------------------------------------
    current_company: Optional[str] = None
    designation: Optional[str] = None
    income_annual: Optional[int] = None   # BIGINT in DB

    # Family -----------------------------------------------------------------
    marital_status: str = "Never Married"
    father_occupation: Optional[str] = None
    mother_occupation: Optional[str] = None
    siblings_brothers: int = 0
    siblings_sisters: int = 0
    family_type: Optional[str] = None

    # Religion ---------------------------------------------------------------
    religion: Optional[str] = None
    caste: Optional[str] = None
    sub_caste: Optional[str] = None

    # Lifestyle --------------------------------------------------------------
    want_kids: Optional[str] = None
    open_to_relocate: Optional[str] = None
    open_to_pets: Optional[str] = None
    diet: Optional[str] = None
    drink: Optional[str] = None
    smoke: Optional[str] = None
    languages: Optional[List[str]] = None
    hobbies: Optional[str] = None

    # Partner preferences ----------------------------------------------------
    pref_age_min: Optional[int] = None
    pref_age_max: Optional[int] = None
    pref_height_min: Optional[int] = None
    pref_income_min: Optional[int] = None
    pref_caste_open: Optional[str] = None
    pref_city: Optional[str] = None

    # Matchmaking metadata ---------------------------------------------------
    stage: str = "New"
    last_contacted_at: Optional[datetime] = None
    photo_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
    )

    @field_validator("gender")
    @classmethod
    def _validate_gender(cls, v: str) -> str:
        """Gender must be one of the three allowed values (matches DB CHECK)."""
        allowed = {"Male", "Female", "Other"}
        if v not in allowed:
            raise ValueError(f"gender must be one of {sorted(allowed)}, got '{v}'")
        return v

    @property
    def full_name(self) -> str:
        """Convenience display name — not a DB column."""
        return f"{self.first_name} {self.last_name}"

    @property
    def has_postgrad(self) -> bool:
        """True if the profile has a non-empty postgraduate degree."""
        return self.pg_degree is not None and self.pg_degree.strip() != ""
