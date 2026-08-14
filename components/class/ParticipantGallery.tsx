'use client';

import { useMemo } from 'react';
import type { ClassroomParticipant, PersonalLayout, ParticipantDensity } from '@/types';

type ParticipantGalleryProps = {
  participants: ClassroomParticipant[];
  teachers: ClassroomParticipant[];
  layout: PersonalLayout;
  density: ParticipantDensity;
  viewport: 'mobile' | 'tablet' | 'desktop';
  onDensityChange: (density: ParticipantDensity) => void;
};

export function ParticipantGallery({
  participants,
  teachers,
  layout,
  density,
  viewport,
  onDensityChange,
}: ParticipantGalleryProps) {
  const students = useMemo(() => {
    const teacherIds = new Set(teachers.map((t) => t.id));
    return participants.filter((p) => !teacherIds.has(p.id));
  }, [participants, teachers]);

  const gridCols = useMemo(() => {
    if (layout === 'filmstrip') return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
    if (layout === 'paginated') return 'grid-cols-1 sm:grid-cols-2';

    switch (density) {
      case 'comfortable':
        return viewport === 'mobile' ? 'grid-cols-2' : viewport === 'tablet' ? 'grid-cols-3' : 'grid-cols-4';
      case 'standard':
        return viewport === 'mobile' ? 'grid-cols-2' : viewport === 'tablet' ? 'grid-cols-4' : 'grid-cols-5';
      case 'compact':
        return viewport === 'mobile' ? 'grid-cols-3' : viewport === 'tablet' ? 'grid-cols-5' : 'grid-cols-6';
      case 'paginated':
        return viewport === 'mobile' ? 'grid-cols-2' : 'grid-cols-3';
      default:
        return 'grid-cols-4';
    }
  }, [density, layout, viewport]);

  const tileSize = useMemo(() => {
    if (layout === 'filmstrip') return 'h-32';
    switch (density) {
      case 'comfortable':
        return 'h-40 sm:h-48';
      case 'standard':
        return 'h-32 sm:h-36';
      case 'compact':
        return 'h-24 sm:h-28';
      case 'paginated':
        return 'h-36 sm:h-40';
      default:
        return 'h-32 sm:h-36';
    }
  }, [density, layout]);

  const showControls = layout !== 'filmstrip' && viewport !== 'mobile';

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Density selector */}
      {showControls && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">
            {students.length} student{students.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            {(['comfortable', 'standard', 'compact', 'paginated'] as ParticipantDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDensityChange(d)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all capitalize ${
                  density === d
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800/40 text-slate-400 border border-white/10 hover:bg-slate-800'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Participant grid */}
      <div
        className={`grid ${gridCols} gap-2 sm:gap-3 overflow-y-auto auto-rows-fr`}
        style={{ maxHeight: 'calc(100vh - 20rem)' }}
      >
        {students.map((participant) => (
          <div
            key={participant.id}
            className={`relative ${tileSize} rounded-xl overflow-hidden bg-slate-800/60 border border-white/5 group`}
          >
            {participant.stream && participant.isVideoOn ? (
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && participant.stream) el.srcObject = participant.stream;
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-sm sm:text-base font-bold text-white mx-auto">
                    {participant.avatar}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-300 font-medium truncate px-2">
                    {participant.name}
                  </p>
                </div>
              </div>
            )}

            {/* Speaking indicator */}
            {participant.isSpeaking && (
              <div className="absolute inset-0 rounded-xl ring-2 ring-green-400 ring-inset pointer-events-none" />
            )}

            {/* Name and status overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
              <p className="text-[10px] sm:text-xs text-white truncate font-medium">{participant.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {participant.isMuted ? (
                  <span className="text-[9px] text-red-400">Muted</span>
                ) : (
                  <span className="text-[9px] text-green-400">Live</span>
                )}
                {!participant.isVideoOn && (
                  <span className="text-[9px] text-slate-400">Camera off</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}