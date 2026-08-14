'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ClassroomParticipant } from '@/types';
import { ClassroomPreJoin } from './ClassroomPreJoin';
import { ClassroomLayout } from './ClassroomLayout';
import { canPublishClassroomMedia, findActiveScreenShare, partitionParticipants, parseClassroomRoleFromMetadata } from '@/lib/classroomSeating';
import RemoteAudioRenderer, { collectRemoteMicrophonePublications, type RemoteAudioTrackReference } from '@/components/live/RemoteAudioRenderer';
import type { Room } from 'livekit-client';

type ClassroomSessionProps = {
  classroomId: string;
  lessonId: string;
  userId: string;
  userName: string;
  userRole: 'owner' | 'instructor' | 'ta' | 'student' | 'auditor';
};

export function ClassroomSession({
  classroomId,
  lessonId,
  userId,
  userName,
  userRole,
}: ClassroomSessionProps) {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<ClassroomParticipant[]>([]);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState<RemoteAudioTrackReference[]>([]);
  const [activeScreenShare, setActiveScreenShare] = useState<ClassroomParticipant | null>(null);
  const [localScreenShareStream, setLocalScreenShareStream] = useState<MediaStream | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  // Build local user participant
  const localUser = useMemo<ClassroomParticipant | null>(() => {
    if (!isJoined) return null;
    return {
      id: userId,
      name: userName,
      avatar: userName
        .split(' ')
        .map((p) => p[0] ?? '')
        .slice(0, 2)
        .join('')
        .toUpperCase() || '??',
      role: userRole,
      isSpeaking: false,
      isVideoOn: isVideoOn,
      isMuted: isMuted,
      audioLevel: 0,
      stream: localStream,
      screenShareStream: localScreenShareStream,
      isScreenSharing: Boolean(localScreenShareStream),
    };
  }, [isJoined, userId, userName, userRole, isVideoOn, isMuted, localStream, localScreenShareStream]);

  // Partition participants
  const { teachers, students, auditors } = useMemo(() => {
    const allParticipants = localUser ? [localUser, ...remoteParticipants] : remoteParticipants;
    return partitionParticipants(allParticipants);
  }, [localUser, remoteParticipants]);

  // Handle join
  const handleJoin = useCallback(async (prefs: { micEnabled: boolean; cameraEnabled: boolean; audioOnly: boolean }) => {
    setConnectionError(null);
    let acquiredStream: MediaStream | null = null;

    try {
      // Request media if not audio-only
      if (!prefs.audioOnly) {
        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: prefs.micEnabled,
          video: prefs.cameraEnabled,
        });
        setLocalStream(acquiredStream);
        setIsMuted(!prefs.micEnabled);
        setIsVideoOn(prefs.cameraEnabled);
      } else {
        setLocalStream(null);
        setIsMuted(true);
        setIsVideoOn(false);
      }

      // Connect to LiveKit
      const response = await fetch('/api/lk-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          domain: 'class',
          classroomId,
          lessonId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.status}`);
      }

      const { token, url } = await response.json();

      // Import LiveKit and connect
      const { Room, RoomEvent, Track } = await import('livekit-client');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      await room.connect(url, token, { autoSubscribe: true });

      // Publish local tracks
      if (acquiredStream) {
        const audioTrack = acquiredStream.getAudioTracks()[0];
        const videoTrack = acquiredStream.getVideoTracks()[0];
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
            name: 'microphone',
          });
        }
        if (videoTrack) {
          await room.localParticipant.publishTrack(videoTrack, {
            source: Track.Source.Camera,
            name: 'camera',
          });
        }
      }

      // Listen for remote participants
      const updateRemoteParticipants = () => {
        const participants: ClassroomParticipant[] = Array.from(room.remoteParticipants.values()).map((p: any) => {
          const metadata = parseClassroomRoleFromMetadata(p.metadata);
          const cameraPub = p.getTrackPublication(Track.Source.Camera);
          const micPub = p.getTrackPublication(Track.Source.Microphone);
          const screenPub = p.getTrackPublication(Track.Source.ScreenShare);

          const tracks: MediaStreamTrack[] = [];
          if (cameraPub?.isSubscribed && cameraPub.videoTrack?.mediaStreamTrack) {
            tracks.push(cameraPub.videoTrack.mediaStreamTrack);
          }
          const stream = tracks.length > 0 ? new MediaStream(tracks) : null;

          return {
            id: p.identity || p.sid,
            name: p.name || 'Guest',
            avatar: (p.name || 'G').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            role: metadata || 'student',
            isSpeaking: Boolean(p.isSpeaking),
            isVideoOn: Boolean(cameraPub?.isSubscribed),
            isMuted: micPub?.isMuted ?? micPub?.muted ?? true,
            audioLevel: 0,
            stream,
            screenShareStream: screenPub?.isSubscribed && screenPub.videoTrack?.mediaStreamTrack
              ? new MediaStream([screenPub.videoTrack.mediaStreamTrack])
              : null,
            isScreenSharing: Boolean(screenPub?.isSubscribed),
          };
        });
        setRemoteParticipants(participants);
        setActiveScreenShare(findActiveScreenShare(participants));
        setRemoteAudioTracks(collectRemoteMicrophonePublications(room));
        setPlaybackBlocked(room.canPlaybackAudio === false);
      };

      room.on(RoomEvent.ParticipantConnected, updateRemoteParticipants);
      room.on(RoomEvent.ParticipantDisconnected, updateRemoteParticipants);
      room.on(RoomEvent.TrackSubscribed, updateRemoteParticipants);
      room.on(RoomEvent.TrackUnsubscribed, updateRemoteParticipants);
      room.on(RoomEvent.TrackMuted, updateRemoteParticipants);
      room.on(RoomEvent.TrackUnmuted, updateRemoteParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, updateRemoteParticipants);
      room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => setPlaybackBlocked(!playing));

      updateRemoteParticipants();
      setIsJoined(true);
    } catch (err) {
      console.error('Failed to join classroom:', err);
      acquiredStream?.getTracks().forEach((track) => track.stop());
      setConnectionError(err instanceof Error ? err.message : 'Failed to join classroom');
    }
  }, [classroomId, lessonId]);

  // Handle leave - clean up room and tracks
  const handleLeave = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      try {
        room.disconnect();
      } catch (err) {
        console.error('Error disconnecting room:', err);
      }
      roomRef.current = null;
    }

    // Stop local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Reset state
    setIsJoined(false);
    setIsMuted(false);
    setIsVideoOn(false);
    setIsScreenSharing(false);
    setLocalScreenShareStream(null);
    setRemoteParticipants([]);
    setRemoteAudioTracks([]);
    setActiveScreenShare(null);

    router.push('/class/dashboard');
  }, [router, localStream]);

  // Media controls using LiveKit's supported APIs
  const toggleMute = useCallback(() => {
    if (!roomRef.current || !canPublishClassroomMedia(userRole)) return;
    const newMutedState = !isMuted;
    roomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState);
    setIsMuted(newMutedState);
  }, [isMuted, userRole]);

  const toggleVideo = useCallback(() => {
    if (!roomRef.current || !canPublishClassroomMedia(userRole)) return;
    const newVideoState = !isVideoOn;
    roomRef.current.localParticipant.setCameraEnabled(!newVideoState);
    setIsVideoOn(newVideoState);
  }, [isVideoOn, userRole]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !canPublishClassroomMedia(userRole)) return;
    try {
      const next = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(next);
      setIsScreenSharing(next);
      if (next) {
        const { Track } = await import('livekit-client');
        const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        const mediaStreamTrack = publication?.videoTrack?.mediaStreamTrack;
        setLocalScreenShareStream(mediaStreamTrack ? new MediaStream([mediaStreamTrack]) : null);
      } else {
        setLocalScreenShareStream(null);
      }
    } catch (error) {
      console.error('Unable to toggle classroom screen share', error);
    }
  }, [isScreenSharing, userRole]);

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  // Show connection error
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md rounded-3xl border border-red-500/30 bg-slate-900/95 p-8 text-center">
          <p className="text-lg font-semibold text-red-400 mb-2">Connection Failed</p>
          <p className="text-sm text-slate-400 mb-6">{connectionError}</p>
          <button
            type="button"
            onClick={() => router.push('/class/dashboard')}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show pre-join screen
  if (!isJoined) {
    return (
      <ClassroomPreJoin
        userName={userName}
        userRole={userRole}
        onJoin={handleJoin}
        onCancel={() => router.push('/class/dashboard')}
      />
    );
  }

  // Show classroom layout
  return (
    <div className="h-screen flex flex-col bg-slate-950 p-4 gap-4">
      <RemoteAudioRenderer
        room={roomRef.current}
        tracks={remoteAudioTracks}
        playbackBlocked={playbackBlocked}
        onPlaybackBlocked={() => setPlaybackBlocked(true)}
        onPlaybackRecovered={() => setPlaybackBlocked(false)}
      />
      <ClassroomLayout
        participants={localUser ? [localUser, ...remoteParticipants] : remoteParticipants}
        teachers={teachers}
        localUser={localUser}
        activeScreenShare={activeScreenShare}
        onLeave={handleLeave}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleRecording={toggleRecording}
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        isScreenSharing={isScreenSharing}
        isRecording={isRecording}
      />
    </div>
  );
}
