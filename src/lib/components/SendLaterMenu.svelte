<script lang="ts">
	import { page } from '$app/stores';
	import { menuPosition, portal } from '$lib/actions/portal';
	import { t } from '$lib/i18n';
	import { presetAt, toDatetimeLocalValue, type SchedulePresetId } from '$lib/mail/schedule';
	import { formatFullDate } from '$lib/utils/date';
	import Icon from './Icon.svelte';

	let {
		onPick,
		disabled = false
	}: {
		onPick: (until: Date) => void;
		disabled?: boolean;
	} = $props();

	let open = $state(false);
	let trigger = $state<HTMLButtonElement | undefined>();
	let menuEl = $state<HTMLDivElement | undefined>();
	let top = $state(0);
	let left = $state(0);
	let maxHeight = $state(320);
	let custom = $state(toDatetimeLocalValue(presetAt('tomorrow')));

	const presets = $derived(
		(['later_today', 'tomorrow', 'next_week'] as const).map((id) => ({
			id,
			at: presetAt(id),
			label:
				id === 'later_today'
					? t('mailbox.laterToday')
					: id === 'tomorrow'
						? t('mailbox.tomorrow')
						: t('mailbox.nextWeek')
		}))
	);

	function place() {
		const next = menuPosition(trigger, menuEl, 'auto');
		top = next.top;
		left = next.left;
		maxHeight = next.maxHeight;
	}

	function toggle(event: MouseEvent) {
		event.stopPropagation();
		if (disabled) return;
		open = !open;
	}

	$effect(() => {
		if (!open) return;
		place();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') open = false;
		};
		window.addEventListener('resize', place);
		window.addEventListener('scroll', place, true);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('resize', place);
			window.removeEventListener('scroll', place, true);
			window.removeEventListener('keydown', onKey);
		};
	});

	function choose(id: SchedulePresetId) {
		open = false;
		onPick(presetAt(id));
	}

	function chooseCustom() {
		const at = new Date(custom);
		if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return;
		open = false;
		onPick(at);
	}
</script>

<div class="later">
	<button
		bind:this={trigger}
		type="button"
		class="later-btn"
		title={t('compose.sendLater')}
		aria-label={t('compose.sendLater')}
		aria-expanded={open}
		aria-haspopup="menu"
		{disabled}
		onclick={toggle}
	>
		<Icon name="time-line" size={16} />
	</button>
</div>

{#if open}
	<div use:portal>
		<button type="button" class="backdrop" aria-label={t('common.close')} onclick={() => (open = false)}
		></button>
		<div
			bind:this={menuEl}
			class="menu"
			role="menu"
			style:top="{top}px"
			style:left="{left}px"
			style:max-height="{maxHeight}px"
		>
			<p class="heading">{t('compose.scheduleSend')}</p>
			{#each presets as preset (preset.id)}
				<button type="button" class="menu-item" onclick={() => choose(preset.id)}>
					<span>{preset.label}</span>
					<span class="when">{formatFullDate(preset.at.toISOString(), $page.data.locale)}</span>
				</button>
			{/each}
			<label class="custom">
				<span>{t('mailbox.pickDateTime')}</span>
				<input type="datetime-local" bind:value={custom} />
				<button type="button" class="apply" onclick={chooseCustom}>{t('common.send')}</button>
			</label>
		</div>
	</div>
{/if}

<style>
	.later {
		display: inline-flex;
	}

	.later-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		color: var(--color-text-secondary);
	}

	.later-btn:hover:not(:disabled) {
		background: var(--color-surface-muted);
		color: var(--color-text);
	}

	.later-btn:disabled {
		opacity: 0.4;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 110;
		background: transparent;
	}

	.menu {
		position: fixed;
		z-index: 111;
		min-width: 16rem;
		max-width: calc(100vw - 1rem);
		overflow: auto;
		padding: 0.25rem;
		background: var(--color-surface, #ffffff);
		color: var(--color-text, #171717);
		border: 1px solid var(--color-line, rgba(0, 0, 0, 0.08));
		border-radius: 0.75rem;
		box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.16));
	}

	.heading {
		padding: 0.375rem 0.625rem 0.125rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.menu-item,
	.custom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary, #525252);
		text-align: left;
	}

	.menu-item:hover {
		background: var(--color-surface-muted, #f5f5f5);
		color: var(--color-text, #171717);
	}

	.when {
		color: var(--color-muted);
		white-space: nowrap;
	}

	.custom {
		flex-wrap: wrap;
	}

	.custom input {
		flex: 1;
		min-width: 10rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.375rem;
		box-shadow: inset 0 0 0 1px var(--color-line);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.apply {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-accent-text, #4f6b58);
	}
</style>
