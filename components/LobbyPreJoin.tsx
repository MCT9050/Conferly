"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowRight,
  Settings,
} from "lucide-react";

interface LobbyPreJoinProps {
  roomId: string;
  domain?: string;
  lessonId?: string;
  intent?: string;
  invite?: string;
}

export default function LobbyPreJoin({ roomId, domain = "meet", lessonId, intent, invite }: LobbyPreJoinProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [acceptanceStatus, setAcceptanceStatus] = useState<'idle' | 'accepted' | 'failed'>(invite ? 'idle' : 'accepted');
  const [acceptanceError, setAcceptanceError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !invite) return;

    const params = new URLSearchParams(window.location.search);
    params.delete('invite');
    const nextQuery = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`);
  }, [invite]);

  const acceptInvitation = useCallback(async (): Promise<boolean> => {
    if (!invite || intent !== 'join' || domain !== 'meet') return true;

    try {
      const response = await fetch('/api/meeting-invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ room: roomId, invite }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; room?: string };

      if (!response.ok) {
        setAcceptanceStatus('failed');
        setAcceptanceError(payload.error ?? 'Unable to join right now');
        return false;
      }

      setAcceptanceStatus('accepted');
      setAcceptanceError(null);
      return true;
    } catch {
      setAcceptanceStatus('failed');
      setAcceptanceError('Unable to join right now');
      return false;
    }
  }, [domain, intent, invite, roomId]);

  // Enumerate devices
  useEffect(() => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((d) => {
      setDevices(d);
      const videoDevices = d.filter((x) => x.kind === "videoinput");
      const audioDevices = d.filter((x) => x.kind === "audioinput");
      if (videoDevices.length > 0 && !selectedCamera) setSelectedCamera(videoDevices[0].deviceId);
      if (audioDevices.length > 0 && !selectedMic) setSelectedMic(audioDevices[0].deviceId);
    }).catch(() => {});
  }, []);

  // Start camera preview
  const startPreview = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setError("Camera and microphone are not available in this browser.");
      return;
    }
    try {
      // Stop existing stream
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsSupported(true);
      setError(null);

      // Update mute/video state based on actual tracks
      const hasAudio = stream.getAudioTracks().length > 0;
      const hasVideo = stream.getVideoTracks().length > 0;
      setIsMuted(!hasAudio);
      setIsVideoOn(hasVideo);
    } catch {
      setError("Unable to access camera or microphone. Please check permissions.");
    }
  }, [selectedCamera, selectedMic]);

  // Start preview on mount
  useEffect(() => {
    void startPreview();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Re-start preview when device selection changes
  useEffect(() => {
    if (isSupported) {
      void startPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, selectedMic]);

  const toggleMute = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !isMuted;
    s.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setIsMuted(next);
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !isVideoOn;
    s.getVideoTracks().forEach((t) => { t.enabled = next; });
    setIsVideoOn(next);
  }, [isVideoOn]);

  const joinMeeting = useCallback(async () => {
    // Stop preview stream — the meeting page will start its own
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const accepted = await acceptInvitation();
    if (!accepted) return;

    if (domain === "class") {
      if (lessonId) {
        router.push(
          `/class/classrooms/${encodeURIComponent(roomId)}/lessons/${encodeURIComponent(lessonId)}/live`
        );
      } else {
        router.push(`/class/classrooms/${encodeURIComponent(roomId)}`);
      }
    } else {
      router.push(`/meet/rooms/${encodeURIComponent(roomId)}`);
    }
  }, [router, roomId, domain, lessonId, acceptInvitation]);

  const videoDevices = devices.filter((d) => d.kind === "videoinput");
  const audioDevices = devices.filter((d) => d.kind === "audioinput");

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Preview card */}
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 bg-slate-900/85 shadow-xl shadow-black/20">
        {/* Video preview */}
        <div className="aspect-video bg-slate-950 flex items-center justify-center">
          {isVideoOn && isSupported ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-3xl font-bold shadow-lg">
                YO
              </div>
              <p className="text-sm text-slate-400">
                {error ?? "Camera is off"}
              </p>
            </div>
          )}
        </div>

        {/* Controls overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-3 rounded-xl transition-all ${
              isMuted
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-slate-800/80 text-white border border-white/10"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3 rounded-xl transition-all ${
              !isVideoOn
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-slate-800/80 text-white border border-white/10"
            }`}
            title={isVideoOn ? "Camera off" : "Camera on"}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-xl bg-slate-800/80 text-white border border-white/10 transition-all"
            title="Device settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Device settings (collapsible) */}
      {showSettings && (
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-5">
          {videoDevices.length > 1 && (
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Camera</label>
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {audioDevices.length > 1 && (
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Microphone</label>
              <select
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {videoDevices.length <= 1 && audioDevices.length <= 1 && (
            <p className="text-xs text-slate-500">No additional devices detected.</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full max-w-lg rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {acceptanceError && (
        <div className="w-full max-w-lg rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400" role="alert">
          {acceptanceError}
        </div>
      )}

      {/* Join button */}
      <button
        type="button"
        onClick={() => void joinMeeting()}
        className="flex items-center gap-3 px-8 py-4 rounded-full bg-amber-400 text-slate-950 font-semibold text-base hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20"
      >
        {acceptanceStatus === 'idle' && invite ? 'Accept invite and join' : 'Join meeting'}
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Room info */}
      <p className="text-sm text-slate-500">
        Room code: <span className="font-mono text-slate-300">{roomId}</span>
      </p>
    </div>
  );
}