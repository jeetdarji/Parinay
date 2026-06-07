# File: utils/supabase_client.py
# Purpose: Initialize the server-side Supabase client (service role key).
# Phase: 2 — Backend Base + Matching Engine

import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise EnvironmentError(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    )

# Service role key bypasses RLS — safe for server-side use only.
# Never expose this key to the frontend or include it in client-side code.
# The backend uses this to fetch complete profile pools for matching
# and notes for AI journey summaries without RLS restrictions.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
