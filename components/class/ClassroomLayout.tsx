'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  ClassroomMode,
  PersonalLayout,
  ParticipantDensity,
  ViewportSize,
  ClassroomParticipant,
} from '@/types';
import type { LiveRoomActivity } from '@/lib/liveRoomSeating';
import { canPublishClassroomMedia, canUseClassroomTeacherControls, classifyViewport, selectActivityForMedia, selectDefaultDensity, toLiveRoomParticipant } from '@/lib/classroomSeating';
import { LiveStage } from '@/components/live/LiveStage';
import { ResponsiveParticipantGallery } from '@/components/live/ResponsiveParticipantGallery';
import { PresentationFilmstrip as LivePresentationFilmstrip } from '@/components/live/PresentationFilmstrip';
import { TeacherDock } from './TeacherDock';
import { ClassroomControls } from './ClassroomControls';

type ClassroomLayoutProps = {
  participants: ClassroomParticipant[];
  teachers: ClassroomParticipant[];
  localUser: ClassroomParticipant | null;
  activeScreenShare: ClassroomParticipant | null;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
};

export function ClassroomLayout({
  participants,
  teachers,
  localUser,
  activeScreenShare,
  onLeave,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  isMuted,
  isVideoOn,
  isScreenSharing,
  isRecording,
}: ClassroomLayoutProps) {
  // TODO Slice B: ClassroomMode is currently local-only. Shared classroom mode
  // requires transport protocol and late-join synchronization to be implemented.
  const [mode, setMode] = useState<ClassroomMode>('welcome');
  const [previousMode, setPreviousMode] = useState<ClassroomMode>('gallery');
  const [personalLayout, setPersonalLayout] = useState<PersonalLayout>('standard');
  const [density, setDensity] = useState<ParticipantDensity>('standard');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  // Detect viewport size
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      setViewport(classifyViewport(window.innerWidth));
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Auto-select sensible defaults based on participant count and viewport
  useEffect(() => {
    const nextDensity = selectDefaultDensity(participants.length, teachers.length, viewport);
    setDensity(nextDensity);
    setPersonalLayout(viewport === 'mobile' ? 'paginated' : nextDensity);
  }, [participants.length, teachers.length, viewport]);

  useEffect(() => {
    setMode((current) => selectActivityForMedia(current as LiveRoomActivity, Boolean(activeScreenShare), previousMode as LiveRoomActivity) as ClassroomMode);
  }, [activeScreenShare, previousMode]);

  const handleModeChange = useCallback((newMode: ClassroomMode) => {
    if (newMode !== 'screen-share') setPreviousMode(newMode);
    setMode(newMode);
  }, []);

  const handleLayoutChange = useCallback((newLayout: PersonalLayout) => {
    setPersonalLayout(newLayout);
    if (newLayout === 'filmstrip') {
      setDensity('standard');
    }
  }, []);

  const handleDensityChange = useCallback((newDensity: ParticipantDensity) => {
    setDensity(newDensity);
  }, []);

  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';

  // Determine if filmstrip should be visible
  const showFilmstrip = useMemo(() => {
    return personalLayout === 'filmstrip' || mode === 'screen-share' || (isMobile && mode === 'gallery');
  }, [personalLayout, isMobile, mode]);

  const liveParticipants = useMemo(() => participants.map((p) => toLiveRoomParticipant(p, localUser?.id)), [participants, localUser?.id]);
  const liveStageParticipant = useMemo(() => liveParticipants.find((p) => p.isSpeaking) ?? liveParticipants[0] ?? null, [liveParticipants]);
  const liveScreenShareParticipant = useMemo(() => activeScreenShare ? toLiveRoomParticipant(activeScreenShare, localUser?.id) : null, [activeScreenShare, localUser?.id]);
  const liveFilmstripParticipants = useMemo(() => liveScreenShareParticipant ? liveParticipants.filter((p) => p.id !== liveScreenShareParticipant.id) : liveParticipants, [liveParticipants, liveScreenShareParticipant]);
  const liveActivity = mode === 'teacher-focus' ? 'focus' : mode as LiveRoomActivity;
  const canPublish = canPublishClassroomMedia(localUser?.role);
  const canUseTeacherControls = canUseClassroomTeacherControls(localUser?.role);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Teacher dock - always visible for teachers during gallery, screen-share, whiteboard */}
      {(mode === 'gallery' || mode === 'screen-share' || mode === 'whiteboard') && (
        <TeacherDock teachers={teachers} localUser={localUser} />
      )}

      {/* Main content area */}
      <div className="flex-1 grid gap-4 min-h-0">
        {isMobile ? (
          /* Mobile: stacked layout */
          <div className="flex flex-col gap-3">
            <div className="h-[40vh] min-h-[300px]">
              <LiveStage activity={liveActivity} stageParticipant={liveStageParticipant} screenShareParticipant={liveScreenShareParticipant} />
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveParticipantGallery participants={liveParticipants} layout={personalLayout} density={density} viewport={viewport} />
            </div>
          </div>
        ) : isTablet ? (
          /* Tablet: side-by-side with reduced stage */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4">
            <div className="min-h-[400px]">
              <LiveStage activity={liveActivity} stageParticipant={liveStageParticipant} screenShareParticipant={liveScreenShareParticipant} />
            </div>
            <div className="min-h-[400px]">
              <ResponsiveParticipantGallery participants={liveParticipants} layout={personalLayout} density={density} viewport={viewport} />
            </div>
          </div>
        ) : (
          /* Desktop: stage + flexible participant area */
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,auto] gap-4">
            <div className="min-h-[500px]">
              <LiveStage activity={liveActivity} stageParticipant={liveStageParticipant} screenShareParticipant={liveScreenShareParticipant} />
            </div>
            <div className="w-80 xl:w-96">
              <ResponsiveParticipantGallery participants={liveParticipants} layout={personalLayout} density={density} viewport={viewport} />
            </div>
          </div>
        )}
      </div>

      {/* Presentation filmstrip (optional) */}
      <LivePresentationFilmstrip participants={liveFilmstripParticipants} visible={showFilmstrip} />

      {/* Classroom controls */}
      <ClassroomControls
        mode={mode}
        personalLayout={personalLayout}
        density={density}
        viewport={viewport}
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
        canPublish={canPublish}
        canUseTeacherControls={canUseTeacherControls}
        onToggleMute={onToggleMute}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
        onToggleRecording={onToggleRecording}
        onModeChange={handleModeChange}
        onLayoutChange={handleLayoutChange}
        onDensityChange={handleDensityChange}
        onLeave={onLeave}
      />
    </div>
  );
}