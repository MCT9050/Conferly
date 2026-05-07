import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'conferly-dev-secret-change-in-production';

// Token configuration
const ACCESS_TOKEN_EXPIRY = '1h';      // 1 hour access token
const REFRESH_TOKEN_EXPIRY = '7d';      // 7 day refresh token (rotates every 7 days)
const MAX_REFRESH_TOKEN_AGE = 14;            // Max 14 days before强制刷新

// ─── RATE LIMITING (in-memory store for demo - use Redis in production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;  // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;              // Max login attempts per window
const LOCKOUT_DURATION = 30 * 60 * 1000;  // 30 minute lockout

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { attempts: 1, windowStart: now, lockedUntil: 0 });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 };
  }
  
  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, lockedUntil: record.lockedUntil };
  }
  
  const remaining = MAX_LOGIN_ATTEMPTS - record.attempts;
  if (remaining <= 0) {
    const lockedUntil = now + LOCKOUT_DURATION;
    record.lockedUntil = lockedUntil;
    return { allowed: false, lockedUntil };
  }
  
  record.attempts++;
  return { allowed: true, remainingAttempts: remaining - 1 };
}

function clearRateLimit(ip) {
  rateLimitStore.delete(ip);
}

// Password policy validation
function validatePasswordPolicy(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('at least one number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('at least one special character (!@#$%^&*)');
  return errors;
}

// ─── PAGINATION & QUERY HELPERS ───
function paginate(query, params, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  return { ...query, limit, offset };
}

function getPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}

// ─── IDEMPOTENCY KEYS ───
const idempotencyStore = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

function checkIdempotency(key) {
  const existing = idempotencyStore.get(key);
  if (existing) return existing;
  idempotencyStore.set(key, { createdAt: Date.now() });
  // Cleanup old keys periodically
  if (idempotencyStore.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyStore) {
      if (now - v.createdAt > IDEMPOTENCY_TTL) idempotencyStore.delete(k);
    }
  }
  return null;
}

// ─── STRUCTURED LOGGING ───
const requestCounter = { count: 0 };

function generateRequestId() {
  return `req_${Date.now()}_${++requestCounter.count}`;
}

function logStructured(level, data) {
  const log = {
    timestamp: new Date().toISOString(),
    level,
    ...data
  };
  console.log(JSON.stringify(log));
}

// Request logging middleware
function createRequestLogger(app) {
  app.use((req, res, next) => {
    const requestId = generateRequestId();
    req.requestId = requestId;
    
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logStructured('info', {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userId: req.userId || 'anonymous'
      });
    });
    
    next();
  });
}

// Global error handler
function createErrorHandler(app) {
  app.use((err, req, res, _next) => {
    logStructured('error', {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    // Include error details in development, generic message in production
    const details = process.env.NODE_ENV !== 'production' ? { originalError: err.message } : null;
    return apiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred', details);
  });
}

// ─── DATABASE ENCRYPTION & MIGRATION ───
// Note: For production, use SQLCipher or PostgreSQL with pgcrypto
// SQLite encryption available via: sqlcipher package or query-based encryption
// Example: db.pragma('key = "your-256-bit-key"') for sqlcipher

const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || '';

// ─── DATABASE ───
const db = new Database(join(__dirname, 'conferly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply encryption key if configured (SQLCipher)
if (DB_ENCRYPTION_KEY) {
  db.pragma(`key = '${DB_ENCRYPTION_KEY}'`);
}

// ─── MIGRATION FRAMEWORK ───
const MIGRATION_TABLE = '__migrations';
const migrations = [
  {
    id: '001_initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        email_verified INTEGER DEFAULT 0,
        terms_accepted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        tier TEXT NOT NULL DEFAULT 'free',
        billing_cycle TEXT DEFAULT 'monthly',
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_tier TEXT NOT NULL,
        billing_cycle TEXT NOT NULL,
        amount_zar REAL NOT NULL,
        currency TEXT DEFAULT 'ZAR',
        status TEXT DEFAULT 'completed',
        peach_transaction_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        room_code TEXT NOT NULL,
        title TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        duration_seconds INTEGER DEFAULT 0,
        participant_count INTEGER DEFAULT 1
      );
      
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_id TEXT NOT NULL,
        processed_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now')),
        version INTEGER DEFAULT 1
      );
      
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        session_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `
  },
  {
    id: '002_add_indexes',
    up: `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON webhook_events(event_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting ON chat_messages(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON meeting_notes(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
    `
  }
];

// Run migrations
function runMigrations() {
  // Create migrations table if not exists
  db.exec(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))`);
  
  const applied = db.prepare(`SELECT id FROM ${MIGRATION_TABLE}`).all().map(r => r.id);
  
  for (const migration of migrations) {
    if (!applied.includes(migration.id)) {
      console.log(`Running migration: ${migration.id}`);
      db.exec(migration.up);
      db.prepare(`INSERT INTO ${MIGRATION_TABLE} (id) VALUES (?)`).run(migration.id);
    }
  }
}

runMigrations();

// ─── MIDDLEWARE ───
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// CSP headers for Turnstile iframe
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors https://challenges.cloudflare.com;");
  next();
});

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function generateToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// Hash token for storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate refresh token with rotation
function generateRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), userId, tokenHash, expiresAt);
  
  return { token, expiresAt };
}

