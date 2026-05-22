"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

export function useBrowserMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia);
  }, []);

  const stopMedia = useCallback(() => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsMuted(true);
    setIsVideoOn(false);
  }, [stream]);

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
    } catch (error) {
      setMediaError('Unable to access camera or microphone.');
      return null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(current => {
      const next = !current;
      stream?.getAudioTracks().forEach(track => { track.enabled = !next; });
      return next;
    });
  }, [stream]);

  const toggleVideo = useCallback(() => {
    setIsVideoOn(current => {
      const next = !current;
      stream?.getVideoTracks().forEach(track => { track.enabled = next; });
      return next;
    });
  }, [stream]);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach(track => track.stop());
    setIsScreenSharing(false);
    setScreenStream(null);
  }, [screenStream]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
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
  }, [isScreenSharing, stopScreenShare]);

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
