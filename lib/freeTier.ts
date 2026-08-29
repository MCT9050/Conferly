// lib/freeTier.ts
// Server-side access layer for the Universal Registered Free Tier.
//
// Database contract (supabase/migrations/20260829120000_free_tier_entitlement.sql):
//   - get_free_usage_status(p_product_line text) -> jsonb
//       Must run under the USER's JWT (user-scoped client). The database
//       derives identity from auth.uid() and independently requires the JWT
//       role claim 'authenticated'; a service-role call reports "anonymous".
//   - consume_free_usage(p_user_id uuid, p_product_line text,
//                        p_minutes numeric, p_occurred_at timestamptz)
//       USER-scoped calls must pass their own user id (identity is enforced);
//       SERVICE calls may account usage for any user (webhook/lifecycle
//       accounting). The server clock buckets the usage day for non-service
//       callers. Paid entitlements take precedence inside the RPC (charges 0).
//
// Limits: 30 minutes per eligible usage day, 3 eligible usage days,
// per (user_id, product_line). Anonymous users are always denied.

import { createSupabaseServerClient } from './supabase/server';
import { getSupabaseServerClient } from './supabaseServerClient';

export const FREE_TIER_MAX_DAILY_MINUTES = 30;
export const FREE_TIER_MAX_ELIGIBLE_DAYS = 3;

export type FreeTierProductLine = 'meet' | 'class';

export type FreeTierStatus = {
  paid: boolean;
  status: 'paid' | 'free' | 'anonymous' | 'invalid';
  freeAccess: boolean;
  productLine: FreeTierStatusProduct;
  exhausted: boolean;
  eligibleDaysUsed: number;
  remainingEligibleDays: number;
  minutesUsedToday: number | null;
  minutesRemainingToday: number;
};

type FreeTierStatusProduct = string;

export type FreeTierConsumeResult = {
  allowed: boolean;
  reason?: string;
  paid?: boolean;
  consumed?: boolean;
  consumptionMinutes?: number;
  eligibleDaysUsed?: number;
};

/**
 * Read the caller's free-tier state for a product line.
 * MUST be called from a route/server context holding the user's session
 * cookies; identity and role are enforced by the database, not here.
 */
export async function getFreeTierStatus(
  productLine: FreeTierProductLine
): Promise<FreeTierStatus | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_free_usage_status', {
    p_product_line: productLine,
  });
  if (error) return null;
  return (data as unknown) as FreeTierStatus | null;
}

/**
 * Account used free-tier minutes (service-side accounting, e.g. LiveKit
 * participant-leave duration for Meet, lesson elapsed time for Class).
 * Runs as service_role: may account usage on behalf of any user. The RPC
 * refuses non-positive minutes, unknown product lines, and charges nothing
 * when a paid entitlement supersedes the free tier.
 */
export async function consumeFreeUsage(
  userId: string,
  productLine: FreeTierProductLine,
  minutes: number,
  occurredAt: Date = new Date()
): Promise<FreeTierConsumeResult | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc('consume_free_usage', {
    p_user_id: userId,
    p_product_line: productLine,
    p_minutes: minutes,
    p_occurred_at: occurredAt.toISOString(),
  });
  if (error) return null;
  return (data as unknown) as FreeTierConsumeResult | null;
}

/**
 * True when the user may start free usage of the product right now
 * (registered, not exhausted, daily allowance not spent). Paid users also
 * return freeAccess=true (status 'paid') but are never limit-enforced.
 */
export function canStartFreeUsage(status: FreeTierStatus | null): boolean {
  if (!status) return false;
  if (status.status === 'paid') return true;
  return (
    status.freeAccess &&
    !status.exhausted &&
    (status.minutesRemainingToday ?? 0) > 0
  );
}
