<script lang="ts">
  import { settings, clearHistory } from '$lib/stores';

  function humanTime(t: number) {
    const d = new Date(t);
    return d.toLocaleString();
  }
</script>

<div class="history-container">
  <div class="history-header">
    <h4 class="history-title">History</h4>
    <button class="red hollow history-clear" aria-label="Clear history" on:click={() => clearHistory()}>
      <i class="fa fa-trash" aria-hidden="true"></i>
    </button>
  </div>

  {#if !$settings.history || $settings.history.length === 0}
    <div class="history-empty">No history yet</div>
  {:else}
    <ul class="history-list">
      {#each $settings.history as h}
        <li class="history-item">
          {#if h.url}
            <a class="history-link" href={h.url} target="_blank" rel="noopener noreferrer">
              <div class="history-row">
                <div class="history-main">
                  <span class="history-icon" aria-hidden="true">
                    {#if h.type === 'search'}
                      <i class="fa fa-search"></i>
                    {:else if h.type === 'translate'}
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
                  {#if h.type === 'search'}
                    <i class="fa fa-search"></i>
                  {:else if h.type === 'translate'}
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
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:0.5rem;
  }
  .history-title { margin: 0; font-size: 1rem; }
  .history-clear {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.6rem;
    height: 2rem;
    border-radius: 0.375rem;
  }

  /* Make the clear/trash icon use a red variable (with fallbacks) */
  .history-clear .fa { color: var(--red, var(--quaternary-700, #b02e43)); font-size: 1.1rem; line-height: 1; }
  .history-clear:hover {
    transform: unset;
  }

  .history-empty { color: var(--secondary-900, #999); padding: 0.5rem 0; }

  .history-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.25rem; }
  .history-item { border-radius:0.375rem; }

  .history-link, .history-row.no-link {
    display: block;
    padding: 0.5rem;
    border-radius:0.375rem;
    background: var(--card, rgba(255,255,255,0.02));
    color: inherit;
    text-decoration: none;
  }
  .history-link:hover {
    background: var(--card-hover, rgba(255,255,255,0.04));
  }

  .history-row { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; }
  .history-main { display:flex; align-items:flex-start; gap:0.5rem; flex:1; min-width:0; }

  .history-icon {
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:1rem;
    height:1rem;
    flex:0 0 auto;
    color: var(--secondary-700, #9aa);
    opacity: 0.95;
    font-size: 0.7rem; /* match the timestamp size */
    margin-top: 0.06rem; /* slight vertical alignment with small text */
  }
  .history-icon .fa { line-height:1; }

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
  .history-time { color:var(--secondary-800,#999); font-size: 0.7rem; margin-left:0.5rem; white-space:nowrap; }

</style>