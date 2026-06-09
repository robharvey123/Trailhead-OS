-- Flag a Google account whose refresh token Google has rejected (invalid_grant:
-- revoked / expired / superseded). Sync jobs set this + skip the account instead of
-- failing the whole run, and the integrations page surfaces a "Reconnect" prompt.
-- Cleared when the account is reconnected (OAuth callback).

alter table google_tokens
  add column if not exists needs_reconnect boolean not null default false,
  add column if not exists auth_error text,
  add column if not exists auth_error_at timestamptz;
