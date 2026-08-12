import React, { useState } from 'react';
import { Search, FileText, Book, Tag, ArrowRight } from 'lucide-react';
import { Workspace, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface SearchPanelProps {
  workspace: Workspace;
  onSelectPage: (notebookId: string, pageId: string) => void;
  currentTheme: ThemeId;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  workspace,
  onSelectPage,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];
  const [query, setQuery] = useState('');

  // Perform search across all notebooks and pages
  const results: {
    notebookId: string;
    notebookTitle: string;
    pageId: string;
    pageTitle: string;
    matchedText: string;
    matchType: 'ocr' | 'title' | 'tag';
  }[] = [];

  if (query.trim().length > 0) {
    const q = query.toLowerCase();
    workspace.notebooks.forEach((nb) => {
      nb.pages.forEach((pg) => {
        let matched = false;
        if (pg.title.toLowerCase().includes(q)) {
          results.push({
            notebookId: nb.id,
            notebookTitle: nb.title,
            pageId: pg.id,
            pageTitle: pg.title,
            matchedText: `Title match: ${pg.title}`,
            matchType: 'title',
          });
          matched = true;
        }

        if (pg.ocrText && pg.ocrText.toLowerCase().includes(q) && !matched) {
          results.push({
            notebookId: nb.id,
            notebookTitle: nb.title,
            pageId: pg.id,
            pageTitle: pg.title,
            matchedText: `Handwriting OCR: "${pg.ocrText.slice(0, 80)}..."`,
            matchType: 'ocr',
          });
          matched = true;
        }

        if (pg.tags && pg.tags.some((t) => t.toLowerCase().includes(q)) && !matched) {
          results.push({
            notebookId: nb.id,
            notebookTitle: nb.title,
            pageId: pg.id,
            pageTitle: pg.title,
            matchedText: `Tag match: #${pg.tags.join(', #')}`,
            matchType: 'tag',
          });
        }
      });
    });
  }

  return (
    <div
      className="w-64 h-full flex flex-col select-none border-r text-xs overflow-hidden"
      style={{
        backgroundColor: theme.sidebarBg,
        color: theme.sidebarFg,
        borderColor: theme.border,
      }}
    >
      {/* Header Bar */}
      <div
        className="px-3 py-2.5 font-bold tracking-wider uppercase border-b"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          borderColor: theme.border,
        }}
      >
        Search Workspace
      </div>

      {/* Query Bar */}
      <div className="p-2 border-b" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-black/20 border border-white/10 focus-within:border-sky-500">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search OCR handwriting, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-xs text-white placeholder-gray-500"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {query.trim().length === 0 ? (
          <div className="text-center py-10 text-gray-500 space-y-1">
            <Search size={28} className="mx-auto opacity-30" />
            <p className="font-medium">Global Handwriting Search</p>
            <p className="text-[10px]">Type to search across handwritten OCR notes, math equations, and notebook tags.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No notes or handwriting match "{query}"
          </div>
        ) : (
          results.map((res, i) => (
            <div
              key={i}
              onClick={() => onSelectPage(res.notebookId, res.pageId)}
              className="p-2 rounded border bg-black/10 border-white/5 hover:border-sky-500/50 hover:bg-sky-500/10 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-sky-400 font-semibold mb-1">
                <span className="flex items-center gap-1 truncate">
                  <Book size={12} />
                  {res.notebookTitle}
                </span>
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-1 font-medium text-white mb-1">
                <FileText size={12} className="text-gray-400" />
                <span>{res.pageTitle}</span>
              </div>
              <p className="text-[10px] text-gray-400 line-clamp-2 italic">
                {res.matchedText}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
