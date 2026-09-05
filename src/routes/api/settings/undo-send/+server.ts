import { json, type RequestHandler } from '@sveltejs/kit';
import { isUndoSendSeconds } from '$lib/mail/schedule';
import { getUndoSendSeconds, setUndoSendSeconds } from '$lib/server/undo-send';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return json(
		{ seconds: await getUndoSendSeconds(db, locals.user.id) },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};

export const PATCH: RequestHandler = async ({ request, locals, platform }) => {
	const db = platform?.env.DB;
	if (!db || !locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body: { seconds?: unknown };
	try {
		body = (await request.json()) as { seconds?: unknown };
	} catch {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	if (!isUndoSendSeconds(body.seconds)) {
		return json({ error: 'Unknown undo send delay' }, { status: 400 });
	}

	const seconds = await setUndoSendSeconds(db, locals.user.id, body.seconds);
	return json({ ok: true, seconds }, { headers: { 'Cache-Control': 'no-store' } });
};
