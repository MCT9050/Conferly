'use client';

import { useState, useCallback, useEffect } from 'react';

type JoinPreferences = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  audioOnly: boolean;
};

type ClassroomPreJoinProps = {
  lessonTitle?: string;
  userName: string;
  userRole: 'owner' | 'instructor' | 'ta' | 'student' | 'auditor';
  onJoin: (prefs: JoinPreferences) => void;
  onCancel?: () => void;
};

export function ClassroomPreJoin({
  lessonTitle = 'Live lesson',
  userName,
  userRole,
  onJoin,
  onCancel,
}: ClassroomPreJoinProps) {
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [audioOnly, setAudioOnly] = useState(userRole === 'auditor');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAuditor = userRole === 'auditor';

  // Initialize local preview when camera is enabled
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!cameraEnabled || audioOnly || isAuditor) {
      setLocalStream(null);
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;

    async function startPreview() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: micEnabled,
          video: cameraEnabled,
        });
        if (!cancelled) {
          setLocalStream(stream);
          setMediaError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMediaError(
            err instanceof Error ? err.message : 'Unable to access camera or microphone'
          );
          setLocalStream(null);
        }
      }
    }

    startPreview();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraEnabled, micEnabled, audioOnly, isAuditor]);

  const handleJoin = useCallback(() => {
    setIsLoading(true);
    onJoin({
      micEnabled: !isAuditor && micEnabled,
      cameraEnabled: !isAuditor && cameraEnabled && !audioOnly,
      audioOnly: isAuditor || audioOnly,
    });
  }, [micEnabled, cameraEnabled, audioOnly, isAuditor, onJoin]);

  const handleAudioOnlyToggle = useCallback(() => {
    setAudioOnly((prev) => !prev);
    setMediaError(null);
  }, []);

  const handleCameraToggle = useCallback(() => {
    if (isAuditor) return;
    setCameraEnabled((prev) => !prev);
    setMediaError(null);
  }, [isAuditor]);

  const handleMicToggle = useCallback(() => {
    if (isAuditor) return;
    setMicEnabled((prev) => !prev);
  }, [isAuditor]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/40 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Join Classroom</h1>
          <p className="text-sm text-slate-300" role="status" aria-live="polite">
            Preparing shared classroom foundation for {lessonTitle}
          </p>
          <p className="text-sm text-slate-400">
            {isAuditor
              ? 'You are joining as an auditor (listen-only).'
              : 'Set up your audio and video before joining.'}
          </p>
        </div>

        {/* Local preview */}
        <div className="rounded-2xl border border-white/10 bg-slate-800/40 overflow-hidden aspect-video relative">
          {localStream && !audioOnly ? (
            <video
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              ref={(el) => {
                if (el && localStream) el.srcObject = localStream;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-2xl font-bold text-white mx-auto">
                  {userName
                    .split(' ')
                    .map((p) => p[0] ?? '')
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '??'}
                </div>
                <p className="text-sm text-slate-400">
                  {audioOnly ? 'Audio-only mode' : 'Camera preview'}
                </p>
              </div>
            </div>
          )}

          {/* Media error overlay */}
          {mediaError && (
            <div className="absolute inset-0 bg-red-500/10 border border-red-500/30 flex items-center justify-center p-4">
              <p className="text-sm text-red-400 text-center">{mediaError}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Microphone toggle */}
          {!isAuditor && (
            <button
              type="button"
              onClick={handleMicToggle}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                micEnabled
                  ? 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              }`}
            >
              <span className="text-lg">{micEnabled ? '🎤' : '🔇'}</span>
              <span className="text-sm font-medium">
                {micEnabled ? 'Microphone On' : 'Microphone Off'}
              </span>
            </button>
          )}

          {/* Camera toggle */}
          {!isAuditor && (
            <button
              type="button"
              onClick={handleCameraToggle}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                cameraEnabled && !audioOnly
                  ? 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              }`}
            >
              <span className="text-lg">{cameraEnabled && !audioOnly ? '📹' : '📷'}</span>
              <span className="text-sm font-medium">
                {cameraEnabled && !audioOnly ? 'Camera On' : 'Camera Off'}
              </span>
            </button>
          )}

          {/* Audio-only toggle */}
          {!isAuditor && (
            <button
              type="button"
              onClick={handleAudioOnlyToggle}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                audioOnly
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-slate-800/60 border-white/10 text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-lg">🎧</span>
              <span className="text-sm font-medium">
                {audioOnly ? 'Audio Only' : 'Audio + Video'}
              </span>
            </button>
          )}
        </div>

        {/* Role badge */}
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
            {userRole.toUpperCase()}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 rounded-xl bg-slate-800/60 border border-white/10 text-white font-medium hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleJoin}
            disabled={isLoading}
            className="px-8 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'Joining...' : 'Join Classroom'}
          </button>
        </div>
      </div>
    </div>
  );
}