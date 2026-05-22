"use client";

import VideoGrid from '../VideoGrid';
import MediaDevicesClient from './MediaDevicesClient';
import { useMeetingMedia } from './state/mediaStore';
import { useMeetingParticipants } from './state/participantStore';
import { useMeetingUi } from './state/uiStore';

export default function MeetingMediaStage() {
  const media = useMeetingMedia();
  const { participants } = useMeetingParticipants();
  const { handRaised } = useMeetingUi();

  return (
    <>
      <MediaDevicesClient />
      <div className="rounded-3xl border border-white/10 bg-slate-900/85 shadow-xl shadow-black/20 overflow-hidden min-h-[30rem]">
        <div className="border-b border-white/10 bg-slate-950/90 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Live meeting view</p>
              <p className="text-sm text-slate-500">Media state, video streams, and screen sharing are isolated inside this client island.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{participants.length} participants</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Video {media.isVideoOn ? 'on' : 'off'}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Mic {media.isMuted ? 'muted' : 'live'}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Screen {media.isScreenSharing ? 'sharing' : 'off'}</span>
            </div>
          </div>
        </div>
        <div className="h-full min-h-[28rem] bg-slate-950/90">
          <VideoGrid participants={participants} screenStream={media.screenStream} handRaised={handRaised} />
        </div>
      </div>
    </>
  );
}
