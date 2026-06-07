# File: routers/matching.py
# Purpose: POST /match/{client_id} — orchestrates NLP + matching engine.
# Phase: 2 — Backend Base + Matching Engine

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from models.match_request import MatchRequest
from models.match_response import MatchResponse
from services.matching_engine import (
    score_matches_for_female,
    score_matches_for_male,
)
from services.nlp_service import NLPService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["matching"])

_SMALL_POOL_THRESHOLD = 50


def get_nlp_service(request: Request) -> NLPService:
    """Resolve the shared NLPService instance from app.state."""
    nlp = getattr(request.app.state, "nlp_service", None)
    if nlp is None:
        raise HTTPException(
            status_code=503,
            detail="NLP models not loaded yet. Service is warming up.",
        )
    return nlp


@router.post("/{client_id}", response_model=MatchResponse)
async def match_client(
    client_id: str,
    payload: MatchRequest,
    request: Request,
    nlp_service: NLPService = Depends(get_nlp_service),
) -> MatchResponse:
    """Score a client against the supplied candidate pool and return top matches."""
    # Step 1 — models loaded?
    if not getattr(request.app.state, "models_loaded", False):
        raise HTTPException(
            status_code=503,
            detail="Models still loading. Please retry in a few seconds.",
        )

    client_profile = payload.client_profile

    # Step 2 — scoring mode.
    if client_profile.gender == "Male":
        scoring_mode = "male_client"
        expected_gender = "Female"
    elif client_profile.gender == "Female":
        scoring_mode = "female_client"
        expected_gender = "Male"
    else:
        raise HTTPException(
            status_code=400,
            detail="Matching for gender 'Other' is not supported in this version.",
        )

    # Step 3 — filter candidate pool to the expected opposite gender.
    candidates = [p for p in payload.candidate_pool if p.gender == expected_gender]
    if not candidates:
        raise HTTPException(
            status_code=400,
            detail="No candidates of appropriate gender found in candidate_pool.",
        )

    logger.info(
        "Match request received for client %s, gender=%s, candidates=%d, mode=%s",
        client_id, client_profile.gender, len(candidates), scoring_mode,
    )
    if len(candidates) < _SMALL_POOL_THRESHOLD:
        logger.warning(
            "Candidate pool is unusually small (%d < %d) for client %s",
            len(candidates), _SMALL_POOL_THRESHOLD, client_id,
        )

    try:
        # Step 4 — compute NLP interest similarities.
        client_vec = nlp_service.encode_interests(client_profile.hobbies or "")
        interest_similarities: dict[str, float] = {}
        all_zero = True
        for i, cand in enumerate(candidates):
            cand_vec = nlp_service.encode_interests(cand.hobbies or "")
            similarity = nlp_service.compute_interest_similarity(client_vec, cand_vec)
            if similarity > 0.0:
                all_zero = False
            key = cand.id if cand.id is not None else f"idx_{i}"
            interest_similarities[key] = similarity

        if all_zero:
            logger.warning(
                "All interest similarities are zero for client %s — "
                "NLP models may have failed silently.", client_id,
            )

        # Step 5 — run the matching engine.
        if scoring_mode == "male_client":
            results, hard_filtered = score_matches_for_male(
                client_profile, candidates, interest_similarities
            )
        else:
            results, hard_filtered = score_matches_for_female(
                client_profile, candidates, interest_similarities
            )

        logger.info(
            "Match scoring complete: %d results from %d candidates (%d hard filtered)",
            len(results), len(candidates), hard_filtered,
        )

        # Step 6 — build response.
        return MatchResponse(
            matches=results,
            total_candidates_evaluated=len(candidates),
            hard_filtered_out=hard_filtered,
            scoring_mode=scoring_mode,
            client_id=client_id,
        )

    except HTTPException:
        raise
    except Exception:  # noqa: BLE001
        logger.exception("Unhandled error during matching for client %s", client_id)
        raise HTTPException(
            status_code=500,
            detail="Internal error during matching. Check server logs.",
        )


