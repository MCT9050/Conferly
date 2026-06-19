"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Lock, User, ArrowRight, Eye, EyeOff,
  AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import Logo from './Logo';
import { warmupAPIs } from '../app/actions/system-warmup';

interface AuthPageProps {
  onSignUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; needsConfirmation?: boolean }>;
  onSignIn: (email: string, password: string) => Promise<{ success: boolean }>;
  error: string | null;
  clearError: () => void;
  loading: boolean;
}

export default function AuthPage({ onSignUp, onSignIn, error, clearError, loading }: AuthPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Fire-and-forget warmup: wake up serverless APIs before user logs in
    warmupAPIs().then((result) => {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('[Warmup]', result);
      }
    }).catch(() => {
      // Silently ignore — warmup is best-effort and never blocks login
    });
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof window === 'undefined') return;

    const update = () => {
      const hiddenAncestor = root.closest('[data-aria-hidden="true"]');
      if (hiddenAncestor) {
        try { (root as any).inert = true; } catch (e) {}
        root.setAttribute('aria-hidden', 'true');

        const focusable = root.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]');
        focusable.forEach(el => {
          if (el.hasAttribute('data-prev-tabindex')) return;
          const prev = el.getAttribute('tabindex');
          el.setAttribute('data-prev-tabindex', prev ?? '');
          el.setAttribute('tabindex', '-1');
          if (el.tagName === 'BUTTON') {
            const btn = el as HTMLButtonElement;
            if (!btn.disabled) {
              btn.setAttribute('data-prev-disabled', 'false');
              btn.disabled = true;
            }
          }
        });
      } else {
        try { (root as any).inert = false; } catch (e) {}
        root.removeAttribute('aria-hidden');

        const restored = root.querySelectorAll<HTMLElement>('[data-prev-tabindex], [data-prev-disabled]');
        restored.forEach(el => {
          const prev = el.getAttribute('data-prev-tabindex');
          if (prev === '') el.removeAttribute('tabindex');
          else if (prev !== null) el.setAttribute('tabindex', prev);
          el.removeAttribute('data-prev-tabindex');
          if (el.hasAttribute('data-prev-disabled')) {
            el.removeAttribute('data-prev-disabled');
            try { (el as HTMLButtonElement).disabled = false; } catch (e) {}
          }
        });
      }
    };

    update();
    const mo = new MutationObserver(update);
    mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-aria-hidden'] });
    return () => mo.disconnect();
  }, []);
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState(false);

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    clearError();
    setConfirmation(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (mode === 'signup') {
      if (!displayName.trim()) return;
      const result = await onSignUp(email.trim(), password, displayName.trim());
      if (result.success && result.needsConfirmation) {
        setConfirmation(true);
      }
    } else {
      await onSignIn(email.trim(), password);
    }
  };

  const isValid = mode === 'signup'
    ? email.trim().length > 0 && password.length >= 6 && displayName.trim().length > 0
    : email.trim().length > 0 && password.length >= 6;

  return (
    <div ref={containerRef as any} className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo size="xl" />
          </div>
          <p className="text-sm text-slate-400">
            {mode === 'signin' ? 'Welcome back. Sign in to continue.' : 'Create your free account to get started.'}
          </p>
        </div>

        {/* Confirmation message */}
        {confirmation && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <div className="text-sm font-medium text-green-400">Check your email</div>
              <div className="text-xs text-green-400/70">
                We've sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </div>
            </div>
          </div>
        )}

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
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
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

            {/* Password */}
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
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
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
            {mode === 'signup' && password.length > 0 && password.length < 6 && (
              <p className="text-[10px] text-amber-400 mt-1.5">Password must be at least 6 characters</p>
            )}
            {mode === 'signin' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => router.push('/auth/forgot-password')} className="text-sm text-amber-500 hover:text-amber-400 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}
          </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg glow-blue"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer text */}
          <p className="text-center text-xs text-slate-500">
            {mode === 'signin' ? (
              <>Don't have an account?{' '}
                <button onClick={() => switchMode('signup')} className="text-blue-400 hover:text-blue-300">
                  Sign up free
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
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="w-3 h-3" />
          <span>Encrypted authentication • Works offline too</span>
        </div>
      </div>
    </div>
  );
}