# File: test_ai_endpoints.md
# Purpose: Postman/curl test commands for the Phase 3 Gemini AI endpoints.
# Phase: 3 — Gemini AI Service

All commands assume the server runs at `http://localhost:8000`.

On Windows PowerShell, prefer `Invoke-WebRequest` or pipe a JSON file with
`curl.exe ... --data "@payload.json"`, since PowerShell mangles inline JSON.
The `curl` commands below use the bash/`curl.exe` `-d` form.

---

## TEST 1 — Health check (confirm Gemini configured)

```bash
curl http://localhost:8000/health
```

**Expected:** HTTP 200
```json
{
  "status": "ok",
  "models_loaded": true,
  "spacy_loaded": true,
  "embeddings_loaded": true,
  "gemini_configured": true,
  "version": "1.0.0"
}
```
**Logs:** `Gemini API configured successfully` at startup.

---

## TEST 2 — POST /ai/explain-match (high compatibility)

```bash
curl -X POST http://localhost:8000/ai/explain-match \
  -H "Content-Type: application/json" \
  -d '{
    "client_profile": {
      "first_name": "Arjun", "last_name": "Mehta", "gender": "Male",
      "city": "Mumbai", "age": 31, "height_cm": 178, "income_annual": 2500000,
      "designation": "Software Engineer", "current_company": "TCS",
      "want_kids": "Yes", "open_to_relocate": "Yes", "pg_degree": "MTech",
      "diet": "Vegetarian", "drink": "Socially", "smoke": "Never",
      "religion": "Hindu", "pref_caste_open": "Open",
      "hobbies": "hiking, photography, cooking", "stage": "Active - Searching"
    },
    "match_profile": {
      "first_name": "Priya", "last_name": "Sharma", "gender": "Female",
      "city": "Mumbai", "age": 28, "height_cm": 162, "income_annual": 1800000,
      "designation": "Product Manager", "current_company": "Razorpay",
      "want_kids": "Yes", "open_to_relocate": "Yes", "pg_degree": "MBA",
      "diet": "Vegetarian", "drink": "Socially", "smoke": "Never",
      "religion": "Hindu", "hobbies": "hiking, travelling, yoga",
      "stage": "Active - Searching"
    },
    "computed_signals": {
      "kids_preference_match": true,
      "relocation_compatible": true,
      "geography_situation": "Same City",
      "lifestyle_score": 13
    }
  }'
```

**Expected:** HTTP 200
- `compatibility_score_label`: `"High Potential Match"`
- `why_this_works`: exactly 3 items, each referencing specific data
- `talking_points`: exactly 3 short labels
- `intro_email_draft`: mentions both **Arjun** and **Priya**, addressed to Arjun
- `is_fallback`: `false`
- `model_used`: contains `"gemini"` (normally `gemini-2.5-flash`)

**Logs:** `[explain_match] Success with model: gemini-2.5-flash`

---

## TEST 3 — POST /ai/explain-match (partial compatibility)

```bash
curl -X POST http://localhost:8000/ai/explain-match \
  -H "Content-Type: application/json" \
  -d '{
    "client_profile": {
      "first_name": "Sneha", "last_name": "Iyer", "gender": "Female",
      "city": "Bangalore", "age": 29, "height_cm": 160, "income_annual": 1200000,
      "designation": "Marketing Manager", "current_company": "HUL",
      "want_kids": "Maybe", "open_to_relocate": "Maybe", "pg_degree": "MBA",
      "diet": "Vegetarian", "drink": "Never", "smoke": "Never",
      "religion": "Hindu", "pref_caste_open": "Open",
      "hobbies": "reading, baking, theatre", "stage": "Active - Searching"
    },
    "match_profile": {
      "first_name": "Rahul", "last_name": "Singh", "gender": "Male",
      "city": "Mumbai", "age": 33, "height_cm": 180, "income_annual": 2800000,
      "designation": "Consultant", "current_company": "Deloitte",
      "want_kids": "Yes", "open_to_relocate": "Yes", "pg_degree": "MBA",
      "diet": "Non-Vegetarian", "drink": "Socially", "smoke": "Never",
      "religion": "Hindu", "hobbies": "football, investing, travel",
      "stage": "Active - Searching"
    },
    "computed_signals": {
      "kids_preference_match": true,
      "relocation_compatible": true,
      "geography_situation": "Same Country",
      "lifestyle_score": 9
    }
  }'
```

