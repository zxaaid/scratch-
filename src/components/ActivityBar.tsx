import React from 'react';
import {
  FolderTree,
  FileText,
  Search,
  BookOpen,
  Sparkles,
  Settings,
  Sun,
  Moon,
  Tablet,
  Command,
} from 'lucide-react';
import { ActivityTab, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface ActivityBarProps {
  activeTab: ActivityTab;
  setActiveTab: (tab: ActivityTab) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  onOpenCommandPalette: () => void;
  tabletConnected: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeTab,
  setActiveTab,
  isSidebarOpen = true,
  onToggleSidebar,
  currentTheme,
  setTheme,
  onOpenCommandPalette,
  tabletConnected,
}) => {
  const theme = THEMES[currentTheme];

  const items: { id: ActivityTab; label: string; icon: React.ReactNode }[] = [
    { id: 'explorer', label: 'Explorer (Notebooks)', icon: <FolderTree size={22} /> },
    { id: 'practice', label: 'Practice & Feedback', icon: <BookOpen size={22} /> },
    { id: 'pdfs', label: 'PDF Documents', icon: <FileText size={22} /> },
    { id: 'search', label: 'Search (Ctrl+F)', icon: <Search size={22} /> },
    { id: 'ai', label: 'AI Handwriting Engine', icon: <Sparkles size={22} /> },
    { id: 'settings', label: 'Settings & Tablet', icon: <Settings size={22} /> },
  ];

  const toggleTheme = () => {
    setTheme(currentTheme === 'vscode-dark' ? 'vscode-light' : 'vscode-dark');
  };

  return (
    <div
      className="w-12 h-full flex flex-col justify-between items-center py-2 select-none z-20 border-r"
      style={{
        backgroundColor: theme.activityBarBg,
        borderColor: theme.border,
        color: theme.activityBarFg,
      }}
    >
      {/* Top Main Navigation */}
      <div className="flex flex-col items-center gap-2 w-full">
        {/* App Logo / Pen Icon */}
        <div
          className="w-9 h-9 mb-2 flex items-center justify-center rounded-md bg-sky-600 text-white font-bold text-xs shadow-sm cursor-pointer hover:bg-sky-500 transition-colors"
          title="Handwriting Workspace (VS Code Inspired)"
        >
          HW
        </div>

        {items.map((item) => {
          const isActive = activeTab === item.id && isSidebarOpen;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (activeTab === item.id) {
                  onToggleSidebar?.();
                } else {
                  setActiveTab(item.id);
                  if (!isSidebarOpen) {
                    onToggleSidebar?.();
                  }
                }
              }}
              className="relative w-10 h-10 flex items-center justify-center rounded-md transition-colors cursor-pointer"
              style={{
                color: isActive ? theme.activityBarActiveFg : theme.activityBarFg,
              }}
              title={`${item.label} (${isActive ? 'Click to collapse' : 'Click to open'})`}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                  style={{ backgroundColor: theme.activityBarActiveBorder }}
                />
              )}
              {item.icon}
            </button>
          );
        })}
      </div>

      {/* Bottom Utility Actions */}
      <div className="flex flex-col items-center gap-2 w-full">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          title="Command Palette (Ctrl+Shift+P)"
          style={{ color: theme.activityBarFg }}
        >
          <Command size={20} />
        </button>

        {/* Tablet Status Icon */}
        <div
          className="w-9 h-9 flex items-center justify-center relative cursor-help"
          title={tabletConnected ? 'Wacom Pen Display Active (Stylus Pressure Enabled)' : 'Mouse / Touch Input'}
          style={{ color: tabletConnected ? '#10b981' : theme.activityBarFg }}
        >
          <Tablet size={20} />
          <span
            className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
              tabletConnected ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          title="Toggle Dark/Light Theme"
          style={{ color: theme.activityBarFg }}
        >
          {currentTheme === 'vscode-dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
};
