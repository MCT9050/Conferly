"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  VideoPresets,
} from "livekit-client";

// Types for the room state
export interface RoomState {
  room: Room | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  participants: RemoteParticipant[];
  localParticipant: import("livekit-client").LocalParticipant | null;
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

      // Create Room with default capture settings
      const room = new Room();

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
        })
        .on(RoomEvent.TrackSubscribed, (_track, _publication, participant) => {
          // Handle track subscription - could extract media stream here
          if (participant && participant.identity !== state.localParticipant?.identity) {
            // Update participants list to include tracks info
          }
        });

      // Connect to LiveKit
      await room.connect(url, token, {
        autoSubscribe: true,
      });

      // Get local participant and publish default tracks
      const localParticipant = room.localParticipant;
      
      // Publish video with default settings
      await localParticipant.setCameraEnabled(true);
      await localParticipant.setMicrophoneEnabled(true);

      setState({
        room,
        isConnecting: false,
        isConnected: true,
        error: null,
        participants: [], // Will be populated via events
        localParticipant,
      });
      
      setLocalVideo(null);
      setLocalAudio(null);
    } catch (error) {
      console.error("Connection error:", error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }));
    }
  }, [roomId, participantName, state.isConnected, state.isConnecting, state.localParticipant?.identity]);

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

  const toggleAudio = useCallback(async () => {
    if (state.localParticipant) {
      try {
        const newState = !isAudioEnabled.current;
        isAudioEnabled.current = newState;
        await state.localParticipant.setMicrophoneEnabled(newState);
      } catch (error) {
        console.error("Failed to toggle audio:", error);
      }
    }
  }, [state.localParticipant]);

  const toggleVideo = useCallback(async () => {
    if (state.localParticipant) {
      try {
        const newState = !isVideoEnabled.current;
        isVideoEnabled.current = newState;
        await state.localParticipant.setCameraEnabled(newState);
      } catch (error) {
        console.error("Failed to toggle video:", error);
      }
    }
  }, [state.localParticipant]);

  const shareScreen = useCallback(async () => {
    if (state.localParticipant) {
      try {
        await state.localParticipant.setScreenShareEnabled(true);
      } catch (error) {
        console.error("Failed to start screen share:", error);
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