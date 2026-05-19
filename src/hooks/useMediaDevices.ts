import { useState, useEffect, useCallback, useRef } from 'react';

export function useMediaDevices() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  // Keep refs to avoid stale closures in stopMedia
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const startMedia = useCallback(async () => {
    try {
      // Adaptive quality: detect connection speed and set resolution accordingly
      const conn = (navigator as any).connection;
      const downlink = conn?.downlink || 10; // Mbps estimate
      const videoConstraints: MediaTrackConstraints = downlink < 5
        ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 }, facingMode: 'user' }
        : downlink < 15
          ? { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24 }, facingMode: 'user' }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setError(null);

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(mediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length / 255;
        setAudioLevel(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      return mediaStream;
    } catch (err: any) {
      console.warn('getUserMedia failed:', err);
      setError(err.message || 'Could not access camera/microphone');
      return null;
    }
  }, []);

  // Use refs to always stop the latest tracks, avoiding stale closure
  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    screenStreamRef.current = null;
    setStream(null);
    setScreenStream(null);
    setAudioLevel(0);
    cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close().catch(() => {});
    }
    audioCtxRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const newMuted = !isMuted;
    s.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const newState = !isVideoOn;
    s.getVideoTracks().forEach(t => { t.enabled = newState; });
    setIsVideoOn(newState);
  }, [isVideoOn]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        screenStreamRef.current = displayStream;
        setScreenStream(displayStream);
        setIsScreenSharing(true);
        displayStream.getVideoTracks()[0].onended = () => {
          screenStreamRef.current = null;
          setScreenStream(null);
          setIsScreenSharing(false);
        };
      } catch {
        // User cancelled the picker
      }
    }
  }, [isScreenSharing]);

  // Cleanup on unmount — stop everything
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close().catch(() => {});
      }
    };
  }, []);

  return {
    stream, screenStream,
    isMuted, isVideoOn, isScreenSharing,
    audioLevel, error,
    startMedia, stopMedia,
    toggleMute, toggleVideo, toggleScreenShare,
  };
}
