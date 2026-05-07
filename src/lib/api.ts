/**
 * Conferly Backend API Client
 * JWT auth with auto-expiry detection and 401 re-auth trigger.
 * Falls back to localStorage when backend is unreachable.
 *
 * @module api
 */
// Conferly Backend API Client
// JWT auth with auto-expiry detection and 401 re-auth trigger.
// Falls back to localStorage when backend is unreachable.

const API_URL = import.meta.env.VITE_API_URL || '';
export const isBackendConfigured = !!(API_URL && API_URL.startsWith('http'));

const TOKEN_KEY = 'conferly_jwt';
const TOKEN_ISSUED_KEY = 'conferly_jwt_issued';
const REFRESH_TOKEN_KEY = 'conferly_refresh';

// ─── Token Management ───

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_ISSUED_KEY, Date.now().toString());
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_ISSUED_KEY);
  }
}

export function isTokenExpired(): boolean {
  const issued = localStorage.getItem(TOKEN_ISSUED_KEY);
  if (!issued) return true;
  const ageMs = Date.now() - parseInt(issued, 10);
  const maxAgeMs = 55 * 60 * 1000; // 55 minutes (access token is 1h, check early for refresh)
  return ageMs > maxAgeMs;
}

export function hasStoredToken(): boolean {
  return !!getToken() && !isTokenExpired();
}

// Callback for 401 handling — set by useAuth to trigger re-login
let onAuthExpired: (() => void) | null = null;
export function setAuthExpiredCallback(cb: (() => void) | null) {
  onAuthExpired = cb;
}

// ─── HTTP Client ───

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Handle expired token
  if (res.status === 401) {
    setToken(null);
    onAuthExpired?.();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    // Parse structured API error response
    if (body.status === 'error' && body.code && body.message) {
      throw new Error(`[${body.code}] ${body.message}`);
    }
    throw new Error(body.error || body.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── AUTH ───

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export async function apiSignUp(email: string, password: string, displayName: string, termsAccepted: boolean): Promise<{ token: string; refreshToken: string; user: ApiUser }> {
  const result = await request<{ token: string; refreshToken: string; user: ApiUser }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName, termsAccepted }),
  });
  setToken(result.token);
  setRefreshToken(result.refreshToken);
  return result;
}

export async function apiRefresh(refreshToken: string): Promise<{ token: string; refreshToken: string; expiresIn: number }> {
  return request<{ token: string; refreshToken: string; expiresIn: number }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiSignIn(email: string, password: string): Promise<{ token: string; refreshToken: string; expiresIn: number; user: ApiUser }> {
  const result = await request<{ token: string; refreshToken: string; expiresIn: number; user: ApiUser }>('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(result.token);
  setRefreshToken(result.refreshToken);
  return result;
}

export function apiSignOut() {
  setToken(null);
  setRefreshToken(null);
}

export async function apiGetProfile(): Promise<ApiUser> {
  return request<ApiUser>('/api/profile');
}

export async function apiUpdateProfile(data: { displayName?: string; avatarUrl?: string }): Promise<ApiUser> {
  return request<ApiUser>('/api/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

// ─── SUBSCRIPTION ───

export interface ApiSubscription {
  tier: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export async function apiGetSubscription(): Promise<ApiSubscription> {
  return request<ApiSubscription>('/api/subscription');
}

export async function apiUpgradeSubscription(tier: string, billingCycle: string, amountZar?: number, peachTransactionId?: string): Promise<ApiSubscription> {
  return request<ApiSubscription>('/api/subscription/upgrade', {
    method: 'POST',
    body: JSON.stringify({ tier, billingCycle, amountZar, peachTransactionId }),
  });
}

// ─── PAYMENTS ───

export interface ApiPayment {
  id: string;
  planTier: string;
  billingCycle: string;
  amountZar: number;
  currency: string;
  status: string;
  peachTransactionId: string | null;
  createdAt: string;
}

export async function apiGetPayments(): Promise<ApiPayment[]> {
  return request<ApiPayment[]>('/api/payments');
}

// ─── MEETINGS ───

export interface ApiMeeting {
  id: string;
  roomCode: string;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  participantCount: number;
}

export async function apiCreateMeeting(roomCode: string, title?: string): Promise<{ id: string }> {
  return request<{ id: string }>('/api/meetings', {
    method: 'POST',
    body: JSON.stringify({ roomCode, title }),
  });
}

export async function apiEndMeeting(id: string, durationSeconds: number, participantCount: number): Promise<void> {
  await request(`/api/meetings/${id}/end`, {
    method: 'PATCH',
    body: JSON.stringify({ durationSeconds, participantCount }),
  });
}

export async function apiGetMeetings(): Promise<ApiMeeting[]> {
  return request<ApiMeeting[]>('/api/meetings');
}

// ─── HEALTH ───

export async function apiHealthCheck(): Promise<boolean> {
  try {
    await request('/api/health');
    return true;
  } catch {
    return false;
  }
}
