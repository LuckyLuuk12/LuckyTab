<script context="module" lang="ts">
  function getFavicon(siteUrl: string) {
    try {
      const u = new URL(siteUrl);
      return `${u.origin}/favicon.ico`;
    } catch (e) {
      return "/favicon.png";
    }
  }
</script>

<!-- @component
no description yet
-->
<script lang="ts">
  import { settings } from "$lib/stores";
  import type { PinnedSite } from "$lib/types";
  import { browser } from "$app/environment";
  import { get } from "svelte/store";
  import { DEFAULT_PINNED_SITES } from "$lib/constants";
</script>

<section>
  <h3>Pinned Sites</h3>
  <div class="pinned-grid">
    {#each $settings.pinned.length !== 0 ? $settings.pinned : DEFAULT_PINNED_SITES as site}
      <a
        class="pinned-link gradient-dark-gray"
        href={site.url}
        rel="noreferrer noopener"
      >
        {#if site.custom_favicon && typeof site.custom_favicon !== "string"}
          <enhanced:img class="pinned-img" src={site.custom_favicon} alt="" />
        {:else}
          <img
            class="pinned-img"
            src={(site.custom_favicon ?? getFavicon(site.url)) as string}
            alt=""
            loading="lazy"
            decoding="async"
          />
        {/if}
        <div class="pinned-title">{site.title}</div>
      </a>
    {/each}
  </div>
</section>

<style>
  section {
    border-radius: var(--border-radius);
  }
  h3 {
    margin-bottom: 0.5rem;
  }
  .pinned-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.5rem;
  }
  .pinned-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    text-decoration: none;
    color: inherit;
    background: var(--card);
    border: 1px solid transparent;
  }
  .pinned-link:hover {
    border: 1px solid var(--primary-900);
  }
  .pinned-img {
    width: 2rem;
    height: 2rem;
    border-radius: var(--border-radius);
  }
  .pinned-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
