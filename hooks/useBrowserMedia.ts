"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useBrowserMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Refs are initialized to defaults here (no render-body mutation).
  // They are synced to current state values inside a single useEffect below.
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isScreenSharingRef = useRef(false);

  // SINGLE useEffect to sync all refs to their latest state values.
  // Doing this in a useEffect (not in the render body) ensures refs update
  // after the commit phase, preventing the "Rendered more hooks than during
  // the previous render" error (#310) that was caused by render-body mutation.
  useEffect(() => {
    streamRef.current = stream;
    screenStreamRef.current = screenStream;
    isScreenSharingRef.current = isScreenSharing;
  }, [stream, screenStream, isScreenSharing]);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia);
  }, []);

  const stopMedia = useCallback(() => {
    const s = streamRef.current;
    s?.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsMuted(true);
    setIsVideoOn(false);
  }, []);

  const startMedia = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setMediaError('Media devices are not available in this browser.');
      return null;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setStream(nextStream);
      setIsMuted(false);
      setIsVideoOn(true);
      setMediaError(null);
      return nextStream;
    } catch {
      setMediaError('Unable to access camera or microphone.');
      return null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(current => {
      const next = !current;
      streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
      return next;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoOn(current => {
      const next = !current;
      streamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; });
      return next;
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    const ss = screenStreamRef.current;
    ss?.getTracks().forEach(track => track.stop());
    setIsScreenSharing(false);
    setScreenStream(null);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      stopScreenShare();
      return;
    }

    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getDisplayMedia) {
      setMediaError('Screen sharing is not available in this browser.');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(displayStream);
      setIsScreenSharing(true);
      displayStream.getTracks().forEach(track => {
        track.onended = () => {
          stopScreenShare();
        };
      });
    } catch {
      setMediaError('Could not start screen sharing.');
    }
  }, [stopScreenShare]);

  const value = useMemo(
    () => ({
      stream,
      screenStream,
      isMuted,
      isVideoOn,
      isScreenSharing,
      isSupported,
      mediaError,
      startMedia,
      stopMedia,
      toggleMute,
      toggleVideo,
      toggleScreenShare,
    }),
    [stream, screenStream, isMuted, isVideoOn, isScreenSharing, isSupported, mediaError, startMedia, stopMedia, toggleMute, toggleVideo, toggleScreenShare]
  );

  return value;
}
