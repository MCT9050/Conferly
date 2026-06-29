 'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthPage from '@/components/AuthPage';

export default function AuthPageRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearError = () => setError(null);

  const getDefaultProduct = () => {
    return (searchParams?.get('product') as string) || null;
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const product = getDefaultProduct();
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, product }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result?.error || 'Sign in failed.');
        return { success: false };
      }

      const redirectTo = (searchParams?.get('redirect') as string) || '/dashboard';
      router.replace(redirectTo);
      return { success: true };
    } catch (err) {
      setError('Unable to sign in. Please try again.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    setError(null);

    try {
      const product = getDefaultProduct();
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, product }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result?.error || 'Sign up failed.');
        return { success: false };
      }

      return { success: true, needsConfirmation: result.needsConfirmation ?? false };
    } catch (err) {
      setError('Unable to create account. Please try again.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPage
      onSignIn={signIn}
      onSignUp={signUp}
      error={error}
      clearError={clearError}
      loading={loading}
    />
  );
}
