import type { LayoutServerLoad } from './$types';
import { listApiTokens } from '$lib/server/api-tokens';
import { getEmailSignature } from '$lib/server/email-signature';
import { getUndoSendSeconds } from '$lib/server/undo-send';
import { UNDO_SEND_SECONDS } from '$lib/mail/schedule';
import { listDeviceSessions } from '$lib/server/auth';
import { readVapidConfiguration } from '$lib/server/push-notifications';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const db = platform?.env.DB;
	const [signature, undoSendSeconds, apiTokens, devices] = await Promise.all([
		locals.user && db ? getEmailSignature(db, locals.user.id) : '',
		locals.user && db ? getUndoSendSeconds(db, locals.user.id) : UNDO_SEND_SECONDS,
		locals.user && db ? listApiTokens(db, locals.user.id) : [],
		locals.user && db ? listDeviceSessions(db, locals.user.id, locals.currentSessionId) : []
	]);
	const vapid = platform?.env ? readVapidConfiguration(platform.env) : null;

	return {
		domains: locals.domains,
		addresses: locals.addresses,
		signature,
		undoSendSeconds,
		apiTokens,
		push: {
			configured: Boolean(vapid),
			publicKey: vapid?.publicKey ?? null
		},
		isAdmin: locals.user?.is_admin ?? false,
		devices
	};
};
