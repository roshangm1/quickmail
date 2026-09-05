import type { D1Database } from '@cloudflare/workers-types';
import type { AvailableDomain, MailAddress } from '$lib/types';
import { getDomain } from './domains';
import {
	inferProviderKindFromId,
	parseEmailProviderKind,
	parseMailDomains,
	ProviderError,
	toAvailableDomain,
	type EmailProvider,
	type EmailProviderKind,
	type ProviderDomain
} from './email-provider';
import { ConfigError } from './errors';
import { createCloudflareProvider } from './providers/cloudflare-provider';
import { createResendProvider, getResendReceivingClient } from './providers/resend-provider';
import type { ResendClient } from './resend';

export { ConfigError } from './errors';
export { ProviderError } from './email-provider';

type PlatformLike = App.Platform | undefined | null;

function tryCreateProvider(platform: PlatformLike, kind: EmailProviderKind): EmailProvider | null {
	switch (kind) {
		case 'resend': {
			const apiKey = platform?.env.RESEND_API_KEY;
			if (!apiKey) return null;
			return createResendProvider(apiKey);
		}
		case 'cloudflare': {
			const email = platform?.env.EMAIL;
			const domains = parseMailDomains(platform?.env.CLOUDFLARE_MAIL_DOMAINS);
			if (!email || domains.length === 0) return null;
			return createCloudflareProvider(email, platform?.env.CLOUDFLARE_MAIL_DOMAINS ?? '');
		}
		default: {
			const _never: never = kind;
			return _never;
		}
	}
}

export function listConfiguredProviderKinds(platform: PlatformLike): EmailProviderKind[] {
	const kinds: EmailProviderKind[] = [];
	if (tryCreateProvider(platform, 'resend')) kinds.push('resend');
	if (tryCreateProvider(platform, 'cloudflare')) kinds.push('cloudflare');
	return kinds;
}

export function listConfiguredProviders(platform: PlatformLike): EmailProvider[] {
	return listConfiguredProviderKinds(platform).map((kind) => {
		const provider = tryCreateProvider(platform, kind);
		if (!provider) throw new ConfigError(`Provider ${kind} disappeared while loading`);
		return provider;
	});
}

/** Preferred kind for logos and fallback copy — not an exclusive switch. */
export function getEmailProviderKind(platform: PlatformLike): EmailProviderKind {
	const configured = listConfiguredProviderKinds(platform);
	const preferred = parseEmailProviderKind(platform?.env.EMAIL_PROVIDER);
	if (preferred && configured.includes(preferred)) return preferred;
	if (configured[0]) return configured[0];
	if (preferred) return preferred;

	const raw = platform?.env.EMAIL_PROVIDER?.trim();
	if (raw && raw.toLowerCase() !== 'both' && raw.toLowerCase() !== 'resend' && raw.toLowerCase() !== 'cloudflare') {
		throw new ConfigError(`Unknown EMAIL_PROVIDER "${raw}". Use "resend", "cloudflare", or omit it to enable every configured backend.`);
	}
	return 'resend';
}

export function safeEmailProviderKind(platform: PlatformLike): EmailProviderKind {
	try {
		return getEmailProviderKind(platform);
	} catch {
		return 'resend';
	}
}

export function safeEmailProviderKinds(platform: PlatformLike): EmailProviderKind[] {
	const configured = listConfiguredProviderKinds(platform);
	return configured.length > 0 ? configured : [safeEmailProviderKind(platform)];
}

export function getEmailProviderByKind(platform: PlatformLike, kind: EmailProviderKind): EmailProvider {
	const provider = tryCreateProvider(platform, kind);
	if (provider) return provider;

	switch (kind) {
		case 'resend':
			throw new ConfigError(
				'RESEND_API_KEY is not set. Add it with `wrangler secret put RESEND_API_KEY` (or to .dev.vars locally).'
			);
		case 'cloudflare':
			throw new ConfigError(
				'Cloudflare Email is not configured. Add a send_email binding named EMAIL and set CLOUDFLARE_MAIL_DOMAINS.'
			);
		default: {
			const _never: never = kind;
			return _never;
		}
	}
}

/** One provider when only one backend is on; prefer EMAIL_PROVIDER if both are. */
export function getEmailProvider(platform: PlatformLike): EmailProvider {
	return getEmailProviderByKind(platform, getEmailProviderKind(platform));
}

