<script lang="ts">
  import { browser } from "$app/environment";
  import { clearHistory, settings } from "$lib/stores";
  import type { HistoryEntry } from "$lib/types";

  function humanTime(time: number) {
    return new Date(time).toLocaleString();
  }

  function removeHistoryAt(index: number) {
    settings.update((current) => ({
      ...current,
      history: (current.history ?? []).filter((_, i) => i !== index),
    }));
  }

  function dispatchHistorySelection(entry: HistoryEntry) {
    if (!browser) return;

    // Consumers can listen for this event to restore the relevant input.
    window.dispatchEvent(
      new CustomEvent("lt:history-select", {
        detail: {
          type: entry.type,
          query: entry.query ?? "",
          url: entry.url ?? "",
          from: entry.from ?? "auto",
          to: entry.to ?? "nl",
          result: entry.result ?? "",
          provider: entry.provider ?? "",
        },
      }),
    );
  }

  function selectHistoryEntry(entry: HistoryEntry) {
    dispatchHistorySelection(entry);
  }

  function openHistoryUrl(entry: HistoryEntry) {
    if (!browser || !entry.url) return;

    window.open(entry.url, "_blank", "noopener,noreferrer");
  }

  function clearAllHistory() {
    clearHistory();
  }
</script>

<div class="history-container">
  <div class="history-header">
    <h4 class="history-title">History</h4>

    <button
      class="red hollow history-clear"
      type="button"
      aria-label="Clear history"
      title="Clear history"
      disabled={!$settings.history?.length}
      onclick={clearAllHistory}
    >
      <i class="fa fa-trash" aria-hidden="true"></i>
    </button>
  </div>

  {#if !$settings.history?.length}
    <div class="history-empty">No history yet</div>
  {:else}
    <ul class="history-list">
      {#each $settings.history as entry, index (entry.id ?? `${entry.time}-${index}`)}
        <li class="history-item">
          <button
            class="red hollow history-item-delete"
            type="button"
            aria-label="Delete history item"
            title="Delete history item"
            onclick={() => removeHistoryAt(index)}
          >
            <i class="fa fa-trash" aria-hidden="true"></i>
          </button>

          <button
            class="history-entry"
            type="button"
            onclick={() => selectHistoryEntry(entry)}
            title={entry.query ?? entry.url ?? entry.type}
          >
            <div class="history-row">
              <div class="history-main">
                <span class="history-icon" aria-hidden="true">
                  {#if entry.type === "search"}
                    <i class="fa fa-search"></i>
                  {:else if entry.type === "translate"}
                    <i class="fa fa-language"></i>
                  {:else}
                    <i class="fa fa-history"></i>
                  {/if}
                </span>

                <span class="history-content">
                  <span class="history-text">
                    {entry.query || entry.url || entry.type}
                  </span>

                  {#if entry.type === "translate"}
                    <span class="history-result">
                      {entry.result || "No translation available"}
                    </span>
                    <span class="history-languages">
                      {entry.from ?? "auto"} → {entry.to ?? "nl"}
                    </span>
                  {:else if entry.type === "search" && entry.provider}
                    <span class="history-provider">{entry.provider}</span>
                  {/if}
                </span>
              </div>

              <small class="history-time">{humanTime(entry.time)}</small>
            </div>
          </button>

          {#if entry.url}
            <button
              class="history-open"
              type="button"
              aria-label="Open destination in a new tab"
              title="Open destination in a new tab"
              onclick={() => openHistoryUrl(entry)}
            >
              <i class="fa fa-arrow-up-right-from-square" aria-hidden="true"
              ></i>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .history-container {
    width: 100%;
    height: 100%;
    max-height: 100%;
    min-width: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-sizing: border-box;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .history-title {
    margin: 0;
    font-size: 1rem;
  }

  .history-clear {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.32rem 0.48rem;
    height: 1.72rem;
    border-radius: 0.375rem;
    border-color: rgba(120, 42, 52, 0.28);
    background: rgba(72, 24, 31, 0.14);
  }

  .history-clear .fa {
    color: rgba(142, 58, 71, 0.82);
    font-size: 0.9rem;
    line-height: 1;
  }

  .history-clear:hover {
    background: rgba(72, 24, 31, 0.2);
    border-color: rgba(120, 42, 52, 0.36);
    transform: unset;
  }

  .history-clear:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .history-empty {
    color: var(--secondary-900);
    padding: 0.5rem 0;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .history-item {
    border-radius: 0.375rem;
    position: relative;
    min-width: 0;
  }

  .history-entry {
    display: block;
    width: 100%;
    min-width: 0;
    padding: 0.5rem 4rem 0.5rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    background: var(--card);
    color: inherit;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
  }

  .history-entry:hover {
    background: var(--dark-600);
  }

  .history-entry:focus-visible,
  .history-open:focus-visible,
  .history-item-delete:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .history-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }

  .history-main {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .history-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
    color: var(--secondary-700);
    opacity: 0.95;
    font-size: 0.7rem;
    margin-top: 0.06rem;
  }

  .history-icon .fa {
    line-height: 1;
  }

  .history-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
    min-width: 0;
  }

  .history-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--text);
    font-size: 0.95rem;
    line-height: 1.2rem;
  }

  .history-result,
  .history-provider,
  .history-languages {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    color: var(--secondary-800);
  }

  .history-time {
    color: var(--secondary-800);
    font-size: 0.7rem;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .history-item-delete,
  .history-open {
    position: absolute;
    top: 0.32rem;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.32rem;
    height: 1.32rem;
    padding: 0;
    border-radius: 0.3rem;
    cursor: pointer;
  }

  .history-item-delete {
    right: 0.32rem;
    border-color: rgba(120, 42, 52, 0.22);
    background: rgba(72, 24, 31, 0.11);
  }

  .history-item-delete .fa {
    color: rgba(142, 58, 71, 0.74);
    font-size: 0.72rem;
    line-height: 1;
  }

  .history-item-delete:hover {
    background: rgba(72, 24, 31, 0.18);
    border-color: rgba(120, 42, 52, 0.34);
  }

  .history-open {
    right: 1.85rem;
    border: 1px solid rgba(128, 128, 128, 0.25);
    background: var(--card);
    color: var(--secondary-800);
  }

  .history-open:hover {
    background: var(--dark-600);
    color: var(--text);
  }
</style>
