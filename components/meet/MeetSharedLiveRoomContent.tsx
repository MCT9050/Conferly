'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Room } from 'livekit-client';
import type { Participant } from '@/types';
import type { RemotePresentation } from '@/types/presentation';
import { SharedLiveRoomActivityProvider, useSharedLiveRoomActivity } from '@/components/live/SharedLiveRoomActivityProvider';
import { LiveStage } from '@/components/live/LiveStage';
import { ResponsiveParticipantGallery } from '@/components/live/ResponsiveParticipantGallery';
import { PresentationFilmstrip } from '@/components/live/PresentationFilmstrip';
import type { SharedLiveRoomActivity, SharedLiveRoomRole } from '@/lib/liveRoomActivitySync';
import {
  classifyViewport,
  partitionStageAndFilmstrip,
  type LiveRoomActivity,
  type LiveRoomParticipant,
  type ParticipantDensity,
  type PersonalLayout,
  type ViewportSize,
} from '@/lib/liveRoomSeating';
import PresentationStage from '@/components/presentation/PresentationStage';

type MeetSharedLiveRoomContentProps = {
  room: Room | null;
  syncRoomId: string;
  accessRole?: string;
  participants: Participant[];
  screenStream: MediaStream | null;
  focusedPresentation: RemotePresentation | null;
  mediaError?: string | null;
  screenShareError?: string | null;
};

function mapAccessRoleToSharedRole(accessRole?: string): SharedLiveRoomRole {
  if (accessRole === 'owner') return 'host';
  if (accessRole === 'presenter') return 'presenter';
  if (accessRole === 'participant') return 'participant';
  return 'viewer';
}

function mapAccessRoleToLiveRole(accessRole?: string): LiveRoomParticipant['role'] {
  if (accessRole === 'owner') return 'owner';
  if (accessRole === 'presenter') return 'presenter';
  if (accessRole === 'participant') return 'participant';
  return 'spectator';
}

function buildLiveParticipant(participant: Participant, localRole: LiveRoomParticipant['role'], screenStream: MediaStream | null): LiveRoomParticipant {
  const isLocal = participant.id === 'self';
  return {
    id: participant.id,
    identity: participant.id,
    name: participant.name,
    avatar: participant.avatar,
    role: isLocal ? localRole : 'participant',
    cameraStream: participant.stream,
    microphonePublication: { isMuted: participant.isMuted, muted: participant.isMuted, isSubscribed: !participant.isMuted },
    screenShareStream: isLocal ? screenStream : participant.screenShareStream ?? null,
    isLocal,
    isSpeaking: participant.isSpeaking,
    connectionQuality: 'unknown',
  };
}

