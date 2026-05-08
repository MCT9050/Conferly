// SECURITY: Audit Logging Library
// Provides centralized security event logging for auth operations
// Integrates with automation layer for SIEM/analysis

// SECURITY: Audit logging levels
type AuditLevel = 'info' | 'warning' | 'critical';

// SECURITY: Structured audit event interface
interface SecurityAuditEvent {
  event: string;
  timestamp: string;
  level: AuditLevel;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  status: 'success' | 'failure' | 'blocked';
  failureReason?: string;
  data?: Record<string, unknown>;
}

// Import automation for event forwarding
import { isAutomationConfigured, trigger } from './automation';

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

// SECURITY: Centralized security audit logging
function auditLog(
  eventType: string,
  level: AuditLevel,
  status: 'success' | 'failure' | 'blocked',
  userId?: string,
  data?: { email?: string; failureReason?: string; [key: string]: unknown }
): void {
  const auditEvent: SecurityAuditEvent = {
    event: eventType,
    timestamp: new Date().toISOString(),
    level,
    userId,
    email: data?.email,
    status,
    failureReason: data?.failureReason,
    data: { ...data, source: 'conferly-web' }
  };
  
  // Log to console with severity prefix
  const prefix = level === 'critical' ? '🔴 CRITICAL' : level === 'warning' ? '⚠️ WARNING' : 'ℹ️ INFO';
  console.log(`${prefix} SECURITY AUDIT:`, auditEvent);
  
  // Send to automation if configured (for SIEM integration)
  if (isAutomationConfigured && N8N_BASE) {
    try {
      fetch(N8N_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'security_audit', ...auditEvent }),
      }).catch(() => {}); // Non-blocking
    } catch { /* silent */ }
  }
}

// SECURITY: Quick audit helpers
export const audit = {
  loginSuccess: (userId: string, email: string) => 
    auditLog('auth.login.success', 'info', 'success', userId, { email }),
  
  loginFailure: (email: string, reason: string) => 
    auditLog('auth.login.failure', 'warning', 'failure', undefined, { email, failureReason: reason }),
  
  signupSuccess: (userId: string, email: string) => 
    auditLog('auth.signup.success', 'info', 'success', userId, { email }),
  
  signupDuplicate: (email: string) => 
    auditLog('auth.signup.duplicate', 'warning', 'blocked', undefined, { email, failureReason: 'email exists' }),
  
  turnstileFailure: (email?: string) => 
    auditLog('auth.turnstile.failed', 'warning', 'blocked', undefined, { email, failureReason: 'invalid token' }),
  
  passwordReset: (userId: string, email: string) => 
    auditLog('auth.password.reset', 'info', 'success', userId, { email }),
  
  sessionExpired: (userId: string) => 
    auditLog('auth.session.expired', 'info', 'failure', userId, { failureReason: 'expired' }),
  
  rateLimited: (email?: string, reason?: string) => 
    auditLog('auth.rate_limited', 'critical', 'blocked', undefined, { email, failureReason: reason || 'rate limit' }),
};