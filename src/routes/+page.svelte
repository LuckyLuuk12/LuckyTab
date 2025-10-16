<!-- @component
  This is a single-page Svelte project that serves as my custom new tab page.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import PinnedSites from '$lib/components/PinnedSites.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import Translator from '$lib/components/Translator.svelte';
  import History from '$lib/components/History.svelte';
  import favicon from '$lib/assets/favicon.png';

  let searchQuery = '';

  // Function to handle search form submission
  const handleSearch = (event: Event) => {
    event.preventDefault();
    if (searchQuery.trim()) {
      const query = encodeURIComponent(searchQuery.trim());
      goto(`https://www.google.com/search?q=${query}`);
    }
  };

  // Focus the search input on mount
  let searchInput: HTMLInputElement | null = null;

  // Accessibility / battery-awareness: if the user prefers reduced motion or
  // is currently on battery power (not charging), we'll disable background animations.
  let reduceMotion = false;
  let onBattery = false;
  let _battery: any = null;
  // Responsive sidebar state: when viewport < 1700px the sidebars become collapsible
  let isWide = true;
  let leftOpen = true;
  let rightOpen = true;
  
  // Performance optimization: defer non-critical components
  let showSidebars = false;
  let showBackground = false;
  let showSettings = false;

  function updateWidth() {
    if (!browser) return;
    const w = window.innerWidth;
    const wasWide = isWide;
    isWide = w >= 1700;
    if (isWide) {
      // always show sidebars on wide screens
      leftOpen = true;
      rightOpen = true;
    } else if (wasWide && !isWide) {
      // when crossing from wide -> narrow, collapse them to avoid cramped UI
      leftOpen = false;
      rightOpen = false;
    }
  }

  function toggleLeft() {
    leftOpen = !leftOpen;
  }

  function toggleRight() {
    rightOpen = !rightOpen;
  }

  onMount(() => {
    if (browser && searchInput) {
      // @ts-ignore
      searchInput.focus();
    }

    // respect prefers-reduced-motion
    try {
      reduceMotion = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        mq.addEventListener?.('change', (e: any) => { reduceMotion = e.matches; });
      }
    } catch (e) {
      /* ignore */
    }

    // battery detection (if supported) — consider on battery when not charging
    if ('getBattery' in navigator) {
      try {
        // @ts-ignore
        (navigator as any).getBattery().then((bat: any) => {
          _battery = bat;
          onBattery = !bat.charging;
          const update = () => { onBattery = !_battery.charging; };
          _battery.addEventListener?.('chargingchange', update);
          _battery.addEventListener?.('levelchange', update);
        }).catch(() => {});
      } catch (e) {
        /* ignore */
      }
    }

    // set initial width state and add resize listener
    updateWidth();
    const onResize = () => updateWidth();
    window.addEventListener('resize', onResize);
    
    // Performance optimization: progressive loading strategy
    // 1. Show critical content immediately (search bar, pinned sites loaded)
    // 2. Defer sidebars until next frame (after paint)
    requestAnimationFrame(() => {
      showSidebars = true;
      // 3. Defer background layers MORE - wait for idle
      requestIdleCallback(() => {
        showBackground = true;
      }, { timeout: 100 });
      // 4. Defer settings overlay last
      setTimeout(() => {
        showSettings = true;
      }, 100);
    });
    
    // cleanup on destroy
    return () => {
      window.removeEventListener('resize', onResize);
    };
  });
</script>


<svelte:head>
  <title>New Tab</title>
  <meta name="description" content="" />
  <link rel="icon" type="image/png" href={favicon} />
  <!-- Preconnect to search providers for faster searches -->
  <link rel="preconnect" href="https://www.google.com" crossorigin="anonymous" />
  <link rel="dns-prefetch" href="https://www.google.com" />
  <link rel="dns-prefetch" href="https://duckduckgo.com" />
  <link rel="dns-prefetch" href="https://www.youtube.com" />
</svelte:head>


