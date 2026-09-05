-- Each connected domain remembers which mail backend owns it, so one Worker
-- can send via Resend on some hostnames and Cloudflare Email on others.
ALTER TABLE domains ADD COLUMN provider_kind TEXT NOT NULL DEFAULT 'resend';

-- Cloudflare domain ids are hostnames (they contain a dot). Resend ids are UUIDs.
UPDATE domains SET provider_kind = 'cloudflare' WHERE instr(id, '.') > 0;
