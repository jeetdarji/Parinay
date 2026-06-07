# File: services/gemini_service.py
# Purpose: Gemini AI service — fallback chain, match explanation + journey summary.
# Phase: 3 — Gemini AI Service

import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from models.ai_models import (
    ComputedSignals,
    ExplainMatchRequest,
    ExplanationResponse,
    JourneySummaryRequest,
    JourneySummaryResponse,
)
from models.profile import ProfileModel

logger = logging.getLogger(__name__)

# ===========================================================================
# FALLBACK CHAIN + EXCEPTION GROUPS
# ===========================================================================

GEMINI_MODEL_CHAIN = [
    "gemini-2.5-flash",        # primary — best quality
    "gemini-2.0-flash",        # fallback — still excellent
    "gemini-2.5-flash-lite",   # last resort — reliable, separate lower-cost quota
]
# NOTE: the original spec listed "gemini-1.5-flash" as last resort, but that
# model returns 404 (retired) for current Gemini API keys. "gemini-2.5-flash
# -lite" is a live model with its own quota pool, so it survives 429s on the
# two flash models above. Verified against genai.list_models() for this key.

RATE_LIMIT_EXCEPTIONS = (
    google_exceptions.ResourceExhausted,
    google_exceptions.ServiceUnavailable,
    google_exceptions.DeadlineExceeded,
    google_exceptions.TooManyRequests,
)

RETRIABLE_EXCEPTIONS = RATE_LIMIT_EXCEPTIONS + (
    google_exceptions.InternalServerError,
    google_exceptions.Unknown,
)


class GeminiAllModelsFailedError(Exception):
    def __init__(self, last_error: Exception, attempts: List[str], context_label: str = ""):
        self.last_error = last_error
        self.attempts = attempts
        super().__init__(
            f"All Gemini models failed for {context_label}. "
            f"Attempted: {attempts}. Last error: {last_error}"
        )


class JSONParseFailedError(Exception):
    pass


# ===========================================================================
# SMALL HELPERS
# ===========================================================================

def _income_bracket(income: Optional[int]) -> str:
    if income is None:
        return "Not specified"
    if income < 1_000_000:
        return "Under ₹10L"
    if income < 2_000_000:
        return "₹10L–₹20L"
    if income < 4_000_000:
        return "₹20L–₹40L"
    if income < 7_000_000:
        return "₹40L–₹70L"
    if income < 12_000_000:
        return "₹70L–₹1.2Cr"
    return "₹1.2Cr+"


def _interest_label(similarity: Optional[float]) -> str:
    if similarity is None:
        return "Unknown"
    if similarity >= 0.70:
        return "Very High"
    if similarity >= 0.50:
        return "High"
    if similarity >= 0.30:
        return "Moderate"
    return "Low"


