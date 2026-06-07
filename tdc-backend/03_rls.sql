-- ============================================================================
-- File: 03_rls.sql
-- Purpose: Enable Row Level Security on every public table and define access
--          policies. profiles + notes get per-matchmaker isolation. The MVP
--          tables matchmakers / stage_history / match_records get RLS enabled
--          with a broad "any authenticated matchmaker" policy.
-- Run order: 4 of 5 SQL files
-- Dependencies: 01_schema.sql (tables must exist).
-- Safe to re-run: Yes (DROP POLICY IF EXISTS before every CREATE POLICY;
--                 ENABLE RLS is idempotent).
-- ============================================================================
--
-- WHY enable RLS on ALL public tables:
--   This Supabase project has "auto-enable RLS on new tables" OFF, and tables
--   created via raw SQL are NOT auto-protected. Every table in the `public`
--   schema is reachable through the Supabase REST API using the public `anon`
--   key (which ships in the frontend bundle). A table with RLS DISABLED is
--   therefore world-readable/writable by anyone with that key — this is the
--   "RLS Disabled in Public" security risk Supabase warns about.
--
--   The original spec said matchmakers / stage_history / match_records could
--   "rely on application-level auth" with RLS off. That reasoning does NOT hold
--   on Supabase: PostgREST bypasses the app layer entirely. So we enable RLS on
--   them too, with a single permissive policy that still allows ANY logged-in
--   matchmaker full access (matching the spec's intent) while blocking anon.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on every public table.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmakers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_records ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- PROFILES POLICIES
-- ===========================================================================

-- Policy 1: SELECT — own clients AND all dummies (shared matching pool).
DROP POLICY IF EXISTS matchmaker_select_own_clients_and_dummies ON profiles;
CREATE POLICY matchmaker_select_own_clients_and_dummies
    ON profiles
    FOR SELECT
    TO authenticated
    USING ((matchmaker_id = auth.uid()) OR (is_dummy = true));

-- Policy 2: INSERT — may only insert rows assigned to self (or dummies).
DROP POLICY IF EXISTS matchmaker_insert_own_clients ON profiles;
CREATE POLICY matchmaker_insert_own_clients
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK ((matchmaker_id = auth.uid()) OR (is_dummy = true));

-- Policy 3: UPDATE — may only update own clients (not dummies/others).
DROP POLICY IF EXISTS matchmaker_update_own_clients ON profiles;
CREATE POLICY matchmaker_update_own_clients
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (matchmaker_id = auth.uid())
    WITH CHECK (matchmaker_id = auth.uid());

-- Policy 4: DELETE — may only delete own clients.
DROP POLICY IF EXISTS matchmaker_delete_own_clients ON profiles;
CREATE POLICY matchmaker_delete_own_clients
    ON profiles
    FOR DELETE
    TO authenticated
    USING (matchmaker_id = auth.uid());

-- ===========================================================================
-- NOTES POLICIES
-- ===========================================================================

-- Policy 1: SELECT — only notes that belong to the matchmaker's own clients.
DROP POLICY IF EXISTS matchmaker_select_own_client_notes ON notes;
CREATE POLICY matchmaker_select_own_client_notes
    ON notes
    FOR SELECT
    TO authenticated
    USING (client_id IN (SELECT id FROM profiles WHERE matchmaker_id = auth.uid()));

-- Policy 2: INSERT — only add notes to the matchmaker's own clients.
DROP POLICY IF EXISTS matchmaker_insert_own_client_notes ON notes;
CREATE POLICY matchmaker_insert_own_client_notes
    ON notes
    FOR INSERT
    TO authenticated
    WITH CHECK (client_id IN (SELECT id FROM profiles WHERE matchmaker_id = auth.uid()));

-- ===========================================================================
-- MATCHMAKERS POLICY
-- Broad access: any authenticated matchmaker may read the team roster
-- (needed to resolve names for changed_by / sent_by / assignment dropdowns).
-- Blocks the public anon key. No write policy -> inserts/updates only via the
-- service role (used by 04_seed_matchmakers.sql), never by the client.
-- ===========================================================================
DROP POLICY IF EXISTS authenticated_select_matchmakers ON matchmakers;
CREATE POLICY authenticated_select_matchmakers
    ON matchmakers
    FOR SELECT
    TO authenticated
    USING (true);

-- ===========================================================================
-- STAGE_HISTORY POLICY
-- Any authenticated matchmaker may read/insert stage history. (Audit log is
-- shared across the team; rows are immutable by convention — no UPDATE/DELETE
-- policy is defined, so those are denied for authenticated users.)
-- ===========================================================================
DROP POLICY IF EXISTS authenticated_select_stage_history ON stage_history;
CREATE POLICY authenticated_select_stage_history
    ON stage_history
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS authenticated_insert_stage_history ON stage_history;
CREATE POLICY authenticated_insert_stage_history
    ON stage_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ===========================================================================
-- MATCH_RECORDS POLICY
-- Any authenticated matchmaker may read/insert/update match records (the
-- matching engine and intro-email flow operate across the shared pool).
-- ===========================================================================
DROP POLICY IF EXISTS authenticated_select_match_records ON match_records;
CREATE POLICY authenticated_select_match_records
    ON match_records
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS authenticated_insert_match_records ON match_records;
CREATE POLICY authenticated_insert_match_records
    ON match_records
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_update_match_records ON match_records;
CREATE POLICY authenticated_update_match_records
    ON match_records
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
