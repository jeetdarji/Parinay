# File: services/matching_engine.py
# Purpose: Core matching engine — hard filters + 8 scoring axes for both genders.
# Phase: 2 — Backend Base + Matching Engine

import logging
from typing import Dict, List, Optional, Tuple

from models.match_response import MatchResult, ScoreBreakdown
from models.profile import ProfileModel

logger = logging.getLogger(__name__)

# -- Module constants --------------------------------------------------------
# Max achievable RAW score per path, used to normalize to 0–100.
#   Male:   kids25 + reloc15 + life15 + edu15 + geo15 + relig10 + age5 + nlp10 = 110
#   Female: kids25 + reloc19 + life15 + edu15 + geo10 + relig10 + age5 + nlp10 = 109
#     (female relocation ceiling is min(20, int(15*1.33)) = 19, not 20)
MAX_RAW_SCORE_MALE = 110
MAX_RAW_SCORE_FEMALE = 109
TOP_N_MATCHES = 10           # return at most the top 10 matches
MIN_SCORE_THRESHOLD = 40     # exclude normalized scores below this

SCORE_LABELS = {
    (80, 100): "High Potential Match",
    (60, 79): "Good Match",
    (40, 59): "Possible",
}

# City aliases for normalization (all keys/values lowercase).
_CITY_ALIASES = {
    "new delhi": "delhi",
    "gurugram": "gurgaon",
    "bombay": "mumbai",
    "bengaluru": "bangalore",
}


# ===========================================================================
# HELPER FUNCTIONS
# ===========================================================================

def _normalize_city(city: Optional[str]) -> str:
    """Lowercase, strip, and collapse common aliases for a city name.

    Input: a city string (may be None).
    Output: a normalized lowercase city key ("" if None/empty).
    """
    if not city:
        return ""
    key = city.strip().lower()
    return _CITY_ALIASES.get(key, key)


def _kids_compatibility(a: Optional[str], b: Optional[str]) -> Tuple[bool, int]:
    """Kids-preference compatibility.

    Input: two want_kids values ("Yes"/"No"/"Maybe"/None).
    Output: (is_compatible, score). Yes+No is a hard filter (False, 0).
    None on either side: (True, 0) — neutral, never filtered.
    """
    if a is None or b is None:
        return (True, 0)

    pair = (a, b)
    full = {("Yes", "Yes"), ("No", "No")}
    hard_out = {("Yes", "No"), ("No", "Yes")}

    if pair in full:
        return (True, 25)
    if pair in hard_out:
        return (False, 0)
    # Every remaining combination involves at least one "Maybe" -> partial.
    return (True, 10)


def _relocation_compatibility(
    client_city: Optional[str],
    client_relocate: Optional[str],
    candidate_city: Optional[str],
    candidate_relocate: Optional[str],
) -> int:
    """Relocation/geography willingness score (max 15).

    Same city -> 15 regardless of preference. Otherwise scored by the pair of
    relocation willingness values. None on either side -> 5 (neutral).
    """
    if _normalize_city(client_city) == _normalize_city(candidate_city) \
            and _normalize_city(client_city) != "":
        return 15

    if client_relocate is None or candidate_relocate is None:
        return 5

    pair = {client_relocate, candidate_relocate}

    if client_relocate == "Yes" and candidate_relocate == "Yes":
        return 15
    if "Yes" in pair and "Maybe" in pair:
        return 10
    if client_relocate == "No" and candidate_relocate == "Yes":
        return 8
    if client_relocate == "Maybe" and candidate_relocate == "Maybe":
        return 7
    if "Yes" in pair and "No" in pair:
        return 5
    if client_relocate == "No" and candidate_relocate == "No":
        return 0
    return 5


def _diet_score(a: Optional[str], b: Optional[str]) -> int:
    """Diet sub-score (max 5)."""
    if a is None or b is None:
        return 2
    if a == b:
        return 5
    veg_egg = {"Vegetarian", "Eggetarian"}
    if {a, b} == veg_egg:
        return 3
    # Any combination involving Vegan with a non-Vegan, or non-veg mixes -> 1.
    return 1


def _drink_score(a: Optional[str], b: Optional[str]) -> int:
    """Drink sub-score (max 5)."""
    if a is None or b is None:
        return 2
    if a == b:
        return 5
    pair = {a, b}
    if pair == {"Socially", "Never"}:
        return 3
    if pair == {"Never", "Regularly"}:
        return 0
    if pair == {"Socially", "Regularly"}:
        return 2
    return 2


