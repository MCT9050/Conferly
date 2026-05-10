import { useAppState } from './store';
import { useEffect, lazy, Suspense, useMemo } from 'react';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

// Lazy load heavy route components
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lobby = lazy(() => import('./components/Lobby').then(m => ({ default: m.Lobby })));
const MeetingRoom = lazy(() => import('./components/MeetingRoom').then(m => ({ default: m.MeetingRoom })));
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.PricingPage })));
const OnboardingPage = lazy(() => import('./components/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const TermsPage = lazy(() => import('./components/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

// Lightweight fallback for lazy loading
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size="xl" />
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    </div>
  );
}

// Get initial route state synchronously - lightweight
function getRouteFromURL() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path;
  
  if (effectivePath === '/terms' || effectivePath === '/terms/') return 'terms';
  if (effectivePath === '/privacy' || effectivePath === '/privacy/') return 'privacy';
  if (effectivePath === '/auth' || effectivePath === '/auth?mode=signin' || effectivePath === '/auth?mode=signup') return 'auth';
  if (effectivePath === '/dashboard' || effectivePath === '/dashboard/') return 'dashboard';
  if (effectivePath === '/pricing' || effectivePath === '/pricing/') return 'pricing';
  if (effectivePath && effectivePath.startsWith('/meeting/')) return 'none';
  return 'none';
}

export default function App() {
  const s = useAppState();
  const pwa = useInstallPrompt();
  
  // Route state - initialized synchronously before auth check
  const initialRoute = useMemo(() => getRouteFromURL(), []);
  
  // Only compute derived state after initial route is known
  const isTermsPage = useMemo(() => initialRoute === 'terms', [initialRoute]);
  const isPrivacyPage = useMemo(() => initialRoute === 'privacy', [initialRoute]);
  const isAuthPage = useMemo(() => initialRoute === 'auth', [initialRoute]);
  const isDashboardPage = useMemo(() => initialRoute === 'dashboard', [initialRoute]);
  const isPricingPage = useMemo(() => initialRoute === 'pricing', [initialRoute]);

  // Debug - only in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('=== Route Debug ===');
      console.log('Initial Route:', initialRoute);
      console.log('Auth Loading:', s.authLoading);
      console.log('Is Authenticated:', s.isAuthenticated);
    }
  }, [initialRoute, s.authLoading, s.isAuthenticated]);

  const installBanner = (
    <InstallBanner
      show={pwa.showBanner}
      isIOS={pwa.isIOS}
      canInstallNatively={pwa.canInstallNatively}
      onInstall={pwa.install}
      onDismiss={pwa.dismiss}
    />
  );

  // Early route returns - before auth check for speed
  if (isTermsPage) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <TermsPage onClose={() => window.location.hash = ''} />
      </Suspense>
    );
  }

  if (isPrivacyPage) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <PrivacyPage onClose={() => window.location.hash = ''} />
      </Suspense>
    );
  }

  // Auth loading state - show lightweight loader immediately
  if (s.authLoading) {
    return <RouteLoader />;
  }

  // Not authenticated routes - lightweight and fast
  if (!s.isAuthenticated) {
    if (isAuthPage) {
      return (
        <Suspense fallback={<RouteLoader />}>
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
        </Suspense>
      );
    }
    if (isPricingPage) {
      return (
        <Suspense fallback={<RouteLoader />}>
          <PricingPage
            setView={s.setView} subscription={s.subscription}
            pricing={s.pricing} allLimits={s.allLimits}
            onUpgrade={s.upgradeSubscription}
          />
          {installBanner}
        </Suspense>
      );
    }
    // Default: show LandingPage - lazy load it
    return (
      <Suspense fallback={<RouteLoader />}>
        <LandingPage
          setView={s.setView} roomId={s.roomId} setRoomId={s.setRoomId}
          userName={s.userName} setUserName={s.setUserName}
          profile={null} isOfflineMode={false}
          onSignOut={() => { }} onUpdateName={async () => ({ success: false })}
        />
        {installBanner}
      </Suspense>
    );
  }

  // Authenticated routes - lazy loaded
  if (s.authProfile && !s.authProfile.onboardingComplete) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <OnboardingPage
          displayName={s.authProfile.displayName}
          onComplete={s.completeOnboarding}
        />
        {installBanner}
      </Suspense>
    );
  }

  if (s.view === 'pricing') {
    return (
      <Suspense fallback={<RouteLoader />}>
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
      </Suspense>
    );
  }

  if (s.view === 'welcome' || s.view === 'dashboard') {
    return (
      <Suspense fallback={<RouteLoader />}>
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
      </Suspense>
    );
  }

  if (s.view === 'lobby') {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Lobby
          roomId={s.roomId} userName={s.authProfile?.displayName || s.userName}
          setView={s.setView} stream={s.stream} startMedia={s.startMedia}
          isMuted={s.isMuted} toggleMute={s.toggleMute}
          isVideoOn={s.isVideoOn} toggleVideo={s.toggleVideo}
          audioLevel={s.audioLevel} mediaError={s.mediaError}
        />
        {installBanner}
      </Suspense>
    );
  }

  // Meeting room - the heaviest component
  return (
    <Suspense fallback={<RouteLoader />}>
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
    </Suspense>
  );
}