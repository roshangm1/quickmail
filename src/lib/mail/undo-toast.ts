import { writable } from 'svelte/store';

export type UndoSendToast = {
	emailId: string;
	undoUntil: string;
};

export const undoSendToast = writable<UndoSendToast | null>(null);

export function showUndoSend(toast: UndoSendToast): void {
	undoSendToast.set(toast);
}

export function clearUndoSend(): void {
	undoSendToast.set(null);
}
