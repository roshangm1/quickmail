<script lang="ts">
	import { page } from '$app/stores';
	import { haptic } from '$lib/app-chrome';
	import { t } from '$lib/i18n';
	import {
		applyMailboxFilter,
		mailboxInitials,
		mailboxSubtitle,
		mailboxTitle
	} from '$lib/mail/switch-mailbox';
	import type { MailAddress } from '$lib/types';
	import Icon from './Icon.svelte';

	let {
		addresses,
		activeDomainId,
		collapsed = false,
		block = false,
		embedded = false,
		accountName = '',
		onClose
	}: {
		addresses: MailAddress[];
		activeDomainId: string | null;
		collapsed?: boolean;
		block?: boolean;
		embedded?: boolean;
		accountName?: string;
		onClose?: () => void;
	} = $props();

	let open = $state(false);
	let switching = $state(false);

	const filteredId = $derived($page.url.searchParams.get('address'));
	const viewingAll = $derived(!filteredId);
	const active = $derived(
		addresses.find((address) => address.id === filteredId) ??
			addresses.find((address) => address.is_default) ??
			addresses[0] ??
			null
	);
	const triggerTitle = $derived(
		viewingAll && addresses.length > 1
			? t('account.allMailboxes')
			: active
				? mailboxTitle(active)
				: accountName || t('account.account')
	);
	const triggerSubtitle = $derived(
		active ? mailboxSubtitle(active) ?? (viewingAll && addresses.length > 1 ? active.address : null) : null
	);
	const triggerInitials = $derived(
		active ? mailboxInitials(active) : accountName.slice(0, 2).toUpperCase() || '?'
	);

	async function select(address: MailAddress | null) {
		const already =
			address === null ? viewingAll : !viewingAll && address.id === filteredId;
		if (switching || already) {
			open = false;
			onClose?.();
			return;
		}

		haptic(8);
		switching = true;
		open = false;
		onClose?.();
		try {
			await applyMailboxFilter({ address, activeDomainId });
		} finally {
			switching = false;
		}
	}

	function onDocPointer(event: PointerEvent) {
		if (embedded) return;
		const target = event.target as HTMLElement | null;
		if (!target?.closest('.address-switcher')) open = false;
	}
</script>

<svelte:window onpointerdown={onDocPointer} />

