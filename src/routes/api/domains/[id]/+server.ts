import type { D1Database } from '@cloudflare/workers-types';
import { json, type RequestHandler } from '@sveltejs/kit';
import { findProviderDomain, ProviderError } from '$lib/server/context';
import { parseReceiveViaInput } from '$lib/server/email-provider';
import {
	disconnectDomain,
	getDomain,
	setCatchallUser,
	setDomainReceiveVia,
	upsertDomain
} from '$lib/server/domains';

/** PATCH — set the catch-all owner or re-sync status from the active provider. */
export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user?.is_admin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const domain = await getDomain(db, params.id!);
	if (!domain) {
		return json({ error: 'Domain not connected' }, { status: 404 });
	}

	const body = (await request.json()) as {
		catchallUserId?: string | null;
		refresh?: boolean;
		receiveVia?: unknown;
	};

	if (body.refresh) {
		try {
			const remote = await findProviderDomain(platform, domain.id);
			return json({ domain: await upsertDomain(db, remote) });
		} catch (error) {
			return json(
				{ error: error instanceof ProviderError ? error.message : 'Failed to refresh domain' },
				{ status: 502 }
			);
		}
	}

	if (body.receiveVia !== undefined) {
		return patchReceiveVia(platform, db, domain.id, body.receiveVia);
	}

	if (body.catchallUserId !== undefined) {
		await setCatchallUser(db, domain.id, body.catchallUserId || null);
	}

	return json({ domain: await getDomain(db, domain.id) });
};

/** DELETE — stop using the domain here. The domain stays with the provider. */
export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user?.is_admin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	await disconnectDomain(db, params.id!);
	return json({ ok: true });
};

async function patchReceiveVia(
	platform: App.Platform | undefined,
	db: D1Database,
	domainId: string,
	value: unknown
) {
	const receiveVia = parseReceiveViaInput(value);
	if (!receiveVia) {
		return json({ error: 'receiveVia must be resend or cloudflare' }, { status: 400 });
	}

	try {
		await setDomainReceiveVia(db, domainId, receiveVia);
	} catch (error) {
		return json(
			{
				error: error instanceof ProviderError ? error.message : 'Failed to update inbound provider'
			},
			{ status: error instanceof ProviderError ? error.status : 400 }
		);
	}

	try {
		const remote = await findProviderDomain(platform, domainId);
		return json({ domain: await upsertDomain(db, remote, { receiveVia }) });
	} catch {
		return json({ domain: await getDomain(db, domainId) });
	}
}
