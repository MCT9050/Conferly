// components/meet/MeetLiveSession.tsx
// Self-contained meeting-specific live session component.
// Extracted from MeetingRuntimeClient.tsx — no wrapper, no import of MeetingRuntimeClient.

'use client';

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MeetingErrorFallback } from "@/components/MeetingErrorFallback";
import VideoGrid from "@/components/VideoGrid";
import CaptionsOverlay from "@/components/meeting/CaptionsOverlay";
import MeetingControls from "@/components/MeetingControls";
import { useSpeechTranscript } from "@/hooks/useSpeechTranscript";
import { summarizeAction, assistantAction } from "@/app/actions/ai-actions";
import type { Participant, SidebarTab, Reaction } from "@/types";

// ----------------------------------------------------------------------------
// Media store — useSyncExternalStore, no context tree.
// ----------------------------------------------------------------------------

type MediaState = {
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isSupported: boolean;
  mediaError: string | null;
};

const initialMediaState: MediaState = {
  stream: null,
  screenStream: null,
  isMuted: true,
  isVideoOn: true,
  isScreenSharing: false,
  isSupported: false,
  mediaError: null,
};

let mediaState: MediaState = { ...initialMediaState };
const mediaListeners = new Set<() => void>();
let streamRef: MediaStream | null = null;
let screenStreamRef: MediaStream | null = null;

function emitMediaChange() {
  for (const listener of mediaListeners) listener();
}

function setMediaState(updater: (current: MediaState) => MediaState) {
  const next = updater(mediaState);
  if (next === mediaState) return;
  mediaState = next;
  emitMediaChange();
}

function subscribeMedia(listener: () => void) {
  mediaListeners.add(listener);
  return () => {
    mediaListeners.delete(listener);
  };
}

function getMediaSnapshot() {
  return mediaState;
}

function getMediaServerSnapshot(): MediaState {
  return initialMediaState;
}

function useMediaStore<T>(selector: (state: MediaState) => T): T {
  return useSyncExternalStore(
    subscribeMedia,
    () => selector(getMediaSnapshot()),
    () => selector(getMediaServerSnapshot()),
  );
}

async function startMedia() {
  if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
    setMediaState((s) => ({
      ...s,
      isSupported: false,
      mediaError: "Media devices unavailable in this browser.",
    }));
    return;
  }
  try {
    const next = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    streamRef = next;
    setMediaState((s) => ({
      ...s,
      stream: next,
      isMuted: false,
      isVideoOn: true,
      isSupported: true,
      mediaError: null,
    }));
  } catch {
    setMediaState((s) => ({
      ...s,
      mediaError: "Unable to access camera or microphone.",
    }));
  }
}

function stopMedia() {
  streamRef?.getTracks().forEach((track) => track.stop());
  streamRef = null;
  setMediaState((s) => ({ ...s, stream: null, isMuted: true, isVideoOn: false }));
}

function toggleMute() {
  if (!streamRef) {
    void startMedia();
    return;
  }
  const nextMuted = !mediaState.isMuted;
  streamRef.getAudioTracks().forEach((track) => {
    track.enabled = !nextMuted;
  });
  setMediaState((s) => ({ ...s, isMuted: nextMuted }));
}

function toggleVideo() {
  if (!streamRef) {
    void startMedia();
    return;
  }
  const nextVideo = !mediaState.isVideoOn;
  streamRef.getVideoTracks().forEach((track) => {
    track.enabled = nextVideo;
  });
  setMediaState((s) => ({ ...s, isVideoOn: nextVideo }));
}

async function toggleScreenShare() {
  if (mediaState.isScreenSharing) {
    screenStreamRef?.getTracks().forEach((track) => track.stop());
    screenStreamRef = null;
    setMediaState((s) => ({
      ...s,
      isScreenSharing: false,
      screenStream: null,
    }));
    return;
  }
  if (
    typeof window === "undefined" ||
    !navigator?.mediaDevices?.getDisplayMedia
  ) {
    setMediaState((s) => ({
      ...s,
      mediaError: "Screen sharing is not available in this browser.",
    }));
    return;
  }
  try {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenStreamRef = display;
    display.getVideoTracks()[0]?.addEventListener("ended", () => {
      screenStreamRef = null;
      setMediaState((s) => ({
        ...s,
        isScreenSharing: false,
        screenStream: null,
      }));
    });
    setMediaState((s) => ({
      ...s,
      isScreenSharing: true,
      screenStream: display,
    }));
  } catch {
    setMediaState((s) => ({ ...s, mediaError: "Could not start screen sharing." }));
  }
}