def _strip_code_fences(text: str) -> str:
    """Remove a leading/trailing markdown code fence if present."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines and lines[-1].strip() == "```":
            cleaned = "\n".join(lines[1:-1])
        else:
            cleaned = "\n".join(lines[1:])
        cleaned = cleaned.strip()
    return cleaned


# ===========================================================================
# CORE CALL FUNCTION
# ===========================================================================

def _call_gemini_with_fallback(
    prompt_parts: list,
    generation_config: dict,
    context_label: str,
) -> Tuple[str, str]:
    """Call Gemini through the model chain, falling back on rate-limit/service
    errors. Returns (raw_response_text, model_used). Raises
    GeminiAllModelsFailedError if every model fails.
    """
    last_error: Optional[Exception] = None
    attempted: List[str] = []

    for model_name in GEMINI_MODEL_CHAIN:
        attempted.append(model_name)
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config,
            )
            response = model.generate_content(prompt_parts)

            if not getattr(response, "text", None) or not response.text.strip():
                raise ValueError(f"Empty response from {model_name}")

            logger.info("[%s] Success with model: %s", context_label, model_name)
            return response.text, model_name

        except RATE_LIMIT_EXCEPTIONS as e:
            last_error = e
            logger.warning(
                "[%s] Rate limit on %s: %s. Switching to next model...",
                context_label, model_name, type(e).__name__,
            )
            continue
        except RETRIABLE_EXCEPTIONS as e:
            last_error = e
            logger.warning(
                "[%s] Service error on %s: %s: %s. Switching to next model...",
                context_label, model_name, type(e).__name__, e,
            )
            continue
        except Exception as e:  # noqa: BLE001 - unexpected errors also fall through
            last_error = e
            logger.error(
                "[%s] Unexpected error on %s: %s: %s",
                context_label, model_name, type(e).__name__, e,
            )
            continue

    raise GeminiAllModelsFailedError(last_error, attempted, context_label)


# ===========================================================================
# JSON PARSING WITH RETRY
# ===========================================================================

def _parse_json_response(
    raw_text: str,
    model_used: str,
    context_label: str,
    strict_prompt_parts: list,
    generation_config: dict,
) -> Tuple[dict, str]:
    """Parse JSON from Gemini output. On failure, retry once with a stricter
    prompt. Returns (parsed_dict, model_used). Raises JSONParseFailedError.
    """
    # ATTEMPT 1 — parse raw text directly.
    try:
        cleaned = _strip_code_fences(raw_text)
        return json.loads(cleaned), model_used
    except json.JSONDecodeError:
        logger.warning(
            "[%s] JSON parse failed on first attempt. Retrying...", context_label
        )

    # ATTEMPT 2 — retry with the stricter prompt.
    try:
        retry_text, retry_model = _call_gemini_with_fallback(
            strict_prompt_parts, generation_config, f"{context_label}_retry"
        )
        cleaned_retry = _strip_code_fences(retry_text)
        parsed = json.loads(cleaned_retry)
        logger.info(
            "[%s] JSON parse succeeded on retry with %s", context_label, retry_model
        )
        return parsed, retry_model
    except (json.JSONDecodeError, GeminiAllModelsFailedError) as e:
        logger.error("[%s] JSON parse failed on retry: %s", context_label, e)
        raise JSONParseFailedError(f"JSON parsing failed after retry: {e}")


# ===========================================================================
# FUNCTION 1: generate_match_explanation
# ===========================================================================

SYSTEM_PROMPT_EXPLAIN = """You are an expert matchmaking assistant for The Date Crew (TDC),
India's premium human-led matchmaking service. TDC's brand promise is:
"No AI. No App. No Endless Swiping. Just real matchmakers."

Your role is to help TDC's matchmakers articulate why two profiles are
compatible in language that is warm, specific, human, and emotionally
intelligent. You write in second person, as if speaking to the matchmaker
("You might introduce them because...").

CRITICAL QUALITY RULES — FOLLOW STRICTLY:
1. Be specific to the actual data provided. NEVER write generic statements
   like "they share common values" or "both want a serious relationship"
   without grounding them in actual profile fields.
2. Reference names (first names only), specific hobbies, industries,
   cities, and life goals that appear in the context.
3. Do NOT invent details not present in the context JSON.
4. Do NOT use clichés like "perfect match", "soulmates", "chemistry",
   or "spark". Use intelligent, considered language.
5. The intro email must sound like it was written by a thoughtful human
   matchmaker — warm, specific, professional. Never like a dating app
   notification.
6. The intro email should be addressed to the CLIENT (not the match).
   It introduces the MATCH to the client by first name.

TONE: Sophisticated, warm, considered, intelligent. Think: a brilliant
friend who happens to know both people very well and is making a
thoughtful introduction over coffee.

