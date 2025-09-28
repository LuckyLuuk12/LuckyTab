<!-- @component
This component provides a small settings button and panel for user preferences.
In here we provide options for theme modification, custom background image,
custom css injection, and customizing pinned links.
It will also provide a reset, import, and export functionality for user settings.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { writable } from 'svelte/store';
  import { settings, setCustomCss, clearAllSettings, addPinned, updatePinned, removePinned } from '$lib/stores';
  import { get } from 'svelte/store';
  import type { PinnedSite } from '$lib/types';

  // Store to manage settings visibility
  const showSettings = writable(false);

  // Function to toggle settings panel
  const toggleSettings = () => {
    showSettings.update(value => !value);
  };

  // Close settings when clicking outside
  let settingsPanel: HTMLDivElement;
  let settingsButtonEl: HTMLButtonElement | null = null;
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    // don't close if click is inside the panel or the settings button itself
    if (settingsPanel && (settingsPanel.contains(target) || (settingsButtonEl && settingsButtonEl.contains(target)))) {
      return;
    }
    if (settingsPanel && !settingsPanel.contains(target)) {
      showSettings.set(false);
    }
  };

  onMount(() => {
    if (browser) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  });

  // Custom css textarea (stored inside settings.customCss)
  let cssText = '';
  settings.subscribe((v) => (cssText = v.customCss || ''));

  // Pinned site adder fields (managed here in Settings)
  let newTitle = '';
  let newUrl = '';
  let newFavicon = '';

  function addPinnedSite() {
    if (!newUrl || !newUrl.trim()) return alert('Please provide a URL');
    const id = (crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(2)).join('-') : String(Date.now());
    const site: PinnedSite = { id, title: newTitle || newUrl, url: newUrl, custom_favicon: newFavicon || undefined };
    addPinned(site);
    newTitle = '';
    newUrl = '';
    newFavicon = '';
  }

  function editPinnedSite(id: string) {
    const s = get(settings).pinned.find((x) => x.id === id);
    if (!s) return;
    const updatedTitle = prompt('Title', s.title);
    const updatedUrl = prompt('URL', s.url);
    const updatedFav = prompt('Custom favicon (optional)', s.custom_favicon ?? '');
    if (updatedTitle !== null && updatedUrl !== null) {
      updatePinned(id, { title: updatedTitle, url: updatedUrl, custom_favicon: updatedFav || undefined });
    }
  }

  function getFavicon(siteUrl: string) {
    try { const u = new URL(siteUrl); return `${u.origin}/favicon.ico`; } catch(e) { return '/favicon.png'; }
  }

  function applyCss() {
    if (!browser) return;
    const styleId = 'lt-custom-css';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = cssText || '';
    setCustomCss(cssText || '');
    // small visual feedback
    showSettings.set(false);
  }

  function exportSettings() {
    const st = get(settings);
    const payload = { pinned: st.pinned, css: cssText, colors: st.colors };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luckytab-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSettings() {
    if (!browser) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed.css) {
          cssText = parsed.css;
          // update centralized settings
          settings.update((s) => ({ ...s, customCss: cssText }));
          setCustomCss(cssText);
        }
        if (parsed.pinned) {
          // overwrite pinned sites in centralized settings
          settings.update((s) => ({ ...s, pinned: parsed.pinned }));
        }
        alert('Imported settings');
      } catch (e) {
        alert('Failed to import: ' + e);
      }
    };
    input.click();
  }

  function doReset() {
    if (!confirm('Reset all settings? This will remove pinned sites and custom CSS stored in localStorage.')) return;
    clearAllSettings();
    const el = document.getElementById('lt-custom-css');
    if (el) el.remove();
    cssText = '';
    alert('Settings reset');
  }

  // Theme templates (use CSS variables so CleanUI classes can reference them)
  const themes = {
    'purple-template': {
      primary: '#311b92',
      secondary: '#512da8',
      tertiary: 'rgba(49, 27, 146, 0.1)',
      quaternary: 'rgba(49, 27, 146, 0.05)'
    },
    'pink-template': {
      primary: '#880e4f',
      secondary: '#c2185b',
      tertiary: 'rgba(136, 14, 79, 0.1)',
      quaternary: 'rgba(136, 14, 79, 0.05)'
    },
    'blue-template': {
      primary: '#142850',
      secondary: '#27496d',
      tertiary: 'rgba(20, 40, 80, 0.1)',
      quaternary: 'rgba(20, 40, 80, 0.05)'
    },
    'yellow-template': {
      primary: '#f57f17',
      secondary: '#ff9800',
      tertiary: 'rgba(245, 127, 23, 0.1)',
      quaternary: 'rgba(245, 127, 23, 0.05)'
    },
    'mixed-1-template': {
      primary: '#e8116a',
      secondary: '#0fe1e1',
      tertiary: 'rgba(43,243,224,0.15)',
      quaternary: 'rgba(207,26,144,0.15)'
    }
  } as Record<string, { primary: string; secondary: string; tertiary: string; quaternary: string }>;

  function saveThemeColors(primary: string, secondary: string, tertiary: string, quaternary: string) {
    if (!browser) return;
    // use new variable naming convention
    localStorage.setItem('primary', primary);
    localStorage.setItem('secondary', secondary);
    localStorage.setItem('tertiary', tertiary);
    localStorage.setItem('quaternary', quaternary);
  }

  function loadThemeColors() {
    if (!browser) return;
    const primary = localStorage.getItem('primaryColor');
    const secondary = localStorage.getItem('secondaryColor');
    const tertiary = localStorage.getItem('tertiaryColor');
    const quaternary = localStorage.getItem('quaternaryColor');
    if (primary && secondary && tertiary && quaternary) {
      document.body.style.setProperty('--primary', primary);
      document.body.style.setProperty('--secondary', secondary);
      document.body.style.setProperty('--tertiary', tertiary);
      document.body.style.setProperty('--quaternary', quaternary);
    }
  }

  function changeColorTemplate(key: string) {
    const theme = themes[key];
    if (!theme) return;
    document.body.style.setProperty('--primary', theme.primary);
    document.body.style.setProperty('--secondary', theme.secondary);
    document.body.style.setProperty('--tertiary', theme.tertiary);
    document.body.style.setProperty('--quaternary', theme.quaternary);
    saveThemeColors(theme.primary, theme.secondary, theme.tertiary, theme.quaternary);
    showSettings.set(false);
  }

  // Load theme vars on mount
  onMount(() => {
    loadThemeColors();
  });
