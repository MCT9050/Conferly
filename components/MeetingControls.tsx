"use client";

import { useState, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, MessageSquare, Users,
  Hand, PanelRightOpen, PanelRightClose,
  Circle, Square, Download, MoreHorizontal
} from 'lucide-react';
import type { SidebarTab, Reaction } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

interface MeetingControlsProps {
  isMuted: boolean;
  toggleMute: () => void;
  isVideoOn: boolean;
  toggleVideo: () => void;
  isScreenSharing: boolean;
  toggleScreenShare: () => void;
  isRecording: boolean;
  toggleRecording: () => void;
  recordedBlob: Blob | null;
  downloadRecording: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (t: SidebarTab) => void;
  onLeave: () => void;
  meetingDuration: number;
  participantCount: number;
  reactions: Reaction[];
  addReaction: (emoji: string) => void;
  handRaised: boolean;
  toggleHandRaise: () => void;
  stopMedia: () => void;
  stopListening: () => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🤔', '👏'];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MeetingControls({
  isMuted, toggleMute, isVideoOn, toggleVideo,
  isScreenSharing, toggleScreenShare,
  isRecording, toggleRecording,
  recordedBlob, downloadRecording,
  sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab,
  onLeave, meetingDuration, participantCount,
  reactions, addReaction,
  handRaised, toggleHandRaise,
  stopMedia, stopListening,
}: MeetingControlsProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close pickers on outside click
  useClickOutside(reactionsRef, () => showReactions && setShowReactions(false));
  useClickOutside(moreRef, () => showMore && setShowMore(false));

  const openSidebarTab = (tab: SidebarTab) => {
    if (sidebarOpen && sidebarTab === tab) setSidebarOpen(false);
    else { setSidebarTab(tab); setSidebarOpen(true); }
  };

  const handleLeave = () => { stopMedia(); stopListening(); onLeave(); };

  const btnBase = "p-3 min-w-[44px] min-h-[44px] rounded-xl transition-all flex items-center justify-center";
  const btnOff = `${btnBase} bg-slate-700/60 text-white active:bg-slate-600/60`;

  return (
    <div className="glass border-t border-slate-800/50 px-3 sm:px-4 py-2 sm:py-3 relative" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      {/* Floating reactions */}
      <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        {reactions.map(r => (
          <div key={r.id} className="text-2xl animate-bounce" style={{ animationDuration: '0.6s' }}>{r.emoji}</div>
        ))}
      </div>

      {/* Reaction picker */}
      {showReactions && (
        <div ref={reactionsRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl glass flex gap-1.5 z-20">
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => { addReaction(emoji); setShowReactions(false); }} className="text-xl hover:scale-125 transition-transform p-1 min-w-[40px] min-h-[40px] flex items-center justify-center">
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* More menu (mobile overflow) */}
      {showMore && (
        <div ref={moreRef} className="absolute bottom-full right-2 mb-2 glass rounded-xl p-2 z-20 space-y-1 min-w-[180px]">
          <button onClick={() => { toggleScreenShare(); setShowMore(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 active:bg-slate-800/40">
            {isScreenSharing ? <MonitorOff className="w-4 h-4 text-blue-400" /> : <Monitor className="w-4 h-4" />}
            {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          </button>
          <button onClick={() => { toggleRecording(); setShowMore(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 active:bg-slate-800/40">
            {isRecording ? <Square className="w-4 h-4 text-red-400" /> : <Circle className="w-4 h-4" />}
            {isRecording ? 'Stop Recording' : 'Record'}
          </button>
          <button onClick={() => { setShowReactions(!showReactions); setShowMore(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 active:bg-slate-800/40">
            <span className="text-base">😀</span>
            Reactions
          </button>
          <button onClick={() => { toggleHandRaise(); setShowMore(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 active:bg-slate-800/40">
            <Hand className={`w-4 h-4 ${handRaised ? 'text-amber-400' : ''}`} />
            {handRaised ? 'Lower Hand' : 'Raise Hand'}
          </button>
          {recordedBlob && !isRecording && (
            <button onClick={() => { downloadRecording(); setShowMore(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-green-400 active:bg-slate-800/40">
              <Download className="w-4 h-4" />
              Download Recording
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between max-w-7xl mx-auto gap-2">
        {/* Left — duration + count */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-slate-300 font-mono">{formatDuration(meetingDuration)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" />{participantCount}
          </div>
        </div>

        {/* Center — controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mute — always visible */}
          <button onClick={toggleMute} className={isMuted ? `${btnBase} bg-red-500/20 text-red-400 active:bg-red-500/30` : btnOff} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video — always visible */}
          <button onClick={toggleVideo} className={!isVideoOn ? `${btnBase} bg-red-500/20 text-red-400 active:bg-red-500/30` : btnOff} title={isVideoOn ? 'Camera off' : 'Camera on'}>
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen share — desktop only */}
          <button onClick={toggleScreenShare} className={`hidden sm:flex ${isScreenSharing ? `${btnBase} bg-blue-500/20 text-blue-400` : btnOff}`} title="Share screen">
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Record — desktop only */}
          <button onClick={toggleRecording} className={`hidden sm:flex ${isRecording ? `${btnBase} bg-red-500/20 text-red-400` : btnOff}`} title={isRecording ? 'Stop recording' : 'Record'}>
            {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>

          {/* Reactions — desktop only */}
          <button onClick={() => setShowReactions(!showReactions)} className={`hidden md:flex ${btnOff} text-lg`} title="Reactions">😀</button>

          {/* Hand — desktop only */}
          <button onClick={toggleHandRaise} className={`hidden md:flex ${handRaised ? `${btnBase} bg-amber-500/20 text-amber-400` : btnOff}`} title={handRaised ? 'Lower hand' : 'Raise hand'}>
            <Hand className="w-5 h-5" />
          </button>

          {/* More menu — mobile only, shows hidden controls */}
          <button onClick={() => setShowMore(!showMore)} className={`sm:hidden ${btnOff}`} title="More options">
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Leave */}
          <button onClick={handleLeave} className="px-4 sm:px-5 py-3 min-h-[44px] rounded-xl bg-red-600 text-white font-medium active:bg-red-500 transition-all flex items-center gap-2">
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Right — sidebar toggles */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => openSidebarTab('chat')} className={`p-2.5 min-w-[40px] min-h-[40px] rounded-xl transition-all flex items-center justify-center ${sidebarOpen && sidebarTab === 'chat' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/40 text-slate-400 active:text-white'}`} title="Chat">
            <MessageSquare className="w-4 h-4" />
          </button>
          <button onClick={() => { setSidebarOpen(!sidebarOpen); if (!sidebarOpen) setSidebarTab('chat'); }} className={`p-2.5 min-w-[40px] min-h-[40px] rounded-xl transition-all flex items-center justify-center ${sidebarOpen ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/40 text-slate-400 active:text-white'}`} title="Sidebar">
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
