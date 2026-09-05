<script lang="ts">
	import { page } from '$app/stores';
	import AddressSwitcher from '$lib/components/AddressSwitcher.svelte';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { mailboxInitials } from '$lib/mail/switch-mailbox';
	import { initials } from '$lib/mail/folders';
	import { setThemePreference } from '$lib/theme';
	import { t } from '$lib/i18n';
	import type { ThemeShellData } from '$lib/ui-theme/types';
	import Icon from './icons/Icon.svelte';

	let {
		data,
		collapsed,
		onLogout
	}: {
		data: ThemeShellData;
		collapsed: boolean;
		onLogout: () => Promise<void>;
	} = $props();

	let menuOpen = $state(false);
	let localeOpen = $state(false);
	let darkMode = $state(false);

	$effect(() => {
		darkMode = document.documentElement.dataset.theme === 'dark';
	});

	const filteredId = $derived($page.url.searchParams.get('address'));
	const active = $derived(
		data.addresses.find((address) => address.id === filteredId) ??
			data.addresses.find((address) => address.is_default) ??
			data.addresses[0] ??
			null
	);
	const avatarLabel = $derived(
		active ? mailboxInitials(active) : initials(data.user.name || data.user.email)
	);

	function closeMenus() {
		menuOpen = false;
		localeOpen = false;
	}

	function toggleMode() {
		const next = darkMode ? 'light' : 'dark';
		setThemePreference(next);
		darkMode = next === 'dark';
		closeMenus();
	}

	function onDocPointer(event: PointerEvent) {
		const target = event.target as HTMLElement | null;
		if (!target?.closest('.z-account')) closeMenus();
	}
</script>

<svelte:window onpointerdown={onDocPointer} />

<div class="z-account" class:collapsed>
	{#if collapsed}
		<Tooltip text={active?.address ?? data.user.email} enabled={!menuOpen}>
			<button
				type="button"
				class="z-collapsed-avatar"
				aria-label={t('account.menu')}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{avatarLabel}
			</button>
		</Tooltip>
	{:else}
		<div class="z-account-row">
			<AddressSwitcher
				addresses={data.addresses}
				activeDomainId={data.activeDomainId}
				accountName={data.user.name}
				block
			/>
			<div class="z-account-actions">
				<LocaleSwitcher
					bind:open={localeOpen}
					onOpen={() => {
						menuOpen = false;
					}}
				/>
				<Tooltip text={t('account.menu')} enabled={!menuOpen}>
					<button
						type="button"
						class="z-dots"
						aria-label={t('account.menu')}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						onclick={() => {
							localeOpen = false;
							menuOpen = !menuOpen;
						}}
					>
						<Icon name="ThreeDots" size={16} />
					</button>
				</Tooltip>
			</div>
		</div>
	{/if}

	{#if menuOpen}
		<div class="z-menu z-account-menu">
			{#if collapsed}
				<AddressSwitcher
					addresses={data.addresses}
					activeDomainId={data.activeDomainId}
					accountName={data.user.name}
					embedded
					onClose={closeMenus}
				/>
				<LocaleSwitcher embedded />
			{/if}
			<a href="/settings/general" onclick={closeMenus}>
				<Icon name="SettingsGear" size={16} />
				{t('nav.settings')}
			</a>
			<button type="button" onclick={toggleMode}>
				{#if darkMode}
					<Icon name="Sun" size={16} />
					{t('account.lightMode')}
				{:else}
					<Icon name="Moon" size={16} />
					{t('account.darkMode')}
				{/if}
			</button>
			<button type="button" class="logout" onclick={() => onLogout()}>
				<Icon name="ArrowLeft" size={16} />
				{t('nav.logOut')}
			</button>
		</div>
	{/if}
</div>
