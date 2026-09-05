export const MAIL_CHANGED_MESSAGE = 'mail:changed';

/** Fallback only — push and tab-focus do the real work. */
export const MAILBOX_IDLE_REFRESH_MS = 30_000;

function isMailChangedMessage(data: unknown): boolean {
	return (
		typeof data === 'object' &&
		data !== null &&
		'type' in data &&
		(data as { type: unknown }).type === MAIL_CHANGED_MESSAGE
	);
}

/**
 * Keep an open mailbox current without a long-poll.
 * Web push wakes the tab immediately; coming back to the tab refreshes once;
 * a 30s tick covers inboxes that do not have notifications enabled.
 */
export function startMailboxLiveSync(invalidate: () => Promise<void>): () => void {
	if (typeof document === 'undefined') return () => {};

	let refreshing = false;

	const refresh = async () => {
		if (document.visibilityState !== 'visible' || refreshing) return;
		refreshing = true;
		try {
			await invalidate();
			window.dispatchEvent(new Event(MAIL_CHANGED_MESSAGE));
		} finally {
			refreshing = false;
		}
	};

	const onVisibility = () => {
		if (document.visibilityState === 'visible') void refresh();
	};
	const onPageShow = (event: PageTransitionEvent) => {
		if (event.persisted) void refresh();
	};
	const onMessage = (event: MessageEvent) => {
		if (isMailChangedMessage(event.data)) void refresh();
	};

	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('online', refresh);
	window.addEventListener('pageshow', onPageShow);
	navigator.serviceWorker?.addEventListener('message', onMessage);

	const interval = window.setInterval(() => {
		if (document.visibilityState === 'visible') void refresh();
	}, MAILBOX_IDLE_REFRESH_MS);

	return () => {
		window.clearInterval(interval);
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('online', refresh);
		window.removeEventListener('pageshow', onPageShow);
		navigator.serviceWorker?.removeEventListener('message', onMessage);
	};
}
