export type PinnedSite = {
  id: string;
  title: string;
  url: string;
  custom_favicon?: string | any; // Can be string URL or enhanced image object
};

export type ThemeColors = {
  primary: string;
  secondary: string;
  tertiary: string;
  quaternary: string;
};

export type Settings = {
  pinned: PinnedSite[];
  customCss: string;
  colors?: ThemeColors;
  history?: HistoryEntry[];
  providerOrder?: string[]; // Array of provider IDs in custom order

  // Feature toggles
  enableProviderScroll?: boolean; // Enable scrolling through providers
  enableProviderReorder?: boolean; // Enable drag-n-drop reordering
  enableTranslator?: boolean; // Show translator tool
  enableHistory?: boolean; // Track history (affects autocomplete)
  includeTranslateInHistory?: boolean; // Save translations to history
  enableSystemInfo?: boolean; // Show system info widget

  // System info visibility toggles
  showSystemPublicIp?: boolean;
  showSystemConnection?: boolean;
  showSystemMemory?: boolean;
  showSystemBattery?: boolean;
  showSystemTime?: boolean;
  showSystemTimezone?: boolean;
  showSystemLanguage?: boolean;
  showSystemCpuCores?: boolean;
  showInfoDate?: boolean;
  showInfoWeather?: boolean;
  showInfoAirQuality?: boolean;
  infoSystemOrder?: string[];
  infoGeneralOrder?: string[];
  infoCollapsed?: boolean;
  infoCollapsedVisibleKeys?: string[];

  // Translator settings
  defaultTranslateFrom?: string; // Default source language
  defaultTranslateTo?: string; // Default target language
  supportedLanguages?: string[]; // List of language codes to show
};

export type HistoryEntry = {
  id: string;
  type: 'search' | 'visit' | 'translate';
  provider?: string;
  query?: string;
  from?: string;
  to?: string;
  result?: string;
  url?: string;
  time: number;
};
