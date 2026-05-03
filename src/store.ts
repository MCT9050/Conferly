import { useState, useCallback, useEffect, useRef } from 'react';
import type { Participant, ChatMessage, SidebarTab, AppView, Reaction } from './types';
import { useMediaDevices } from './hooks/useMediaDevices';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useRecording } from './hooks/useRecording';
import { usePulse } from './hooks/usePulse';
import { useAuth } from './hooks/useAuth';
import { usePlan } from './hooks/usePlan';
import { useMeetingSecurity } from './hooks/useMeetingSecurity';
import { useTranslation } from './hooks/useTranslation';
import { usePayment } from './hooks/usePayment';
import { usePresentation } from './hooks/usePresentation';
import { saveMeeting, saveTranscript, saveChatHistory, saveActiveSession, loadActiveSession, clearActiveSession, getMeetings, type StoredMeeting } from './lib/persist';
import { trigger as automation } from './lib/automation';

export function useAppState() {
  const [view, setView] = useState<AppView>('welcome');
  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [handRaised, setHandRaised] = useState(false);

  const auth = useAuth();
  const plan = usePlan();
  const media = useMediaDevices();
  const speech = useSpeechRecognition(userName);
  const recording = useRecording();
  const pulse = usePulse();
  const sec = useMeetingSecurity(auth.profile?.id || 'self', plan.limits);
  const translation = useTranslation();
  const payment = usePayment(plan.upgradeTo);
  const presentation = usePresentation();

  const resolvedName = auth.profile?.displayName || userName || 'You';

  // Refs for persistence (avoid stale closures in navigateTo)
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const meetingIdRef = useRef('');
  const meetingDurationRef = useRef(0);

  // Persisted meeting history from IndexedDB
  const [meetingHistory, setMeetingHistory] = useState<StoredMeeting[]>([]);
  const [pendingReconnect, setPendingReconnect] = useState(loadActiveSession());

  // Load meeting history on mount
  useEffect(() => {
    getMeetings().then(setMeetingHistory).catch(() => {});
  }, []);

  // Reconnect to a previous meeting
  const reconnectToMeeting = useCallback((password?: string) => {
    const session = pendingReconnect;
    if (!session) return;
    // Verify password if meeting had one
    if (session.passwordHash) {
      if (!password) return; // Need password
      // Hash the input and compare
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
        .then(buf => {
          const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (hash !== session.passwordHash) return; // Wrong password
          setRoomId(session.roomCode);
          if (!userName) setUserName(session.userName);
          meetingIdRef.current = session.meetingId;
          meetingDurationRef.current = session.durationAtPause;
          setMeetingDuration(session.durationAtPause);
          clearActiveSession();
          setPendingReconnect(null);
          setView('meeting');
        });
      return;
    }
    // No password needed
    setRoomId(session.roomCode);
    if (!userName) setUserName(session.userName);
    meetingIdRef.current = session.meetingId;
    meetingDurationRef.current = session.durationAtPause;
    setMeetingDuration(session.durationAtPause);
    clearActiveSession();
    setPendingReconnect(null);
    setView('meeting');
  }, [pendingReconnect, userName, setUserName]);

  const dismissReconnect = useCallback(() => {
    clearActiveSession();
    setPendingReconnect(null);
  }, []);

  // Meeting count tracking for free tier limits
  const MEETING_COUNT_KEY = 'conferly_meeting_count';
  const getMeetingCount = useCallback((): { count: number; month: number } => {
    try {
      const raw = localStorage.getItem(MEETING_COUNT_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.month === new Date().getMonth()) return data;
      }
    } catch { /* ignore */ }
    return { count: 0, month: new Date().getMonth() };
  }, []);

  const incrementMeetingCount = useCallback(() => {
    const current = getMeetingCount();
    const updated = { count: current.count + 1, month: new Date().getMonth() };
    localStorage.setItem(MEETING_COUNT_KEY, JSON.stringify(updated));
    return updated.count;
  }, [getMeetingCount]);

  const meetingCountData = getMeetingCount();
  const meetingsThisMonth = meetingCountData.count;
  const meetingLimitReached = plan.limits.maxMeetingsPerMonth !== -1 && meetingsThisMonth >= plan.limits.maxMeetingsPerMonth;

  // Reset meeting state when leaving a meeting
  const navigateTo = useCallback((target: AppView) => {
    setView(prev => {
      if (prev !== 'meeting' && target === 'meeting') {
        // Entering meeting — increment count + create meeting record + save active session
        incrementMeetingCount();
        const mId = meetingIdRef.current || `mtg-${Date.now()}`;
        meetingIdRef.current = mId;
        if (meetingDurationRef.current === 0) meetingDurationRef.current = 0;
        saveMeeting({
          id: mId, roomCode: roomIdRef.current, title: `Meeting ${new Date().toLocaleDateString()}`,
          startedAt: new Date().toISOString(), endedAt: null, durationSeconds: 0, participantCount: 1,
        }).catch(() => {});
        automation('meeting.started', {
          userId: auth.profile?.id, email: auth.profile?.email, displayName: resolvedName,
          data: { meetingId: mId, roomCode: roomIdRef.current },
        });
        // Save active session for reconnect on browser refresh
        saveActiveSession({
          meetingId: mId, roomCode: roomIdRef.current,
          userName: resolvedName, startedAt: new Date().toISOString(),
          durationAtPause: meetingDurationRef.current,
          passwordHash: sec.security.password ? null : null, // Will be set if password exists
        });
      }
      if (prev === 'meeting' && target !== 'meeting') {
        // Leaving meeting — persist data, clear active session
        clearActiveSession();
        const mId = meetingIdRef.current;
        if (mId) {
          saveMeeting({
            id: mId, roomCode: roomIdRef.current, title: `Meeting ${new Date().toLocaleDateString()}`,
            startedAt: new Date(Date.now() - meetingDurationRef.current * 1000).toISOString(),
            endedAt: new Date().toISOString(),
            durationSeconds: meetingDurationRef.current, participantCount: 1,
          }).catch(() => {});
          // Save transcript
          const transcriptEntries = speech.transcript.filter(t => t.isFinal).map(t => ({
            speaker: t.speaker, text: t.text, timestamp: t.timestamp.toISOString(),
          }));
          if (transcriptEntries.length > 0) saveTranscript(mId, transcriptEntries).catch(() => {});
          // Save chat
          const chatEntries = chatMessages.map(m => ({
            sender: m.sender, text: m.text, timestamp: m.timestamp.toISOString(),
          }));
          if (chatEntries.length > 0) saveChatHistory(mId, chatEntries).catch(() => {});
          automation('meeting.ended', {
            userId: auth.profile?.id, email: auth.profile?.email, displayName: resolvedName,
            data: {
              meetingId: mId, roomCode: roomIdRef.current,
              durationSeconds: meetingDurationRef.current,
              transcriptEntries: transcriptEntries.length,
              chatMessages: chatEntries.length,
            },
          });
        }
        setMeetingDuration(0);
        setChatMessages([]);
        setHandRaised(false);
        setReactions([]);
      }
      return target;
    });
  }, [incrementMeetingCount, speech.transcript, chatMessages]);

  // Update active session duration every 30s (for reconnect accuracy)
  useEffect(() => {
    if (view !== 'meeting') return;
    const interval = setInterval(() => {
      const session = loadActiveSession();
      if (session) {
        saveActiveSession({ ...session, durationAtPause: meetingDurationRef.current });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [view]);

  // Keyboard shortcuts (global)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'meeting') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        media.toggleMute();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        media.toggleVideo();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setHandRaised(prev => !prev);
      } else if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, media]);

  const localParticipant: Participant = {
    id: 'self',
    name: resolvedName,
    avatar: resolvedName.charAt(0).toUpperCase(),
    isMuted: media.isMuted,
    isVideoOn: media.isVideoOn,
    isScreenSharing: media.isScreenSharing,
    isSpeaking: media.audioLevel > 0.08,
    stream: media.stream,
    audioLevel: media.audioLevel,
    role: 'host',
  };

  const participants: Participant[] = [localParticipant];

  const sendChatMessage = useCallback((text: string) => {
    setChatMessages(prev => [...prev, {
      id: `chat-${Date.now()}`,
      sender: resolvedName,
      text,
      timestamp: new Date(),
    }]);
  }, [resolvedName]);

  const addReaction = useCallback((emoji: string) => {
    const id = `react-${Date.now()}`;
    setReactions(prev => [...prev, { id, emoji, sender: resolvedName, timestamp: Date.now() }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
  }, [resolvedName]);

  const toggleHandRaise = useCallback(() => setHandRaised(h => !h), []);

  const toggleRecording = useCallback(() => {
    if (!plan.canUseFeature('recording')) return;
    if (recording.isRecording) {
      recording.stopRecording();
    } else if (media.stream) {
      recording.startRecording(media.stream);
    }
  }, [recording, media.stream, plan]);

  const generatePulse = useCallback(() => {
    if (!plan.canUseFeature('aiPulse')) return;
    pulse.generatePulse(speech.transcript);
  }, [pulse, speech.transcript, plan]);

  // Duration limit: minutes remaining (-1 = unlimited)
  const durationLimitMin = plan.limits.maxDurationMinutes;
  const minutesRemaining = durationLimitMin === -1 ? -1 : Math.max(0, durationLimitMin - Math.floor(meetingDuration / 60));
  const isDurationWarning = durationLimitMin !== -1 && minutesRemaining <= 5 && minutesRemaining > 0;
  const isDurationExpired = durationLimitMin !== -1 && minutesRemaining <= 0;

  return {
    // Auth
    authProfile: auth.profile,
    authLoading: auth.loading,
    authError: auth.error,
    isAuthenticated: auth.isAuthenticated,
    isOfflineMode: auth.isOfflineMode,
    signUp: auth.signUp,
    signIn: auth.signIn,
    signOut: auth.signOut,
    updateDisplayName: auth.updateDisplayName,
    completeOnboarding: auth.completeOnboarding,
    clearAuthError: auth.clearError,

    // Plan
    subscription: plan.subscription,
    planLimits: plan.limits,
    planPricing: plan.pricing,
    allPlanLimits: plan.allLimits,
    upgradePlan: plan.upgradeTo,
    cancelPlan: plan.cancelSubscription,
    canUseFeature: plan.canUseFeature,

    // Security
    security: sec.security,
    isHost: sec.isHost,
    setMeetingPassword: sec.setPassword,
    toggleMeetingLock: sec.toggleLock,
    toggleWaitingRoom: sec.toggleWaitingRoom,
    admitFromWaitingRoom: sec.admitFromWaitingRoom,
    denyFromWaitingRoom: sec.denyFromWaitingRoom,
    verifyMeetingPassword: sec.verifyPassword,

    // Navigation
    view,
    setView: navigateTo, // Use the wrapper that resets state
    roomId, setRoomId,
    userName, setUserName,
    participants,

    // Duration limits
    minutesRemaining,
    isDurationWarning,
    isDurationExpired,

    // Media
    stream: media.stream,
    screenStream: media.screenStream,
    isMuted: media.isMuted,
    isVideoOn: media.isVideoOn,
    isScreenSharing: media.isScreenSharing,
    audioLevel: media.audioLevel,
    mediaError: media.error,
    startMedia: media.startMedia,
    stopMedia: media.stopMedia,
    toggleMute: media.toggleMute,
    toggleVideo: media.toggleVideo,
    toggleScreenShare: media.toggleScreenShare,

    // Speech
    transcript: speech.transcript,
    setTranscript: speech.setTranscript,
    isListening: speech.isListening,
    interimText: speech.interimText,
    isSpeechSupported: speech.isSupported,
    startListening: speech.startListening,
    stopListening: speech.stopListening,

    // Recording (on-device via IndexedDB)
    isRecording: recording.isRecording,
    recordedBlob: recording.recordedBlob,
    recordingDuration: recording.recordingDuration,
    savedRecordings: recording.savedRecordings,
    isSavingRecording: recording.isSaving,
    toggleRecording,
    saveRecording: recording.saveRecording,
    downloadRecording: recording.downloadRecording,
    deleteRecording: recording.deleteRecording,

    // Chat / Sidebar / Meeting
    chatMessages, sendChatMessage,
    sidebarOpen, setSidebarOpen,
    sidebarTab, setSidebarTab,
    meetingDuration,
    setMeetingDuration: useCallback((fn: React.SetStateAction<number>) => {
      setMeetingDuration(prev => {
        const next = typeof fn === 'function' ? fn(prev) : fn;
        meetingDurationRef.current = next;
        return next;
      });
    }, []),

    // AI Pulse
    pulseSummary: pulse.pulseSummary,
    isPulseLoading: pulse.isPulseLoading,
    pulseTopics: pulse.pulseTopics,
    generatePulse,

    // Reactions
    reactions, addReaction,
    handRaised, toggleHandRaise,

    // Translation
    translations: translation.translations,
    isTranslating: translation.isTranslating,
    translationError: translation.error,
    translationSourceLang: translation.sourceLang,
    translationTargetLang: translation.targetLang,
    translationAutoDetect: translation.autoDetect,
    translationLanguages: translation.languages,
    setTranslationSource: translation.setSourceLang,
    setTranslationTarget: translation.setTargetLang,
    setTranslationAutoDetect: translation.setAutoDetect,
    translateText: translation.translate,
    translateBatch: translation.translateBatch,
    clearTranslations: translation.clearTranslations,

    // Payment
    paymentProcessing: payment.isProcessing,
    paymentError: payment.error,
    paymentResult: payment.lastPaymentResult,
    isPeachConfigured: payment.isPeachConfigured,
    startCheckout: payment.startCheckout,
    clearPaymentError: payment.clearError,
    clearPaymentResult: payment.clearResult,
    planPricesZAR: payment.planPricesZAR,

    // Presentation
    presentation,

    // Meeting limits
    meetingsThisMonth,
    meetingLimitReached,
    maxMeetingsPerMonth: plan.limits.maxMeetingsPerMonth,

    // Meeting history + reconnect
    meetingHistory,
    pendingReconnect,
    reconnectToMeeting,
    dismissReconnect,
    sessionExpired: auth.sessionExpired,
  };
}
