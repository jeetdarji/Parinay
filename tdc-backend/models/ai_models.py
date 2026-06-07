# File: models/ai_models.py
# Purpose: Pydantic v2 request/response models for the Gemini AI endpoints.
# Phase: 3 — Gemini AI Service

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from models.profile import ProfileModel


# ===========================================================================
# REQUEST MODELS
# ===========================================================================

class ComputedSignals(BaseModel):
    """Pre-computed NLP and scoring signals assembled by the backend before
    calling Gemini. Passed alongside raw profiles so Gemini reasons from
    computed facts rather than re-deriving them — prevents hallucinated
    compatibility claims.
    """

    age_delta: Optional[int] = None              # candidate age - client age
    height_delta_cm: Optional[int] = None        # candidate height - client height
    income_delta_pct: Optional[float] = None     # (candidate - client) / client * 100
    kids_preference_match: Optional[bool] = None
    relocation_compatible: Optional[bool] = None
    semantic_interest_similarity: Optional[float] = None   # 0.0–1.0 cosine
    interest_similarity_label: Optional[str] = None        # Very High/High/Moderate/Low
    client_industry: Optional[str] = None
    match_industry: Optional[str] = None
    industry_compatible: Optional[bool] = None
    industry_compatibility_level: Optional[int] = None     # 0 diff, 1 adjacent, 2 same
    lifestyle_score: Optional[int] = None                  # 0–15
    education_parity: Optional[str] = None                 # Both Postgrad/Undergrad/Mixed/No Data
    geography_situation: Optional[str] = None              # Same City/Same Country/Different Country

    model_config = ConfigDict(populate_by_name=True)

    @property
    def interest_similarity_label_computed(self) -> str:
        """Human-readable interest label, derived from the score if not set."""
        if self.interest_similarity_label is not None:
            return self.interest_similarity_label
        sim = self.semantic_interest_similarity
        if sim is None:
            return "Unknown"
        if sim >= 0.70:
            return "Very High"
        if sim >= 0.50:
            return "High"
        if sim >= 0.30:
            return "Moderate"
        return "Low"


class ExplainMatchRequest(BaseModel):
    """Body for POST /ai/explain-match."""

    client_profile: ProfileModel
    match_profile: ProfileModel
    computed_signals: ComputedSignals

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def _different_genders(self) -> "ExplainMatchRequest":
        if self.client_profile.gender == self.match_profile.gender:
            raise ValueError(
                "client_profile and match_profile must be different genders"
            )
        return self


class NoteEntry(BaseModel):
    """Single timestamped matchmaker note."""

    content: str
    created_at: Optional[datetime] = None
    matchmaker_name: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class StageHistoryEntry(BaseModel):
    """Single stage change record."""

    old_stage: Optional[str] = None
    new_stage: str
    changed_at: Optional[datetime] = None
    changed_by_name: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class JourneySummaryRequest(BaseModel):
    """Body for POST /ai/journey-summary."""

    client_profile: ProfileModel
    notes: List[NoteEntry] = []
    stage_history: List[StageHistoryEntry] = []

    model_config = ConfigDict(populate_by_name=True)


# ===========================================================================
# RESPONSE MODELS
# ===========================================================================

_VALID_SCORE_LABELS = {"High Potential Match", "Good Match", "Possible"}


class ExplanationResponse(BaseModel):
    """Structured Gemini output for the match explanation card. Doubles as the
    API response model and the validation schema for Gemini's raw output.
    """

    compatibility_score_label: str
    headline: str
    why_this_works: List[str]
    talking_points: List[str]
    intro_email_draft: str
    generated_at: Optional[str] = None
    model_used: Optional[str] = None
    is_fallback: bool = False

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())

    @field_validator("compatibility_score_label", mode="before")
    @classmethod
    def _normalize_label(cls, v):
        """Coerce common Gemini variations to the three canonical labels."""
        if not isinstance(v, str):
            return "Good Match"
        cleaned = v.strip()
        lowered = cleaned.lower()
        mapping = {
            "high potential": "High Potential Match",
            "high potential match": "High Potential Match",
            "good match": "Good Match",
            "good": "Good Match",
            "possible": "Possible",
            "possible match": "Possible",
        }
        if cleaned in _VALID_SCORE_LABELS:
            return cleaned
        if lowered in mapping:
            return mapping[lowered]
        return "Good Match"

    @field_validator("headline", mode="before")
    @classmethod
    def _trim_headline(cls, v):
        """Strip whitespace; truncate to <=120 chars at a word boundary."""
        if not isinstance(v, str):
            return "A thoughtful introduction"
        text = v.strip()
        if len(text) <= 120:
            return text
        truncated = text[:120]
        # back off to the last whitespace so we don't cut a word
        if " " in truncated:
            truncated = truncated[: truncated.rfind(" ")]
        return truncated.strip()

    @field_validator("why_this_works", "talking_points", mode="before")
    @classmethod
    def _exactly_three(cls, v):
        """Ensure exactly 3 items: trim extras, pad shortfalls."""
        if not isinstance(v, list):
            v = [] if v is None else [v]
        items = [str(x).strip() for x in v if str(x).strip()]
        if len(items) > 3:
            return items[:3]
        while len(items) < 3:
            items.append("A shared foundation worth exploring further.")
        return items

    @field_validator("intro_email_draft", mode="before")
    @classmethod
    def _validate_email(cls, v):
        """Strip whitespace; reject clearly-failed (too short) generations."""
        if not isinstance(v, str):
            raise ValueError("intro_email_draft must be a string")
        text = v.strip()
        if len(text) < 100:
            raise ValueError("intro_email_draft too short — likely failed generation")
        return text


class JourneySummaryResponse(BaseModel):
    """Response for POST /ai/journey-summary."""

    summary: str
    client_name: str
    generated_at: Optional[str] = None
    model_used: Optional[str] = None
    is_fallback: bool = False
    notes_count: int = 0
    stage_count: int = 0

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())
