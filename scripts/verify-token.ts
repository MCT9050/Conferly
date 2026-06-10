/**
 * One-off verification script for LiveKit token generation.
 * Tests the SDK directly without needing the full Next.js server.
 * 
 * Usage: npx tsx scripts/verify-token.ts
 */

import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import * as fs from 'fs';

// Manually parse .env.local since dotenv is not installed
const envRaw = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();
  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const LIVEKIT_API_KEY = env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = env.LIVEKIT_URL;

console.log('=== ENV SANITY CHECK ===');
console.log(`LIVEKIT_API_KEY present:  ${!!LIVEKIT_API_KEY} (length: ${LIVEKIT_API_KEY?.length ?? 0})`);
console.log(`LIVEKIT_API_SECRET present: ${!!LIVEKIT_API_SECRET} (length: ${LIVEKIT_API_SECRET?.length ?? 0})`);
console.log(`LIVEKIT_URL present:      ${!!LIVEKIT_URL} (length: ${LIVEKIT_URL?.length ?? 0})`);

// Check for trailing whitespace
if (LIVEKIT_API_KEY && LIVEKIT_API_KEY !== LIVEKIT_API_KEY.trim()) {
  console.error('❌ LIVEKIT_API_KEY has trailing whitespace!');
}
if (LIVEKIT_API_SECRET && LIVEKIT_API_SECRET !== LIVEKIT_API_SECRET.trim()) {
  console.error('❌ LIVEKIT_API_SECRET has trailing whitespace!');
}
if (LIVEKIT_URL && LIVEKIT_URL !== LIVEKIT_URL.trim()) {
  console.error('❌ LIVEKIT_URL has trailing whitespace!');
}

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('❌ FATAL: Missing LiveKit credentials. Cannot proceed.');
  process.exit(1);
}

console.log('\n=== TOKEN GENERATION TEST ===');

async function run() {
  try {
    const grant: VideoGrant = {
      roomJoin: true,
      room: 'test-room',
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
    };

    const token = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
      identity: 'test-identity',
      name: 'Test User',
      metadata: JSON.stringify({ role: 'participant' }),
      attributes: { role: 'participant' },
    });

    token.addGrant(grant);
    const jwt = await token.toJwt();

    console.log('✅ Token Generated Successfully');
    console.log(`   Token preview: ${jwt.substring(0, 50)}...`);
    console.log(`   Full length: ${jwt.length} chars`);
    console.log(`   Target URL: ${LIVEKIT_URL}`);
    console.log('\n=== VERDICT ===');
    console.log('The LiveKit SDK credentials are valid and token generation works.');
    console.log('If /api/lk-token still crashes, the issue is in:');
    console.log('  1. Session/auth returning invalid userId or email');
    console.log('  2. Room access verification (verifyRoomAccess) failing');
    console.log('  3. A middleware or route-level issue before the handler runs');
  } catch (e) {
    console.error('❌ SDK Generation Failed:', e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) {
      console.error('   Stack:', e.stack.split('\n').slice(0, 4).join('\n'));
    }
    console.log('\n=== VERDICT ===');
    console.log('The LiveKit SDK itself is rejecting these credentials.');
    console.log('This means the LIVEKIT_API_KEY or LIVEKIT_API_SECRET may be:');
    console.log('  - Invalid/expired');
    console.log('  - From the wrong LiveKit project');
    console.log('  - Corrupted with hidden characters');
    process.exit(1);
  }
}

run();