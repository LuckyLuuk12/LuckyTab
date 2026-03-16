<script lang="ts">
  import { settings, clearHistory } from "$lib/stores";

  function humanTime(t: number) {
    const d = new Date(t);
    return d.toLocaleString();
  }

  function removeHistoryAt(index: number) {
    settings.update((s) => ({
      ...s,
      history: (s.history || []).filter((_, i) => i !== index),
    }));
  }
</script>

<div class="history-container">
  <div class="history-header">
    <h4 class="history-title">History</h4>
    <button
      class="red hollow history-clear"
      aria-label="Clear history"
      onclick={() => clearHistory()}
    >
      <i class="fa fa-trash" aria-hidden="true"></i>
    </button>
  </div>

  {#if !$settings.history || $settings.history.length === 0}
    <div class="history-empty">No history yet</div>
  {:else}
    <ul class="history-list">
      {#each $settings.history as h, idx (h.id ?? `${h.time}-${idx}`)}
        <li class="history-item">
          <button
            class="red hollow history-item-delete"
            type="button"
            aria-label="Delete history item"
            title="Delete history item"
            onclick={() => removeHistoryAt(idx)}
          >
            <i class="fa fa-trash" aria-hidden="true"></i>
          </button>

          {#if h.url}
            <a
              class="history-link"
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div class="history-row">
                <div class="history-main">
                  <span class="history-icon" aria-hidden="true">
                    {#if h.type === "search"}
                      <i class="fa fa-search"></i>
                    {:else if h.type === "translate"}
                      <i class="fa fa-language"></i>
                    {:else}
                      <i class="fa fa-history"></i>
                    {/if}
                  </span>
                  <span class="history-text">
                    {#if h.query}
                      {h.query}
                    {:else}
                      {h.url}
                    {/if}
                  </span>
                </div>
                <small class="history-time">{humanTime(h.time)}</small>
              </div>
            </a>
          {:else}
            <div class="history-row no-link">
              <div class="history-main">
                <span class="history-icon" aria-hidden="true">
                  {#if h.type === "search"}
                    <i class="fa fa-search"></i>
                  {:else if h.type === "translate"}
                    <i class="fa fa-language"></i>
                  {:else}
                    <i class="fa fa-history"></i>
                  {/if}
                </span>
                <span class="history-text">
                  {#if h.query}
                    {h.query}
                  {:else}
                    {h.type}
                  {/if}
                </span>
              </div>
              <small class="history-time">{humanTime(h.time)}</small>
            </div>
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
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
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

  /* Make the clear/trash icon use a red variable (with fallbacks) */
  .history-clear .fa {
    color: rgba(142, 58, 71, 0.82);
    font-size: 0.9rem;
    line-height: 1;
  }
  .history-clear:hover {
    background: rgba(72, 24, 31, 0.2);
    border-color: rgba(120, 42, 52, 0.36);
  }
  .history-clear:hover {
    transform: unset;
  }

  .history-empty {
    color: var(--secondary-900, #999);
    padding: 0.5rem 0;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .history-item {
    border-radius: 0.375rem;
    position: relative;
  }

  .history-item-delete {
    position: absolute;
    top: 0.32rem;
    right: 0.32rem;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.32rem;
    height: 1.32rem;
    border-radius: 0.3rem;
    padding: 0;
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

  .history-link,
  .history-row.no-link {
    display: block;
    padding: 0.5rem 2.2rem 0.5rem 0.5rem;
    border-radius: 0.375rem;
    background: var(--card, rgba(255, 255, 255, 0.02));
    color: inherit;
    text-decoration: none;
  }
  .history-link:hover {
    background: var(--card-hover, rgba(255, 255, 255, 0.04));
  }

  .history-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
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
    color: var(--secondary-700, #9aa);
    opacity: 0.95;
    font-size: 0.7rem; /* match the timestamp size */
    margin-top: 0.06rem; /* slight vertical alignment with small text */
  }
  .history-icon .fa {
    line-height: 1;
  }

  /* show more of the search text: allow up to 2 lines and clamp */
  .history-text {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
    color: var(--text, #fff);
    font-size: 0.95rem;
    line-height: 1.2rem;
  }

  /* smaller timestamp */
  .history-time {
    color: var(--secondary-800, #999);
    font-size: 0.7rem;
    margin-left: 0.5rem;
    white-space: nowrap;
  }
</style>
