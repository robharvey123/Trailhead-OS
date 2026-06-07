-- ============================================================================
-- FreeAgent invoice sync — Phase 1: single-account OAuth credential store.
--
-- One Trailhead Holdings FreeAgent account, so one row. Only the service role
-- ever touches this table (RLS on, no policies = nobody else can read/write).
-- The long-lived refresh token is stored encrypted (APP_ENCRYPTION_KEY), matching
-- the google_tokens pattern; refresh_token (plaintext) is a fallback only when
-- encryption isn't configured. The hourly access_token is short-lived.
-- ============================================================================

create table if not exists public.freeagent_credentials (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text,            -- plaintext fallback (only when encryption off)
  refresh_token_encrypted text,  -- preferred
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.freeagent_credentials enable row level security;
-- Intentionally no policies: service-role only.