def _smoke_score(a: Optional[str], b: Optional[str]) -> int:
    """Smoke sub-score (max 5)."""
    if a is None or b is None:
        return 2
    if a == "Never" and b == "Never":
        return 5
    if a == "Occasionally" and b == "Occasionally":
        return 3
    pair = {a, b}
    if pair == {"Never", "Occasionally"}:
        return 2
    if pair == {"Never", "Regularly"}:
        return 0
    if pair == {"Regularly", "Occasionally"}:
        return 1
    if a == "Regularly" and b == "Regularly":
        return 1
    return 2


def _lifestyle_score(client: ProfileModel, candidate: ProfileModel) -> int:
    """Combined lifestyle score = diet + drink + smoke (max 15)."""
    return (
        _diet_score(client.diet, candidate.diet)
        + _drink_score(client.drink, candidate.drink)
        + _smoke_score(client.smoke, candidate.smoke)
    )


def _education_score(client: ProfileModel, candidate: ProfileModel) -> int:
    """Education compatibility score (max 15), using has_postgrad property."""
    c_pg = client.has_postgrad
    d_pg = candidate.has_postgrad

    # "No degree data for either" / mixed-missing -> neutral 5.
    client_has_any = bool(client.ug_degree) or bool(client.pg_degree)
    cand_has_any = bool(candidate.ug_degree) or bool(candidate.pg_degree)
    if not client_has_any and not cand_has_any:
        return 5
    if client_has_any != cand_has_any:
        return 5

    if c_pg and d_pg:
        return 15
    if not c_pg and not d_pg:
        return 10
    return 7  # one postgrad, one undergrad-only


def _geography_score(client: ProfileModel, candidate: ProfileModel) -> int:
    """Geography score (max 15). None relocation values treated as 'Maybe'."""
    c_rel = client.open_to_relocate or "Maybe"
    d_rel = candidate.open_to_relocate or "Maybe"

    same_city = (
        _normalize_city(client.city) == _normalize_city(candidate.city)
        and _normalize_city(client.city) != ""
    )
    same_country = (
        (client.country or "").strip().lower()
        == (candidate.country or "").strip().lower()
    )

    if same_city and same_country:
        return 15

    if same_country:
        pair = {c_rel, d_rel}
        if c_rel == "Yes" and d_rel == "Yes":
            return 12
        if "Yes" in pair and "Maybe" in pair:
            return 9
        if "Yes" in pair and "No" in pair:
            return 6
        if c_rel == "Maybe" and d_rel == "Maybe":
            return 6
        if c_rel == "No" and d_rel == "No":
            return 2
        return 6

    # Different country.
    pair = {c_rel, d_rel}
    if c_rel == "Yes" and d_rel == "Yes":
        return 5
    if "Yes" in pair and "Maybe" in pair:
        return 3
    return 0


def _religion_caste_score(
    client: ProfileModel, candidate: ProfileModel
) -> Tuple[bool, int]:
    """Religion/caste score and hard-filter flag (max score 10).

    Behavior depends on client.pref_caste_open:
      None/"Open"      -> (True, 0)  no scoring
      "Same Preferred" -> always passes; score by religion/caste match
      "Same Only"      -> hard-filters out anything not same religion+caste
    """
    pref = client.pref_caste_open

    if pref is None or pref == "Open":
        return (True, 0)

    c_rel = (client.religion or "Unknown").strip().lower()
    d_rel = (candidate.religion or "Unknown").strip().lower()
    c_caste = (client.caste or "").strip().lower()
    d_caste = (candidate.caste or "").strip().lower()

    same_religion = c_rel == d_rel and c_rel != "unknown"
    same_caste = same_religion and c_caste == d_caste and c_caste != ""

    if pref == "Same Preferred":
        if same_religion and same_caste:
            return (True, 10)
        if same_religion:
            return (True, 5)
        return (True, 0)

    if pref == "Same Only":
        if same_religion and same_caste:
            return (True, 10)
        return (False, 0)

    # Unknown preference value -> behave like Open (safe default).
    return (True, 0)


