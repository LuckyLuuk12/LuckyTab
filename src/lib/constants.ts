import type { PinnedSite } from '$lib/types';

// Favicons are now served from static folder to avoid bundling
export const DEFAULT_PINNED_SITES: PinnedSite[] = [
  { id: 'brightspace', title: 'Brightspace', url: 'https://brightspace.ru.nl/d2l/home', custom_favicon: '/img/favicons/brightspace.png' },
  { id: 'youtube', title: 'YouTube', url: 'https://youtube.com', custom_favicon: '/img/favicons/yt.png' },
  { id: 'github', title: 'Github', url: 'https://github.com', custom_favicon: '/img/favicons/github.png' },
  { id: 'chatgpt', title: 'ChatGPT', url: 'https://chat.openai.com', custom_favicon: '/img/favicons/chatgpt.ico' },
  { id: 'rooster', title: 'Persoonlijk Rooster', url: 'https://persoonlijkrooster.ru.nl/schedule', custom_favicon: '/img/favicons/ru.ico' },
  { id: 'converter', title: 'Converter', url: 'https://online-convert.com', custom_favicon: '/img/favicons/converter.ico' },
  { id: 'overleaf', title: 'Overleaf', url: 'https://overleaf.com', custom_favicon: '/img/favicons/overleaf.ico' },
  { id: 'kablan', title: 'Kablan.nl', url: 'https://kablan.nl', custom_favicon: '/img/favicons/kablan.png' },
  { id: 'modrinth', title: 'Modrinth', url: 'https://modrinth.com/mods', custom_favicon: '/img/favicons/modrinth.ico' },
  { id: 'cloudflare', title: 'Cloudflare', url: 'https://cloudflare.com', custom_favicon: '/img/favicons/cloudflare.png' },
  { id: 'wetransfer', title: 'WeTransfer', url: 'https://wetransfer.com', custom_favicon: '/img/favicons/wetransfer.png' },
  { id: 'allkeyshop', title: 'All Key Shop', url: 'https://allkeyshop.com', custom_favicon: '/img/favicons/allkeyshop.png' },
  { id: 'wakatime', title: 'WakaTime', url: 'https://wakatime.com', custom_favicon: '/img/favicons/wakatime.ico' },
  { id: 'linkedin', title: 'LinkedIn', url: 'https://linkedin.com', custom_favicon: '/img/favicons/linkedin.png' },
  { id: 'paypal', title: 'PayPal', url: 'https://paypal.com/myaccount/summary', custom_favicon: '/img/favicons/paypal.ico' },
  { id: 'wolfram', title: 'Wolfram Alpha', url: 'https://www.wolframalpha.com', custom_favicon: '/img/favicons/wolframalpha.png' }
];
