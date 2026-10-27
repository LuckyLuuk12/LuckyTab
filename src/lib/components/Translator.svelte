<script lang="ts">
  import { browser } from "$app/environment";
  import { addHistory, settings } from "$lib/stores";
  import type { HistoryEntry } from "$lib/types";

  let fromLang = $state($settings.defaultTranslateFrom ?? "auto");
  let toLang = $state($settings.defaultTranslateTo ?? "nl");
  let input = $state("");
  let output = $state("");
  let errorMessage = $state("");
  let isTranslating = $state(false);
  let showHistory = $state(false);

  const languages = [
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "de", name: "German" },
    { code: "fr", name: "French" },
    { code: "es", name: "Spanish" },
    { code: "it", name: "Italian" },
  ];

  const languageName = (code?: string) =>
    code === "auto"
      ? "Auto"
      : (languages.find((language) => language.code === code)?.name ??
        code ??
        "Unknown");

  let translationHistory = $derived(
    ($settings.history ?? [])
      .filter(
        (entry): entry is HistoryEntry =>
          entry.type === "translate" &&
          typeof entry.query === "string" &&
          typeof entry.result === "string",
      )
      .slice(0, 10),
  );

  $effect(() => {
    if ($settings.defaultTranslateFrom) {
      fromLang = $settings.defaultTranslateFrom;
    }
    if ($settings.defaultTranslateTo) {
      toLang = $settings.defaultTranslateTo;
    }
  });

  async function translate() {
    const q = input.trim();
    if (!q || isTranslating) return;

    const from = fromLang;
    const to = toLang;

    isTranslating = true;
    errorMessage = "";

    try {
      const url =
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx&sl=${encodeURIComponent(from)}` +
        `&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(q)}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Translation request failed (${response.status}).`);
      }

      const data = await response.json();
      const translated = Array.isArray(data?.[0])
        ? data[0]
            .map((part: unknown[]) =>
              typeof part?.[0] === "string" ? part[0] : "",
            )
            .join("")
        : "";

      if (!translated) {
        throw new Error("The translation service returned no result.");
      }

      output = translated;

      addHistory({
        type: "translate",
        from,
        to,
        query: q,
        result: translated,
      });
    } catch (error) {
      console.error("Translation failed:", error);
      errorMessage =
        error instanceof Error
          ? error.message
          : "Translation failed. Please try again.";
    } finally {
      isTranslating = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void translate();
    }
  }

  function selectHistory(entry: HistoryEntry) {
    input = entry.query ?? "";
    output = entry.result ?? "";
    fromLang = entry.from ?? "auto";
    toLang = entry.to ?? "nl";
    errorMessage = "";
    showHistory = false;
  }

  async function copyToClipboard(text: string) {
    if (!browser || !text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  function resetLanguages() {
    fromLang = "auto";
    toLang = "nl";
  }

  function swap() {
    if (fromLang === "auto") {
      fromLang = toLang;
      toLang = toLang === "nl" ? "en" : "nl";
      return;
    }

    const previousFrom = fromLang;
    fromLang = toLang;
    toLang = previousFrom;
  }

  function clearTranslator() {
    input = "";
    output = "";
    errorMessage = "";
    showHistory = false;
  }
</script>

<div class="translator">
  <div class="translator-row">
    <select bind:value={fromLang} class="grow" aria-label="Source language">
      <option value="auto">Auto</option>
      {#each languages as language (language.code)}
        <option value={language.code}>{language.name}</option>
      {/each}
    </select>

    <button
      id="switch-button"
      type="button"
      onclick={swap}
      title="Swap languages"
      aria-label="Swap languages"
    >
      <i class="fa fa-exchange-alt" aria-hidden="true"></i>
    </button>

    <select bind:value={toLang} class="grow" aria-label="Target language">
      {#each languages as language (language.code)}
        <option value={language.code}>{language.name}</option>
      {/each}
    </select>
  </div>

  <div class="history-control">
    <button
      class="history-toggle secondary hollow"
      type="button"
      onclick={() => (showHistory = !showHistory)}
      aria-expanded={showHistory}
      aria-label="Toggle translation history"
      disabled={translationHistory.length === 0}
    >
      <i class="fa fa-clock-rotate-left" aria-hidden="true"></i>
      <span>Recent translations</span>
      <i
        class="fa"
        class:fa-chevron-down={!showHistory}
        class:fa-chevron-up={showHistory}
        aria-hidden="true"
      ></i>
    </button>

    {#if showHistory}
      <div class="history-list" aria-label="Recent translations">
        {#each translationHistory as entry (entry.id)}
          <button
            type="button"
            class="history-entry"
            onclick={() => selectHistory(entry)}
            title={entry.query}
          >
            <span class="history-languages">
              {languageName(entry.from)} → {languageName(entry.to)}
            </span>
            <span class="history-query">{entry.query}</span>
            <span class="history-result">{entry.result}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <textarea
    class="translator-input"
    rows="4"
    bind:value={input}
    placeholder="Type text to translate..."
    aria-label="Text to translate"
    onkeydown={handleKeydown}
    ondblclick={() => void copyToClipboard(input)}></textarea>

  <div class="translator-actions">
    <button
      class="secondary hollow"
      type="button"
      aria-label="Reset languages"
      title="Reset languages"
      onclick={resetLanguages}
    >
      <i class="fa fa-sync-alt" aria-hidden="true"></i>
    </button>

    <button
      class="red hollow"
      type="button"
      aria-label="Clear translator"
      title="Clear translator"
      onclick={clearTranslator}
    >
      <i class="fa fa-trash" aria-hidden="true"></i>
    </button>

    <button
      class="primary hollow translate-button"
      type="button"
      onclick={() => void translate()}
      disabled={isTranslating || !input.trim()}
    >
      {isTranslating ? "Translating…" : "Translate"}
    </button>
  </div>

  {#if errorMessage}
    <p class="translation-error" role="alert">{errorMessage}</p>
  {/if}

  <textarea
    class="translator-output"
    rows="4"
    readonly
    bind:value={output}
    placeholder="Translation output"
    aria-label="Translation result"
    ondblclick={() => void copyToClipboard(output)}></textarea>
</div>

<style>
  .translator {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-width: 0;
    min-inline-size: 0;
    box-sizing: border-box;
  }

  .translator-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
  }

  select {
    min-width: 0;
    max-width: 100%;
    background: var(--card);
  }

  .grow {
    flex: 1 1 0;
    width: 0;
  }

  #switch-button {
    flex: 0 0 auto;
    color: var(--primary-700);
    font-size: 1.2rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  textarea {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    background: var(--card);
  }

  .translator-input,
  .translator-output {
    flex: 1 1 0;
    min-height: 4rem;
    resize: vertical;
    overflow: auto;
  }

  .translator-actions {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
    width: 100%;
    min-width: 0;
  }

  .translator-actions button {
    min-width: 0;
  }

  .translator-actions .translate-button {
    flex: 1 1 auto;
  }

  .red.hollow,
  .secondary.hollow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.45rem 0.65rem;
    flex: 0 0 auto;
  }

  .red.hollow {
    min-width: 44px;
  }

  .red.hollow .fa {
    color: var(--red);
    font-size: 1.05rem;
  }

  .secondary.hollow .fa {
    color: var(--secondary-700);
    font-size: 1.05rem;
  }

  .red.hollow:hover,
  .secondary.hollow:hover {
    transform: unset;
  }

  .history-control {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .history-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .history-toggle span {
    flex: 1;
    text-align: left;
  }

  .history-toggle:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 14rem;
    overflow-y: auto;
    margin-top: 0.35rem;
    padding: 0.35rem;
    border: 1px solid var(--dark-400);
    border-radius: 0.5rem;
    background: var(--card);
  }

  .history-entry {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.2rem;
    width: 100%;
    min-width: 0;
    padding: 0.5rem;
    border: none;
    border-radius: 0.35rem;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .history-entry:hover,
  .history-entry:focus-visible {
    background: rgba(128, 128, 128, 0.18);
  }

  .history-languages {
    font-size: 0.75rem;
    color: var(--placeholder);
  }

  .history-query,
  .history-result {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-query {
    font-size: 0.9rem;
  }

  .history-result {
    font-size: 0.8rem;
    color: var(--placeholder);
  }

  .translation-error {
    margin: 0;
    color: var(--quaternary);
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
</style>
