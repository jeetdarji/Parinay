# File: routers/ai.py
# Purpose: AI endpoints — match explanation + client journey summary (Gemini).
# Phase: 3 — Gemini AI Service

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from models.ai_models import (
    ExplainMatchRequest,
    ExplanationResponse,
    JourneySummaryRequest,
    JourneySummaryResponse,
)
from services.gemini_service import (
    generate_journey_summary,
    generate_match_explanation,
)
from services.nlp_service import NLPService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai"])


def get_nlp_service(request: Request) -> NLPService:
    """Resolve the shared NLPService instance from app.state."""
    nlp = getattr(request.app.state, "nlp_service", None)
    if nlp is None:
        raise HTTPException(
            status_code=503,
            detail="NLP models not loaded yet. Service is warming up.",
        )
    return nlp


@router.post("/explain-match", response_model=ExplanationResponse)
async def explain_match(
    payload: ExplainMatchRequest,
    request: Request,
    nlp_service: NLPService = Depends(get_nlp_service),
) -> ExplanationResponse:
    """Generate the AI Match Explanation Card for the Send Match modal."""
    if not getattr(request.app.state, "models_loaded", False):
        raise HTTPException(
            status_code=503,
            detail="Models still loading. Please retry in a few seconds.",
        )

    client = payload.client_profile
    match = payload.match_profile

    # Step 2 — re-compute NLP signals fresh for accuracy.
    client_vec = nlp_service.encode_interests(client.hobbies or "")
    match_vec = nlp_service.encode_interests(match.hobbies or "")
    similarity = nlp_service.compute_interest_similarity(client_vec, match_vec)

    client_industry = nlp_service.extract_industry(
        client.current_company, client.designation
    )
    match_industry = nlp_service.extract_industry(
        match.current_company, match.designation
    )
    industry_compat_level = nlp_service.industry_compatibility_score(
        client_industry, match_industry
    )

    # Mutate a copy of the signals (do not touch the profile objects).
    signals = payload.computed_signals.model_copy(deep=True)
    signals.semantic_interest_similarity = float(similarity)
    signals.client_industry = client_industry
    signals.match_industry = match_industry
    signals.industry_compatibility_level = industry_compat_level
    signals.industry_compatible = industry_compat_level >= 1

    if similarity >= 0.70:
        signals.interest_similarity_label = "Very High"
    elif similarity >= 0.50:
        signals.interest_similarity_label = "High"
    elif similarity >= 0.30:
        signals.interest_similarity_label = "Moderate"
    else:
        signals.interest_similarity_label = "Low"

    client_pg = client.has_postgrad
    match_pg = match.has_postgrad
    if client_pg and match_pg:
        signals.education_parity = "Both Postgrad"
    elif not client_pg and not match_pg:
        signals.education_parity = "Both Undergrad"
    else:
        signals.education_parity = "Mixed"

    client_city = (client.city or "").lower().strip()
    match_city = (match.city or "").lower().strip()
    client_country = (client.country or "").lower().strip()
    match_country = (match.country or "").lower().strip()
    if client_city == match_city and client_city != "":
        signals.geography_situation = "Same City"
    elif client_country == match_country:
        signals.geography_situation = "Same Country"
    else:
        signals.geography_situation = "Different Country"

    enriched_request = ExplainMatchRequest(
        client_profile=client,
        match_profile=match,
        computed_signals=signals,
    )

    try:
        result = generate_match_explanation(enriched_request)
    except Exception:  # noqa: BLE001
        logger.exception("explain-match generation failed")
        raise HTTPException(
            status_code=500,
            detail="AI explanation generation failed. Please try again.",
        )

    logger.info(
        "explain-match: client=%s, match=%s, model=%s, fallback=%s",
        client.first_name, match.first_name, result.model_used, result.is_fallback,
    )
    return result


@router.post("/journey-summary", response_model=JourneySummaryResponse)
async def journey_summary(
    payload: JourneySummaryRequest,
    request: Request,
) -> JourneySummaryResponse:
    """Generate a 3-sentence summary of a client's matchmaking journey."""
    if not getattr(request.app.state, "models_loaded", False):
        raise HTTPException(
            status_code=503,
            detail="Models still loading. Please retry in a few seconds.",
        )

    if len(payload.notes) == 0 and len(payload.stage_history) == 0:
        logger.warning(
            "journey-summary: no notes or stage history for client %s",
            payload.client_profile.first_name,
        )

    try:
        result = generate_journey_summary(payload)
    except Exception:  # noqa: BLE001
        logger.exception("journey-summary generation failed")
        raise HTTPException(
            status_code=500,
            detail="AI summary generation failed. Please try again.",
        )

    logger.info(
        "journey-summary: client=%s, notes=%s, stages=%s, model=%s, fallback=%s",
        payload.client_profile.first_name, result.notes_count,
        result.stage_count, result.model_used, result.is_fallback,
    )
    return result
