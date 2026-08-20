import { ThemeId } from '../types';

export interface ThemeColors {
  id: ThemeId;
  name: string;
  activityBarBg: string;
  activityBarFg: string;
  activityBarActiveFg: string;
  activityBarActiveBorder: string;
  sidebarBg: string;
  sidebarFg: string;
  sidebarHeaderBg: string;
  sidebarItemHoverBg: string;
  sidebarItemActiveBg: string;
  editorBg: string;
  editorFg: string;
  tabBg: string;
  tabActiveBg: string;
  tabFg: string;
  tabActiveFg: string;
  tabBorder: string;
  statusBarBg: string;
  statusBarFg: string;
  commandPaletteBg: string;
  commandPaletteFg: string;
  border: string;
  canvasPaper: {
    blank: string;
    ruledLine: string;
    gridLine: string;
    dotColor: string;
  };
}

export const THEMES: Record<ThemeId, ThemeColors> = {
  'vscode-dark': {
    id: 'vscode-dark',
    name: 'Onyx Electric (#000000 / #06141B / #F4DB08)',
    activityBarBg: '#000000',
    activityBarFg: '#94a3b8',
    activityBarActiveFg: '#F4DB08',
    activityBarActiveBorder: '#F4DB08',
    sidebarBg: '#06141B',
    sidebarFg: '#e2e8f0',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#0e2531',
    sidebarItemActiveBg: '#153545',
    editorBg: '#000000',
    editorFg: '#f8fafc',
    tabBg: '#06141B',
    tabActiveBg: '#000000',
    tabFg: '#8da4af',
    tabActiveFg: '#F4DB08',
    tabBorder: '#112c3b',
    statusBarBg: '#06141B',
    statusBarFg: '#F4DB08',
    commandPaletteBg: '#06141B',
    commandPaletteFg: '#f8fafc',
    border: '#112c3b',
    canvasPaper: {
      blank: '#ffffff',
      ruledLine: '#cbd5e1',
      gridLine: '#e2e8f0',
      dotColor: '#94a3b8',
    },
  },
  'vscode-light': {
    id: 'vscode-light',
    name: 'Cyber Noir & Gold',
    activityBarBg: '#000000',
    activityBarFg: '#cbd5e1',
    activityBarActiveFg: '#F4DB08',
    activityBarActiveBorder: '#F4DB08',
    sidebarBg: '#06141B',
    sidebarFg: '#f1f5f9',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#0d222e',
    sidebarItemActiveBg: '#153545',
    editorBg: '#000000',
    editorFg: '#ffffff',
    tabBg: '#06141B',
    tabActiveBg: '#000000',
    tabFg: '#8da4af',
    tabActiveFg: '#F4DB08',
    tabBorder: '#112c3b',
    statusBarBg: '#000000',
    statusBarFg: '#F4DB08',
    commandPaletteBg: '#06141B',
    commandPaletteFg: '#f8fafc',
    border: '#112c3b',
    canvasPaper: {
      blank: '#f8fafc',
      ruledLine: '#cbd5e1',
      gridLine: '#cbd5e1',
      dotColor: '#94a3b8',
    },
  },
  'monokai': {
    id: 'monokai',
    name: 'Deep Abyss Gold',
    activityBarBg: '#000000',
    activityBarFg: '#758a99',
    activityBarActiveFg: '#F4DB08',
    activityBarActiveBorder: '#F4DB08',
    sidebarBg: '#06141B',
    sidebarFg: '#f8f8f2',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#0d232f',
    sidebarItemActiveBg: '#16384a',
    editorBg: '#000000',
    editorFg: '#f8f8f2',
    tabBg: '#06141B',
    tabActiveBg: '#000000',
    tabFg: '#758a99',
    tabActiveFg: '#F4DB08',
    tabBorder: '#112c3b',
    statusBarBg: '#06141B',
    statusBarFg: '#F4DB08',
    commandPaletteBg: '#06141B',
    commandPaletteFg: '#f8f8f2',
    border: '#112c3b',
    canvasPaper: {
      blank: '#fffffa',
      ruledLine: '#e0e0d1',
      gridLine: '#e0e0d1',
      dotColor: '#b3b3a1',
    },
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Midnight Solar Gold',
    activityBarBg: '#000000',
    activityBarFg: '#6c8896',
    activityBarActiveFg: '#F4DB08',
    activityBarActiveBorder: '#F4DB08',
    sidebarBg: '#06141B',
    sidebarFg: '#93a1a1',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#0a1e28',
    sidebarItemActiveBg: '#133342',
    editorBg: '#000000',
    editorFg: '#93a1a1',
    tabBg: '#06141B',
    tabActiveBg: '#000000',
    tabFg: '#6c8896',
    tabActiveFg: '#F4DB08',
    tabBorder: '#112c3b',
    statusBarBg: '#06141B',
    statusBarFg: '#F4DB08',
    commandPaletteBg: '#06141B',
    commandPaletteFg: '#93a1a1',
    border: '#112c3b',
    canvasPaper: {
      blank: '#fdf6e3',
      ruledLine: '#eee8d5',
      gridLine: '#eee8d5',
      dotColor: '#93a1a1',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'Pure Onyx & Electric Gold',
    activityBarBg: '#000000',
    activityBarFg: '#ffffff',
    activityBarActiveFg: '#F4DB08',
    activityBarActiveBorder: '#F4DB08',
    sidebarBg: '#06141B',
    sidebarFg: '#ffffff',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#0e2430',
    sidebarItemActiveBg: '#183b4e',
    editorBg: '#000000',
    editorFg: '#ffffff',
    tabBg: '#06141B',
    tabActiveBg: '#000000',
    tabFg: '#ffffff',
    tabActiveFg: '#F4DB08',
    tabBorder: '#F4DB08',
    statusBarBg: '#000000',
    statusBarFg: '#F4DB08',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#ffffff',
    border: '#173647',
    canvasPaper: {
      blank: '#ffffff',
      ruledLine: '#999999',
      gridLine: '#999999',
      dotColor: '#666666',
    },
  },
};
