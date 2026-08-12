import React from 'react';
import { PracticeTemplate, HandwritingFeedback, ThemeId } from '../types';
import { PRACTICE_TEMPLATES } from '../data/practiceTemplates';
import { THEMES } from '../lib/themes';
import {
  BookOpen,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  TrendingUp,
  Sliders,
} from 'lucide-react';

interface PracticePanelProps {
  activeTemplate: PracticeTemplate | null;
  setActiveTemplate: (template: PracticeTemplate | null) => void;
  showTemplateOverlay: boolean;
  setShowTemplateOverlay: (show: boolean) => void;
  handwritingFeedback: HandwritingFeedback | null;
  currentTheme: ThemeId;
}

export const PracticePanel: React.FC<PracticePanelProps> = ({
  activeTemplate,
  setActiveTemplate,
  showTemplateOverlay,
  setShowTemplateOverlay,
  handwritingFeedback,
  currentTheme,
}) => {
  const theme = THEMES[currentTheme];

  return (
    <div
      className="w-72 h-full border-r flex flex-col select-none text-xs shrink-0 overflow-y-auto"
      style={{
        backgroundColor: theme.sidebarBg,
        borderColor: theme.border,
        color: theme.sidebarFg,
      }}
    >
      {/* Panel Header */}
      <div
        className="px-4 py-3 font-semibold uppercase tracking-wider border-b flex items-center justify-between"
        style={{
          backgroundColor: theme.sidebarHeaderBg,
          borderColor: theme.border,
        }}
      >
        <div className="flex items-center gap-2 text-sky-400">
          <BookOpen size={16} />
          <span>Practice & Feedback</span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Section 1: Practice Reference Guides */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-200 text-xs flex items-center gap-1.5">
              <Sliders size={14} className="text-sky-400" />
              Reference Guide Template
            </h3>

            <button
              onClick={() => setShowTemplateOverlay(!showTemplateOverlay)}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                showTemplateOverlay
                  ? 'bg-sky-600 text-white'
                  : 'bg-zinc-800 text-gray-400 hover:text-white'
              }`}
              title="Toggle Reference Guide Background Overlay"
            >
              {showTemplateOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{showTemplateOverlay ? 'Visible' : 'Hidden'}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={() => setActiveTemplate(null)}
              className={`w-full p-2 rounded text-left border transition-all ${
                activeTemplate === null
                  ? 'bg-sky-900/40 border-sky-500 text-white font-medium'
                  : 'bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-gray-300'
              }`}
            >
              <div className="font-semibold text-xs">None (Freehand Writing)</div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                No reference guide overlay on canvas.
              </div>
            </button>

            {PRACTICE_TEMPLATES.map((tpl) => {
              const isSelected = activeTemplate?.id === tpl.id;
              return (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setActiveTemplate(tpl);
                    setShowTemplateOverlay(true);
                  }}
                  className={`w-full p-2.5 rounded text-left border transition-all ${
                    isSelected
                      ? 'bg-sky-900/40 border-sky-500 text-white font-medium shadow-md'
                      : 'bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">{tpl.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-sky-300">
                      {tpl.category}
                    </span>
                  </div>
                  <div className="font-serif italic text-[11px] text-sky-200/80 mt-1 truncate">
                    "{tpl.referenceText}"
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-tight">
                    {tpl.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Real-time Handwriting Score & Analysis */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <h3 className="font-bold text-gray-200 text-xs flex items-center gap-1.5">
            <Award size={15} className="text-emerald-400" />
            Handwriting Quality & Score
          </h3>

          {handwritingFeedback ? (
            <div className="space-y-3 p-3 rounded-xl bg-zinc-900/80 border border-emerald-500/30 text-white">
              {/* Score Header */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div>
                  <div className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider">
                    Overall Score
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-400">
                    {handwritingFeedback.score} <span className="text-xs text-gray-400">/ 100</span>
                  </div>
                </div>
                <div className="text-right text-[10px] text-gray-400">
                  <div>{handwritingFeedback.strokeCount} Raw Strokes</div>
                  <div className="text-emerald-400 font-mono mt-0.5">
                    {handwritingFeedback.analyzedAt}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded bg-zinc-800/60 border border-zinc-700/50">
                  <div className="text-[10px] text-gray-400">Baseline Align</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {handwritingFeedback.baselineConsistency}%
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-800/60 border border-zinc-700/50">
                  <div className="text-[10px] text-gray-400">Letter Height</div>
                  <div className="text-sm font-bold text-sky-400">
                    {handwritingFeedback.avgHeight} px
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-800/60 border border-zinc-700/50">
                  <div className="text-[10px] text-gray-400">Stroke Slant</div>
                  <div className="text-sm font-bold text-amber-400">
                    {handwritingFeedback.slantAngle}°
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-800/60 border border-zinc-700/50">
                  <div className="text-[10px] text-gray-400">Spacing Rhythm</div>
                  <div className="text-sm font-bold text-purple-400">
                    {handwritingFeedback.spacingUniformity}%
                  </div>
                </div>
              </div>

              {/* Actionable Guidance List */}
              <div className="space-y-1.5 pt-1">
                <div className="font-semibold text-gray-300 text-[11px] flex items-center gap-1">
                  <Sparkles size={12} className="text-emerald-400" />
                  Actionable Improvement Tips:
                </div>
                <ul className="space-y-1.5 text-gray-300">
                  {handwritingFeedback.feedbackTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-center text-gray-400 text-xs">
              Write or draw on the canvas to see your live handwriting score & feedback here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
