<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { DialogUserOnboarding, SidebarNavigation } from '$lib/components/app';
	import DialogExperience from '$lib/components/app/dialogs/DialogExperience.svelte';
	import DialogModelVision from '$lib/components/app/dialogs/DialogModelVision.svelte';
	import { imageGenStore } from '$lib/stores/imagegen.svelte';
	import ImageGenOverlay from '$lib/components/app/misc/ImageGenOverlay.svelte';
	import DialogScheduleMessage from '$lib/components/app/dialogs/DialogScheduleMessage.svelte';
	import { scheduledStore } from '$lib/stores/scheduled.svelte';
	import ReasoningSidePanel from '$lib/components/app/chat/ChatMessages/ReasoningSidePanel.svelte';
	import AppearanceBackground from '$lib/components/app/appearance/AppearanceBackground.svelte';
	import WelcomeScreen from '$lib/components/app/misc/WelcomeScreen.svelte';
	import WelcomeScreenModern from '$lib/components/app/misc/WelcomeScreenModern.svelte';
	import { PwaMetaTags, PwaRefreshAlert } from '$lib/components/pwa';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		FAVICON_PATHS,
		FAVICON_SELECTORS,
		HEADERS,
		NEW_CHAT_TAB_ID,
		ROUTES,
		SETTINGS_KEYS,
		TOOLTIP_DELAY_DURATION
	} from '$lib/constants';
	import { useKeyboardShortcuts } from '$lib/hooks/use-keyboard-shortcuts.svelte';
	import { usePwa } from '$lib/hooks/use-pwa.svelte';
	import { RouterService } from '$lib/services/router.service';
	import {
		chatStore,
		conversationsStore,
		deviceStore,
		mcpStore,
		modelsStore,
		serverStore,
		settingsStore,
		tabsStore,
		versionStore
	} from '$lib/stores';
	import { initStores } from '$lib/stores/init';
	import { ModeWatcher } from 'mode-watcher';
	import { untrack } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { pwaAssetsHead } from 'virtual:pwa-assets/head';

	let { children } = $props();

	// migrations and store startup, ordered explicitly instead of import side effects
	void initStores();

	let showExperience = $state(false);
	// only people who start fresh are asked; existing installs keep everything (Free)
	let askExperience = $state(false);

	$effect(() => {
		if (askExperience && !showOnboarding) {
			askExperience = false;
			showExperience = true;
		}
	});

	let innerHeight = $state<number | undefined>();
	let innerWidth = $state(browser ? window.innerWidth : 0);

	let chatSidebar:
		| {
				activateSearchMode?: () => void;
				editActiveConversation?: () => void;
		  }
		| undefined = $state();

	let showBuildVersion = $derived(
		settingsStore.config[SETTINGS_KEYS.SHOW_BUILD_VERSION] as boolean
	);

	// Keep the hook object intact: destructuring needRefreshByStorage reads the getter once and freezes it
	const pwa = usePwa();
	const { needRefresh, updateServiceWorker } = pwa;

	function updateFavicon() {
		const dark = deviceStore.systemTheme.isDark;

		let icoLink = document.querySelector(FAVICON_SELECTORS.ICO_48X48) as HTMLLinkElement | null;

		if (icoLink) {
			icoLink.href = dark ? FAVICON_PATHS.ICO_DARK : FAVICON_PATHS.ICO_LIGHT;
		}

		let svgLink = document.querySelector(FAVICON_SELECTORS.SVG_ANY) as HTMLLinkElement | null;

		if (svgLink) {
			svgLink.href = dark ? FAVICON_PATHS.SVG_DARK : FAVICON_PATHS.SVG_LIGHT;
		}
	}

	function navigateToTab(direction: -1 | 1) {
		// only makes sense with conversation tabs enabled
		if (!settingsStore.config.conversationTabs) return;

		const openTabs = tabsStore.openTabs;

		if (openTabs.length === 0) return;

		const activeId = page.params.id ?? NEW_CHAT_TAB_ID;
		const idx = openTabs.indexOf(activeId);
		// active tab not in list (e.g. a non-chat route): start from an edge
		const targetIdx =
			idx === -1
				? direction === 1
					? 0
					: openTabs.length - 1
				: (idx + direction + openTabs.length) % openTabs.length;

		void tabsStore.activate(openTabs[targetIdx]);
	}

	function navigateToConversation(direction: -1 | 1) {
		const allConvs = conversationsStore.conversations;

		if (allConvs.length === 0) return;

		const currentId = page.params.id;

		if (!currentId) {
			goto(RouterService.chat(allConvs[direction === 1 ? 0 : allConvs.length - 1].id));

			return;
		}

		const idx = allConvs.findIndex((c) => c.id === currentId);

		if (idx === -1) return;

		const targetIdx = idx + direction;

		if (targetIdx >= 0 && targetIdx < allConvs.length) {
			goto(RouterService.chat(allConvs[targetIdx].id));
		} else {
			conversationsStore.openNewChat();
		}
	}

	// navigating away from the new-chat screen drops its tab, so it does not
	// linger once the user moves to a real conversation or another route
	let previousChatId = $state<string | undefined>(undefined);

	$effect(() => {
		const id = page.params.id ?? (page.route.id === '/(chat)' ? NEW_CHAT_TAB_ID : undefined);
		const prev = untrack(() => previousChatId);

		previousChatId = id;

		if (id !== prev && prev && settingsStore.config.conversationTabs && prev === NEW_CHAT_TAB_ID) {
			untrack(() => tabsStore.removeTabs([NEW_CHAT_TAB_ID]));
		}
	});
	// Global keyboard shortcuts
	const { handleKeydown } = useKeyboardShortcuts({
		editActiveConversation: () => chatSidebar?.editActiveConversation?.(),
		navigateToNextConversation: () => navigateToConversation(1),
		navigateToNextTab: () => navigateToTab(1),
		navigateToPrevConversation: () => navigateToConversation(-1),
		navigateToPrevTab: () => navigateToTab(-1)
	});

	function checkApiKey() {
		const apiKey = settingsStore.config.apiKey;

		// Without a stored key there is nothing to re-validate here; the keyless
		// 401 case is handled by validateApiKey() at navigation time, and the
		// reload below must never fire in a keyless loop.
		if (!apiKey || apiKey.trim() === '') {
			return;
		}

		untrack(() => {
			if (
				(page.route.id === '/(chat)' || page.route.id === '/(chat)/chat/[id]') &&
				page.status !== 401 &&
				page.status !== 403
			) {
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					[HEADERS.AUTHORIZATION]: `${HEADERS.BEARER}${apiKey.trim()}`
				};

				fetch(`${base}/props`, { headers })
					.then((response) => {
						if (response.status === 401 || response.status === 403) {
							window.location.reload();
						}
					})
					.catch((e) => {
						console.error('Error checking API key:', e);
					});
			}
		});
	}

	let showOnboarding = $state(false);

	// Welcome screen: once per browser session, on the start page, after a profile exists.
	// It covers the screen right away (no flash of the start page); its content appears as soon
	// as the characters are loaded.
	const WELCOME_SESSION_KEY = 'Knome.welcomeShown';
	let showWelcome = $state(false);

	$effect(() => {
		document.documentElement.dataset.inputStyle =
			(settingsStore.config[SETTINGS_KEYS.INPUT_STYLE] as string) === 'classic'
				? 'classic'
				: 'modern';
	});

	// "Modern AI writing style": links get a small icon + the site name (no network requests)
	$effect(() => {
		const on = settingsStore.config[SETTINGS_KEYS.MODERN_WRITING] !== false;

		document.documentElement.dataset.modernWriting = on ? 'on' : 'off';

		if (!on) return;

		let queued = false;
		const decorate = () => {
			queued = false;
			document
				.querySelectorAll<HTMLAnchorElement>('.markdown-content a[href^="http"]:not([data-kn-initial])')
				.forEach((a) => {
					try {
						const host = new URL(a.href).hostname.replace(/^www\./, '');
						const label = (a.textContent ?? '').trim().replace(/^www\./, '');

						a.dataset.knInitial = (host[0] ?? '?').toUpperCase();
						// show the site name unless the link text already is that
						if (label !== host && !label.includes(host)) a.dataset.knHost = host;
					} catch {
						/* not a valid URL */
					}
				});
		};
		const obs = new MutationObserver(() => {
			if (queued) return;

			queued = true;
			requestAnimationFrame(decorate);
		});

		obs.observe(document.body, { childList: true, subtree: true });
		decorate();

		return () => obs.disconnect();
	});

	onMount(() => {
		void imageGenStore.init();
		// one-time: open the wide sidebar for everyone who updates (they can collapse it again)
		try {
			if (!localStorage.getItem('Knome.sidebarDocked')) {
				settingsStore.updateConfig(SETTINGS_KEYS.ALWAYS_SHOW_SIDEBAR_ON_DESKTOP, true);
				localStorage.setItem('Knome.sidebarDocked', '1');
			}
		} catch {
			/* storage unavailable */
		}

		updateFavicon();
		scheduledStore.start();
		// snapshot of every backend running stream on first load, populates the sidebar spinners
		// so the user sees each conv that has a live inference, even ones not opened yet
		void chatStore.syncRemoteRunningStreams();

		if (!settingsStore.config[SETTINGS_KEYS.PROFILE_ONBOARDING_DONE]) {
			showOnboarding = true;
			askExperience = true;
			// the first-run profile dialog is welcome enough for this session
			sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
		} else if (
			settingsStore.config[SETTINGS_KEYS.WELCOME_SCREEN] !== false &&
			!sessionStorage.getItem(WELCOME_SESSION_KEY)
		) {
			const hash = window.location.hash;

			// only when Knome opens on the start page, never on top of a chat the user came back to
			if (hash === '' || hash === '#' || hash === '#/') showWelcome = true;
		}

		sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
	});

	// refresh that snapshot when the tab returns to the foreground, a stream may have advanced
	// or ended while it was hidden. snapshot only, no polling
	function handleVisibilityChange() {
		if (document.visibilityState !== 'visible') return;

		void chatStore.syncRemoteRunningStreams();
	}

	$effect(() => {
		void deviceStore.systemTheme.isDark;

		updateFavicon();
	});

	// Initialize server properties on app load (run once)
	$effect(() => {
		// Only fetch if we don't already have props
		if (!serverStore.props) {
			untrack(() => {
				serverStore.fetch();
			});
		}
	});

	// Sync settings when server props are loaded
	$effect(() => {
		const serverProps = serverStore.props;

		if (serverProps) {
			untrack(() => {
				settingsStore.syncWithServerDefaults();
			});
		}
	});

	// Inject custom CSS at runtime through an action on the head style node
	// textContent keeps the value as text, never parsed as HTML
	function customCss(node: HTMLStyleElement) {
		$effect(() => {
			node.textContent = (settingsStore.config.customCss as string | undefined) ?? '';
		});
	}

	// Fetch router models when in router mode (for status and modalities)
	// Wait for models to be loaded first, run only once
	let routerModelsFetched = false;

	$effect(() => {
		const isRouter = serverStore.isRouterMode;
		const modelsCount = modelsStore.models.length;

		// Only fetch router models once when we have models loaded and in router mode
		if (isRouter && modelsCount > 0 && !routerModelsFetched) {
			routerModelsFetched = true;

			untrack(() => {
				modelsStore.fetchRouterModels();
			});
		}
	});

	// Live model status and load progress via the /models/sse feed (router mode)
	$effect(() => {
		if (!browser) return;

		if (!serverStore.isRouterMode) return;

		untrack(() => {
			modelsStore.status.subscribe();
		});

		return () => {
			modelsStore.status.unsubscribe();
		};
	});

	// Background MCP server health checks on app load.
	// Health-check every configured server with a URL - including disabled ones -
	// so the /mcp-servers page can display health metadata for servers that are
	// currently turned off. Disabled servers never get promoted to active
	// connections (see runHealthCheck), so their tools/prompts/resources stay
	// out of the chat-side stores.
	// Only IDLE servers are checked; already-resolved (SUCCESS / ERROR) servers
	// keep their existing state, so adding or removing a server does not flash
	// every other card back through skeleton state.
	$effect(() => {
		if (!browser) return;

		const mcpServers = mcpStore.getServers();
		const serversWithUrls = mcpServers.filter((s) => s.url.trim());

		if (serversWithUrls.length > 0) {
			untrack(() => {
				// Run health checks in background (don't await)
				mcpStore.runHealthChecksForServers(serversWithUrls, true).catch((error) => {
					console.warn('[layout] MCP health checks failed:', error);
				});
			});
		}
	});

	// Monitor API key changes and redirect to error page if removed or changed when required
	$effect(() => {
		checkApiKey();
	});
