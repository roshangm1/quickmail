<script lang="ts">
	import { page } from '$app/stores';
	import { menuPosition, portal, type MenuPlacement } from '$lib/actions/portal';
	import { t } from '$lib/i18n';
	import { presetAt, toDatetimeLocalValue, type SchedulePresetId } from '$lib/mail/schedule';
	import { formatFullDate } from '$lib/utils/date';
	import Icon from '../icons/Icon.svelte';
	import type { ZeroIconName } from '../icons/names';

	let {
		title,
		onPick,
		icon = 'Clock',
		label,
		prefer = 'auto'
	}: {
		title: string;
		onPick: (until: Date) => void;
		icon?: ZeroIconName;
		label?: string;
		prefer?: MenuPlacement;
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
		const next = menuPosition(trigger, menuEl, prefer);
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

<div class="z-schedule">
	<button
		bind:this={trigger}
		type="button"
		class="z-schedule-btn z-text-btn"
		title={title}
		aria-label={title}
		aria-expanded={open}
		aria-haspopup="menu"
		onclick={toggle}
	>
		<Icon name={icon} size={14} />
		{#if label}<span>{label}</span>{/if}
	</button>
</div>

{#if open}
	<div class="z-schedule-layer" use:portal>
		<button
			type="button"
			class="z-schedule-scrim"
			aria-label={t('common.close')}
			onclick={() => (open = false)}
		></button>
		<div
			bind:this={menuEl}
			class="z-schedule-menu"
			role="menu"
			style:top="{top}px"
			style:left="{left}px"
			style:max-height="{maxHeight}px"
		>
			<p class="z-schedule-title">{title}</p>
			{#each presets as preset (preset.id)}
				<button type="button" role="menuitem" onclick={() => choose(preset.id)}>
					<span>{preset.label}</span>
					<span>{formatFullDate(preset.at.toISOString(), $page.data.locale)}</span>
				</button>
			{/each}
			<label>
				<span>{t('mailbox.pickDateTime')}</span>
				<input type="datetime-local" bind:value={custom} />
				<button type="button" onclick={chooseCustom}>{t('common.done')}</button>
			</label>
		</div>
	</div>
{/if}

<style>
	.z-schedule {
		display: inline-flex;
	}

	.z-schedule-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.z-schedule-scrim {
		position: fixed;
		inset: 0;
		z-index: 110;
		background: transparent;
	}

	.z-schedule-menu {
		position: fixed;
		z-index: 111;
		min-width: 16rem;
		max-width: calc(100vw - 1rem);
		overflow: auto;
		padding: 0.35rem;
		border-radius: 0.75rem;
		border: 1px solid var(--z-border, #e7e7e7);
		background: var(--z-chip, #ffffff);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		color: var(--z-fg, #171717);
	}

	.z-schedule-title {
		padding: 0.35rem 0.55rem 0.15rem;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--z-muted, #737373);
	}

	.z-schedule-menu button[role='menuitem'],
	.z-schedule-menu label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0.45rem 0.55rem;
		border-radius: 0.5rem;
		border: none;
		background: none;
		font-size: 0.8125rem;
		text-align: left;
		color: inherit;
		cursor: pointer;
	}

	.z-schedule-menu button[role='menuitem']:hover {
		background: var(--z-hover, #f5f5f5);
	}

	.z-schedule-menu input {
		flex: 1;
		min-width: 9rem;
		padding: 0.2rem 0.35rem;
		border-radius: 0.375rem;
		border: 1px solid var(--z-border, #e7e7e7);
		background: var(--z-panel, #fff);
		color: inherit;
	}

	.z-schedule-menu label {
		flex-wrap: wrap;
		cursor: default;
	}
</style>
