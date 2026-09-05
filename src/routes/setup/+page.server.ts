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

/**
 * Loads the domains the configured provider can reach so the first screen is a
 * domain choice rather than a form. Only reachable while the app has no users
 * — the hook redirects away once setup is done.
 */
export const load: PageServerLoad = async ({ platform }) => {
	const providerKind = safeEmailProviderKind(platform);
	const providerKinds = safeEmailProviderKinds(platform);

	try {
		const available = await listAvailableDomains(platform);
		return {
			available,
			providerKind,
			providerKinds,
			providerConfigured: true,
			loadError: null
		};
	} catch (error) {
		return {
			available: [] as AvailableDomain[],
			providerKind,
			providerKinds,
			providerConfigured: !(error instanceof ConfigError) && hasProviderConfigured(platform),
			loadError: providerLoadError(providerKinds, error)
		};
	}
};
