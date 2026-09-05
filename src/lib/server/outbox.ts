import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { MailAddress, OutboundAttachmentInput, User } from '$lib/types';
import { appendEmailSignature, pickEmailSignature } from '$lib/email-signature';
import { base64ByteLength, insertAttachments } from './attachments';
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENTS_PER_EMAIL,
	MAX_TOTAL_ATTACHMENT_BYTES
} from './constants';
import {
	getAddressForUser,
	getDefaultAddress,
	getDomainByName,
	listAddressesForUser
} from './domains';
import { parseEmailAddress } from './email-address';
import { getEmailSignature } from './email-signature';
import { stripHtml } from './html';
import { isFuture, parseScheduleAt, toIso, undoSendAt } from '$lib/mail/schedule';
import { getUndoSendSeconds } from './undo-send';
import { insertEmail } from './mail-store';
import { initialOutboundStatus, type EmailProvider } from './email-provider';
import { escapeHtml, parseRecipients, sendOutboundEmail } from './send-mail';

export type ProviderResolver =
	| EmailProvider
	| ((from: MailAddress) => EmailProvider | Promise<EmailProvider>);

async function resolveSendProvider(
	source: ProviderResolver,
	from: MailAddress
): Promise<EmailProvider> {
	return typeof source === 'function' ? source(from) : source;
}

export type ComposeInput = {
	fromAddressId?: string | null;
	/** Pre-resolved identity — used by replies so we can send from the received mailbox. */
	fromAddress?: MailAddress | null;
	to: string;
	cc?: string | null;
	bcc?: string | null;
	subject: string;
	text?: string | null;
	html?: string | null;
	inReplyTo?: string | null;
	references?: string | null;
	replyToEmailId?: string | null;
	attachments?: OutboundAttachmentInput[];
	/** Forward-all can legitimately combine the per-message attachment sets. */
	allowCombinedAttachments?: boolean;
	/** Disable subject fallback for messages that intentionally start a thread. */
	subjectMatch?: boolean;
	/** Explicit send-later time (ISO). */
	scheduledAt?: string | null;
	/** Hold in outbox so the composer can undo. Duration is the account setting. */
	holdUndo?: boolean;
};

export function assertTotalAttachmentBytes(totalBytes: number): void {
	if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
		throw new Error('Attachments exceed the total size limit');
	}
}

/** Reject attachment sets before provider delivery or Sent-folder persistence. */
export function assertOutboundAttachments(
	attachments: OutboundAttachmentInput[],
	allowCombinedAttachments = false
): void {
	if (!allowCombinedAttachments && attachments.length > MAX_ATTACHMENTS_PER_EMAIL) {
		throw new Error(`Maximum ${MAX_ATTACHMENTS_PER_EMAIL} attachments allowed`);
	}

	for (const attachment of attachments) {
		const bytes = base64ByteLength(attachment.content);
		if (bytes > MAX_ATTACHMENT_BYTES) {
			const limitMb = MAX_ATTACHMENT_BYTES / (1024 * 1024);
			throw new Error(`"${attachment.filename}" exceeds ${limitMb}MB limit`);
		}
	}

	assertTotalAttachmentBytes(
		attachments.reduce((sum, attachment) => sum + base64ByteLength(attachment.content), 0)
	);
}

/**
 * Pick the identity a message is sent from: the one the composer chose, or the
 * user's default. Only addresses the user actually owns are accepted.
 */
export async function resolveFromAddress(
	db: D1Database,
	user: User,
	addressId?: string | null
): Promise<MailAddress> {
	const address = addressId
		? await getAddressForUser(db, user.id, addressId)
		: await getDefaultAddress(db, user.id);

	if (!address) {
		throw new Error('No sending address configured. Add one in Settings first.');
	}

	return address;
}

/**
 * Replies come from the mailbox that received the original, not the default
 * sending identity. Catch-all mail uses that exact recipient if the user owns
 * the domain, even when the local-part is not a saved address.
 *
 * Returns null when the user has no sending identity, so the thread page can
 * still load.
 */
export async function resolveReplyFromAddress(
	db: D1Database,
	user: User,
	original: { direction: 'inbound' | 'outbound'; to_addr: string; from_addr: string }
): Promise<MailAddress | null> {
	const mailbox = parseEmailAddress(
		original.direction === 'inbound' ? original.to_addr : original.from_addr
	);

	const owned = await listAddressesForUser(db, user.id);
	const exact = owned.find((address) => address.address.toLowerCase() === mailbox);
	if (exact) return exact;

	const domainName = mailbox.split('@')[1];
	const domain = domainName ? await getDomainByName(db, domainName) : null;
	const canSendOnDomain =
		domain &&
		(domain.catchall_user_id === user.id ||
			owned.some((address) => address.domain_id === domain.id));

	if (domain && canSendOnDomain && mailbox.includes('@')) {
		return {
			id: `reply:${mailbox}`,
			user_id: user.id,
			domain_id: domain.id,
			domain_name: domain.name,
			address: mailbox,
			label: null,
			signature: null,
			is_default: false,
			created_at: new Date().toISOString()
		};
	}

	return getDefaultAddress(db, user.id);
}