export function getEmailProviderForDomainKind(
	platform: PlatformLike,
	kind: EmailProviderKind | string | null | undefined,
	domainId?: string
): EmailProvider {
	const resolved =
		kind === 'resend' || kind === 'cloudflare'
			? kind
			: inferProviderKindFromId(domainId ?? '');
	return getEmailProviderByKind(platform, resolved);
}

/** Pick the backend that owns the From domain. */
export function sendProviderResolver(platform: PlatformLike, db: D1Database) {
	return async (from: MailAddress): Promise<EmailProvider> => {
		const domain = await getDomain(db, from.domain_id);
		return getEmailProviderForDomainKind(platform, domain?.provider_kind, from.domain_id);
	};
}

export function hasProviderConfigured(platform: PlatformLike): boolean {
	return listConfiguredProviderKinds(platform).length > 0;
}

export async function listAvailableDomains(
	platform: PlatformLike,
	connected: { id: string; name: string }[] | Iterable<string> = []
): Promise<AvailableDomain[]> {
	const providers = listConfiguredProviders(platform);
	if (providers.length === 0) {
		getEmailProvider(platform);
	}

	const connectedIds = new Set<string>();
	const connectedNames = new Set<string>();
	if (isConnectedDomainList(connected)) {
		for (const domain of connected) {
			connectedIds.add(domain.id);
			connectedNames.add(domain.name.toLowerCase());
		}
	} else {
		for (const id of connected) connectedIds.add(id);
	}

	const available: AvailableDomain[] = [];
	const errors: unknown[] = [];

	for (const provider of providers) {
		try {
			const remote = await provider.listDomains();
			for (const domain of remote) {
				available.push(
					toAvailableDomain(
						domain,
						connectedIds.has(domain.id) || connectedNames.has(domain.name.toLowerCase())
					)
				);
			}
		} catch (error) {
			errors.push(error);
		}
	}

	if (available.length === 0 && errors.length > 0) {
		throw errors[0];
	}

	return available;
}

function isConnectedDomainList(
	value: { id: string; name: string }[] | Iterable<string>
): value is { id: string; name: string }[] {
	return Array.isArray(value) && (value.length === 0 || typeof value[0] === 'object');
}

export async function findProviderDomain(platform: PlatformLike, id: string): Promise<ProviderDomain> {
	const providers = listConfiguredProviders(platform);
	if (providers.length === 0) {
		return getEmailProvider(platform).getDomain(id);
	}

	const guessed = inferProviderKindFromId(id);
	const ordered = [...providers].sort((left, right) => {
		if (left.kind === guessed) return -1;
		if (right.kind === guessed) return 1;
		return 0;
	});

	let lastError: unknown;
	for (const provider of ordered) {
		try {
			return await provider.getDomain(id);
		} catch (error) {
			lastError = error;
		}
	}

	if (lastError instanceof ProviderError || lastError instanceof ConfigError) throw lastError;
	throw new ProviderError(404, 'domain_not_found', `Domain ${id} was not found on any configured provider`);
}

/** Resend receiving API — used only by the Resend webhook handler. */
export function getResendClient(platform: PlatformLike): ResendClient {
	const apiKey = platform?.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new ConfigError(
			'RESEND_API_KEY is not set. Add it with `wrangler secret put RESEND_API_KEY` (or to .dev.vars locally).'
		);
	}
	return getResendReceivingClient(apiKey);
}

export function getWebhookSecret(platform: PlatformLike): string | null {
	return platform?.env.RESEND_WEBHOOK_SECRET ?? null;
}

export function providerLoadError(kind: EmailProviderKind | EmailProviderKind[], error: unknown): string {
	if (error instanceof ConfigError || error instanceof ProviderError) return error.message;
	const kinds = Array.isArray(kind) ? kind : [kind];
	if (kinds.length !== 1) {
		return 'Could not load domains from the configured mail providers.';
	}
	switch (kinds[0]) {
		case 'resend':
			return 'Could not reach Resend. Check the API key and try again.';
		case 'cloudflare':
			return 'Could not load Cloudflare Email domains. Check EMAIL_PROVIDER and CLOUDFLARE_MAIL_DOMAINS.';
		default: {
			const _never: never = kinds[0];
			return _never;
		}
	}
}

export function describeProviderError(error: unknown, fallback = 'Failed to send email'): string {
	if (error instanceof ConfigError || error instanceof ProviderError) return error.message;
	return error instanceof Error ? error.message : fallback;
}

export function statusForProviderError(error: unknown): number {
	if (error instanceof ConfigError) return 503;
	if (error instanceof ProviderError) return error.status >= 500 ? 502 : 400;
	return 400;
}
