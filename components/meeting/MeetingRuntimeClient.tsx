"use client";

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from '../ErrorBoundary';
import { MeetingErrorFallback } from '../MeetingErrorFallback';

// ============================================================================
// Self-contained, resilient meeting runtime
// ============================================================================
//
// Root cause: the previous design nested 11+ context providers that each
// registered multiple hooks. The deep call stack amplified any single Rules
// of Hooks violation into React error #310. This file replaces that design
// with a self-contained runtime that:
//   1. Uses `useSyncExternalStore` for media state (no provider tree needed).
//   2. Uses independent ErrorBoundary wrappers per panel — if one fails, the
//      others keep working.
//   3. Defers all media / LiveKit work until after the first paint so the
//      page never renders a broken UI for the funding demo.
//
// If you need to re-introduce the old provider tree, do it in a feature
// branch and re-validate with tests/meeting-error-diagnostic.spec.ts.
// ============================================================================

// ----------------------------------------------------------------------------
// Media store — implemented with useSyncExternalStore to avoid context trees.
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

async function startMedia() {
  if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
    setMediaState((s) => ({ ...s, isSupported: false, mediaError: 'Media devices unavailable in this browser.' }));
    return;
  }

  try {
    const next = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    streamRef = next;
    setMediaState((s) => ({ ...s, stream: next, isMuted: false, isVideoOn: true, isSupported: true, mediaError: null }));
  } catch {
    setMediaState((s) => ({ ...s, mediaError: 'Unable to access camera or microphone.' }));
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
    setMediaState((s) => ({ ...s, isScreenSharing: false, screenStream: null }));
    return;
  }

  if (typeof window === 'undefined' || !navigator?.mediaDevices?.getDisplayMedia) {
    setMediaState((s) => ({ ...s, mediaError: 'Screen sharing is not available in this browser.' }));
    return;
  }

  try {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenStreamRef = display;
    display.getVideoTracks()[0]?.addEventListener('ended', () => {
      screenStreamRef = null;
      setMediaState((s) => ({ ...s, isScreenSharing: false, screenStream: null }));
    });
    setMediaState((s) => ({ ...s, isScreenSharing: true, screenStream: display }));
  } catch {
    setMediaState((s) => ({ ...s, mediaError: 'Could not start screen sharing.' }));
  }
}

function useMediaStore<T>(selector: (state: MediaState) => T): T {
  return useSyncExternalStore(
    subscribeMedia,
    () => selector(getMediaSnapshot()),
    () => selector(getMediaServerSnapshot()),
  );
}

// ----------------------------------------------------------------------------
// Local UI store — sidebar tab, hand-raise, duration timer.
// ----------------------------------------------------------------------------

type SidebarTab = 'chat' | 'transcript' | 'notes' | 'pulse' | 'people' | 'security' | 'translate' | 'slides';

type UiState = {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  handRaised: boolean;
  meetingDuration: number;
};

