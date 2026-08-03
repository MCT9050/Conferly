"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, Track } from "livekit-client";

export type ScreenShareStatus =
  | "idle"
  | "starting"
  | "active"
  | "stopping"
  | "error";

export type UseScreenShareOptions = {
  room: Room | null;
};

export type UseScreenShareResult = {
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  status: ScreenShareStatus;
  error: string | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
};

function stopCapturedTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

function isPickerCancellation(error: unknown) {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === "AbortError" || error.name === "NotAllowedError";
}

export function useScreenShare({ room }: UseScreenShareOptions): UseScreenShareResult {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ScreenShareStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(room);
  const streamRef = useRef<MediaStream | null>(null);
  const localScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  const endedListenerRef = useRef<(() => void) | null>(null);
  const statusRef = useRef<ScreenShareStatus>("idle");
  const mountedRef = useRef(false);
  const stoppingRef = useRef(false);
  const captureGenerationRef = useRef(0);
  const activeCaptureGenerationRef = useRef<number | null>(null);
  const cancelledCaptureGenerationsRef = useRef<Set<number>>(new Set());

  const updateStatus = useCallback((nextStatus: ScreenShareStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);

  const resetState = useCallback(() => {
    streamRef.current = null;
    localScreenTrackRef.current = null;
    endedListenerRef.current = null;
    activeCaptureGenerationRef.current = null;

    if (mountedRef.current) {
      setScreenStream(null);
      setError(null);
    }

    updateStatus("idle");
  }, [updateStatus]);

  const removeEndedListener = useCallback(() => {
    const track = localScreenTrackRef.current;
    const endedListener = endedListenerRef.current;

    if (track && endedListener) {
      track.removeEventListener("ended", endedListener);
    }

    endedListenerRef.current = null;
  }, []);

  const cleanupCurrentShare = useCallback(
    async (options?: { cancelledCapture?: boolean }) => {
      const generation = activeCaptureGenerationRef.current;
      if (options?.cancelledCapture && generation !== null) {
        cancelledCaptureGenerationsRef.current.add(generation);
      }

      if (stoppingRef.current) {
        return;
      }

      stoppingRef.current = true;

      const currentStream = streamRef.current;
      const currentTrack = localScreenTrackRef.current;
      const currentRoom = roomRef.current;

      if (currentStream || currentTrack || statusRef.current === "starting") {
        updateStatus("stopping");
      }

      removeEndedListener();

      try {
        if (currentRoom && currentTrack) {
          await currentRoom.localParticipant.unpublishTrack(currentTrack, false);
        }
      } catch (unpublishError) {
        console.error("Screen share unpublish failed:", unpublishError);
      } finally {
        stopCapturedTracks(currentStream);
        resetState();
        stoppingRef.current = false;
      }
    },
    [removeEndedListener, resetState, updateStatus],
  );

  const stopScreenShare = useCallback(async () => {
    await cleanupCurrentShare({ cancelledCapture: statusRef.current === "starting" });
  }, [cleanupCurrentShare]);

  const startScreenShare = useCallback(async () => {
    const currentStatus = statusRef.current;
    if (currentStatus === "starting" || currentStatus === "active") {
      return;
    }

    if (typeof window === "undefined" || !navigator?.mediaDevices?.getDisplayMedia) {
      if (mountedRef.current) {
        setError("Screen sharing is not available in this browser.");
      }
      updateStatus("error");
      return;
    }

    const generation = captureGenerationRef.current + 1;
    captureGenerationRef.current = generation;
    activeCaptureGenerationRef.current = generation;

    if (mountedRef.current) {
      setError(null);
      setScreenStream(null);
    }
    updateStatus("starting");

    let displayStream: MediaStream | null = null;

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (
        cancelledCaptureGenerationsRef.current.has(generation) ||
        activeCaptureGenerationRef.current !== generation ||
        !roomRef.current
      ) {
        stopCapturedTracks(displayStream);
        cancelledCaptureGenerationsRef.current.delete(generation);
        if (activeCaptureGenerationRef.current === generation) {
          resetState();
        }
        return;
      }

      const localScreenTrack = displayStream.getVideoTracks()[0];
      if (!localScreenTrack) {
        stopCapturedTracks(displayStream);
        throw new Error("No display video track was captured.");
      }

      const endedListener = () => {
        void cleanupCurrentShare();
      };

      localScreenTrack.addEventListener("ended", endedListener);
      streamRef.current = displayStream;
      localScreenTrackRef.current = localScreenTrack;
      endedListenerRef.current = endedListener;

      await roomRef.current.localParticipant.publishTrack(localScreenTrack, {
        source: Track.Source.ScreenShare,
        name: "screen-share",
      });

      if (
        cancelledCaptureGenerationsRef.current.has(generation) ||
        activeCaptureGenerationRef.current !== generation ||
        !roomRef.current
      ) {
        await cleanupCurrentShare({ cancelledCapture: true });
        return;
      }

      if (mountedRef.current) {
        setScreenStream(displayStream);
        setError(null);
      }
      updateStatus("active");
    } catch (startError) {
      if (isPickerCancellation(startError)) {
        stopCapturedTracks(displayStream);
        cancelledCaptureGenerationsRef.current.delete(generation);
        if (activeCaptureGenerationRef.current === generation) {
          resetState();
        }
        return;
      }

      await cleanupCurrentShare({ cancelledCapture: true });
      if (mountedRef.current) {
        setError("Could not start screen sharing.");
      }
      updateStatus("error");
    }
  }, [cleanupCurrentShare, resetState, updateStatus]);

  const toggleScreenShare = useCallback(async () => {
    if (statusRef.current === "active" || statusRef.current === "starting") {
      await stopScreenShare();
      return;
    }

    await startScreenShare();
  }, [startScreenShare, stopScreenShare]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    roomRef.current = room;

    return () => {
      void cleanupCurrentShare({ cancelledCapture: true });
    };
  }, [room, cleanupCurrentShare]);

  return {
    screenStream,
    isScreenSharing: status === "active",
    status,
    error,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
  };
}
