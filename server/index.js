import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'conferly-dev-secret-change-in-production';
const TOKEN_EXPIRY = '30d';

// ─── DATABASE ───
const db = new Database(join(__dirname, 'conferly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
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
`);

// ─── MIDDLEWARE ───
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

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
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// ─── AUTH ROUTES ───

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and displayName are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = uuid();
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)').run(id, email, hash, displayName);
    db.prepare('INSERT INTO subscriptions (user_id) VALUES (?)').run(id);

    const token = generateToken(id);
    const user = db.prepare('SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?').get(id);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url, createdAt: user.created_at },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/signin
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    db.prepare('UPDATE users SET updated_at = datetime("now") WHERE id = ?').run(user.id);
    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url, createdAt: user.created_at },
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error' });
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

  updates.push('updated_at = datetime("now")');
  params.push(req.userId);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const user = db.prepare('SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?').get(req.userId);
  res.json({ id: user.id, email: user.email, displayName: user.display_name, avatarUrl: user.avatar_url, createdAt: user.created_at });
});

// ─── SUBSCRIPTION ROUTES ───

// GET /api/subscription
app.get('/api/subscription', authenticate, (req, res) => {
  let sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.userId);
  if (!sub) {
    db.prepare('INSERT INTO subscriptions (user_id) VALUES (?)').run(req.userId);
    sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.userId);
  }
  res.json({
    tier: sub.tier,
    billingCycle: sub.billing_cycle,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  });
});

// POST /api/subscription/upgrade
app.post('/api/subscription/upgrade', authenticate, (req, res) => {
  const { tier, billingCycle, peachTransactionId, amountZar } = req.body;
  if (!tier || !billingCycle) return res.status(400).json({ error: 'tier and billingCycle required' });

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO subscriptions (user_id, tier, billing_cycle, current_period_end, cancel_at_period_end, updated_at)
    VALUES (?, ?, ?, ?, 0, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      tier = excluded.tier,
      billing_cycle = excluded.billing_cycle,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = 0,
      updated_at = datetime('now')
  `).run(req.userId, tier, billingCycle, periodEnd);

  // Record payment
  if (amountZar) {
    db.prepare('INSERT INTO payments (id, user_id, plan_tier, billing_cycle, amount_zar, peach_transaction_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), req.userId, tier, billingCycle, amountZar, peachTransactionId || null);
  }

  res.json({ tier, billingCycle, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false });
});

// ─── PAYMENT HISTORY ───

// GET /api/payments
app.get('/api/payments', authenticate, (req, res) => {
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.userId);
  res.json(payments.map(p => ({
    id: p.id,
    planTier: p.plan_tier,
    billingCycle: p.billing_cycle,
    amountZar: p.amount_zar,
    currency: p.currency,
    status: p.status,
    peachTransactionId: p.peach_transaction_id,
    createdAt: p.created_at,
  })));
});

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
  db.prepare('UPDATE meetings SET ended_at = datetime("now"), duration_seconds = ?, participant_count = ? WHERE id = ? AND user_id = ?')
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

// ─── HEALTH ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── START ───
app.listen(PORT, () => {
  console.log(`⚡ Conferly API running on http://localhost:${PORT}`);
  console.log(`   Database: ${join(__dirname, 'conferly.db')}`);
});
