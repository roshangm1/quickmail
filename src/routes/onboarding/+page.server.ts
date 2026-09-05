import type { PageServerLoad } from './$types';
import {
	ConfigError,
	safeEmailProviderKind,
	safeEmailProviderKinds,
	hasProviderConfigured,
	listAvailableDomains,
	providerLoadError
} from '$lib/server/context';
import type { AvailableDomain } from '$lib/types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const providerKind = safeEmailProviderKind(platform);
	const providerKinds = safeEmailProviderKinds(platform);
	const base = {
		domains: locals.domains,
		addresses: locals.addresses,
		isAdmin: locals.user?.is_admin ?? false,
		providerKind,
		providerKinds
	};

	// Only the admin talks to the provider; everyone else just claims an address
	// on an already-connected domain.
	if (!locals.user?.is_admin) {
		return { ...base, available: [] as AvailableDomain[], providerConfigured: true, loadError: null };
	}

	try {
		const available = await listAvailableDomains(platform, locals.domains);
		return { ...base, available, providerConfigured: true, loadError: null };
	} catch (error) {
		return {
			...base,
			available: [] as AvailableDomain[],
			providerConfigured: !(error instanceof ConfigError) && hasProviderConfigured(platform),
			loadError: providerLoadError(providerKinds, error)
		};
	}
};
