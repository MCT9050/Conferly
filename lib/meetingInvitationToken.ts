import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

export const INVITATION_TOKEN_BYTES = 32;
export const RAW_INVITATION_TOKEN_MAX_LENGTH = 96;
export const MEETING_SLUG_MAX_LENGTH = 128;

const BASE64URL_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function generateRawInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
}

export function hashInvitationToken(rawToken: string): string {
  const normalized = validateRawInvitationToken(rawToken);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function validateRawInvitationToken(rawToken: unknown): string {
  if (typeof rawToken !== 'string') {
    throw new Error('invalid_invitation_token');
  }

  const normalized = rawToken.trim();
  if (
    normalized.length === 0 ||
    normalized.length > RAW_INVITATION_TOKEN_MAX_LENGTH ||
    !BASE64URL_TOKEN_PATTERN.test(normalized)
  ) {
    throw new Error('invalid_invitation_token');
  }

  return normalized;
}

export function validateMeetingSlugInput(room: unknown): string {
  if (typeof room !== 'string') {
    throw new Error('invalid_meeting_slug');
  }

  const normalized = room.trim();
  if (normalized.length === 0 || normalized.length > MEETING_SLUG_MAX_LENGTH) {
    throw new Error('invalid_meeting_slug');
  }

  return normalized;
}

export function isSha256Hex(value: string): boolean {
  return HEX_SHA256_PATTERN.test(value);
}