def _age_delta_score(
    client: ProfileModel, candidate: ProfileModel, is_male_client: bool
) -> int:
    """Age-preference closeness score (max 5). Neutral 2 if candidate age None."""
    if candidate.age is None:
        return 2

    client_age = client.age if client.age is not None else 30

    if is_male_client:
        preferred_min = client.pref_age_min if client.pref_age_min is not None else client_age - 5
        preferred_max = client.pref_age_max if client.pref_age_max is not None else client_age - 1
    else:
        preferred_min = client.pref_age_min if client.pref_age_min is not None else client_age
        preferred_max = client.pref_age_max if client.pref_age_max is not None else client_age + 7

    candidate_age = candidate.age
    if preferred_min <= candidate_age <= preferred_max:
        return 5

    delta = min(
        abs(candidate_age - preferred_min),
        abs(candidate_age - preferred_max),
    )
    if delta <= 1:
        return 3
    if delta <= 2:
        return 1
    return 0


def _normalize_score(raw_score: int, max_possible: int) -> int:
    """Normalize a raw score to 0–100 and clamp."""
    if max_possible <= 0:
        return 0
    result = int(round((raw_score / max_possible) * 100))
    return max(0, min(100, result))


def _get_score_label(score: int) -> str:
    """Map a normalized score to its label."""
    if score >= 80:
        return "High Potential Match"
    if score >= 60:
        return "Good Match"
    if score >= 40:
        return "Possible"
    return "Below Threshold"


def _interest_similarity_bonus(similarity: float) -> int:
    """Convert raw cosine similarity (0–1) into bonus points (max 10)."""
    if similarity >= 0.75:
        return 10
    if similarity >= 0.60:
        return 8
    if similarity >= 0.45:
        return 6
    if similarity >= 0.30:
        return 4
    if similarity >= 0.15:
        return 2
    return 0


def _candidate_key(candidate: ProfileModel, index: int) -> str:
    """Stable lookup key for the similarities dict (handles None ids)."""
    return candidate.id if candidate.id is not None else f"idx_{index}"


# ===========================================================================
# MAIN SCORING FUNCTIONS
# ===========================================================================

def score_matches_for_male(
    client: ProfileModel,
    candidates: List[ProfileModel],
    interest_similarities: Dict[str, float],
) -> Tuple[List[MatchResult], int]:
    """Score a MALE client against FEMALE candidates.

    Returns (top_results, hard_filtered_count).
    """
    # -- HARD FILTERS -- keep (original_index, candidate) for passers.
    passed: List[Tuple[int, ProfileModel]] = []

    for i, cand in enumerate(candidates):
        if cand.gender != "Female":
            continue
        if (
            cand.age is not None and client.age is not None
            and cand.age >= client.age + 1
            and cand.age != client.age
        ):
            # woman must be younger or same age; >= client+1 means older
            continue
        if (
            cand.height_cm is not None and client.height_cm is not None
            and cand.height_cm > client.height_cm + 3
        ):
            continue
        if (
            cand.income_annual is not None and client.income_annual is not None
            and cand.income_annual > client.income_annual * 1.15
        ):
            continue
        if not _kids_compatibility(client.want_kids, cand.want_kids)[0]:
            continue
        if not _religion_caste_score(client, cand)[0]:
            continue
        passed.append((i, cand))

    hard_filtered_count = len(candidates) - len(passed)

    # -- SOFT SCORING --
    results: List[MatchResult] = []
    for i, cand in passed:
        key = _candidate_key(cand, i)
        similarity = interest_similarities.get(key, 0.0)

        kids_score = _kids_compatibility(client.want_kids, cand.want_kids)[1]
        relocation_score = _relocation_compatibility(
            client.city, client.open_to_relocate,
            cand.city, cand.open_to_relocate,
        )
        lifestyle = _lifestyle_score(client, cand)
        education = _education_score(client, cand)
        geography = _geography_score(client, cand)
        religion_caste = _religion_caste_score(client, cand)[1]
        age_delta = _age_delta_score(client, cand, is_male_client=True)
        nlp_bonus = _interest_similarity_bonus(similarity)

        raw_score = (
            kids_score + relocation_score + lifestyle + education
            + geography + religion_caste + age_delta + nlp_bonus
        )
        normalized = _normalize_score(raw_score, MAX_RAW_SCORE_MALE)

        if normalized < MIN_SCORE_THRESHOLD:
            continue

        results.append(
            MatchResult(
                profile_id=cand.id or "",
                first_name=cand.first_name,
                last_name=cand.last_name,
                age=cand.age,
                city=cand.city,
                country=cand.country,
                designation=cand.designation,
                current_company=cand.current_company,
                income_annual=cand.income_annual,
                height_cm=cand.height_cm,
                gender=cand.gender,
                score=normalized,
                score_label=_get_score_label(normalized),
                score_breakdown=ScoreBreakdown(
                    kids=kids_score,
                    relocation=relocation_score,
                    lifestyle=lifestyle,
                    education=education,
                    geography=geography,
                    religion_caste=religion_caste,
                    age_delta=age_delta,
                    interest_similarity=float(similarity),
                ),
                interest_similarity_raw=float(similarity),
            )
        )

    results.sort(key=lambda r: r.score, reverse=True)
    return (results[:TOP_N_MATCHES], hard_filtered_count)


