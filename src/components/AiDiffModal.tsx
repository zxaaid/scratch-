import React from 'react';
import { Sparkles, Check, X, FileText, Wand2 } from 'lucide-react';
import { ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface AiDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  title: string;
  originalContent: string;
  aiOutputContent: string;
  currentTheme: ThemeId;
}

export const AiDiffModal: React.FC<AiDiffModalProps> = ({
  isOpen,
  onClose,
  onApply,
  title,
  originalContent,
  aiOutputContent,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[720px] max-h-[85vh] rounded-2xl shadow-2xl border flex flex-col text-xs overflow-hidden"
        style={{
          backgroundColor: theme.commandPaletteBg,
          color: theme.commandPaletteFg,
          borderColor: theme.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-2 font-bold text-sm text-sky-400">
            <Sparkles size={18} />
            <span>{title}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Side-by-Side Comparison */}
        <div className="p-5 flex-1 overflow-y-auto grid grid-cols-2 gap-4">
          {/* Left: Original */}
          <div className="space-y-2">
            <div className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
              Original Handwritten Note
            </div>
            <div className="p-3 rounded-lg border bg-black/20 border-white/10 h-64 overflow-y-auto font-mono leading-relaxed text-gray-300">
              {originalContent || '(Raw handwritten strokes on page)'}
            </div>
          </div>

          {/* Right: AI Processed */}
          <div className="space-y-2">
            <div className="font-semibold text-purple-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Wand2 size={12} />
              AI Beautified / Transcribed Result
            </div>
            <div className="p-3 rounded-lg border bg-purple-950/20 border-purple-500/40 h-64 overflow-y-auto leading-relaxed text-purple-100 whitespace-pre-wrap">
              {aiOutputContent || 'Generating beautified output...'}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between bg-black/20" style={{ borderColor: theme.border }}>
          <p className="text-[10px] text-gray-400">
            AI updates will replace or append to your notebook page with your permission.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded hover:bg-white/10 text-gray-300 font-medium"
            >
              Keep Original
            </button>
            <button
              onClick={() => {
                onApply();
                onClose();
              }}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1.5 shadow-md"
            >
              <Check size={14} />
              <span>Apply AI Transformation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
