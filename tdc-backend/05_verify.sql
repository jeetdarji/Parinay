-- ============================================================================
-- File: 05_verify.sql
-- Purpose: Post-seed verification queries (counts, computed column, trigger,
--          RLS isolation notes, FK integrity, hobbies, spot-check).
-- Run order: run LAST, after seed.js has completed.
-- Dependencies: 00..04 SQL files + seed.js.
-- Safe to re-run: Yes (read-only, except the commented-out trigger test which
--                 you run manually).
-- ============================================================================
-- Run each block in the Supabase SQL Editor and compare against "Expected".
-- ============================================================================


-- ---------------------------------------------------------------------------
-- CHECK 1: Profiles by gender and is_dummy.
-- Expected: Male/true = 120, Female/true = 120, and 0 non-dummy profiles.
-- ---------------------------------------------------------------------------
SELECT gender, is_dummy, COUNT(*) AS total
FROM profiles
GROUP BY gender, is_dummy
ORDER BY gender, is_dummy;


-- ---------------------------------------------------------------------------
-- CHECK 2: Profiles by stage.
-- Expected: all 240 dummies are 'Active - Searching'.
-- ---------------------------------------------------------------------------
SELECT stage, COUNT(*) AS total
FROM profiles
GROUP BY stage
ORDER BY total DESC;


-- ---------------------------------------------------------------------------
-- CHECK 3: age column (maintained by trg_profiles_set_age, not GENERATED).
-- Expected: age matches whole years computed from date_of_birth.
-- ---------------------------------------------------------------------------
SELECT first_name, date_of_birth, age
FROM profiles
LIMIT 5;


-- ---------------------------------------------------------------------------
-- CHECK 4: Trigger test (MANUAL — run these statements one at a time).
-- Verifies trg_notes_update_last_contacted bumps profiles.last_contacted_at.
-- Expected: after inserting a note, last_contacted_at ~= NOW().
-- ---------------------------------------------------------------------------
--   -- 4a. Pick a profile id and remember its current last_contacted_at:
--   SELECT id, last_contacted_at FROM profiles LIMIT 1;
--
--   -- 4b. Insert a note for that client (paste the id from 4a):
--   INSERT INTO notes (client_id, content)
--   VALUES ('<paste-profile-id-here>', 'Trigger verification note');
--
--   -- 4c. Confirm last_contacted_at advanced to ~NOW():
--   SELECT id, last_contacted_at FROM profiles
--   WHERE id = '<paste-profile-id-here>';
--
--   -- 4d. Clean up the test note (optional):
--   DELETE FROM notes WHERE content = 'Trigger verification note';


-- ---------------------------------------------------------------------------
-- CHECK 5: RLS isolation test (run from app layer or RLS tester, NOT here).
-- In the SQL Editor you use the service role, which BYPASSES RLS — so these
-- will return everything. To truly test, run as an authenticated user
-- (Supabase Dashboard "RLS" tester, or via the app with a logged-in JWT).
--
-- Expected when run as matchmaker A (auth.uid() = A):
--   -> rows where matchmaker_id = A  PLUS  all is_dummy = true rows.
-- Expected when run as matchmaker B (auth.uid() = B):
--   -> matchmaker A's REAL (non-dummy) clients must NOT appear.
-- ---------------------------------------------------------------------------
--   -- Simulated check (advanced; requires setting the JWT claim in a tx):
--   -- BEGIN;
--   --   SET LOCAL ROLE authenticated;
--   --   SET LOCAL request.jwt.claims =
--   --       '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
--   --   SELECT id, first_name, matchmaker_id, is_dummy FROM profiles;
--   -- ROLLBACK;
--   --
--   -- Then repeat with sub = '22222222-2222-2222-2222-222222222222' and confirm
--   -- matchmaker A's non-dummy clients are absent.


-- ---------------------------------------------------------------------------
-- CHECK 6: Foreign key / baseline counts.
-- Expected: notes=0, stage_history=0, match_records=0, matchmakers=3.
-- ---------------------------------------------------------------------------
SELECT 'notes'         AS table_name, COUNT(*) AS total FROM notes
UNION ALL
SELECT 'stage_history' AS table_name, COUNT(*) FROM stage_history
UNION ALL
SELECT 'match_records' AS table_name, COUNT(*) FROM match_records
UNION ALL
SELECT 'matchmakers'   AS table_name, COUNT(*) FROM matchmakers;


-- ---------------------------------------------------------------------------
-- CHECK 7: Hobbies populated and non-empty (critical for NLP).
-- Expected: 0 rows with NULL or empty hobbies.
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS profiles_missing_hobbies
FROM profiles
WHERE hobbies IS NULL OR hobbies = '';


-- ---------------------------------------------------------------------------
-- CHECK 8: Spot-check 5 random dummy profiles (manual eyeball review).
-- Expected: realistic, varied, internally-consistent data.
-- ---------------------------------------------------------------------------
SELECT first_name, last_name, gender, age, city, country, designation,
       current_company, income_annual, hobbies, want_kids, open_to_relocate,
       diet, drink, smoke, religion, stage
FROM profiles
WHERE is_dummy = true
ORDER BY RANDOM()
LIMIT 5;
