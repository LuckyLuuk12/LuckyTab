<!-- @component
no description yet
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { writable } from 'svelte/store';
  import { addHistory, settings } from '$lib/stores';
  
  import googleIcon from '$lib/assets/img/google.ico?enhanced';
  import duckduckgoIcon from '$lib/assets/img/duckduckgo.ico?enhanced';
  import youtubeIcon from '$lib/assets/img/yt.png?enhanced';
  import scholarIcon from '$lib/assets/img/scholar.ico?enhanced';
  import wolframIcon from '$lib/assets/img/wolframalpha.png?enhanced';
  import allkeyshopIcon from '$lib/assets/img/allkeyshop.png?enhanced';

  type Provider = { id: string; name: string; action: string; param?: string; icon: any };

  const providers: Provider[] = [
    { id: 'google', name: 'Google', action: 'https://www.google.com/search', param: 'q', icon: googleIcon },
    { id: 'duckduckgo', name: 'DuckDuckGo', action: 'https://duckduckgo.com/', param: 'q', icon: duckduckgoIcon },
    { id: 'youtube', name: 'YouTube', action: 'https://www.youtube.com/results', param: 'search_query', icon: youtubeIcon },
    { id: 'scholar', name: 'Scholar', action: 'https://scholar.google.com/scholar', param: 'q', icon: scholarIcon },
    { id: 'wolfram', name: 'WolframAlpha', action: 'https://www.wolframalpha.com/input', param: 'i', icon: wolframIcon },
    { id: 'allkeyshop', name: 'AllKeyShop', action: 'https://www.allkeyshop.com/blog/products/', param: 'search_name', icon: allkeyshopIcon }
  ];

  const selected = writable<Provider>(providers[0]);
  const query = writable('');
  const openNew = writable(false);
  const providersVisible = writable(false);

  let inputEl: HTMLInputElement | null = null;
  // history browsing state
  let historyList: Array<any> = [];
  let historyPos = -1; // -1 = not browsing, 0 = most recent
  let originalTyped = '';

  // keep a local filtered history (search/visit entries only)
  settings.subscribe((s) => {
    historyList = (s.history || []).filter((h) => h && (h.type === 'search' || h.type === 'visit'));
    // reset browsing state if history changed
    historyPos = -1;
    originalTyped = '';
  });

  onMount(() => {
    if (browser && inputEl) inputEl.focus();
  });

  function handleInput() {
    // user manually edited the input -> exit history browsing mode
    historyPos = -1;
    originalTyped = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    // handle arrow up/down for history navigation
    if (!inputEl) return;
    const caret = inputEl.selectionStart ?? 0;
    if (e.key === 'ArrowUp') {
      // If not already browsing history, only intercept when caret at start or input empty.
      if (historyList.length === 0) return;
      if (historyPos === -1 && caret !== 0 && inputEl.value.trim() !== '') return;
      e.preventDefault();
      if (historyPos === -1) {
        originalTyped = inputEl.value;
        historyPos = 0;
      } else if (historyPos < historyList.length - 1) {
        historyPos += 1;
      } else {
        // We reached the oldest entry; wrap to empty (leave browsing state)
        // so the next ArrowUp will start from the most recent again.
        historyPos = -1;
        query.set('');
        // caret to end (empty)
        setTimeout(() => inputEl && inputEl.setSelectionRange(0, 0), 0);
        return;
      }
      const entry = historyList[historyPos];
      query.set(entry.query ?? entry.url ?? '');
      // move caret to end
      setTimeout(() => inputEl && inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
    } else if (e.key === 'ArrowDown') {
      if (historyPos === -1) return;
      e.preventDefault();
      if (historyPos > 0) {
        historyPos -= 1;
        const entry = historyList[historyPos];
        query.set(entry.query ?? entry.url ?? '');
      } else {
        // leave history browsing and restore original typed value
        historyPos = -1;
        query.set(originalTyped);
        originalTyped = '';
      }
      setTimeout(() => inputEl && inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length), 0);
    }
  }

  function selectProvider(p: Provider) {
    selected.set(p);
    providersVisible.set(false);
  }

  function submitForm(e: Event) {
    e.preventDefault();
    let q = '';
    query.subscribe((v) => (q = v))();
    let p: Provider | undefined;
    selected.subscribe((v) => (p = v))();
    if (!p || !q.trim()) return;

    // Helper: detect if the input looks like a URI
    function isLikelyURI(s: string) {
      const t = s.trim();
      if (!t) return false;
      // has a scheme like http:// or ftp://
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t)) return true;
      // avoid treating phrases with spaces as URLs
      if (t.includes(' ')) return false;
      // localhost or contains a dot (example.com)
      if (/^localhost\b/.test(t)) return true;
      if (/\./.test(t)) return true;
      return false;
    }

    function ensureUrl(s: string) {
      const t = s.trim();
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t)) return t;
      return `https://${t}`;
    }

    // If the user entered a URI, go there directly regardless of provider
    if (isLikelyURI(q)) {
      const urlStr = ensureUrl(q);
      try { addHistory({ type: 'visit', provider: 'direct', query: q, url: urlStr }); } catch (e) {}
      let newTab = false;
      openNew.subscribe((v) => (newTab = v))();
      if (newTab) window.open(urlStr, '_blank');
      else window.location.href = urlStr;
      return;
    }

    // Build URL for selected provider
    const url = new URL(p.action);
    if (p.id === 'allkeyshop') {
      // special handling: append query param to path
      url.searchParams.set(p.param ?? 'search_name', q);
    } else if (p.action.endsWith('/')) {
      // some endpoints like duckduckgo accept q in path
      url.searchParams.set(p.param ?? 'q', q);
    } else {
      url.searchParams.set(p.param ?? 'q', q);
    }
    // record to history
    try { addHistory({ type: 'search', provider: p.id, query: q, url: url.toString() }); } catch(e){}

    // open
    let newTab = false;
    openNew.subscribe((v) => (newTab = v))();
    if (newTab) window.open(url.toString(), '_blank');
    else window.location.href = url.toString();
  }
