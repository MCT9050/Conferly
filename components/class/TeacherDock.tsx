'use client';

import { useMemo } from 'react';
import type { ClassroomParticipant } from '@/types';

type TeacherDockProps = {
  teachers: ClassroomParticipant[];
  localUser: ClassroomParticipant | null;
};

export function TeacherDock({ teachers, localUser }: TeacherDockProps) {
  const isLocalTeacher = useMemo(() => {
    if (!localUser) return false;
    return ['owner', 'instructor', 'ta'].includes(localUser.role);
  }, [localUser]);

  if (!isLocalTeacher || teachers.length === 0) return null;

  const primaryTeacher = teachers[0];
  const secondaryTeacher = teachers[1];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return { label: 'Teacher 1', color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' };
      case 'instructor':
      case 'ta':
        return { label: 'Teacher 2', color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' };
      default:
        return { label: role, color: 'bg-slate-500/10 border-slate-500/30 text-slate-400' };
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-800/40 border border-white/10">
      {/* Primary teacher */}
      <div className="relative">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border-2 border-amber-500/50">
          {primaryTeacher.stream && primaryTeacher.isVideoOn ? (
            <video
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              ref={(el) => {
                if (el && primaryTeacher.stream) el.srcObject = primaryTeacher.stream;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 to-orange-500">
              <span className="text-lg font-bold text-white">{primaryTeacher.avatar}</span>
            </div>
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-slate-900 border border-amber-500/30">
          <span className="text-[10px] font-bold text-amber-400">T1</span>
        </div>
      </div>

      {/* Secondary teacher (if present) */}
      {secondaryTeacher && (
        <div className="relative">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border-2 border-blue-500/50">
            {secondaryTeacher.stream && secondaryTeacher.isVideoOn ? (
              <video
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                ref={(el) => {
                  if (el && secondaryTeacher.stream) el.srcObject = secondaryTeacher.stream;
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-500">
                <span className="text-lg font-bold text-white">{secondaryTeacher.avatar}</span>
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-slate-900 border border-blue-500/30">
            <span className="text-[10px] font-bold text-blue-400">T2</span>
          </div>
        </div>
      )}

      {/* Teacher info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-white truncate">{primaryTeacher.name}</p>
          {secondaryTeacher && (
            <>
              <span className="text-slate-500">+</span>
              <p className="text-sm font-medium text-slate-300 truncate">{secondaryTeacher.name}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-medium ${getRoleBadge(primaryTeacher.role).color}`}>
            {getRoleBadge(primaryTeacher.role).label}
          </span>
          {secondaryTeacher && (
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-medium ${getRoleBadge(secondaryTeacher.role).color}`}>
              {getRoleBadge(secondaryTeacher.role).label}
            </span>
          )}
        </div>
      </div>

      {/* Audio indicators */}
      <div className="flex items-center gap-1">
        {primaryTeacher.isMuted ? (
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="text-sm">🔇</span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <span className="text-sm">🎤</span>
          </div>
        )}
        {primaryTeacher.isSpeaking && (
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center animate-pulse">
            <span className="text-sm">💬</span>
          </div>
        )}
      </div>
    </div>
  );
}