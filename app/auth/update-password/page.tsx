'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Logo from '@/components/Logo';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError('Configuration error — missing Supabase credentials.');
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error: setSessionError } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError || !data.session) {
          setError('Invalid or expired recovery link. Please request a new one.');
        }
      } else {
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          setError('Invalid or expired recovery link. Please request a new one.');
        }
      }
    }
    void init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError('Configuration error — missing Supabase credentials.');
        setLoading(false);
        return;
      }
      const { error: updateError } = await client.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Redirect to login after short delay with success param
      setTimeout(() => {
        router.push('/auth?reset=success');
      }, 2000);
    } catch {
      setError('Unable to update password. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <Logo size="xl" />
          </div>
          <div className="glass rounded-2xl p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-200">Password updated</h2>
            <p className="text-sm text-slate-400">
              Your password has been changed successfully. Redirecting to sign in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo size="xl" />
        </div>

        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-slate-200">Update your password</h2>
            <p className="text-sm text-slate-400">
              Choose a strong password to secure your account.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                <Lock className="w-3.5 h-3.5" />
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                <Lock className="w-3.5 h-3.5" />
                Confirm new password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Update password'
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => router.push('/auth')}
              className="inline-flex items-center gap-2 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}