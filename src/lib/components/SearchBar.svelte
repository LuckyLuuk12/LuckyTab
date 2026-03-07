<!-- @component
no description yet
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { addHistory, settings, setProviderOrder } from "$lib/stores";
  import { DEFAULT_PINNED_SITES } from "$lib/constants";
  import { DEFAULT_PROVIDERS, type Provider } from "$lib/providerConfig";

  const providers = DEFAULT_PROVIDERS;

  // Debounce helper for performance
  function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delay: number,
  ): T {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return ((...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    }) as T;
  }

  // Svelte 5 runes for local reactive state
  let selectedProviderId = $state("google"); // Track provider by ID instead of index
  let query = $state("");
  let openNew = $state(false);
  let providersVisible = $state(false);

  // Drag-n-drop state
  let draggedIndex = $state<number | null>(null);

  // Track if component has mounted to avoid hydration mismatch
  let mounted = $state(false);

  // Ordered providers based on settings (or default order)
  // Only apply custom order after mounting to avoid SSR/client mismatch
  let orderedProviders = $derived.by(() => {
    // Always use default order during SSR
    if (!mounted || !browser) {
      return providers;
    }

    const savedOrder = $settings.providerOrder;
    if (!savedOrder || savedOrder.length === 0) {
      return providers; // Use default order
    }

    // Reorder providers based on saved order
    const ordered = savedOrder
      .map((id) => providers.find((p) => p.id === id))
      .filter((p): p is Provider => p !== undefined);

    // Add any new providers not in saved order (for backwards compatibility)
    const missingProviders = providers.filter(
      (p) => !savedOrder.includes(p.id),
    );

    return [...ordered, ...missingProviders];
  });

  // Derive index and selection from the provider ID
  let selectedIndex = $derived(
    orderedProviders.findIndex((p) => p.id === selectedProviderId),
  );
  let selected = $derived(
    orderedProviders.find((p) => p.id === selectedProviderId) ||
      orderedProviders[0],
  );

  // Autocomplete suggestions
  type Suggestion = {
    url: string;
    displayText: string;
    count: number;
  };
  let suggestions = $state<Suggestion[]>([]);
  let suggestionsVisible = $state(false);
  let selectedSuggestionIndex = $state(-1);

  let inputEl = $state<HTMLInputElement | null>(null);
  // history browsing state
  let historyList = $state<Array<any>>([]);
  let historyPos = $state(-1); // -1 = not browsing, 0 = most recent
  let originalTyped = $state("");

  // Debounce for scroll events
  let lastScrollTime = $state(0);

  // keep a local filtered history (search/visit entries only)
  // Use $effect to reactively update when settings change
  $effect(() => {
    historyList = ($settings.history || []).filter(
      (h) => h && (h.type === "search" || h.type === "visit"),
    );
    // reset browsing state if history changed
    historyPos = -1;
    originalTyped = "";
  });

  onMount(() => {
    mounted = true;
    if (browser && inputEl) inputEl.focus();
  });

  function updateSuggestions(input: string) {
    if (!input.trim()) {
      suggestions = [];
      suggestionsVisible = false;
      selectedSuggestionIndex = -1;
      return;
    }

    const inputLower = input.toLowerCase();

    // Aggregate by URL/query, count occurrences and track most recent query
    const urlMap = new Map<
      string,
      {
        displayText: string;
        count: number;
        lastTimestamp: number;
        isPinned: boolean;
      }
    >();

    // First, check pinned sites for matches (fuzzy case-insensitive)
    const pinnedSites =
      $settings.pinned && $settings.pinned.length > 0
        ? $settings.pinned
        : DEFAULT_PINNED_SITES;

    pinnedSites.forEach((site) => {
      if (!site || !site.url) return;

      const titleLower = (site.title || "").toLowerCase();
      const urlLower = (site.url || "").toLowerCase();

      if (titleLower.includes(inputLower) || urlLower.includes(inputLower)) {
        urlMap.set(site.url, {
          displayText: site.title || site.url,
          count: 10, // Give pinned sites higher weight
          lastTimestamp: Date.now(), // Treat as recent
          isPinned: true,
        });
      }
    });

    // Then aggregate history entries
    historyList.forEach((item) => {
      const url = item.url || item.query;
      if (!url) return;

      // Check if URL or query matches the input (case-insensitive)
      const urlLower = url.toLowerCase();
      const queryLower = (item.query || "").toLowerCase();

      if (urlLower.includes(inputLower) || queryLower.includes(inputLower)) {
        const existing = urlMap.get(url);
        if (existing) {
          // Update existing entry (might be from pinned sites)
          urlMap.set(url, {
            displayText: item.query || existing.displayText || url,
            count: existing.count + 1,
            lastTimestamp: Math.max(existing.lastTimestamp, item.time || 0),
            isPinned: existing.isPinned,
          });
        } else {
          // New entry from history
          urlMap.set(url, {
            displayText: item.query || url,
            count: 1,
            lastTimestamp: item.time || 0,
            isPinned: false,
          });
        }
      }
    });

    // Sort by frequency (count) first, then by recency, limit to top 5
    const sorted = Array.from(urlMap.entries())
      .map(([url, data]) => ({
        url,
        displayText: data.displayText,
        count: data.count,
        lastTimestamp: data.lastTimestamp,
      }))
      .sort((a, b) => {
        // Primary sort: by count (frequency)
        if (b.count !== a.count) return b.count - a.count;
        // Secondary sort: by recency
        return b.lastTimestamp - a.lastTimestamp;
      })
      .slice(0, 5);

    suggestions = sorted;
    suggestionsVisible = sorted.length > 0;
    selectedSuggestionIndex = -1;
  }

  // Debounced version of updateSuggestions for better performance
  const debouncedUpdateSuggestions = debounce(updateSuggestions, 150);

  function handleInput() {
    // user manually edited the input -> exit history browsing mode
    historyPos = -1;
    originalTyped = "";

    // Update autocomplete suggestions (debounced to avoid excessive computation)
    debouncedUpdateSuggestions(query);
  }

  function selectSuggestion(suggestion: Suggestion) {
    query = suggestion.url;
    suggestions = [];
    suggestionsVisible = false;
    selectedSuggestionIndex = -1;
  }

  function cycleProvider(direction: number) {
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex =
      (currentIndex + direction + orderedProviders.length) %
      orderedProviders.length;
    selectedProviderId = orderedProviders[nextIndex].id;
  }

  function handleProviderScroll(e: WheelEvent) {
    // Check if provider scroll is enabled
    if ($settings.enableProviderScroll === false) return;

    e.preventDefault();
    e.stopPropagation();

    // Debounce to prevent rapid-fire scrolling (mouse wheel can fire multiple events)
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;
    if (timeSinceLastScroll < 300) return; // 300ms debounce
    lastScrollTime = now;

    // Positive deltaY = scroll down = previous provider
    // Negative deltaY = scroll up = next provider
    cycleProvider(e.deltaY > 0 ? -1 : 1);
  }

  function handleKeydown(e: KeyboardEvent) {
    // Handle autocomplete navigation if suggestions are visible
    if (suggestionsVisible && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSuggestionIndex =
          selectedSuggestionIndex < suggestions.length - 1
            ? selectedSuggestionIndex + 1
            : selectedSuggestionIndex;
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSuggestionIndex =
          selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : -1;
        return;
      } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedSuggestionIndex]);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        suggestions = [];
        suggestionsVisible = false;
        selectedSuggestionIndex = -1;
        return;
      } else if (e.key === "Tab" && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedSuggestionIndex]);
        return;
      }
    }

    // handle arrow up/down for history navigation
    if (!inputEl) return;
    const caret = inputEl.selectionStart ?? 0;
    if (e.key === "ArrowUp") {
      // If not already browsing history, only intercept when caret at start or input empty.
      if (historyList.length === 0) return;
      if (historyPos === -1 && caret !== 0 && inputEl.value.trim() !== "")
        return;
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
        query = "";
        // caret to end (empty)
        setTimeout(() => inputEl && inputEl.setSelectionRange(0, 0), 0);
        return;
      }
      const entry = historyList[historyPos];
      query = entry.query ?? entry.url ?? "";
      // move caret to end
      setTimeout(
        () =>
          inputEl &&
          inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length),
        0,
      );
    } else if (e.key === "ArrowDown") {
      if (historyPos === -1) return;
      e.preventDefault();
      if (historyPos > 0) {
        historyPos -= 1;
        const entry = historyList[historyPos];
        query = entry.query ?? entry.url ?? "";
      } else {
        // leave history browsing and restore original typed value
        historyPos = -1;
        query = originalTyped;
        originalTyped = "";
      }
      setTimeout(
        () =>
          inputEl &&
          inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length),
        0,
      );
    }
  }

  function selectProvider(p: Provider) {
    selectedProviderId = p.id;
    providersVisible = false;
  }

  // Drag-n-drop handlers
  function handleDragStart(e: DragEvent, index: number) {
    draggedIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      draggedIndex = null;
      return;
    }

    // Reorder the providers array
    const newOrder = [...orderedProviders];
    const [draggedProvider] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedProvider);

    // Save the new order to settings
    const newOrderIds = newOrder.map((p) => p.id);
    setProviderOrder(newOrderIds);

    // No need to manually update selection - selectedProviderId tracks it automatically!

    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }

  function submitForm(e: Event) {
    e.preventDefault();
    const q = query;
    const p = selected;
    if (!p || !q.trim()) return;

    // Helper: detect if the input looks like a URI
    function isLikelyURI(s: string) {
      const t = s.trim();
      if (!t) return false;
      // has a scheme like http:// or ftp://
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t)) return true;
      // avoid treating phrases with spaces as URLs
      if (t.includes(" ")) return false;
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
      try {
        addHistory({
          type: "visit",
          provider: "direct",
          query: q,
          url: urlStr,
        });
      } catch (e) {}
      if (openNew) window.open(urlStr, "_blank");
      else window.location.href = urlStr;
      return;
    }

    // Build URL for selected provider
    const url = new URL(p.action);
    if (p.id === "allkeyshop") {
      // special handling: append query param to path
      url.searchParams.set(p.param ?? "search_name", q);
    } else if (p.id === "googlemaps") {
      // Google Maps needs api=1 parameter
      url.searchParams.set("api", "1");
      url.searchParams.set(p.param ?? "query", q);
    } else if (p.action.endsWith("/")) {
      // some endpoints like duckduckgo accept q in path
      url.searchParams.set(p.param ?? "q", q);
    } else {
      url.searchParams.set(p.param ?? "q", q);
    }
    // record to history
    try {
      addHistory({
        type: "search",
        provider: p.id,
        query: q,
        url: url.toString(),
      });
    } catch (e) {}

    // open
    if (openNew) window.open(url.toString(), "_blank");
    else window.location.href = url.toString();
  }