def score_matches_for_female(
    client: ProfileModel,
    candidates: List[ProfileModel],
    interest_similarities: Dict[str, float],
) -> Tuple[List[MatchResult], int]:
    """Score a FEMALE client against MALE candidates.

    Uses higher relocation weighting and lower geography ceiling than the
    male path. Returns (top_results, hard_filtered_count).
    """
    # -- HARD FILTERS -- keep (original_index, candidate) for passers.
    passed: List[Tuple[int, ProfileModel]] = []

    for i, cand in enumerate(candidates):
        if cand.gender != "Male":
            continue
        if (
            cand.age is not None and client.age is not None
            and cand.age < client.age
        ):
            continue
        if (
            cand.age is not None and client.age is not None
            and cand.age > client.age + 8
        ):
            continue
        if (
            cand.height_cm is not None and client.height_cm is not None
            and cand.height_cm < client.height_cm - 2
        ):
            continue
        if (
            cand.income_annual is not None and client.income_annual is not None
            and cand.income_annual < client.income_annual * 0.80
        ):
            continue
        if not _kids_compatibility(client.want_kids, cand.want_kids)[0]:
            continue
        if not _religion_caste_score(client, cand)[0]:
            continue
        passed.append((i, cand))

    hard_filtered_count = len(candidates) - len(passed)

    # -- SOFT SCORING --
    results: List[MatchResult] = []
    for i, cand in passed:
        key = _candidate_key(cand, i)
        similarity = interest_similarities.get(key, 0.0)

        kids_score = _kids_compatibility(client.want_kids, cand.want_kids)[1]

        raw_relocation = _relocation_compatibility(
            client.city, client.open_to_relocate,
            cand.city, cand.open_to_relocate,
        )
        # Female clients weight relocation higher (ceiling 20 instead of 15).
        relocation_score_female = min(20, int(raw_relocation * 1.33))

        lifestyle = _lifestyle_score(client, cand)
        education = _education_score(client, cand)
        # Geography ceiling lowered to 10 for female scoring.
        geography = min(10, _geography_score(client, cand))
        religion_caste = _religion_caste_score(client, cand)[1]
        age_delta = _age_delta_score(client, cand, is_male_client=False)
        nlp_bonus = _interest_similarity_bonus(similarity)

        raw_score = (
            kids_score + relocation_score_female + lifestyle + education
            + geography + religion_caste + age_delta + nlp_bonus
        )
        normalized = _normalize_score(raw_score, MAX_RAW_SCORE_FEMALE)

        if normalized < MIN_SCORE_THRESHOLD:
            continue

        results.append(
            MatchResult(
                profile_id=cand.id or "",
                first_name=cand.first_name,
                last_name=cand.last_name,
                age=cand.age,
                city=cand.city,
                country=cand.country,
                designation=cand.designation,
                current_company=cand.current_company,
                income_annual=cand.income_annual,
                height_cm=cand.height_cm,
                gender=cand.gender,
                score=normalized,
                score_label=_get_score_label(normalized),
                score_breakdown=ScoreBreakdown(
                    kids=kids_score,
                    relocation=relocation_score_female,
                    lifestyle=lifestyle,
                    education=education,
                    geography=geography,
                    religion_caste=religion_caste,
                    age_delta=age_delta,
                    interest_similarity=float(similarity),
                ),
                interest_similarity_raw=float(similarity),
            )
        )

    results.sort(key=lambda r: r.score, reverse=True)
    return (results[:TOP_N_MATCHES], hard_filtered_count)
