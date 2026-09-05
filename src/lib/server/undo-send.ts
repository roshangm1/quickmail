import type { D1Database } from '@cloudflare/workers-types';
import {
	UNDO_SEND_SECONDS,
	parseUndoSendSeconds,
	type UndoSendSeconds
} from '$lib/mail/schedule';

export async function getUndoSendSeconds(db: D1Database, userId: string): Promise<UndoSendSeconds> {
	const row = await db
		.prepare('SELECT undo_send_seconds FROM users WHERE id = ?')
		.bind(userId)
		.first<{ undo_send_seconds: number | null }>();
	return parseUndoSendSeconds(row?.undo_send_seconds ?? UNDO_SEND_SECONDS);
}

export async function setUndoSendSeconds(
	db: D1Database,
	userId: string,
	value: unknown
): Promise<UndoSendSeconds> {
	const seconds = parseUndoSendSeconds(value);
	await db
		.prepare('UPDATE users SET undo_send_seconds = ? WHERE id = ?')
		.bind(seconds, userId)
		.run();
	return seconds;
}
