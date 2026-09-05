<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { portal } from '$lib/actions/portal';
	import { t } from '$lib/i18n';
	import { runMailAction } from '$lib/mail/client';
	import { clearUndoSend, undoSendToast } from '$lib/mail/undo-toast';

	let remaining = $state(0);
	let busy = $state(false);

	$effect(() => {
		const toast = $undoSendToast;
		if (!toast) {
			remaining = 0;
			return;
		}

		const tick = () => {
			const left = Math.ceil((Date.parse(toast.undoUntil) - Date.now()) / 1000);
			if (left <= 0) {
				clearUndoSend();
				void invalidateAll();
				return;
			}
			remaining = left;
		};

		tick();
		const id = window.setInterval(tick, 250);
		return () => window.clearInterval(id);
	});

	async function undo() {
		const toast = $undoSendToast;
		if (!toast || busy) return;
		busy = true;
		try {
			await runMailAction('unschedule', [toast.emailId]);
			clearUndoSend();
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

{#if $undoSendToast && remaining > 0}
	<div class="toast" use:portal role="status">
		<span>{t('compose.sendingIn', { seconds: remaining })}</span>
		<button type="button" onclick={undo} disabled={busy}>{t('compose.undoSend')}</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		right: 1rem;
		bottom: calc(1rem + env(safe-area-inset-bottom));
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.7rem 0.7rem 1rem;
		border-radius: 0.75rem;
		background: #171717;
		color: #f5f5f5;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
		font-size: 0.875rem;
	}

	button {
		flex-shrink: 0;
		min-height: 2rem;
		padding: 0 0.75rem;
		border-radius: 0.5rem;
		font-weight: 650;
		color: var(--color-on-accent, #14231a);
		background: var(--color-accent, #90ac9a);
	}

	button:hover:not(:disabled) {
		background: var(--color-accent-hover, #7f9c89);
	}

	button:disabled {
		opacity: 0.5;
	}

	@media (max-width: 900px) {
		.toast {
			left: 1rem;
			right: 1rem;
			bottom: calc(4.25rem + env(safe-area-inset-bottom));
			justify-content: space-between;
		}
	}
</style>
