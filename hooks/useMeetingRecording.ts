"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export function useMeetingRecording(sourceStream: MediaStream | null) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'MediaRecorder' in window);
  }, []);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!sourceStream || !isSupported) return;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') return;

    const recorder = new MediaRecorder(sourceStream, { mimeType: 'video/webm; codecs=vp9,opus' });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setIsRecording(false);
    };

    recorder.start();
    setIsRecording(true);
  }, [sourceStream, isSupported]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conferly-recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  return {
    isRecording,
    recordedBlob,
    isSupported,
    startRecording,
    stopRecording,
    downloadRecording,
  };
}