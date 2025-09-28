export type PinnedSite = {
  id: string;
  title: string;
  url: string;
  custom_favicon?: string;
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
