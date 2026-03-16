<!-- @component
no description yet
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { addHistory, settings, setProviderOrder } from "$lib/stores";
  import { DEFAULT_PINNED_SITES } from "$lib/constants";
  import { DEFAULT_PROVIDERS, type Provider } from "$lib/providerConfig";
  import { evaluateMathExpression } from "$lib/math";

  const providers = DEFAULT_PROVIDERS;

  // Svelte 5 runes for local reactive state
  let selectedProviderId = $state("google"); // Track provider by ID instead of index
  let query = $state("");
  let openNew = $state(false);
  let providersVisible = $state(false);

  // Drag-n-drop state
  let draggedIndex = $state<number | null>(null);

  // Track if component has mounted to avoid hydration mismatch
  let mounted = $state(false);

  // URL safety check state
  let safetyCheckPending = $state(false);
  let blockedUrlInfo = $state<{ url: string; rating: string } | null>(null);
  let skippedUrlInfo = $state<{ url: string } | null>(null);
  let urlSafetyIndicator = $state<{
    status: "checking" | "safe" | "unsafe" | "unknown";
    url: string;
    rating?: string;
  } | null>(null);
  let urlSafetyPreviewVersion = 0;
  let lastPreviewCheckedUrl = $state<string | null>(null);
  let lastPreviewApiKey = $state("");

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
  type SuggestionKind = "history" | "math";
  type Suggestion = {
    kind: SuggestionKind;
    url: string;
    displayText: string;
    count: number;
    isPinned?: boolean;
    mathResult?: string;
  };
  const INITIAL_VISIBLE_SUGGESTIONS = 5;
  const SUGGESTION_BATCH_SIZE = 5;
  const MAX_LOADED_SUGGESTIONS = 20;
  const WINDOW_EDGE_BUFFER = 4;

  let allSuggestions = $state<Suggestion[]>([]);
  let suggestions = $state<Suggestion[]>([]);
  let suggestionsVisible = $state(false);
  let selectedSuggestionIndex = $state(-1);
  let loadedStartIndex = $state(0);
  let loadedSuggestionCount = $state(0);

  let suggestionsDropdownEl = $state<HTMLDivElement | null>(null);
  let suggestionsListEl = $state<HTMLDivElement | null>(null);

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

  // Debounced URL safety preview while typing direct URLs.
  $effect(() => {
    const previewUrl = getPreviewUrl(query);
    const apiKey = $settings.safeBrowsingApiKey?.trim() ?? "";

    if (!previewUrl || safetyCheckPending) {
      urlSafetyIndicator = null;
      return;
    }

    // Prevent repeated checks when focus/blur or unrelated state updates rerun this effect.
    if (previewUrl === lastPreviewCheckedUrl && apiKey === lastPreviewApiKey) {
      return;
    }

    const thisRun = ++urlSafetyPreviewVersion;
    const timeoutId = setTimeout(async () => {
      if (thisRun !== urlSafetyPreviewVersion) return;
      urlSafetyIndicator = { status: "checking", url: previewUrl };
      const { verdict, rating } = await checkUrlSafety(previewUrl);
      if (thisRun !== urlSafetyPreviewVersion) return;

      lastPreviewCheckedUrl = previewUrl;
      lastPreviewApiKey = apiKey;

      if (verdict === "safe") {
        urlSafetyIndicator = {
          status: "safe",
          url: previewUrl,
          rating: rating || "Safe",
        };
      } else if (verdict === "unsafe") {
        urlSafetyIndicator = {
          status: "unsafe",
          url: previewUrl,
          rating: rating || "Unsafe",
        };
      } else {
        urlSafetyIndicator = {
          status: "unknown",
          url: previewUrl,
        };
      }
    }, 1200);

    return () => {
      clearTimeout(timeoutId);
      urlSafetyPreviewVersion++;
    };
  });

  onMount(() => {
    mounted = true;
    if (browser && inputEl) inputEl.focus();
  });

  function parseSearchCommand(input: string): {
    providerId: Provider["id"] | "wiki";
    query: string;
  } | null {
    const match = input.trimStart().match(/^(yt|maps|aks|wiki)\s+(.+)$/i);
    if (!match) return null;

    const command = match[1].toLowerCase();
    const commandQuery = match[2].trim();
    if (!commandQuery) return null;

    if (command === "yt") return { providerId: "youtube", query: commandQuery };
    if (command === "maps") {
      return { providerId: "googlemaps", query: commandQuery };
    }
    if (command === "aks") {
      return { providerId: "allkeyshop", query: commandQuery };
    }
    if (command === "wiki") return { providerId: "wiki", query: commandQuery };

    return null;
  }

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

  function getPreviewUrl(input: string) {
    if (parseSearchCommand(input)) return null;
    if (!isLikelyURI(input)) return null;
    return ensureUrl(input);
  }

  function getUrlSafetyIndicatorTitle() {
    if (!urlSafetyIndicator) return "";
    if (urlSafetyIndicator.status === "checking") return "Checking site...";
    if (urlSafetyIndicator.status === "safe") return "Safe site";
    if (urlSafetyIndicator.status === "unsafe") return "Unsafe site";
    return "Unknown risk";
  }

  async function copyToClipboard(text: string) {
    if (!browser || !navigator?.clipboard) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function getLoadCap() {
    return Math.min(MAX_LOADED_SUGGESTIONS, allSuggestions.length);
  }

  function syncVisibleSuggestions() {
    suggestions = allSuggestions.slice(
      loadedStartIndex,
      loadedStartIndex + loadedSuggestionCount,
    );
    suggestionsVisible = suggestions.length > 0;
  }

  function loadMoreSuggestions(batchSize = SUGGESTION_BATCH_SIZE) {
    const cap = getLoadCap();
    if (allSuggestions.length === 0) return false;

    if (loadedSuggestionCount < cap) {
      loadedSuggestionCount = Math.min(loadedSuggestionCount + batchSize, cap);
      syncVisibleSuggestions();
      return true;
    }

    const maxStart = Math.max(0, allSuggestions.length - loadedSuggestionCount);
    if (loadedStartIndex >= maxStart) return false;

    loadedStartIndex = Math.min(loadedStartIndex + batchSize, maxStart);
    syncVisibleSuggestions();
    return true;
  }

  function ensureSuggestionLoaded(index: number) {
    const total = allSuggestions.length;
    if (index < 0 || total === 0) return;

    const cap = getLoadCap();
    if (loadedSuggestionCount === 0) {
      loadedSuggestionCount = Math.min(INITIAL_VISIBLE_SUGGESTIONS, cap);
    }

    if (loadedSuggestionCount < cap) {
      while (
        loadedSuggestionCount < cap &&
        (index < loadedStartIndex ||
          index >= loadedStartIndex + loadedSuggestionCount)
      ) {
        loadedSuggestionCount = Math.min(
          loadedSuggestionCount + SUGGESTION_BATCH_SIZE,
          cap,
        );
      }
    }

    const maxStart = Math.max(0, total - loadedSuggestionCount);
    if (index < loadedStartIndex) {
      loadedStartIndex = Math.max(0, index - WINDOW_EDGE_BUFFER);
    } else if (index >= loadedStartIndex + loadedSuggestionCount) {
      loadedStartIndex = Math.min(
        maxStart,
        index - loadedSuggestionCount + 1 + WINDOW_EDGE_BUFFER,
      );
    } else {
      const lowerEdge = loadedStartIndex + WINDOW_EDGE_BUFFER;
      const upperEdge =
        loadedStartIndex + loadedSuggestionCount - 1 - WINDOW_EDGE_BUFFER;

      if (index <= lowerEdge && loadedStartIndex > 0) {
        loadedStartIndex = Math.max(0, index - WINDOW_EDGE_BUFFER);
      } else if (index >= upperEdge && loadedStartIndex < maxStart) {
        loadedStartIndex = Math.min(
          maxStart,
          index - loadedSuggestionCount + 1 + WINDOW_EDGE_BUFFER,
        );
      }
    }

    syncVisibleSuggestions();
  }

  function scrollSelectedSuggestionIntoView() {
    if (!browser || selectedSuggestionIndex < 0) return;

    setTimeout(() => {
      const list = suggestionsListEl;
      if (!list) return;

      const selectedEl = list.querySelector(
        `[data-suggestion-index="${selectedSuggestionIndex}"]`,
      ) as HTMLElement | null;
      selectedEl?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

  function moveSuggestionSelection(direction: 1 | -1) {
    if (allSuggestions.length === 0) return;

    if (selectedSuggestionIndex < 0) {
      selectedSuggestionIndex = direction > 0 ? 0 : allSuggestions.length - 1;
    } else {
      selectedSuggestionIndex =
        (selectedSuggestionIndex + direction + allSuggestions.length) %
        allSuggestions.length;
    }

    ensureSuggestionLoaded(selectedSuggestionIndex);
    scrollSelectedSuggestionIntoView();
  }

  function handleSuggestionsScroll() {
    if (!suggestionsListEl) return;

    const thresholdPx = 28;
    const reachedBottom =
      suggestionsListEl.scrollTop + suggestionsListEl.clientHeight >=
      suggestionsListEl.scrollHeight - thresholdPx;
    const reachedTop = suggestionsListEl.scrollTop <= thresholdPx;

    if (reachedBottom) {
      loadMoreSuggestions();
      return;
    }

    if (reachedTop && loadedStartIndex > 0) {
      loadedStartIndex = Math.max(0, loadedStartIndex - SUGGESTION_BATCH_SIZE);
      syncVisibleSuggestions();
    }
  }

  function getSuggestionHostname(rawUrl: string) {
    const value = rawUrl.trim();
    if (!value) return null;

    try {
      const maybeUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)
        ? value
        : `https://${value}`;
      const parsed = new URL(maybeUrl);
      return parsed.hostname || null;
    } catch {
      return null;
    }
  }

  function getSuggestionFavicon(rawUrl: string) {
    const host = getSuggestionHostname(rawUrl);
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  }

  function getSuggestionUrlPreview(rawUrl: string) {
    const host = getSuggestionHostname(rawUrl);
    return host || rawUrl;
  }

  function getSuggestionVisitLabel(suggestion: Suggestion) {
    if (suggestion.kind !== "history") return "";

    if (suggestion.isPinned && suggestion.count >= 10) {
      return ">10";
    }

    return String(suggestion.count);
  }

  function getSuggestionVisitTitle(suggestion: Suggestion) {
    if (suggestion.kind !== "history") return "";

    if (suggestion.isPinned && suggestion.count >= 10) {
      return "Pinned match with boosted score (likely visited more than 10 times).";
    }

    return `Visited ${suggestion.count} ${suggestion.count === 1 ? "time" : "times"}`;
  }

  function getMathSuggestionForShortcut(): Suggestion | null {
    if (!suggestionsVisible || allSuggestions.length === 0) return null;

    if (selectedSuggestionIndex >= 0) {
      const selectedSuggestion = allSuggestions[selectedSuggestionIndex];
      if (selectedSuggestion?.kind === "math") {
        return selectedSuggestion;
      }
    }

    const firstSuggestion = allSuggestions[0];
    if (firstSuggestion?.kind === "math") {
      return firstSuggestion;
    }

    return null;
  }

  function updateSuggestions(input: string) {
    const command = parseSearchCommand(input);
    const effectiveInput = command ? command.query : input;
    const trimmedInput = effectiveInput.trim();

    if (!trimmedInput) {
      allSuggestions = [];
      loadedStartIndex = 0;
      loadedSuggestionCount = 0;
      suggestions = [];
      suggestionsVisible = false;
      selectedSuggestionIndex = -1;
      return;
    }

    const inputLower = trimmedInput.toLowerCase();
    const localSuggestions: Suggestion[] = [];

    const mathEvaluation = evaluateMathExpression(trimmedInput);
    if (mathEvaluation.ok) {
      localSuggestions.push({
        kind: "math",
        url: trimmedInput,
        displayText: `${trimmedInput} = ${mathEvaluation.result}`,
        count: 0,
        mathResult: mathEvaluation.result,
      });
    }

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

    // Sort by frequency (count) first, then by recency.
    const sorted = Array.from(urlMap.entries())
      .map(([url, data]) => ({
        kind: "history" as const,
        url,
        displayText: data.displayText,
        count: data.count,
        isPinned: data.isPinned,
        lastTimestamp: data.lastTimestamp,
      }))
      .sort((a, b) => {
        // Primary sort: by count (frequency)
        if (b.count !== a.count) return b.count - a.count;
        // Secondary sort: by recency
        return b.lastTimestamp - a.lastTimestamp;
      });

    localSuggestions.push(...sorted);

    allSuggestions = localSuggestions;
    loadedStartIndex = 0;
    loadedSuggestionCount = Math.min(INITIAL_VISIBLE_SUGGESTIONS, getLoadCap());
    syncVisibleSuggestions();
    selectedSuggestionIndex = -1;
  }

  function handleInput() {
    // user manually edited the input -> exit history browsing mode
    historyPos = -1;
    originalTyped = "";

    // Update autocomplete suggestions on every input change
    updateSuggestions(query);
  }

  async function selectSuggestion(suggestion: Suggestion) {
    if (suggestion.kind === "math") {
      if (suggestion.mathResult) {
        await copyToClipboard(suggestion.mathResult);
      }
      allSuggestions = [];
      loadedStartIndex = 0;
      loadedSuggestionCount = 0;
      suggestions = [];
      suggestionsVisible = false;
      selectedSuggestionIndex = -1;
      return;
    }

    query = suggestion.url;
    allSuggestions = [];
    loadedStartIndex = 0;
    loadedSuggestionCount = 0;
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
    if (!inputEl) return;

    // Math copy shortcuts:
    // Ctrl+C copies result, Ctrl+Shift+C copies "formula = result".
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      const hasSelection =
        (inputEl.selectionStart ?? 0) !== (inputEl.selectionEnd ?? 0);
      if (!hasSelection) {
        const mathSuggestion = getMathSuggestionForShortcut();
        if (mathSuggestion?.mathResult) {
          e.preventDefault();
          const copiedText = e.shiftKey
            ? `${mathSuggestion.url} = ${mathSuggestion.mathResult}`
            : mathSuggestion.mathResult;
          void copyToClipboard(copiedText);
          return;
        }
      }
    }

    // Handle autocomplete navigation if suggestions are visible
    if (suggestionsVisible && allSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSuggestionSelection(1);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSuggestionSelection(-1);
        return;
      } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
        const selectedSuggestion = allSuggestions[selectedSuggestionIndex];
        if (selectedSuggestion.kind === "math") {
          // Let Enter perform the normal submit behavior for the current query.
          return;
        }
        e.preventDefault();
        void selectSuggestion(selectedSuggestion);
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        allSuggestions = [];
        loadedStartIndex = 0;
        loadedSuggestionCount = 0;
        suggestions = [];
        suggestionsVisible = false;
        selectedSuggestionIndex = -1;
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        moveSuggestionSelection(e.shiftKey ? -1 : 1);
        return;
      }
    }

    // handle arrow up/down for history navigation
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

  async function checkUrlSafety(
    urlStr: string,
  ): Promise<{ verdict: "safe" | "unsafe" | "skip"; rating: string }> {
    const apiKey = $settings.safeBrowsingApiKey?.trim();
    if (!apiKey) return { verdict: "skip", rating: "" };

    try {
      const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify({
          client: { clientId: "luckytab", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: urlStr }],
          },
        }),
      });
      if (!res.ok) return { verdict: "skip", rating: "" };
      const data = await res.json();
      // Empty matches object means the URL is safe
      if (!data.matches || data.matches.length === 0)
        return { verdict: "safe", rating: "Safe" };
      const type: string = data.matches[0]?.threatType ?? "Unsafe";
      const label = type
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      return { verdict: "unsafe", rating: label };
    } catch {
      return { verdict: "skip", rating: "" };
    }
  }

  async function submitForm(e: Event) {
    e.preventDefault();
    const command = parseSearchCommand(query);
    const q = command ? command.query : query;

    if (command?.providerId === "wiki") {
      const wikiUrl = new URL("https://en.wikipedia.org/w/index.php");
      wikiUrl.searchParams.set("search", q);

      try {
        addHistory({
          type: "search",
          provider: "wiki",
          query: q,
          url: wikiUrl.toString(),
        });
      } catch (e) {}

      if (openNew) window.open(wikiUrl.toString(), "_blank");
      else window.location.href = wikiUrl.toString();
      return;
    }

    const p = command
      ? orderedProviders.find(
          (provider) => provider.id === command.providerId,
        ) || selected
      : selected;
    if (!p || !q.trim()) return;

    if (command) {
      selectedProviderId = p.id;
    }

    // If the user entered a URI, go there directly regardless of provider
    if (!command && isLikelyURI(q)) {
      const urlStr = ensureUrl(q);
      safetyCheckPending = true;
      const { verdict, rating } = await checkUrlSafety(urlStr);
      safetyCheckPending = false;
      if (verdict === "unsafe") {
        blockedUrlInfo = { url: urlStr, rating };
        return;
      }
      if (verdict === "skip") {
        // Check was blocked (e.g. uBlock) or timed out — require explicit confirmation
        skippedUrlInfo = { url: urlStr };
        return;
      }
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
      {#if urlSafetyIndicator}
        <span
          class="url-safety-indicator"
          class:checking={urlSafetyIndicator.status === "checking"}
          class:safe={urlSafetyIndicator.status === "safe"}
          class:unsafe={urlSafetyIndicator.status === "unsafe"}
          class:unknown={urlSafetyIndicator.status === "unknown"}
          aria-label={getUrlSafetyIndicatorTitle()}
        >
          {#if urlSafetyIndicator.status === "checking"}
            <i class="fa fa-spinner fa-spin" aria-hidden="true"></i>
          {:else if urlSafetyIndicator.status === "safe"}
            <i class="fa fa-check-circle" aria-hidden="true"></i>
          {:else if urlSafetyIndicator.status === "unsafe"}
            <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
          {:else}
            <i class="fa fa-question-circle" aria-hidden="true"></i>
          {/if}
          <span class="url-safety-tooltip">{getUrlSafetyIndicatorTitle()}</span>
        </span>
      {/if}
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
  {#if safetyCheckPending}
    <div class="safety-checking">
      <i class="fa fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Checking URL safety via Google Safe Browsing...</span>
    </div>
  {/if}

  {#if skippedUrlInfo}
    <div class="safety-warning safety-warning-amber" role="alert">
      <div class="safety-warning-header safety-warning-header-amber">
        <i class="fa fa-question-circle" aria-hidden="true"></i>
        <span
          >Safety check unavailable — Google Safe Browsing could not be reached</span
        >
      </div>
      <div class="safety-warning-url">{skippedUrlInfo.url}</div>
      <div class="safety-actions">
        <button
          type="button"
          class="safety-proceed safety-proceed-amber"
          onclick={() => {
            const urlStr = skippedUrlInfo!.url;
            skippedUrlInfo = null;
            try {
              addHistory({
                type: "visit",
                provider: "direct",
                query: urlStr,
                url: urlStr,
              });
            } catch {}
            if (openNew) window.open(urlStr, "_blank");
            else window.location.href = urlStr;
          }}
        >
          <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
          Visit anyway
        </button>
        <button
          type="button"
          class="safety-cancel"
          onclick={() => (skippedUrlInfo = null)}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if blockedUrlInfo}
    <div class="safety-warning" role="alert">
      <div class="safety-warning-header">
        <i class="fa fa-shield-alt" aria-hidden="true"></i>
        <span
          >Google Safe Browsing flagged this URL as <strong
            >{blockedUrlInfo.rating}</strong
          ></span
        >
      </div>
      <div class="safety-warning-url">{blockedUrlInfo.url}</div>
      <div class="safety-actions">
        <button
          type="button"
          class="safety-proceed"
          onclick={() => {
            const urlStr = blockedUrlInfo!.url;
            blockedUrlInfo = null;
            try {
              addHistory({
                type: "visit",
                provider: "direct",
                query: urlStr,
                url: urlStr,
              });
            } catch {}
            if (openNew) window.open(urlStr, "_blank");
            else window.location.href = urlStr;
          }}
        >
          <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
          Visit anyway
        </button>
        <button
          type="button"
          class="safety-cancel"
          onclick={() => (blockedUrlInfo = null)}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if suggestionsVisible && suggestions.length > 0}
    <div class="suggestions-dropdown" bind:this={suggestionsDropdownEl}>
      <div
        class="suggestions-list"
        bind:this={suggestionsListEl}
        onscroll={handleSuggestionsScroll}
      >
        {#each suggestions as suggestion, idx}
          {@const globalIndex = loadedStartIndex + idx}
          <button
            type="button"
            class="suggestion-item"
            class:selected={globalIndex === selectedSuggestionIndex}
            data-suggestion-index={globalIndex}
            onclick={() => selectSuggestion(suggestion)}
            onmouseenter={() => (selectedSuggestionIndex = globalIndex)}
          >
            {#if suggestion.kind === "math"}
              <i class="fa fa-calculator suggestion-icon" aria-hidden="true"
              ></i>
            {:else}
              {@const favicon = getSuggestionFavicon(suggestion.url)}
              {#if favicon}
                <img
                  class="suggestion-favicon"
                  src={favicon}
                  alt=""
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              {:else}
                <i class="fa fa-history suggestion-icon" aria-hidden="true"></i>
              {/if}
            {/if}
            <div class="suggestion-content">
              <div class="suggestion-text">{suggestion.displayText}</div>
              {#if suggestion.kind === "math"}
                <div class="suggestion-subtext">
                  Ctrl+C copy result, Ctrl+Shift+C copy formula = result
                </div>
              {/if}
            </div>
            <div class="suggestion-meta">
              {#if suggestion.kind === "history"}
                <span class="suggestion-url" title={suggestion.url}
                  >{getSuggestionUrlPreview(suggestion.url)}</span
                >
                {#if suggestion.count > 1 || suggestion.isPinned}
                  <span
                    class="suggestion-count"
                    title={getSuggestionVisitTitle(suggestion)}
                  >
                    {getSuggestionVisitLabel(suggestion)}
                  </span>
                {/if}
              {/if}
            </div>
          </button>
        {/each}
      </div>

      <div class="suggestions-footer" aria-live="polite">
        <span class="footer-highlighted">
          {selectedSuggestionIndex >= 0
            ? `${selectedSuggestionIndex + 1}/${allSuggestions.length} highlighted`
            : `0/${allSuggestions.length} highlighted`}
        </span>
        <span class="footer-separator">•</span>
        <span>{loadedSuggestionCount}/{allSuggestions.length} loaded</span>
      </div>
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
    padding-right: 2rem;
    font-size: 1rem;
    box-sizing: border-box;
  }
  .url-safety-indicator {
    position: absolute;
    right: 0.65rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.95rem;
    line-height: 1;
    pointer-events: auto;
    opacity: 0.95;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: help;
  }
  .url-safety-tooltip {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.45rem);
    white-space: nowrap;
    padding: 0.3rem 0.48rem;
    border-radius: 0.45rem;
    background: rgba(16, 20, 26, 0.96);
    color: #d8e0e8;
    font-size: 0.72rem;
    letter-spacing: 0.01em;
    opacity: 0;
    transform: translateY(4px);
    transition:
      opacity 0.14s ease,
      transform 0.14s ease;
    pointer-events: none;
    z-index: 1002;
  }
  .url-safety-indicator:hover .url-safety-tooltip,
  .url-safety-indicator:focus-within .url-safety-tooltip {
    opacity: 1;
    transform: translateY(0);
  }
  .url-safety-indicator.safe {
    color: rgba(72, 185, 106, 0.95);
  }
  .url-safety-indicator.unsafe {
    color: rgba(210, 95, 95, 0.95);
  }
  .url-safety-indicator.unknown {
    color: rgba(200, 150, 40, 0.95);
  }
  .url-safety-indicator.checking {
    color: var(--placeholder, #999);
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
    max-height: 14.5rem;
    overflow: hidden;
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .suggestions-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 0.25rem;
  }

  .suggestion-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
    scroll-margin-bottom: 3.4rem;
  }

  .suggestion-item:hover,
  .suggestion-item.selected {
    background: rgba(255, 255, 255, 0.22);
  }

  .suggestion-item:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .suggestion-icon {
    color: var(--placeholder, #999);
    font-size: 0.9rem;
    flex-shrink: 0;
    width: 1rem;
    text-align: center;
  }

  .suggestion-content {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .suggestion-text {
    font-size: 1rem;
    color: var(--text, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-favicon {
    width: 1rem;
    height: 1rem;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .suggestion-meta {
    margin-left: auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 45%;
  }

  .suggestion-url {
    font-size: 0.85rem;
    color: var(--placeholder, #999);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .suggestion-subtext {
    font-size: 0.8rem;
    color: var(--placeholder, #999);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-count {
    color: var(--text, #333);
    background: rgba(255, 255, 255, 0.4);
    border-radius: 999px;
    padding: 0.1rem 0.45rem;
    font-size: 0.85rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .suggestions-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(16, 20, 26, 0.96);
    backdrop-filter: blur(6px);
    font-size: 0.78rem;
    color: var(--placeholder, #bcc6cf);
  }

  .footer-highlighted {
    color: var(--dark-400, #0d6efd);
    font-weight: 600;
  }

  .footer-separator {
    opacity: 0.6;
  }

  /* URL safety check UI */
  .safety-checking {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 1rem;
    background: var(--card, #888888);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.75rem;
    font-size: 0.88rem;
    color: var(--placeholder, #999);
    z-index: 1000;
  }

  .safety-warning-amber {
    border-color: rgba(180, 130, 30, 0.3);
  }

  .safety-warning-header-amber {
    color: rgba(200, 150, 40, 0.9);
  }

  .safety-proceed-amber {
    border-color: rgba(180, 130, 30, 0.3) !important;
    background: rgba(60, 45, 10, 0.12) !important;
    color: rgba(200, 150, 40, 0.9) !important;
  }

  .safety-proceed-amber:hover {
    background: rgba(60, 45, 10, 0.22) !important;
  }

  .safety-warning {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.5rem;
    background: var(--card, #888888);
    border: 1px solid rgba(180, 60, 60, 0.3);
    border-radius: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0.8rem 1rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .safety-warning-header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.93rem;
    color: rgba(200, 80, 80, 0.9);
  }

  .safety-warning-url {
    font-size: 0.82rem;
    color: var(--placeholder, #999);
    word-break: break-all;
  }

  .safety-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.2rem;
  }

  .safety-proceed {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(180, 60, 60, 0.3);
    background: rgba(72, 24, 31, 0.12);
    color: rgba(200, 80, 80, 0.85);
    font-size: 0.83rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .safety-proceed:hover {
    background: rgba(72, 24, 31, 0.22);
  }

  .safety-cancel {
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: transparent;
    color: var(--text, #333);
    font-size: 0.83rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .safety-cancel:hover {
    background: rgba(255, 255, 255, 0.12);
  }
</style>