// ----------------------------------------------------------------------------
// LiveKit connection — lazy-loaded, manages room + remote participants.
// ----------------------------------------------------------------------------

type LiveKitState = {
  connected: boolean;
  participants: Participant[];
  connectionError: string | null;
};

const initialLiveKitState: LiveKitState = {
  connected: false,
  participants: [],
  connectionError: null,
};

let liveKitState: LiveKitState = { ...initialLiveKitState };
const liveKitListeners = new Set<() => void>();
let liveKitRoom: any = null;

function emitLiveKitChange() {
  for (const listener of liveKitListeners) listener();
}

function setLiveKitState(updater: (current: LiveKitState) => LiveKitState) {
  const next = updater(liveKitState);
  if (next === liveKitState) return;
  liveKitState = next;
  emitLiveKitChange();
}

function subscribeLiveKit(listener: () => void) {
  liveKitListeners.add(listener);
  return () => {
    liveKitListeners.delete(listener);
  };
}

function getLiveKitSnapshot() {
  return liveKitState;
}

function getLiveKitServerSnapshot(): LiveKitState {
  return initialLiveKitState;
}

function useLiveKitStore<T>(selector: (state: LiveKitState) => T): T {
  return useSyncExternalStore(
    subscribeLiveKit,
    () => selector(getLiveKitSnapshot()),
    () => selector(getLiveKitServerSnapshot()),
  );
}

function getAvatar(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0] ?? "")
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??"
  );
}

async function connectToRoom(roomId: string, localStream: MediaStream | null) {
  if (typeof window === "undefined") return;
  try {
    const { Room, Track, RoomEvent } = await import("livekit-client");

    const room = new Room({ adaptiveStream: true, dynacast: true });
    liveKitRoom = room;

    const response = await fetch("/api/lk-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ roomId, role: "participant" }),
    });

    if (!response.ok) {
      throw new Error(`Unable to get meeting token (${response.status})`);
    }

    const { token, url } = await response.json();
    await room.connect(url, token, { autoSubscribe: true });
    setLiveKitState((s) => ({ ...s, connected: true, connectionError: null }));

    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];
      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, {
          source: Track.Source.Microphone,
          name: "microphone",
        });
      }
      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.Camera,
          name: "camera",
        });
      }
    }

    const updateParticipants = () => {
      const remoteParticipants: Participant[] = Array.from(
        room.remoteParticipants.values(),
      ).map((p: any) => {
        const cameraPub = p.getTrackPublication(Track.Source.Camera);
        const micPub = p.getTrackPublication(Track.Source.Microphone);

        const tracks: MediaStreamTrack[] = [];
        if (cameraPub?.isSubscribed && cameraPub.videoTrack?.mediaStreamTrack) {
          tracks.push(cameraPub.videoTrack.mediaStreamTrack);
        }
        if (micPub?.isSubscribed && micPub.audioTrack?.mediaStreamTrack) {
          tracks.push(micPub.audioTrack.mediaStreamTrack);
        }
        const stream = tracks.length > 0 ? new MediaStream(tracks) : null;

        const name = p.name ?? p.identity ?? "Guest";
        return {
          id: p.identity ?? p.sid ?? Math.random().toString(36).slice(2),
          name,
          avatar: getAvatar(name),
          stream,
          isSpeaking: Boolean(p.isSpeaking),
          isVideoOn: Boolean(cameraPub?.isSubscribed),
          isMuted: micPub?.muted ?? true,
          audioLevel: 0,
        } as Participant;
      });

      setLiveKitState((s) => ({ ...s, participants: remoteParticipants }));
    };

    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.TrackSubscribed, updateParticipants);
    room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
    room.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
    updateParticipants();
  } catch (error) {
    console.error("LiveKit connection failed:", error);
    setLiveKitState((s) => ({
      ...s,
      connectionError:
        error instanceof Error ? error.message : "Connection failed",
    }));
  }
}

function disconnectFromRoom() {
  if (liveKitRoom) {
    liveKitRoom.disconnect().catch(() => {});
    liveKitRoom = null;
  }
  setLiveKitState(() => ({ ...initialLiveKitState }));
}

