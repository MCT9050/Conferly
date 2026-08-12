'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  ClassroomMode,
  PersonalLayout,
  ParticipantDensity,
  ViewportSize,
  ClassroomParticipant,
} from '@/types';
import { ClassroomStage } from './ClassroomStage';
import { TeacherDock } from './TeacherDock';
import { ParticipantGallery } from './ParticipantGallery';
import { PresentationFilmstrip } from './PresentationFilmstrip';
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
  const [personalLayout, setPersonalLayout] = useState<PersonalLayout>('standard');
  const [density, setDensity] = useState<ParticipantDensity>('standard');
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  // Detect viewport size
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setViewport('mobile');
      } else if (width < 1024) {
        setViewport('tablet');
      } else {
        setViewport('desktop');
      }
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // Auto-select sensible defaults based on participant count and viewport
  useEffect(() => {
    const studentCount = participants.length - teachers.length;
    if (viewport === 'mobile') {
      setPersonalLayout('paginated');
      setDensity('paginated');
    } else if (studentCount <= 10) {
      setPersonalLayout('comfortable');
      setDensity('comfortable');
    } else if (studentCount <= 20) {
      setPersonalLayout('standard');
      setDensity('standard');
    } else {
      setPersonalLayout('compact');
      setDensity('compact');
    }
  }, [participants.length, teachers.length, viewport]);

  const handleModeChange = useCallback((newMode: ClassroomMode) => {
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
    return personalLayout === 'filmstrip' || (isMobile && mode === 'gallery');
  }, [personalLayout, isMobile, mode]);

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
              <ClassroomStage
                mode={mode}
                activeScreenShare={activeScreenShare}
                teachers={teachers}
                localUser={localUser}
                onModeChange={handleModeChange}
              />
            </div>
            <div className="flex-1 min-h-[300px]">
              <ParticipantGallery
                participants={participants}
                teachers={teachers}
                layout={personalLayout}
                density={density}
                viewport={viewport}
                onDensityChange={handleDensityChange}
              />
            </div>
          </div>
        ) : isTablet ? (
          /* Tablet: side-by-side with reduced stage */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-4">
            <div className="min-h-[400px]">
              <ClassroomStage
                mode={mode}
                activeScreenShare={activeScreenShare}
                teachers={teachers}
                localUser={localUser}
                onModeChange={handleModeChange}
              />
            </div>
            <div className="min-h-[400px]">
              <ParticipantGallery
                participants={participants}
                teachers={teachers}
                layout={personalLayout}
                density={density}
                viewport={viewport}
                onDensityChange={handleDensityChange}
              />
            </div>
          </div>
        ) : (
          /* Desktop: stage + flexible participant area */
          <div className="grid grid-cols-1 xl:grid-cols-[1fr,auto] gap-4">
            <div className="min-h-[500px]">
              <ClassroomStage
                mode={mode}
                activeScreenShare={activeScreenShare}
                teachers={teachers}
                localUser={localUser}
                onModeChange={handleModeChange}
              />
            </div>
            <div className="w-80 xl:w-96">
              <ParticipantGallery
                participants={participants}
                teachers={teachers}
                layout={personalLayout}
                density={density}
                viewport={viewport}
                onDensityChange={handleDensityChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Presentation filmstrip (optional) */}
      <PresentationFilmstrip
        participants={participants}
        teachers={teachers}
        visible={showFilmstrip}
      />

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