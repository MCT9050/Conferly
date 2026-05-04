import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  isBackendConfigured, setToken, hasStoredToken, isTokenExpired,
  setAuthExpiredCallback,
  apiSignUp, apiSignIn, apiSignOut, apiGetProfile, apiUpdateProfile,
  apiGetMeetings,
} from '../lib/api';
import { saveMeeting } from '../lib/persist';
import { trigger as automation } from '../lib/automation';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  userType: 'individual' | 'organization';
  organizationName: string | null;
  organizationSize: number | null;
  organizationIndustry: string | null;
  onboardingComplete: boolean;
}

export interface OnboardingData {
  userType: 'individual' | 'organization';
  organizationName?: string;
  organizationSize?: number;
  organizationIndustry?: string;
}

const PROFILE_KEY = 'conferly_user_profile';
const OFFLINE_KEY = 'conferly_offline_user';

interface OfflineUser { id: string; email: string; displayName: string; password: string; userType: string; orgName: string; }

// Build a UserProfile with all required fields, using safe defaults
function buildProfile(base: { id: string; email: string; displayName: string; avatarUrl?: string | null; createdAt: string }, extra?: Partial<UserProfile>): UserProfile {
  return {
    id: base.id, email: base.email, displayName: base.displayName,
    avatarUrl: base.avatarUrl || null, createdAt: base.createdAt,
    userType: 'individual', organizationName: null, organizationSize: null,
    organizationIndustry: null, onboardingComplete: false,
    ...extra,
  };
}

async function hashPw(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function loadOfflineUsers(): OfflineUser[] { try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; } }
function saveOfflineUsers(u: OfflineUser[]) { localStorage.setItem(OFFLINE_KEY, JSON.stringify(u)); }
function loadCachedProfile(): UserProfile | null {
  try {
    const r = localStorage.getItem(PROFILE_KEY);
    if (!r) return null;
    const p = JSON.parse(r);
    // Ensure old cached profiles without new fields still work
    return { ...p, userType: p.userType || 'individual', organizationName: p.organizationName || null, organizationSize: p.organizationSize || null, organizationIndustry: p.organizationIndustry || null, onboardingComplete: p.onboardingComplete ?? false };
  } catch { return null; }
}
function cacheProfile(p: UserProfile | null) { if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); else localStorage.removeItem(PROFILE_KEY); }

async function rehydrateMeetings(userId?: string): Promise<void> {
  try {
    if (isSupabaseConfigured && supabase && userId) {
      const { data } = await supabase.from('meetings').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(50);
      if (data) for (const m of data) await saveMeeting({ id: m.id, roomCode: m.room_code, title: m.title || 'Meeting', startedAt: m.started_at, endedAt: m.ended_at, durationSeconds: m.duration_seconds, participantCount: m.participant_count });
    } else if (isBackendConfigured) {
      const remote = await apiGetMeetings();
      for (const m of remote) await saveMeeting({ id: m.id, roomCode: m.roomCode, title: m.title || 'Meeting', startedAt: m.startedAt, endedAt: m.endedAt, durationSeconds: m.durationSeconds, participantCount: m.participantCount });
    }
  } catch { /* silent */ }
}

// Fetch extended profile from Supabase profiles table
async function fetchSupabaseProfile(userId: string): Promise<Partial<UserProfile>> {
  if (!isSupabaseConfigured || !supabase) return {};
  try {
    const { data } = await supabase.from('profiles').select('user_type, organization_name, organization_size, organization_industry, onboarding_complete, display_name').eq('id', userId).single();
    if (data) return {
      displayName: data.display_name || undefined,
      userType: data.user_type || 'individual',
      organizationName: data.organization_name || null,
      organizationSize: data.organization_size || null,
      organizationIndustry: data.organization_industry || null,
      onboardingComplete: data.onboarding_complete || false,
    };
  } catch { /* silent */ }
  return {};
}