OUTPUT FORMAT: You must respond with ONLY a valid JSON object.
No markdown. No backticks. No explanation text before or after the JSON.
Start your response with { and end with }."""


def generate_match_explanation(request: ExplainMatchRequest) -> ExplanationResponse:
    """Generate the AI Match Explanation Card. Called by POST /ai/explain-match."""
    client = request.client_profile
    match = request.match_profile
    signals = request.computed_signals

    # STEP 1 — assemble a focused context dict.
    context = {
        "client": {
            "name": client.first_name,
            "age": client.age,
            "city": client.city,
            "country": client.country,
            "height_cm": client.height_cm,
            "designation": client.designation,
            "company": client.current_company,
            "industry": signals.client_industry or "Not specified",
            "education_level": "Postgraduate" if client.has_postgrad else "Graduate",
            "income_bracket": _income_bracket(client.income_annual),
            "want_kids": client.want_kids,
            "open_to_relocate": client.open_to_relocate,
            "diet": client.diet,
            "drink": client.drink,
            "smoke": client.smoke,
            "religion": client.religion,
            "caste_preference": client.pref_caste_open,
            "hobbies": client.hobbies,
            "family_type": client.family_type,
            "languages": client.languages,
        },
        "match": {
            "name": match.first_name,
            "age": match.age,
            "city": match.city,
            "country": match.country,
            "height_cm": match.height_cm,
            "designation": match.designation,
            "company": match.current_company,
            "industry": signals.match_industry or "Not specified",
            "education_level": "Postgraduate" if match.has_postgrad else "Graduate",
            "income_bracket": _income_bracket(match.income_annual),
            "want_kids": match.want_kids,
            "open_to_relocate": match.open_to_relocate,
            "diet": match.diet,
            "drink": match.drink,
            "smoke": match.smoke,
            "religion": match.religion,
            "hobbies": match.hobbies,
            "family_type": match.family_type,
            "languages": match.languages,
        },
        "compatibility_signals": {
            "age_gap_years": signals.age_delta,
            "kids_aligned": signals.kids_preference_match,
            "relocation_compatible": signals.relocation_compatible,
            "interest_similarity": signals.interest_similarity_label
            or _interest_label(signals.semantic_interest_similarity),
            "interest_similarity_score": round(
                signals.semantic_interest_similarity or 0.0, 2
            ),
            "same_industry": (
                signals.industry_compatibility_level == 2
                if signals.industry_compatibility_level is not None
                else None
            ),
            "industry_adjacency": signals.industry_compatible,
            "lifestyle_alignment_score": signals.lifestyle_score,
            "education_parity": signals.education_parity,
            "geographic_situation": signals.geography_situation,
        },
    }
    context_json = json.dumps(context, indent=2, default=str)

    # STEP 2/3 — user prompt.
    user_prompt = f"""Here is the structured compatibility context for two profiles you are
introducing. All signals have been pre-computed by TDC's matching engine.

PROFILES AND SIGNALS:
{context_json}

Generate a JSON object with EXACTLY these fields and types:

{{
  "compatibility_score_label": "<string: exactly one of 'High Potential Match' | 'Good Match' | 'Possible'>",
  "headline": "<string: one punchy sentence, max 12 words, captures the core compatibility theme>",
  "why_this_works": [
    "<string: 1st reason — specific to actual data, 1–2 sentences>",
    "<string: 2nd reason — different compatibility axis, specific>",
    "<string: 3rd reason — third compatibility dimension, specific>"
  ],
  "talking_points": [
    "<string: 1–4 word conversation topic label>",
    "<string: 1–4 word conversation topic label>",
    "<string: 1–4 word conversation topic label>"
  ],
  "intro_email_draft": "<string: 3-paragraph intro email from matchmaker to client. Para 1: introduce match by first name + one standout quality. Para 2: 2–3 specific reasons they are being connected, referencing actual data points. Para 3: suggest a relaxed first meeting format. 150–250 words total. Warm, human, specific.>"
}}

Base the compatibility_score_label on the signals:
- kids_aligned=true + high lifestyle_alignment + high interest_similarity → High Potential Match
- Good alignment on most axes → Good Match
- Some alignment, some gaps → Possible

The headline must capture something TRUE about both people — not a platitude.
Each why_this_works point must reference at least one specific field from
the context (a hobby, a city, an industry, a life goal)."""

    generation_config = {
        "temperature": 0.7,
        "max_output_tokens": 3000,  # headroom: gemini-2.5-flash spends tokens on
                                    # internal reasoning before emitting JSON; 900
                                    # truncated the output mid-string.
        "response_mime_type": "application/json",
    }

    prompt_parts = [SYSTEM_PROMPT_EXPLAIN, user_prompt]

    # STEP 5 — call with fallback.
    try:
        raw_text, model_used = _call_gemini_with_fallback(
            prompt_parts, generation_config, "explain_match"
        )
    except GeminiAllModelsFailedError as e:
        logger.error("All Gemini models failed for explain_match: %s", e)
        return _static_fallback_explanation(client, match, signals)

    # STEP 6 — parse JSON (with strict retry).
    strict_suffix = (
        "\n\nCRITICAL: Your previous response was not valid JSON. "
        "Return ONLY a raw JSON object. No markdown. No backticks. "
        "Start with { and end with }."
    )
    strict_prompt_parts = [SYSTEM_PROMPT_EXPLAIN, user_prompt + strict_suffix]

    try:
        parsed_dict, final_model = _parse_json_response(
            raw_text, model_used, "explain_match",
            strict_prompt_parts, generation_config,
        )
    except JSONParseFailedError:
        logger.error("JSON parsing failed for explain_match — using static fallback")
        return _static_fallback_explanation(client, match, signals)

    # STEP 7 — validate with Pydantic.
    try:
        return ExplanationResponse(
            **parsed_dict,
            generated_at=datetime.now(timezone.utc).isoformat(),
            model_used=final_model,
            is_fallback=False,
        )
    except Exception as e:  # noqa: BLE001
        logger.error("Pydantic validation failed for ExplanationResponse: %s", e)
        logger.debug("Raw parsed dict was: %s", parsed_dict)
        return _static_fallback_explanation(client, match, signals)


# ===========================================================================
# FUNCTION 2: generate_journey_summary
# ===========================================================================

SYSTEM_PROMPT_SUMMARY = """You are a matchmaking assistant for The Date Crew (TDC), India's premium
matchmaking service. You help matchmakers quickly understand a client's
journey status when they're reviewing a client file.

