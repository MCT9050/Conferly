"use client";

import Sidebar from '../Sidebar';
import { useMeetingChat } from './state/chatStore';
import { useMeetingParticipants } from './state/participantStore';
import { useMeetingTranscript } from './state/transcriptStore';
import { useMeetingUi } from './state/uiStore';
import { useMeetingPulse } from './state/pulseStore';
import { useMeetingSecurity } from './state/securityStore';
import { useMeetingTranslation } from './state/translationStore';
import { useMeetingPresentation } from './state/presentationStore';
import { useMeetingRoom } from './state/roomStore';

export default function MeetingSidebarStage() {
  const { sidebarOpen, sidebarTab, setSidebarOpen, setSidebarTab } = useMeetingUi();
  const { participants } = useMeetingParticipants();
  const transcriptState = useMeetingTranscript();
  const { chatMessages, sendChatMessage } = useMeetingChat();
  const pulseState = useMeetingPulse();
  const securityState = useMeetingSecurity();
  const translationState = useMeetingTranslation();
  const presentation = useMeetingPresentation();
  const room = useMeetingRoom();

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/85 shadow-xl shadow-black/20 overflow-hidden h-[min(70vh,52rem)]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        tab={sidebarTab}
        setTab={setSidebarTab}
        participants={participants}
        transcript={transcriptState.transcript}
        interimText={transcriptState.interimText}
        isListening={transcriptState.isListening}
        isSpeechSupported={transcriptState.isSpeechSupported}
        startListening={transcriptState.startListening}
        stopListening={transcriptState.stopListening}
        chatMessages={chatMessages}
        sendChatMessage={sendChatMessage}
        roomId={room.roomId}
        pulseSummary={pulseState.pulseSummary}
        isPulseLoading={pulseState.isPulseLoading}
        pulseTopics={pulseState.pulseTopics}
        generatePulse={pulseState.generatePulse}
        security={securityState.security}
        isHost={securityState.isHost}
        limits={securityState.limits}
        planTier={securityState.planTier}
        onSetPassword={securityState.onSetPassword}
        onToggleLock={securityState.onToggleLock}
        onToggleWaitingRoom={securityState.onToggleWaitingRoom}
        onAdmit={securityState.onAdmit}
        onDeny={securityState.onDeny}
        onOpenPricing={securityState.onOpenPricing}
        translations={translationState.translations}
        isTranslating={translationState.isTranslating}
        translationError={translationState.translationError}
        translationSourceLang={translationState.translationSourceLang}
        translationTargetLang={translationState.translationTargetLang}
        translationAutoDetect={translationState.translationAutoDetect}
        translationLanguages={translationState.translationLanguages}
        onSetTranslationSource={translationState.onSetTranslationSource}
        onSetTranslationTarget={translationState.onSetTranslationTarget}
        onSetTranslationAutoDetect={translationState.onSetTranslationAutoDetect}
        onTranslate={translationState.onTranslate}
        onTranslateBatch={translationState.onTranslateBatch}
        onClearTranslations={translationState.onClearTranslations}
        presSlides={presentation.slides}
        presCurrentIndex={presentation.currentIndex}
        presGoTo={presentation.goToSlide}
        presAddSlide={presentation.addSlide}
        presUpdateSlide={presentation.updateSlide}
        presDeleteSlide={presentation.deleteSlide}
        presReorderSlide={presentation.reorderSlide}
        presStartPresentation={presentation.startPresentation}
      />
    </div>
  );
}
