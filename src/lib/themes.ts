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
    name: 'VS Code Dark Plus',
    activityBarBg: '#333333',
    activityBarFg: '#cccccc',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#ffffff',
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    sidebarHeaderBg: '#252526',
    sidebarItemHoverBg: '#2a2d2e',
    sidebarItemActiveBg: '#37373d',
    editorBg: '#1e1e1e',
    editorFg: '#cccccc',
    tabBg: '#252526',
    tabActiveBg: '#1e1e1e',
    tabFg: '#969696',
    tabActiveFg: '#ffffff',
    tabBorder: '#3c3c3c',
    statusBarBg: '#007acc',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#252526',
    commandPaletteFg: '#cccccc',
    border: '#3c3c3c',
    canvasPaper: {
      blank: '#ffffff',
      ruledLine: '#e2e8f0',
      gridLine: '#e2e8f0',
      dotColor: '#cbd5e1',
    },
  },
  'vscode-light': {
    id: 'vscode-light',
    name: 'VS Code Light Plus',
    activityBarBg: '#2c2c2c',
    activityBarFg: '#999999',
    activityBarActiveFg: '#ffffff',
    activityBarActiveBorder: '#007acc',
    sidebarBg: '#f3f3f3',
    sidebarFg: '#333333',
    sidebarHeaderBg: '#e8e8e8',
    sidebarItemHoverBg: '#e8e8e8',
    sidebarItemActiveBg: '#d4d4d4',
    editorBg: '#ffffff',
    editorFg: '#000000',
    tabBg: '#ececec',
    tabActiveBg: '#ffffff',
    tabFg: '#616161',
    tabActiveFg: '#333333',
    tabBorder: '#e5e5e5',
    statusBarBg: '#007acc',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#ffffff',
    commandPaletteFg: '#333333',
    border: '#e5e5e5',
    canvasPaper: {
      blank: '#f8fafc',
      ruledLine: '#cbd5e1',
      gridLine: '#cbd5e1',
      dotColor: '#94a3b8',
    },
  },
  'monokai': {
    id: 'monokai',
    name: 'Monokai Dark',
    activityBarBg: '#1e1f1c',
    activityBarFg: '#75715e',
    activityBarActiveFg: '#f8f8f2',
    activityBarActiveBorder: '#a6e22e',
    sidebarBg: '#272822',
    sidebarFg: '#f8f8f2',
    sidebarHeaderBg: '#1e1f1c',
    sidebarItemHoverBg: '#3e3d32',
    sidebarItemActiveBg: '#49483e',
    editorBg: '#272822',
    editorFg: '#f8f8f2',
    tabBg: '#1e1f1c',
    tabActiveBg: '#272822',
    tabFg: '#75715e',
    tabActiveFg: '#f8f8f2',
    tabBorder: '#383830',
    statusBarBg: '#75715e',
    statusBarFg: '#f8f8f2',
    commandPaletteBg: '#1e1f1c',
    commandPaletteFg: '#f8f8f2',
    border: '#383830',
    canvasPaper: {
      blank: '#fffffa',
      ruledLine: '#e0e0d1',
      gridLine: '#e0e0d1',
      dotColor: '#b3b3a1',
    },
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    activityBarBg: '#00141a',
    activityBarFg: '#586e75',
    activityBarActiveFg: '#268bd2',
    activityBarActiveBorder: '#268bd2',
    sidebarBg: '#002b36',
    sidebarFg: '#839496',
    sidebarHeaderBg: '#00212b',
    sidebarItemHoverBg: '#073642',
    sidebarItemActiveBg: '#073642',
    editorBg: '#002b36',
    editorFg: '#839496',
    tabBg: '#00141a',
    tabActiveBg: '#002b36',
    tabFg: '#586e75',
    tabActiveFg: '#839496',
    tabBorder: '#073642',
    statusBarBg: '#073642',
    statusBarFg: '#93a1a1',
    commandPaletteBg: '#073642',
    commandPaletteFg: '#839496',
    border: '#073642',
    canvasPaper: {
      blank: '#fdf6e3',
      ruledLine: '#eee8d5',
      gridLine: '#eee8d5',
      dotColor: '#93a1a1',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast',
    activityBarBg: '#000000',
    activityBarFg: '#ffffff',
    activityBarActiveFg: '#ffff00',
    activityBarActiveBorder: '#ffff00',
    sidebarBg: '#000000',
    sidebarFg: '#ffffff',
    sidebarHeaderBg: '#000000',
    sidebarItemHoverBg: '#1a1a1a',
    sidebarItemActiveBg: '#333333',
    editorBg: '#000000',
    editorFg: '#ffffff',
    tabBg: '#000000',
    tabActiveBg: '#1a1a1a',
    tabFg: '#ffffff',
    tabActiveFg: '#ffff00',
    tabBorder: '#666666',
    statusBarBg: '#000000',
    statusBarFg: '#ffffff',
    commandPaletteBg: '#000000',
    commandPaletteFg: '#ffffff',
    border: '#666666',
    canvasPaper: {
      blank: '#ffffff',
      ruledLine: '#999999',
      gridLine: '#999999',
      dotColor: '#666666',
    },
  },
};
