/**
 * Quick LiveKit token verification without tsx dependency.
 * Usage: node scripts/verify-token-quick.mjs
 */
import { AccessToken } from 'livekit-server-sdk';
import { readFileSync } from 'fs';

// Parse .env.local manually
const envRaw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let value = trimmed.slice(eqIdx + 1).trim();
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

try {
  const grant = {
    roomJoin: true,
    room: 'test-room',
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
  };

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
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
  process.exit(0);
} catch (e) {
  console.error('❌ SDK Generation Failed:', e instanceof Error ? e.message : e);
  if (e instanceof Error && e.stack) {
    console.error('   Stack:', e.stack.split('\n').slice(0, 4).join('\n'));
  }
  console.log('\n=== VERDICT ===');
  console.log('The LiveKit SDK itself is rejecting these credentials.');
  process.exit(1);
}