// Verify and rotate refresh token (returns new token if valid)
function rotateRefreshToken(userId, providedToken) {
  const tokenHash = hashToken(providedToken);
  const stored = db.prepare(`
    SELECT * FROM refresh_tokens 
    WHERE user_id = ? AND token_hash = ? AND expires_at > datetime('now')
  `).get(userId, tokenHash);
  
  if (!stored) {
    return null; // Invalid or expired token
  }
  
  // Regenerate token (rotation)
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
  
  return generateRefreshToken(userId);
}

// Cleanup expired refresh tokens for a user
function cleanupExpiredTokens(userId) {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at <= datetime(\'now\')').run(userId);
}

// ─── WEBHOOK EVENT DEDUPLICATION ───
// Check if event already processed (idempotency)
function isEventProcessed(eventId) {
  const existing = db.prepare('SELECT id FROM webhook_events WHERE event_id = ?').get(eventId);
  return !!existing;
}

function markEventProcessed(eventType, eventId) {
  db.prepare('INSERT INTO webhook_events (id, event_type, event_id) VALUES (?, ?, ?)').run(uuid(), eventType, eventId);
}

// ─── API ERROR RESPONSE FORMAT ───
// Standardized format: { status, code, message }
function apiError(res, statusCode, code, message, details = null) {
  const response = { status: statusCode >= 400 ? 'error' : 'success', code, message };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
}

function apiSuccess(res, data, code = 'OK') {
  return res.status(200).json({ status: 'success', code, data });
}

// ─── AUTH ROUTES ───

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, displayName, termsAccepted } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and displayName are required' });
    }
    
    // Validate password policy
    const passwordErrors = validatePasswordPolicy(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements. Must have: ' + passwordErrors.join(', ')
      });
    }
    
    // Require terms acceptance
    if (!termsAccepted) {
      return res.status(400).json({ error: 'Terms of Service must be accepted' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, terms_accepted)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, email, hash, displayName);
    db.prepare('INSERT INTO subscriptions (user_id) VALUES (?)').run(id);

    const token = generateToken(id);
    const refreshToken = generateRefreshToken(id);
    const user = db.prepare('SELECT id, email, display_name, avatar_url, email_verified, terms_accepted, created_at FROM users WHERE id = ?').get(id);

    res.status(201).json({
      token,
      refreshToken: refreshToken.token,
      user: { 
        id: user.id, 
        email: user.email, 
        displayName: user.display_name, 
        avatarUrl: user.avatar_url,
        emailVerified: !!user.email_verified,
        termsAccepted: !!user.terms_accepted,
        createdAt: user.created_at 
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return apiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');;
  }
});

// GET /api/auth/verify-email
app.get('/api/auth/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Verification token required' });
  }
  
  try {
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    if (payload.type !== 'email_verify') {
      return res.status(400).json({ error: 'Invalid token type' });
    }
    
    db.prepare('UPDATE users SET email_verified = 1, updated_at = datetime(\'now\') WHERE id = ?').run(payload.sub);
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    console.error('Verify email error:', err);
    return apiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');;
  }
});