**Expected:** HTTP 200
- `compatibility_score_label`: `"Good Match"` or `"Possible"`
- `intro_email_draft`: addressed to **Sneha**, introduces **Rahul**
- `is_fallback`: `false`

---

## TEST 4 — POST /ai/journey-summary (active client with notes)

```bash
curl -X POST http://localhost:8000/ai/journey-summary \
  -H "Content-Type: application/json" \
  -d '{
    "client_profile": {
      "first_name": "Priya", "last_name": "Sharma", "gender": "Female",
      "city": "Mumbai", "designation": "Product Manager",
      "current_company": "Razorpay", "stage": "Feedback Pending",
      "created_at": "2026-04-22T10:00:00Z"
    },
    "notes": [
      { "content": "First onboarding call. Priya is looking for someone ambitious and family-oriented.", "created_at": "2026-04-23T10:00:00Z", "matchmaker_name": "Shimpi" },
      { "content": "Sent intro to a profile in fintech. Priya was interested and agreed to a meeting.", "created_at": "2026-05-10T10:00:00Z", "matchmaker_name": "Shimpi" },
      { "content": "Post-date feedback: pleasant first meeting but limited spark. Open to more intros.", "created_at": "2026-06-01T10:00:00Z", "matchmaker_name": "Shimpi" }
    ],
    "stage_history": [
      { "old_stage": null, "new_stage": "New", "changed_at": "2026-04-22T10:00:00Z" },
      { "old_stage": "New", "new_stage": "Profile Verified", "changed_at": "2026-04-24T10:00:00Z" },
      { "old_stage": "Profile Verified", "new_stage": "Active - Searching", "changed_at": "2026-04-28T10:00:00Z" },
      { "old_stage": "Active - Searching", "new_stage": "Intro Sent", "changed_at": "2026-05-10T10:00:00Z" },
      { "old_stage": "Intro Sent", "new_stage": "Feedback Pending", "changed_at": "2026-06-01T10:00:00Z" }
    ]
  }'
```

**Expected:** HTTP 200
- `summary`: roughly 3 sentences, mentions **Priya** by name, references the
  intro/feedback developments
- `client_name`: `"Priya"`
- `notes_count`: `3`, `stage_count`: `5`
- `is_fallback`: `false`

**Logs:** `[journey_summary] Success with model: gemini-2.5-flash`

---

## TEST 5 — POST /ai/journey-summary (new client, no notes)

```bash
curl -X POST http://localhost:8000/ai/journey-summary \
  -H "Content-Type: application/json" \
  -d '{
    "client_profile": {
      "first_name": "Arjun", "last_name": "Mehta", "gender": "Male",
      "city": "Mumbai", "stage": "New",
      "created_at": "2026-06-05T10:00:00Z"
    },
    "notes": [],
    "stage_history": []
  }'
```

**Expected:** HTTP 200
- `summary`: acknowledges limited history gracefully (no invented details)
- `notes_count`: `0`, `stage_count`: `0`
- `is_fallback`: `false` (Gemini writes from profile data) — or a clean static
  fallback if Gemini is unavailable
- A `WARNING` log: `journey-summary: no notes or stage history for client Arjun`

---

## TEST 6 — Simulated rate limit / model fallback (manual)

1. In `services/gemini_service.py`, temporarily change the first entry of
   `GEMINI_MODEL_CHAIN` to an invalid name:
   ```python
   GEMINI_MODEL_CHAIN = ["gemini-invalid-model", "gemini-2.0-flash", "gemini-2.5-flash-lite"]
   ```
2. Restart the server and re-run TEST 2.

**Expected behavior:**
- First attempt fails; service falls through to `gemini-2.0-flash`.
- Response still succeeds (HTTP 200), `is_fallback`: `false`.
- `model_used`: `"gemini-2.0-flash"` (or `gemini-2.5-flash-lite` if 2.0 is
  also rate-limited on the free tier).
- Logs show a `WARNING` "Switching to next model..." line.

3. Revert the change afterward.

> NOTE: The original spec listed `gemini-1.5-flash` as the last resort, but
> that model now returns 404 (retired) for current Gemini API keys. The chain
> uses `gemini-2.5-flash-lite` instead — a live model with its own quota pool.
> If both `gemini-2.5-flash` and `gemini-2.0-flash` are quota-exhausted at the
> same time on the free tier, the service returns the static fallback
> (`is_fallback: true`) — this is correct, graceful behavior, not a bug.
