import React from 'react';
import { Settings, Sliders, Palette, Tablet, Keyboard, Grid, Check, RectangleHorizontal } from 'lucide-react';
import { TabletSettings, ThemeId, PageTemplate, PageAspectRatio } from '../types';
import { THEMES } from '../lib/themes';
import { PAGE_ASPECT_PRESETS } from '../lib/pageDimensions';

interface SettingsPanelProps {
  tabletSettings: TabletSettings;
  setTabletSettings: React.Dispatch<React.SetStateAction<TabletSettings>>;
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  defaultTemplate: PageTemplate;
  setDefaultTemplate: (tpl: PageTemplate) => void;
  pageAspectRatio: PageAspectRatio;
  setPageAspectRatio: (ratio: PageAspectRatio) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  tabletSettings,
  setTabletSettings,
  currentTheme,
  setTheme,
  defaultTemplate,
  setDefaultTemplate,
  pageAspectRatio,
  setPageAspectRatio,
}) => {
  const theme = THEMES[currentTheme];

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
        className="px-3 py-2.5 font-bold tracking-wider uppercase flex items-center gap-2 border-b"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          borderColor: theme.border,
        }}
      >
        <Settings size={16} />
        <span>Settings & Tablet</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Theme Picker */}
        <div className="space-y-2">
          <label className="font-semibold text-gray-300 flex items-center gap-1.5">
            <Palette size={14} className="text-sky-400" />
            Color Theme
          </label>
          <div className="space-y-1">
            {Object.values(THEMES).map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors ${
                  currentTheme === t.id
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'bg-black/10 hover:bg-white/10 text-gray-300'
                }`}
              >
                <span>{t.name}</span>
                {currentTheme === t.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Wacom & Tablet Pressure Configuration */}
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: theme.border }}>
          <label className="font-semibold text-gray-300 flex items-center gap-1.5">
            <Tablet size={14} className="text-emerald-400" />
            Wacom & Stylus Settings
          </label>

          {/* Pressure Sensitivity */}
          <div className="space-y-1">
            <div className="flex justify-between text-gray-400 text-[10px]">
              <span>Pressure Sensitivity</span>
              <span>{tabletSettings.pressureSensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.05"
              value={tabletSettings.pressureSensitivity}
              onChange={(e) =>
                setTabletSettings((prev) => ({
                  ...prev,
                  pressureSensitivity: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          {/* Smoothing Strength */}
          <div className="space-y-1">
            <div className="flex justify-between text-gray-400 text-[10px]">
              <span>Stroke Curve Smoothing</span>
              <span>{Math.round(tabletSettings.smoothingStrength * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={tabletSettings.smoothingStrength}
              onChange={(e) =>
                setTabletSettings((prev) => ({
                  ...prev,
                  smoothingStrength: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Palm Rejection */}
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-gray-300">Palm Rejection</span>
            <input
              type="checkbox"
              checked={tabletSettings.palmRejection}
              onChange={(e) =>
                setTabletSettings((prev) => ({
                  ...prev,
                  palmRejection: e.target.checked,
                }))
              }
              className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
            />
          </label>

          {/* Smart Shape Recognition */}
          <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-gray-300">Smart Shape Recognition</span>
            <input
              type="checkbox"
              checked={tabletSettings.snapShapes}
              onChange={(e) =>
                setTabletSettings((prev) => ({
                  ...prev,
                  snapShapes: e.target.checked,
                }))
              }
              className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>

        {/* Page Aspect Ratio & Dimensions */}
        <div className="space-y-2 pt-2 border-t" style={{ borderColor: theme.border }}>
          <label className="font-semibold text-gray-300 flex items-center gap-1.5">
            <RectangleHorizontal size={14} className="text-sky-400" />
            Page Size & Aspect Ratio
          </label>
          <select
            value={pageAspectRatio}
            onChange={(e) => setPageAspectRatio(e.target.value as PageAspectRatio)}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white outline-none cursor-pointer text-xs"
          >
            {Object.values(PAGE_ASPECT_PRESETS).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-400">
            Selected size:{' '}
            {pageAspectRatio === 'flexible'
              ? 'Auto-Fit Working Area (Window)'
              : `${PAGE_ASPECT_PRESETS[pageAspectRatio].width} × ${PAGE_ASPECT_PRESETS[pageAspectRatio].height} px`}
          </p>
        </div>

        {/* Default Page Template */}
        <div className="space-y-2 pt-2 border-t" style={{ borderColor: theme.border }}>
          <label className="font-semibold text-gray-300 flex items-center gap-1.5">
            <Grid size={14} className="text-amber-400" />
            Default Page Template
          </label>
          <select
            value={defaultTemplate}
            onChange={(e) => setDefaultTemplate(e.target.value as PageTemplate)}
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white outline-none"
          >
            <option value="blank">Clean Page (Blank White)</option>
            <option value="black">Complete Black (#000000)</option>
            <option value="ruled">Ruled Lines</option>
            <option value="grid">Square Grid</option>
            <option value="graph">Fine Graph</option>
            <option value="dot">Dot Grid Paper</option>
            <option value="dark-ruled">Dark Ruled</option>
            <option value="dark-grid">Dark Grid</option>
          </select>
        </div>

        {/* Keyboard Shortcuts List */}
        <div className="space-y-2 pt-2 border-t text-[10px] text-gray-400" style={{ borderColor: theme.border }}>
          <label className="font-semibold text-gray-300 flex items-center gap-1.5 text-xs">
            <Keyboard size={14} className="text-rose-400" />
            Shortcuts Reference
          </label>
          <div className="space-y-1 bg-black/20 p-2 rounded border border-white/5">
            <div className="flex justify-between"><span>Pen / Ink Tool</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">Ctrl+Shift+P / P</kbd></div>
            <div className="flex justify-between"><span>Hand Gesture / Tool</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">Ctrl+Shift+H / H</kbd></div>
            <div className="flex justify-between"><span>Eraser Tool</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">E</kbd></div>
            <div className="flex justify-between"><span>Lasso Tool</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">L</kbd></div>
            <div className="flex justify-between"><span>Command Palette</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">Ctrl+K / F1</kbd></div>
            <div className="flex justify-between"><span>Pan Canvas</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">Space + Drag</kbd></div>
            <div className="flex justify-between"><span>Undo / Redo</span><kbd className="px-1 bg-white/10 rounded text-[9px] text-white">Ctrl+Z / Ctrl+Y</kbd></div>
          </div>
        </div>
      </div>
    </div>
  );
};