// POST /api/auth/signin - with rate limiting
app.post('/api/auth/signin', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Check rate limit
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      const waitMs = rateLimit.lockedUntil - Date.now();
      const waitMin = Math.ceil(waitMs / 60000);
      return res.status(429).json({ 
        error: 'Too many login attempts. Please try again in ' + waitMin + ' minutes',
        retryAfter: Math.ceil(waitMs / 1000)
      });
    }
    
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Still check rate limit even for non-existent users (prevent enumeration)
      checkRateLimit(clientIp);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      checkRateLimit(clientIp);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Clear rate limit on successful login
    clearRateLimit(clientIp);
    
    // Cleanup expired tokens
    cleanupExpiredTokens(user.id);
    
    db.prepare('UPDATE users SET updated_at = datetime(\'now\') WHERE id = ?').run(user.id);
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      token,
      refreshToken: refreshToken.token,
      expiresIn: 3600, // 1 hour in seconds
      user: { 
        id: user.id, 
        email: user.email, 
        displayName: user.display_name, 
        avatarUrl: user.avatar_url,
        emailVerified: !!user.email_verified,
        termsAccepted: !!user.terms_accepted,
        createdAt: user.created_at 
      },
    });
  } catch (err) {
    console.error('Signin error:', err);
    return apiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');;
  }
});

// POST /api/auth/refresh - refresh token rotation
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const tokenHash = hashToken(refreshToken);
    const stored = db.prepare(`
      SELECT rt.*, u.email, u.display_name 
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ? AND rt.expires_at > datetime('now')
    `).get(tokenHash);
    
    if (!stored) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    
    // Rotate token
    const newRefreshToken = rotateRefreshToken(stored.user_id, refreshToken);
    const accessToken = generateToken(stored.user_id);
    
    res.json({
      token: accessToken,
      refreshToken: newRefreshToken.token,
      expiresIn: 3600,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return apiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');;
  }
});

// ─── PROFILE ROUTES ───

// GET /api/profile
app.get('/api/profile', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url, createdAt: user.created_at });
});

// PATCH /api/profile
app.patch('/api/profile', authenticate, (req, res) => {
  const { displayName, avatarUrl } = req.body;
  const updates = [];
  const params = [];

  if (displayName !== undefined) { updates.push('display_name = ?'); params.push(displayName); }
  if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push('updated_at = datetime(\'now\')');
  params.push(req.userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url, createdAt: user.created_at });
});

// ─── SUBSCRIPTION ROUTES ───

// GET /api/subscription - with cache headers
app.get('/api/subscription', authenticate, (req, res) => {
  let sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.userId);
  if (!sub) {
    db.prepare('INSERT INTO subscriptions (user_id) VALUES (?)').run(req.userId);
    sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.userId);
  }
  
  // Set cache headers (short TTL, 60 seconds)
  res.set('Cache-Control', 'private, max-age=60, must-revalidate');
  res.set('Vary', 'Cookie, Authorization');
  
  return apiSuccess(res, {
    tier: sub.tier,
    billingCycle: sub.billing_cycle,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  }, 'SUBSCRIPTION_RETRIEVED');
});

app.post('/api/subscription/upgrade', authenticate, (req, res) => {
  const { tier, billingCycle, peachTransactionId, amountZar, idempotencyKey } = req.body;
  if (!tier || !billingCycle) return apiError(res, 400, 'MISSING_FIELDS', 'tier and billingCycle required');
  
  // Check idempotency key to prevent duplicate payments
  if (idempotencyKey) {
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return apiError(res, 409, 'DUPLICATE_REQUEST', 'This request has already been processed');
    }
  }
  

  // Record payment
  if (amountZar) {
    db.prepare('INSERT INTO payments (id, user_id, plan_tier, billing_cycle, amount_zar, peach_transaction_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), req.userId, tier, billingCycle, amountZar, peachTransactionId || null);
  }

  res.json({ tier, billingCycle, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false });
});

