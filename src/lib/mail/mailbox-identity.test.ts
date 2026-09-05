import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MailAddress } from '$lib/types';
import { mailboxInitials, mailboxSubtitle, mailboxTitle, preferredFromAddressId } from './mailbox-identity';

function address(partial: Partial<MailAddress> & Pick<MailAddress, 'address'>): MailAddress {
	return {
		id: 'id',
		user_id: 'user',
		domain_id: 'domain',
		domain_name: partial.address.split('@')[1] ?? 'example.com',
		label: null,
		is_default: false,
		signature: null,
		created_at: '2026-01-01',
		...partial
	};
}

test('mailbox initials use the display name when present', () => {
	assert.equal(mailboxInitials(address({ address: 'you@example.com', label: 'Support Desk' })), 'SD');
});

test('mailbox initials fall back to local and domain letters', () => {
	assert.equal(mailboxInitials(address({ address: 'hello@quickmail.dev' })), 'HQ');
});

test('mailbox title prefers the From name', () => {
	assert.equal(mailboxTitle(address({ address: 'you@example.com', label: 'Support' })), 'Support');
	assert.equal(mailboxTitle(address({ address: 'you@example.com' })), 'you@example.com');
});

test('compose From prefers the switched mailbox over the default', () => {
	const def = address({ id: 'default', address: 'me@example.com', is_default: true });
	const other = address({ id: 'other', address: 'jobs@example.com' });
	assert.equal(
		preferredFromAddressId([def, other], new URLSearchParams('address=other')),
		'other'
	);
	assert.equal(preferredFromAddressId([def, other], new URLSearchParams()), 'default');
	assert.equal(
		preferredFromAddressId([def, other], new URLSearchParams(), 'other'),
		'other'
	);
	assert.equal(
		preferredFromAddressId([def, other], new URLSearchParams('address=other'), 'default'),
		'default'
	);
	assert.equal(
		preferredFromAddressId([def, other], new URLSearchParams('address=missing')),
		'default'
	);
});

test('mailbox subtitle is the address when a distinct name exists', () => {
	assert.equal(mailboxSubtitle(address({ address: 'you@example.com', label: 'Support' })), 'you@example.com');
	assert.equal(mailboxSubtitle(address({ address: 'you@example.com' })), null);
});
