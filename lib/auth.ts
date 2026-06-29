// lib/auth.ts
// Production-grade server-first session provider for Conferly.
// SSR-safe, uses @supabase/ssr with header-first session resolution.
// Middleware-forwarded headers (x-conferly-*) are trusted when present.

import { createSupabaseServerClient } from './supabase/server';

export type Role = 'owner' | 'moderator' | 'participant' | 'guest';
export type Permission =
  | 'view_dashboard'
  | 'join_lobby'
  | 'start_meeting'
  | 'manage_participants'
  | 'access_pricing'
  | 'view_reports';

export interface Session {
  userId: string;
  email?: string;
  role: Role;
  expires: string;
}

export const DEFAULT_ROLE: Role = 'participant';
export const ROLE_HIERARCHY: Role[] = ['guest', 'participant', 'moderator', 'owner'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  guest: ['access_pricing'],
  participant: [
    'view_dashboard',
    'join_lobby',
    'start_meeting',
    'access_pricing',
  ],
  moderator: [
    'view_dashboard',
    'join_lobby',
    'start_meeting',
    'manage_participants',
    'access_pricing',
  ],
  owner: [
    'view_dashboard',
    'join_lobby',
    'start_meeting',
    'manage_participants',
    'access_pricing',
    'view_reports',
  ],
};

function getUserRole(user: {
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Session['role'] {
  const role = (user?.user_metadata?.role ??
    user?.app_metadata?.role) as Role | undefined;
  if (role && ROLE_HIERARCHY.includes(role)) {
    return role;
  }
  return DEFAULT_ROLE;
}

function normalizeRoles(required: Role | Role[]): Role[] {
  return Array.isArray(required) ? required : [required];
}

export function roleRank(role: Role): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function roleSatisfies(role: Role, required: Role | Role[]): boolean {
  const allowedRoles = normalizeRoles(required);
  return allowedRoles.some(
    (requiredRole) => roleRank(role) >= roleRank(requiredRole)
  );
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function authorizeSession(
  session: Session | null,
  options: {
    requiredRoles?: Role | Role[];
    requiredPermission?: Permission;
  } = {}
): session is Session {
  if (!session) return false;
  if (
    options.requiredRoles &&
    !roleSatisfies(session.role, options.requiredRoles)
  ) {
    return false;
  }
  if (
    options.requiredPermission &&
    !hasPermission(session.role, options.requiredPermission)
  ) {
    return false;
  }
  return true;
}

export async function getAuthorizedSession(
  options: {
    requiredRoles?: Role | Role[];
    requiredPermission?: Permission;
    request?: Request;
  } = {}
): Promise<Session | null> {
  const session = await getServerSession(options.request);
  if (!authorizeSession(session, options)) return null;
  return session;
}

/**
 * Resolve the current user session (cookie-based validation).
 *
 * This function is intentionally single-source-of-truth:
 * - It always validates using the Supabase SSR client + cookies.
 * - It does NOT rely on any middleware-injected headers.
 *
 * Pass the `request` when calling from Route Handlers so the SDK can read
 * the active request cookie store.
 */
export async function getServerSession(
  request?: Request
): Promise<Session | null> {
  try {
    const supabase = createSupabaseServerClient({ request });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[AUTH_SESSION] getUser error:', userError);
      }
      return null;
    }

    if (!user) return null;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[AUTH_SESSION] getSession error:', sessionError);
      }
      return null;
    }

    const expires =
      session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      userId: user.id,
      email: user.email ?? undefined,
      role: getUserRole(user),
      expires,
    };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AUTH_SESSION] unexpected error:', err);
    }
    return null;
  }
}
