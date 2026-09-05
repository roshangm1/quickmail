import type { MailAddress } from '$lib/types';
import { initials } from './folders';

export function mailboxInitials(address: MailAddress): string {
	if (address.label?.trim()) return initials(address.label);
	const [local, domain] = address.address.split('@');
	if (local && domain) {
		return `${local[0] ?? '?'}${domain[0] ?? '?'}`.toUpperCase();
	}
	return initials(local ?? address.address);
}

export function mailboxTitle(address: MailAddress): string {
	return address.label?.trim() || address.address;
}

export function mailboxSubtitle(address: MailAddress): string | null {
	const label = address.label?.trim();
	if (label && label.toLowerCase() !== address.address.toLowerCase()) {
		return address.address;
	}
	return null;
}