{#if addresses.length > 0}
	<div class="address-switcher" class:block class:collapsed class:embedded class:open>
		{#if !embedded}
			<button
				type="button"
				class="trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={t('account.switchMailbox')}
				disabled={switching}
				onclick={() => {
					haptic(8);
					open = !open;
				}}
			>
				<span class="avatar">{triggerInitials}</span>
				{#if !collapsed}
					<span class="meta">
						<span class="title">{triggerTitle}</span>
						{#if triggerSubtitle}
							<span class="subtitle">{triggerSubtitle}</span>
						{/if}
					</span>
					<Icon name="arrow-down-s-line" size={16} />
				{/if}
			</button>
		{/if}

		{#if embedded || open}
			{#if !embedded && open}
				<button
					type="button"
					class="backdrop"
					aria-label={t('account.closeMenu')}
					onclick={() => (open = false)}
				></button>
			{/if}
			<div class="menu" class:menu-embedded={embedded} role="listbox" aria-label={t('account.switchMailbox')}>
				{#if !embedded}
					<div class="sheet-handle" aria-hidden="true"></div>
					<p class="menu-label">{t('account.switchMailbox')}</p>
				{/if}

				{#if addresses.length > 1}
					<button
						type="button"
						role="option"
						class="item"
						class:selected={viewingAll}
						aria-selected={viewingAll}
						onclick={() => select(null)}
					>
						<span class="avatar all">
							<Icon name="inbox-line" size={14} />
						</span>
						<span class="item-copy">
							<strong>{t('account.allMailboxes')}</strong>
							<small>{t('account.allMailboxesHint')}</small>
						</span>
						{#if viewingAll}<Icon name="check-line" size={16} />{/if}
					</button>
				{/if}

				{#each addresses as address (address.id)}
					{@const selected = !viewingAll && address.id === filteredId}
					<button
						type="button"
						role="option"
						class="item"
						class:selected
						aria-selected={selected}
						onclick={() => select(address)}
					>
						<span class="avatar">{mailboxInitials(address)}</span>
						<span class="item-copy">
							<strong>{mailboxTitle(address)}</strong>
							{#if mailboxSubtitle(address)}
								<small>{mailboxSubtitle(address)}</small>
							{:else if address.is_default}
								<small>{t('common.default')}</small>
							{/if}
						</span>
						{#if selected}<Icon name="check-line" size={16} />{/if}
					</button>
				{/each}

				<a href="/settings/connections" class="item add" onclick={() => (open = false)}>
					<span class="avatar add-avatar">
						<Icon name="add-line" size={16} />
					</span>
					<span class="item-copy">
						<strong>{t('account.addAddress')}</strong>
					</span>
				</a>
			</div>
		{/if}
	</div>
{/if}

<style>
	.address-switcher {
		position: relative;
		min-width: 0;
	}

	.address-switcher.block,
	.address-switcher.block .trigger {
		width: 100%;
	}

	.trigger {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		min-width: 0;
		padding: 0.375rem 0.5rem;
		border: none;
		border-radius: 0.75rem;
		background: var(--color-surface-muted, var(--z-hover, transparent));
		color: var(--color-text, var(--z-fg, inherit));
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.trigger:hover:not(:disabled) {
		background: var(--color-surface-hover, var(--z-hover));
	}

	.trigger:disabled {
		opacity: 0.65;
	}

	.collapsed .trigger {
		width: 2rem;
		height: 2rem;
		padding: 0;
		justify-content: center;
		border-radius: 0.5rem;
		background: transparent;
	}

	.avatar {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.5rem;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--color-text, var(--z-fg));
		background: var(--color-surface-hover, color-mix(in srgb, var(--z-fg, #111) 10%, transparent));
	}

	.avatar.all,
	.add-avatar {
		color: var(--color-text-secondary, var(--z-muted));
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-line, var(--z-border));
	}

	.meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		line-height: 1.2;
	}

	.title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8125rem;
		font-weight: 550;
	}

	.subtitle {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 0.125rem;
		font-size: 0.6875rem;
		color: var(--color-muted, var(--z-muted, #898989));
	}

	.trigger :global(i) {
		flex-shrink: 0;
		color: var(--color-muted, var(--z-muted));
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		border: none;
		background: transparent;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.375rem);
		left: 0;
		z-index: 50;
		min-width: 16rem;
		max-width: min(20rem, calc(100vw - 1.5rem));
		padding: 0.35rem;
		border-radius: 0.875rem;
		border: 1px solid var(--color-line, var(--z-border));
		background: var(--color-surface, var(--z-panel));
		box-shadow: var(--shadow-md, 0 8px 30px rgba(0, 0, 0, 0.18));
	}

	.menu-embedded {
		position: static;
		min-width: 0;
		max-width: none;
		padding: 0;
		border: none;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}

	.sheet-handle {
		display: none;
	}

	.menu-label {
		padding: 0.35rem 0.55rem 0.25rem;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted, var(--z-muted));
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.5rem 0.55rem;
		border: none;
		border-radius: 0.625rem;
		background: none;
		color: var(--color-text-secondary, var(--z-fg));
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.12s, color 0.12s;
	}

	.item:hover,
	.item.selected {
		background: var(--color-surface-muted, var(--z-hover));
		color: var(--color-text, var(--z-fg));
	}

	.item-copy {
		flex: 1;
		min-width: 0;
	}

	.item-copy strong {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.item-copy small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 0.1rem;
		font-size: 0.6875rem;
		color: var(--color-muted, var(--z-muted));
	}

	.item.add {
		margin-top: 0.125rem;
	}

	@media (max-width: 900px) {
		.trigger {
			min-height: var(--touch-target);
			padding: 0.5rem 0.625rem;
		}

		.collapsed .trigger {
			width: var(--touch-target);
			height: var(--touch-target);
		}

		.backdrop {
			background: var(--color-scrim);
			animation: sheet-fade 180ms ease-out;
		}

		.menu:not(.menu-embedded) {
			position: fixed;
			top: auto;
			right: 0;
			bottom: 0;
			left: 0;
			max-width: none;
			max-height: min(28rem, calc(100dvh - 4rem));
			overflow-y: auto;
			overscroll-behavior: contain;
			padding: 0.5rem 1rem calc(1rem + env(safe-area-inset-bottom));
			border: none;
			border-radius: 1.25rem 1.25rem 0 0;
			animation: sheet-up 220ms cubic-bezier(0.32, 0.72, 0, 1);
		}

		.sheet-handle {
			display: block;
			width: 2.25rem;
			height: 0.25rem;
			margin: 0.25rem auto 0.75rem;
			border-radius: 9999px;
			background: var(--color-line, var(--z-border));
		}

		.item {
			min-height: var(--touch-target);
			padding: 0.625rem 0.75rem;
		}

		.item-copy strong {
			font-size: 0.9375rem;
		}

		.item-copy small {
			font-size: 0.75rem;
		}

		@keyframes sheet-up {
			from {
				transform: translateY(16%);
			}
		}

		@keyframes sheet-fade {
			from {
				opacity: 0;
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.menu:not(.menu-embedded),
			.backdrop {
				animation: none;
			}
		}
	}
</style>
