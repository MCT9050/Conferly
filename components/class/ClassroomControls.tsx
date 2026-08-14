'use client';

import { useMemo } from 'react';
import type { ClassroomMode, PersonalLayout, ParticipantDensity, ViewportSize } from '@/types';

type ClassroomControlsProps = {
  mode: ClassroomMode;
  personalLayout: PersonalLayout;
  density: ParticipantDensity;
  viewport: ViewportSize;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  canPublish: boolean;
  canUseTeacherControls: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onModeChange: (mode: ClassroomMode) => void;
  onLayoutChange: (layout: PersonalLayout) => void;
  onDensityChange: (density: ParticipantDensity) => void;
  onLeave: () => void;
};

export function ClassroomControls({
  mode,
  personalLayout,
  density,
  viewport,
  isMuted,
  isVideoOn,
  isScreenSharing,
  isRecording,
  canPublish,
  canUseTeacherControls,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onModeChange,
  onLayoutChange,
  onDensityChange,
  onLeave,
}: ClassroomControlsProps) {
  const isMobile = viewport === 'mobile';

  const layouts: { value: PersonalLayout; label: string }[] = useMemo(
    () => [
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'standard', label: 'Standard' },
      { value: 'compact', label: 'Compact' },
      { value: 'paginated', label: 'Paginated' },
      { value: 'filmstrip', label: 'Filmstrip' },
    ],
    []
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-slate-900/95 border border-white/10 backdrop-blur-sm">
      {/* Primary controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          disabled={!canPublish}
          className={`p-3 rounded-xl border transition-all ${
            isMuted
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              : 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <span className="text-lg">{isMuted ? '🔇' : '🎤'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleVideo}
          disabled={!canPublish}
          className={`p-3 rounded-xl border transition-all ${
            !isVideoOn
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              : 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
          }`}
          aria-label={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
        >
          <span className="text-lg">{isVideoOn ? '📹' : '📷'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleScreenShare}
          disabled={!canPublish}
          className={`p-3 rounded-xl border transition-all ${
            isScreenSharing
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
              : 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
          }`}
          aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <span className="text-lg">🖥️</span>
        </button>

        <button
          type="button"
          onClick={onToggleRecording}
          disabled={!canUseTeacherControls}
          className={`p-3 rounded-xl border transition-all ${
            isRecording
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              : 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
          }`}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <span className="text-lg">{isRecording ? '⏹️' : '⏺️'}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-white/10 hidden sm:block" />

      {/* Layout selector (desktop/tablet) */}
      {!isMobile && (
        <div className="flex items-center gap-1">
          {layouts.map((layout) => (
            <button
              key={layout.value}
              type="button"
              onClick={() => onLayoutChange(layout.value)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                personalLayout === layout.value
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800/40 text-slate-400 border border-white/10 hover:bg-slate-800'
              }`}
              title={layout.label}
            >
              {layout.value}
            </button>
          ))}
        </div>
      )}

      {/* Density selector (desktop/tablet) */}
      {!isMobile && personalLayout !== 'filmstrip' && (
        <div className="flex items-center gap-1">
          {(['comfortable', 'standard', 'compact', 'paginated'] as ParticipantDensity[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDensityChange(d)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all capitalize ${
                density === d
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800/40 text-slate-400 border border-white/10 hover:bg-slate-800'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="w-px h-8 bg-white/10 hidden sm:block" />

      {/* Leave button */}
      <button
        type="button"
        onClick={onLeave}
        className="px-4 py-2.5 rounded-xl bg-red-600/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-600/20 transition-all"
      >
        Leave
      </button>
    </div>
  );
}