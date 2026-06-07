# File: models/match_response.py
# Purpose: Response models for POST /match/{client_id}.
# Phase: 2 — Backend Base + Matching Engine

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ScoreBreakdown(BaseModel):
    """Per-axis score components for a single match (for UI transparency)."""

    kids: int = 0
    relocation: int = 0
    lifestyle: int = 0
    education: int = 0
    geography: int = 0
    religion_caste: int = 0
    age_delta: int = 0
    interest_similarity: float = 0.0

    model_config = ConfigDict(populate_by_name=True)


class MatchResult(BaseModel):
    """A single scored candidate returned to the frontend."""

    profile_id: str
    first_name: str
    last_name: str
    age: Optional[int]
    city: str
    country: str
    designation: Optional[str]
    current_company: Optional[str]
    income_annual: Optional[int]
    height_cm: Optional[int]
    gender: str
    score: int                       # 0–100, normalized
    score_label: str                 # High Potential Match | Good Match | Possible
    score_breakdown: ScoreBreakdown
    interest_similarity_raw: float   # raw cosine similarity before bonus scaling

    model_config = ConfigDict(populate_by_name=True)


class MatchResponse(BaseModel):
    """Full response envelope for the matching endpoint."""

    matches: List[MatchResult]
    total_candidates_evaluated: int
    hard_filtered_out: int
    scoring_mode: str                # "male_client" | "female_client"
    client_id: str

    model_config = ConfigDict(populate_by_name=True)
