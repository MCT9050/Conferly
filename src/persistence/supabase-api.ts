// Conferly Supabase API Client
// Direct database operations using Supabase client
// Replaces the Express server API calls

import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

// ─── Types ───

export interface SupabaseUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  plan_tier: string;
  billing_cycle: string;
  plan_period_end: string | null;
  meetings_this_month: number;
  meetings_month: number;
  created_at: string;
  updated_at: string;
  user_type?: 'individual' | 'organization';
  organization_name?: string;
  organization_size?: number;
  organization_industry?: string;
  onboarding_complete?: boolean;
}

export interface SupabaseMeeting {
  id: string;
  user_id: string;
  room_code: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  participant_count: number;
  has_recording: boolean;
  created_at: string;
}

export interface SupabasePayment {
  id: string;
  user_id: string;
  plan_tier: string;
  billing_cycle: string;
  amount_zar: number;
  currency: string;
  status: string;
  peach_transaction_id: string | null;
  created_at: string;
}

export interface SupabaseNote {
  id: string;
  meeting_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ─── Auth ───

export async function supabaseSignUp(email: string, password: string, displayName: string): Promise<{ user: SupabaseUser; session: Session }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error) throw error;
  if (!data.user || !data.session) throw new Error('Signup failed');

  // Get the user profile (auto-created by trigger)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!profile) throw new Error('Profile not created');

  return {
    user: profile as SupabaseUser,
    session: data.session
  };
}

export async function supabaseSignIn(email: string, password: string): Promise<{ user: SupabaseUser; session: Session }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  if (!data.user || !data.session) throw new Error('Sign in failed');

  // Get the user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!profile) throw new Error('Profile not found');

  return {
    user: profile as SupabaseUser,
    session: data.session
  };
}

export async function supabaseSignOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function supabaseGetCurrentUser(): Promise<SupabaseUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile as SupabaseUser || null;
}

// ─── Profile Management ───

export async function supabaseUpdateProfile(updates: {
  display_name?: string;
  avatar_url?: string;
  user_type?: 'individual' | 'organization';
  organization_name?: string;
  organization_size?: number;
  organization_industry?: string;
  onboarding_complete?: boolean;
}): Promise<SupabaseUser> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as SupabaseUser;
}

// ─── Subscription Management ───

export async function supabaseGetSubscription(): Promise<Pick<SupabaseUser, 'plan_tier' | 'billing_cycle' | 'plan_period_end'>> {
  const user = await supabaseGetCurrentUser();
  if (!user) throw new Error('Not authenticated');

  return {
    tier: user.plan_tier,
    billingCycle: user.billing_cycle,
    currentPeriodEnd: user.plan_period_end
  };
}

export async function supabaseUpgradeSubscription(
  tier: string,
  billingCycle: string,
  amountZar?: number,
  peachTransactionId?: string
): Promise<{ tier: string; billingCycle: string; currentPeriodEnd: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Update subscription
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      plan_tier: tier,
      billing_cycle: billingCycle,
      plan_period_end: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (updateError) throw updateError;

  // Record payment if provided
  if (amountZar) {
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        plan_tier: tier,
        billing_cycle: billingCycle,
        amount_zar: amountZar,
        peach_transaction_id: peachTransactionId
      });

    if (paymentError) throw paymentError;
  }

  return {
    tier,
    billingCycle,
    currentPeriodEnd: periodEnd
  };
}

// ─── Payments ───

export async function supabaseGetPayments(): Promise<SupabasePayment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data as SupabasePayment[];
}

// ─── Meetings ───

export async function supabaseCreateMeeting(roomCode: string, title?: string): Promise<{ id: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      room_code: roomCode,
      title: title || null
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function supabaseEndMeeting(id: string, durationSeconds: number, participantCount: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('meetings')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      participant_count: participantCount
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function supabaseGetMeetings(): Promise<SupabaseMeeting[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data as SupabaseMeeting[];
}

// ─── Notes ───

export async function supabaseGetNote(meetingId: string): Promise<SupabaseNote | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data as SupabaseNote || null;
}

export async function supabaseUpdateNote(meetingId: string, content: string): Promise<SupabaseNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('notes')
    .upsert({
      meeting_id: meetingId,
      user_id: user.id,
      content,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data as SupabaseNote;
}

// ─── Health Check ───

export async function supabaseHealthCheck(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

// ─── Auth State Management ───

export function supabaseOnAuthStateChange(callback: (user: SupabaseUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await supabaseGetCurrentUser();
      callback(profile);
    } else {
      callback(null);
    }
  });
}