Write in third person, past tense where applicable, present tense for
current status. Be factual, warm, and concise. Never speculate beyond
what the notes and stage history confirm. If there are no notes, say so
honestly rather than inventing details.

OUTPUT FORMAT: Respond with ONLY a valid JSON object.
No markdown, no backticks, no extra text.
Start with { and end with }."""


def generate_journey_summary(request: JourneySummaryRequest) -> JourneySummaryResponse:
    """Generate a 3-sentence journey summary. Called by POST /ai/journey-summary."""
    client = request.client_profile
    notes = request.notes
    stage_history = request.stage_history

    # STEP 1 — assemble context (chronological).
    _min_aware = datetime.min.replace(tzinfo=timezone.utc)

    def _aware(dt: Optional[datetime]) -> datetime:
        if dt is None:
            return _min_aware
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

    sorted_notes = sorted(notes, key=lambda n: _aware(n.created_at))
    notes_text = "\n".join(
        f"- [{n.created_at.strftime('%d %b %Y') if n.created_at else 'Date unknown'}] "
        f"{n.content}"
        for n in sorted_notes
    ) or "No notes recorded yet."

    sorted_stages = sorted(stage_history, key=lambda s: _aware(s.changed_at))
    stages_text = "\n".join(
        f"- {s.old_stage or 'Start'} → {s.new_stage} "
        f"[{s.changed_at.strftime('%d %b %Y') if s.changed_at else 'Date unknown'}]"
        for s in sorted_stages
    ) or "No stage changes recorded."

    if client.created_at:
        created = _aware(client.created_at)
        days_since = (datetime.now(timezone.utc) - created).days
        time_context = f"{days_since} days ago"
    else:
        time_context = "Date unknown"

    # STEP 2 — user prompt.
    user_prompt = f"""Generate a 3-sentence journey summary for this TDC client.

CLIENT: {client.first_name} {client.last_name}
Onboarded: {time_context}
Current stage: {client.stage}
City: {client.city}
Profession: {client.designation or 'Not specified'} at {client.current_company or 'Not specified'}

STAGE HISTORY:
{stages_text}

MATCHMAKER NOTES ({len(notes)} total):
{notes_text}

Generate EXACTLY this JSON structure:

{{
  "summary": "<string: exactly 3 sentences. Sentence 1: how long they have been with TDC and where they are in their journey. Sentence 2: key developments from notes/stage history — what has happened (introductions, dates, feedback). Sentence 3: current status and what the matchmaker should focus on next.>"
}}

