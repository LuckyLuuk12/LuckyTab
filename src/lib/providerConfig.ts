// Shared provider configuration to avoid duplicating icon imports

// Provider icons - using static assets to avoid bundling
export const PROVIDER_ICONS = {
  google: '/img/favicons/google.ico',
  googlemaps: '/img/favicons/googlemaps.webp',
  duckduckgo: '/img/favicons/duckduckgo.ico',
  youtube: '/img/favicons/yt.png',
  scholar: '/img/favicons/scholar.ico',
  wolfram: '/img/favicons/wolframalpha.png',
  allkeyshop: '/img/favicons/allkeyshop.png',
  chatgpt: '/img/favicons/chatgpt.webp'
} as const;

export type ProviderId = keyof typeof PROVIDER_ICONS;

export type Provider = {
  id: ProviderId;
  name: string;
  action: string;
  param?: string;
  icon: string;
};

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google",
    action: "https://www.google.com/search",
    param: "q",
    icon: PROVIDER_ICONS.google,
  },
  {
    id: "googlemaps",
    name: "Google Maps",
    action: "https://www.google.com/maps/search/",
    param: "query",
    icon: PROVIDER_ICONS.googlemaps,
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    action: "https://duckduckgo.com/",
    param: "q",
    icon: PROVIDER_ICONS.duckduckgo,
  },
  {
    id: "youtube",
    name: "YouTube",
    action: "https://www.youtube.com/results",
    param: "search_query",
    icon: PROVIDER_ICONS.youtube,
  },
  {
    id: "allkeyshop",
    name: "AllKeyShop",
    action: "https://www.allkeyshop.com/blog/products/",
    param: "search_name",
    icon: PROVIDER_ICONS.allkeyshop,
  },
  {
    id: "wolfram",
    name: "WolframAlpha",
    action: "https://www.wolframalpha.com/input",
    param: "i",
    icon: PROVIDER_ICONS.wolfram,
  },
  {
    id: "scholar",
    name: "Scholar",
    action: "https://scholar.google.com/scholar",
    param: "q",
    icon: PROVIDER_ICONS.scholar,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    action: "https://chatgpt.com/",
    param: "q",
    icon: PROVIDER_ICONS.chatgpt,
  },
];
