import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Room, Track as TrackType, RemoteParticipant } from 'livekit-client';
import { UNLIMITED_PARTICIPANT_CAP, type Participant } from '../../../types';
import { getLiveKitModule } from '../../../lib/livekit-client';
import { useMeetingMedia } from './mediaStore';
import { trackEvent } from '../../../lib/monitoring';

type MeetingParticipantContextValue = {
  participants: Participant[];
  participantCount: number;
  roomType: 'meeting' | 'classroom';
  isLocalParticipantHost: boolean;
  participantCap: number;
};

const MeetingParticipantContext = createContext<MeetingParticipantContextValue | null>(null);

const DEFAULT_ROOM_ID = '—';

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

// Helper to check if a remote participant is a host (assuming role in metadata)
function isHost(participant: RemoteParticipant): boolean {
  if (participant.metadata) {
    try {
      const metadata = JSON.parse(participant.metadata);
      return metadata.role === 'host';
    } catch (e) {
      console.error("Failed to parse participant metadata for host check", e);
    }
  }
  return false;
}


export function MeetingParticipantProvider({ children }: { children: ReactNode }) {
  const media = useMeetingMedia();
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const roomRef = useRef<Room | null>(null);
  const trackRef = useRef<typeof TrackType | null>(null);
  const mountedRef = useRef(true);
  const [currentRoomType, setCurrentRoomType] = useState<'meeting' | 'classroom'>('meeting');
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [participantCap, setParticipantCap] = useState(5); // Default to 5 (Pro); fetched from subscription

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
        const { Room, Track, RoomEvent } = await getLiveKitModule();
        
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

        // Add DataReceived listener for global mute
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          const message = new TextDecoder().decode(payload);
          if (message === 'MUTE_ALL' && participant && isHost(participant) && !media.isMuted) {
            media.toggleMute(); // Mute local participant if received MUTE_ALL from a host
            console.log("Received MUTE_ALL from host. Muting local participant.");
          }
        });


        const publishTracks = async () => {
          try {
            const response = await fetch("/api/lk-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              // The `role` should ideally come from user authentication,
              // for now, we'll assume the server assigns it via metadata.
              body: JSON.stringify({ roomId: DEFAULT_ROOM_ID, /* role can be inferred server-side */ }),
            });

            if (!response.ok) {
              throw new Error(`Unable to mint LiveKit token (${response.status})`);
            }

            const { token, url } = await response.json();
            await room.connect(url, token, { autoSubscribe: true });

            let roomType: 'meeting' | 'classroom' = 'meeting';
            let localIsHost = false;

            if (room.metadata) {
              try {
                const metadata = JSON.parse(room.metadata);
                if (metadata.roomType) {
                  roomType = metadata.roomType;
                }
                // Check if local participant's metadata (or token payload) indicates 'host' role
                if (room.localParticipant.metadata) {
                  const localMetadata = JSON.parse(room.localParticipant.metadata);
                  if (localMetadata.role === 'host') {
                    localIsHost = true;
                  }
                }
              } catch (e) {
                console.error("Failed to parse room metadata", e);
              }
            }
            setCurrentRoomType(roomType);
            setIsLocalHost(localIsHost); // Set local host status

            // Enforce participant cap from subscription — fetch from DB
            // Default cap of 5 matches the legacy Pro tier.
            let cap = 5;
            try {
              const response = await fetch('/api/subscription-cap', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              });
              if (response.ok) {
                const data = await response.json();
                if (data.participantCap) {
                  cap = data.participantCap;
                }
                if (data.plan) {
                  setParticipantCap(cap);
                }
              }
            } catch {
              // Fall back to default cap if fetch fails
              console.warn("Failed to fetch subscription cap, using default (5)");
            }

            // Global cap enforcement — applies to BOTH classroom and meeting rooms.
            //
            // Unlimited (R389) and any other plan whose `participant_cap` was
            // written to UNLIMITED_PARTICIPANT_CAP (9999) is treated as "no
            // enforcement" and the join is allowed unconditionally. The plan
            // name itself is irrelevant here — we key off the cap value so
            // future tiers above 9999 inherit the bypass for free.
            if (cap === UNLIMITED_PARTICIPANT_CAP) {
              console.info(
                `[Conferly] Unlimited plan active (cap=${UNLIMITED_PARTICIPANT_CAP}) — no participant cap enforced.`
              );
            } else if (room.remoteParticipants.size >= cap) {
              console.warn(
                `[Conferly] Plan cap reached (${cap} participants, roomType=${roomType}). Disconnecting.`
              );
              room.disconnect();
              return;
            }

            await updateRemoteParticipantList();

            if (!media.stream) {
              return;
            }
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
  }, [media.stream, media.toggleMute]); // Added media.toggleMute to dependencies

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
    () => {
      return { participants, participantCount: participants.length, roomType: currentRoomType, isLocalParticipantHost: isLocalHost, participantCap };
    },
    [participants, currentRoomType, isLocalHost, participantCap]
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