If there are no notes: Sentence 2 should acknowledge this honestly.
Keep each sentence under 35 words. Be specific to the data provided."""

    generation_config = {
        "temperature": 0.3,
        "max_output_tokens": 1500,  # headroom for gemini-2.5-flash reasoning tokens
                                    # before the JSON summary is emitted.
        "response_mime_type": "application/json",
    }

    prompt_parts = [SYSTEM_PROMPT_SUMMARY, user_prompt]

    # STEP 3 — call and parse.
    try:
        raw_text, model_used = _call_gemini_with_fallback(
            prompt_parts, generation_config, "journey_summary"
        )
    except GeminiAllModelsFailedError as e:
        logger.error("All Gemini models failed for journey_summary: %s", e)
        return _static_fallback_summary(client, notes, stage_history)

    strict_suffix = (
        "\n\nCRITICAL: Respond ONLY with valid JSON. "
        "No text before or after. Start with { and end with }."
    )
    strict_prompt_parts = [SYSTEM_PROMPT_SUMMARY, user_prompt + strict_suffix]

    try:
        parsed_dict, final_model = _parse_json_response(
            raw_text, model_used, "journey_summary",
            strict_prompt_parts, generation_config,
        )
    except JSONParseFailedError:
        return _static_fallback_summary(client, notes, stage_history)

    try:
        return JourneySummaryResponse(
            summary=parsed_dict.get("summary", "Summary unavailable."),
            client_name=client.first_name,
            generated_at=datetime.now(timezone.utc).isoformat(),
            model_used=final_model,
            is_fallback=False,
            notes_count=len(notes),
            stage_count=len(stage_history),
        )
    except Exception as e:  # noqa: BLE001
        logger.error("Pydantic validation failed for JourneySummaryResponse: %s", e)
        return _static_fallback_summary(client, notes, stage_history)


# ===========================================================================
# STATIC FALLBACKS
# ===========================================================================

def _static_fallback_explanation(
    client: ProfileModel,
    match: ProfileModel,
    signals: ComputedSignals,
) -> ExplanationResponse:
    """Graceful static explanation built from real profile data."""
    client_name = client.first_name
    match_name = match.first_name
    client_city = client.city
    match_city = match.city
    same_city = (client_city or "").lower() == (match_city or "").lower()
    location_note = (
        f"both based in {client_city}" if same_city
        else f"{client_name} in {client_city} and {match_name} in {match_city}"
    )
    kids_note = (
        "share aligned views on starting a family"
        if signals.kids_preference_match
        else "have compatible life-stage priorities"
    )
    industry_a = signals.client_industry or "their field"
    industry_b = signals.match_industry or "their field"
    industry_note = (
        f"both work in {industry_a}"
        if signals.industry_compatibility_level == 2
        else f"{client_name} in {industry_a} and {match_name} in {industry_b} "
             f"bring complementary professional perspectives"
    )
    score_label = (
        "High Potential Match"
        if (signals.kids_preference_match and (signals.lifestyle_score or 0) >= 10)
        else "Good Match"
    )

    return ExplanationResponse(
        compatibility_score_label=score_label,
        headline=f"Thoughtful introduction: {client_name} and {match_name}",
        why_this_works=[
            f"{client_name} and {match_name} {kids_note}, which removes "
            f"one of the most common friction points in early relationships.",
            f"With {location_note}, geography presents no significant barrier "
            f"to building a connection.",
            f"Professionally, {industry_note} — a foundation for mutual respect "
            f"and interesting conversation.",
        ],
        talking_points=["Life goals", "Career journeys", "Weekend plans"],
        intro_email_draft=(
            f"Hi {client_name},\n\n"
            f"I'd like to introduce you to {match_name}, "
            f"a {match.designation or 'professional'} "
            f"based in {match_city or 'India'}.\n\n"
            f"I'm connecting the two of you because you {kids_note} and "
            f"your professional backgrounds suggest a natural mutual respect. "
            f"I think you'd find {match_name} thoughtful and grounded — "
            f"qualities I know are important to you.\n\n"
            f"I'd suggest starting with a casual coffee call to get to know "
            f"each other. I'll follow up with more details shortly. "
            f"Looking forward to hearing your thoughts after."
        ),
        generated_at=datetime.now(timezone.utc).isoformat(),
        model_used="static_fallback",
        is_fallback=True,
    )


def _static_fallback_summary(
    client: ProfileModel,
    notes: list,
    stage_history: list,
) -> JourneySummaryResponse:
    """Graceful static journey summary when Gemini is unavailable."""
    stage_count = len(stage_history)
    notes_count = len(notes)
    current_stage = client.stage or "Active"
    days_note = ""
    if client.created_at:
        created = client.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days = (datetime.now(timezone.utc) - created).days
        days_note = f" {days} days ago" if days > 0 else " recently"

    summary = (
        f"{client.first_name} joined TDC{days_note} and is currently "
        f"at the {current_stage} stage. "
        f"Their file has {notes_count} matchmaker note{'s' if notes_count != 1 else ''} "
        f"and {stage_count} stage transition{'s' if stage_count != 1 else ''} recorded. "
        f"Review their notes and recent stage history for full context "
        f"before your next touchpoint."
    )

    return JourneySummaryResponse(
        summary=summary,
        client_name=client.first_name,
        generated_at=datetime.now(timezone.utc).isoformat(),
        model_used="static_fallback",
        is_fallback=True,
        notes_count=notes_count,
        stage_count=stage_count,
    )
