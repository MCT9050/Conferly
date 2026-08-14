'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { LiveRoomActivity, LiveRoomParticipant } from '@/lib/liveRoomSeating';
import { LiveVideoTile } from './LiveVideoTile';

function StageVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="h-full w-full object-contain" aria-label={label} />;
}

export function LiveStage({ activity, stageParticipant, screenShareParticipant, whiteboardContent, presentationContent }: { activity: LiveRoomActivity; stageParticipant: LiveRoomParticipant | null; screenShareParticipant?: LiveRoomParticipant | null; whiteboardContent?: ReactNode; presentationContent?: ReactNode }) {
  if (activity === 'screen-share' && screenShareParticipant?.screenShareStream) {
    return <section aria-label="Screen share stage" className="relative flex min-h-80 items-center justify-center rounded-2xl border border-white/10 bg-black" data-live-room-stage="screen-share"><StageVideo stream={screenShareParticipant.screenShareStream} label={`${screenShareParticipant.name} screen share`} /><div className="absolute left-4 top-4 rounded-lg bg-black/70 px-3 py-1 text-sm text-white">Presenting: {screenShareParticipant.name}</div></section>;
  }
  if (activity === 'presentation') return <section aria-label="Presentation stage" className="flex min-h-80 items-center justify-center rounded-2xl border border-white/10 bg-slate-900" data-live-room-stage="presentation">{presentationContent ?? <p className="text-sm text-slate-400">Presentation ready.</p>}</section>;
  if (activity === 'whiteboard') return <section aria-label="Whiteboard stage" className="flex min-h-80 items-center justify-center rounded-2xl border border-white/10 bg-slate-900" data-live-room-stage="whiteboard">{whiteboardContent ?? <p className="text-sm text-slate-400">Whiteboard is optional and not currently open.</p>}</section>;
  if (activity === 'focus' && stageParticipant) return <section aria-label="Focus stage" className="rounded-2xl border border-white/10 bg-slate-900 p-3" data-live-room-stage="focus"><LiveVideoTile participant={stageParticipant} layout="standard" /></section>;
  return <section aria-label="Live room stage" className="flex min-h-48 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 p-6 text-center" data-live-room-stage={activity}><div><h2 className="text-xl font-semibold text-white">Live room ready</h2><p className="mt-2 text-sm text-slate-400">Gallery is the default shared foundation experience.</p></div></section>;
}