import { useEffect, useRef, useMemo } from 'react';
import { Mic, MicOff, Pin, MoreVertical, Hand } from 'lucide-react';
import type { Participant } from '../types';

interface VideoGridProps {
  participants: Participant[];
  screenStream: MediaStream | null;
  handRaised: boolean;
}

function VideoTile({ participant, isSelf }: { participant: Participant; isSelf: boolean }) {
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
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-xl sm:text-3xl font-bold shadow-lg">
            {participant.avatar}
          </div>
        </div>
      )}

      {/* Speaking glow border */}
      {participant.isSpeaking && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: `inset 0 0 0 2px rgba(59, 130, 246, ${0.4 + participant.audioLevel * 2})`,
          }}
        />
      )}

      {/* Audio level visualizer bar at bottom */}
      {!participant.isMuted && participant.audioLevel > 0.02 && (
        <div className="absolute bottom-12 left-3 right-3 h-1 rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full transition-all duration-75"
            style={{ width: `${Math.min(100, participant.audioLevel * 300)}%` }}
          />
        </div>
      )}

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full shrink-0 transition-colors ${participant.isSpeaking ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
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

      {/* Hover menu */}
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
}

function ScreenShareTile({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-grid-item relative col-span-full row-span-2 ring-2 ring-cyan-500/40">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain bg-black"
      />
      <div className="absolute top-2 left-2 px-3 py-1 rounded-lg bg-cyan-500/20 backdrop-blur-sm text-xs text-cyan-400 font-medium">
        📺 Screen Share
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
      {screenStream && <ScreenShareTile stream={screenStream} />}
      {participants.map(p => (
        <VideoTile key={p.id} participant={p} isSelf={p.id === 'self'} />
      ))}

      {/* Hand raised floating indicator */}
      {handRaised && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 flex items-center gap-2 text-sm text-amber-300 animate-bounce z-10">
          <Hand className="w-4 h-4" />
          You raised your hand
        </div>
      )}
    </div>
  );
}