export type SendAndStoreResult = {
	emailId: string;
	providerId: string | null;
	from: MailAddress;
	scheduledAt?: string;
	undoUntil?: string;
};

/** Send through the configured provider, then record it in the Sent folder. */
export async function sendAndStore(
	env: { DB: D1Database; ATTACHMENTS: R2Bucket },
	provider: ProviderResolver,
	user: User,
	input: ComposeInput
): Promise<SendAndStoreResult> {
	// resolveFromAddress scopes the lookup to this user, so ownership is implied.
	const from = input.fromAddress ?? (await resolveFromAddress(env.DB, user, input.fromAddressId));
	const resolvedProvider = await resolveSendProvider(provider, from);

	const bodyHtml = input.html?.trim() || null;
	const bodyText = input.text?.trim() || (bodyHtml ? stripHtml(bodyHtml) : '');

	// The automatic signature does not count as message content.
	if (!bodyText && !bodyHtml) {
		throw new Error('Message body is required');
	}

	const { text, html } = appendEmailSignature({
		text: bodyText,
		html: bodyHtml,
		signature: pickEmailSignature(from.signature, await getEmailSignature(env.DB, user.id))
	});

	const attachments = input.attachments ?? [];
	assertOutboundAttachments(attachments, input.allowCombinedAttachments);

	const now = new Date();
	const explicit = parseScheduleAt(input.scheduledAt);
	if (input.scheduledAt && !explicit) {
		throw new Error('That send time is not valid');
	}
	if (explicit && !isFuture(explicit, now)) {
		throw new Error('Pick a time in the future');
	}
	const undoSeconds = await getUndoSendSeconds(env.DB, user.id);
	const hold = input.holdUndo && !explicit && undoSeconds > 0 ? undoSendAt(now, undoSeconds) : null;
	const when = explicit && isFuture(explicit, now) ? explicit : hold;

	if (when) {
		const scheduledAt = toIso(when);
		const emailId = await insertEmail(env.DB, {
			userId: user.id,
			direction: 'outbound',
			from: from.address,
			fromName: from.label?.trim() || user.name,
			to: parseRecipients(input.to).join(', '),
			cc: parseRecipients(input.cc).join(', ') || null,
			bcc: parseRecipients(input.bcc).join(', ') || null,
			subject: input.subject.trim(),
			bodyText: text,
			bodyHtml: html ?? escapeHtml(text).replaceAll('\n', '<br>\n'),
			inReplyTo: input.inReplyTo ?? null,
			references: input.references ?? null,
			replyToEmailId: input.replyToEmailId ?? null,
			domainId: from.domain_id,
			addressId: from.id,
			status: 'scheduled',
			scheduledAt,
			isRead: true,
			subjectMatch: input.subjectMatch
		});

		if (attachments.length > 0) {
			await insertAttachments(env.DB, env.ATTACHMENTS, emailId, attachments, {
				enforceCountLimit: !input.allowCombinedAttachments
			});
		}

		return {
			emailId,
			providerId: null,
			from,
			scheduledAt,
			undoUntil: hold ? scheduledAt : undefined
		};
	}

	const { providerId } = await sendOutboundEmail(resolvedProvider, {
		from,
		senderName: from.label?.trim() || user.name,
		to: input.to,
		cc: input.cc ?? undefined,
		bcc: input.bcc ?? undefined,
		subject: input.subject,
		text,
		html: html ?? undefined,
		inReplyTo: input.inReplyTo,
		references: input.references,
		attachments
	});

	const emailId = await insertEmail(env.DB, {
		userId: user.id,
		direction: 'outbound',
		from: from.address,
		fromName: from.label?.trim() || user.name,
		to: parseRecipients(input.to).join(', '),
		cc: parseRecipients(input.cc).join(', ') || null,
		bcc: parseRecipients(input.bcc).join(', ') || null,
		subject: input.subject.trim(),
		bodyText: text,
		bodyHtml: html ?? escapeHtml(text).replaceAll('\n', '<br>\n'),
		inReplyTo: input.inReplyTo ?? null,
		references: input.references ?? null,
		replyToEmailId: input.replyToEmailId ?? null,
		domainId: from.domain_id,
		addressId: from.id,
		providerId,
		status: initialOutboundStatus(resolvedProvider.kind),
		isRead: true,
		subjectMatch: input.subjectMatch
	});

	if (attachments.length > 0) {
		await insertAttachments(env.DB, env.ATTACHMENTS, emailId, attachments, {
			enforceCountLimit: !input.allowCombinedAttachments
		});
	}

	return { emailId, providerId, from };
}
