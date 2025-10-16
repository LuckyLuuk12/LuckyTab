<script lang="ts">
  import { settings } from '$lib/stores';
  import type { PinnedSite } from '$lib/types';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  
  const fallbackPinnedSites = [
    { id: 'brightspace', title: 'Brightspace', url: 'https://brightspace.ru.nl/d2l/home', custom_favicon: 'https://res.cloudinary.com/apideck/image/upload/v1638671580/icons/brightspace.png' },
    { id: 'youtube', title: 'YouTube', url: 'https://youtube.com', custom_favicon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png' },
    { id: 'github', title: 'Github', url: 'https://github.com', custom_favicon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Github-desktop-logo-symbol.svg/2048px-Github-desktop-logo-symbol.svg.png' },
    { id: 'chatgpt', title: 'ChatGPT', url: 'https://chat.openai.com', custom_favicon: 'https://chat.openai.com/favicon.ico' },
    { id: 'rooster', title: 'Persoonlijk Rooster', url: 'https://persoonlijkrooster.ru.nl/schedule', custom_favicon: 'https://persoonlijkrooster.ru.nl/style/icons/favicon-7765a9a12ec3d4bc5e504c96f83c1008.ico' },
    { id: 'converter', title: 'Converter', url: 'https://online-convert.com', custom_favicon: 'https://online-convert.com/favicon.ico' },
    { id: 'overleaf', title: 'Overleaf', url: 'https://overleaf.com', custom_favicon: 'https://overleaf.com/favicon.ico' },
    { id: 'kablan', title: 'Kablan.nl', url: 'https://kablan.nl', custom_favicon: 'https://w7.pngwing.com/pngs/882/529/png-transparent-mobile-app-development-computer-icons-software-development-software-developer-others-miscellaneous-mobile-app-development-rim-thumbnail.png' },
    { id: 'modrinth', title: 'Modrinth', url: 'https://modrinth.com/mods', custom_favicon: 'https://modrinth.com/favicon.ico' },
    { id: 'cloudflare', title: 'Cloudflare', url: 'https://cloudflare.com', custom_favicon: 'https://www.cloudflare.com/favicon.ico' },
    { id: 'wetransfer', title: 'WeTransfer', url: 'https://wetransfer.com', custom_favicon: 'https://images.seeklogo.com/logo-png/25/3/wetransfer-logo-png_seeklogo-256244.png' },
    { id: 'allkeyshop', title: 'All Key Shop', url: 'https://allkeyshop.com', custom_favicon: 'https://tenereteam.s3.us-west-1.amazonaws.com/allkeyshop-logo-4?v=1720238674' },
    { id: 'wakatime', title: 'WakaTime', url: 'https://wakatime.com', custom_favicon: 'https://wakatime.com/favicon.ico' },
    { id: 'linkedin', title: 'LinkedIn', url: 'https://linkedin.com', custom_favicon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/2048px-LinkedIn_icon.svg.png' },
    { id: 'paypal', title: 'PayPal', url: 'https://paypal.com/myaccount/summary', custom_favicon: 'https://www.paypalobjects.com/en_US/i/icon/pp_favicon_x.ico' },
    { id: 'wolfram', title: 'Wolfram Alpha', url: 'https://www.wolframalpha.com', custom_favicon: 'https://img.icons8.com/?size=512&id=tDIcm6gQDsVj&format=png' }
  ];
</script>

<section>
  <h3>Pinned Sites</h3>
  <div class="pinned-grid">
    {#each $settings.pinned.length !== 0 ? $settings.pinned : fallbackPinnedSites as site}
      <a class="pinned-link gradient-dark-gray" href={site.url} rel="noreferrer noopener">
        <img class="pinned-img" src={site.custom_favicon ?? getFavicon(site.url)} alt="" loading="lazy" decoding="async" />
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
