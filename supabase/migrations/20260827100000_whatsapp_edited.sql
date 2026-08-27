-- WhatsApp lets a sender edit for ~15 minutes; the export then carries the edited
-- text. An edit is an update to the existing row, stamped here — never a second row.
alter table whatsapp_messages
  add column if not exists edited_at timestamptz;