</script>

<form class="multi-search-container" onsubmit={submitForm}>
  <!-- Provider list moved above searchbar -->
  <div
    class="provider-list"
    class:visible={providersVisible}
    aria-hidden={!providersVisible}
  >
    {#each orderedProviders as p, idx (p.id)}
      <button
        type="button"
        class="hollow provider-list-button"
        class:dragging={draggedIndex === idx}
        draggable={$settings.enableProviderReorder ?? true}
        ondragstart={(e) => {
          if ($settings.enableProviderReorder ?? true) handleDragStart(e, idx);
        }}
        ondragover={(e) => {
          if ($settings.enableProviderReorder ?? true) handleDragOver(e, idx);
        }}
        ondrop={(e) => {
          if ($settings.enableProviderReorder ?? true) handleDrop(e, idx);
        }}
        ondragend={handleDragEnd}
        onclick={() => selectProvider(p)}
        title={p.name}
      >
        {#if $settings.enableProviderReorder ?? true}
          <i class="fa fa-grip-vertical drag-handle" aria-hidden="true"></i>
        {/if}
        {#if typeof p.icon !== "string"}
          <enhanced:img class="provider-list-img" src={p.icon} alt={p.name} />
        {:else}
          <img class="provider-list-img" src={p.icon} alt={p.name} />
        {/if}
        <span class="provider-name">{p.name}</span>
      </button>
    {/each}
  </div>

  <div class="msc-row">
    <button
      type="button"
      class="primary hollow provider-button"
      aria-label={`Provider: ${selected.name}`}
      onclick={() => (providersVisible = !providersVisible)}
      onwheel={handleProviderScroll}
    >
      {#if selected}
        {#if typeof selected.icon !== "string"}
          <enhanced:img
            class="provider-img"
            src={selected.icon}
            alt={selected.name}
          />
        {:else}
          <img class="provider-img" src={selected.icon} alt={selected.name} />
        {/if}
      {/if}
    </button>

    <div class="input-with-icon">
      <i class="fa fa-search search-icon" aria-hidden="true"></i>
      <input
        bind:this={inputEl}
        bind:value={query}
        type="text"
        placeholder="Search..."
        oninput={handleInput}
        onkeydown={handleKeydown}
      />
    </div>

    <button
      type="submit"
      class="primary hollow search-submit"
      aria-label="Search"
    >
      <i class="fa fa-search" aria-hidden="true"></i>
    </button>

    <button
      type="button"
      title={openNew ? "Open links in same tab" : "Open links in new tab"}
      onclick={() => (openNew = !openNew)}
      class="tertiary hollow open-new"
      aria-pressed={openNew}
      aria-label={openNew ? "Open links in same tab" : "Open links in new tab"}
    >
      <i
        class={openNew ? "fa fa-external-link-alt" : "fa fa-window-maximize"}
        aria-hidden="true"
      ></i>
    </button>
  </div>

  <!-- Autocomplete suggestions dropdown - now directly below searchbar -->
  {#if suggestionsVisible && suggestions.length > 0}
    <div class="suggestions-dropdown">
      {#each suggestions as suggestion, idx}
        <button
          type="button"
          class="suggestion-item"
          class:selected={idx === selectedSuggestionIndex}
          onclick={() => selectSuggestion(suggestion)}
          onmouseenter={() => (selectedSuggestionIndex = idx)}
        >
          <i class="fa fa-history suggestion-icon" aria-hidden="true"></i>
          <div class="suggestion-content">
            <div class="suggestion-text">{suggestion.displayText}</div>
            {#if suggestion.displayText !== suggestion.url}
              <div class="suggestion-url">{suggestion.url}</div>
            {/if}
          </div>
          {#if suggestion.count > 1}
            <span
              class="suggestion-count"
              title="Visited {suggestion.count} times"
            >
              {suggestion.count}×
            </span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</form>

<style>
  /* Container: make everything sit 'inside' a single bar */
  .multi-search-container {
    width: 100%;
    position: relative;
  }
  .multi-search-container button {
    cursor: pointer;
  }

  .msc-row {
    display: flex;
    align-items: center;
    gap: 0; /* items sit flush */
    width: 100%;
    background: var(--card, #888888);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.75rem;
    padding: 0.5rem; /* inner gutter */
    box-sizing: border-box;
  }

  /* when any child inside is focused, highlight the whole bar */
  .msc-row:focus-within {
    border-color: var(--dark-400, #0d6efd);
    box-shadow: 0 4px 10px rgba(13, 110, 253, 0.1);
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
  .provider-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .provider-img {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 3px;
    display: block;
  }

  /* Input area stretches to fill available space */
  .input-with-icon {
    position: relative;
    flex: 1;
    margin: 0 0.35rem;
  }
  .input-with-icon .search-icon {
    position: absolute;
    left: 0.65rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--placeholder, #999);
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

  /* Provider list (dropdown-like) now above the bar */
  .provider-list {
    margin-bottom: 0.5rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    visibility: hidden;
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  .provider-list.visible {
    visibility: visible;
    opacity: 1;
    max-height: 200px;
  }
  .provider-list-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: grab;
    transition:
      opacity 0.2s,
      transform 0.2s,
      background 0.15s,
      border-color 0.15s;
    padding: 0.35rem 0.55rem;
    border-radius: 0.5rem;
    background: var(--card, #f8f9fa);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  .provider-list-button:hover {
    background: var(--card-hover, #f1f3f5);
    border-color: rgba(0, 0, 0, 0.12);
  }

  .provider-list-button:active {
    cursor: grabbing;
  }

  .provider-list-button.dragging {
    opacity: 0.5;
    transform: scale(0.95);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .drag-handle {
    color: var(--placeholder, #999);
    font-size: 0.75rem;
    cursor: grab;
    opacity: 0.6;
    transition: opacity 0.15s;
  }

  .provider-list-button:hover .drag-handle {
    opacity: 1;
  }

  .provider-list-button:active .drag-handle {
    cursor: grabbing;
  }

  .provider-list-img {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 3px;
  }

  .provider-name {
    font-size: 0.9rem;
    font-weight: 500;
  }

  /* Tweak open-new button padding */
  .open-new {
    padding: 0.45rem 0.6rem;
  }

  /* Focus outline for keyboard users */
  .msc-row > button:focus,
  .input-with-icon input:focus {
    outline: 2px solid rgba(0, 123, 255, 0.12);
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

  /* Autocomplete suggestions dropdown */
  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: var(--card, #888888);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
  }

  .suggestion-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 2rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .suggestion-item:hover,
  .suggestion-item.selected {
    background: rgba(0, 0, 0, 0.05);
  }

  .suggestion-item:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .suggestion-icon {
    color: var(--placeholder, #999);
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .suggestion-content {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .suggestion-text {
    font-size: 1rem;
    color: var(--text, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-url {
    font-size: 0.85rem;
    color: var(--placeholder, #999);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.15rem;
  }

  .suggestion-count {
    color: var(--placeholder, #999);
    font-size: 0.85rem;
    font-weight: 500;
    flex-shrink: 0;
  }
</style>
