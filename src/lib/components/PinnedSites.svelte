<!-- @component
no description yet
-->
<script lang="ts">
  import { settings } from '$lib/stores';
  import type { PinnedSite } from '$lib/types';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  
  import brightspace from '$lib/assets/img/brightspace.png?enhanced';
  import youtube from '$lib/assets/img/yt.png?enhanced';
  import github from '$lib/assets/img/github.png?enhanced';
  import chatgpt from '$lib/assets/img/chatgpt.ico?enhanced';
  import ru from '$lib/assets/img/ru.ico?enhanced';
  import converter from '$lib/assets/img/converter.ico?enhanced';
  import overleaf from '$lib/assets/img/overleaf.ico?enhanced';
  import kablan from '$lib/assets/img/kablan.png?enhanced';
  import modrinth from '$lib/assets/img/modrinth.ico?enhanced';
  import cloudflare from '$lib/assets/img/cloudflare.png?enhanced';
  import wetransfer from '$lib/assets/img/wetransfer.png?enhanced';
  import allkeyshop from '$lib/assets/img/allkeyshop.png?enhanced';
  import wakatime from '$lib/assets/img/wakatime.ico?enhanced';
  import linkedin from '$lib/assets/img/linkedin.png?enhanced';
  import paypal from '$lib/assets/img/paypal.ico?enhanced';
  import wolfram from '$lib/assets/img/wolframalpha.png?enhanced';
  
  const fallbackPinnedSites = [
    { id: 'brightspace', title: 'Brightspace', url: 'https://brightspace.ru.nl/d2l/home', custom_favicon: brightspace },
    { id: 'youtube', title: 'YouTube', url: 'https://youtube.com', custom_favicon: youtube },
    { id: 'github', title: 'Github', url: 'https://github.com', custom_favicon: github },
    { id: 'chatgpt', title: 'ChatGPT', url: 'https://chat.openai.com', custom_favicon: chatgpt },
    { id: 'rooster', title: 'Persoonlijk Rooster', url: 'https://persoonlijkrooster.ru.nl/schedule', custom_favicon: ru },
    { id: 'converter', title: 'Converter', url: 'https://online-convert.com', custom_favicon: converter },
    { id: 'overleaf', title: 'Overleaf', url: 'https://overleaf.com', custom_favicon: overleaf },
    { id: 'kablan', title: 'Kablan.nl', url: 'https://kablan.nl', custom_favicon: kablan },
    { id: 'modrinth', title: 'Modrinth', url: 'https://modrinth.com/mods', custom_favicon: modrinth },
    { id: 'cloudflare', title: 'Cloudflare', url: 'https://cloudflare.com', custom_favicon: cloudflare },
    { id: 'wetransfer', title: 'WeTransfer', url: 'https://wetransfer.com', custom_favicon: wetransfer },
    { id: 'allkeyshop', title: 'All Key Shop', url: 'https://allkeyshop.com', custom_favicon: allkeyshop },
    { id: 'wakatime', title: 'WakaTime', url: 'https://wakatime.com', custom_favicon: wakatime },
    { id: 'linkedin', title: 'LinkedIn', url: 'https://linkedin.com', custom_favicon: linkedin },
    { id: 'paypal', title: 'PayPal', url: 'https://paypal.com/myaccount/summary', custom_favicon: paypal },
    { id: 'wolfram', title: 'Wolfram Alpha', url: 'https://www.wolframalpha.com', custom_favicon: wolfram }
  ];
</script>

<section>
  <h3>Pinned Sites</h3>
  <div class="pinned-grid">
    {#each $settings.pinned.length !== 0 ? $settings.pinned : fallbackPinnedSites as site}
      <a class="pinned-link gradient-dark-gray" href={site.url} rel="noreferrer noopener">
        {#if site.custom_favicon && typeof site.custom_favicon !== 'string'}
          <enhanced:img class="pinned-img" src={site.custom_favicon} alt="" />
        {:else}
          <img class="pinned-img" src={(site.custom_favicon ?? getFavicon(site.url)) as string} alt="" loading="lazy" decoding="async" />
        {/if}
        <div class="pinned-title">{site.title}</div>
      </a>
    {/each}
  </div>
</section>


<script context="module" lang="ts">
  function getFavicon(siteUrl: string) {
    try {
      const u = new URL(siteUrl);
      return `${u.origin}/favicon.ico`;
    } catch (e) {
      return '/favicon.png';
    }
  }
</script>

<style>
  section { border-radius: var(--border-radius); }
  h3 { margin-bottom: .5rem; }
  .pinned-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:.5rem; }
  .pinned-link { display:flex; align-items:center; gap:.5rem; padding:.5rem; border-radius:.5rem; text-decoration:none; color:inherit; background: var(--card); border: 1px solid transparent}
  .pinned-link:hover { border: 1px solid var(--primary-900); }
  .pinned-img { width:2rem; height:2rem; border-radius: var(--border-radius); }
  .pinned-title { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
</style>
