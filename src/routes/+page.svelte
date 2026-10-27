<!-- @component
  This is a single-page Svelte project that serves as my custom new tab page.
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import favicon from "$lib/assets/favicon.png";
  import History from "$lib/components/History.svelte";
  import PinnedSites from "$lib/components/PinnedSites.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import SystemInfo from "$lib/components/SystemInfo.svelte";
  import Translator from "$lib/components/Translator.svelte";
  import { settings } from "$lib/stores";
  import { onMount } from "svelte";

  let reduceMotion = $state(false);
  let onBattery = $state(false);

  let leftOpen = $state(true);
  let rightOpen = $state(true);

  let showSidebars = $state(false);
  let showBackground = $state(false);
  let showSettings = $state(false);
  let settingsLoadFailed = $state(false);
  let compactWidth = $state(false);
  let collapseSystemInfo = $state(false);
  let collapsePinnedSites = $state(false);
  let showSystemInfoOverlay = $state(false);
  let showPinnedSitesOverlay = $state(false);

  let pageMain: HTMLElement | undefined;
  let centerColumn: HTMLElement | undefined;
  let searchWrap: HTMLElement | undefined;

  const WIDE_BREAKPOINT = 1700;

  function updateWidth() {
    if (!browser) return;

    const wide = window.innerWidth >= WIDE_BREAKPOINT;
    compactWidth = !wide;

    if (wide) {
      leftOpen = true;
      rightOpen = true;
    }
  }

  function toggleLeft() {
    leftOpen = !leftOpen;
  }

  function toggleRight() {
    rightOpen = !rightOpen;
  }

  onMount(() => {
    let disposed = false;
    let mediaQuery: MediaQueryList | undefined;
    let battery: BatteryManager | undefined;

    let animationFrameId: number | undefined;
    let idleCallbackId: number | undefined;
    let idleFallbackId: ReturnType<typeof setTimeout> | undefined;
    let settingsTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let layoutFrameId: number | undefined;
    let wasWide: boolean | undefined;
    let previousViewportHeight = window.innerHeight;

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const updateMotionPreference = (event?: MediaQueryListEvent) => {
      if (event) {
        reduceMotion = event.matches;
      } else if (mediaQuery) {
        reduceMotion = mediaQuery.matches;
      }
    };

    const updateBatteryState = () => {
      if (battery) {
        onBattery = !battery.charging;
      }
    };

    const updateBackgroundVisibility = () => {
      if (!disposed) {
        showBackground = true;
      }
    };

    const updateResponsiveLayout = () => {
      if (disposed || !pageMain || !centerColumn || !searchWrap) return;

      const wide = window.innerWidth >= WIDE_BREAKPOINT;
      compactWidth = !wide;

      if (wide) {
        leftOpen = true;
        rightOpen = true;
      } else if (wasWide === undefined || wasWide) {
        leftOpen = false;
        rightOpen = false;
      }
      wasWide = wide;

      const viewportHeightChanged =
        window.innerHeight !== previousViewportHeight;
      const viewportGrew = window.innerHeight > previousViewportHeight;
      previousViewportHeight = window.innerHeight;

      if (viewportHeightChanged && viewportGrew) {
        collapseSystemInfo = false;
        collapsePinnedSites = false;
        showSystemInfoOverlay = false;
        showPinnedSitesOverlay = false;
      }

      const mainBounds = pageMain.getBoundingClientRect();
      const searchBounds = searchWrap.getBoundingClientRect();
      const visibleBottom = Math.min(window.innerHeight, mainBounds.bottom) - 8;
      const searchFits = searchBounds.bottom <= visibleBottom;

      if (!searchFits) {
        if (!collapseSystemInfo && ($settings.enableSystemInfo ?? true)) {
          collapseSystemInfo = true;
        } else if (!collapsePinnedSites) {
          collapsePinnedSites = true;
        }
      }
    };

    const scheduleResponsiveLayout = () => {
      if (layoutFrameId !== undefined) {
        cancelAnimationFrame(layoutFrameId);
      }
      layoutFrameId = requestAnimationFrame(() => {
        layoutFrameId = undefined;
        updateResponsiveLayout();
      });
    };

    const scheduleBackground = () => {
      if (disposed) return;

      if (typeof idleWindow.requestIdleCallback === "function") {
        idleCallbackId = idleWindow.requestIdleCallback(
          updateBackgroundVisibility,
          { timeout: 100 },
        );
      } else {
        idleFallbackId = setTimeout(updateBackgroundVisibility, 0);
      }
    };

    mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    updateMotionPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMotionPreference);
    } else {
      // Compatibility with older browsers.
      mediaQuery.addListener(updateMotionPreference);
    }

    // Battery Status API is optional and may be unavailable.
    // Keep the page functional when the API is unsupported or rejected.
    const batteryNavigator = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };

    if (typeof batteryNavigator.getBattery === "function") {
      batteryNavigator
        .getBattery()
        .then((result) => {
          if (disposed) return;

          battery = result;
          updateBatteryState();
          battery.addEventListener("chargingchange", updateBatteryState);
        })
        .catch(() => {
          // Battery detection is an optional optimization.
        });
    }

    updateWidth();
    window.addEventListener("resize", updateWidth, { passive: true });
    window.addEventListener("resize", scheduleResponsiveLayout, {
      passive: true,
    });

    const resizeObserver = new ResizeObserver(scheduleResponsiveLayout);
    if (pageMain) resizeObserver.observe(pageMain);
    if (centerColumn) resizeObserver.observe(centerColumn);
    if (searchWrap) resizeObserver.observe(searchWrap);
    scheduleResponsiveLayout();

    animationFrameId = requestAnimationFrame(() => {
      if (disposed) return;

      showSidebars = true;
      scheduleBackground();

      settingsTimeoutId = setTimeout(() => {
        if (!disposed) {
          showSettings = true;
        }
      }, 100);
    });

    return () => {
      disposed = true;

      window.removeEventListener("resize", updateWidth);
      window.removeEventListener("resize", scheduleResponsiveLayout);
      resizeObserver.disconnect();

      if (typeof mediaQuery?.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateMotionPreference);
      } else {
        mediaQuery?.removeListener(updateMotionPreference);
      }

      battery?.removeEventListener("chargingchange", updateBatteryState);

      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId);
      }

      if (idleCallbackId !== undefined) {
        idleWindow.cancelIdleCallback?.(idleCallbackId);
      }

      if (idleFallbackId !== undefined) {
        clearTimeout(idleFallbackId);
      }

      if (settingsTimeoutId !== undefined) {
        clearTimeout(settingsTimeoutId);
      }

      if (layoutFrameId !== undefined) {
        cancelAnimationFrame(layoutFrameId);
      }
    };
  });

  type BatteryManager = EventTarget & {
    charging: boolean;
  };
