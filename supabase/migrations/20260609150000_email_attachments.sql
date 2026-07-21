-- Capture Gmail attachment metadata on ingested messages. Bytes are never stored;
-- each entry keeps enough to fetch on demand and render a download chip.
-- Shape: [{ filename, mime_type, attachment_id, size_bytes }]
alter table email_logs
  add column if not exists attachments jsonb not null default '[]';