export function useAuth() {
  const [profile, setProfile] = useState<UserProfile | null>(() => loadCachedProfile());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setAuthExpiredCallback(() => { setProfile(null); cacheProfile(null); setSessionExpired(true); setError('Your session has expired. Please sign in again.'); });
    return () => setAuthExpiredCallback(null);
  }, []);

  // Auto-login
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (mounted && session?.user) {
            const u = session.user;
            const extra = await fetchSupabaseProfile(u.id);
            const p = buildProfile({ id: u.id, email: u.email || '', displayName: extra.displayName || u.user_metadata?.display_name || u.email?.split('@')[0] || 'User', avatarUrl: u.user_metadata?.avatar_url, createdAt: u.created_at }, extra);
            setProfile(p); cacheProfile(p); setIsOfflineMode(false);
            rehydrateMeetings(u.id);
            if (mounted) setLoading(false);
            return;
          }
        } catch { /* fall through */ }
      }
      if (isBackendConfigured && hasStoredToken()) {
        try {
          const user = await apiGetProfile();
          if (mounted) { const p = buildProfile({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt }); setProfile(p); cacheProfile(p); setIsOfflineMode(false); rehydrateMeetings(); }
          if (mounted) setLoading(false); return;
        } catch { if (mounted && isTokenExpired()) { setToken(null); setSessionExpired(true); setError('Session expired.'); } }
      }
      if (mounted) { const cached = loadCachedProfile(); if (cached) { setProfile(cached); setIsOfflineMode(true); } setLoading(false); }
    })();
    let unsub: (() => void) | undefined;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_ev, sess) => {
          if (!mounted) return;
          if (sess?.user) {
            const u = sess.user;
            const extra = await fetchSupabaseProfile(u.id);
            const p = buildProfile({ id: u.id, email: u.email || '', displayName: extra.displayName || u.user_metadata?.display_name || u.email?.split('@')[0] || 'User', avatarUrl: u.user_metadata?.avatar_url, createdAt: u.created_at }, extra);
            setProfile(p); cacheProfile(p); setIsOfflineMode(false);
          } else { setProfile(null); cacheProfile(null); }
        });
        unsub = () => subscription.unsubscribe();
      } catch { /* silent */ }
    }
    return () => { mounted = false; unsub?.(); };
  }, []);

  // Sign up
  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null); setLoading(true); setSessionExpired(false);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin
          }
        });
        if (err) throw err;
        if (data.user) {
          const p = buildProfile({ id: data.user.id, email, displayName, createdAt: data.user.created_at });
          setProfile(p); cacheProfile(p); setIsOfflineMode(false);
          automation('user.signup', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'supabase' } });

          // Show confirmation message
          if (!data.session) {
            setError('🎉 Welcome to Conferly! Please check your email for a confirmation link to complete your registration.');
          }

          setLoading(false);
          return { success: true, needsConfirmation: !data.session };
        }
      } catch (err: any) { if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) { setError(err.message); setLoading(false); return { success: false }; } }
    }
    if (isBackendConfigured) {
      try {
        const { user } = await apiSignUp(email, password, displayName);
        const p = buildProfile({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
        setProfile(p); cacheProfile(p); setIsOfflineMode(false); setLoading(false); automation('user.signup', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'backend' } }); return { success: true, needsConfirmation: false };
      } catch (err: any) { if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) { setError(err.message); setLoading(false); return { success: false }; } }
    }
    const users = loadOfflineUsers();
    if (users.find(u => u.email === email)) { setError('An account with this email already exists.'); setLoading(false); return { success: false }; }
    const hashed = await hashPw(password);
    const offUser: OfflineUser = { id: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`, email, displayName, password: hashed, userType: 'individual', orgName: '' };
    users.push(offUser); saveOfflineUsers(users);
    const p = buildProfile({ id: offUser.id, email, displayName, createdAt: new Date().toISOString() });
    setProfile(p); cacheProfile(p); setIsOfflineMode(true); setLoading(false);
    automation('user.signup', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'offline' } });
    return { success: true, needsConfirmation: false };
  }, []);

  // Sign in
  // Resend confirmation email
  const resendConfirmation = useCallback(async (email: string) => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email,
        });
        if (error) {
          setError('Failed to resend confirmation email. Please try again.');
        } else {
          setError('✅ Confirmation email sent! Please check your inbox.');
        }
      } catch (err: any) {
        setError('Failed to resend confirmation email.');
      }
    }
  }, []);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null); setLoading(true); setSessionExpired(false);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data.user) {
          const extra = await fetchSupabaseProfile(data.user.id);
          const p = buildProfile({ id: data.user.id, email: data.user.email || email, displayName: extra.displayName || data.user.user_metadata?.display_name || email.split('@')[0], avatarUrl: data.user.user_metadata?.avatar_url, createdAt: data.user.created_at }, extra);
          setProfile(p); cacheProfile(p); setIsOfflineMode(false); rehydrateMeetings(data.user.id);
          automation('user.signin', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'supabase' } });
        }
        setLoading(false); return { success: true };
      } catch (err: any) {
        if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) {
          if (err.message?.includes('email_not_confirmed')) {
            setError('Please check your email and click the confirmation link. If you didn\'t receive an email, please check your spam folder.');
          } else {
            setError(err.message);
          }
          setLoading(false);
          return { success: false };
        }
      }
    }
  }
    if (isBackendConfigured) {
    try {
      const { user } = await apiSignIn(email, password);
      const p = buildProfile({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
      setProfile(p); cacheProfile(p); setIsOfflineMode(false); rehydrateMeetings();
      automation('user.signin', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'backend' } });
      setLoading(false);
      return { success: true };
    }
    catch (err: any) { if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) { setError(err.message); setLoading(false); return { success: false }; } }
  }
  const users = loadOfflineUsers(); const hashed = await hashPw(password);
  const found = users.find(u => u.email === email && u.password === hashed);
  if (found) { const p = buildProfile({ id: found.id, email: found.email, displayName: found.displayName, createdAt: new Date().toISOString() }, { userType: (found.userType as 'individual' | 'organization') || 'individual', organizationName: found.orgName || null }); setProfile(p); cacheProfile(p); setIsOfflineMode(true); setLoading(false); automation('user.signin', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'offline' } }); return { success: true }; }
  setError('Invalid email or password.'); setLoading(false); return { success: false };
}, []);

const signOut = useCallback(async () => {
  if (profile) automation('user.signout', { userId: profile.id, email: profile.email, displayName: profile.displayName });
  if (isSupabaseConfigured && supabase) { try { await supabase.auth.signOut(); } catch { /* silent */ } }
  apiSignOut(); setProfile(null); cacheProfile(null); setIsOfflineMode(false); setSessionExpired(false);
}, [profile]);

const updateDisplayName = useCallback(async (newName: string) => {
  setError(null);
  try {
    if (isSupabaseConfigured && supabase && !isOfflineMode) {
      await supabase.auth.updateUser({ data: { display_name: newName } });
      if (profile) await supabase.from('profiles').update({ display_name: newName, updated_at: new Date().toISOString() }).eq('id', profile.id);
    } else if (isBackendConfigured && !isOfflineMode) { await apiUpdateProfile({ displayName: newName }); }
    else if (profile) { const users = loadOfflineUsers(); const idx = users.findIndex(u => u.id === profile.id); if (idx >= 0) { users[idx].displayName = newName; saveOfflineUsers(users); } }
    const updated = profile ? { ...profile, displayName: newName } : null;
    setProfile(updated); cacheProfile(updated); return { success: true };
  } catch (err: any) { setError(err.message || 'Update failed'); return { success: false }; }
}, [isOfflineMode, profile]);

// Complete onboarding — save user type + org details
const completeOnboarding = useCallback(async (data: OnboardingData) => {
  setError(null);
  if (!profile) return { success: false };
  const updates: Partial<UserProfile> = {
    userType: data.userType,
    organizationName: data.organizationName || null,
    organizationSize: data.organizationSize || null,
    organizationIndustry: data.organizationIndustry || null,
    onboardingComplete: true,
  };
  // Write to Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('profiles').update({
        user_type: data.userType,
        organization_name: data.organizationName || null,
        organization_size: data.organizationSize || null,
        organization_industry: data.organizationIndustry || null,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }).eq('id', profile.id);
    } catch { /* silent — local still works */ }
  }
  // Update offline store
  const users = loadOfflineUsers();
  const idx = users.findIndex(u => u.id === profile.id);
  if (idx >= 0) { users[idx].userType = data.userType; users[idx].orgName = data.organizationName || ''; saveOfflineUsers(users); }

  const updated = { ...profile, ...updates };
  setProfile(updated); cacheProfile(updated);
  automation('user.onboarded', {
    userId: updated.id, email: updated.email, displayName: updated.displayName,
    data: { userType: data.userType, organizationName: data.organizationName, organizationSize: data.organizationSize, organizationIndustry: data.organizationIndustry },
  }, [profile]);

  // Password reset
  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          setError('Failed to send reset email. Please try again.');
        } else {
          setError('✅ Password reset email sent! Please check your inbox.');
        }
      } catch (err: any) {
        setError('Failed to send reset email.');
      }
    } else {
      setError('Password reset is not available in offline mode.');
    }
  }, []);

  // Update password (for reset flow)
  const updatePassword = useCallback(async (newPassword: string) => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });
        if (error) {
          setError('Failed to update password. Please try again.');
          return { success: false };
        } else {
          return { success: true };
        }
      } catch (err: any) {
        setError('Failed to update password.');
        return { success: false };
      }
    } else {
      setError('Password update is not available in offline mode.');
      return { success: false };
    }
  }, []);

  return {
    profile, loading, error,
    isAuthenticated: !!profile,
    isOfflineMode, sessionExpired,
    signUp, signIn, signOut, updateDisplayName,
    completeOnboarding,
    resendConfirmation,
    resetPassword,
    updatePassword,
    clearError: () => { setError(null); setSessionExpired(false); },
  };
}