</script>


<button class="settings-button" on:click={toggleSettings} title="Settings" aria-label="Settings" bind:this={settingsButtonEl}>
  <i class="fa fa-cog" style="font-size:1.25rem;"></i>
</button>
{#if $showSettings}
  <div class="settings-panel" bind:this={settingsPanel}>
    <h4 class="section-title">Appearance</h4>
    <div class="theme-tiles">
      {#each Object.keys(themes) as k}
        <button class="tertiary theme-tile" on:click={() => changeColorTemplate(k)}>{k.replace('-template','')}</button>
      {/each}
    </div>

    <h4 class="section-title">Custom CSS</h4>
    <textarea class="custom-css" bind:value={cssText} placeholder="/* Custom CSS. use var(--primary) etc. */" rows="6">{cssText}</textarea>
    <div class="actions-row">
      <button class="secondary" on:click={importSettings}>Import</button>
      <button class="secondary" on:click={exportSettings}>Export</button>
      <button class="primary" on:click={applyCss}>Apply</button>
    </div>

    <hr class="section-sep" />
    <h4 class="section-title">Pinned Sites</h4>
    <div class="pinned-adder">
      <input placeholder="Title (optional)" bind:value={newTitle} />
      <input placeholder="https://example.com" bind:value={newUrl} />
      <input placeholder="favicon url (optional)" bind:value={newFavicon} />
      <button class="primary" on:click={addPinnedSite}>Add</button>
    </div>
    <div class="pinned-list">
      {#each $settings.pinned as p}
        <div class="pinned-item">
          <div class="pinned-main">
            <img class="pinned-fav" src={p.custom_favicon ?? getFavicon(p.url)} alt="" />
            <div class="pinned-title">{p.title}</div>
          </div>
          <div class="pinned-actions">
            <button class="tertiary" on:click={() => editPinnedSite(p.id)}>Edit</button>
            <button class="red" on:click={() => removePinned(p.id)}>Remove</button>
          </div>
        </div>
      {/each}
    </div>

    <hr class="section-sep" />
    <div class="footer-row">
      <small>Manage stored settings (local only)</small>
      <button class="red" on:click={doReset}>Reset</button>
    </div>
  </div>
{/if}


<style>
  .settings-button {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    z-index: 1000;
  }

  .settings-panel {
    position: fixed;
    top: 2.5rem;
    left: 2.5rem;
    width: calc(100vw - 5rem);
    height: calc(100vh - 5rem);
    background-color: var(--container, rgba(0, 0, 0, 0.92));
    color: white;
    padding: 1.25rem;
    border-radius: 0.5rem;
    z-index: 9999;
    overflow: auto;
  }

  .section-title { margin-top: 0; }
  .theme-tiles { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.5rem; }
  .theme-tile { min-width:0; padding:.5rem; border-radius:.5rem; }
  .custom-css { width:100%; margin-bottom:.5rem; border-radius:.25rem; padding:.5rem; box-sizing:border-box; }
  .actions-row { display:flex; gap:.5rem; justify-content:flex-end; }
  .section-sep { margin:.75rem 0; border-color:#333; }
  .pinned-adder { display:flex; gap:.5rem; margin-bottom:.5rem; }
  .pinned-list { display:flex; flex-direction:column; gap:.5rem; max-height:200px; overflow:auto; margin-bottom:.5rem; }
  .pinned-item { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.25rem; border-radius:.25rem; background:rgba(255,255,255,0.02); }
  .pinned-main { display:flex; gap:.5rem; align-items:center; flex:1; overflow:hidden; }
  .pinned-fav { width:1.5rem; height:1.5rem; border-radius:4px; }
  .pinned-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pinned-actions { display:flex; gap:.25rem; }
  .footer-row { display:flex; gap:.5rem; justify-content:space-between; align-items:center; }
</style>
