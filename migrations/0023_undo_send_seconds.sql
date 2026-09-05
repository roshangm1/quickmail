-- How long the composer holds a send so it can be undone.
ALTER TABLE users ADD COLUMN undo_send_seconds INTEGER NOT NULL DEFAULT 30;
