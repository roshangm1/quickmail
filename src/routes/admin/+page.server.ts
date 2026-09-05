import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listAllMobileDeviceSessions, listUsers } from '$lib/server/auth';
import {
	safeEmailProviderKind,
	safeEmailProviderKinds,
	listAvailableDomains,
	providerLoadError
} from '$lib/server/context';
import { listAllAddresses, listUnroutedEmails } from '$lib/server/domains';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user?.is_admin) {
		throw error(403, 'Forbidden');
	}

	const providerKind = safeEmailProviderKind(platform);
	const providerKinds = safeEmailProviderKinds(platform);
	const db = platform?.env.DB;
	if (!db) {
		return {
			users: [],
			addresses: [],
			domains: locals.domains,
			available: [],
			unrouted: [],
			devices: [],
			providerKind,
			providerKinds,
			loadError: 'Database unavailable'
		};
	}

	const [users, addresses, unrouted, devices] = await Promise.all([
		listUsers(db),
		listAllAddresses(db),
		listUnroutedEmails(db, 25),
		listAllMobileDeviceSessions(db)
	]);

	try {
		const available = await listAvailableDomains(platform, locals.domains);

		return {
			users,
			addresses,
			unrouted,
			devices,
			domains: locals.domains,
			available,
			providerKind,
			providerKinds,
			loadError: null
		};
	} catch (err) {
		return {
			users,
			addresses,
			unrouted,
			devices,
			domains: locals.domains,
			available: [],
			providerKind,
			providerKinds,
			loadError: providerLoadError(providerKinds, err)
		};
	}
};