<!-- Background container: sits on top of the <body> but behind the app UI.
     Users can style layers via the ids/classes below (for example in Settings' custom CSS).
     Each layer is pointer-events:none so it won't intercept clicks.
     Deferred loading for performance. -->
{#if showBackground}
<div id="lt-bg" aria-hidden="true" class:no-anim={reduceMotion || onBattery}>
  <div class="lt-bg-layer lt-bg-layer-1"></div>
  <div class="lt-bg-layer lt-bg-layer-2"></div>
  <div class="lt-bg-layer lt-bg-layer-3"></div>
  <div class="lt-bg-layer lt-bg-layer-4"></div>
  <div class="lt-bg-layer lt-bg-layer-5"></div>
</div>
{/if}

<main class="page-main">
  {#if showSidebars}
  <aside id="left-sidebar" class="sidebar left" class:collapsed={!leftOpen && !isWide} aria-hidden={!leftOpen && !isWide} data-open={leftOpen}>
    <Translator />
  </aside>
  {/if}

  <div class="center-column">
    <div class="pinned-wrap">
      <PinnedSites />
    </div>

    <div class="search-wrap">
      <SearchBar />
    </div>
  </div>

  {#if showSidebars}
  <aside id="right-sidebar" class="sidebar right" class:collapsed={!rightOpen && !isWide} aria-hidden={!rightOpen && !isWide} data-open={rightOpen}>
    <History />
  </aside>
  {/if}

  <!-- collapse toggles, visible only on narrow screens -->
  {#if showSidebars}
  <button class="sidebar-toggle left" aria-expanded={leftOpen} aria-controls="left-sidebar" on:click={toggleLeft} title="Toggle left sidebar" aria-label="Toggle left sidebar">
    <i class="fa" aria-hidden="true" class:fa-chevron-right={!!leftOpen} class:fa-chevron-left={!leftOpen}></i>
  </button>
  <button class="sidebar-toggle right" aria-expanded={rightOpen} aria-controls="right-sidebar" on:click={toggleRight} title="Toggle right sidebar" aria-label="Toggle right sidebar">
    <i class="fa" aria-hidden="true" class:fa-chevron-left={!!rightOpen} class:fa-chevron-right={!rightOpen}></i>
  </button>
  {/if}

  {#if showSettings}
  <Settings />
  {/if}
</main>

<style>
  :global(*:not(.fa)) {
    font-family: Arial, Helvetica, sans-serif !important;
  }
  :global(*) {
    /* Change font to something smooth */
    --quaternary: #e1475a; /* equal to quaternary-500 */
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
    --primary: #9d24a1; /* equal to primary-500 */
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
  /* Background layers: full viewport, stacked. These layers provide a subtle,
     animated backdrop. Colors use the app theme variables so users can override
     them from custom CSS in Settings (for example: --primary, --secondary, etc.).
     Each layer is pointer-events:none so it won't intercept interactions. */
  #lt-bg {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0; /* behind the app content */
    pointer-events: none; /* never block UI interactions */
    overflow: hidden;
  }

  .lt-bg-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    /* Force GPU compositing for cheaper animations */
    transform: translateZ(0);
    backface-visibility: hidden;
    /* Isolate layer to prevent repaints of other content */
    isolation: isolate;
    /* Hint browser this won't change dimensions */
    contain: layout style paint;
  }

  /* Animated soft gradient (layer 1 + subtle sheen). Uses CSS variables for colors.
     Optimized: use transform instead of background-position for GPU acceleration */
  .lt-bg-layer-1 {
    z-index: 1;
    /* Static gradient - we'll animate via transform instead */
    background: linear-gradient(115deg,
      var(--primary-800, var(--primary, #07101a)) 0%,
      var(--secondary-800, var(--secondary, #08303f)) 35%,
      var(--tertiary-800, var(--tertiary, #00373a)) 65%,
      var(--quaternary-800, var(--quaternary, #050819)) 100%);
    /* Larger background for smooth transform animation */
    background-size: 400% 400%;
    background-position: center;
    /* Reduced blur for MUCH better performance - customizable via CSS variable */
    filter: blur(var(--bg-blur, 24px)) saturate(0.85) brightness(0.7);
    opacity: 0.28;
    /* Animate transform instead of background-position - MUCH faster */
    animation: lt-scale-rotate 90s ease-in-out infinite;
  }

  /* Simplified overlay - reduced filter complexity */
  .lt-bg-layer-2 {
    z-index: 2;
    background: linear-gradient(60deg, rgba(255,255,255,0.008), rgba(0,0,0,0.04));
    mix-blend-mode: overlay;
    opacity: 0.3;
    /* Simple slow rotation - very cheap */
    animation: lt-slow-rotate 120s linear infinite;
  }

  /* Simplified dots - single gradient instead of multiple */
  .lt-bg-layer-3 {
    z-index: 3;
    background: radial-gradient(circle at 30% 40%, rgba(255,255,255,0.03) 0, transparent 50%);
    background-size: 200% 200%;
    opacity: 0.2;
    /* Gentle drift - GPU accelerated */
    animation: lt-drift-simple 100s ease-in-out infinite;
  }

  /* Simplified depth layer - minimal blur */
  .lt-bg-layer-4 {
    z-index: 4;
    background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0, transparent 60%);
    background-size: 150% 150%;
    opacity: 0.18;
    /* Very slow subtle movement */
    animation: lt-drift-simple 140s ease-in-out infinite reverse;
  }

  /* Static vignette - no animation needed, saves CPU/GPU */
  .lt-bg-layer-5 {
    z-index: 5;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%);
    pointer-events: none;
    opacity: 0.5;
    /* Static - no animation, no filters */
  }

  /* Optimized animations - use ONLY transform and opacity (GPU accelerated) */
  
  /* Gentle scale and rotate - much cheaper than background-position */
  @keyframes lt-scale-rotate {
    0% { transform: translateZ(0) scale(1) rotate(0deg); }
    50% { transform: translateZ(0) scale(1.05) rotate(2deg); }
    100% { transform: translateZ(0) scale(1) rotate(0deg); }
  }

  /* Simple rotation for overlay */
  @keyframes lt-slow-rotate {
    0% { transform: translateZ(0) rotate(0deg); }
    100% { transform: translateZ(0) rotate(360deg); }
  }

  /* Simplified drift using only transform */
  @keyframes lt-drift-simple {
    0% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(2%, 1.5%, 0); }
    100% { transform: translate3d(0, 0, 0); }
  }

  /* Pause / reduce animations and heavy transforms when user requests reduced motion
     or when device appears to be on battery power. */
  @media (prefers-reduced-motion: reduce) {
    .lt-bg-layer, #lt-bg.no-anim { animation: none !important; transform: none !important; }
  }

  #lt-bg.no-anim .lt-bg-layer { animation: none !important; transform: none !important; opacity: 0.6; }

  /* App content sits above the background layers. Use a positive z-index so overlays
     (like Settings) still appear above. */
   .page-main {
    position: relative;
    z-index: 10;
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    display: flex;
    flex-direction: row;
    gap: 2rem;
    align-items: stretch;
    padding: 3rem 3.5rem; /* ensure settings button doesn't overlap content behind it */
    overflow: hidden;
  }

  .sidebar {
    min-width: 18vw;
    max-width: 18vw;
    min-height: calc(100vh - 6rem);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background: var(--container, #888888);
    padding: 1rem;
    border-radius: var(--border-radius, 0.5rem);
    overflow: auto;
    /* Performance: allow browser to skip rendering off-screen content */
    content-visibility: auto;
    contain-intrinsic-size: 18vw 600px;
  }

  /* Collapsible behavior for narrower screens: make sidebars overlay when collapsed state is false */
  .sidebar.collapsed { display: none; }

  /* Overlay variant when narrow: absolute positioned sidebars that slide over center column */
  @media (max-width: 1699px) {
    .page-main { padding: 1.25rem; gap: 1rem; }
    .sidebar {
      position: absolute;
      top: 1.25rem;
      bottom: 1.25rem;
      width: min(68vw, 360px);
      z-index: 20;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      transform: translateX(0);
      transition: transform 220ms ease, opacity 200ms ease;
      border-radius: 0.5rem;
      background: var(--container, rgba(20,20,20,0.92));
    }
    .sidebar.left { left: 1.25rem; }
    .sidebar.right { right: 1.25rem; }

    /* When collapsed hide via transform or display: none (class controls it) */
    .sidebar:not(.collapsed) { display: flex; }

    /* Toggle bars: thin vertical bars centered vertically on page edges */
    .sidebar-toggle {
      position: fixed;
      z-index: 30;
      width: 14px;
      height: 120px;
      background: linear-gradient(180deg, rgba(255,255,255,0.002), rgba(255,255,255,0.001));
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      backdrop-filter: blur(6px) saturate(1.1);
      cursor: pointer;
      padding: 0.25rem;
      border: 1px solid rgba(255,255,255,0.0004);
    }
    .sidebar-toggle.left { left: 6px; top: 50%; transform: translateY(-50%); }
    .sidebar-toggle.right { right: 6px; top: 50%; transform: translateY(-50%); }
    .sidebar-toggle .fa { font-size: 0.8rem; }
    .sidebar-toggle .fa:before { display:block; }
  }

  /* On wide screens ensure sidebars are visible and static */
  @media (min-width: 1700px) {
    .sidebar { position: relative; display: flex !important; width: auto; box-shadow: none; }
    .sidebar-toggle { display: none !important; }
  }

  /* Constrain central column width so pinned + search don't stretch too wide */
  .center-column { max-width: 60vw; margin: 0 auto; }

  .sidebar.left { order: 0; border: 1px solid var(--dark-400); }
  .center-column { order: 1; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; }
  .sidebar.right { order: 2; border: 1px solid var(--dark-400); }

  .search-wrap { width: 100%; }
  .pinned-wrap { width: 100%; border: 1px solid var(--dark-400); border-radius: var(--border-radius, 0.5rem); }
</style>