async function publishScreenShareTrack(screenStream: MediaStream | null) {
  if (!liveKitRoom || !screenStream) return;
  try {
    const { Track } = await import("livekit-client");
    const screenTrack = screenStream.getVideoTracks()[0];
    if (screenTrack) {
      await liveKitRoom.localParticipant.publishTrack(screenTrack, {
        source: Track.Source.ScreenShare,
        name: "screen-share",
      });
    }
  } catch (error) {
    console.error("Screen share publish failed:", error);
  }
}

// ----------------------------------------------------------------------------
// Sidebar panels — static content, no provider dependencies.
// ----------------------------------------------------------------------------

function ChatPanel() {
  const [messages, setMessages] = useState<
    { id: string; sender: string; message: string }[]
  >([]);
  const [input, setInput] = useState("");

  const send = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((c) => [
      ...c,
      {
        id: Math.random().toString(36).slice(2, 10),
        sender: "You",
        message: trimmed,
      },
    ]);
    setInput("");
  }, [input]);

  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex-1 overflow-y-auto space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-12">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="ml-6">
              <div className="rounded-2xl px-4 py-2.5 bg-blue-600/20 border border-blue-500/20 ml-auto">
                <div className="text-xs text-slate-400 mb-1 font-medium">
                  {msg.sender}
                </div>
                <div className="text-sm text-slate-200">{msg.message}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim()}
          className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function PeoplePanel({ participants }: { participants: Participant[] }) {
  return (
    <div className="p-4 space-y-2">
      <div className="text-xs text-slate-400 mb-3">
        {participants.length} participant{participants.length !== 1 ? "s" : ""}
      </div>
      {participants.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-sm font-bold">
            {p.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {p.name}
              {p.id === "self" && (
                <span className="text-slate-400 ml-1">(You)</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {p.isMuted ? (
                <span className="text-[10px] text-red-400">Muted</span>
              ) : (
                <span className="text-[10px] text-green-400">Mic on</span>
              )}
              {p.isSpeaking && (
                <span className="text-[10px] text-amber-400">Speaking</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="p-4 space-y-3">
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 space-y-2">
        <h3 className="font-semibold text-slate-200 text-sm">Meeting security</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Production meetings can be locked with a passcode, waiting room, and
          end-to-end encryption indicators.
        </p>
        <ul className="text-xs text-slate-400 space-y-1 pt-2">
          <li>&#8226; Passcode protection (trial plan)</li>
          <li>&#8226; Waiting room with admit/deny (pro plan)</li>
          <li>&#8226; End-to-end encrypted media (business plan)</li>
        </ul>
      </div>
    </div>
  );
}

function TranscriptPanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Live transcription</p>
      <p>
        Start transcription in your browser to capture every word in real time.
        Conferly's transcript powers the AI Meeting Pulse and per-speaker
        search.
      </p>
    </div>
  );
}

function PulsePanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">AI Meeting Pulse</p>
      <p>
        Once a transcript is available, Conferly will surface the key topics,
        decisions, and action items with citations.
      </p>
    </div>
  );
}

function TranslatePanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Real-time translation</p>
      <p>
        Translate spoken language into isiZulu, Afrikaans, isiXhosa, and English
        in real time.
      </p>
    </div>
  );
}

function NotesPanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Collaborative notes</p>
      <p>
        Shared notes with Yjs sync &#8212; keep this tab open to stay in sync
        with the rest of the room.
      </p>
    </div>
  );
}

function SlidesPanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Slides</p>
      <p>
        Present, annotate, and broadcast slides to every participant in the
        meeting.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// AI Assistant Panel
// ----------------------------------------------------------------------------

