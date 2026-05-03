import { useEffect } from 'react';
import { Shield, Zap, Wifi, Users, Lock, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import VideoGrid from './VideoGrid';
import MeetingControls from './MeetingControls';
import Sidebar from './Sidebar';
import PresentationView from './PresentationView';
import type { Participant, TranscriptEntry, ChatMessage, SidebarTab, AppView, Reaction, MeetingSecurity, PlanLimits, PlanTier } from '../types';
import type { SALanguage, TranslationResult } from '../hooks/useTranslation';
import type { usePresentation } from '../hooks/usePresentation';
import Logo from './Logo';

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  participants: Participant[];
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  startMedia: () => Promise<MediaStream | null>;
  stopMedia: () => void;
  transcript: TranscriptEntry[];
  interimText: string;
  isListening: boolean;
  isSpeechSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatMessages: ChatMessage[];
  sendChatMessage: (text: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (t: SidebarTab) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isVideoOn: boolean;
  toggleVideo: () => void;
  isScreenSharing: boolean;
  toggleScreenShare: () => void;
  isRecording: boolean;
  toggleRecording: () => void;
  downloadRecording: () => void;
  recordedBlob: Blob | null;
  meetingDuration: number;
  setMeetingDuration: React.Dispatch<React.SetStateAction<number>>;
  pulseSummary: string[];
  isPulseLoading: boolean;
  pulseTopics: string[];
  generatePulse: () => void;
  setView: (v: AppView) => void;
  audioLevel: number;
  reactions: Reaction[];
  addReaction: (emoji: string) => void;
  handRaised: boolean;
  toggleHandRaise: () => void;
  // Security & Plan
  security: MeetingSecurity;
  isHost: boolean;
  planLimits: PlanLimits;
  planTier: PlanTier;
  onSetPassword: (pwd: string | null) => void;
  onToggleLock: () => void;
  onToggleWaitingRoom: () => void;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
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
  // Duration limits
  minutesRemaining: number;
  isDurationWarning: boolean;
  isDurationExpired: boolean;
  // Presentation
  presentation: ReturnType<typeof usePresentation>;
}

export default function MeetingRoom(props: MeetingRoomProps) {
  useEffect(() => {
    if (!props.stream) {
      props.startMedia();
    }
  }, [props.stream, props.startMedia]);

  useEffect(() => {
    if (props.isSpeechSupported && !props.isListening) {
      props.startListening();
    }
    return () => { props.stopListening(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      props.setMeetingDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [props.setMeetingDuration]);

  return (
    <div className="h-screen h-[100dvh] flex flex-col">
      {/* Top Bar */}
      <div className="glass border-b border-slate-800/50 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shrink-0">
          <Logo size="sm" />
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile: compact status icons only */}
          <div className="flex md:hidden items-center gap-2 text-xs">
            <ShieldCheck className={`w-3.5 h-3.5 ${props.stream ? 'text-green-400' : 'text-yellow-400'}`} />
            {props.security.isLocked && <Lock className="w-3.5 h-3.5 text-red-400" />}
            <span className="flex items-center gap-1 text-slate-400">
              <Users className="w-3 h-3" />{props.participants.length}
            </span>
          </div>
          {/* Desktop: full status labels */}
          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-400" />E2E</span>
            {props.security.isLocked && <span className="flex items-center gap-1.5 text-red-400"><Lock className="w-3.5 h-3.5" />Locked</span>}
            {props.security.password && <span className="flex items-center gap-1.5 text-amber-400"><Shield className="w-3.5 h-3.5" />Password</span>}
            <span className="flex items-center gap-1.5"><Wifi className={`w-3.5 h-3.5 ${props.stream ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`} />{props.stream ? 'Connected' : 'Connecting…'}</span>
            <span className="flex items-center gap-1.5"><Zap className={`w-3.5 h-3.5 ${props.isListening ? 'text-green-400' : 'text-slate-600'}`} />{props.isListening ? 'Transcribing' : 'Off'}</span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-blue-400" />{props.participants.length}</span>
          </div>
          <code className="text-[10px] sm:text-xs text-slate-400 font-mono bg-slate-800/40 px-2 sm:px-3 py-1 rounded-lg hidden sm:block">{props.roomId}</code>
        </div>
      </div>

      {/* Duration warning */}
      {props.isDurationExpired && (
        <div className="px-3 sm:px-4 py-2 bg-red-500/15 border-b border-red-500/20 flex flex-wrap items-center justify-center gap-2 sm:gap-3 shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs sm:text-sm text-red-400 font-medium">Time limit reached</span>
          <button onClick={() => props.setView('pricing')} className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 text-[10px] sm:text-xs font-medium">Upgrade</button>
        </div>
      )}
      {props.isDurationWarning && !props.isDurationExpired && (
        <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-center gap-2 shrink-0">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] sm:text-xs text-amber-400">{props.minutesRemaining}min remaining</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <VideoGrid participants={props.participants} screenStream={props.screenStream} handRaised={props.handRaised} />
        </div>

        <Sidebar
          isOpen={props.sidebarOpen}
          onClose={() => props.setSidebarOpen(false)}
          tab={props.sidebarTab}
          setTab={props.setSidebarTab}
          participants={props.participants}
          transcript={props.transcript}
          interimText={props.interimText}
          isListening={props.isListening}
          isSpeechSupported={props.isSpeechSupported}
          startListening={props.startListening}
          stopListening={props.stopListening}
          chatMessages={props.chatMessages}
          sendChatMessage={props.sendChatMessage}
          roomId={props.roomId}
          pulseSummary={props.pulseSummary}
          isPulseLoading={props.isPulseLoading}
          pulseTopics={props.pulseTopics}
          generatePulse={props.generatePulse}
          security={props.security}
          isHost={props.isHost}
          limits={props.planLimits}
          planTier={props.planTier}
          onSetPassword={props.onSetPassword}
          onToggleLock={props.onToggleLock}
          onToggleWaitingRoom={props.onToggleWaitingRoom}
          onAdmit={props.onAdmit}
          onDeny={props.onDeny}
          onOpenPricing={() => props.setView('pricing')}
          translations={props.translations}
          isTranslating={props.isTranslating}
          translationError={props.translationError}
          translationSourceLang={props.translationSourceLang}
          translationTargetLang={props.translationTargetLang}
          translationAutoDetect={props.translationAutoDetect}
          translationLanguages={props.translationLanguages}
          onSetTranslationSource={props.onSetTranslationSource}
          onSetTranslationTarget={props.onSetTranslationTarget}
          onSetTranslationAutoDetect={props.onSetTranslationAutoDetect}
          onTranslate={props.onTranslate}
          onTranslateBatch={props.onTranslateBatch}
          onClearTranslations={props.onClearTranslations}
          presSlides={props.presentation.slides}
          presCurrentIndex={props.presentation.currentIndex}
          presGoTo={props.presentation.goToSlide}
          presAddSlide={props.presentation.addSlide}
          presUpdateSlide={props.presentation.updateSlide}
          presDeleteSlide={props.presentation.deleteSlide}
          presReorderSlide={props.presentation.reorderSlide}
          presStartPresentation={props.presentation.startPresentation}
        />
      </div>

      {/* Controls */}
      <MeetingControls
        isMuted={props.isMuted}
        toggleMute={props.toggleMute}
        isVideoOn={props.isVideoOn}
        toggleVideo={props.toggleVideo}
        isScreenSharing={props.isScreenSharing}
        toggleScreenShare={props.toggleScreenShare}
        isRecording={props.isRecording}
        toggleRecording={props.toggleRecording}
        recordedBlob={props.recordedBlob}
        downloadRecording={props.downloadRecording}
        sidebarOpen={props.sidebarOpen}
        setSidebarOpen={props.setSidebarOpen}
        sidebarTab={props.sidebarTab}
        setSidebarTab={props.setSidebarTab}
        setView={props.setView}
        meetingDuration={props.meetingDuration}
        participantCount={props.participants.length}
        reactions={props.reactions}
        addReaction={props.addReaction}
        handRaised={props.handRaised}
        toggleHandRaise={props.toggleHandRaise}
        stopMedia={props.stopMedia}
        stopListening={props.stopListening}
      />

      {/* Presentation overlay */}
      <PresentationView
        slide={props.presentation.currentSlide}
        currentIndex={props.presentation.currentIndex}
        totalSlides={props.presentation.totalSlides}
        isPresenting={props.presentation.isPresenting}
        showPresenterNotes={props.presentation.showPresenterNotes}
        annotations={props.presentation.annotations}
        isDrawing={props.presentation.isDrawing}
        drawColor={props.presentation.drawColor}
        laser={props.presentation.laser}
        laserEnabled={props.presentation.laserEnabled}
        onNext={props.presentation.nextSlide}
        onPrev={props.presentation.prevSlide}
        onStop={props.presentation.stopPresentation}
        onGoTo={props.presentation.goToSlide}
        onToggleNotes={() => props.presentation.setShowPresenterNotes(!props.presentation.showPresenterNotes)}
        onToggleDraw={() => props.presentation.setIsDrawing(!props.presentation.isDrawing)}
        onToggleLaser={() => props.presentation.setLaserEnabled(!props.presentation.laserEnabled)}
        onSetDrawColor={props.presentation.setDrawColor}
        onStartStroke={props.presentation.startStroke}
        onContinueStroke={props.presentation.continueStroke}
        onEndStroke={props.presentation.endStroke}
        onClearAnnotations={props.presentation.clearAnnotations}
        onUndoAnnotation={props.presentation.undoAnnotation}
        onMoveLaser={props.presentation.moveLaser}
        onHideLaser={props.presentation.hideLaser}
      />
    </div>
  );
}
