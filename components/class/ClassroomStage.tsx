'use client';

import { useMemo } from 'react';
import type { ClassroomParticipant, ClassroomMode } from '@/types';

type ClassroomStageProps = {
  mode: ClassroomMode;
  activeScreenShare: ClassroomParticipant | null;
  teachers: ClassroomParticipant[];
  localUser: ClassroomParticipant | null;
  onModeChange: (mode: ClassroomMode) => void;
};

export function ClassroomStage({
  mode,
  activeScreenShare,
  teachers,
  localUser,
  onModeChange,
}: ClassroomStageProps) {
  const isTeacher = useMemo(() => {
    if (!localUser) return false;
    return ['owner', 'instructor', 'ta'].includes(localUser.role);
  }, [localUser]);

  const renderContent = () => {
    // Screen share takes priority
    if (mode === 'screen-share' && activeScreenShare) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <video
            autoPlay
            playsInline
            className="max-w-full max-h-full object-contain"
            ref={(el) => {
              if (el && activeScreenShare.screenShareStream) {
                el.srcObject = activeScreenShare.screenShareStream;
              }
            }}
          />
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm">
            Presenting: {activeScreenShare.name}
          </div>
        </div>
      );
    }

    // Whiteboard mode
    if (mode === 'whiteboard') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          <div className="text-center space-y-3">
            <div className="text-6xl">📝</div>
            <p className="text-slate-400 text-sm">Whiteboard active</p>
            <p className="text-slate-500 text-xs">
              Teachers can annotate and share with the class
            </p>
          </div>
        </div>
      );
    }

    // Teacher focus mode
    if (mode === 'teacher-focus' && teachers.length > 0) {
      const teacher = teachers[0];
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900">
          {teacher.stream && teacher.isVideoOn ? (
            <video
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain"
              ref={(el) => {
                if (el && teacher.stream) el.srcObject = teacher.stream;
              }}
            />
          ) : (
            <div className="text-center space-y-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white mx-auto">
                {teacher.avatar}
              </div>
              <p className="text-white font-medium">{teacher.name}</p>
              <p className="text-slate-400 text-sm">Camera off</p>
            </div>
          )}
        </div>
      );
    }

    // Welcome / default mode
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">👋</div>
          <h2 className="text-2xl font-bold text-white">Welcome to Class</h2>
          <p className="text-slate-400 text-sm">
            The classroom is ready. Teachers can share their screen or open the
            whiteboard.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
      {renderContent()}

      {/* Teacher mode selector */}
      {isTeacher && (
        <div className="absolute top-4 right-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onModeChange('welcome')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'welcome'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/60 text-slate-300 border border-white/10 hover:bg-slate-800'
            }`}
          >
            Welcome
          </button>
          <button
            type="button"
            onClick={() => onModeChange('teacher-focus')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'teacher-focus'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/60 text-slate-300 border border-white/10 hover:bg-slate-800'
            }`}
          >
            Teacher Focus
          </button>
          <button
            type="button"
            onClick={() => onModeChange('screen-share')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'screen-share'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/60 text-slate-300 border border-white/10 hover:bg-slate-800'
            }`}
          >
            Screen Share
          </button>
          <button
            type="button"
            onClick={() => onModeChange('whiteboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'whiteboard'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800/60 text-slate-300 border border-white/10 hover:bg-slate-800'
            }`}
          >
            Whiteboard
          </button>
        </div>
      )}
    </div>
  );
}