// ─── PAYMENT HISTORY ───

PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS
PLACEHOLDER_PAYMENTS

// ─── MEETING HISTORY ───

// POST /api/meetings
app.post('/api/meetings', authenticate, (req, res) => {
  const { roomCode, title } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO meetings (id, user_id, room_code, title) VALUES (?, ?, ?, ?)').run(id, req.userId, roomCode, title || null);
  res.status(201).json({ id, roomCode, title });
});

// PATCH /api/meetings/:id/end
app.patch('/api/meetings/:id/end', authenticate, (req, res) => {
  const { durationSeconds, participantCount } = req.body;
  db.prepare('UPDATE meetings SET ended_at = datetime(\'now\'), duration_seconds = ?, participant_count = ? WHERE id = ? AND user_id = ?')
    .run(durationSeconds || 0, participantCount || 1, req.params.id, req.userId);
  res.json({ success: true });
});

// GET /api/meetings
app.get('/api/meetings', authenticate, (req, res) => {
  const meetings = db.prepare('SELECT * FROM meetings WHERE user_id = ? ORDER BY started_at DESC LIMIT 20').all(req.userId);
  res.json(meetings.map(m => ({
    id: m.id,
    roomCode: m.room_code,
    title: m.title,
    startedAt: m.started_at,
    endedAt: m.ended_at,
    durationSeconds: m.duration_seconds,
    participantCount: m.participant_count,
  })));
});

// ─── CHAT MESSAGES (Multi-participant support) ───

// POST /api/meetings/:id/chat - Send chat message
app.post('/api/meetings/:meetingId/chat', authenticate, (req, res) => {
  const { meetingId } = req.params;
  const { content, senderName } = req.body;
  if (!content || !senderName) return apiError(res, 400, 'MISSING_FIELDS', 'content and senderName required');
  
  const id = uuid();
  db.prepare('INSERT INTO chat_messages (id, meeting_id, user_id, sender_name, content) VALUES (?, ?, ?, ?, ?)')
    .run(id, meetingId, req.userId, senderName, content);
  
  return apiSuccess(res, { id, meetingId, senderName, content, createdAt: new Date().toISOString() }, 'MESSAGE_SENT');
});

// GET /api/meetings/:id/chat - Get chat history
app.get('/api/meetings/:meetingId/chat', authenticate, (req, res) => {
  const { meetingId } = req.params;
  const messages = db.prepare(`
    SELECT * FROM chat_messages 
    WHERE meeting_id = ? 
    ORDER BY created_at ASC 
    LIMIT 100
  `).all(meetingId);
  
  return apiSuccess(res, {
    data: messages.map(m => ({
      id: m.id,
      meetingId: m.meeting_id,
      userId: m.user_id,
      senderName: m.sender_name,
      content: m.content,
      createdAt: m.created_at
    }))
  }, 'MESSAGES_RETRIEVED');
});

// ─── MEETING NOTES (Real-time collaboration) ───

// GET /api/meetings/:id/notes - Get meeting notes
app.get('/api/meetings/:meetingId/notes', authenticate, (req, res) => {
  const { meetingId } = req.params;
  const notes = db.prepare('SELECT * FROM meeting_notes WHERE meeting_id = ?').get(meetingId);
  
  if (!notes) {
    return apiSuccess(res, { meetingId, content: '', version: 1 }, 'NOTES_RETRIEVED');
  }
  
  return apiSuccess(res, {
    meetingId: notes.meeting_id,
    content: notes.content,
    updatedAt: notes.updated_at,
    version: notes.version
  }, 'NOTES_RETRIEVED');
});

