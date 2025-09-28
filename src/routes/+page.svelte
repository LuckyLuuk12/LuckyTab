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
  });
</script>


<svelte:head>
  <title>New Tab</title>
  <meta name="description" content="" />
  <link rel="icon" type="image/png" href="/favicon.png" />
</svelte:head>


<!-- Background container: sits on top of the <body> but behind the app UI.
     Users can style layers via the ids/classes below (for example in Settings' custom CSS).
     Each layer is pointer-events:none so it won't intercept clicks. -->
<div id="lt-bg" aria-hidden="true" class:no-anim={reduceMotion || onBattery}>
  <div class="lt-bg-layer lt-bg-layer-1"></div>
  <div class="lt-bg-layer lt-bg-layer-2"></div>
  <div class="lt-bg-layer lt-bg-layer-3"></div>
  <div class="lt-bg-layer lt-bg-layer-4"></div>
  <div class="lt-bg-layer lt-bg-layer-5"></div>
</div>

<main class="page-main">
  <aside class="sidebar left">
    <Translator />
  </aside>

  <div class="center-column">
    <div class="pinned-wrap">
      <PinnedSites />
    </div>

    <div class="search-wrap">
      <SearchBar />
    </div>
  </div>

  <aside class="sidebar right">
    <History />
  </aside>

  <Settings />
</main>

<style>
  :global(*) {
    font-family: "Open sans, Tahoma, Geneva, sans-serif";
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
    will-change: transform, background-position, opacity;
  }

  /* Animated soft gradient (layer 1 + subtle sheen). Uses CSS variables for colors.
     The gradient is scaled and slowly translated for a moving effect, then blurred. */
  .lt-bg-layer-1 {
    z-index: 1;
    /* Prefer darker -800 variants if available; fallbacks chosen to be dark */
    background: linear-gradient(115deg,
      var(--primary-800, var(--primary, #07101a)) 0%,
      var(--secondary-800, var(--secondary, #08303f)) 35%,
      var(--tertiary-800, var(--tertiary, #00373a)) 65%,
      var(--quaternary-800, var(--quaternary, #050819)) 100%);
    background-size: 200% 200%;
    /* Slight desaturation + darker overall to avoid bright colors */
  filter: blur(48px) saturate(0.9) grayscale(0.12) brightness(0.78);
  opacity: 0.35;
  animation: lt-move-gradient 60s linear infinite;
    transform: translateZ(0);
  }

  /* A thin overlay layer to add contrast and a moving sheen */
  .lt-bg-layer-2 {
    z-index: 2;
    /* subtle sheen but muted */
    background: linear-gradient(60deg, rgba(255,255,255,0.01), rgba(0,0,0,0.06));
    mix-blend-mode: overlay;
  filter: blur(8px) brightness(0.9) saturate(0.95);
  opacity: 0.35;
  animation: lt-move-gradient 90s linear reverse infinite;
  }

  /* Small blurred dots: repeated radial gradients with low opacity. Moves slowly. */
  .lt-bg-layer-3 {
    z-index: 3;
    background-image:
      radial-gradient(circle at 10% 20%, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.00) 30%),
      radial-gradient(circle at 70% 10%, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.00) 30%),
      radial-gradient(circle at 30% 80%, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.00) 30%),
      radial-gradient(circle at 85% 65%, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.00) 30%);
    background-size: 60% 60%, 50% 50%, 70% 70%, 40% 40%;
  filter: blur(12px) brightness(0.95) saturate(0.9);
  opacity: 0.30;
  animation: lt-drift 80s linear infinite;
  }

  /* Bigger blurred spots that gently move—this layer adds depth and subtle motion. */
  .lt-bg-layer-4 {
    z-index: 4;
    background-image:
      radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04) 0, rgba(255,255,255,0) 35%),
      radial-gradient(circle at 75% 40%, rgba(255,255,255,0.03) 0, rgba(255,255,255,0) 40%);
    background-size: 120% 120%, 90% 90%;
  filter: blur(36px) brightness(0.9) saturate(0.9);
  opacity: 0.25;
  animation: lt-drift-slow 120s linear infinite;
  }

  /* Subtle vignette / foreground noise to tie everything together. Users can
     override or replace this in their custom CSS. */
  .lt-bg-layer-5 {
    z-index: 5;
    /* Dark overlay to dim the entire backdrop; tweak via --bg-dim if desired */
    background: linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.42));
    pointer-events: none;
    opacity: 0.6;
    mix-blend-mode: multiply;
    filter: grayscale(0.06) contrast(0.95);
  }

  /* Animations */
  @keyframes lt-move-gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes lt-drift {
    0% { transform: translate3d(0,0,0); }
    25% { transform: translate3d(2%, -1%, 0); }
    50% { transform: translate3d(0,2%, 0); }
    75% { transform: translate3d(-2%, 1%, 0); }
    100% { transform: translate3d(0,0,0); }
  }

  @keyframes lt-drift-slow {
    0% { transform: translate3d(0,0,0); }
    50% { transform: translate3d(-3%, 2%, 0); }
    100% { transform: translate3d(0,0,0); }
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
  }

  .sidebar.left { order: 0; border: 1px solid var(--dark-400); }
  .center-column { order: 1; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; }
  .sidebar.right { order: 2; border: 1px solid var(--dark-400); }

  .search-wrap { width: 100%; }
  .pinned-wrap { width: 100%; border: 1px solid var(--dark-400); border-radius: var(--border-radius, 0.5rem); }
</style>