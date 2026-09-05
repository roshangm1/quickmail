import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { MailAddress, User } from '$lib/types';
import { getUserById } from './auth';
import { readOutboundAttachments } from './attachments';
import { sendProviderResolver } from './context';
import { getAddressForUser } from './domains';
import { initialOutboundStatus } from './email-provider';
import { sendOutboundEmail } from './send-mail';

const FLUSH_BATCH = 25;
const SENDING_MARK = 'sending';

export type DueRow = {
	id: string;
	user_id: string;
	from_addr: string;
	from_name: string | null;
	to_addr: string;
	cc_addr: string | null;
	bcc_addr: string | null;
	subject: string;
	body_text: string | null;
	body_html: string | null;
	in_reply_to: string | null;
	references_header: string | null;
	domain_id: string | null;
	address_id: string | null;
	created_at: string;
};

export type FlushPlatform = {
	env: {
		DB: D1Database;
		ATTACHMENTS: R2Bucket;
	};
};

const DUE_RETURNING = `id, user_id, from_addr, from_name, to_addr, cc_addr, bcc_addr, subject,
			        body_text, body_html, in_reply_to, references_header, domain_id, address_id, created_at`;

/**
 * Take the next due scheduled row so only one flush can send it.
 * Concurrent hooks/cron used to SELECT the same row and deliver twice.
 */
export async function claimNextDueEmail(db: D1Database): Promise<DueRow | null> {
	const row = await db
		.prepare(
			`UPDATE emails
			 SET status = 'queued', status_at = datetime('now'), status_detail = ?
			 WHERE id = (
				SELECT id FROM emails
				WHERE status = 'scheduled'
				  AND scheduled_at IS NOT NULL
				  AND datetime(replace(replace(scheduled_at, 'T', ' '), 'Z', '')) <= datetime('now')
				  AND deleted_at IS NULL
				ORDER BY datetime(replace(replace(scheduled_at, 'T', ' '), 'Z', '')) ASC
				LIMIT 1
			 )
			 AND status = 'scheduled'
			 RETURNING ${DUE_RETURNING}`
		)
		.bind(SENDING_MARK)
		.first<DueRow>();
	return row ?? null;
}

let flushInFlight: Promise<{ sent: number; failed: number }> | null = null;

/** One in-flight flush per isolate so overlapping page loads share the work. */
export function enqueueFlushDueMail(
	platform: FlushPlatform
): Promise<{ sent: number; failed: number }> {
	if (!flushInFlight) {
		flushInFlight = flushDueMail(platform).finally(() => {
			flushInFlight = null;
		});
	}
	return flushInFlight;
}

/**
 * Release send-later / undo-send rows whose hold has elapsed.
 * Safe to call often: claim first, then at most a small batch of sends.
 */
export async function flushDueMail(platform: FlushPlatform): Promise<{ sent: number; failed: number }> {
	const db = platform.env.DB;
	let sent = 0;
	let failed = 0;

	for (let i = 0; i < FLUSH_BATCH; i += 1) {
		const row = await claimNextDueEmail(db);
		if (!row) break;
		try {
			await flushOne(platform, row);
			sent += 1;
		} catch (error) {
			failed += 1;
			const detail = error instanceof Error ? error.message.slice(0, 400) : 'Send failed';
			await db
				.prepare(
					`UPDATE emails
					 SET status = 'scheduled', scheduled_at = datetime('now', '+2 minutes'), status_detail = ?
					 WHERE id = ? AND user_id = ? AND status_detail = ?`
				)
				.bind(detail, row.id, row.user_id, SENDING_MARK)
				.run();
			console.warn('Could not flush scheduled mail', row.id, error);
		}
	}

	return { sent, failed };
}

async function flushOne(platform: FlushPlatform, row: DueRow): Promise<void> {
	const db = platform.env.DB;
	const user = await getUserById(db, row.user_id);
	if (!user) throw new Error('User no longer exists');

	const from = await resolveScheduledFrom(db, user, row);
	const attachments = await readOutboundAttachments(db, platform.env.ATTACHMENTS, user.id, row.id);
	const provider = await sendProviderResolver(platform as App.Platform, db)(from);
	const { providerId } = await sendOutboundEmail(provider, {
		from,
		senderName: from.label?.trim() || user.name,
		to: row.to_addr,
		cc: row.cc_addr ?? undefined,
		bcc: row.bcc_addr ?? undefined,
		subject: row.subject,
		text: row.body_text ?? '',
		html: row.body_html ?? undefined,
		inReplyTo: row.in_reply_to,
		references: row.references_header,
		attachments
	});

	const result = await db
		.prepare(
			`UPDATE emails
			 SET status = ?, status_at = datetime('now'), provider_id = ?, scheduled_at = NULL, status_detail = NULL
			 WHERE id = ? AND user_id = ? AND status_detail = ?`
		)
		.bind(initialOutboundStatus(provider.kind), providerId, row.id, row.user_id, SENDING_MARK)
		.run();

	if ((result.meta?.changes ?? 0) !== 1) {
		throw new Error('Scheduled send was claimed by another flush');
	}
}

async function resolveScheduledFrom(
	db: D1Database,
	user: User,
	row: DueRow
): Promise<MailAddress> {
	if (row.address_id && !row.address_id.startsWith('reply:')) {
		const owned = await getAddressForUser(db, user.id, row.address_id);
		if (owned) return owned;
	}

	const mailbox = row.from_addr.trim().toLowerCase();
	const domainName = mailbox.split('@')[1] ?? '';
	return {
		id: row.address_id ?? `flush:${row.id}`,
		user_id: user.id,
		domain_id: row.domain_id ?? '',
		domain_name: domainName,
		address: mailbox,
		label: row.from_name,
		signature: null,
		is_default: false,
		created_at: row.created_at
	};
}