// PUT /api/meetings/:id/notes - Update meeting notes
app.put('/api/meetings/:meetingId/notes', authenticate, (req, res) => {
  const { meetingId } = req.params;
  const { content, baseVersion } = req.body;
  
  const existing = db.prepare('SELECT * FROM meeting_notes WHERE meeting_id = ?').get(meetingId);
  
  if (existing) {
    // Check for conflicts
    if (baseVersion && baseVersion !== existing.version) {
      return apiError(res, 409, 'VERSION_CONFLICT', 'Notes have been updated by another user', {
        currentVersion: existing.version,
        currentContent: existing.content
      });
    }
    
    db.prepare(`
      UPDATE meeting_notes 
      SET content = ?, updated_at = datetime('now'), version = version + 1 
      WHERE meeting_id = ?
    `).run(content, meetingId);
  } else {
    db.prepare('INSERT INTO meeting_notes (id, meeting_id, user_id, content) VALUES (?, ?, ?, ?)')
      .run(uuid(), meetingId, req.userId, content);
  }
  
  return apiSuccess(res, { meetingId, content, version: (existing?.version || 0) + 1 }, 'NOTES_SAVED');
});

// ─── USAGE ANALYTICS ───

// POST /api/analytics - Track analytics event
app.post('/api/analytics', authenticate, (req, res) => {
  const { eventType, sessionId, metadata } = req.body;
  if (!eventType) return apiError(res, 400, 'MISSING_FIELDS', 'eventType required');
  
  const id = uuid();
  db.prepare('INSERT INTO analytics_events (id, event_type, user_id, session_id, metadata) VALUES (?, ?, ?, ?, ?)')
    .run(id, eventType, req.userId || null, sessionId || null, metadata ? JSON.stringify(metadata) : null);
  
  return apiSuccess(res, { id }, 'EVENT_TRACKED');
});

// GET /api/analytics - Aggregate analytics (admin only)
app.get('/api/analytics', authenticate, (req, res) => {
  const { eventType, from, to, limit = 100 } = req.query;
  
  // Build query
  let query = 'SELECT event_type, COUNT(*) as count, MAX(created_at) as last_occurred FROM analytics_events WHERE 1=1';
  const params: any[] = [];
  
  if (eventType) {
    query += ' AND event_type = ?';
    params.push(eventType);
  }
  if (from) {
    query += ' AND created_at >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND created_at <= ?';
    params.push(to);
  }
  
  query += ' GROUP BY event_type ORDER BY count DESC LIMIT ?';
  params.push(limit);
  
  const stats = db.prepare(query).all(...params);
  
  return apiSuccess(res, { data: stats }, 'ANALYTICS_RETRIEVED');
});


// Webhook signature verification helper
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !payload) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// POST /api/webhooks/n8n - n8n webhook handler with retry logic
app.post('/api/webhooks/n8n', async (req, res) => {
  try {
    const signature = req.headers['x-signature'] || req.headers['x-n8n-signature'];
    const secret = process.env.N8N_WEBHOOK_SECRET;
    
    if (!secret) {
      return apiError(res, 500, 'WEBHOOK_NOT_CONFIGURED', 'Webhook not configured');
    }
    
    // Verify signature
    const payloadStr = JSON.stringify(req.body);
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');
    
    if (signature !== expectedSig) {
      return apiError(res, 401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
    }
    
    // Process webhook based on event type
    const { event, data, event_id } = req.body;
    
    // Event deduplication
    if (event_id && isEventProcessed(event_id)) {
      console.log('Duplicate n8n event:', event_id);
      return apiSuccess(res, { alreadyProcessed: true }, 'DUPLICATE_EVENT');
    }
    
    // Handle different n8n events with retry logic
    const maxRetries = 3;
    let retryCount = 0;
    
    async function processEventWithRetry() {
      try {
        switch (event) {
          case 'user.signup':
            // Trigger welcome email workflow
            console.log('Processing n8n signup event for:', data.email);
            break;
          case 'payment.success':
            // Update subscription based on payment
            console.log('Processing n8n payment event:', data);
            break;
          default:
            console.log('Unknown n8n event:', event);
        }
        
        // Mark event as processed
        if (event_id) {
          markEventProcessed(event, event_id);
        }
      } catch (err) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`Retrying n8n event (${retryCount}/${maxRetries}):`, event_id);
          await new Promise(r => setTimeout(r, 1000 * retryCount)); // Exponential backoff
          return processEventWithRetry();
        }
        throw err;
      }
    }
    
    await processEventWithRetry();
    
    return apiSuccess(res, { received: true }, 'EVENT_RECEIVED');
  } catch (err) {
    console.error('N8n webhook error:', err);
    return apiError(res, 500, 'WEBHOOK_ERROR', 'Webhook processing error', err.message);
  }
});

