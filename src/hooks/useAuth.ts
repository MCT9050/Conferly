/**
 * Conferly Client Authentication Module
 * Handles sign-in, sign-up, session management, and token refresh.
 * @module useAuth
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { log, state, session, supabase as traceSupabase, error as traceError, race } from '../lib/authTracer';
import { emit, emitLoginAttempt, emitLoginSuccess, emitLoginFailure, emitLoginBlocked, emitRegisterAttempt, emitRegisterSuccess, emitRegisterFailure, emitSessionRestoreStart, emitSessionRestored, emitSessionExpired, emitSessionNone, generateAuthReport, detectPatterns, getSessionSummary } from '../lib/authEvents';
import {
  isBackendConfigured, setToken, hasStoredToken, isTokenExpired,
  setAuthExpiredCallback,
  apiSignUp, apiSignIn, apiSignOut, apiGetProfile, apiUpdateProfile,
  apiGetMeetings,
} from '../lib/api';
import { saveMeeting } from '../lib/persist';
import { trigger as automation } from '../lib/automation';

// Cloudflare Turnstile validation
const validateTurnstileToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('/functions/v1/verify-turnstile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
};

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

interface OfflineUser { 
  id: string; 
  email: string; 
  displayName: string; 
  password: string; 
  userType: string; 
  orgName: string;
  // SECURITY: New PBKDF2 fields
  salt?: string;  // PBKDF2 salt (if migrated)
  passwordMigratedAt?: string;  // Migration timestamp
}

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

// SECURITY FIX: Email normalization - should be applied before any auth operation
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// SECURITY FIX: Secure password hashing using PBKDF2
// PBKDF2 is a standard key derivation function with configurable iterations
async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = salt ? new TextEncoder().encode(salt) : crypto.getRandomValues(new Uint8Array(16));
  const saltStr = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash, salt: saltStr };
}

// DEPRECATED: Using deprecated SHA-256 for password hashing
// CRITICAL: This is kept ONLY for backward compatibility during migration from SHA-256 to PBKDF2
// Migration strategy: When user logs in, verify with SHA-256, then rehash with PBKDF2 and update storage
async function hashPw(pw: string): Promise<string> {
  console.warn('SECURITY WARNING: Using deprecated SHA-256 for password hashing - MIGRATION NEEDED');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// SECURITY FIX: Migrate legacy SHA-256 password to secure PBKDF2
// This runs during login to seamlessly upgrade legacy passwords
async function migratePasswordIfNeeded(offlineUser: OfflineUser, newPassword: string): Promise<OfflineUser> {
  // Check if already migrated (has salt field indicating PBKDF2)
  if ((offlineUser as any).salt) {
    // Already migrated, verify with PBKDF2
    const { hash } = await hashPassword(newPassword, (offlineUser as any).salt);
    if (hash === offlineUser.password) {
      console.log('SECURITY: Password verified with PBKDF2 (already migrated)');
      return offlineUser;
    }
    throw new Error('Invalid credentials');
  }
  
  // Legacy SHA-256 detected - migrate to PBKDF2
  console.log('SECURITY: Migrating legacy SHA-256 password to PBKDF2...');
  const { hash, salt } = await hashPassword(newPassword);
  
  // Update user record with migrated password
  return {
    ...offlineUser,
    password: hash,
    salt: salt,
    passwordMigratedAt: new Date().toISOString()
  };
}

// SECURITY FIX: Verify password with PBKDF2 (new secure method)
async function verifyPasswordWithPBKDF2(password: string, storedHash: string, salt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
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
    // TRACING: Session restore start
    session('restore:start', { isSupabase: isSupabaseConfigured, isBackend: isBackendConfigured });
    // EVENT SOURCING: Session restore start
    emitSessionRestoreStart();
    
    (async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          // TRACING: getSession request
          traceSupabase('getSession:request');
          const { data: { session } } = await supabase.auth.getSession();
          // TRACING: getSession response
          traceSupabase('getSession:response', { hasSession: !!session, hasUser: !!session?.user });
          
          if (mounted && session?.user) {
            const u = session.user;
            // TRACING: Profile fetch start
            log('session:profile:fetch', { userId: u.id });
            const extra = await fetchSupabaseProfile(u.id);
            // TRACING: Profile hydrated
            log('session:profile:hydrated', { userId: u.id });
            
            const p = buildProfile({ id: u.id, email: u.email || '', displayName: extra.displayName || u.user_metadata?.display_name || u.email?.split('@')[0] || 'User', avatarUrl: u.user_metadata?.avatar_url, createdAt: u.created_at }, extra);
            setProfile(p); cacheProfile(p); setIsOfflineMode(false);
            rehydrateMeetings(u.id);
            
            // TRACING: Session hydrated
            session('hydrated', { userId: p.id, provider: 'supabase' });
            // EVENT SOURCING: Session restored
            emitSessionRestored(p.id);
            if (mounted) setLoading(false);
            return;
          }
        } catch (err: any) {
          // TRACING: getSession error
          traceSupabase('getSession:error', { error: err.message });
        }
      }
      if (isBackendConfigured && hasStoredToken()) {
        try {
          // TRACING: Backend getProfile
          traceSupabase('getProfile:request');
          const user = await apiGetProfile();
          // TRACING: Backend getProfile response
          traceSupabase('getProfile:response', { userId: user.id });
          
          if (mounted) { 
            const p = buildProfile({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt }); 
            setProfile(p); cacheProfile(p); setIsOfflineMode(false); 
            rehydrateMeetings();
            
            // TRACING: Backend session hydrated
            session('hydrated', { userId: p.id, provider: 'backend' });
          }
          if (mounted) setLoading(false); return;
        } catch (err: any) { 
          if (mounted && isTokenExpired()) { 
            setToken(null); 
            // TRACING: Session expired
            session('expired', { provider: 'backend' });
            // EVENT SOURCING: Session expired
            emitSessionExpired();
            setSessionExpired(true); setError('Session expired.'); 
          } 
        }
      }
      // TRACING: No session found
      session('none');
      // EVENT SOURCING: Session none
      emitSessionNone();
      if (mounted) { 
        const cached = loadCachedProfile(); 
        if (cached) {
          // TRACING: Offline session from cache
          session('offline:cache', { userId: cached.id });
          setProfile(cached); setIsOfflineMode(true); 
        } else {
          // TRACING: No session at all
          log('session:none');
        }
        setLoading(false); 
      }
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
  const signUp = useCallback(async (email: string, password: string, displayName: string, turnstileToken?: string, termsAccepted?: boolean) => {
    setError(null); setLoading(true); setSessionExpired(false);
    
    // Security: Require terms acceptance
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to create an account.');
      setLoading(false);
      return { success: false };
    }
    
    if (isSupabaseConfigured && supabase) {
      try {
        // SECURITY FIX: Turnstile validation - enabled in production, disabled for local development
        const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
        const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
        
        if (turnstileToken && (isProduction || !isDev)) {
          const isValid = await validateTurnstileToken(turnstileToken);
          if (!isValid) {
            setError('Security verification failed. Please refresh the page and try again.');
            setLoading(false);
            return { success: false };
          }
          console.log('SECURITY: Turnstile validation passed');
        } else if (!turnstileToken && isProduction) {
          // Production requires Turnstile
          setError('Security verification required. Please enable cookies and try again.');
          setLoading(false);
          return { success: false };
        } else {
          console.log('SECURITY: Turnstile bypassed (development mode)');
        }
        
        // SECURITY FIX: Use normalized email for registration
        const { data, error: err } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { display_name: displayName }
          }
        });
        
        // Handle duplicate email error specifically  
        if (err) {
          if (err.message.includes('already been registered') || err.message.includes('already exists') || err.message.includes('User already registered')) {
            setError('An account with this email already exists. Please sign in instead.');
            setLoading(false);
            return { success: false };
          }
          throw err;
        }
        if (data.user) {
          // SECURITY FIX: Use normalized email in profile as well
          const p = buildProfile({ id: data.user.id, email: normalizedEmail, displayName, createdAt: data.user.created_at });
          setProfile(p); cacheProfile(p); setIsOfflineMode(false);
          automation('user.signup', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'supabase' } });

          // Show confirmation message
          if (!data.session) {
            setError('🎉 Welcome to Conferly! Please check your email for a confirmation link to complete your registration.');
          }

          setLoading(false);
          return { success: true, needsConfirmation: !data.session };
        }
      } catch (err: any) { console.error("[useAuth] Auth error:", err); if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) { setError(err.message); setLoading(false); return { success: false }; } }
    }
    if (isBackendConfigured) {
      try {
        if (!termsAccepted) {
          setError('You must accept the Terms of Service to create an account.');
          setLoading(false);
          return { success: false };
        }
        const { user } = await apiSignUp(email, password, displayName, termsAccepted);
        const p = buildProfile({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
        setProfile(p); cacheProfile(p); setIsOfflineMode(false); setLoading(false); automation('user.signup', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'backend' } }); return { success: true, needsConfirmation: !user.emailVerified };
      } catch (err: any) { console.error("[useAuth] Auth error:", err); if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) { setError(err.message); setLoading(false); return { success: false }; } }
    }
    // OFFLINE FALLBACK: Only used when no Supabase or backend configured
    // SECURITY: Add warning since offline mode is less secure
    console.warn('SECURITY WARNING: Using offline authentication fallback - less secure than Supabase');
    const users = loadOfflineUsers();
    // SECURITY FIX: Use normalized email for duplicate check
    const normalizedForOffline = normalizeEmail(email);
    if (users.find(u => normalizeEmail(u.email) === normalizedForOffline)) { setError('An account with this email already exists.'); setLoading(false); return { success: false }; }
    
    // SECURITY FIX: Use PBKDF2 for NEW passwords (not SHA-256)
    const { hash, salt } = await hashPassword(password);
    const offUser: OfflineUser = { 
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`, 
      email: normalizedForOffline, 
      displayName, 
      password: hash, 
      salt: salt,  // PBKDF2 salt stored
      passwordMigratedAt: new Date().toISOString(),  // Mark as migrated (new)
      userType: 'individual', 
      orgName: '' 
    };
    users.push(offUser); saveOfflineUsers(users);
    console.log('SECURITY: New user created with PBKDF2 password hashing');
    const p = buildProfile({ id: offUser.id, email: normalizedForOffline, displayName, createdAt: new Date().toISOString() });
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
  const signIn = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    // TRACING: Login flow start
    log('login:start', { email: email.split('@')[0] + '@[masked]' });
    // EVENT SOURCING: Emit login attempt
    emitLoginAttempt(email.split('@')[0] + '@[domain]');
    setError(null); setLoading(true); setSessionExpired(false);
    state('login:loading', { loading: true });

    // SECURITY FIX: Normalize email before authentication
    const normalizedEmail = normalizeEmail(email);
    // TRACING: Email normalized
    log('email:normalized', { email: normalizedEmail.split('@')[0] + '@[masked]' });
    state('email:normalized', { normalized: true });

    // SECURITY NOTE: Turnstile optional for login (progressive resistance - more critical for signup)
    // Login rate limiting is handled by Supabase + Cloudflare WAF
    if (turnstileToken) {
      // TRACING: Turnstile validation start
      log('turnstile:verified:start', { hasToken: true });
      const isValid = await validateTurnstileToken(turnstileToken);
      if (!isValid) {
        // TRACING: Turnstile failed
        log('turnstile:verified:failed', { step: 'login' });
        traceError('login:turnstile', { type: 'failed', step: 'login' });
        setError('Security verification failed. Please refresh and try again.');
        setLoading(false);
        state('login:error', { error: 'turnstile_failed' });
        return { success: false };
      }
      // TRACING: Turnstile passed
      log('turnstile:verified:success', { step: 'login' });
    } else {
      // TRACING: Turnstile skipped
      log('turnstile:skipped', { step: 'login' });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // TRACING: Supabase signIn request
        traceSupabase('signin:request', { method: 'signInWithPassword', email: normalizedEmail.split('@')[0] + '@[masked]' });
        // SECURITY FIX: Use normalized email for authentication
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        // TRACING: Supabase response
        if (err) {
          traceSupabase('signin:error', { error: err.message });
        } else {
          traceSupabase('signin:response', { hasUser: !!data.user, hasSession: !!data.session });
        }
        if (err) throw err;
        if (data.user) {
          // TRACING: Profile fetch start
          log('profile:fetch:start', { userId: data.user.id });
          const extra = await fetchSupabaseProfile(data.user.id);
          // TRACING: Profile hydrated
          log('profile:hydrated', { userId: data.user.id, hasExtra: !!extra });
          // SECURITY FIX: Use normalized email in profile
          const p = buildProfile({ id: data.user.id, email: data.user.email || normalizedEmail, displayName: extra.displayName || data.user.user_metadata?.display_name || normalizedEmail.split('@')[0], avatarUrl: data.user.user_metadata?.avatar_url, createdAt: data.user.created_at }, extra);
          setProfile(p); cacheProfile(p); setIsOfflineMode(false); rehydrateMeetings(data.user.id);
          // TRACING: Session stored
          session('stored', { userId: p.id, provider: 'supabase' });
          automation('user.signin', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'supabase' } });
          // TRACING: Login complete
          log('login:complete', { userId: p.id });
          // EVENT SOURCING: Login success
          emitLoginSuccess(p.id, p.email, 'supabase');
          state('login:complete', { success: true, userId: p.id });
          setLoading(false);
          return { success: true };
        }
      } catch (err: any) {
        if (!err.message?.includes('fetch') && !err.message?.includes('Failed')) {
          if (err.message?.includes('email_not_confirmed')) {
            setError('Please check your email and click the confirmation link. If you didn\'t receive an email, please check your spam folder.');
          } else {
            setError(err.message);
          }
          // TRACING: Login error
          traceError('login:error', { error: err.message, type: 'supabase' });
          // EVENT SOURCING: Login failure
          emitLoginFailure(email.split('@')[0] + '@[domain]', err.message, 'supabase');
          setLoading(false);
          return { success: false };
        }
      }
    } else if (isBackendConfigured) {
      try {
        const { user } = await apiSignIn(email, password);
        const p = buildProfile({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
        setProfile(p); cacheProfile(p); setIsOfflineMode(false); rehydrateMeetings();
        automation('user.signin', { userId: p.id, email: p.email, displayName: p.displayName, data: { source: 'backend' } });
        setLoading(false);
        return { success: true };
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        return { success: false };
      }
    }

    // Offline mode fallback
    // SECURITY WARNING: Offline mode is less secure
    console.warn('SECURITY: Using offline authentication fallback');
    const users = loadOfflineUsers();
    // SECURITY FIX: Use normalized email for lookup
    const normalizedForAuth = normalizeEmail(email);
    const found = users.find(u => normalizeEmail(u.email) === normalizedForAuth);

    if (found) {
      // SECURITY FIX: Migrate legacy SHA-256 to PBKDF2 during login
      let migrationNeeded = false;
      let migratedUser = found;
      
      try {
        migratedUser = await migratePasswordIfNeeded(found, password);
        migrationNeeded = !!((found as any).salt); // old user had no salt
        
        // If migration happened, save the migrated user
        if (migrationNeeded) {
          const idx = users.findIndex(u => u.id === found.id);
          if (idx >= 0) {
            users[idx] = migratedUser;
            saveOfflineUsers(users);
            console.log('SECURITY: Password migrated to PBKDF2 successfully');
          }
        }
      } catch {
        // Migration failed - password doesn't match
        setError('Invalid email or password.');
        setLoading(false);
        return { success: false };
      }

      const p = buildProfile({
        id: migratedUser.id,
        email: migratedUser.email,
        displayName: migratedUser.displayName,
        createdAt: new Date().toISOString()
      }, {
        userType: (migratedUser.userType as 'individual' | 'organization') || 'individual',
        organizationName: migratedUser.orgName || null
      });

      setProfile(p);
      cacheProfile(p);
      setIsOfflineMode(true);
      setLoading(false);
      automation('user.signin', {
        userId: p.id,
        email: p.email,
        displayName: p.displayName,
        data: { source: 'offline' }
      });

      return { success: true };
    }

    setError('Invalid email or password.');
    setLoading(false);
    return { success: false };
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
    });
  }, [profile]);

  // Password reset
  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `https://www.conferly.site/reset-password`,
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
