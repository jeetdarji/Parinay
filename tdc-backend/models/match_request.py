# File: models/match_request.py
# Purpose: Request body model for POST /match/{client_id}.
# Phase: 2 — Backend Base + Matching Engine

from typing import List

from pydantic import BaseModel, ConfigDict, field_validator

from models.profile import ProfileModel


class MatchRequest(BaseModel):
    """Body for the matching endpoint.

    The frontend fetches the client's full profile and the entire
    opposite-gender dummy pool from Supabase (respecting RLS), then sends both
    in the request body. This keeps the matching contract self-contained and
    easy to test without the backend needing to query Supabase in Phase 2.
    """

    client_profile: ProfileModel
    candidate_pool: List[ProfileModel]

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("candidate_pool")
    @classmethod
    def _pool_not_empty(cls, v: List[ProfileModel]) -> List[ProfileModel]:
        """The candidate pool must contain at least one profile."""
        if not v:
            raise ValueError("candidate_pool must not be empty")
        return v
