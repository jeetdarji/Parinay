-- ============================================================================
-- File: 00_extensions.sql
-- Purpose: Enable required PostgreSQL extensions for the TDC Matchmaker DB.
-- Run order: 1 of 5 SQL files
-- Dependencies: None
-- Safe to re-run: Yes (CREATE EXTENSION IF NOT EXISTS is idempotent)
-- ============================================================================
--
-- NOTES:
--   * Run this in the Supabase SQL Editor (region: ap-south-1).
--   * uuid-ossp provides uuid_generate_v4() used as DEFAULT on PK columns.
--   * pgcrypto provides crypt() and gen_salt('bf', 10) which we use in
--     04_seed_matchmakers.sql to bcrypt-hash demo passwords (cost factor 10,
--     the same scheme Supabase Auth uses). pgcrypto ships with Supabase.
--   * No superuser-only extensions are used.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
