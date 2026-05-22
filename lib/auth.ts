// lib/auth.ts
// Production-grade server-first session provider for Conferly
// SSR-safe, no client-side global state. Integrate your real backend or Auth.js provider here.

import { cookies } from 'next/headers';
import { getSupabaseAuthUserUrl, getSupabaseApiKey, requireSupabaseConfig } from './supabase';

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
  participant: ['view_dashboard', 'join_lobby', 'start_meeting', 'access_pricing'],
  moderator: ['view_dashboard', 'join_lobby', 'start_meeting', 'manage_participants', 'access_pricing'],
  owner: ['view_dashboard', 'join_lobby', 'start_meeting', 'manage_participants', 'access_pricing', 'view_reports'],
};

const COOKIE_NAMES = ['supabase-auth-token', 'sb-access-token'];

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((map, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) return map;
    map[name] = rest.join('=');
    return map;
  }, {});
}

function parseSupabaseAccessToken(cookieValue: string): string | null {
  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);
    if (parsed?.access_token) return parsed.access_token;
  } catch {
    // If the value is not JSON, fallback to raw value.
  }
  return cookieValue || null;
}

async function parseSessionToken(cookieHeader?: string) {
  const cookiesFromHeader = parseCookieHeader(cookieHeader ?? null);

  for (const name of COOKIE_NAMES) {
    const value = cookiesFromHeader[name];
    if (!value) continue;
    const token = parseSupabaseAccessToken(value);
    if (token) return token;
  }

  // Server component path using next/headers cookies()
  if (!cookieHeader) {
    const cookieStore = await cookies();
    for (const name of COOKIE_NAMES) {
      const cookie = cookieStore.get(name);
      if (!cookie) continue;
      const token = parseSupabaseAccessToken(cookie.value);
      if (token) return token;
    }
  }

  return null;
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, 'base64').toString('utf8');
}

function decodeJwtExpiry(jwt: string): string | null {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload?.exp) return null;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

function getUserRole(user: any): Session['role'] {
  const role = user?.user_metadata?.role || user?.app_metadata?.role;
  if (ROLE_HIERARCHY.includes(role)) {
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
  return allowedRoles.some((requiredRole) => roleRank(role) >= roleRank(requiredRole));
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function authorizeSession(
  session: Session | null,
  options: { requiredRoles?: Role | Role[]; requiredPermission?: Permission } = {}
): session is Session {
  if (!session) return false;
  if (options.requiredRoles && !roleSatisfies(session.role, options.requiredRoles)) {
    return false;
  }
  if (options.requiredPermission && !hasPermission(session.role, options.requiredPermission)) {
    return false;
  }
  return true;
}

export async function getAuthorizedSession(
  options: { requiredRoles?: Role | Role[]; requiredPermission?: Permission; cookieHeader?: string } = {}
): Promise<Session | null> {
  const session = await getServerSession(options.cookieHeader);
  if (!authorizeSession(session, options)) return null;
  return session;
}

async function fetchSupabaseUser(accessToken: string) {
  const response = await fetch(getSupabaseAuthUserUrl(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: getSupabaseApiKey(),
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export async function getServerSession(cookieHeader?: string): Promise<Session | null> {
  const accessToken = await parseSessionToken(cookieHeader);
  if (!accessToken) return null;

  requireSupabaseConfig();
  const user = await fetchSupabaseUser(accessToken);
  if (!user?.id) return null;

  const expires = decodeJwtExpiry(accessToken) || new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    userId: user.id,
    email: user.email || undefined,
    role: getUserRole(user),
    expires,
  };
}