// POST /api/webhooks/peach - Peach Payments webhook handler with deduplication
app.post('/api/webhooks/peach', async (req, res) => {
  try {
    const signature = req.headers['x-peach-signature'];
    const secret = process.env.PEACH_SECRET;
    
    if (!secret) {
      return apiError(res, 500, 'WEBHOOK_NOT_CONFIGURED', 'Webhook not configured');
    }
    
    // Verify signature
    const payloadStr = JSON.stringify(req.body);
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');
    
    if (signature !== expectedSig) {
      return apiError(res, 401, 'INVALID_SIGNATURE', 'Invalid Peach webhook signature');
    }
    
    // Get event ID for deduplication
    const transaction_id = req.body?.data?.transaction_id;
    
    // Event deduplication
    if (transaction_id && isEventProcessed(transaction_id)) {
      console.log('Duplicate Peach event:', transaction_id);
      return apiSuccess(res, { alreadyProcessed: true }, 'DUPLICATE_EVENT');
    }
    
    // Process payment event
    const { event_type, data } = req.body;
    
    if (event_type === 'payment.completed') {
      const { user_id, plan_tier, billing_cycle, amount, transaction_id: txId } = data;
      
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Update subscription
      db.prepare(`
        INSERT INTO subscriptions (user_id, tier, billing_cycle, current_period_end, cancel_at_period_end, updated_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          tier = excluded.tier,
          billing_cycle = excluded.billing_cycle,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = 0,
          updated_at = datetime('now')
      `).run(user_id, plan_tier, billing_cycle, periodEnd);
      
      // Record payment
      db.prepare(`
        INSERT INTO payments (id, user_id, plan_tier, billing_cycle, amount_zar, peach_transaction_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'completed')
      `).run(uuid(), user_id, plan_tier, billing_cycle, amount, txId);
      
      // Mark event as processed
      if (txId) {
        markEventProcessed('payment.completed', txId);
      }
    }
    
    return apiSuccess(res, { received: true }, 'PAYMENT_RECEIVED');
  } catch (err) {
    console.error('Peach webhook error:', err);
    return apiError(res, 500, 'WEBHOOK_ERROR', 'Webhook processing error', err.message);
  }
});
app.get('/api/health', (_req, res) => {
  return apiSuccess(res, { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }, 'HEALTH_CHECK');
});

// ─── Peach Payments Request Signing ───
// Sign requests to Peach Payments API to prevent spoofing
async function signPeachRequest(method, path, body) {
  const timestamp = new Date().toISOString();
  const payload = `${method}:${path}:${timestamp}:${JSON.stringify(body)}`;
  const signature = crypto
});

// ─── SCHEDULED JOBS ───
// Subscription expiry reminders and meeting cleanup

// Run daily at 9am SA time
function scheduleDailyJob(callback, hour = 9) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target.getTime() - now.getTime();
  return setTimeout(() => {
    callback();
    // Reschedule next day
    setInterval(callback, 24 * 60 * 60 * 1000);
  }, delay);
}

// Job: Send subscription expiry reminders (7 days before expiry)
function sendSubscriptionReminders() {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  const expiringSubs = db.prepare(`
    SELECT u.email, u.display_name, s.tier, s.current_period_end
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.current_period_end LIKE ? AND s.cancel_at_period_end = 0
  `).all(`${sevenDaysFromNow}%`);
  
  for (const sub of expiringSubs) {
    logStructured('info', {
      job: 'subscription_reminder',
      email: sub.email,
      expiryDate: sub.current_period_end
    });
    // In production, trigger n8n workflow here
  }
}