</script>

<svelte:head>
  <title>New Tab</title>
  <meta name="description" content="" />
  <link rel="icon" type="image/png" href={favicon} />

  <link
    rel="preconnect"
    href="https://www.google.com"
    crossorigin="anonymous"
  />

  <link rel="dns-prefetch" href="https://www.google.com" />
  <link rel="dns-prefetch" href="https://duckduckgo.com" />
  <link rel="dns-prefetch" href="https://www.youtube.com" />
  <link rel="dns-prefetch" href="https://scholar.google.com" />
  <link rel="dns-prefetch" href="https://www.wolframalpha.com" />
  <link rel="dns-prefetch" href="https://chatgpt.com" />
</svelte:head>

{#if showBackground}
  <div id="lt-bg" aria-hidden="true" class:no-anim={reduceMotion || onBattery}>
    <div class="lt-bg-layer lt-bg-layer-1"></div>
    <div class="lt-bg-layer lt-bg-layer-2"></div>
    <div class="lt-bg-layer lt-bg-layer-3"></div>
    <div class="lt-bg-layer lt-bg-layer-4"></div>
    <div class="lt-bg-layer lt-bg-layer-5"></div>
  </div>
{/if}

<main class="page-main" bind:this={pageMain}>
  {#if showSidebars && ($settings.enableTranslator ?? true)}
    <aside
      id="left-sidebar"
      class="sidebar left"
      class:collapsed={!leftOpen}
      aria-hidden={!leftOpen}
      inert={!leftOpen}
      data-open={leftOpen}
    >
      <Translator />
    </aside>
  {/if}

  <div
    class="center-column"
    class:center-content={collapseSystemInfo || collapsePinnedSites}
    bind:this={centerColumn}
  >
    {#if ($settings.enableSystemInfo ?? true) && !collapseSystemInfo}
      <div class="system-wrap">
        <SystemInfo />
      </div>
    {/if}

    {#if !collapsePinnedSites}
      <div class="pinned-wrap">
        <PinnedSites />
      </div>
    {/if}

    <div class="search-wrap" bind:this={searchWrap}>
      <SearchBar />
    </div>
  </div>

  {#if showSidebars && ($settings.enableHistory ?? true)}
    <aside
      id="right-sidebar"
      class="sidebar right"
      class:collapsed={!rightOpen}
      aria-hidden={!rightOpen}
      inert={!rightOpen}
      data-open={rightOpen}
    >
      <History />
    </aside>
  {/if}

  {#if showSidebars && ($settings.enableTranslator ?? true)}
    <button
      class="sidebar-toggle left"
      aria-expanded={leftOpen}
      aria-controls="left-sidebar"
      onclick={toggleLeft}
      title={leftOpen ? "Collapse translator" : "Expand translator"}
      aria-label={leftOpen ? "Collapse translator" : "Expand translator"}
    >
      <i
        class="fa"
        aria-hidden="true"
        class:fa-chevron-right={leftOpen}
        class:fa-chevron-left={!leftOpen}
      ></i>
    </button>
  {/if}

  {#if showSidebars && ($settings.enableHistory ?? true)}
    <button
      class="sidebar-toggle right"
      aria-expanded={rightOpen}
      aria-controls="right-sidebar"
      onclick={toggleRight}
      title={rightOpen ? "Collapse history" : "Expand history"}
      aria-label={rightOpen ? "Collapse history" : "Expand history"}
    >
      <i
        class="fa"
        aria-hidden="true"
        class:fa-chevron-left={rightOpen}
        class:fa-chevron-right={!rightOpen}
      ></i>
    </button>
  {/if}

  {#if showSidebars && compactWidth}
    <div class="compact-overflow-controls" aria-label="Additional tools">
      {#if ($settings.enableSystemInfo ?? true) && (collapseSystemInfo || showSystemInfoOverlay)}
        <button
          class="compact-toggle"
          class:active={showSystemInfoOverlay}
          aria-expanded={showSystemInfoOverlay}
          aria-controls="system-info-overlay"
          onclick={() => (showSystemInfoOverlay = !showSystemInfoOverlay)}
          title={showSystemInfoOverlay
            ? "Hide system info"
            : "Show system info"}
          aria-label={showSystemInfoOverlay
            ? "Hide system info"
            : "Show system info"}
        >
          <i class="fa fa-info-circle" aria-hidden="true"></i>
        </button>
      {/if}
      {#if collapsePinnedSites || showPinnedSitesOverlay}
        <button
          class="compact-toggle"
          class:active={showPinnedSitesOverlay}
          aria-expanded={showPinnedSitesOverlay}
          aria-controls="pinned-sites-overlay"
          onclick={() => (showPinnedSitesOverlay = !showPinnedSitesOverlay)}
          title={showPinnedSitesOverlay
            ? "Hide pinned sites"
            : "Show pinned sites"}
          aria-label={showPinnedSitesOverlay
            ? "Hide pinned sites"
            : "Show pinned sites"}
        >
          <i class="fa fa-thumb-tack" aria-hidden="true"></i>
        </button>
      {/if}
      {#if $settings.enableTranslator ?? true}
        <button
          class="compact-toggle"
          class:active={leftOpen}
          aria-expanded={leftOpen}
          aria-controls="left-sidebar"
          onclick={toggleLeft}
          title={leftOpen ? "Hide translator" : "Show translator"}
          aria-label={leftOpen ? "Hide translator" : "Show translator"}
        >
          <i class="fa fa-language" aria-hidden="true"></i>
        </button>
      {/if}
      {#if $settings.enableHistory ?? true}
        <button
          class="compact-toggle"
          class:active={rightOpen}
          aria-expanded={rightOpen}
          aria-controls="right-sidebar"
          onclick={toggleRight}
          title={rightOpen ? "Hide history" : "Show history"}
          aria-label={rightOpen ? "Hide history" : "Show history"}
        >
          <i class="fa fa-history" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  {/if}

  {#if showSystemInfoOverlay}
    <section
      id="system-info-overlay"
      class="center-overlay"
      aria-label="System information"
    >
      <SystemInfo />
    </section>
  {/if}

  {#if showPinnedSitesOverlay}
    <section
      id="pinned-sites-overlay"
      class="center-overlay"
      aria-label="Pinned sites"
    >
      <PinnedSites />
    </section>
  {/if}

  {#if showSettings}
    {#await import("$lib/components/Settings.svelte") then { default: Settings }}
      <Settings />
    {:catch error}
      <div class="settings-load-error" role="status">
        Settings could not be loaded.
        <button
          onclick={() => {
            settingsLoadFailed = false;
            showSettings = false;
            requestAnimationFrame(() => {
              showSettings = true;
            });
          }}
        >
          Retry
        </button>
      </div>
    {/await}
  {/if}
</main>

<style>
  :global(html),
  :global(body) {
    width: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  :global(.hollow) {
    border: none !important;
  }

  :global(*:not(.fa)) {
    font-family: Arial, Helvetica, sans-serif !important;
  }

  :global(*) {
    --quaternary: #e1475a;
    --quaternary-50: #fce4e8;
    --quaternary-100: #f8d7da;
    --quaternary-200: #f1b3ba;
    --quaternary-300: #ea8f9a;
    --quaternary-400: #e66b7a;
    --quaternary-500: #e1475a;
    --quaternary-600: #c9364e;
    --quaternary-700: #b02e43;
    --quaternary-800: #911a41;
    --quaternary-900: #6f0b3a;

    --primary: #9d24a1;
    --primary-50: #f9e6f7;
    --primary-100: #f3ccf0;
    --primary-200: #e699e1;
    --primary-300: #d966d2;
    --primary-400: #c933c3;
    --primary-500: #b300b3;
    --primary-600: #990099;
    --primary-700: #800080;
    --primary-800: #660066;
    --primary-900: #4d004d;
  }

  #lt-bg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .lt-bg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .lt-bg-layer-1 {
    z-index: 1;
    background: linear-gradient(
      115deg,
      var(--primary-800) 0%,
      var(--secondary-800) 35%,
      var(--tertiary-800) 65%,
      var(--quaternary-800) 100%
    );
    background-size: 400% 400%;
    background-position: center;
    filter: blur(24px) saturate(0.85) brightness(0.7);
    opacity: 0.28;
  }

  .lt-bg-layer-2 {
    z-index: 2;
    background: linear-gradient(
      60deg,
      rgba(255, 255, 255, 0.008),
      rgba(0, 0, 0, 0.04)
    );
    mix-blend-mode: overlay;
    opacity: 0.3;
  }

  .lt-bg-layer-3 {
    z-index: 3;
    background: radial-gradient(
      circle at 30% 40%,
      rgba(255, 255, 255, 0.03) 0,
      transparent 50%
    );
    background-size: 200% 200%;
    opacity: 0.2;
  }

  .lt-bg-layer-4 {
    z-index: 4;
    background: radial-gradient(
      circle at 50% 50%,
      rgba(255, 255, 255, 0.02) 0,
      transparent 60%
    );
    background-size: 150% 150%;
    opacity: 0.18;
  }

  .lt-bg-layer-5 {
    z-index: 5;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0.5) 100%
    );
    opacity: 0.5;
  }

  @keyframes lt-scale-rotate {
    0% {
      transform: translateZ(0) scale(1) rotate(0deg);
    }

    50% {
      transform: translateZ(0) scale(1.05) rotate(2deg);
    }

    100% {
      transform: translateZ(0) scale(1) rotate(0deg);
    }
  }

  @keyframes lt-slow-rotate {
    0% {
      transform: translateZ(0) rotate(0deg);
    }

    100% {
      transform: translateZ(0) rotate(360deg);
    }
  }

  @keyframes lt-drift-simple {
    0% {
      transform: translate3d(0, 0, 0);
    }

    50% {
      transform: translate3d(2%, 1.5%, 0);
    }

    100% {
      transform: translate3d(0, 0, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lt-bg-layer {
      animation: none !important;
      transform: none !important;
    }

    .sidebar {
      transition: none !important;
    }
  }

  #lt-bg.no-anim .lt-bg-layer {
    animation: none !important;
    transform: none !important;
  }

  #lt-bg.no-anim .lt-bg-layer-1 {
    filter: none;
  }

  .page-main {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-width: 100%;
    max-height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: row;
    gap: 2rem;
    align-items: stretch;
    padding: 3rem 3.5rem;
    overflow: hidden;
    box-sizing: border-box;
  }

  .sidebar {
    flex: 0 1 18vw;
    min-width: 0;
    max-width: 18vw;
    min-height: 0;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background: var(--container);
    padding: 1rem;
    border-radius: var(--border-radius);
    overflow: auto;
    overscroll-behavior: contain;
    content-visibility: auto;
    contain-intrinsic-size: auto 600px;
    box-sizing: border-box;
  }

  .sidebar.collapsed {
    display: none;
  }

  .sidebar.left {
    order: 0;
    border: 1px solid var(--dark-400);
  }

  .sidebar.right {
    order: 2;
    border: 1px solid var(--dark-400);
  }

  .center-column {
    order: 1;
    flex: 1 1 0;
    min-width: 0;
    max-width: 60vw;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    box-sizing: border-box;
  }

  .center-column.center-content {
    justify-content: center;
  }

  .search-wrap,
  .system-wrap,
  .pinned-wrap {
    width: 100%;
    min-width: 0;
  }

  .pinned-wrap {
    border: 1px solid var(--dark-400);
    border-radius: var(--border-radius);
  }

  .sidebar-toggle {
    display: none;
  }

  .compact-overflow-controls {
    display: none;
  }

  .center-overlay {
    position: fixed;
    top: 3.25rem;
    left: 50%;
    z-index: 40;
    width: min(900px, calc(100vw - 2.5rem));
    height: calc(100dvh - 4.5rem);
    box-sizing: border-box;
    padding: 1rem;
    overflow: auto;
    transform: translateX(-50%);
    border: 1px solid var(--dark-400);
    border-radius: var(--border-radius);
    background: var(--container);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .settings-load-error {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 100;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background: var(--container);
    color: var(--text);
  }

  .settings-load-error button {
    margin-left: 0.5rem;
    cursor: pointer;
  }

  @media (max-width: 1699px) {
    .page-main {
      padding: 1.25rem;
      gap: 1rem;
    }

    .center-column {
      width: min(100%, 900px);
      min-width: min(560px, calc(100vw - 2.5rem));
      flex: 0 1 900px;
      max-width: none;
      padding-top: 2.75rem;
    }

    .sidebar {
      position: absolute;
      top: 1.25rem;
      bottom: 1.25rem;
      width: min(68vw, 360px);
      max-width: calc(100vw - 2.5rem);
      min-width: 0;
      z-index: 20;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      transition:
        opacity 200ms ease,
        transform 220ms ease;
      border-radius: 0.5rem;
      background: var(--container);
    }

    .sidebar.left {
      left: 1.25rem;
    }

    .sidebar.right {
      right: 1.25rem;
    }

    .sidebar-toggle {
      display: none;
    }

    .compact-overflow-controls {
      position: fixed;
      z-index: 30;
      top: 0.75rem;
      right: 3.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
    }

    .compact-toggle {
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: none;
      border-radius: 0;
      background: none;
      color: inherit;
      cursor: pointer;
      opacity: 0.72;
    }

    .compact-toggle.active,
    .compact-toggle:hover {
      opacity: 1;
    }

    .compact-toggle:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 3px;
    }

    .compact-toggle .fa {
      font-size: 1.25rem;
    }

    .compact-toggle .fa::before {
      display: block;
    }
  }

  @media (min-width: 1700px) {
    .center-overlay {
      top: 3.5rem;
      height: calc(100dvh - 5rem);
    }
  }

  @media (min-width: 1700px) {
    .sidebar {
      position: relative;
      flex: 0 1 18vw;
      height: 100%;
      max-width: 18vw;
      box-shadow: none;
    }

    .sidebar-toggle {
      display: none !important;
    }
  }
</style>
