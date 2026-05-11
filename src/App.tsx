/**
 * App.tsx - 5-Layer Architecture Router
 * Strict gatekeeper between Unauthenticated and Authenticated pathways
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from './persistence/supabase';

// Marketing Layer - Public flow
import LandingPage from './marketing/LandingPage';
import PricingPage from './marketing/PricingPage';
import AuthPage from './components/AuthPage';

// Authenticated Home Layer
import Dashboard from './dashboard/Dashboard';
import { useMeetingPersistence, saveSession, clearSession } from './persistence/useMeetingPersistence';
import ReconnectBanner from './components/ReconnectBanner';

// Runtime Layer - In-meeting
import MeetingRoom from './runtime/MeetingRoom';
import Lobby from './dashboard/Lobby';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  onboardingComplete: boolean;
}

interface AppState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

// AuthGuard - Protects private routes
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    profile: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode - grant access
      setState({
        profile: { id: 'demo', email: 'demo@conferly.site', displayName: 'Demo User', onboardingComplete: true },
        loading: false,
        error: null,
        isAuthenticated: true,
      });
      return;
    }

    // Check auth state
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        setState({ profile: null, loading: false, error: null, isAuthenticated: false });
      } else {
        // Fetch profile
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data: profile }) => {
          setState({
            profile: profile as UserProfile | null,
            loading: false,
            error: null,
            isAuthenticated: true,
          });
        });
      }
    });
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check onboarding complete
  if (state.profile && !state.profile.onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function App() {
  // Supabase handlers
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Sign up
  const handleSignUp = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    _turnstileToken?: string
  ): Promise<{ success: boolean; needsConfirmation?: boolean }> => {
    if (!isSupabaseConfigured) {
      setUser({ id: 'demo', email, displayName, onboardingComplete: true });
      return { success: true };
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });

      if (error) {
        setAuthError(error.message);
        return { success: false };
      }

      if (data.user && !data.session) {
        return { success: true, needsConfirmation: true };
      }

      setUser({ id: data.user!.id, email, displayName, onboardingComplete: false });
      return { success: true };
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Signup failed');
      return { success: false };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Sign in
  const handleSignIn = useCallback(async (
    email: string,
    password: string,
    _turnstileToken?: string
  ): Promise<{ success: boolean }> => {
    if (!isSupabaseConfigured) {
      setUser({ id: 'demo', email, displayName: 'Demo User', onboardingComplete: true });
      return { success: true };
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthError(error.message);
        return { success: false };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        setUser(profile as UserProfile);
      }

      return { success: true };
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
      return { success: false };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Sign out
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Views */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route
          path="/auth"
          element={
            <AuthPage
              onSignUp={handleSignUp}
              onSignIn={handleSignIn}
              onResendConfirmation={async () => {}}
              onResetPassword={async () => {}}
              error={authError}
              clearError={clearError}
              loading={authLoading}
            />
          }
        />

        {/* Private Views (Protected) */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <Dashboard
                onSignOut={handleSignOut}
                user={user}
                subscription={{ tier: 'trial', status: 'active', currentPeriodEnd: new Date().toISOString() }}
              />
            </AuthGuard>
          }
        />
        <Route
          path="/lobby"
          element={
            <AuthGuard>
              <Lobby />
            </AuthGuard>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <AuthGuard>
              <MeetingRoom />
            </AuthGuard>
          }
        />

        {/* Onboarding redirect */}
        <Route path="/onboarding" element={<Navigate to="/auth" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
