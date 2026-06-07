-- ============================================================================
-- File: 02_triggers.sql
-- Purpose: Trigger functions + triggers that
--            (1) keep profiles.age in sync with date_of_birth,
--            (2) bump profiles.last_contacted_at when a note is inserted,
--            (3) auto-set profiles.updated_at on every UPDATE.
-- Run order: 3 of 5 SQL files
-- Dependencies: 01_schema.sql (needs profiles + notes tables).
-- Safe to re-run: Yes (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TRIGGER 0: set_profile_age
-- BEFORE INSERT OR UPDATE OF date_of_birth on profiles -> compute age from DOB.
-- This replaces a GENERATED column (AGE() is not IMMUTABLE, so Postgres rejects
-- it inside a generated-column expression). Callers never set age manually.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_profile_age()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.age = DATE_PART('year', AGE(NEW.date_of_birth))::INTEGER;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_age ON profiles;

CREATE TRIGGER trg_profiles_set_age
    BEFORE INSERT OR UPDATE OF date_of_birth ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_profile_age();

-- ---------------------------------------------------------------------------
-- TRIGGER 1: update_last_contacted_on_note_insert
-- AFTER INSERT on notes -> set the parent profile's last_contacted_at to the
-- new note's created_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_last_contacted_on_note()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE profiles
       SET last_contacted_at = NEW.created_at
     WHERE id = NEW.client_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notes_update_last_contacted ON notes;

CREATE TRIGGER trg_notes_update_last_contacted
    AFTER INSERT ON notes
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_last_contacted_on_note();

-- ---------------------------------------------------------------------------
-- TRIGGER 2: update_profiles_updated_at
-- BEFORE UPDATE on profiles -> stamp updated_at = NOW().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_profiles_updated_at();
