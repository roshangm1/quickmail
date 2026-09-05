import type { EmailProviderKind } from '$lib/types';
import { DEFAULT_LOCALE } from '$lib/i18n/locales';
import { translate } from '$lib/i18n/translate';

type ProviderRef = EmailProviderKind | EmailProviderKind[];

function asKinds(kind: ProviderRef): EmailProviderKind[] {
	const kinds = Array.isArray(kind) ? kind : [kind];
	return kinds.length > 0 ? kinds : ['resend'];
}

function isBoth(kinds: EmailProviderKind[]): boolean {
	return kinds.includes('resend') && kinds.includes('cloudflare');
}

export function providerName(kind: EmailProviderKind, locale: string = DEFAULT_LOCALE): string {
	switch (kind) {
		case 'resend':
			return translate(locale, 'provider.resend');
		case 'cloudflare':
			return translate(locale, 'provider.cloudflare');
		default: {
			const _never: never = kind;
			return _never;
		}
	}
}

export function providersLabel(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (kinds.length === 1) return providerName(kinds[0], locale);
	return translate(locale, 'provider.and', {
		a: providerName('resend', locale),
		b: providerName('cloudflare', locale)
	});
}

export function missingProviderTitle(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (isBoth(kinds) || kinds.length !== 1) return translate(locale, 'provider.missingTitle.both');
	switch (kinds[0]) {
		case 'resend':
			return translate(locale, 'provider.missingTitle.resend');
		case 'cloudflare':
			return translate(locale, 'provider.missingTitle.cloudflare');
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function missingProviderHint(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (isBoth(kinds) || kinds.length !== 1) return translate(locale, 'provider.missingHint.both');
	switch (kinds[0]) {
		case 'resend':
			return translate(locale, 'provider.missingHint.resend');
		case 'cloudflare':
			return translate(locale, 'provider.missingHint.cloudflare');
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function noDomainsTitle(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (isBoth(kinds)) return translate(locale, 'provider.noDomainsTitle.both');
	switch (kinds[0]) {
		case 'resend':
			return translate(locale, 'provider.noDomainsTitle.resend');
		case 'cloudflare':
			return translate(locale, 'provider.noDomainsTitle.cloudflare');
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function noDomainsBody(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (isBoth(kinds)) return translate(locale, 'provider.noDomainsBody.both');
	switch (kinds[0]) {
		case 'resend':
			return translate(locale, 'provider.noDomainsBody.resend');
		case 'cloudflare':
			return translate(locale, 'provider.noDomainsBody.cloudflare');
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function domainPickerSubtitle(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (isBoth(kinds)) return translate(locale, 'provider.domainPickerSubtitle.both');
	switch (kinds[0]) {
		case 'resend':
			return translate(locale, 'provider.domainPickerSubtitle.resend');
		case 'cloudflare':
			return translate(locale, 'provider.domainPickerSubtitle.cloudflare');
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function onboardingSubtitle(kind: ProviderRef, locale: string = DEFAULT_LOCALE): string {
	const kinds = asKinds(kind);
	if (isBoth(kinds)) return translate(locale, 'provider.onboardingSubtitle.both');
	switch (kinds[0]) {
		case 'resend':
			return translate(locale, 'provider.onboardingSubtitle.resend');
		case 'cloudflare':
			return translate(locale, 'provider.onboardingSubtitle.cloudflare');
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function receivingHint(
	kind: EmailProviderKind,
	domainName: string,
	locale: string = DEFAULT_LOCALE,
	receiveVia?: EmailProviderKind
): string {
	if (kind === 'resend' && receiveVia === 'cloudflare') {
		return translate(locale, 'provider.receivingHint.resendViaCloudflare', { domain: domainName });
	}
	switch (kind) {
		case 'resend':
			return translate(locale, 'provider.receivingHint.resend', { domain: domainName });
		case 'cloudflare':
			return translate(locale, 'provider.receivingHint.cloudflare', { domain: domainName });
		default: {
			const _never: never = kind;
			return _never;
		}
	}
}
