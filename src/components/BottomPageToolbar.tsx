import React from 'react';
import { Plus, RectangleHorizontal, ChevronLeft, ChevronRight, FileText, Check, Maximize2 } from 'lucide-react';
import { Page, PageAspectRatio, ThemeId, Notebook } from '../types';
import { THEMES } from '../lib/themes';

interface BottomPageToolbarProps {
  pageAspectRatio: PageAspectRatio;
  onSetPageAspectRatio: (ratio: PageAspectRatio) => void;
  onAddPage: () => void;
  notebookPages?: Page[];
  currentPageIndex?: number;
  onSelectPage?: (pageId: string) => void;
  currentTheme: ThemeId;
  activePageTitle?: string;
  activePage?: Page;
  activeNotebook?: Notebook;
}

export const BottomPageToolbar: React.FC<BottomPageToolbarProps> = ({
  pageAspectRatio,
  onSetPageAspectRatio,
  onAddPage,
  notebookPages,
  currentPageIndex,
  onSelectPage,
  currentTheme,
  activePageTitle,
}) => {
  const theme = THEMES[currentTheme];
  const isLandscape = pageAspectRatio === 'a4-landscape';
  const isFlexible = pageAspectRatio === 'flexible';

  const toggleA4Landscape = () => {
    if (isLandscape) {
      onSetPageAspectRatio('a4-portrait');
    } else {
      onSetPageAspectRatio('a4-landscape');
    }
  };

  const toggleFlexible = () => {
    if (isFlexible) {
      onSetPageAspectRatio('a4-portrait');
    } else {
      onSetPageAspectRatio('flexible');
    }
  };

  return (
    <div
      className="h-10 px-4 flex items-center justify-between border-t text-xs select-none z-20 shrink-0 font-sans shadow-md"
      style={{
        backgroundColor: theme.sidebarBg,
        borderColor: theme.border,
        color: theme.editorFg,
      }}
    >
      {/* Left side: Page Navigation & Active Page Title */}
      <div className="flex items-center gap-3">
        {activePageTitle && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/20 border border-white/10 font-medium text-gray-300">
            <FileText size={13} className="text-sky-400" />
            <span className="max-w-[150px] truncate">{activePageTitle}</span>
          </div>
        )}

        {notebookPages && notebookPages.length > 0 && (
          <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => {
                if (currentPageIndex !== undefined && currentPageIndex > 0 && onSelectPage) {
                  onSelectPage(notebookPages[currentPageIndex - 1].id);
                }
              }}
              disabled={currentPageIndex === undefined || currentPageIndex <= 0}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={15} />
            </button>

            <select
              value={notebookPages[currentPageIndex ?? 0]?.id || ''}
              onChange={(e) => onSelectPage && onSelectPage(e.target.value)}
              className="bg-transparent text-sky-400 font-bold px-1 py-0.5 outline-none cursor-pointer text-xs"
              title="Jump to Page"
            >
              {notebookPages.map((p, idx) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                  Page {idx + 1} / {notebookPages.length}: {p.title}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (
                  currentPageIndex !== undefined &&
                  currentPageIndex < notebookPages.length - 1 &&
                  onSelectPage
                ) {
                  onSelectPage(notebookPages[currentPageIndex + 1].id);
                }
              }}
              disabled={currentPageIndex === undefined || currentPageIndex >= notebookPages.length - 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Right side: Action Controls (+ Add Page, A4 Landscape, Fit Working Area) */}
      <div className="flex items-center gap-2">
        {/* + ADD PAGE BUTTON */}
        <button
          onClick={onAddPage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 font-semibold text-white shadow-sm transition-all active:scale-95 cursor-pointer"
          title="Add a new page to this document"
        >
          <Plus size={15} />
          <span>Add Page</span>
        </button>

        {/* A4 LANDSCAPE BUTTON */}
        <button
          onClick={toggleA4Landscape}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border ${
            isLandscape
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
              : 'bg-black/30 hover:bg-black/50 text-gray-300 border-white/10 hover:text-white'
          }`}
          title={isLandscape ? 'Current: A4 Landscape (Click to toggle A4 Portrait)' : 'Switch to A4 Landscape format'}
        >
          <RectangleHorizontal size={15} className={isLandscape ? 'text-amber-400' : 'text-gray-400'} />
          <span>A4 Landscape</span>
          {isLandscape && <Check size={13} className="text-amber-400 ml-0.5" />}
        </button>

        {/* FIT WORKING AREA (FLEXIBLE PAGE) BUTTON */}
        <button
          onClick={toggleFlexible}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border ${
            isFlexible
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'bg-black/30 hover:bg-black/50 text-gray-300 border-white/10 hover:text-white'
          }`}
          title={
            isFlexible
              ? 'Current: Flexible Auto-Fit (Click to toggle A4 Portrait)'
              : 'Make page size flexible to fill the entire working area'
          }
        >
          <Maximize2 size={14} className={isFlexible ? 'text-emerald-400' : 'text-gray-400'} />
          <span>Fit Working Area</span>
          {isFlexible && <Check size={13} className="text-emerald-400 ml-0.5" />}
        </button>
      </div>
    </div>
  );
};
