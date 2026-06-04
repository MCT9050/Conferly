"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Room, Track as TrackType } from 'livekit-client';
import type { Participant } from '../../../types';
import { getLiveKitModule } from '../../../lib/livekit-client';
import { useMeetingMedia } from './mediaStore';
import { trackEvent } from '../../../lib/monitoring';

type MeetingParticipantContextValue = {
  participants: Participant[];
  participantCount: number;
};

const MeetingParticipantContext = createContext<MeetingParticipantContextValue | null>(null);

const ROOM_ID = 'CONFER123';

function getParticipantAvatar(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Helper: Extract media stream from a remote participant.
 * Track type is passed in to avoid static import.
 */
async function getRemoteParticipantStream(
  participant: any,
  Track: typeof TrackType
): Promise<MediaStream | null> {
  const publications = [
    participant.getTrackPublication(Track.Source.Camera),
    participant.getTrackPublication(Track.Source.Microphone),
    participant.getTrackPublication(Track.Source.ScreenShare),
  ];

  const streamTracks: MediaStreamTrack[] = publications.flatMap((publication) => {
    if (!publication?.isSubscribed) {
      return [];
    }

    const videoTrack = publication.videoTrack?.mediaStreamTrack;
    const audioTrack = publication.audioTrack?.mediaStreamTrack;
    return [videoTrack, audioTrack].filter(Boolean) as MediaStreamTrack[];
  });

  if (!streamTracks.length) {
    return null;
  }

  return new MediaStream(streamTracks);
}

/**
 * Helper: Map a remote participant to our Participant type.
 * Track type is passed in to avoid static import.
 */
async function mapRemoteParticipant(
  remoteParticipant: any,
  Track: typeof TrackType
): Promise<Participant> {
  const cameraPublication = remoteParticipant.getTrackPublication(Track.Source.Camera);
  const microphonePublication = remoteParticipant.getTrackPublication(Track.Source.Microphone);

  return {
    id: remoteParticipant.identity ?? remoteParticipant.sid,
    name: remoteParticipant.name ?? remoteParticipant.identity ?? 'Guest',
    avatar: getParticipantAvatar(remoteParticipant.name ?? remoteParticipant.identity ?? 'Guest'),
    stream: await getRemoteParticipantStream(remoteParticipant, Track),
    isSpeaking: Boolean(remoteParticipant.isSpeaking),
    isVideoOn: Boolean(cameraPublication?.isSubscribed),
    isMuted: microphonePublication?.muted ?? false,
    audioLevel: 0.02,
  };
}

export function MeetingParticipantProvider({ children }: { children: ReactNode }) {
  const media = useMeetingMedia();
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const roomRef = useRef<Room | null>(null);
  const trackRef = useRef<typeof TrackType | null>(null);
  const mountedRef = useRef(true);

  /**
   * Update the list of remote participants.
   * Async because mapRemoteParticipant is now async.
   */
  const updateRemoteParticipantList = async () => {
    const room = roomRef.current;
    const Track = trackRef.current;
    
    if (!room || !Track || !mountedRef.current) {
      return;
    }

    const participants = await Promise.all(
      Array.from(room.remoteParticipants.values()).map((p) => mapRemoteParticipant(p, Track))
    );
    
    if (mountedRef.current) {
      setRemoteParticipants(participants);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      roomRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  /**
   * Main effect: Initialize LiveKit room and publish local tracks.
   * This is where we lazy-load the LiveKit module on demand.
   */
  useEffect(() => {

    let mounted = true;

    (async () => {
      try {
        // Lazy-load LiveKit module here - deferred until room is needed
        const { Room, Track } = await getLiveKitModule();
        
        if (!mounted) return;

        if (!media.stream) {
          // Only proceed with LiveKit initialization if media stream is available
          return;
        }

        trackRef.current = Track;
        const room = new Room();
        roomRef.current = room;

        const handleParticipantUpdate = () => updateRemoteParticipantList();
        const handleTrackUpdate = () => updateRemoteParticipantList();

        room.on("participantConnected", handleParticipantUpdate);
        room.on("participantDisconnected", handleParticipantUpdate);
        room.on("trackSubscribed", handleTrackUpdate);
        room.on("trackUnsubscribed", handleTrackUpdate);
        room.on("activeSpeakersChanged", handleParticipantUpdate);

        const publishTracks = async () => {
          try {
            const response = await fetch("/api/lk-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ roomId: ROOM_ID, role: "participant" }),
            });

            if (!response.ok) {
              throw new Error(`Unable to mint LiveKit token (${response.status})`);
            }

            const { token, url } = await response.json();
            await room.connect(url, token, { autoSubscribe: true });
            await updateRemoteParticipantList();

            const audioTrack = media.stream.getAudioTracks()[0];
            const videoTrack = media.stream.getVideoTracks()[0];

            if (audioTrack) {
              await room.localParticipant.publishTrack(audioTrack, {
                source: Track.Source.Microphone,
                name: "microphone",
              });
            }

            if (videoTrack) {
              await room.localParticipant.publishTrack(videoTrack, {
                source: Track.Source.Camera,
                name: "camera",
              });
            }
          } catch (error) {
            console.error("LiveKit connection failed", error);
          }
        };

        await publishTracks();
      } catch (error) {
        console.error('Failed to initialize LiveKit', error);
      }
    })();

    return () => {
      mounted = false;
      roomRef.current?.disconnect().catch(() => undefined);
      roomRef.current = null;
    };
  }, [media.stream]);

  /**
   * Effect: Publish screen share when available.
   */
  useEffect(() => {
    const room = roomRef.current;
    const Track = trackRef.current;
    
    if (!room || !Track || !media.screenStream) {
      return;
    }

    const publishScreenShare = async () => {
      if (!media.screenStream) {
        return;
      }
      const screenTrack = media.screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        return;
      }

      try {
        await room.localParticipant.publishTrack(screenTrack, {
          source: Track.Source.ScreenShare,
          name: 'screen-share',
        });
      } catch (error) {
        console.error('LiveKit screen share publish failed', error);
      }
    };

    publishScreenShare();
  }, [media.screenStream]);

  const participants = useMemo(() => {
    const selfParticipant: Participant = {
      id: 'self',
      name: 'You',
      avatar: 'YO',
      stream: media.stream,
      isSpeaking: false,
      isVideoOn: media.isVideoOn,
      isMuted: media.isMuted,
      audioLevel: media.isMuted ? 0 : 0.04,
    };

    return [selfParticipant, ...remoteParticipants];
  }, [media.stream, media.isMuted, media.isVideoOn, remoteParticipants]);

  // Monitoring: track participant count changes
  useEffect(() => {
    trackEvent({
      type: 'custom',
      name: 'participant_count',
      data: { count: participants.length },
      timestamp: Date.now(),
    });
  }, [participants.length]);

  const value = useMemo(
    () => ({ participants, participantCount: participants.length }),
    [participants]
  );

  return <MeetingParticipantContext.Provider value={value}>{children}</MeetingParticipantContext.Provider>;
}

export function useMeetingParticipants() {
  const context = useContext(MeetingParticipantContext);
  if (!context) {
    throw new Error('useMeetingParticipants must be used within MeetingParticipantProvider');
  }
  return context;
}