function SharedMeetFoundationContent({ accessRole, participants, screenStream, focusedPresentation, mediaError, screenShareError }: Omit<MeetSharedLiveRoomContentProps, 'room' | 'syncRoomId'>) {
  const { activity, canControl, hydrated, lastRejection, setActivity } = useSharedLiveRoomActivity();
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [layout, setLayout] = useState<PersonalLayout>('standard');
  const [density, setDensity] = useState<ParticipantDensity>('standard');
  const [audioOnly, setAudioOnly] = useState(false);
  const [previousSharedActivity, setPreviousSharedActivity] = useState<SharedLiveRoomActivity>('gallery');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateViewport = () => setViewport(classifyViewport(window.innerWidth));
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const liveParticipants = useMemo(() => {
    const localRole = mapAccessRoleToLiveRole(accessRole);
    return participants.map((participant) => buildLiveParticipant(participant, localRole, screenStream));
  }, [accessRole, participants, screenStream]);

  const liveActivity = activity as LiveRoomActivity;
  const { stage, filmstrip } = useMemo(
    () => partitionStageAndFilmstrip(liveParticipants, liveActivity),
    [liveActivity, liveParticipants]
  );
  const activeScreenShareParticipant = useMemo(
    () => liveParticipants.find((participant) => participant.screenShareStream) ?? null,
    [liveParticipants]
  );

  useEffect(() => {
    if (!canControl) return;
    if (activeScreenShareParticipant?.screenShareStream) {
      if (activity !== 'screen-share') void setActivity('screen-share');
      return;
    }
    if (focusedPresentation) {
      if (activity !== 'presentation') void setActivity('presentation');
      return;
    }
    if (activity === 'screen-share' || activity === 'presentation') {
      const fallback = previousSharedActivity === activity ? 'gallery' : previousSharedActivity;
      if (fallback !== activity) void setActivity(fallback);
    }
  }, [activity, activeScreenShareParticipant, canControl, focusedPresentation, previousSharedActivity, setActivity]);

  const handleSharedActivity = useCallback(
    (next: SharedLiveRoomActivity) => {
      if (!canControl) return;
      if (next !== 'screen-share' && next !== 'presentation') {
        setPreviousSharedActivity(next);
      }
      void setActivity(next);
    },
    [canControl, setActivity]
  );

  const showFilmstrip = layout === 'filmstrip' || activity === 'screen-share' || activity === 'presentation';
  const permissionMessage = canControl
    ? 'You can control the shared Meet stage.'
    : 'Only the meeting host or presenter can control the shared Meet stage.';

  return (
    <section className="space-y-4" aria-label="Shared Meet live-room foundation">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Shared Meet foundation</h2>
            <p className="text-sm text-slate-400">Shared activity: <span className="font-medium text-cyan-300">{activity}</span></p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {(['gallery', 'focus', 'discussion'] as SharedLiveRoomActivity[]).map((next) => (
                <button
                  key={next}
                  type="button"
                  onClick={() => handleSharedActivity(next)}
                  disabled={!canControl}
                  className={`rounded-xl border px-3 py-2 text-xs transition-all ${activity === next ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-slate-800/60 text-slate-300 disabled:opacity-40'}`}
                >
                  {next}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['standard', 'filmstrip', 'paginated'] as PersonalLayout[]).map((next) => (
                <button
                  key={next}
                  type="button"
                  onClick={() => setLayout(next)}
                  className={`rounded-xl border px-3 py-2 text-xs transition-all ${layout === next ? 'border-blue-400/40 bg-blue-500/10 text-blue-300' : 'border-white/10 bg-slate-800/60 text-slate-300'}`}
                >
                  {next}
                </button>
              ))}
              {(['comfortable', 'standard', 'compact'] as ParticipantDensity[]).map((next) => (
                <button
                  key={next}
                  type="button"
                  onClick={() => setDensity(next)}
                  className={`rounded-xl border px-3 py-2 text-xs transition-all ${density === next ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-slate-800/60 text-slate-300'}`}
                >
                  {next}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAudioOnly((current) => !current)}
                className={`rounded-xl border px-3 py-2 text-xs transition-all ${audioOnly ? 'border-amber-400/40 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-slate-800/60 text-slate-300'}`}
              >
                {audioOnly ? 'Audio-only local view' : 'Audio + video view'}
              </button>
            </div>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">
          Meet shared activity synchronized as {activity}. {permissionMessage}
          {!hydrated ? ' Shared activity is hydrating.' : ' Shared activity is ready.'}
          {lastRejection ? ` Last rejected update: ${lastRejection.reason}.` : ''}
        </div>
        {!hydrated && (
          <p className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100" role="status" aria-live="polite">
            Restoring the shared Meet activity state. Audio and video remain available while synchronization hydrates.
          </p>
        )}
        {!canControl && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {permissionMessage}
          </p>
        )}
        {lastRejection && (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Ignored an invalid shared activity update: {lastRejection.reason}.
          </p>
        )}
        {mediaError && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
            Media issue: {mediaError}
          </p>
        )}
        {screenShareError && (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
            Screen sharing issue: {screenShareError}
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr,0.95fr]">
        <LiveStage
          activity={liveActivity}
          stageParticipant={stage}
          screenShareParticipant={activeScreenShareParticipant}
          presentationContent={focusedPresentation ? <PresentationStage presentation={focusedPresentation} className="min-h-[20rem]" /> : undefined}
        />
        <ResponsiveParticipantGallery
          participants={liveParticipants}
          density={density}
          viewport={viewport}
          layout={audioOnly ? 'audio-only' : layout}
        />
      </div>

      {participants.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300" role="status">
          No participants are visible in the shared Meet gallery yet.
        </p>
      )}

      {activity === 'screen-share' && !activeScreenShareParticipant && (
        <p className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300" role="status">
          No active screen share is currently available for the shared Meet stage.
        </p>
      )}

      {activity === 'presentation' && !focusedPresentation && (
        <p className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300" role="status">
          No shared presentation is currently available for the Meet stage.
        </p>
      )}

      <PresentationFilmstrip participants={filmstrip} visible={showFilmstrip} />
    </section>
  );
}

export default function MeetSharedLiveRoomContent({ room, syncRoomId, accessRole, participants, screenStream, focusedPresentation, mediaError, screenShareError }: MeetSharedLiveRoomContentProps) {
  return (
    <SharedLiveRoomActivityProvider
      room={room}
      roomId={syncRoomId}
      domain="meet"
      localRole={mapAccessRoleToSharedRole(accessRole)}
      initialActivity="gallery"
    >
      <SharedMeetFoundationContent
        accessRole={accessRole}
        participants={participants}
          screenStream={screenStream}
        focusedPresentation={focusedPresentation}
        mediaError={mediaError}
        screenShareError={screenShareError}
      />
    </SharedLiveRoomActivityProvider>
  );
}