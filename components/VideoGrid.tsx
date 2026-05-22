"use client";

import { memo, useEffect, useRef, useMemo } from 'react';
import { Mic, MicOff, Pin, MoreVertical, Hand, Monitor, AlertTriangle } from 'lucide-react';
import type { Participant } from '../types';

interface VideoGridProps {
  participants: Participant[];
  screenStream: MediaStream | null;
  handRaised: boolean;
}

const VideoTile = memo(function VideoTile({ participant, isSelf }: { participant: Participant; isSelf: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div
      className={`video-grid-item relative group transition-shadow duration-300 ${
        participant.isSpeaking ? 'ring-2 ring-blue-500/60 shadow-lg shadow-blue-500/10' : ''
      }`}
    >
      {participant.stream && participant.isVideoOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="w-full h-full object-cover"
          style={isSelf ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xl sm:text-3xl font-bold shadow-lg">
            {participant.avatar}
          </div>
        </div>
      )}

      {participant.isSpeaking && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 0 2px rgba(245, 158, 11, ${0.4 + participant.audioLevel * 2})` }}
        />
      )}

      {!participant.isMuted && participant.audioLevel > 0.02 && (
        <div className="absolute bottom-12 left-3 right-3 h-1 rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-75"
            style={{ width: `${Math.min(100, participant.audioLevel * 300)}%` }}
          />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full shrink-0 transition-colors ${participant.isSpeaking ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-xs sm:text-sm font-medium truncate">
              {participant.name}
              {isSelf && <span className="text-slate-400 ml-1 hidden sm:inline">(You)</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {participant.isMuted ? (
              <div className="p-1 rounded bg-red-500/20">
                <MicOff className="w-3.5 h-3.5 text-red-400" />
              </div>
            ) : (
              <div className="p-1 rounded bg-slate-700/50">
                <Mic className="w-3.5 h-3.5 text-slate-300" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors">
          <Pin className="w-3.5 h-3.5" />
        </button>
        <button className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors">
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}, (prev, next) => {
  const left = prev.participant;
  const right = next.participant;
  return (
    prev.isSelf === next.isSelf &&
    left.id === right.id &&
    left.stream === right.stream &&
    left.isSpeaking === right.isSpeaking &&
    left.isVideoOn === right.isVideoOn &&
    left.isMuted === right.isMuted &&
    left.audioLevel === right.audioLevel &&
    left.name === right.name &&
    left.avatar === right.avatar
  );
});

// Instead of showing the live shared screen back to the presenter (which causes the hall-of-mirrors effect
// when the user shares the same browser window/tab), we show a clean status card.
function PresentationStatusTile() {
  return (
    <div className="video-grid-item relative col-span-full row-span-1 sm:row-span-2 ring-2 ring-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.18),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_35%)]" />
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 py-10 sm:py-14 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/10">
          <Monitor className="w-8 h-8 text-cyan-400" />
        </div>
        <div className="space-y-2 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Screen share active
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">You are presenting</h3>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Your screen is being shared with everyone in the meeting.
          </p>
          <div className="flex items-start gap-2 justify-center text-xs text-slate-500 pt-2 max-w-md mx-auto">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Local preview is hidden to prevent the duplicated “hall of mirrors” effect when sharing the same browser window or tab.
            </span>
          </div>
        </div>
      </div>
      <div className="absolute top-2 left-2 px-3 py-1 rounded-lg bg-cyan-500/15 backdrop-blur-sm text-xs text-cyan-300 font-medium border border-cyan-500/20">
        📺 Presenting
      </div>
    </div>
  );
}

export default function VideoGrid({ participants, screenStream, handRaised }: VideoGridProps) {
  const gridClass = useMemo(() => {
    const count = participants.length + (screenStream ? 1 : 0);
    if (screenStream) return 'grid-cols-1 lg:grid-cols-3';
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 lg:grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3 lg:grid-cols-4';
  }, [participants.length, screenStream]);

  return (
    <div className={`grid ${gridClass} gap-2 sm:gap-3 p-2 sm:p-3 flex-1 auto-rows-fr relative`}>
      {screenStream && <PresentationStatusTile />}
      {participants.map(p => (
        <VideoTile key={p.id} participant={p} isSelf={p.id === 'self'} />
      ))}

      {handRaised && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 flex items-center gap-2 text-sm text-amber-300 animate-bounce z-10">
          <Hand className="w-4 h-4" />
          You raised your hand
        </div>
      )}
    </div>
  );
}