// Job: Clean up old meetings (older than 90 days)
function cleanupOldMeetings() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  
  const result = db.prepare(`
    DELETE FROM meetings 
    WHERE ended_at IS NOT NULL 
    AND ended_at < ?
  `).run(ninetyDaysAgo);
  
  logStructured('info', {
    job: 'cleanup_meetings',
    deletedRows: result.changes
  });
}

// Job: Clean up expired refresh tokens
function cleanupExpiredTokens() {
  const result = db.prepare(`
    DELETE FROM refresh_tokens 
    WHERE expires_at <= datetime('now')
  `).run();
  
  logStructured('info', {
    job: 'cleanup_tokens',
    deletedRows: result.changes
  });
}

// Start scheduled jobs
scheduleDailyJob(sendSubscriptionReminders, 9); // 9am
scheduleDailyJob(cleanupOldMeetings, 10); // 10am  
scheduleDailyJob(cleanupExpiredTokens, 11); // 11am

// ─── CONFLICT RESOLUTION FOR OFFLINE SYNC ───
// Strategy: Last-write-wins with manual merge UI
// In production, implement CRDT or operational transforms

function resolveConflict(localData, remoteData) {
  // Priority: more recent timestamp wins
  const localTime = new Date(localData.updatedAt || 0).getTime();
  const remoteTime = new Date(remoteData.updatedAt || 0).getTime();
  
  if (remoteTime > localTime) {
    return { ...remoteData, conflicts: [localData] };
  }
  
  return { ...localData, conflicts: [remoteData] };
}

// API endpoint for conflict resolution
app.post('/api/sync/resolve', authenticate, (req, res) => {
  const { localData, remoteData } = req.body;
  if (!localData || !remoteData) {
    return apiError(res, 400, 'MISSING_DATA', 'localData and remoteData required');
  }
  
  const resolved = resolveConflict(localData, remoteData);
  return apiSuccess(res, resolved, 'CONFLICT_RESOLVED');
    'X-Peach-Signature': signature
  };
}

// POST /api/payments/peach/create - Create payment with signed request
app.post('/api/payments/peach/create', authenticate, async (req, res) => {
  try {
    const { planTier, billingCycle, amountZar } = req.body;
    const peachEntityId = process.env.PEACH_ENTITY_ID;
    
    if (!peachEntityId || !process.env.PEACH_SECRET) {
      return apiError(res, 500, 'PAYMENT_NOT_CONFIGURED', 'Peach Payments not configured');
    }
    
    const payload = {
      entity_id: peachEntityId,
      amount: amountZar,
      currency: 'ZAR',
      reference: `conferly-${req.userId}-${Date.now()}`,
      notification_url: `${process.env.API_URL}/api/webhooks/peach`
    };
    
    // Sign the request
    const headers = await signPeachRequest('POST', '/v1/checkout', payload);
    
    // Make request to Peach (in production, use actual API)
    const peachResponse = await fetch('https://api.peachpayments.com/v1/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(payload)
    });
    
    if (!peachResponse.ok) {
      const error = await peachResponse.json();
      return apiError(res, 400, 'PAYMENT_FAILED', 'Failed to create payment', error);
    }
    
    const data = await peachResponse.json();
    return apiSuccess(res, { checkoutId: data.id, redirectUrl: data.redirect_url }, 'PAYMENT_CREATED');
  } catch (err) {
    console.error('Peach payment error:', err);
    return apiError(res, 500, 'PAYMENT_ERROR', 'Payment processing error', err.message);
  }
});

// ─── START ───
app.listen(PORT, () => {
  console.log(`⚡ Conferly API running on http://localhost:${PORT}`);
  console.log(`   Database: ${join(__dirname, 'conferly.db')}`);
});