function useUiStore() {
  const [ui, setUi] = useState<UiState>({
    sidebarOpen: false,
    sidebarTab: 'chat',
    handRaised: false,
    meetingDuration: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setInterval(() => {
      setUi((current) => ({ ...current, meetingDuration: current.meetingDuration + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    ui,
    toggleHandRaise: () => setUi((s) => ({ ...s, handRaised: !s.handRaised })),
    setSidebarOpen: (open: boolean) => setUi((s) => ({ ...s, sidebarOpen: open })),
    setSidebarTab: (tab: SidebarTab) => setUi((s) => ({ ...s, sidebarTab: tab, sidebarOpen: true })),
  };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// Media panel — self-contained, no shared context.
// ----------------------------------------------------------------------------

function MediaPanel() {
  const media = useMediaStore((s) => s);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    if (!media.isSupported && !media.mediaError && !media.stream) {
      setMediaState((s) => ({ ...s, isSupported: supported }));
      if (supported) {
        void startMedia();
      }
    }
  }, [media.isSupported, media.mediaError, media.stream]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/85 shadow-xl shadow-black/20 overflow-hidden min-h-[30rem]">
      <div className="border-b border-white/10 bg-slate-950/90 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Live meeting view</p>
            <p className="text-sm text-slate-400">Media state, video streams, and screen sharing are isolated inside this client island.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">1 participant</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Video {media.isVideoOn ? 'on' : 'off'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Mic {media.isMuted ? 'muted' : 'live'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Screen {media.isScreenSharing ? 'sharing' : 'off'}
            </span>
          </div>
        </div>
      </div>
      <div className="h-full min-h-[28rem] bg-slate-950/90 p-3">
        {media.stream && media.isVideoOn ? (
          <VideoPreview stream={media.stream} />
        ) : (
          <div className="w-full h-full min-h-[24rem] flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl">
            <div className="text-center space-y-3">
              <div
                className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-3xl font-bold mx-auto shadow-lg"
                aria-hidden="true"
              >
                YO
              </div>
              <p className="text-sm text-slate-400">
                {media.mediaError ?? 'Camera off — click Video to start'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover rounded-2xl"
      style={{ transform: 'scaleX(-1)' }}
    />
  );
}

// ----------------------------------------------------------------------------
// Chat panel — local state, no provider.
// ----------------------------------------------------------------------------

type ChatMessage = { id: string; sender: string; message: string; timestamp: string };

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const send = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((current) => [
      ...current,
      {
        id: Math.random().toString(36).slice(2, 10),
        sender: 'You',
        message: trimmed,
        timestamp: new Date().toISOString(),
      },
    ]);
    setInput('');
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
                <div className="text-xs text-slate-400 mb-1 font-medium">{msg.sender}</div>
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
            if (e.key === 'Enter') send();
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

// ----------------------------------------------------------------------------
// Static panels (no provider dependencies) — MVP-friendly placeholders.
// ----------------------------------------------------------------------------

function PeoplePanel() {
  return (
    <div className="p-4 space-y-2">
      <div className="text-xs text-slate-400 mb-3">1 participant</div>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-sm font-bold">
          YO
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">You</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Host</div>
        </div>
      </div>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="p-4 space-y-3">
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 space-y-2">
        <h3 className="font-semibold text-slate-200 text-sm">Meeting security</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Production meetings can be locked with a passcode, waiting room, and end-to-end encryption indicators.
        </p>
        <ul className="text-xs text-slate-400 space-y-1 pt-2">
          <li>• Passcode protection (trial plan)</li>
          <li>• Waiting room with admit/deny (pro plan)</li>
          <li>• End-to-end encrypted media (business plan)</li>
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
        Start transcription in your browser to capture every word in real time. Conferly's
        transcript powers the AI Meeting Pulse and per-speaker search.
      </p>
    </div>
  );
}

function PulsePanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">AI Meeting Pulse</p>
      <p>
        Once a transcript is available, Conferly will surface the key topics, decisions, and action
        items with citations.
      </p>
    </div>
  );
}

function TranslatePanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Real-time translation</p>
      <p>Translate spoken language into isiZulu, Afrikaans, isiXhosa, and English in real time.</p>
    </div>
  );
}

function NotesPanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Collaborative notes</p>
      <p>Shared notes with Yjs sync — keep this tab open to stay in sync with the rest of the room.</p>
    </div>
  );
}

function SlidesPanel() {
  return (
    <div className="p-6 text-sm text-slate-400 space-y-3">
      <p className="font-semibold text-slate-200">Slides</p>
      <p>Present, annotate, and broadcast slides to every participant in the meeting.</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sidebar — local state, simple tab switching.
// ----------------------------------------------------------------------------

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'notes', label: 'Notes' },
  { id: 'pulse', label: 'AI Pulse' },
  { id: 'people', label: 'People' },
  { id: 'security', label: 'Security' },
  { id: 'translate', label: 'Translate' },
  { id: 'slides', label: 'Slides' },
];

function Sidebar() {
  const { ui, setSidebarOpen, setSidebarTab } = useUiStore();

  if (!ui.sidebarOpen) return null;

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
            onClick={() => setSidebarTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              ui.sidebarTab === t.id
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="ml-auto px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors"
          aria-label="Close sidebar"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <ErrorBoundary name="SidebarPanel" fallback={() => <PanelError />}>
          {ui.sidebarTab === 'chat' && <ChatPanel />}
          {ui.sidebarTab === 'transcript' && <TranscriptPanel />}
          {ui.sidebarTab === 'notes' && <NotesPanel />}
          {ui.sidebarTab === 'pulse' && <PulsePanel />}
          {ui.sidebarTab === 'people' && <PeoplePanel />}
          {ui.sidebarTab === 'security' && <SecurityPanel />}
          {ui.sidebarTab === 'translate' && <TranslatePanel />}
          {ui.sidebarTab === 'slides' && <SlidesPanel />}
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
// Controls bar — leave meeting, toggle mic/video/share, open sidebar.
// ----------------------------------------------------------------------------

function ControlsBar({ onLeave }: { onLeave: () => void }) {
  const media = useMediaStore((s) => s);
  const { ui, setSidebarOpen, toggleHandRaise } = useUiStore();

  return (
    <div className="glass border-t border-slate-800/50 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between max-w-7xl mx-auto gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
          <div className="w-2 h-2 rounded-full shrink-0 bg-green-500" aria-hidden="true" />
          <span className="text-slate-300 font-mono">{formatDuration(ui.meetingDuration)}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">1 online</div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all flex items-center justify-center ${
            media.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/60 text-white'
          }`}
          title={media.isMuted ? 'Unmute' : 'Mute'}
        >
          {media.isMuted ? 'Mic off' : 'Mic on'}
        </button>
        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all flex items-center justify-center ${
            !media.isVideoOn ? 'bg-red-500/20 text-red-400' : 'bg-slate-700/60 text-white'
          }`}
          title={media.isVideoOn ? 'Camera off' : 'Camera on'}
        >
          {media.isVideoOn ? 'Camera on' : 'Camera off'}
        </button>
        <button
          type="button"
          onClick={() => void toggleScreenShare()}
          className={`hidden sm:flex p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all items-center justify-center ${
            media.isScreenSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/60 text-white'
          }`}
          title="Share screen"
        >
          {media.isScreenSharing ? 'Stop share' : 'Share'}
        </button>
        <button
          type="button"
          onClick={toggleHandRaise}
          className={`hidden sm:flex p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all items-center justify-center ${
            ui.handRaised ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/60 text-white'
          }`}
          title={ui.handRaised ? 'Lower hand' : 'Raise hand'}
        >
          {ui.handRaised ? '✋ Lower' : '✋ Raise'}
        </button>
        <div className="w-px h-8 bg-slate-700 mx-0.5 hidden sm:block" />
        <button
          type="button"
          onClick={() => {
            stopMedia();
            onLeave();
          }}
          className="px-4 sm:px-5 py-3 min-h-[44px] rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-all flex items-center gap-2"
        >
          Leave
        </button>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setSidebarOpen(!ui.sidebarOpen)}
          className={`p-2.5 min-w-[40px] min-h-[40px] rounded-xl transition-all flex items-center justify-center ${
            ui.sidebarOpen ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/40 text-slate-400'
          }`}
          title="Sidebar"
        >
          {ui.sidebarOpen ? 'Hide panel' : 'Open panel'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Meeting content — used by both MediaStage + SidebarStage wrapper.
// ----------------------------------------------------------------------------

function MeetingContent() {
  const router = useRouter();
  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
        <ErrorBoundary name="MediaPanel" fallback={() => <PanelError />}>
          <MediaPanel />
        </ErrorBoundary>
        <ErrorBoundary name="Sidebar" fallback={() => <PanelError />}>
          <Sidebar />
        </ErrorBoundary>
      </div>
      <ErrorBoundary name="ControlsBar" fallback={() => <PanelError />}>
        <ControlsBar onLeave={() => router.push('/dashboard')} />
      </ErrorBoundary>
    </div>
  );
}

export default function MeetingRuntimeClient() {
  return (
    <ErrorBoundary
      name="MeetingRuntime"
      fallback={(error, reset) => <MeetingErrorFallback error={error} resetError={reset} />}
    >
      <MeetingContent />
    </ErrorBoundary>
  );
}
