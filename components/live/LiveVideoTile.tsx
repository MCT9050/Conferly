'use client';

import { useEffect, useRef } from 'react';
import type { LiveRoomParticipant, PersonalLayout } from '@/lib/liveRoomSeating';
import { shouldShowTileVideo } from '@/lib/liveRoomSeating';

type LiveVideoTileProps = {
  participant: LiveRoomParticipant;
  layout?: PersonalLayout;
  compact?: boolean;
};

export function LiveVideoTile({ participant, layout = 'standard', compact = false }: LiveVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = shouldShowTileVideo(participant.cameraStream, Boolean(participant.cameraStream), layout);
  const muted = participant.microphonePublication?.isMuted ?? participant.microphonePublication?.muted ?? true;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !participant.cameraStream || !showVideo) return;
    video.srcObject = participant.cameraStream;
    return () => {
      video.srcObject = null;
    };
  }, [participant.cameraStream, showVideo]);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 ${compact ? 'h-28' : 'min-h-40'}`}
      aria-label={`${participant.name}${participant.isLocal ? ' (you)' : ''}`}
    >
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={participant.isLocal} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-32 items-center justify-center bg-slate-800">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
            {participant.avatar ?? participant.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-xs text-white">
        <span className="truncate">{participant.name}{participant.isLocal ? ' (You)' : ''}</span>
        <span className={muted ? 'text-red-300' : 'text-emerald-300'}>{muted ? 'Muted' : 'Mic on'}</span>
      </div>
    </article>
  );
}