import React, { useState } from 'react';
import {
  Sparkles,
  Wand2,
  FileSearch,
  BookOpenCheck,
  Calculator,
  Languages,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Feather,
} from 'lucide-react';
import { HandwritingMode, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface AiPanelProps {
  handwritingMode: HandwritingMode;
  setHandwritingMode: (mode: HandwritingMode) => void;
  onRunAiAction: (actionType: 'beautify' | 'ocr' | 'summarize' | 'equation' | 'translate') => void;
  isLoadingAi: boolean;
  aiStatusText: string;
  currentTheme: ThemeId;
}

export const AiPanel: React.FC<AiPanelProps> = ({
  handwritingMode,
  setHandwritingMode,
  onRunAiAction,
  isLoadingAi,
  aiStatusText,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];
  const [targetLang, setTargetLang] = useState('Spanish');

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
        <Sparkles size={16} className="text-amber-400" />
        <span>Handwriting AI Engine</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Handwriting Engine Mode Selection */}
        <div className="space-y-2">
          <label className="font-semibold text-gray-300 flex items-center gap-1">
            <Feather size={13} className="text-sky-400" />
            Handwriting Engine Mode
          </label>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Choose how Wacom stroke inputs & existing notes are processed in real-time.
          </p>

          <div className="space-y-1.5 pt-1">
            {/* Mode 1 */}
            <div
              onClick={() => setHandwritingMode(1)}
              className={`p-2.5 rounded border cursor-pointer transition-all ${
                handwritingMode === 1
                  ? 'bg-sky-600/20 border-sky-500 text-sky-200'
                  : 'bg-black/10 border-white/5 hover:border-white/20 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs mb-0.5">
                <span>Mode 1: Pure Smoothing</span>
                {handwritingMode === 1 && <CheckCircle2 size={13} className="text-sky-400" />}
              </div>
              <p className="text-[10px] opacity-80 leading-snug">
                Preserves exact raw strokes with Catmull-Rom curve smoothing, jitter removal & pressure curves.
              </p>
            </div>

            {/* Mode 2 */}
            <div
              onClick={() => setHandwritingMode(2)}
              className={`p-2.5 rounded border cursor-pointer transition-all ${
                handwritingMode === 2
                  ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                  : 'bg-black/10 border-white/5 hover:border-white/20 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs mb-0.5">
                <span>Mode 2: Style Beautification</span>
                {handwritingMode === 2 && <CheckCircle2 size={13} className="text-purple-400" />}
              </div>
              <p className="text-[10px] opacity-80 leading-snug">
                Aligns baselines and harmonizes slant while preserving your unique personal handwriting identity.
              </p>
            </div>

            {/* Mode 3 */}
            <div
              onClick={() => setHandwritingMode(3)}
              className={`p-2.5 rounded border cursor-pointer transition-all ${
                handwritingMode === 3
                  ? 'bg-amber-600/20 border-amber-500 text-amber-200'
                  : 'bg-black/10 border-white/5 hover:border-white/20 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs mb-0.5">
                <span>Mode 3: Elegant Script Conversion</span>
                {handwritingMode === 3 && <CheckCircle2 size={13} className="text-amber-400" />}
              </div>
              <p className="text-[10px] opacity-80 leading-snug">
                Converts messy handwriting into clean handwritten calligraphic ink script (not cold computer fonts).
              </p>
            </div>
          </div>
        </div>

        {/* AI Action Buttons */}
        <div className="space-y-2 pt-2 border-t" style={{ borderColor: theme.border }}>
          <label className="font-semibold text-gray-300">AI Assistant Tools</label>

          <div className="space-y-1.5">
            <button
              onClick={() => onRunAiAction('beautify')}
              disabled={isLoadingAi}
              className="w-full flex items-center gap-2 px-3 py-2 rounded bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Wand2 size={14} />
              <span>Beautify Current Page</span>
            </button>

            <button
              onClick={() => onRunAiAction('ocr')}
              disabled={isLoadingAi}
              className="w-full flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-medium transition-all disabled:opacity-50"
            >
              <FileSearch size={14} className="text-sky-400" />
              <span>Transcribe OCR to Markdown</span>
            </button>

            <button
              onClick={() => onRunAiAction('summarize')}
              disabled={isLoadingAi}
              className="w-full flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-medium transition-all disabled:opacity-50"
            >
              <BookOpenCheck size={14} className="text-emerald-400" />
              <span>Summarize Notes</span>
            </button>

            <button
              onClick={() => onRunAiAction('equation')}
              disabled={isLoadingAi}
              className="w-full flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-medium transition-all disabled:opacity-50"
            >
              <Calculator size={14} className="text-amber-400" />
              <span>Equation & Math Solver</span>
            </button>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => onRunAiAction('translate')}
                disabled={isLoadingAi}
                className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-medium transition-all disabled:opacity-50"
              >
                <Languages size={13} className="text-rose-400" />
                <span>Translate</span>
              </button>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-black/30 text-white border border-white/10 px-1.5 py-1.5 rounded outline-none text-[10px]"
              >
                <option value="Spanish">ES</option>
                <option value="French">FR</option>
                <option value="German">DE</option>
                <option value="Japanese">JA</option>
                <option value="Chinese">ZH</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Loading Status Banner */}
        {isLoadingAi && (
          <div className="p-3 rounded bg-sky-950/80 border border-sky-500/50 flex items-center gap-2.5 text-sky-200 animate-pulse">
            <Loader2 size={16} className="animate-spin text-sky-400 shrink-0" />
            <div className="text-[10px]">
              <p className="font-semibold">Processing AI Model...</p>
              <p className="text-sky-300/80">{aiStatusText || 'Analyzing handwritten strokes...'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