function AssistantPanel({
  transcript,
  roomType,
  onSendToChat,
}: {
  transcript: { id: string; speaker: string; text: string; isFinal: boolean; timestamp: string }[];
  roomType: "meeting" | "classroom";
  onSendToChat: (message: string) => void;
}) {
  const [messages, setMessages] = useState<
    { id: string; sender: "user" | "assistant"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const systemPrompt =
    roomType === "classroom"
      ? "You are an expert tutor. Help the teacher explain concepts and suggest whiteboard diagrams."
      : "You are a professional secretary. Help the user with meeting minutes and business logic.";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    setIsLoading(true);

    const userMsg = {
      id: Math.random().toString(36).slice(2, 10),
      sender: "user" as const,
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const recentTranscript = transcript
        .filter((e) => e.isFinal)
        .slice(-5)
        .map((e) => `[${e.speaker}]: ${e.text}`)
        .join("\n");

      const contextBlock = recentTranscript
        ? `Here is what is happening in the room:\n${recentTranscript}\n\n`
        : "";

      const fullPrompt = `${systemPrompt}\n\n${contextBlock}User: ${trimmed}\nAssistant:`;
      const result = await assistantAction(fullPrompt);

      if (result.status === 'COOLDOWN') {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2, 10),
            sender: "assistant",
            text: `AI is resting to maintain quality. Back in ${result.retryAfter}s.`,
          },
        ]);
      } else if (result.status === 'ERROR') {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2, 10),
            sender: "assistant",
            text: result.error || "Sorry, the AI service is temporarily unavailable.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2, 10),
            sender: "assistant",
            text: result.data || "I'm sorry, I couldn't generate a response.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 10),
          sender: "assistant",
          text: "Sorry, the AI service is temporarily unavailable.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, transcript, systemPrompt]);

  const handleSendToChat = useCallback(
    (text: string) => {
      onSendToChat(text);
    },
    [onSendToChat],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-sm text-slate-500 py-12">
            Ask me anything about this meeting.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${msg.sender === "user" ? "ml-6" : "mr-6"}`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 ${
                msg.sender === "user"
                  ? "bg-blue-600/20 border border-blue-500/20 ml-auto"
                  : "bg-slate-800/60 border border-slate-700/30"
              }`}
            >
              <div className="text-xs text-slate-400 mb-1 font-medium">
                {msg.sender === "user" ? "You" : "AI Assistant"}
              </div>
              <div className="text-sm text-slate-200">{msg.text}</div>
              {msg.sender === "assistant" && (
                <button
                  type="button"
                  onClick={() => handleSendToChat(msg.text)}
                  className="mt-2 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  title="Send this response to the main chat"
                >
                  Send to Chat
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="mr-6">
            <div className="rounded-2xl px-4 py-3 bg-slate-800/60 border border-slate-700/30">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                AI is thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
            placeholder="Ask about the meeting..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------------------

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "transcript", label: "Transcript" },
  { id: "notes", label: "Notes" },
  { id: "pulse", label: "AI Pulse" },
  { id: "assistant", label: "AI Assistant" },
  { id: "participants", label: "People" },
  { id: "security", label: "Security" },
  { id: "translate", label: "Translate" },
  { id: "slides", label: "Slides" },
];

function Sidebar({
  open,
  tab,
  onTabChange,
  onClose,
  participants,
  transcript,
  onSendToChat,
  isListening,
}: {
  open: boolean;
  tab: SidebarTab;
  onTabChange: (t: SidebarTab) => void;
  onClose: () => void;
  participants: Participant[];
  transcript: { id: string; speaker: string; text: string; isFinal: boolean; timestamp: string }[];
  onSendToChat: (message: string) => void;
  isListening: boolean;
}) {
  if (!open) return null;
  return (
    <aside
      className="rounded-3xl border border-white/10 bg-slate-900/85 shadow-xl shadow-black/20 overflow-hidden h-[min(70vh,52rem)] flex flex-col"
      role="complementary"
    >
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 border-b border-slate-800/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              tab === t.id
                ? "bg-blue-500/20 text-blue-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            {t.id === "assistant" && isListening && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1.5 -mt-0.5" />
            )}
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors"
          aria-label="Close sidebar"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <ErrorBoundary name="SidebarPanel" fallback={() => <PanelError />}>
          {tab === "chat" && <ChatPanel />}
          {tab === "transcript" && <TranscriptPanel />}
          {tab === "notes" && <NotesPanel />}
          {tab === "pulse" && <PulsePanel />}
          {tab === "assistant" && (
            <AssistantPanel
              transcript={transcript}
              roomType="meeting"
              onSendToChat={onSendToChat}
            />
          )}
          {tab === "participants" && <PeoplePanel participants={participants} />}
          {tab === "security" && <SecurityPanel />}
          {tab === "translate" && <TranslatePanel />}
          {tab === "slides" && <SlidesPanel />}
        </ErrorBoundary>
      </div>
    </aside>
  );
}

