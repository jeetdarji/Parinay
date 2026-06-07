-- ============================================================================
-- File: 04_seed_matchmakers.sql
-- Purpose: Create 3 demo matchmaker accounts in Supabase Auth (auth.users +
--          auth.identities) and mirror them into public.matchmakers using the
--          SAME fixed UUIDs so auth.uid() = matchmakers.id holds in RLS.
-- Run order: 5 of 5 SQL files
-- Dependencies: 00_extensions.sql (pgcrypto for crypt()/gen_salt),
--               01_schema.sql (matchmakers table).
-- Safe to re-run: Yes (ON CONFLICT DO NOTHING / DO UPDATE on every insert).
-- ============================================================================
--
-- IMPORTANT — READ BEFORE RUNNING:
--   * These inserts write into Supabase's INTERNAL auth schema (auth.users,
--     auth.identities). This is supported in the SQL Editor but is NOT the
--     recommended path for real production users.
--   * Auth password hashing uses bcrypt at cost factor 10. We hash inline with
--     pgcrypto: crypt('<password>', gen_salt('bf', 10)). Supabase Auth verifies
--     against encrypted_password using the same scheme, so email/password login
--     works immediately.
--   * For REAL production matchmakers, use the Supabase Dashboard instead:
--       Authentication > Users > Invite user
--     Then insert a matching row into public.matchmakers with that user's id.
--   * The 3 accounts below are for DEMO / EVALUATION ONLY.
--
-- FIXED MATCHMAKER UUIDs (reused in seed.js documentation / Phase 4 logins):
--   Kawaljeet Kaur   -> 11111111-1111-1111-1111-111111111111
--   Shimpi Sharma    -> 22222222-2222-2222-2222-222222222222
--   Demo Matchmaker  -> 33333333-3333-3333-3333-333333333333
--
-- LOGIN CREDENTIALS:
--   kawaljeet@thedatecrew.com  / TDC@intern2026
--   shimpi@thedatecrew.com     / TDC@intern2026
--   matchmaker@tdc.demo        / TDC@demo2026     <-- evaluator login
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: auth.users
-- We must supply instance_id, aud, role, confirmed email, and a bcrypt hash.
-- email_confirmed_at is set to NOW() so the accounts can log in without an
-- email verification step.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
    ('00000000-0000-0000-0000-000000000000',
     '11111111-1111-1111-1111-111111111111',
     'authenticated', 'authenticated',
     'kawaljeet@thedatecrew.com',
     crypt('TDC@intern2026', gen_salt('bf', 10)),
     NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Kawaljeet Kaur"}'::jsonb,
     '', '', '', ''),

    ('00000000-0000-0000-0000-000000000000',
     '22222222-2222-2222-2222-222222222222',
     'authenticated', 'authenticated',
     'shimpi@thedatecrew.com',
     crypt('TDC@intern2026', gen_salt('bf', 10)),
     NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Shimpi Sharma"}'::jsonb,
     '', '', '', ''),

    ('00000000-0000-0000-0000-000000000000',
     '33333333-3333-3333-3333-333333333333',
     'authenticated', 'authenticated',
     'matchmaker@tdc.demo',
     crypt('TDC@demo2026', gen_salt('bf', 10)),
     NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Demo Matchmaker"}'::jsonb,
     '', '', '', '')
ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        updated_at         = NOW();

-- ---------------------------------------------------------------------------
-- STEP 2: auth.identities
-- One email/password identity per user. provider_id is the user id (text).
-- The provider_id column exists on modern Supabase; if your project predates
-- it, remove provider_id from the column list and VALUES.
-- ---------------------------------------------------------------------------
INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
)
VALUES
    (uuid_generate_v4(),
     '11111111-1111-1111-1111-111111111111',
     '11111111-1111-1111-1111-111111111111',
     '{"sub":"11111111-1111-1111-1111-111111111111","email":"kawaljeet@thedatecrew.com","email_verified":true,"phone_verified":false}'::jsonb,
     'email', NOW(), NOW(), NOW()),

    (uuid_generate_v4(),
     '22222222-2222-2222-2222-222222222222',
     '22222222-2222-2222-2222-222222222222',
     '{"sub":"22222222-2222-2222-2222-222222222222","email":"shimpi@thedatecrew.com","email_verified":true,"phone_verified":false}'::jsonb,
     'email', NOW(), NOW(), NOW()),

    (uuid_generate_v4(),
     '33333333-3333-3333-3333-333333333333',
     '33333333-3333-3333-3333-333333333333',
     '{"sub":"33333333-3333-3333-3333-333333333333","email":"matchmaker@tdc.demo","email_verified":true,"phone_verified":false}'::jsonb,
     'email', NOW(), NOW(), NOW())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STEP 3: public.matchmakers (SAME UUIDs as auth.users above).
-- This linkage is what makes auth.uid() = matchmakers.id work in RLS.
-- ---------------------------------------------------------------------------
INSERT INTO public.matchmakers (id, email, full_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'kawaljeet@thedatecrew.com', 'Kawaljeet Kaur'),
    ('22222222-2222-2222-2222-222222222222', 'shimpi@thedatecrew.com',    'Shimpi Sharma'),
    ('33333333-3333-3333-3333-333333333333', 'matchmaker@tdc.demo',       'Demo Matchmaker')
ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
