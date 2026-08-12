import React, { useState, useEffect } from 'react';
import { Search, Command, ArrowRight } from 'lucide-react';
import { CommandPaletteAction, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandPaletteAction[];
  currentTheme: ThemeId;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  actions,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setQuery('');
    setSelectedIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredActions = actions.filter((act) =>
    act.title.toLowerCase().includes(query.toLowerCase()) ||
    act.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[520px] rounded-xl shadow-2xl border overflow-hidden flex flex-col text-xs"
        style={{
          backgroundColor: theme.commandPaletteBg,
          color: theme.commandPaletteFg,
          borderColor: theme.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: theme.border }}>
          <Command size={18} className="text-sky-400 shrink-0" />
          <input
            type="text"
            placeholder="Type a command or search actions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent outline-none text-sm text-white placeholder-gray-500"
            autoFocus
          />
        </div>

        {/* Action Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {filteredActions.length === 0 ? (
            <div className="py-6 text-center text-gray-500">No command found for "{query}"</div>
          ) : (
            filteredActions.map((act, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={act.id}
                  onClick={() => {
                    act.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                    isSelected ? 'bg-sky-600 text-white font-medium' : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 bg-white/10 px-1.5 py-0.5 rounded">
                      {act.category}
                    </span>
                    <span>{act.title}</span>
                  </div>
                  {act.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-black/30 border border-white/10 text-[10px] font-mono text-gray-300">
                      {act.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-3 py-1.5 border-t text-[10px] text-gray-500 flex justify-between bg-black/20" style={{ borderColor: theme.border }}>
          <span>Navigate with ↑ ↓, select with Enter</span>
          <span>Esc to exit</span>
        </div>
      </div>
    </div>
  );
};
