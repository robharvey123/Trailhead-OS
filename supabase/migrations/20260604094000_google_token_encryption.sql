-- ============================================================================
-- Brief 5 (extend-existing path) — encrypt Google refresh tokens at rest.
--
-- The existing google_tokens.refresh_token is stored PLAINTEXT. This adds an
-- encrypted column and relaxes the NOT NULL on the plaintext column so that,
-- once APP_ENCRYPTION_KEY is set, the app stores the encrypted form and nulls
-- the plaintext (see lib/google/oauth.ts + the admin backfill route).
--
-- Additive + safe: with no key set, the app keeps using plaintext and this
-- column simply stays null. Nothing breaks if deployed before the key exists.
-- ============================================================================

alter table google_tokens add column if not exists refresh_token_encrypted text;

-- Allow nulling the plaintext column once a row has been encrypted.
alter table google_tokens alter column refresh_token drop not null;
