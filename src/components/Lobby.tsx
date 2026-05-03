import { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff,
  Settings, ArrowRight, ArrowLeft, Copy, Check,
  Volume2, AlertTriangle
} from 'lucide-react';
import type { AppView } from '../types';

interface LobbyProps {
  roomId: string;
  userName: string;
  setView: (v: AppView) => void;
  stream: MediaStream | null;
  startMedia: () => Promise<MediaStream | null>;
  isMuted: boolean;
  toggleMute: () => void;
  isVideoOn: boolean;
  toggleVideo: () => void;
  audioLevel: number;
  mediaError: string | null;
}

export default function Lobby({
  roomId, userName, setView,
  stream, startMedia,
  isMuted, toggleMute, isVideoOn, toggleVideo,
  audioLevel, mediaError,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Request camera/mic on mount
  useEffect(() => {
    if (!stream) {
      startMedia();
    }
  }, [stream, startMedia]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const copyRoomId = () => {
    navigator.clipboard?.writeText(roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 sm:px-6 py-6 sm:py-12">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => setView('dashboard')}
            className="p-2.5 min-w-[44px] min-h-[44px] rounded-xl glass active:bg-slate-700/50 transition-colors flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Ready to join?</h1>
            <p className="text-xs sm:text-sm text-slate-400">Check your audio & video</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 sm:gap-8">
          {/* Video Preview */}
          <div className="lg:col-span-3">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="relative aspect-video bg-slate-900">
                {stream && isVideoOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-4xl font-bold mb-4">
                      {(userName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-slate-400 text-sm">
                      {mediaError ? 'Camera unavailable' : 'Camera off'}
                    </span>
                  </div>
                )}

                {/* Speaking indicator ring */}
                {!isMuted && audioLevel > 0.08 && (
                  <div className="absolute inset-0 border-2 border-blue-400/60 rounded-none pointer-events-none animate-pulse" />
                )}
              </div>

              {/* Error banner */}
              {mediaError && (
                <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{mediaError}. You can still join audio-only.</span>
                </div>
              )}

              {/* Controls overlay */}
              <div className="p-4 flex items-center justify-center gap-3">
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-xl transition-all ${
                    isMuted
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-slate-700/50 text-white hover:bg-slate-600/50'
                  }`}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-xl transition-all ${
                    !isVideoOn
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-slate-700/50 text-white hover:bg-slate-600/50'
                  }`}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button className="p-3 rounded-xl bg-slate-700/50 text-white hover:bg-slate-600/50 transition-all">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Info */}
            <div className="glass rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-lg">Meeting Details</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Meeting Code</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-slate-800/80 text-sm font-mono text-slate-200">
                      {roomId}
                    </code>
                    <button
                      onClick={copyRoomId}
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Your Name</div>
                  <div className="px-3 py-2 rounded-lg bg-slate-800/80 text-sm">{userName}</div>
                </div>
              </div>
            </div>

            {/* Audio Level — real analyzer */}
            <div className="glass rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Volume2 className="w-4 h-4 text-blue-400" />
                Microphone Test
              </div>
              <div className="flex items-end gap-1 h-8">
                {Array.from({ length: 20 }).map((_, i) => {
                  const barLevel = isMuted ? 0 : audioLevel;
                  const barHeight = Math.max(4, barLevel * (1 - Math.abs(i - 10) / 12) * 100);
                  const ratio = i / 20;
                  const color = isMuted ? '#475569' : ratio < 0.6 ? '#22c55e' : ratio < 0.8 ? '#eab308' : '#ef4444';
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all duration-75"
                      style={{ height: `${barHeight}%`, backgroundColor: color, minHeight: '4px' }}
                    />
                  );
                })}
              </div>
              <div className="text-xs text-slate-500">
                {isMuted ? 'Microphone is muted' : stream ? 'Speak to test your microphone' : 'Waiting for microphone access…'}
              </div>
            </div>

            {/* Join Button */}
            <button
              onClick={() => setView('meeting')}
              className="w-full py-4 min-h-[52px] rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-base sm:text-lg flex items-center justify-center gap-3 active:from-blue-500 active:to-cyan-400 transition-all shadow-lg glow-blue"
            >
              Join Meeting
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-xs text-slate-500 text-center">
              By joining, you agree to Conferly's terms of service
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
