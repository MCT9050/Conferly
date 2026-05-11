/**
 * App.tsx - Clean routing with Supabase Auth
 */
import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import PricingPage from './marketing/PricingPage';
import { supabase, isSupabaseConfigured } from './persistence/supabase';

const defaultProps = {
  subscription: { tier: 'trial', status: 'active', currentPeriodEnd: new Date().toISOString() },
  pricing: { trial: { monthly: 0, annual: 0 }, pro: { monthly: 15, annual: 150 }, business: { monthly: 35, annual: 350 }, enterprise: { monthly: 0, annual: 0 } },
  allLimits: { 
    trial: { maxParticipants: 500, maxDurationMinutes: 40 },
    pro: { maxParticipants: 500, maxDurationMinutes: -1 },
    business: { maxParticipants: 500, maxDurationMinutes: -1 },
    enterprise: { maxParticipants: 500, maxDurationMinutes: -1 },
  },
  setView: () => {},
  onUpgrade: () => {},
};

function HomePage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '40px', 
      fontFamily: 'system-ui',
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold' }}>🎙️ Conferly</h1>
      <p style={{ fontSize: '24px', marginTop: '20px' }}>Connecting with Purpose</p>
      
      <nav style={{ marginTop: '40px', fontSize: '18px' }}>
        <Link to="/auth" style={{ color: 'white', marginRight: '20px' }}>🔐 Login</Link>
        <Link to="/pricing" style={{ color: 'white' }}>💰 Pricing</Link>
      </nav>
    </div>
  );
}

// Auth form component to use hooks inside
function AuthForm() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Sign up handler using Supabase SDK
  const handleSignUp = useCallback(async (
    email: string, 
    password: string, 
    displayName: string, 
    _turnstileToken?: string
  ): Promise<{ success: boolean; needsConfirmation?: boolean }> => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError('Supabase not configured');
      return { success: false };
    }
    
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      
      if (error) {
        setAuthError(error.message);
        return { success: false };
      }
      
      if (data.user && !data.session) {
        return { success: true, needsConfirmation: true };
      }
      
      return { success: true };
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Signup failed');
      return { success: false };
    } finally {
      setAuthLoading(false);
    }
  }, []);
  
  // Sign in handler using Supabase SDK
  const handleSignIn = useCallback(async (
    email: string, 
    password: string, 
    _turnstileToken?: string
  ): Promise<{ success: boolean }> => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError('Supabase not configured');
      return { success: false };
    }
    
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        setAuthError(error.message);
        return { success: false };
      }
      
      if (data.user) {
        return { success: true };
      }
      
      setAuthError('Login failed');
      return { success: false };
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
      return { success: false };
    } finally {
      setAuthLoading(false);
    }
  }, []);
  
  // Resend confirmation handler
  const handleResendConfirmation = useCallback(async (email: string): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    
    if (error) {
      throw error;
    }
  }, []);
  
  // Reset password handler
  const handleResetPassword = useCallback(async (email: string): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=true`,
    });
    
    if (error) {
      throw error;
    }
  }, []);
  
  // Clear error handler
  const clearError = useCallback(() => setAuthError(null), []);
  
  return (
    <AuthPage
      onSignUp={handleSignUp}
      onSignIn={handleSignIn}
      onResendConfirmation={handleResendConfirmation}
      onResetPassword={handleResetPassword}
      error={authError}
      clearError={clearError}
      loading={authLoading}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthForm />} />
        <Route path="/pricing" element={<PricingPage {...defaultProps} />} />
        {/* Catch-all fallback - redirects unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}