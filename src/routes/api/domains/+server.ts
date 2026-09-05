import { json, type RequestHandler } from '@sveltejs/kit';
import {
	ConfigError,
	findProviderDomain,
	safeEmailProviderKind,
	safeEmailProviderKinds,
	hasProviderConfigured,
	listAvailableDomains,
	listConfiguredProviders,
	ProviderError,
	providerLoadError
} from '$lib/server/context';
import { parseReceiveViaInput } from '$lib/server/email-provider';
import { listDomains, syncDomains, upsertDomain } from '$lib/server/domains';

/**
 * GET  — every domain any configured provider can reach, flagged with
 *        whether it is already connected to this dashboard.
 * POST — connect one (or several) of them.
 */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const connected = await listDomains(db);
	const providerKind = safeEmailProviderKind(platform);
	const providerKinds = safeEmailProviderKinds(platform);

	if (!locals.user.is_admin) {
		return json({
			connected,
			available: [],
			providerConfigured: true,
			providerKind,
			providerKinds
		});
	}

	try {
		if (url.searchParams.get('sync') === '1') {
			return json({
				connected: await syncDomains(db, listConfiguredProviders(platform)),
				available: [],
				providerKind,
				providerKinds
			});
		}

		return json({
			connected,
			providerConfigured: true,
			providerKind,
			providerKinds,
			available: await listAvailableDomains(platform, connected)
		});
	} catch (error) {
		if (error instanceof ConfigError) {
			return json({
				connected,
				available: [],
				providerConfigured: false,
				providerKind,
				providerKinds,
				error: error.message
			});
		}
		return json(
			{
				connected,
				available: [],
				providerConfigured: hasProviderConfigured(platform),
				providerKind,
				providerKinds,
				error: providerLoadError(providerKinds, error)
			},
			{ status: error instanceof ProviderError ? (error.status >= 500 ? 502 : 400) : 502 }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user?.is_admin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = (await request.json()) as {
		domainIds?: string[];
		domainId?: string;
		receiveVia?: unknown;
	};
	const ids = body.domainIds ?? (body.domainId ? [body.domainId] : []);
	const receiveVia = parseReceiveViaInput(body.receiveVia);

	if (ids.length === 0) {
		return json({ error: 'Select at least one domain' }, { status: 400 });
	}

	try {
		const connected = [];

		for (const id of ids) {
			connected.push(
				await upsertDomain(db, await findProviderDomain(platform, id), { receiveVia })
			);
		}

		return json({ connected, domains: await listDomains(db) }, { status: 201 });
	} catch (error) {
		const message =
			error instanceof ConfigError || error instanceof ProviderError
				? error.message
				: 'Failed to connect domain';
		return json({ error: message }, { status: 400 });
	}
};
