import React, { useState } from 'react';
import {
  MousePointer,
  Pen,
  PenTool,
  Pencil,
  Highlighter,
  Brush,
  Eraser,
  Lasso,
  Shapes,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  Sparkles,
  ChevronDown,
  Palette,
  BookmarkPlus,
  Circle,
  Square,
  ArrowRight,
  Minus,
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
  handwritingMode: HandwritingMode;
  setHandwritingMode: (mode: HandwritingMode) => void;
  penPresets: PenPreset[];
  onSavePreset: () => void;
  onApplyPreset: (preset: PenPreset) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearCanvas: () => void;
  canUndo: boolean;
  canRedo: boolean;
  currentTheme: ThemeId;
}

const QUICK_COLORS = [
  '#1a1a2e', // Deep Ink
  '#0f4c81', // Blue Ink
  '#dc2626', // Red
  '#16a34a', // Emerald
  '#d97706', // Amber
  '#9333ea', // Purple
  '#fef08a', // Highlighter Yellow
  '#ffffff', // White
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
  handwritingMode,
  setHandwritingMode,
  penPresets,
  onSavePreset,
  onApplyPreset,
  onUndo,
  onRedo,
  onClearCanvas,
  canUndo,
  canRedo,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const mainTools: { id: PenToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'cursor', label: 'Cursor (Select, Move & Rotate)', icon: <MousePointer size={16} /> },
    { id: 'fountain', label: 'Fountain Pen (Calligraphy)', icon: <PenTool size={16} /> },
    { id: 'pen', label: 'Fine Pen', icon: <Pen size={16} /> },
    { id: 'pencil', label: 'Pencil (Texture)', icon: <Pencil size={16} /> },
    { id: 'brush', label: 'Brush Pen', icon: <Brush size={16} /> },
    { id: 'highlighter', label: 'Highlighter', icon: <Highlighter size={16} /> },
    { id: 'eraser', label: 'Eraser', icon: <Eraser size={16} /> },
    { id: 'lasso', label: 'Lasso Select Tool', icon: <Lasso size={16} /> },
    { id: 'text', label: 'Text Box', icon: <Type size={16} /> },
    { id: 'sticky', label: 'Sticky Note', icon: <StickyNote size={16} /> },
  ];

  return (
    <div
      className="h-12 px-3 flex items-center justify-between border-b select-none z-10 text-xs shrink-0 overflow-x-auto"
      style={{
        backgroundColor: theme.tabActiveBg,
        borderColor: theme.border,
        color: theme.editorFg,
      }}
    >
      {/* Left: Tools Group */}
      <div className="flex items-center gap-1">
        {mainTools.map((t) => {
          const isActive = currentTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setCurrentTool(t.id)}
              className={`p-1.5 rounded flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'hover:bg-white/10 text-gray-300'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          );
        })}

        {/* Shapes Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setCurrentTool('shape');
              setShowShapeMenu(!showShapeMenu);
            }}
            className={`p-1.5 rounded flex items-center gap-1 transition-all ${
              currentTool === 'shape'
                ? 'bg-sky-600 text-white font-semibold'
                : 'hover:bg-white/10 text-gray-300'
            }`}
            title="Geometric Shapes"
          >
            <Shapes size={16} />
            <ChevronDown size={12} />
          </button>

          {showShapeMenu && (
            <div
              className="absolute left-0 top-full mt-1 w-32 p-1 rounded shadow-xl border z-50 flex flex-col gap-0.5"
              style={{ backgroundColor: theme.commandPaletteBg, borderColor: theme.border }}
            >
              <button
                onClick={() => { setSelectedShape('line'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded text-left"
              >
                <Minus size={14} /> <span>Line</span>
              </button>
              <button
                onClick={() => { setSelectedShape('arrow'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded text-left"
              >
                <ArrowRight size={14} /> <span>Arrow</span>
              </button>
              <button
                onClick={() => { setSelectedShape('rectangle'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded text-left"
              >
                <Square size={14} /> <span>Rectangle</span>
              </button>
              <button
                onClick={() => { setSelectedShape('circle'); setCurrentTool('shape'); setShowShapeMenu(false); }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/10 rounded text-left"
              >
                <Circle size={14} /> <span>Circle</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Color Swatches & Width Slider */}
      <div className="flex items-center gap-3">
        {/* Color Palette */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded border border-white/10">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border transition-transform ${
                color === c ? 'scale-125 border-sky-400 ring-2 ring-sky-400/40' : 'border-white/20 hover:scale-110'
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
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-pink-500 via-amber-400 to-sky-400" />
          </label>
        </div>

        {/* Width Gauge & Slider */}
        <div className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded border border-white/10">
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
            className="w-20 accent-sky-500 cursor-pointer"
          />
          <span className="text-[10px] text-gray-400 w-6">{strokeWidth}px</span>
        </div>

        {/* Handwriting Engine Mode Switcher Pill */}
        <div className="flex items-center bg-black/30 p-0.5 rounded border border-white/10">
          <button
            onClick={() => setHandwritingMode(1)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              handwritingMode === 1 ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Mode 1: Raw Smoothing"
          >
            M1 Smooth
          </button>
          <button
            onClick={() => setHandwritingMode(2)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              handwritingMode === 2 ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Mode 2: Style Beautify"
          >
            M2 Beautify
          </button>
          <button
            onClick={() => setHandwritingMode(3)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              handwritingMode === 3 ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
            title="Mode 3: Elegant Script"
          >
            M3 Script
          </button>
        </div>
      </div>

      {/* Right: Presets, Undo, Redo, Clear */}
      <div className="flex items-center gap-1.5">
        {/* Presets Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresetMenu(!showPresetMenu)}
            className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1 text-[11px]"
            title="Pen Presets"
          >
            <BookmarkPlus size={14} className="text-amber-400" />
            <span>Presets</span>
            <ChevronDown size={11} />
          </button>

          {showPresetMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-48 p-1.5 rounded shadow-2xl border z-50 space-y-1"
              style={{ backgroundColor: theme.commandPaletteBg, borderColor: theme.border }}
            >
              <div className="px-2 py-1 font-semibold text-[10px] text-gray-400 uppercase tracking-wider">
                Saved Pen Presets
              </div>
              {penPresets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onApplyPreset(p); setShowPresetMenu(false); }}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/10 rounded text-left"
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
                className="w-full text-center py-1 mt-1 rounded bg-sky-600 text-white font-medium hover:bg-sky-500 text-[10px]"
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
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClearCanvas}
          className="p-1.5 rounded hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors"
          title="Clear Page Canvas"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
