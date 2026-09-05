<script lang="ts">
	import { page } from '$app/stores';
	import { menuPosition, portal } from '$lib/actions/portal';
	import { t } from '$lib/i18n';
	import { presetAt, toDatetimeLocalValue, type SchedulePresetId } from '$lib/mail/schedule';
	import { formatFullDate } from '$lib/utils/date';
	import Icon from './Icon.svelte';

	let {
		onPick,
		label = t('mailbox.snooze'),
		compact = false
	}: {
		onPick: (until: Date) => void;
		label?: string;
		compact?: boolean;
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
		const next = menuPosition(trigger, menuEl);
		top = next.top;
		left = next.left;
		maxHeight = next.maxHeight;
	}

	function toggle(event: MouseEvent) {
		event.stopPropagation();
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

<div class="snooze">
	<button
		bind:this={trigger}
		type="button"
		class={compact ? 'tool-btn' : 'btn-ghost'}
		title={label}
		aria-label={label}
		aria-expanded={open}
		aria-haspopup="menu"
		onclick={toggle}
	>
		<Icon name="time-line" size={16} />
		{#if !compact}<span>{label}</span>{/if}
	</button>
</div>

{#if open}
	<div class="layer" use:portal>
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
			{#each presets as preset (preset.id)}
				<button type="button" class="menu-item" onclick={() => choose(preset.id)}>
					<span>{preset.label}</span>
					<span class="when">{formatFullDate(preset.at.toISOString(), $page.data.locale)}</span>
				</button>
			{/each}
			<label class="custom">
				<span>{t('mailbox.pickDateTime')}</span>
				<input type="datetime-local" bind:value={custom} />
				<button type="button" class="apply" onclick={chooseCustom}>{t('common.done')}</button>
			</label>
		</div>
	</div>
{/if}

<style>
	.snooze {
		display: inline-flex;
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
		color: var(--color-text-secondary);
		text-align: left;
	}

	.menu-item:hover {
		background: var(--color-surface-muted);
		color: var(--color-text);
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
		color: var(--color-accent-text);
	}

	.tool-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		border-radius: 0.5rem;
		color: var(--color-text-secondary);
	}

	.tool-btn:hover {
		background: var(--color-surface-muted);
		color: var(--color-text);
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
</style>