</script>

<form class="multi-search-container" on:submit|preventDefault={submitForm}>
  <div class="msc-row">
    <button type="button" class="primary hollow provider-button" aria-label={`Provider: ${$selected.name}`} on:click={() => providersVisible.update(v => !v)}>
      {#if $selected}
        {#if typeof $selected.icon !== 'string'}
          <enhanced:img class="provider-img" src={$selected.icon} alt={$selected.name} />
        {:else}
          <img class="provider-img" src={$selected.icon} alt={$selected.name} />
        {/if}
      {/if}
    </button>

    <div class="input-with-icon">
      <i class="fa fa-search search-icon" aria-hidden="true"></i>
      <input bind:this={inputEl} bind:value={$query} type="text" placeholder="Search..." on:input={handleInput} on:keydown={handleKeydown} />
    </div>

    <button type="submit" class="primary hollow search-submit" aria-label="Search"> 
      <i class="fa fa-search" aria-hidden="true"></i>
    </button>

    <button type="button" title={$openNew ? 'Open links in same tab' : 'Open links in new tab'} on:click={() => openNew.update(v => !v)} class="tertiary hollow open-new" aria-pressed={$openNew} aria-label={$openNew ? 'Open links in same tab' : 'Open links in new tab'}>
      <i class={$openNew ? 'fa fa-external-link-alt' : 'fa fa-window-maximize'} aria-hidden="true"></i>
    </button>
  </div>

  <div class="provider-list" class:visible={$providersVisible} aria-hidden={!$providersVisible}>
    {#each providers as p}
      <button type="button" class="hollow provider-list-button" on:click={() => selectProvider(p)} title={p.name}>
        {#if typeof p.icon !== 'string'}
          <enhanced:img class="provider-list-img" src={p.icon} alt={p.name} />
        {:else}
          <img class="provider-list-img" src={p.icon} alt={p.name} />
        {/if}
        <span class="provider-name">{p.name}</span>
      </button>
    {/each}
  </div>
</form>

<style>
  /* Container: make everything sit 'inside' a single bar */
  .multi-search-container { width:100%; }
  .multi-search-container button { cursor: pointer; }

  .msc-row {
    display: flex;
    align-items: center;
    gap: 0; /* items sit flush */
    width: 100%;
    background: var(--card, #888888);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 0.75rem;
    padding: 0.5rem; /* inner gutter */
    box-sizing: border-box;
  }

  /* when any child inside is focused, highlight the whole bar */
  .msc-row:focus-within {
    border-color: var(--dark-400, #0d6efd);
    box-shadow: 0 4px 10px rgba(13,110,253,0.10);
  }

  /* Buttons inside the bar: transparent so they visually integrate */
  .msc-row > button {
    background: transparent;
    border: none;
    margin: 0;
    padding: 0.45rem 0.6rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
  }

  /* Keep provider image size but align it nicely */
  .provider-button { display:flex; align-items:center; gap:.5rem; }
  .provider-img { width:1.5rem; height:1.5rem; border-radius:3px; display:block; }

  /* Input area stretches to fill available space */
  .input-with-icon { position: relative; flex: 1; margin: 0 0.35rem; }
  .input-with-icon .search-icon {
    position: absolute;
    left: 0.65rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--placeholder,#999);
    pointer-events: none;
  }
  .input-with-icon input {
    width: 100%;
    border: none;
    outline: none;
    height: 2.25rem;
    background: transparent;
    padding-left: 2.5rem;
    font-size: 1rem;
    box-sizing: border-box;
  }
  .input-with-icon input:focus {
    outline: none !important;
    box-shadow: none;
    border: none;
  }

  /* Provider list (dropdown-like) kept separate beneath the bar */
  .provider-list { margin-top:.5rem; display:flex; gap:.5rem; flex-wrap:wrap; visibility: hidden; transition: all 0.5s ease; }
  .provider-list.visible { visibility: visible; }
  .provider-list-button { display:flex; align-items:center; gap:.5rem; }
  .provider-list-img { width:1rem; height:1rem; border-radius:2px; }

  /* Tweak open-new button padding */
  .open-new { padding:.45rem .6rem; }

  /* Focus outline for keyboard users */
  .msc-row > button:focus,
  .input-with-icon input:focus {
    outline: 2px solid rgba(0,123,255,0.12);
    outline-offset: 2px;
  }

  /* Remove click/focus visual effects for the provider toggle specifically */
  .provider-button,
  .provider-button:focus,
  .provider-button:active,
  .provider-button:focus-visible {
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
  }
</style>
