// Conferly Automation Layer — sends events to n8n workflows
// All calls are fire-and-forget (non-blocking) so app performance is never affected.
// Without VITE_N8N_WEBHOOK_URL configured, calls are silently no-ops.

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
export const isAutomationConfigured = !!(N8N_BASE && N8N_BASE.startsWith('http'));

export type AutomationEvent =
  | 'user.signup'
  | 'user.signin'
  | 'user.signout'
  | 'user.onboarded'
  | 'user.profile_updated'
  | 'meeting.started'
  | 'meeting.ended'
  | 'meeting.recorded'
  | 'plan.upgraded'
  | 'plan.downgraded'
  | 'payment.completed'
  | 'payment.failed'
  | 'trial.ending_soon'
  | 'trial.expired'
  | 'feedback.submitted';

interface EventPayload {
  event: AutomationEvent;
  timestamp: string;
  userId?: string;
  email?: string;
  displayName?: string;
  data?: Record<string, unknown>;
}

/**
 * Fire an automation event to n8n. Non-blocking — errors are silently swallowed.
 * The webhook URL should be the base n8n webhook endpoint, e.g.
 * https://automation.conferly.site/webhook/conferly
 */
export function trigger(
  event: AutomationEvent,
  payload?: { userId?: string; email?: string; displayName?: string; data?: Record<string, unknown> },
): void {
  if (!isAutomationConfigured) return;

  const body: EventPayload = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Fire-and-forget — never blocks the UI
  fetch(N8N_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true, // Allow request to complete even if page unloads
  }).catch(() => { /* silent */ });
}
