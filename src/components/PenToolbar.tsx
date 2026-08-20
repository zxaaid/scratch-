import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer,
  Hand,
  Pen,
  PenTool,
  Eraser,
  Lasso,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  ChevronDown,
  BookmarkPlus,
  Circle,
  Square,
  ArrowRight,
  Minus,
  Triangle,
  Star,
  Hexagon,
  Gem,
  ImagePlus,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import { PenToolType, ShapeType, HandwritingMode, PenPreset, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface PenToolbarProps {
  currentTool: PenToolType;
  setCurrentTool: (tool: PenToolType) => void;
  selectedShape: ShapeType;
  setSelectedShape: (shape: ShapeType) => void;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  handwritingMode?: HandwritingMode;
  setHandwritingMode?: (mode: HandwritingMode) => void;
  isDisappearingInk: boolean;
  onToggleDisappearingInk: () => void;
  penPresets: PenPreset[];
  onSavePreset: () => void;
  onApplyPreset: (preset: PenPreset) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearCanvas: () => void;
  canUndo: boolean;
  canRedo: boolean;
  currentTheme: ThemeId;
  onInsertMedia?: (file: File) => void;
  isZenMode?: boolean;
  onToggleZenMode?: () => void;
}

const QUICK_COLORS = [
  '#000000', // Pitch Black (#000000)
  '#06141B', // Deep Navy Midnight (#06141B)
  '#F4DB08', // Electric Gold (#F4DB08)
  '#ffffff', // Clean White
  '#dc2626', // Crimson Red
  '#16a34a', // Emerald Green
  '#38bdf8', // Sky Blue
  '#a855f7', // Purple
];

export const PenToolbar: React.FC<PenToolbarProps> = ({
  currentTool,
  setCurrentTool,
  selectedShape,
  setSelectedShape,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  opacity,
  setOpacity,
  isDisappearingInk,
  onToggleDisappearingInk,
  penPresets,
  onSavePreset,
  onApplyPreset,
  onUndo,
  onRedo,
  onClearCanvas,
  canUndo,
  canRedo,
  currentTheme,
  onInsertMedia,
  isZenMode = false,
  onToggleZenMode,
}) => {
  const theme = THEMES[currentTheme];
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node)) {
        setShowShapeMenu(false);
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mainTools: { id: PenToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'cursor', label: 'Cursor (Select, Move, Rotate, Crop & Scale)', icon: <MousePointer size={16} /> },
    { id: 'hand', label: 'Hand Tool (Grab & Drag Canvas or Elements - Shortcut: H / Space)', icon: <Hand size={16} /> },
    { id: 'fountain', label: 'Fountain Pen (Calligraphy)', icon: <PenTool size={16} /> },
    { id: 'pen', label: 'Fine Pen', icon: <Pen size={16} /> },
    { id: 'eraser', label: 'Eraser', icon: <Eraser size={16} /> },
    { id: 'lasso', label: 'Lasso Select Tool', icon: <Lasso size={16} /> },
    { id: 'text', label: 'Text Box', icon: <Type size={16} /> },
    { id: 'sticky', label: 'Sticky Note', icon: <StickyNote size={16} /> },
  ];

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onInsertMedia) {
      onInsertMedia(files[0]);
    }
    // reset input value so user can re-upload same filename
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      className="h-12 px-3 flex items-center justify-between border-b select-none z-30 text-xs shrink-0 relative overflow-visible"
      style={{
        backgroundColor: theme.tabActiveBg,
        borderColor: theme.border,
        color: theme.editorFg,
      }}
    >
      {/* Hidden File Input for Image/PDF Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,image/bmp,application/pdf,.pdf"
        className="hidden"
      />

      {/* Left: Tools Group */}
      <div className="flex items-center gap-1">
        {mainTools.map((t) => {
          const isActive = currentTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setCurrentTool(t.id);
                setShowShapeMenu(false);
              }}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#F4DB08] text-black shadow-md font-bold'
                  : 'hover:bg-white/10 text-gray-300'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          );
        })}

        {/* Add Image / PDF Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg flex items-center gap-1 hover:bg-white/10 text-[#F4DB08] hover:brightness-110 transition-all cursor-pointer font-medium"
          title="Add Image (PNG, JPG, SVG, WebP) or PDF to Canvas"
        >
          <ImagePlus size={16} />
          <span className="hidden md:inline text-[11px]">Add Image/PDF</span>
        </button>

        {/* Shapes Menu */}
        <div className="relative" ref={shapeMenuRef}>
          <button
            onClick={() => {
              setCurrentTool('shape');
              setShowShapeMenu((prev) => !prev);
            }}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              currentTool === 'shape'
                ? 'bg-[#F4DB08] text-black font-bold ring-1 ring-[#F4DB08]/80 shadow-md'
                : 'hover:bg-white/10 text-gray-300'
            }`}
            title="Click to select and draw shapes on the canvas"
          >
            {selectedShape === 'line' && <Minus size={15} className="text-purple-300" />}
            {selectedShape === 'arrow' && <ArrowRight size={15} className="text-amber-300" />}
            {selectedShape === 'rectangle' && <Square size={15} className="text-sky-300" />}
            {selectedShape === 'circle' && <Circle size={15} className="text-emerald-300" />}
            {selectedShape === 'polygon' && <Triangle size={15} className="text-rose-300" />}
            {selectedShape === 'star' && <Star size={15} className="text-yellow-300" />}
            {selectedShape === 'hexagon' && <Hexagon size={15} className="text-teal-300" />}
            {selectedShape === 'diamond' && <Gem size={15} className="text-cyan-300" />}
            <span className="capitalize hidden sm:inline text-[11px]">{selectedShape}</span>
            <ChevronDown size={12} className={`opacity-70 transition-transform ${showShapeMenu ? 'rotate-180' : ''}`} />
          </button>

          {showShapeMenu && (
            <div
              className="absolute left-0 top-full mt-1.5 w-44 p-1.5 rounded-xl shadow-2xl border z-50 flex flex-col gap-0.5 text-xs backdrop-blur-md"
              style={{ backgroundColor: theme.commandPaletteBg, borderColor: theme.border }}
            >
              <div className="px-2.5 py-1 text-[10px] font-bold text-[#F4DB08] uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
                <span>Select Shape</span>
                <span className="text-[9px] text-gray-400 normal-case font-normal">Draw on canvas</span>
              </div>
              <button
                onClick={() => { setSelectedShape('rectangle'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'rectangle' && currentTool === 'shape' ? 'bg-[#F4DB08] text-black font-bold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Square size={15} className="text-sky-400 shrink-0" /> <span>Rectangle</span>
              </button>
              <button
                onClick={() => { setSelectedShape('circle'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'circle' && currentTool === 'shape' ? 'bg-[#F4DB08] text-black font-bold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Circle size={15} className="text-emerald-400 shrink-0" /> <span>Circle / Ellipse</span>
              </button>
              <button
                onClick={() => { setSelectedShape('polygon'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'polygon' && currentTool === 'shape' ? 'bg-[#F4DB08] text-black font-bold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Triangle size={15} className="text-rose-400 shrink-0" /> <span>Triangle</span>
              </button>
              <button
                onClick={() => { setSelectedShape('star'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'star' && currentTool === 'shape' ? 'bg-sky-600 text-white font-semibold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Star size={15} className="text-yellow-400 shrink-0" /> <span>Star</span>
              </button>
              <button
                onClick={() => { setSelectedShape('diamond'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'diamond' && currentTool === 'shape' ? 'bg-sky-600 text-white font-semibold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Gem size={15} className="text-cyan-400 shrink-0" /> <span>Diamond</span>
              </button>
              <button
                onClick={() => { setSelectedShape('hexagon'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'hexagon' && currentTool === 'shape' ? 'bg-sky-600 text-white font-semibold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Hexagon size={15} className="text-teal-400 shrink-0" /> <span>Hexagon</span>
              </button>
              <button
                onClick={() => { setSelectedShape('arrow'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'arrow' && currentTool === 'shape' ? 'bg-sky-600 text-white font-semibold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <ArrowRight size={15} className="text-amber-400 shrink-0" /> <span>Arrow</span>
              </button>
              <button
                onClick={() => { setSelectedShape('line'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selectedShape === 'line' && currentTool === 'shape' ? 'bg-sky-600 text-white font-semibold' : 'hover:bg-white/10 text-gray-200'
                }`}
              >
                <Minus size={15} className="text-purple-400 shrink-0" /> <span>Straight Line</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Color Swatches & Width Slider */}
      <div className="flex items-center gap-3">
        {/* Color Palette */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                color.toLowerCase() === c.toLowerCase() ? 'scale-125 border-[#F4DB08] ring-2 ring-[#F4DB08]/50' : 'border-white/20 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="w-5 h-5 rounded-full border border-white/20 overflow-hidden cursor-pointer relative" title="Custom Color">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="opacity-0 absolute inset-0 cursor-pointer"
            />
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#F4DB08] via-amber-400 to-[#06141B]" />
          </label>
        </div>

        {/* Width Gauge & Slider */}
        <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
          <div
            className="rounded-full bg-white transition-all shrink-0"
            style={{ width: `${Math.max(4, Math.min(20, strokeWidth))}px`, height: `${Math.max(4, Math.min(20, strokeWidth))}px` }}
            title={`Nib Size: ${strokeWidth}px`}
          />
          <input
            type="range"
            min="1"
            max="32"
            step="0.5"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
            className="w-20 accent-[#F4DB08] cursor-pointer"
          />
          <span className="text-[10px] text-gray-300 w-6 font-mono">{strokeWidth}px</span>
        </div>

        {/* Disappearing / Vanishing Ink Mode Toggle Button */}
        <button
          onClick={onToggleDisappearingInk}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
            isDisappearingInk
              ? 'bg-[#F4DB08]/20 border-[#F4DB08] text-[#F4DB08] shadow-md shadow-[#F4DB08]/20 ring-1 ring-[#F4DB08]/60 animate-pulse'
              : 'bg-black/30 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
          }`}
          title="Vanishing Ink: When enabled, anything you draw with any pen style blinks for a few seconds and automatically disappears!"
        >
          <Sparkles
            size={14}
            className={`${isDisappearingInk ? 'text-[#F4DB08] animate-spin-slow' : 'text-gray-400'}`}
          />
          <span className="font-semibold">
            {isDisappearingInk ? 'Vanishing Ink: ON' : 'Vanishing Ink'}
          </span>
          {isDisappearingInk && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#F4DB08] animate-ping" />
          )}
        </button>
      </div>

      {/* Right: Presets, Undo, Redo, Clear */}
      <div className="flex items-center gap-1.5">
        {/* Presets Dropdown */}
        <div className="relative" ref={presetMenuRef}>
          <button
            onClick={() => setShowPresetMenu((prev) => !prev)}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1 text-[11px] cursor-pointer"
            title="Pen Presets"
          >
            <BookmarkPlus size={14} className="text-amber-400" />
            <span>Presets</span>
            <ChevronDown size={11} className={`transition-transform ${showPresetMenu ? 'rotate-180' : ''}`} />
          </button>

          {showPresetMenu && (
            <div
              className="absolute right-0 top-full mt-1.5 w-48 p-1.5 rounded-xl shadow-2xl border z-50 space-y-1 backdrop-blur-md"
              style={{ backgroundColor: theme.commandPaletteBg, borderColor: theme.border }}
            >
              <div className="px-2 py-1 font-semibold text-[10px] text-gray-400 uppercase tracking-wider">
                Saved Pen Presets
              </div>
              {penPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onApplyPreset(p); setShowPresetMenu(false); }}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/10 rounded-lg text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="text-[9px] text-gray-500">{p.width}px</span>
                </button>
              ))}
              <button
                onClick={() => { onSavePreset(); setShowPresetMenu(false); }}
                className="w-full text-center py-1 mt-1 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-500 text-[10px] cursor-pointer"
              >
                + Save Current Pen
              </button>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30 cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30 cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClearCanvas}
          className="p-1.5 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
          title="Clear Page Canvas"
        >
          <Trash2 size={16} />
        </button>

        {/* Maximize Working Area / Zen Mode Toggle */}
        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            className={`p-1.5 rounded transition-all cursor-pointer border ${
              isZenMode
                ? 'bg-sky-500/30 text-sky-200 border-sky-400'
                : 'hover:bg-white/10 text-gray-300 hover:text-sky-300 border-transparent'
            }`}
            title={
              isZenMode
                ? 'Exit Zen Mode (Collapse working area back to standard)'
                : 'Maximize Working Area (Zen Mode: Hides sidebar & maximizes workspace - Shortcut: F11 / Z)'
            }
          >
            {isZenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
      </div>
    </div>
  );
};