# ===========================================================================
# TESTING CHECKLIST (run after `uvicorn main:app --reload`)
# ===========================================================================
#
# TEST 1 — Health before models load (first ~10s after start):
#   curl http://localhost:8000/health
#   Expected: {"status":"ok","models_loaded":false,...}
#
# TEST 2 — Health after models load:
#   curl http://localhost:8000/health
#   Expected: {"status":"ok","models_loaded":true,"spacy_loaded":true,
#              "embeddings_loaded":true,"version":"1.0.0"}
#
# TEST 3 — Root:
#   curl http://localhost:8000/
#   Expected: {"service":"TDC Matchmaker API","version":"1.0.0",...}
#
# TEST 4 — Match, minimal valid payload (1 candidate):
#   curl -X POST http://localhost:8000/match/test-client-001 \
#     -H "Content-Type: application/json" \
#     -d '{ "client_profile": { "first_name": "Arjun", "last_name": "Mehta",
#       "gender": "Male", "city": "Mumbai", "age": 30, "height_cm": 175,
#       "income_annual": 2000000, "want_kids": "Yes", "open_to_relocate": "Yes",
#       "hobbies": "hiking, reading, cooking", "pref_caste_open": "Open",
#       "stage": "Active - Searching" },
#       "candidate_pool": [
#         { "id": "dummy-001", "first_name": "Priya", "last_name": "Sharma",
#           "gender": "Female", "city": "Mumbai", "age": 27, "height_cm": 162,
#           "income_annual": 1500000, "want_kids": "Yes", "open_to_relocate": "Yes",
#           "hobbies": "hiking, yoga, travelling", "pref_caste_open": "Open",
#           "stage": "Active - Searching" } ] }'
#   Expected: HTTP 200, matches array with 1 result, score > 0
#
# TEST 5 — Gender mismatch (Male client, only Male candidates):
#   Send a Male client with all-Male candidate_pool.
#   Expected: HTTP 400 "No candidates of appropriate gender found..."
#
# TEST 6 — Kids hard filter:
#   client want_kids="Yes", candidate want_kids="No"
#   Expected: HTTP 200 with 0 matches (candidate hard-filtered out).
#
# TEST 7 — AI placeholder:
#   curl -X POST http://localhost:8000/ai/explain-match \
#     -H "Content-Type: application/json" -d '{}'
#   Expected: HTTP 501 Not Implemented
#
# ---------------------------------------------------------------------------
# SAMPLE 3-CANDIDATE PAYLOAD for TEST 4 (varying compatibility):
# ---------------------------------------------------------------------------
#   {
#     "client_profile": {
#       "first_name": "Arjun", "last_name": "Mehta", "gender": "Male",
#       "city": "Mumbai", "age": 31, "height_cm": 178, "income_annual": 3000000,
#       "want_kids": "Yes", "open_to_relocate": "Yes", "diet": "Vegetarian",
#       "drink": "Socially", "smoke": "Never", "pg_degree": "MBA",
#       "religion": "Hindu", "caste": "Brahmin", "pref_caste_open": "Open",
#       "pref_age_min": 26, "pref_age_max": 30,
#       "hobbies": "hiking and trekking, reading literary fiction, cooking",
#       "stage": "Active - Searching"
#     },
#     "candidate_pool": [
#       {
#         "id": "c-high", "first_name": "Ananya", "last_name": "Iyer",
#         "gender": "Female", "city": "Mumbai", "age": 28, "height_cm": 163,
#         "income_annual": 2000000, "want_kids": "Yes", "open_to_relocate": "Yes",
#         "diet": "Vegetarian", "drink": "Socially", "smoke": "Never",
#         "pg_degree": "MBA", "religion": "Hindu", "caste": "Brahmin",
#         "hobbies": "hiking and trekking, reading literary fiction, baking",
#         "stage": "Active - Searching"
#       },
#       {
#         "id": "c-mid", "first_name": "Riya", "last_name": "Sharma",
#         "gender": "Female", "city": "Pune", "age": 29, "height_cm": 160,
#         "income_annual": 1600000, "want_kids": "Maybe", "open_to_relocate": "Maybe",
#         "diet": "Non-Vegetarian", "drink": "Socially", "smoke": "Never",
#         "pg_degree": "MTech", "religion": "Hindu", "caste": "Kshatriya",
#         "hobbies": "photography, travelling to offbeat destinations, yoga",
#         "stage": "Active - Searching"
#       },
#       {
#         "id": "c-low", "first_name": "Meera", "last_name": "Nair",
#         "gender": "Female", "city": "London", "age": 30, "height_cm": 168,
#         "income_annual": 5000000, "want_kids": "No", "open_to_relocate": "No",
#         "diet": "Vegan", "drink": "Regularly", "smoke": "Occasionally",
#         "religion": "Christian", "pref_caste_open": "Open",
#         "hobbies": "music production, video games",
#         "stage": "Active - Searching"
#       }
#     ]
#   }
# Expected: c-high scores highest (High Potential / Good Match), c-mid mid,
#           c-low likely hard-filtered (income > 1.15x or kids Yes/No mismatch).
# ===========================================================================
