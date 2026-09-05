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

/** From identity: draft’s address, then the switched mailbox, then the default. */
export function preferredFromAddressId(
	addresses: MailAddress[],
	search: URLSearchParams,
	draftAddressId?: string | null
): string {
	if (draftAddressId && addresses.some((address) => address.id === draftAddressId)) {
		return draftAddressId;
	}
	const selected = search.get('address')?.trim();
	if (selected && addresses.some((address) => address.id === selected)) return selected;
	return addresses.find((address) => address.is_default)?.id ?? addresses[0]?.id ?? '';
}

export function mailboxSubtitle(address: MailAddress): string | null {
	const label = address.label?.trim();
	if (label && label.toLowerCase() !== address.address.toLowerCase()) {
		return address.address;
	}
	return null;
}
