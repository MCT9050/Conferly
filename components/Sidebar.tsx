"use client";

import { memo, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  X, MessageSquare, FileText, Brain, Users,
  Send, Mic, MicOff, Sparkles, Loader2,
  CheckCircle2, AlertCircle, Edit3, Tag, MicIcon, ShieldCheck, Languages, Presentation
} from 'lucide-react';
import type { Participant, TranscriptEntry, ChatMessage, SidebarTab, MeetingSecurity, PlanLimits, PlanTier } from '../types';
import type { SALanguage, TranslationResult } from '../hooks/useTranslation';
import type { Slide } from '../hooks/usePresentation';

const CollaborativeEditor = dynamic(() => import('./CollaborativeEditor'), {
  ssr: false,
  loading: () => <div className="p-4 text-slate-400 text-sm">Loading collaboration tools…</div>,
});

const SecurityPanel = dynamic(() => import('./SecurityPanel'), {
  ssr: false,
  loading: () => <div className="p-4 text-slate-400 text-sm">Loading security settings…</div>,
});

const TranslationPanel = dynamic(() => import('./TranslationPanel'), {
  ssr: false,
  loading: () => <div className="p-4 text-slate-400 text-sm">Loading translation tools…</div>,
});

const SlideEditor = dynamic(() => import('./SlideEditor'), {
  ssr: false,
  loading: () => <div className="p-4 text-slate-400 text-sm">Loading slide editor…</div>,
});

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  tab: SidebarTab;
  setTab: (t: SidebarTab) => void;
  participants: Participant[];
  transcript: TranscriptEntry[];
  interimText: string;
  isListening: boolean;
  isSpeechSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatMessages: ChatMessage[];
  sendChatMessage: (text: string) => void;
  roomId: string;
  pulseSummary: string[];
  isPulseLoading: boolean;
  pulseTopics: string[];
  generatePulse: () => void;
  // Security
  security: MeetingSecurity;
  isHost: boolean;
  limits: PlanLimits;
  planTier: PlanTier;
  onSetPassword: (pwd: string | null) => void;
  onToggleLock: () => void;
  onToggleWaitingRoom: () => void;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onOpenPricing: () => void;
  // Translation
  translations: TranslationResult[];
  isTranslating: boolean;
  translationError: string | null;
  translationSourceLang: SALanguage;
  translationTargetLang: SALanguage;
  translationAutoDetect: boolean;
  translationLanguages: SALanguage[];
  onSetTranslationSource: (lang: SALanguage) => void;
  onSetTranslationTarget: (lang: SALanguage) => void;
  onSetTranslationAutoDetect: (v: boolean) => void;
  onTranslate: (text: string, speaker?: string) => Promise<TranslationResult | null>;
  onTranslateBatch: (entries: { text: string; speaker?: string }[]) => Promise<TranslationResult[]>;
  onClearTranslations: () => void;
  // Presentation
  presSlides: Slide[];
  presCurrentIndex: number;
  presGoTo: (i: number) => void;
  presAddSlide: (type: Slide['type'], afterIndex?: number) => void;
  presUpdateSlide: (id: string, updates: Partial<Slide>) => void;
  presDeleteSlide: (id: string) => void;
  presReorderSlide: (from: number, to: number) => void;
  presStartPresentation: (fromSlide?: number) => void;
}

const TABS: { id: SidebarTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'transcript', label: 'Transcript', icon: FileText },
  { id: 'notes', label: 'Notes', icon: Edit3 },
  { id: 'pulse', label: 'AI Pulse', icon: Brain },
  { id: 'participants', label: 'People', icon: Users },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'translate', label: 'Translate', icon: Languages },
  { id: 'slides', label: 'Slides', icon: Presentation },
];

