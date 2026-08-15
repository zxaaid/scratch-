import React, { useState } from 'react';
import {
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sun,
  Sliders,
  Eye,
  Lock,
  Unlock,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ImageElement, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface ImageEditToolbarProps {
  image: ImageElement;
  onUpdateImage: (updated: Partial<ImageElement>) => void;
  onDeleteImage: () => void;
  onDuplicateImage: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  currentTheme: ThemeId;
  isCropping: boolean;
  onToggleCrop: () => void;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}

export const ImageEditToolbar: React.FC<ImageEditToolbarProps> = ({
  image,
  onUpdateImage,
  onDeleteImage,
  onDuplicateImage,
  onBringForward,
  onSendBackward,
  currentTheme,
  isCropping,
  onToggleCrop,
  onApplyCrop,
  onCancelCrop,
}) => {
  const theme = THEMES[currentTheme];
  const [showAdjustments, setShowAdjustments] = useState(false);

  const opacity = image.opacity ?? 1;
  const brightness = image.brightness ?? 100;
  const contrast = image.contrast ?? 100;
  const saturation = image.saturation ?? 100;
  const grayscale = image.grayscale ?? 0;
  const invert = image.invert ?? 0;
  const isLocked = image.locked ?? false;

  const handleRotate90 = (direction: 'cw' | 'ccw') => {
    const currentRot = image.rotation || 0;
    const delta = direction === 'cw' ? 90 : -90;
    const newRot = (currentRot + delta + 360) % 360;
    onUpdateImage({ rotation: newRot });
  };

  const handleToggleInvert = () => {
    onUpdateImage({ invert: invert > 0 ? 0 : 100 });
  };

  const handleToggleGrayscale = () => {
    onUpdateImage({ grayscale: grayscale > 0 ? 0 : 100 });
  };

  const handleToggleFlipH = () => {
    onUpdateImage({ flipH: !image.flipH });
  };

  const handleToggleFlipV = () => {
    onUpdateImage({ flipV: !image.flipV });
  };

  const handleToggleLock = () => {
    onUpdateImage({ locked: !isLocked });
  };

  if (isCropping) {
    return (
      <div
        id="image-crop-toolbar"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-2xl border text-xs select-none backdrop-blur-md animate-in fade-in"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          color: theme.sidebarFg,
          borderColor: theme.accent,
        }}
      >
        <span className="font-semibold text-sky-400 flex items-center gap-1 mr-1">
          <Crop size={14} /> Drag blue handles to crop image
        </span>
        <button
          onClick={onApplyCrop}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow"
          title="Apply Crop"
        >
          <Check size={13} /> Apply
        </button>
        <button
          onClick={onCancelCrop}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-300 font-medium"
          title="Cancel Crop"
        >
          <X size={13} /> Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Primary Floating Toolbar */}
      <div
        id="image-edit-toolbar"
        className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-2xl border text-xs backdrop-blur-md z-40"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          color: theme.sidebarFg,
          borderColor: theme.border,
        }}
      >
        {/* Lock / Unlock */}
        <button
          onClick={handleToggleLock}
          className={`p-1.5 rounded transition-colors ${
            isLocked ? 'bg-amber-500/30 text-amber-300' : 'hover:bg-white/10 text-gray-300'
          }`}
          title={isLocked ? 'Unlock Image' : 'Lock Image Position'}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>

        <div className="w-px h-4 bg-white/15 mx-0.5" />

        {/* Adjustments Flyout Toggle */}
        <button
          onClick={() => setShowAdjustments((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            showAdjustments || grayscale > 0 || invert > 0 || opacity < 1
              ? 'bg-sky-500/30 text-sky-300 font-semibold'
              : 'hover:bg-white/10 text-gray-300'
          }`}
          title="Adjust Brightness, Contrast, Opacity & Filters"
        >
          <Sliders size={14} />
          <span>Filters</span>
        </button>

        {/* Crop */}
        <button
          onClick={onToggleCrop}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="Crop / Trim Image"
        >
          <Crop size={14} />
        </button>

        {/* Rotate 90 CW */}
        <button
          onClick={() => handleRotate90('cw')}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="Rotate 90° Clockwise"
        >
          <RotateCw size={14} />
        </button>

        {/* Flip H */}
        <button
          onClick={handleToggleFlipH}
          className={`p-1.5 rounded transition-colors ${
            image.flipH ? 'bg-sky-500/30 text-sky-300' : 'hover:bg-white/10 text-gray-300'
          }`}
          title="Flip Horizontally"
        >
          <FlipHorizontal size={14} />
        </button>

        {/* Invert Colors (Instant Dark Mode Adaptation) */}
        <button
          onClick={handleToggleInvert}
          className={`p-1.5 rounded transition-colors ${
            invert > 0 ? 'bg-indigo-500/30 text-indigo-300' : 'hover:bg-white/10 text-gray-300'
          }`}
          title="Invert Colors (Dark/Light mode contrast inversion)"
        >
          <Sparkles size={14} />
        </button>

        <div className="w-px h-4 bg-white/15 mx-0.5" />

        {/* Layer ordering */}
        {onBringForward && (
          <button
            onClick={onBringForward}
            className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title="Bring Forward"
          >
            <ArrowUp size={14} />
          </button>
        )}

        {onSendBackward && (
          <button
            onClick={onSendBackward}
            className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title="Send Backward"
          >
            <ArrowDown size={14} />
          </button>
        )}

        {/* Duplicate */}
        <button
          onClick={onDuplicateImage}
          className="p-1.5 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          title="Duplicate Image"
        >
          <Copy size={14} />
        </button>

        {/* Delete */}
        <button
          onClick={onDeleteImage}
          className="p-1.5 rounded hover:bg-rose-500/20 text-gray-300 hover:text-rose-400 transition-colors"
          title="Delete Image (Del)"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded Adjustments Panel */}
      {showAdjustments && (
        <div
          id="image-adjustments-panel"
          className="p-3 rounded-lg shadow-2xl border text-xs backdrop-blur-md z-40 w-64 space-y-2.5 animate-in fade-in"
          style={{
            backgroundColor: theme.sidebarBg,
            color: theme.sidebarFg,
            borderColor: theme.border,
          }}
        >
          <div className="flex items-center justify-between font-semibold border-b pb-1.5" style={{ borderColor: theme.border }}>
            <span className="flex items-center gap-1.5">
              <Sliders size={13} className="text-sky-400" /> Image Adjustments
            </span>
            <button
              onClick={() => {
                onUpdateImage({
                  opacity: 1,
                  brightness: 100,
                  contrast: 100,
                  saturation: 100,
                  grayscale: 0,
                  invert: 0,
                  blur: 0,
                });
              }}
              className="text-[10px] text-gray-400 hover:text-sky-400 flex items-center gap-1"
              title="Reset all adjustments"
            >
              <RefreshCw size={10} /> Reset
            </button>
          </div>

          {/* Opacity Slider (great for tracing) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-gray-300">
              <span className="flex items-center gap-1">
                <Eye size={12} className="text-amber-400" /> Opacity (Tracing)
              </span>
              <span>{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => onUpdateImage({ opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* Brightness */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-gray-300">
              <span className="flex items-center gap-1">
                <Sun size={12} className="text-yellow-400" /> Brightness
              </span>
              <span>{brightness}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={brightness}
              onChange={(e) => onUpdateImage({ brightness: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-gray-300">
              <span>Contrast</span>
              <span>{contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={contrast}
              onChange={(e) => onUpdateImage({ contrast: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* Quick Filters */}
          <div className="pt-1 flex items-center gap-1.5">
            <button
              onClick={handleToggleGrayscale}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-medium border text-center transition-colors ${
                grayscale > 0
                  ? 'bg-sky-500/30 border-sky-400 text-sky-200'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
              }`}
            >
              B&W Grayscale
            </button>
            <button
              onClick={handleToggleInvert}
              className={`flex-1 py-1 px-2 rounded text-[10px] font-medium border text-center transition-colors ${
                invert > 0
                  ? 'bg-indigo-500/30 border-indigo-400 text-indigo-200'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
              }`}
            >
              Invert Colors
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
