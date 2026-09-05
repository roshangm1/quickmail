export const UNDO_SEND_SECONDS = 30;
export const UNDO_SEND_OPTIONS = [0, 5, 10, 20, 30, 60] as const;
export type UndoSendSeconds = (typeof UNDO_SEND_OPTIONS)[number];

export function isUndoSendSeconds(value: unknown): value is UndoSendSeconds {
	return typeof value === 'number' && UNDO_SEND_OPTIONS.includes(value as UndoSendSeconds);
}

export function parseUndoSendSeconds(value: unknown): UndoSendSeconds {
	const seconds = typeof value === 'number' ? value : Number(value);
	return isUndoSendSeconds(seconds) ? seconds : UNDO_SEND_SECONDS;
}

export type SchedulePresetId = 'later_today' | 'tomorrow' | 'next_week';

/** 6pm today, or three hours from now if that is already past. */
export function laterToday(now = new Date()): Date {
	const six = new Date(now);
	six.setHours(18, 0, 0, 0);
	if (six.getTime() - now.getTime() < 60 * 60 * 1000) {
		return new Date(now.getTime() + 3 * 60 * 60 * 1000);
	}
	return six;
}

export function tomorrowMorning(now = new Date()): Date {
	const next = new Date(now);
	next.setDate(next.getDate() + 1);
	next.setHours(9, 0, 0, 0);
	return next;
}

/** Next Monday at 9:00 local. */
export function nextWeek(now = new Date()): Date {
	const next = new Date(now);
	const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
	next.setDate(next.getDate() + daysUntilMonday);
	next.setHours(9, 0, 0, 0);
	return next;
}

export function presetAt(id: SchedulePresetId, now = new Date()): Date {
	switch (id) {
		case 'later_today':
			return laterToday(now);
		case 'tomorrow':
			return tomorrowMorning(now);
		case 'next_week':
			return nextWeek(now);
		default: {
			const _never: never = id;
			return _never;
		}
	}
}

export function undoSendAt(now = new Date(), seconds: number = UNDO_SEND_SECONDS): Date {
	const hold = parseUndoSendSeconds(seconds);
	return new Date(now.getTime() + hold * 1000);
}

export function parseScheduleAt(value: string | null | undefined): Date | null {
	if (!value?.trim()) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function isFuture(date: Date, now = new Date()): boolean {
	return date.getTime() > now.getTime() + 999;
}

export function toIso(date: Date): string {
	return date.toISOString();
}

export function toDatetimeLocalValue(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
