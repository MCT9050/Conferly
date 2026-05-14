"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLiveKit } from "@/lib/hooks/use-livekit";
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, 
  Users, Wifi, WifiOff, Loader2, MessageSquare
} from "lucide-react";

function ParticipantVideo({ 
  stream, 
  name, 
  isLocal,
  isMuted,
  isVideoOff,
}: { 
  stream: MediaStream | null; 
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-800"
    >
      {isVideoOff ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {/* Name overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm">
          {name}
          {isLocal && " (You)"}
        </span>
        {isMuted && (
          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400">
            <MicOff className="w-3 h-3" />
          </span>
        )}
      </div>
    </motion.div>
  );
}

function ControlsBar({ 
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onLeave,
  isAudioOn,
  isVideoOn,
  isConnecting,
  participantCount,
}: {
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onShareScreen: () => void;
  onLeave: () => void;
  isAudioOn: boolean;
  isVideoOn: boolean;
  isConnecting: boolean;
  participantCount: number;
}) {
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-xl">
        {/* Participant count */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300">
          <Users className="w-5 h-5" />
          <span className="text-sm font-medium">{participantCount}</span>
        </div>

        <div className="w-px h-8 bg-slate-700" />

        {/* Audio toggle */}
        <Button
          variant={isAudioOn ? "default" : "destructive"}
          size="icon"
          onClick={onToggleAudio}
          disabled={isConnecting}
          className="rounded-full"
        >
          {isAudioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </Button>

        {/* Video toggle */}
        <Button
          variant={isVideoOn ? "default" : "destructive"}
          size="icon"
          onClick={onToggleVideo}
          disabled={isConnecting}
          className="rounded-full"
        >
          {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>

        {/* Screen share */}
        <Button
          variant="outline"
          size="icon"
          onClick={onShareScreen}
          disabled={isConnecting}
          className="rounded-full border-slate-700"
        >
          <Monitor className="w-5 h-5" />
        </Button>

        <div className="w-px h-8 bg-slate-700" />

        {/* Leave */}
        <Button
          variant="destructive"
          onClick={onLeave}
          className="rounded-full px-6"
        >
          <PhoneOff className="w-5 h-5 mr-2" />
          Leave
        </Button>
      </div>
    </motion.div>
  );
}

function LoadingState({ error }: { error: string | null }) {
  if (error && error !== "Reconnecting...") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-slate-950"
      >
        <div className="text-center space-y-4">
          <WifiOff className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-white">{error}</h2>
          <p className="text-slate-400">Please check your connection and try again.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center bg-slate-950"
    >
      <div className="text-center space-y-4">
        <Loader2 className="w-16 h-16 text-amber-500 animate-spin mx-auto" />
        <h2 className="text-xl font-semibold text-white">Connecting to room...</h2>
        <p className="text-slate-400">
          {error || "Setting up your camera and microphone"}
        </p>
      </div>
    </motion.div>
  );
}

function ReconnectingOverlay({ isReconnecting }: { isReconnecting: boolean }) {
  return (
    <AnimatePresence>
      {isReconnecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 px-6 py-4 rounded-full bg-slate-900 border border-slate-700">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <span className="text-white">Reconnecting...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [showChat, setShowChat] = useState(false);

  const {
    state,
    localVideo,
    localAudio,
    connect,
    disconnect,
    toggleAudio,
    toggleVideo,
    shareScreen,
  } = useLiveKit({ roomId });

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Sync local state with LiveKit
  const handleToggleAudio = () => {
    toggleAudio();
    setIsAudioOn(!isAudioOn);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOn(!isVideoOn);
  };

  const handleLeave = () => {
    disconnect();
    router.push("/dashboard");
  };

  const participantCount = 1 + state.participants.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">Room: {roomId}</span>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              {state.isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-slate-500" />
                  <span>Connecting...</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChat(!showChat)}
              className="rounded-full"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Video grid */}
      <main className="p-4 pb-24">
        {(state.isConnecting || !state.isConnected) && !state.error ? (
          <LoadingState error={state.error} />
        ) : state.error ? (
          <LoadingState error={state.error} />
        ) : (
          <div className="max-w-7xl mx-auto">
            {/* Local video - always visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <motion.div
                layout
                className="col-span-1"
              >
                <ParticipantVideo
                  stream={localVideo}
                  name="You"
                  isLocal
                  isMuted={!isAudioOn}
                  isVideoOff={!isVideoOn}
                />
              </motion.div>

              {/* Remote participants */}
              <AnimatePresence>
                {state.participants.map((participant) => (
                  <motion.div
                    key={participant.identity}
                    layout
                    className="col-span-1"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <ParticipantVideo
                      stream={null}
                      name={participant.name || participant.identity}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* Reconnecting overlay */}
      <ReconnectingOverlay isReconnecting={state.error === "Reconnecting..."} />

      {/* Controls bar */}
      {(state.isConnected || state.error) && (
        <ControlsBar
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onShareScreen={shareScreen}
          onLeave={handleLeave}
          isAudioOn={isAudioOn}
          isVideoOn={isVideoOn}
          isConnecting={state.isConnecting}
          participantCount={participantCount}
        />
      )}
    </div>
  );
}