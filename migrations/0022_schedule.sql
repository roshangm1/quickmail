-- Snooze hides a conversation until a time; scheduled_at holds send-later / undo-send.
ALTER TABLE emails ADD COLUMN snoozed_until TEXT;
ALTER TABLE emails ADD COLUMN scheduled_at TEXT;

CREATE INDEX idx_emails_snoozed ON emails(user_id, snoozed_until);
CREATE INDEX idx_emails_scheduled ON emails(user_id, status, scheduled_at);
