'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestPasswordReset } from '@/app/actions/auth-recovery';
import type { ForgotPasswordResult } from '@/app/actions/auth-recovery';
import Logo from '@/components/Logo';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<ForgotPasswordResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const result = await requestPasswordReset(email.trim());
    setStatus(result);
    setLoading(false);
  };

  if (status?.success) {
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
            <h2 className="text-lg font-semibold text-slate-200">Check your inbox!</h2>
            <p className="text-sm text-slate-400">
              If an account exists for <strong className="text-slate-200">{email}</strong>, you will receive a reset link shortly.
            </p>
            <Link
              href="/auth"
              className="inline-block w-full py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 text-sm font-medium hover:bg-slate-700/60 transition-colors"
            >
              Return to login
            </Link>
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
            <h2 className="text-lg font-semibold text-slate-200">Forgot your password?</h2>
            <p className="text-sm text-slate-400">
              Enter your email address and we&#39;ll send you a reset link.
            </p>
          </div>

          {status?.error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{status.error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5 font-medium">
                <Mail className="w-3.5 h-3.5" />
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          <div className="text-center">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}