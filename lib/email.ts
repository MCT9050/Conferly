// lib/email.ts
// Email template builders for Supabase Auth dashboard (welcome + password reset).

// NOTE: Actual email delivery is handled by Supabase Auth's native mailer.
// These templates are used in the Supabase dashboard → Auth → Email Templates.
// Do NOT import sendEmail or any Resend-specific logic here.

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export function buildWelcomeEmail(displayName: string): { subject: string; html: string } {
  const subject = 'Welcome to Conferly — Let\'s get started!';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px; text-align: center; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 24px; padding: 12px 32px; background: linear-gradient(135deg, #2563eb, #06b6d4); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; }
    .footer { margin-top: 32px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Welcome to Conferly, ${escapeHtml(displayName)}!</h1>
      <p>Your account has been created successfully. Conferly brings together video meetings, collaborative documents, and real-time translation in one seamless platform.</p>
      <a href="https://www.conferly.site/dashboard" class="btn">Go to Dashboard</a>
    </div>
    <div class="footer text-center">
      Conferly &mdash; Communicate beyond boundaries.
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

export function buildPasswordResetEmail(resetLink: string): { subject: string; html: string } {
  const subject = 'Reset your Conferly password';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 40px; text-align: center; }
    h1 { color: #f59e0b; font-size: 22px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 24px; padding: 12px 32px; background: linear-gradient(135deg, #d97706, #f59e0b); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; }
    .footer { margin-top: 32px; font-size: 12px; color: #64748b; }
    .link { word-break: break-all; color: #38bdf8; font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Password Reset Request</h1>
      <p>We received a request to reset your Conferly password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <a href="${escapeHtml(resetLink)}" class="btn">Reset Password</a>
      <div class="link">Or copy this link: ${escapeHtml(resetLink)}</div>
    </div>
    <div class="footer text-center">
      If you didn't request this, you can safely ignore this email.
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}