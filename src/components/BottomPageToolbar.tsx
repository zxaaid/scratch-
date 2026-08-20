import React from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Expand,
  LayoutGrid,
  File,
} from 'lucide-react';
import { Page, PageAspectRatio, ThemeId, Notebook, PageTemplate } from '../types';
import { THEMES } from '../lib/themes';
import { PAGE_ASPECT_PRESETS } from '../lib/pageDimensions';

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
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
  // Relocated Viewport / Zoom Controls (Outside working canvas)
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCenterAndFit?: () => void;
  onFitWidth?: () => void;
  onFitFullScreen?: () => void;
  // Template Selector (Clean Blank, Ruled, Grid, Dot)
  activeTemplate?: PageTemplate;
  onChangeTemplate?: (template: PageTemplate) => void;
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
  activePage,
  isZenMode = false,
  onToggleZenMode,
  zoom = 1.0,
  onZoomIn,
  onZoomOut,
  onCenterAndFit,
  onFitWidth,
  onFitFullScreen,
  activeTemplate = 'blank',
  onChangeTemplate,
}) => {
  const theme = THEMES[currentTheme];
  const isFlexible = pageAspectRatio === 'flexible';
  const isInfinite = pageAspectRatio === 'infinite';

  const currentTemplate = activePage?.template || activeTemplate || 'blank';

  return (
    <div
      id="bottom-page-toolbar"
      className="h-11 px-3 flex items-center justify-between border-t text-xs select-none z-20 shrink-0 font-sans shadow-lg gap-2 overflow-x-auto"
      style={{
        backgroundColor: '#000000',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        color: '#f1f5f9',
      }}
    >
      {/* Left side: Page Navigation, Page Info & Template Selector */}
      <div className="flex items-center gap-2 shrink-0">
        {activePageTitle && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 font-medium text-gray-200">
            <FileText size={13} className="text-white" />
            <span className="max-w-[130px] truncate text-[11px]">{activePageTitle}</span>
          </div>
        )}

        {/* Page Switcher */}
        {notebookPages && notebookPages.length > 0 && (
          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => {
                if (currentPageIndex !== undefined && currentPageIndex > 0 && onSelectPage) {
                  onSelectPage(notebookPages[currentPageIndex - 1].id);
                }
              }}
              disabled={currentPageIndex === undefined || currentPageIndex <= 0}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-25 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <select
              value={notebookPages[currentPageIndex ?? 0]?.id || ''}
              onChange={(e) => onSelectPage && onSelectPage(e.target.value)}
              className="bg-transparent text-white font-semibold px-1 py-0.5 outline-none cursor-pointer text-xs"
              title="Jump to Page"
            >
              {notebookPages.map((p, idx) => (
                <option key={p.id} value={p.id} className="bg-[#000000] text-white">
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
              className="p-1 rounded hover:bg-white/10 disabled:opacity-25 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* PAGE TEMPLATE SELECTOR (Clean Page / Blank / Ruled / Grid / Dot) */}
        {onChangeTemplate && (
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
            <File size={12} className="text-white" />
            <select
              value={currentTemplate}
              onChange={(e) => onChangeTemplate(e.target.value as PageTemplate)}
              className="bg-transparent text-gray-200 hover:text-white font-medium outline-none cursor-pointer text-[11px]"
              title="Page Template (Clean Blank Page, Ruled Lines, Grid, etc.)"
            >
              <option value="blank" className="bg-[#000000] text-white">
                Clean Blank Page
              </option>
              <option value="ruled" className="bg-[#000000] text-white">
                Ruled Lines
              </option>
              <option value="grid" className="bg-[#000000] text-white">
                Square Grid
              </option>
              <option value="dot" className="bg-[#000000] text-white">
                Dot Matrix
              </option>
              <option value="graph" className="bg-[#000000] text-white">
                Fine Graph
              </option>
            </select>
          </div>
        )}
      </div>

      {/* Center & Right side: Viewport Zoom Controls (Relocated Out of Canvas) & Layout Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* VIEWPORT CONTROLS BAR */}
        <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-white/10 text-gray-200">
          {onZoomOut && (
            <button
              onClick={onZoomOut}
              className="p-1 rounded hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out (Ctrl -)"
            >
              <ZoomOut size={14} />
            </button>
          )}

          {onCenterAndFit && (
            <button
              onClick={onCenterAndFit}
              className="px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white hover:text-gray-200 hover:bg-white/10 rounded cursor-pointer transition-all"
              title="Click to Reset Zoom & Center Page"
            >
              {Math.round(zoom * 100)}%
            </button>
          )}

          {onZoomIn && (
            <button
              onClick={onZoomIn}
              className="p-1 rounded hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Zoom In (Ctrl +)"
            >
              <ZoomIn size={14} />
            </button>
          )}

          {onCenterAndFit && (
            <button
              onClick={onCenterAndFit}
              className="px-2 py-0.5 rounded hover:bg-white/15 text-gray-300 hover:text-white transition-all text-[11px] font-medium cursor-pointer"
              title="Center & Fit Page on Screen"
            >
              Center
            </button>
          )}

          {onFitWidth && (
            <button
              onClick={onFitWidth}
              className="px-2 py-0.5 rounded hover:bg-white/15 text-gray-300 hover:text-white transition-all text-[11px] font-medium cursor-pointer"
              title="Fit Page to Width"
            >
              Fit Width
            </button>
          )}

          {onFitFullScreen && (
            <button
              onClick={onFitFullScreen}
              className="p-1 rounded hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Fit Screen (Maximize on Viewport)"
            >
              <Expand size={14} />
            </button>
          )}
        </div>

        <div className="h-4 w-[1px] bg-white/15 mx-0.5" />

        {/* + ADD PAGE BUTTON */}
        <button
          onClick={onAddPage}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-200 font-semibold text-black shadow-sm transition-all active:scale-95 cursor-pointer text-xs"
          title="Add a new clean page to this document"
        >
          <Plus size={14} className="stroke-[2.5]" />
          <span>Add Page</span>
        </button>

        {/* ASPECT RATIO & WORKING AREA PRESET DROPDOWN */}
        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-gray-300">
          <LayoutGrid size={13} className="text-white" />
          <select
            value={pageAspectRatio}
            onChange={(e) => onSetPageAspectRatio(e.target.value as PageAspectRatio)}
            className="bg-transparent text-gray-200 hover:text-white font-medium outline-none cursor-pointer text-xs"
            title="Select Workspace Size Preset"
          >
            {Object.values(PAGE_ASPECT_PRESETS).map((preset) => (
              <option key={preset.id} value={preset.id} className="bg-[#000000] text-white">
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {/* MAXIMIZE WORKING AREA / ZEN MODE TOGGLE */}
        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer border text-xs ${
              isZenMode
                ? 'bg-white/20 text-white border-white shadow-[0_0_10px_rgba(255,255,255,0.25)]'
                : 'bg-black/40 hover:bg-black/60 text-gray-300 hover:text-white border-white/10 hover:border-white/40'
            }`}
            title={
              isZenMode
                ? 'Exit Zen Mode (Collapse working area back to standard)'
                : 'Maximize Working Area (Zen Mode: Hides sidebars & maximizes canvas)'
            }
          >
            {isZenMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isZenMode ? 'Exit Max' : 'Maximize'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
