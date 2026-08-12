import React from 'react';
import { Tablet, CheckCircle, Palette, ZoomIn, Feather } from 'lucide-react';
import { PenToolType, HandwritingMode, ThemeId } from '../types';
import { THEMES } from '../lib/themes';

interface StatusBarProps {
  currentTool: PenToolType;
  strokeWidth: number;
  handwritingMode: HandwritingMode;
  tabletPressure: number;
  currentTheme: ThemeId;
  tabletConnected: boolean;
  saveStatusText?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentTool,
  strokeWidth,
  handwritingMode,
  tabletPressure,
  currentTheme,
  tabletConnected,
  saveStatusText = 'Auto-saved',
}) => {
  const theme = THEMES[currentTheme];

  const modeLabels: Record<HandwritingMode, string> = {
    1: 'Mode 1 (Smooth)',
    2: 'Mode 2 (Beautify)',
    3: 'Mode 3 (Script)',
  };

  return (
    <div
      className="h-6 px-3 flex items-center justify-between text-[11px] select-none z-20 shrink-0 font-sans"
      style={{
        backgroundColor: theme.statusBarBg,
        color: theme.statusBarFg,
      }}
    >
      {/* Left Items */}
      <div className="flex items-center gap-3">
        {/* Active Tool */}
        <div className="flex items-center gap-1 font-semibold uppercase tracking-wider">
          <Feather size={12} />
          <span>{currentTool}</span>
          <span className="opacity-70 text-[10px]">({strokeWidth}px)</span>
        </div>

        {/* Engine Mode */}
        <div className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded">
          <span>{modeLabels[handwritingMode]}</span>
        </div>

        {/* Save Status */}
        <div className="flex items-center gap-1 opacity-90">
          <CheckCircle size={11} className="text-emerald-300" />
          <span>{saveStatusText}</span>
        </div>
      </div>

      {/* Right Items */}
      <div className="flex items-center gap-3">
        {/* Tablet Pressure Gauge */}
        <div className="flex items-center gap-1.5">
          <Tablet size={12} className={tabletConnected ? 'text-emerald-300' : 'opacity-60'} />
          <span>Wacom Stylus Pressure:</span>
          <div className="w-12 h-2 bg-black/30 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-75"
              style={{ width: `${Math.min(100, Math.round(tabletPressure * 100))}%` }}
            />
          </div>
          <span className="font-mono text-[10px]">{tabletPressure.toFixed(2)}</span>
        </div>

        {/* Theme Name */}
        <div className="flex items-center gap-1 opacity-80 border-l border-white/20 pl-2">
          <Palette size={11} />
          <span>{theme.name}</span>
        </div>
      </div>
    </div>
  );
};
