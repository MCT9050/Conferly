"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  connect,
  Room,
  RoomEvent,
  Participant,
  LocalParticipant,
  RemoteParticipant,
  LocalVideoTrack,
  LocalAudioTrack,
  RemoteTrack,
  RemoteTrackPublication,
  VideoPresets,
  AudioPresets,
} from "livekit-client";
import { BehaviorSubject } from "rxjs";

// Types for the room state
export interface RoomState {
  room: Room | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  participants: Participant[];
  localParticipant: LocalParticipant | null;
}

export interface UseLiveKitOptions {
  roomId: string;
  participantName?: string;
}

export interface UseLiveKitReturn {
  state: RoomState;
  localVideo: MediaStream | null;
  localAudio: MediaStream | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  shareScreen: () => Promise<void>;
}

export function useLiveKit({ roomId, participantName }: UseLiveKitOptions): UseLiveKitReturn {
  const router = useRouter();
  const [state, setState] = useState<RoomState>({
    room: null,
    isConnecting: false,
    isConnected: false,
    error: null,
    participants: [],
    localParticipant: null,
  });
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  const [localAudio, setLocalAudio] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isAudioEnabled = useRef(true);
  const isVideoEnabled = useRef(true);

  const connect = useCallback(async () => {
    if (state.isConnecting || state.isConnected) return;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Fetch token from API
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, participantName }),
      });

      if (!response.ok) {
        throw new Error("Failed to get token");
      }

      const { token, url } = await response.json();

      if (!token || token === "mock-token") {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
          error: "Demo mode - LiveKit not configured",
        }));
        return;
      }

      // Connect to LiveKit
      const room = new Room({
        videoCaptureDefaults: {
          resolution: VideoPresets.hd720,
        },
        audioCaptureDefaults: {
         ...AudioPresets.nspeech,
        },
      });

      // Handle events
      room
        .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          setState((prev) => ({
            ...prev,
            participants: [...prev.participants, participant],
          }));
        })
        .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          setState((prev) => ({
            ...prev,
            participants: prev.participants.filter((p) => p.identity !== participant.identity),
          }));
        })
        .on(RoomEvent.Disconnected, () => {
          setState((prev) => ({
            ...prev,
            isConnected: false,
            room: null,
            participants: [],
          }));
        })
        .on(RoomEvent.Reconnecting, () => {
          setState((prev) => ({ ...prev, error: "Reconnecting..." }));
        })
        .on(RoomEvent.Reconnected, () => {
          setState((prev) => ({ ...prev, error: null }));
        });

      await room.connect(url, token, {
        autoSubscribe: true,
      });

      // Start local tracks
      await room.startLocalPreview();

      // Get local tracks
      const localParticipant = room.localParticipant;
      const videoTrack = Array.from(localParticipant.videoTracks.values())[0]?.track;
      const audioTrack = Array.from(localParticipant.audioTracks.values())[0]?.track;

      if (videoTrack) {
        const stream = new MediaStream();
        // @ts-expect-error - LiveKit track
        stream.addTrack(videoTrack.mediaStreamTrack);
        setLocalVideo(stream);
      }

      if (audioTrack) {
        const stream = new MediaStream();
        // @ts-expect-error - LiveKit track
        stream.addTrack(audioTrack.mediaStreamTrack);
        setLocalAudio(stream);
      }

      setState({
        room,
        isConnecting: false,
        isConnected: true,
        error: null,
        participants: Array.from(room.participants.values()),
        localParticipant,
      });
    } catch (error) {
      console.error("Connection error:", error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }));
    }
  }, [roomId, participantName, state.isConnected, state.isConnecting]);

  const disconnect = useCallback(() => {
    if (state.room) {
      state.room.disconnect();
      setState({
        room: null,
        isConnecting: false,
        isConnected: false,
        error: null,
        participants: [],
        localParticipant: null,
      });
      setLocalVideo(null);
      setLocalAudio(null);
    }
  }, [state.room]);

  const toggleAudio = useCallback(() => {
    if (state.localParticipant) {
      isAudioEnabled.current = !isAudioEnabled.current;
      if (isAudioEnabled.current) {
        state.localParticipant.unmuteMicrophone();
      } else {
        state.localParticipant.muteMicrophone();
      }
    }
  }, [state.localParticipant]);

  const toggleVideo = useCallback(() => {
    if (state.localParticipant) {
      isVideoEnabled.current = !isVideoEnabled.current;
      if (isVideoEnabled.current) {
        state.localParticipant.unmuteCamera();
      } else {
        state.localParticipant.muteCamera();
      }
    }
  }, [state.localParticipant]);

  const shareScreen = useCallback(async () => {
    if (state.localParticipant) {
      try {
        const track = await state.localParticipant.createScreenShareTrack();
        state.localParticipant.publishTrack(track);
      } catch (error) {
        console.error("Screen share error:", error);
      }
    }
  }, [state.localParticipant]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.room) {
        state.room.disconnect();
      }
    };
  }, []);

  return {
    state,
    localVideo,
    localAudio,
    connect,
    disconnect,
    toggleAudio,
    toggleVideo,
    shareScreen,
  };
}