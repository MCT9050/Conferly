import { useAppState } from './store';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Lobby from './components/Lobby';
import MeetingRoom from './components/MeetingRoom';
import PricingPage from './components/PricingPage';
import InstallBanner from './components/InstallBanner';
import OnboardingPage from './components/OnboardingPage';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

export default function App() {
  const s = useAppState();
  const pwa = useInstallPrompt();

  const installBanner = (
    <InstallBanner
      show={pwa.showBanner}
      isIOS={pwa.isIOS}
      canInstallNatively={pwa.canInstallNatively}
      onInstall={pwa.install}
      onDismiss={pwa.dismiss}
    />
  );

  if (s.authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size="xl" />
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!s.isAuthenticated) {
    if (s.view === 'welcome') {
      return (
        <>
          <LandingPage
            setView={s.setView} roomId={s.roomId} setRoomId={s.setRoomId}
            userName={s.userName} setUserName={s.setUserName}
            profile={null} isOfflineMode={false}
            onSignOut={() => {}} onUpdateName={async () => ({ success: false })}
          />
          {installBanner}
        </>
      );
    }
    return (
      <>
        <AuthPage onSignUp={s.signUp} onSignIn={s.signIn} error={s.authError} clearError={s.clearAuthError} loading={s.authLoading} />
        {installBanner}
      </>
    );
  }

  // Authenticated — check onboarding
  if (s.authProfile && !s.authProfile.onboardingComplete) {
    return (
      <>
        <OnboardingPage
          displayName={s.authProfile.displayName}
          onComplete={s.completeOnboarding}
        />
        {installBanner}
      </>
    );
  }

  if (s.view === 'pricing') {
    return (
      <>
        <PricingPage
          setView={s.setView} subscription={s.subscription}
          pricing={s.planPricing} allLimits={s.allPlanLimits}
          onUpgrade={s.upgradePlan}
          onStartCheckout={(tier, cycle) => {
            s.startCheckout(
              tier, cycle,
              s.authProfile?.email || '',
              s.authProfile?.displayName || '',
              s.authProfile?.id || '',
              1,
            );
          }}
          paymentProcessing={s.paymentProcessing}
          paymentError={s.paymentError}
          paymentResult={s.paymentResult}
          isPeachConfigured={s.isPeachConfigured}
          planPricesZAR={s.planPricesZAR}
          clearPaymentError={s.clearPaymentError}
          clearPaymentResult={s.clearPaymentResult}
        />
        {installBanner}
      </>
    );
  }

  if (s.view === 'welcome' || s.view === 'dashboard') {
    return (
      <>
        <Dashboard
          setView={s.setView} roomId={s.roomId} setRoomId={s.setRoomId}
          userName={s.userName} setUserName={s.setUserName}
          profile={s.authProfile!} subscription={s.subscription} planLimits={s.planLimits}
          isOfflineMode={s.isOfflineMode} onSignOut={s.signOut} onUpdateName={s.updateDisplayName}
          meetingHistory={s.meetingHistory}
          pendingReconnect={s.pendingReconnect}
          onReconnect={s.reconnectToMeeting}
          onDismissReconnect={s.dismissReconnect}
          meetingsThisMonth={s.meetingsThisMonth}
          meetingLimitReached={s.meetingLimitReached}
          maxMeetingsPerMonth={s.maxMeetingsPerMonth}
        />
        {installBanner}
      </>
    );
  }

  if (s.view === 'lobby') {
    return (
      <>
        <Lobby
          roomId={s.roomId} userName={s.authProfile?.displayName || s.userName}
          setView={s.setView} stream={s.stream} startMedia={s.startMedia}
          isMuted={s.isMuted} toggleMute={s.toggleMute}
          isVideoOn={s.isVideoOn} toggleVideo={s.toggleVideo}
          audioLevel={s.audioLevel} mediaError={s.mediaError}
        />
        {installBanner}
      </>
    );
  }

  return (
    <>
      <MeetingRoom
        roomId={s.roomId} userName={s.authProfile?.displayName || s.userName}
        participants={s.participants} stream={s.stream} screenStream={s.screenStream}
        startMedia={s.startMedia} stopMedia={s.stopMedia}
        transcript={s.transcript} interimText={s.interimText}
        isListening={s.isListening} isSpeechSupported={s.isSpeechSupported}
        startListening={s.startListening} stopListening={s.stopListening}
        chatMessages={s.chatMessages} sendChatMessage={s.sendChatMessage}
        sidebarOpen={s.sidebarOpen} setSidebarOpen={s.setSidebarOpen}
        sidebarTab={s.sidebarTab} setSidebarTab={s.setSidebarTab}
        isMuted={s.isMuted} toggleMute={s.toggleMute}
        isVideoOn={s.isVideoOn} toggleVideo={s.toggleVideo}
        isScreenSharing={s.isScreenSharing} toggleScreenShare={s.toggleScreenShare}
        isRecording={s.isRecording} toggleRecording={s.toggleRecording}
        downloadRecording={s.downloadRecording} recordedBlob={s.recordedBlob}
        meetingDuration={s.meetingDuration} setMeetingDuration={s.setMeetingDuration}
        pulseSummary={s.pulseSummary} isPulseLoading={s.isPulseLoading}
        pulseTopics={s.pulseTopics} generatePulse={s.generatePulse}
        setView={s.setView} audioLevel={s.audioLevel}
        reactions={s.reactions} addReaction={s.addReaction}
        handRaised={s.handRaised} toggleHandRaise={s.toggleHandRaise}
        security={s.security} isHost={s.isHost}
        planLimits={s.planLimits} planTier={s.subscription.tier}
        onSetPassword={s.setMeetingPassword} onToggleLock={s.toggleMeetingLock}
        onToggleWaitingRoom={s.toggleWaitingRoom}
        onAdmit={s.admitFromWaitingRoom} onDeny={s.denyFromWaitingRoom}
        translations={s.translations} isTranslating={s.isTranslating}
        translationError={s.translationError}
        translationSourceLang={s.translationSourceLang}
        translationTargetLang={s.translationTargetLang}
        translationAutoDetect={s.translationAutoDetect}
        translationLanguages={s.translationLanguages}
        onSetTranslationSource={s.setTranslationSource}
        onSetTranslationTarget={s.setTranslationTarget}
        onSetTranslationAutoDetect={s.setTranslationAutoDetect}
        onTranslate={s.translateText} onTranslateBatch={s.translateBatch}
        onClearTranslations={s.clearTranslations}
        minutesRemaining={s.minutesRemaining}
        isDurationWarning={s.isDurationWarning}
        isDurationExpired={s.isDurationExpired}
        presentation={s.presentation}
      />
      {installBanner}
    </>
  );
}
