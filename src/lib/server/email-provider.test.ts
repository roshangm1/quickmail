import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { MailAddress } from '$lib/types';
import type { EmailProvider } from './email-provider';
import {
	inferProviderKindFromId,
	parseEmailProviderKind,
	parseMailDomains,
	parseReceiveViaInput,
	resolveReceiveVia,
	usesCloudflareReceive
} from './email-provider';
import { sendOutboundEmail, type OutboundMailInput } from './send-mail';

describe('parseMailDomains', () => {
	test('splits comma-separated domains and lowercases them', () => {
		assert.deepEqual(parseMailDomains('Mail.Yours.com, YourDomain.com'), [
			'mail.yours.com',
			'yourdomain.com'
		]);
	});

	test('ignores the dashboard placeholder so Resend deploys can leave example.com', () => {
		assert.deepEqual(parseMailDomains('example.com'), []);
		assert.deepEqual(parseMailDomains('example.com, mail.example.com'), ['mail.example.com']);
	});

	test('returns an empty list for blank values', () => {
		assert.deepEqual(parseMailDomains(''), []);
		assert.deepEqual(parseMailDomains('   '), []);
		assert.deepEqual(parseMailDomains(null), []);
	});
});

describe('inferProviderKindFromId', () => {
	test('treats hostnames as Cloudflare and UUIDs as Resend', () => {
		assert.equal(inferProviderKindFromId('mail.example.com'), 'cloudflare');
		assert.equal(inferProviderKindFromId('2b1c0d1e-0000-4000-8000-000000000001'), 'resend');
	});
});

describe('parseEmailProviderKind', () => {
	test('accepts resend, cloudflare, and treats both/unknown as unset', () => {
		assert.equal(parseEmailProviderKind(undefined), 'resend');
		assert.equal(parseEmailProviderKind('cloudflare'), 'cloudflare');
		assert.equal(parseEmailProviderKind('both'), null);
		assert.equal(parseEmailProviderKind('smtp'), null);
	});
});

describe('resolveReceiveVia', () => {
	test('Cloudflare-native domains always receive locally', () => {
		assert.equal(resolveReceiveVia('cloudflare', 'resend'), 'cloudflare');
		assert.equal(resolveReceiveVia('cloudflare', null), 'cloudflare');
	});

	test('Resend domains default to Resend inbound and can opt into Cloudflare', () => {
		assert.equal(resolveReceiveVia('resend', undefined), 'resend');
		assert.equal(resolveReceiveVia('resend', 'resend'), 'resend');
		assert.equal(resolveReceiveVia('resend', 'cloudflare'), 'cloudflare');
	});
});

describe('parseReceiveViaInput', () => {
	test('accepts only the two inbound backends', () => {
		assert.equal(parseReceiveViaInput('resend'), 'resend');
		assert.equal(parseReceiveViaInput('cloudflare'), 'cloudflare');
		assert.equal(parseReceiveViaInput('both'), null);
		assert.equal(parseReceiveViaInput(true), null);
	});
});

describe('usesCloudflareReceive', () => {
	test('is true for Cloudflare domains and Resend domains that opted in', () => {
		assert.equal(usesCloudflareReceive('cloudflare', 'resend'), true);
		assert.equal(usesCloudflareReceive('resend', 'cloudflare'), true);
		assert.equal(usesCloudflareReceive('resend', 'resend'), false);
	});
});

test('a forwarded send uses its selected identity and has no reply-chain headers', async () => {
	let sent: OutboundMailInput | undefined;
	const provider: EmailProvider = {
		kind: 'resend',
		async send(input) {
			sent = input;
			return { providerId: 'provider-id' };
		},
		async listDomains() {
			return [];
		},
		async getDomain() {
			throw new Error('unused');
		}
	};
	const from: MailAddress = {
		id: 'address-1',
		user_id: 'user-1',
		domain_id: 'domain-1',
		domain_name: 'example.com',
		address: 'me@example.com',
		label: 'Me',
		is_default: true,
		signature: null,
		created_at: '2026-01-01'
	};

	await sendOutboundEmail(provider, {
		from,
		senderName: 'Me',
		to: 'recipient@example.com',
		subject: 'Fwd: Original',
		text: 'Forwarded message'
	});

	assert.equal(sent?.from.address, 'me@example.com');
	assert.equal(sent?.inReplyTo, undefined);
	assert.equal(sent?.references, undefined);
	assert.equal(sent?.headers, undefined);
});
