'use client';

import { useMemo } from 'react';
import type { ClassroomParticipant } from '@/types';

type PresentationFilmstripProps = {
  participants: ClassroomParticipant[];
  teachers: ClassroomParticipant[];
  visible: boolean;
};

export function PresentationFilmstrip({
  participants,
  teachers,
  visible,
}: PresentationFilmstripProps) {
  const teacherIds = useMemo(() => new Set(teachers.map((t) => t.id)), [teachers]);

  const presenters = useMemo(() => {
    return participants.filter((p) => p.isScreenSharing || teacherIds.has(p.id));
  }, [participants, teacherIds]);

  if (!visible || presenters.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-800/40 border border-white/10">
      <p className="text-xs text-slate-400 font-medium mb-1">Presenting</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presenters.map((presenter) => (
          <div
            key={presenter.id}
            className="relative w-40 h-24 rounded-lg overflow-hidden bg-slate-900 border border-white/10 shrink-0"
          >
            {presenter.screenShareStream ? (
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && presenter.screenShareStream) el.srcObject = presenter.screenShareStream;
                }}
              />
            ) : presenter.stream && presenter.isVideoOn ? (
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && presenter.stream) el.srcObject = presenter.stream;
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                <div className="text-center space-y-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white mx-auto">
                    {presenter.avatar}
                  </div>
                  <p className="text-[10px] text-slate-300 font-medium truncate px-1">
                    {presenter.name}
                  </p>
                </div>
              </div>
            )}

            {/* Presenter badge */}
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-medium">
              {presenter.isScreenSharing ? 'Sharing' : 'Teacher'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}