function PanelError() {
  return (
    <div className="p-4 text-sm text-amber-300" role="alert">
      This panel is temporarily unavailable. Please try switching tabs.
    </div>
  );
}

// ----------------------------------------------------------------------------
// Duration formatter
// ----------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ----------------------------------------------------------------------------
// Main meet content
// ----------------------------------------------------------------------------

type MeetLiveSessionProps = {
  roomId?: string;
  userId?: string;
  role?: string;
  userName?: string;
};

export default function MeetLiveSession({
  roomId = "—",
  userId,
  role,
  userName,
}: MeetLiveSessionProps) {
  const router = useRouter();
  const media = useMediaStore((s) => s);
  const liveKit = useLiveKitStore((s) => s);

  // Speech transcript (browser SpeechRecognition)
  const {
    transcript: speechTranscript,
    interimText,
    isListening: isTranscriptActive,
    isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechTranscript();

  // Chat state for "Send to Chat" from AI Assistant
  const [chatMessages, setChatMessages] = useState<
    { id: string; sender: string; message: string; timestamp: string }[]
  >([]);

  const sendChatMessage = useCallback((text: string) => {
    const msg = {
      id: Math.random().toString(36).slice(2, 10),
      sender: "AI Assistant",
      message: text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, msg]);
  }, []);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [handRaised, setHandRaised] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // Summary modal — shown when session ends
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const connectedRef = useRef(false);
  const isLeavingRef = useRef(false);

  // Duration timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setMeetingDuration((d) => d + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Start media on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia;
    if (!media.isSupported && !media.mediaError && !media.stream) {
      setMediaState((s) => ({ ...s, isSupported: supported }));
      if (supported) void startMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect to LiveKit when media stream is ready and room ID is valid
  useEffect(() => {
    if (media.stream && roomId && roomId !== "—" && !connectedRef.current) {
      connectedRef.current = true;
      connectToRoom(roomId, media.stream);
    }
    return () => {
      disconnectFromRoom();
      connectedRef.current = false;
    };
  }, [media.stream, roomId]);

  // Start speech transcription once media is active
  useEffect(() => {
    if (media.stream && isSpeechSupported && !isTranscriptActive) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.stream]);

  // Publish screen share track when it changes
  useEffect(() => {
    if (media.screenStream) {
      void publishScreenShareTrack(media.screenStream);
    }
  }, [media.screenStream]);

  // Build full participants list (self + remote)
  const allParticipants: Participant[] = [
    {
      id: "self",
      name: userName || "You",
      avatar: getAvatar(userName || "You"),
      stream: media.stream,
      isSpeaking: false,
      isVideoOn: media.isVideoOn,
      isMuted: media.isMuted,
      audioLevel: media.isMuted ? 0 : 0.04,
    },
    ...liveKit.participants,
  ];

  // Recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    if (!media.stream) return;
    const recorder = new MediaRecorder(media.stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      setRecordedBlob(new Blob(chunks, { type: "video/webm" }));
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [isRecording, media.stream]);

  const downloadRecording = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conferly-recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedBlob]);

  // Reactions
  const addReaction = useCallback((emoji: string) => {
    const id = Math.random().toString(36).slice(2, 8);
    setReactions((r) => [...r, { id, emoji }]);
    setTimeout(() => {
      setReactions((r) => r.filter((rx) => rx.id !== id));
    }, 2000);
  }, []);

  // Leave — generates AI summary from transcript before navigating away
  const handleLeave = useCallback(() => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    stopListening();
    stopMedia();
    disconnectFromRoom();

    const finalEntries = speechTranscript.filter((e) => e.isFinal);
    if (finalEntries.length > 0) {
      setIsSummaryLoading(true);
      setShowSummary(true);

      const fullText = finalEntries
        .map((e) => `[${e.speaker}]: ${e.text}`)
        .join("\n");

      summarizeAction(fullText)
        .then((result) => {
          if (result.status === 'COOLDOWN') {
            setSummaryText(`AI is resting to maintain quality. Back in ${result.retryAfter}s.`);
          } else if (result.status === 'ERROR') {
            setSummaryText(result.error || "Summary could not be generated. The AI service may be unavailable.");
          } else {
            setSummaryText(result.data);
          }
          setIsSummaryLoading(false);
        })
        .catch(() => {
          setSummaryText("Summary could not be generated. The AI service may be unavailable.");
          setIsSummaryLoading(false);
        });
    } else {
      router.push("/dashboard");
    }
  }, [router, speechTranscript, stopListening]);

  // Sidebar helpers
  const handleSidebarTab = useCallback(
    (tab: SidebarTab) => {
      setSidebarTab(tab);
      setSidebarOpen(true);
    },
    [],
  );

  // Media error state
  if (media.mediaError && !media.stream) {
    return (
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <div className="rounded-3xl border border-white/10 bg-slate-900/85 p-10 text-center">
          <p className="text-lg font-semibold text-white mb-2">
            Camera & Microphone Required
          </p>
          <p className="text-sm text-slate-400 mb-6">{media.mediaError}</p>
          <button
            type="button"
            onClick={() => void startMedia()}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 space-y-6">
      {/* Connection status banner */}
      {liveKit.connectionError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          ⚠️ {liveKit.connectionError}
        </div>
      )}

      {/* Video grid + sidebar */}
      <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
        <ErrorBoundary name="VideoGrid" fallback={() => <PanelError />}>
          <div className="rounded-3xl border border-white/10 bg-slate-900/85 shadow-xl shadow-black/20 overflow-hidden min-h-[30rem]">
            <div className="border-b border-white/10 bg-slate-950/90 px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Live meeting
                  </p>
                  <p className="text-sm text-slate-400">
                    Room:{" "}
                    <span className="font-mono text-slate-300">{roomId}</span>
                    {liveKit.connected && (
                      <span className="ml-2 text-green-400">
                        ● Connected
                      </span>
                    )}
                    {!liveKit.connected && !liveKit.connectionError && (
                      <span className="ml-2 text-amber-400">
                        ● Connecting...
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {allParticipants.length} participant
                    {allParticipants.length !== 1 ? "s" : ""}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Video {media.isVideoOn ? "on" : "off"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Mic {media.isMuted ? "muted" : "live"}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-full min-h-[28rem]">
              <VideoGrid
                participants={allParticipants}
                screenStream={media.screenStream}
                handRaised={handRaised}
              />
            </div>
          </div>
        </ErrorBoundary>

        <ErrorBoundary name="Sidebar" fallback={() => <PanelError />}>
          <Sidebar
            open={sidebarOpen}
            tab={sidebarTab}
            onTabChange={handleSidebarTab}
            onClose={() => setSidebarOpen(false)}
            participants={allParticipants}
            transcript={speechTranscript}
            onSendToChat={sendChatMessage}
            isListening={isTranscriptActive}
          />
        </ErrorBoundary>
      </div>

      {/* Live captions with translation overlay */}
      <ErrorBoundary name="CaptionsOverlay" fallback={() => <></>}>
        <CaptionsOverlay
          captions={speechTranscript.filter(e => e.isFinal)}
          interimText={interimText}
          isListening={isTranscriptActive}
        />
      </ErrorBoundary>

      {/* Controls bar */}
      <ErrorBoundary name="ControlsBar" fallback={() => <PanelError />}>
        <MeetingControls
          isMuted={media.isMuted}
          toggleMute={toggleMute}
          isVideoOn={media.isVideoOn}
          toggleVideo={toggleVideo}
          isScreenSharing={media.isScreenSharing}
          toggleScreenShare={() => void toggleScreenShare()}
          isRecording={isRecording}
          toggleRecording={toggleRecording}
          recordedBlob={recordedBlob}
          downloadRecording={downloadRecording}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          sidebarTab={sidebarTab}
          setSidebarTab={handleSidebarTab}
          onLeave={handleLeave}
          meetingDuration={meetingDuration}
          participantCount={allParticipants.length}
          reactions={reactions}
          addReaction={addReaction}
          handRaised={handRaised}
          toggleHandRaise={() => setHandRaised((h) => !h)}
          stopMedia={stopMedia}
          stopListening={stopListening}
        />
      </ErrorBoundary>

      {/* Summary modal — shown when session ends */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="max-w-lg w-full mx-4 rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Meeting Summary</h2>
              <p className="text-xs text-slate-400 mt-1">
                AI-generated summary from your meeting transcript
              </p>
            </div>

            <div className="px-6 py-4 max-h-64 overflow-y-auto">
              {isSummaryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                    <span className="text-sm text-slate-400">Generating summary...</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {summaryText}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
              {!isSummaryLoading && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}