const ChatPanel = memo(function ChatPanel({ messages, sendMessage }: { messages: ChatMessage[]; sendMessage: (t: string) => void }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-12">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`${msg.sender === 'You' ? 'ml-6' : 'mr-6'}`}>
            <div className={`rounded-2xl px-4 py-2.5 ${
              msg.sender === 'You'
                ? 'bg-blue-600/20 border border-blue-500/20 ml-auto'
                : 'bg-slate-800/60 border border-slate-700/30'
            }`}>
              <div className="text-xs text-slate-400 mb-1 font-medium">{msg.sender}</div>
              <div className="text-sm text-slate-200">{msg.message}</div>
              <div className="text-[10px] text-slate-500 mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/30 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

const TranscriptPanel = memo(function TranscriptPanel({
  transcript, interimText, isListening, isSpeechSupported, startListening, stopListening,
}: {
  transcript: TranscriptEntry[];
  interimText: string;
  isListening: boolean;
  isSpeechSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length, interimText]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-800/30">
        {isSpeechSupported ? (
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 text-xs ${isListening ? 'text-green-400' : 'text-slate-500'}`}>
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
              {isListening ? 'Live Transcription Active' : 'Transcription Paused'}
            </div>
            <button
              onClick={isListening ? stopListening : startListening}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                isListening
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              {isListening ? 'Stop' : 'Start'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            Speech recognition not supported in this browser. Try Chrome.
          </div>
        )}
      </div>

      {/* Transcript entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcript.length === 0 && !interimText && (
          <div className="text-center text-sm text-slate-500 py-12">
            <MicIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
            {isListening ? 'Listening… Speak to see your words appear here.' : 'Start transcription to capture speech.'}
          </div>
        )}
        {transcript.map(entry => (
          <div key={entry.id} className="group">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-blue-400">{entry.speaker}</span>
              <span className="text-[10px] text-slate-400">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{entry.text}</p>
          </div>
        ))}

        {/* Interim (partial) text */}
        {interimText && (
          <div className="group opacity-60">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-blue-400">You</span>
              <span className="text-[10px] text-slate-400">speaking…</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed italic">{interimText}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
});

const PulsePanel = memo(function PulsePanel({
  summary, isLoading, topics, onGenerate, transcriptCount,
}: {
  summary: string[];
  isLoading: boolean;
  topics: string[];
  onGenerate: () => void;
  transcriptCount: number;
}) {
  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      <div className="glass-light rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-semibold">AI Meeting Pulse</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Extracts key topics via TF-IDF scoring and ranks the most important sentences from your live transcript.
        </p>
        <button
          onClick={onGenerate}
          disabled={isLoading || transcriptCount === 0}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium flex items-center justify-center gap-2 hover:from-purple-500 hover:to-pink-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing transcript…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Meeting Pulse
            </>
          )}
        </button>
        {transcriptCount === 0 && (
          <p className="text-[10px] text-slate-500 text-center">
            Start transcription and speak to generate a summary.
          </p>
        )}
      </div>

      {summary.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Extracted from {transcriptCount} transcript entries
          </div>
          {summary.map((point, i) => (
            <div key={i} className="glass-light rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{point}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {topics.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Tag className="w-3.5 h-3.5" />
            Top Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topics.map(topic => (
              <span key={topic} className="px-2.5 py-1 rounded-full bg-slate-800/60 text-xs text-slate-300 border border-slate-700/40">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function ParticipantsPanel({ participants }: { participants: Participant[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <div className="text-xs text-slate-400 mb-3">{participants.length} participant{participants.length !== 1 ? 's' : ''}</div>
      {participants.map(p => (
        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/40 transition-colors">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-sm font-bold">
            {p.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {p.name}
              {p.id === 'self' && <span className="text-xs text-slate-500 ml-1">(You)</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {p.isSpeaking && (
                <span className="text-[10px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Speaking
                </span>
              )}
              {!p.isVideoOn && (
                <span className="text-[10px] text-slate-500">Camera off</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {p.isMuted ? (
              <MicOff className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({
  isOpen, onClose, tab, setTab,
  participants, transcript, interimText,
  isListening, isSpeechSupported, startListening, stopListening,
  chatMessages, sendChatMessage,
  roomId,
  pulseSummary, isPulseLoading, pulseTopics, generatePulse,
  security, isHost, limits, planTier,
  onSetPassword, onToggleLock, onToggleWaitingRoom,
  onAdmit, onDeny, onOpenPricing,
  translations, isTranslating, translationError,
  translationSourceLang, translationTargetLang, translationAutoDetect, translationLanguages,
  onSetTranslationSource, onSetTranslationTarget, onSetTranslationAutoDetect,
  onTranslate, onTranslateBatch, onClearTranslations,
  presSlides, presCurrentIndex, presGoTo, presAddSlide, presUpdateSlide,
  presDeleteSlide, presReorderSlide, presStartPresentation,
}: SidebarProps) {
  return (
    <div
      className={`sidebar-transition h-full flex flex-col glass border-l border-slate-800/50 ${
        isOpen ? 'w-full sm:w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                tab === t.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
              title={t.label}
            >
              <t.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 sm:inline sm:mr-1.5 sm:-mt-0.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'chat' && <ChatPanel messages={chatMessages} sendMessage={sendChatMessage} />}
        {tab === 'transcript' && (
          <TranscriptPanel
            transcript={transcript}
            interimText={interimText}
            isListening={isListening}
            isSpeechSupported={isSpeechSupported}
            startListening={startListening}
            stopListening={stopListening}
          />
        )}
        {tab === 'notes' && <CollaborativeEditor roomId={roomId} />}
        {tab === 'pulse' && (
          <PulsePanel
            summary={pulseSummary}
            isLoading={isPulseLoading}
            topics={pulseTopics}
            onGenerate={generatePulse}
            transcriptCount={transcript.filter(t => t.isFinal).length}
          />
        )}
        {tab === 'participants' && <ParticipantsPanel participants={participants} />}
        {tab === 'security' && (
          <SecurityPanel
            security={security}
            isHost={isHost}
            limits={limits}
            planTier={planTier}
            onSetPassword={onSetPassword}
            onToggleLock={onToggleLock}
            onToggleWaitingRoom={onToggleWaitingRoom}
            onAdmit={onAdmit}
            onDeny={onDeny}
            onOpenPricing={onOpenPricing}
          />
        )}
        {tab === 'translate' && (
          <TranslationPanel
            translations={translations}
            isTranslating={isTranslating}
            error={translationError}
            sourceLang={translationSourceLang}
            targetLang={translationTargetLang}
            autoDetect={translationAutoDetect}
            languages={translationLanguages}
            onSetSourceLang={onSetTranslationSource}
            onSetTargetLang={onSetTranslationTarget}
            onSetAutoDetect={onSetTranslationAutoDetect}
            onTranslate={onTranslate}
            onTranslateTranscript={onTranslateBatch}
            onClear={onClearTranslations}
            transcript={transcript}
          />
        )}
        {tab === 'slides' && (
          <SlideEditor
            slides={presSlides}
            currentIndex={presCurrentIndex}
            onGoTo={presGoTo}
            onAdd={presAddSlide}
            onUpdate={presUpdateSlide}
            onDelete={presDeleteSlide}
            onReorder={presReorderSlide}
            onStartPresentation={presStartPresentation}
          />
        )}
      </div>
    </div>
  );
}
