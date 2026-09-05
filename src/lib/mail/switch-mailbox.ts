import { goto } from '$app/navigation';
import type { MailAddress } from '$lib/types';

export { mailboxInitials, mailboxSubtitle, mailboxTitle } from './mailbox-identity';

/**
 * Filter the inbox to one mailbox, or clear the filter (`address: null`).
 * Switching domains needs a reload so the domain cookie applies.
 */
export async function applyMailboxFilter(input: {
	address: MailAddress | null;
	activeDomainId: string | null;
}): Promise<void> {
	const url = new URL(globalThis.location.href);
	url.searchParams.delete('thread');

	if (!input.address) {
		url.searchParams.delete('address');
		if (input.activeDomainId) {
			await fetch('/api/domains/select', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domainId: null })
			});
			globalThis.location.assign(`${url.pathname}${url.search}`);
			return;
		}
		await goto(`${url.pathname}${url.search}`, { noScroll: true });
		return;
	}

	url.searchParams.set('address', input.address.id);
	if (input.address.domain_id !== input.activeDomainId) {
		await fetch('/api/domains/select', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ domainId: input.address.domain_id })
		});
		globalThis.location.assign(`${url.pathname}${url.search}`);
		return;
	}

	await goto(`${url.pathname}${url.search}`, { noScroll: true });
}
