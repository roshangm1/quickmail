import { showUndoSend } from './undo-toast';

export type SendMailResult = {
	id: string;
	scheduledAt?: string | null;
	undoUntil?: string | null;
};

export async function postMail(
	url: string,
	payload: Record<string, unknown>
): Promise<SendMailResult> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const body = (await response.json()) as SendMailResult & { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? 'Failed to send');
	}
	if (body.id && body.undoUntil) {
		showUndoSend({ emailId: body.id, undoUntil: body.undoUntil });
	}
	return body;
}
