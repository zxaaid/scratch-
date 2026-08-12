import React from 'react';
import { FileText, Book, X, Plus, Columns } from 'lucide-react';
import { TabItem, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId?: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  currentTheme: ThemeId;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];

  return (
    <div
      className="h-9 w-full flex items-center justify-between border-b select-none text-xs overflow-x-auto shrink-0 z-10"
      style={{
        backgroundColor: theme.tabBg,
        borderColor: theme.border,
      }}
    >
      {/* Tabs List */}
      <div className="flex items-center h-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative h-full px-3 flex items-center gap-2 cursor-pointer border-r transition-colors max-w-[200px] shrink-0 ${
                isActive ? 'font-semibold' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: isActive ? theme.tabActiveBg : theme.tabBg,
                color: isActive ? theme.tabActiveFg : theme.tabFg,
                borderColor: theme.border,
              }}
            >
              {/* Top Accent Line for Active Tab */}
              {isActive && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: theme.activityBarActiveBorder }}
                />
              )}

              {tab.type === 'pdf' ? (
                <FileText size={14} className="text-rose-400 shrink-0" />
              ) : (
                <Book size={14} className="text-sky-400 shrink-0" />
              )}

              <span className="truncate">{tab.title}</span>

              {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 text-gray-400 hover:text-white transition-opacity"
                title="Close Tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* New Page Tab Button */}
        <button
          onClick={onNewTab}
          className="h-full px-2.5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          title="New Blank Page"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
};
