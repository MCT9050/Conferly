import { useAppState } from './store';
import { useEffect, useState } from 'react';
import AuthPage from './components/AuthPage';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Lobby from './components/Lobby';
import MeetingRoom from './components/MeetingRoom';
import PricingPage from './components/PricingPage';
import InstallBanner from './components/InstallBanner';
import OnboardingPage from './components/OnboardingPage';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

export default function App() {
  const s = useAppState();
  const pwa = useInstallPrompt();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Mobile debugging
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('=== App Component Debug ===');
    console.log('Device:', navigator.userAgent);
    console.log('Is Mobile:', isMobile);
    console.log('Auth Loading:', s.authLoading);
    console.log('Is Authenticated:', s.isAuthenticated);
    console.log('Auth Profile:', s.authProfile);
    console.log('Auth Error:', s.authError);
    console.log('View:', s.view);
    console.log('Memory:', {
      used: (performance as any).memory?.usedJSHeapSize,
      total: (performance as any).memory?.totalJSHeapSize,
      limit: (performance as any).memory?.jsHeapSizeLimit
    });
    console.log('========================');
  }, [s.authLoading, s.isAuthenticated, s.authProfile, s.authError, s.view]);

  // Handle SPA routing for /terms and /privacy
  useEffect(() => {
    var path = window.location.pathname;
    var hash = window.location.hash;
    
    // Check both pathname and hash for routes
    // Hash format: #/terms
    var effectivePath = path;
    if (hash && hash.startsWith('#/')) {
      effectivePath = hash.substring(1); // Remove the # to get /terms
    }
    
    if (effectivePath === '/terms' || effectivePath === '/terms/') {
      setShowTerms(true);
      setShowPrivacy(false);
    } else if (effectivePath === '/privacy' || effectivePath === '/privacy/') {
      setShowPrivacy(true);
      setShowTerms(false);
    } else {
      setShowTerms(false);
      setShowPrivacy(false);
    }
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      var path = window.location.pathname;
      var hash = window.location.hash;
      
      // Check both pathname and hash for routes
      var effectivePath = path;
      if (hash && hash.startsWith('#/')) {
        effectivePath = hash.substring(1);
      }
      
      if (effectivePath === '/terms' || effectivePath === '/terms/') {
        setShowTerms(true);
        setShowPrivacy(false);
      } else if (effectivePath === '/privacy' || effectivePath === '/privacy/') {
        setShowPrivacy(true);
        setShowTerms(false);
      } else {
        setShowTerms(false);
        setShowPrivacy(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // Show Terms page for /terms route
  if (showTerms) {
    return (
      <>
        <TermsPage onClose={() => {
          setShowTerms(false);
          window.history.back();
        }} />
      </>
    );
  }

  // Show Privacy page for /privacy route
  if (showPrivacy) {
    return (
      <>
        <PrivacyPage onClose={() => {
          setShowPrivacy(false);
          window.history.back();
        }} />
      </>
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
            onSignOut={() => { }} onUpdateName={async () => ({ success: false })}
          />
          {installBanner}
        </>
      );
    }
    return (
      <>
        <AuthPage
          onSignUp={s.signUp}
          onSignIn={s.signIn}
          onResendConfirmation={s.resendConfirmation}
          onResetPassword={s.resetPassword}
          error={s.authError}
          clearError={s.clearAuthError}
          loading={s.authLoading}
        />
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
          security={s.security} isHost={s.isHost} setMeetingPassword={s.setMeetingPassword}
          toggleMeetingLock={s.toggleMeetingLock} toggleWaitingRoom={s.toggleWaitingRoom}
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
