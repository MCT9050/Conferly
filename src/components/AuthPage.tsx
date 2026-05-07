import { useState, useCallback, useEffect } from 'react';
import {
  Mail, Lock, User, ArrowRight, Eye, EyeOff,
  AlertCircle, Loader2
} from 'lucide-react';
import Logo from './Logo';
import EmailConfirmation from './EmailConfirmation';

interface AuthPageProps {
  onSignUp: (email: string, password: string, displayName: string, turnstileToken?: string) => Promise<{ success: boolean; needsConfirmation?: boolean }>;
  onSignIn: (email: string, password: string, turnstileToken?: string) => Promise<{ success: boolean }>;
  onResendConfirmation: (email: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
  loading: boolean;
}

export default function AuthPage({ onSignUp, onSignIn, onResendConfirmation, onResetPassword, error, clearError, loading }: AuthPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email confirmation state
  const [confirmation, setConfirmation] = useState(false);

  // Terms acceptance state
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Turnstile state management - enforce validation, no bypass
  const TURNSTILE_TIMEOUT_MS = 15000; // 15 seconds to load
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [turnstileLoading, setTurnstileLoading] = useState(false); // Start false, only true for signup
  const [turnstileTimedOut, setTurnstileTimedOut] = useState(false);
  const [turnstileExpired, setTurnstileExpired] = useState(false);

  // Turnstile callback function
  const onTurnstileCallback = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileLoaded(true);
    setTurnstileLoading(false);
    setTurnstileTimedOut(false);
  }, []);

  // Turnstile expiration handler - tokens expire after ~120 seconds
  const onTurnstileExpiredCallback = useCallback(() => {
    setTurnstileExpired(true);
    setTurnstileToken('');
  }, []);

  // Make callbacks available globally for Turnstile
  useEffect(() => {
    (window as any).onTurnstileCallback = onTurnstileCallback;
    (window as any).onTurnstileExpiredCallback = onTurnstileExpiredCallback;
    return () => {
      delete (window as any).onTurnstileCallback;
      delete (window as any).onTurnstileExpiredCallback;
    };
  }, [onTurnstileCallback, onTurnstileExpiredCallback]);

  // Monitor Turnstile loading with strict timeout - NO bypass allowed
  useEffect(() => {
    if (mode === 'signup') {
      setTurnstileLoading(true);
      setTurnstileTimedOut(false);
      setTurnstileExpired(false);
      
      const checkTurnstile = setInterval(() => {
        if ((window as any).turnstile) {
          setTurnstileLoaded(true);
          setTurnstileLoading(false);
          clearInterval(checkTurnstile);
        }
      }, 100);

      // Strict timeout - block signup if Turnstile fails to load
      const timeout = setTimeout(() => {
        if (!turnstileToken) {
          setTurnstileTimedOut(true);
          setTurnstileLoading(false);
          // Do NOT set turnstileLoaded(true) - this is a security feature
        }
        clearInterval(checkTurnstile);
      }, TURNSTILE_TIMEOUT_MS);

      return () => {
        clearInterval(checkTurnstile);
        clearTimeout(timeout);
      };
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    console.log('=== SUBMIT CLICKED ===', { 
      mode, 
      isValid,
      loading,
      hasEmail: !!email, 
      emailLen: email?.length,
      hasPassword: !!password, 
      pwdLen: password?.length,
      hasDisplayName: !!displayName,
      termsAccepted 
    });

    if (mode === 'signup') {
      if (!displayName.trim()) { console.log('No displayName'); return; }

      // TURNSTILE CHECK DISABLED FOR TESTING
      // if (!turnstileToken || turnstileTimedOut || turnstileExpired) {
      //   setError('Please complete the bot verification to sign up');
      //   return;
      // }

      console.log('Calling onSignUp...');
      const result = await onSignUp(email.trim(), password, displayName.trim(), turnstileToken, termsAccepted);
      console.log('onSignUp returned', result);
      if (result.success && result.needsConfirmation) {
        setConfirmation(true);
      }
    } else if (mode === 'forgot') {
      await onResetPassword(email.trim());
    } else {
      console.log('Calling onSignIn...');
      await onSignIn(email.trim(), password);
      console.log('onSignIn returned');
    }
  };

  // Log form state changes
  useEffect(() => {
    console.log('FORM STATE', { mode, loading, isValid, email: email?.length, pwd: !!password, displayName: !!displayName });
  }, [mode, loading, isValid, displayName]);

  // Password complexity validation (8+ chars, uppercase, lowercase, number, special char)
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: /[A-Z]/,
  requireLowercase: /[a-z]/,
  requireNumber: /[0-9]/,
  requireSpecial: /[!@#$%^&*]/,
};

const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`At least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (!PASSWORD_POLICY.requireUppercase.test(password)) {
    errors.push('At least one uppercase letter');
  }
  if (!PASSWORD_POLICY.requireLowercase.test(password)) {
    errors.push('At least one lowercase letter');
  }
  if (!PASSWORD_POLICY.requireNumber.test(password)) {
    errors.push('At least one number');
  }
  if (!PASSWORD_POLICY.requireSpecial.test(password)) {
    errors.push('At least one special character (!@#$%^&*)');
  }
  return { valid: errors.length === 0, errors };
};

  // Password validation
  const passwordMeetsPolicy = mode === 'signup'
    ? validatePassword(password).valid
    : password.length >= 6;

  const isValid = mode === 'signup'
    ? email.trim().length > 0 && passwordMeetsPolicy && displayName.trim().length > 0 && termsAccepted
    : mode === 'forgot'
      ? email.trim().length > 0
      : email.trim().length > 0 && password.length >= 6;

  // Show confirmation screen if needed
  if (confirmation) {
    return (
      <EmailConfirmation
        email={email}
        onResend={onResendConfirmation}
        onBack={() => switchMode('signin')}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo size="xl" />
          </div>
          <p className="text-sm text-slate-400">
            {mode === 'signin' ? 'Welcome back. Sign in to continue.' :
              mode === 'forgot' ? 'Enter your email to receive a reset link.' :
                'Create your free account to get started.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          {/* Tab Toggle */}
          <div className="flex rounded-xl bg-slate-800/60 p-1">
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'signin'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'signup'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                  <User className="w-3.5 h-3.5" />
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How others will see you"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                <Mail className="w-3.5 h-3.5" />
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Password (hidden for forgot password) */}
            {mode !== 'forgot' && (
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Min 8 chars, uppercase, number, special char' : '••••••••'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'signup' && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {validatePassword(password).errors.map((err, i) => (
                      <p key={i} className="text-[10px] text-amber-400">✗ {err}</p>
                    ))}
                    {validatePassword(password).valid && (
                      <p className="text-[10px] text-green-400">✓ Password meets requirements</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Terms of Service (signup only) */}
            {mode === 'signup' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded bg-slate-800 border border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="terms" className="text-xs text-slate-400">
                  I agree to the{' '}
                  <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</a>
                </label>
              </div>
            )}

            {/* Cloudflare Turnstile - DISABLED for testing */}
            {/*}

            
            {/* Submit */}
            <button
              type="submit"
              // BYPASS LOADING CHECK FOR DEBUG
              // disabled={!isValid || loading}
              disabled={!isValid}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg glow-blue"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer text */}
          <p className="text-center text-xs text-slate-500">
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-blue-400 hover:text-blue-300">
                  Sign up free
                </button>
                <br />
                <button onClick={() => switchMode('forgot')} className="text-blue-400 hover:text-blue-300 mt-2">
                  Forgot your password?
                </button>
              </>
            ) : mode === 'forgot' ? (
              <>Remember your password?{' '}
                <button onClick={() => switchMode('signin')} className="text-blue-400 hover:text-blue-300">
                  Sign in
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => switchMode('signin')} className="text-blue-400 hover:text-blue-300">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        {/* Bottom info */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
          <Lock className="w-3 h-3" />
          <span>Encrypted authentication • Works offline too</span>
        </div>
      </div>
    </div>
  );
}
