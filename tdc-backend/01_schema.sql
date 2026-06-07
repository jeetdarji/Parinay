-- ============================================================================
-- File: 01_schema.sql
-- Purpose: Define all 5 tables (matchmakers, profiles, notes, stage_history,
--          match_records) with columns, constraints, computed columns, indexes.
-- Run order: 2 of 5 SQL files
-- Dependencies: 00_extensions.sql (needs uuid-ossp for uuid_generate_v4()).
-- Safe to re-run: Yes (DROP TABLE IF EXISTS ... CASCADE in reverse dependency
--                 order at the top). WARNING: re-running DROPS ALL DATA.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Drop in REVERSE dependency order so FKs never block a drop.
-- match_records / stage_history / notes all FK into profiles.
-- profiles FKs into matchmakers. matchmakers is dropped last.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS match_records CASCADE;
DROP TABLE IF EXISTS stage_history CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS matchmakers CASCADE;

-- ===========================================================================
-- TABLE 1: matchmakers
-- TDC internal matchmaking team. id MUST equal auth.users.id so that
-- auth.uid() = matchmakers.id works inside RLS policies. No RLS in MVP.
-- ===========================================================================
CREATE TABLE matchmakers (
    id          UUID PRIMARY KEY,                 -- set explicitly = auth.users.id
    email       TEXT UNIQUE NOT NULL,
    full_name   TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================================================
-- TABLE 2: profiles
-- Central client record + shared dummy matching pool (is_dummy = true).
-- ===========================================================================
CREATE TABLE profiles (
    -- Personal ---------------------------------------------------------------
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matchmaker_id   UUID REFERENCES matchmakers(id) ON DELETE SET NULL,  -- NULL for dummies
    is_dummy        BOOLEAN NOT NULL DEFAULT false,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    gender          TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth   DATE NOT NULL,
    -- NOTE: age is NOT a GENERATED column. PostgreSQL requires generated-column
    -- expressions to be IMMUTABLE, but AGE(date_of_birth) depends on the current
    -- date (STABLE), so a STORED generated column is rejected with
    -- "generation expression is not immutable". Instead age is a plain column
    -- auto-maintained by fn_set_profile_age() (see 02_triggers.sql), which fires
    -- BEFORE INSERT/UPDATE so callers (incl. seed.js) never set it manually.
    age             INTEGER,

    -- Contact ----------------------------------------------------------------
    email           TEXT,
    phone           TEXT,
    city            TEXT NOT NULL,
    country         TEXT NOT NULL DEFAULT 'India',

    -- Physical ---------------------------------------------------------------
    height_cm       INTEGER CHECK (height_cm BETWEEN 130 AND 220),
    complexion      TEXT CHECK (complexion IN
                        ('Fair', 'Wheatish', 'Dark', 'Prefer not to say')),

    -- Education --------------------------------------------------------------
    ug_college      TEXT,
    ug_degree       TEXT,
    pg_college      TEXT,
    pg_degree       TEXT,

    -- Career -----------------------------------------------------------------
    current_company TEXT,
    designation     TEXT,
    income_annual   BIGINT CHECK (income_annual >= 0),   -- stored in INR

    -- Family -----------------------------------------------------------------
    marital_status  TEXT NOT NULL DEFAULT 'Never Married'
                        CHECK (marital_status IN
                        ('Never Married', 'Divorced', 'Widowed', 'Separated')),
    father_occupation TEXT,
    mother_occupation TEXT,
    siblings_brothers INTEGER DEFAULT 0,
    siblings_sisters  INTEGER DEFAULT 0,
    family_type     TEXT CHECK (family_type IN ('Nuclear', 'Joint', 'Extended')),

    -- Religion ---------------------------------------------------------------
    religion        TEXT,
    caste           TEXT,
    sub_caste       TEXT,

    -- Lifestyle --------------------------------------------------------------
    want_kids       TEXT CHECK (want_kids IN ('Yes', 'No', 'Maybe')),
    open_to_relocate TEXT CHECK (open_to_relocate IN ('Yes', 'No', 'Maybe')),
    open_to_pets    TEXT CHECK (open_to_pets IN ('Yes', 'No', 'Maybe')),
    diet            TEXT CHECK (diet IN
                        ('Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Vegan')),
    drink           TEXT CHECK (drink IN ('Never', 'Socially', 'Regularly')),
    smoke           TEXT CHECK (smoke IN ('Never', 'Occasionally', 'Regularly')),
    languages       TEXT[] DEFAULT '{}',
    hobbies         TEXT,                              -- free text, NLP input

    -- Partner Preferences ----------------------------------------------------
    pref_age_min    INTEGER,
    pref_age_max    INTEGER,
    pref_height_min INTEGER,
    pref_income_min BIGINT,
    pref_caste_open TEXT CHECK (pref_caste_open IN
                        ('Open', 'Same Preferred', 'Same Only')),
    pref_city       TEXT,

    -- Matchmaking metadata ---------------------------------------------------
    stage           TEXT NOT NULL DEFAULT 'New'
                        CHECK (stage IN ('New', 'Profile Verified', 'Active - Searching',
                            'Intro Sent', 'Date Completed', 'Feedback Pending',
                            'Re-matching', 'Matched', 'On Hold', 'Closed')),
    last_contacted_at TIMESTAMPTZ DEFAULT NOW(),
    photo_url       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_matchmaker_id ON profiles(matchmaker_id);
CREATE INDEX idx_profiles_gender        ON profiles(gender);
CREATE INDEX idx_profiles_is_dummy      ON profiles(is_dummy);
CREATE INDEX idx_profiles_stage         ON profiles(stage);

-- ===========================================================================
-- TABLE 3: notes
-- Timestamped matchmaker notes. AFTER INSERT trigger bumps
-- profiles.last_contacted_at (see 02_triggers.sql).
-- ===========================================================================
CREATE TABLE notes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    matchmaker_id UUID REFERENCES matchmakers(id) ON DELETE SET NULL,
    content       TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_client_id ON notes(client_id);

-- ===========================================================================
-- TABLE 4: stage_history
-- Immutable audit log of every stage change.
-- ===========================================================================
CREATE TABLE stage_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_stage   TEXT,                               -- NULL on first assignment
    new_stage   TEXT NOT NULL,
    changed_by  UUID REFERENCES matchmakers(id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stage_history_client_id ON stage_history(client_id);

-- ===========================================================================
-- TABLE 5: match_records
-- Every match introduction sent, with full AI explanation JSON + intro email.
-- ===========================================================================
CREATE TABLE match_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    matched_with_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    match_score     INTEGER CHECK (match_score BETWEEN 0 AND 100),
    score_label     TEXT CHECK (score_label IN
                        ('High Potential Match', 'Good Match', 'Possible')),
    ai_headline     TEXT,
    ai_explanation  JSONB,                          -- full Gemini explanation object
    intro_email_sent TEXT,
    sent_at         TIMESTAMPTZ,
    sent_by         UUID REFERENCES matchmakers(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_match_records_client_id ON match_records(client_id);