</script>

<svelte:head>
	{#if pwaAssetsHead.themeColor}
		<meta content={pwaAssetsHead.themeColor.content} name="theme-color" />
	{/if}

	{#if settingsStore.config.customCss}
		<style use:customCss></style>
	{/if}

	{#each pwaAssetsHead.links as link (link.href)}
		<link {...link} />
	{/each}

	<PwaMetaTags />
</svelte:head>

<svelte:window bind:innerHeight bind:innerWidth onkeydown={handleKeydown} />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<Tooltip.Provider delayDuration={TOOLTIP_DELAY_DURATION}>
	<div class="flex flex-col md:flex-row">
		<SidebarNavigation
			onSearchClick={() => {
				if (deviceStore.isMobile) {
					goto(ROUTES.SEARCH);
				} else if (chatSidebar?.activateSearchMode) {
					chatSidebar.activateSearchMode();
				}
			}}
		/>

		<div class="flex-1">
			{@render children?.()}
		</div>
	</div>

	<AppearanceBackground />

	<ReasoningSidePanel />

	<DialogUserOnboarding bind:open={showOnboarding} />

	{#if showWelcome}
		{#if settingsStore.config[SETTINGS_KEYS.WELCOME_STYLE] === 'classic'}
			<WelcomeScreen onDone={() => (showWelcome = false)} />
		{:else}
			<WelcomeScreenModern onDone={() => (showWelcome = false)} />
		{/if}
	{/if}

	<ModeWatcher />

	<Toaster richColors />
	<DialogScheduleMessage />
	<ImageGenOverlay />
	<DialogModelVision />
	<DialogExperience bind:open={showExperience} />
</Tooltip.Provider>

<!-- PWA update prompt + version -->
<div class="fixed right-4 bottom-4 z-9999 flex flex-col items-end gap-1">
	{#if showBuildVersion && versionStore.build}
		<span class="text-[10px] tabular-nums text-muted-foreground">{versionStore.build}</span>
	{/if}

	<PwaRefreshAlert
		forceReload={pwa.needRefreshByStorage}
		needRefresh={$needRefresh || pwa.needRefreshByStorage}
		{updateServiceWorker}
	/>
</div>
