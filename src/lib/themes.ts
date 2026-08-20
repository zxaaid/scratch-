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
    name: 'Onyx Monochrome (#000000 / #ffffff)',
    activityBarBg: '#000000',
    activityBarFg: '#94a3b8',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#ffffff',
    sidebarBg: '#000000',
    sidebarFg: '#e2e8f0',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#18181b',
    sidebarItemActiveBg: '#27272a',
    editorBg: '#000000',
    editorFg: '#f8fafc',
    tabBg: '#000000',
    tabActiveBg: '#000000',
    tabFg: '#8da4af',
    tabActiveFg: '#ffffff',
    tabBorder: '#27272a',
    statusBarBg: '#000000',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#f8fafc',
    border: '#27272a',
    canvasPaper: {
      blank: '#ffffff',
      ruledLine: '#cbd5e1',
      gridLine: '#e2e8f0',
      dotColor: '#94a3b8',
    },
  },
  'vscode-light': {
    id: 'vscode-light',
    name: 'Cyber Noir & Pure White',
    activityBarBg: '#000000',
    activityBarFg: '#cbd5e1',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#ffffff',
    sidebarBg: '#000000',
    sidebarFg: '#f1f5f9',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#18181b',
    sidebarItemActiveBg: '#27272a',
    editorBg: '#000000',
    editorFg: '#ffffff',
    tabBg: '#000000',
    tabActiveBg: '#000000',
    tabFg: '#8da4af',
    tabActiveFg: '#ffffff',
    tabBorder: '#27272a',
    statusBarBg: '#000000',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#f8fafc',
    border: '#27272a',
    canvasPaper: {
      blank: '#f8fafc',
      ruledLine: '#cbd5e1',
      gridLine: '#cbd5e1',
      dotColor: '#94a3b8',
    },
  },
  'monokai': {
    id: 'monokai',
    name: 'Deep Abyss White',
    activityBarBg: '#000000',
    activityBarFg: '#758a99',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#ffffff',
    sidebarBg: '#000000',
    sidebarFg: '#f8f8f2',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#18181b',
    sidebarItemActiveBg: '#27272a',
    editorBg: '#000000',
    editorFg: '#f8f8f2',
    tabBg: '#000000',
    tabActiveBg: '#000000',
    tabFg: '#758a99',
    tabActiveFg: '#ffffff',
    tabBorder: '#27272a',
    statusBarBg: '#000000',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#f8f8f2',
    border: '#27272a',
    canvasPaper: {
      blank: '#fffffa',
      ruledLine: '#e0e0d1',
      gridLine: '#e0e0d1',
      dotColor: '#b3b3a1',
    },
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Midnight Solar White',
    activityBarBg: '#000000',
    activityBarFg: '#6c8896',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#ffffff',
    sidebarBg: '#000000',
    sidebarFg: '#93a1a1',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#18181b',
    sidebarItemActiveBg: '#27272a',
    editorBg: '#000000',
    editorFg: '#93a1a1',
    tabBg: '#000000',
    tabActiveBg: '#000000',
    tabFg: '#6c8896',
    tabActiveFg: '#ffffff',
    tabBorder: '#27272a',
    statusBarBg: '#000000',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#93a1a1',
    border: '#27272a',
    canvasPaper: {
      blank: '#fdf6e3',
      ruledLine: '#eee8d5',
      gridLine: '#eee8d5',
      dotColor: '#93a1a1',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'Pure Onyx & Pure White',
    activityBarBg: '#000000',
    activityBarFg: '#ffffff',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#ffffff',
    sidebarBg: '#000000',
    sidebarFg: '#ffffff',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#18181b',
    sidebarItemActiveBg: '#27272a',
    editorBg: '#000000',
    editorFg: '#ffffff',
    tabBg: '#000000',
    tabActiveBg: '#000000',
    tabFg: '#ffffff',
    tabActiveFg: '#ffffff',
    tabBorder: '#ffffff',
    statusBarBg: '#000000',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#ffffff',
    border: '#27272a',
    canvasPaper: {
      blank: '#ffffff',
      ruledLine: '#999999',
      gridLine: '#999999',
      dotColor: '#666666',
    },
  },
};
