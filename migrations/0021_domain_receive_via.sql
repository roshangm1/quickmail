-- Resend domains can keep sending through Resend while inbound uses
-- Cloudflare Email Routing. Cloudflare-native domains always receive locally.
ALTER TABLE domains ADD COLUMN receive_via TEXT NOT NULL DEFAULT 'resend';

UPDATE domains SET receive_via = provider_kind;
