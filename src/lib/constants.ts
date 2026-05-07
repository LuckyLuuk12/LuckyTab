import type { PinnedSite } from '$lib/types';

// Favicons are now served from static folder to avoid bundling
export const DEFAULT_PINNED_SITES: PinnedSite[] = [
  { id: 'brightspace', title: 'Brightspace', url: 'https://brightspace.ru.nl/d2l/home', custom_favicon: '/img/favicons/brightspace.png' },
  { id: 'github', title: 'Github', url: 'https://github.com', custom_favicon: '/img/favicons/github.png' },
  { id: 'chatgpt', title: 'ChatGPT', url: 'https://chat.openai.com', custom_favicon: '/img/favicons/chatgpt.ico' },
  { id: 'youtube', title: 'YouTube', url: 'https://youtube.com', custom_favicon: '/img/favicons/yt.png' },

  // Row 2
  { id: 'rooster', title: 'Persoonlijk Rooster', url: 'https://persoonlijkrooster.ru.nl/schedule', custom_favicon: '/img/favicons/ru.ico' },
  { id: 'cloudflare', title: 'Cloudflare', url: 'https://cloudflare.com', custom_favicon: '/img/favicons/cloudflare.png' },
  { id: 'notebooklm', title: 'NotebookLM', url: 'https://notebooklm.google.com', custom_favicon: '/img/favicons/notebooklm.png' },
  { id: 'linkedin', title: 'LinkedIn', url: 'https://linkedin.com', custom_favicon: '/img/favicons/linkedin.png' },

  // Row 3
  { id: 'overleaf', title: 'Overleaf', url: 'https://overleaf.com', custom_favicon: '/img/favicons/overleaf.ico' },
  { id: 'wakatime', title: 'WakaTime', url: 'https://wakatime.com', custom_favicon: '/img/favicons/wakatime.ico' },
  { id: 'wolfram', title: 'Wolfram Alpha', url: 'https://www.wolframalpha.com', custom_favicon: '/img/favicons/wolframalpha.png' },
  { id: 'paypal', title: 'PayPal', url: 'https://paypal.com/myaccount/summary', custom_favicon: '/img/favicons/paypal.ico' },

  // Row 4
  { id: 'typst', title: 'Typst', url: 'https://typst.app', custom_favicon: '/img/favicons/typst.png' },
  { id: 'modrinth', title: 'Modrinth', url: 'https://modrinth.com/mods', custom_favicon: '/img/favicons/modrinth.ico' },
  { id: 'converter', title: 'Converter', url: 'https://online-convert.com', custom_favicon: '/img/favicons/converter.ico' },
  { id: 'kablan', title: 'Kablan.nl', url: 'https://kablan.nl', custom_favicon: '/img/favicons/kablan.png' }
];
