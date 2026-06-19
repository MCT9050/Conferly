"use server";

/**
 * Sends a password-recovery email using Supabase Auth's native
 * resetPasswordForEmail, which triggers the Supabase mailer
 * configured in the Supabase dashboard.
 */

import { getSupabaseServerClient } from '@/lib/supabaseServerClient';

export type ForgotPasswordResult = {
  success?: boolean;
  error?: string;
};

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  try {
    if (!email || !email.includes('@')) {
      return { error: 'Please enter a valid email address.' };
    }

    const supabase = getSupabaseServerClient();

    // Ask Supabase to generate and send its branded reset email.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.conferly.site/auth/update-password',
    });

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[PasswordReset] Supabase error:', error.message);
      }
    }

    return { success: true };
  } catch {
    return { error: 'Unable to process request. Please try again later.' };
  }
}
