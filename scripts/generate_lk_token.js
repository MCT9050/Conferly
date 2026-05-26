#!/usr/bin/env node

const { AccessToken, VideoGrant } = require('livekit-server-sdk');

const key = process.env.LIVEKIT_API_KEY;
const secret = process.env.LIVEKIT_API_SECRET;

if (!key || !secret) {
  console.error('Error: Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in the environment.');
  process.exit(1);
}

const identity = process.env.IDENTITY || 'local-test';
const room = process.env.ROOM || 'CONFER123';
const role = (process.env.ROLE || 'participant').toLowerCase();

const grant = {
  roomJoin: true,
  room,
  canSubscribe: true,
  canPublish: role === 'participant',
  canPublishData: role === 'participant',
};

(async function generate() {
  try {
    const token = new AccessToken(key, secret, {
      identity,
      name: identity,
      metadata: JSON.stringify({ role }),
      attributes: { role },
    });

    token.addGrant(grant);
    const jwt = await token.toJwt();
    console.log(jwt);
  } catch (err) {
    console.error('Failed to generate token:', err);
    process.exit(1);
  }
})();
