import type { SupabaseClient } from '@supabase/supabase-js';

export type CreateMeetingInput = {
  ownerId: string;
  slug: string;
  title: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  isPublic?: boolean;
  orgId?: string | null;
};

export type MeetingInsertPayload = {
  owner: string;
  user_id: string;
  slug: string;
  room_code: string;
  title: string;
  description: string | null;
  starts_at: string;
  started_at: string;
  ends_at: string | null;
  ended_at: string | null;
  is_public: boolean;
  org_id: string | null;
};

export type ExplicitMeetingCreationResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; status: 409; error: 'slug_conflict' }
  | { ok: false; status: 500; error: 'creation_failed' };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{5,63}$/;
const GENERATED_SLUG_LENGTH = 12;
const MAX_SLUG_ATTEMPTS = 5;

type SupabaseErrorLike = {
  code?: string;
};

function ensureUuid(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }

  return normalized;
}

function ensureSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    throw new Error('slug is required');
  }

  if (!SAFE_SLUG_PATTERN.test(normalized)) {
    throw new Error('slug must be 6-64 lowercase letters, numbers, or hyphens');
  }

  return normalized;
}

export function generateMeetingSlug(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(GENERATED_SLUG_LENGTH);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function normalizeMeetingSlug(slug?: string | null): string {
  return slug ? ensureSlug(slug) : generateMeetingSlug();
}

export function buildMeetingInsert(input: CreateMeetingInput): MeetingInsertPayload {
  const ownerId = ensureUuid(input.ownerId, 'ownerId');
  const slug = ensureSlug(input.slug);
  const startsAt = input.startsAt ?? new Date().toISOString();
  const endsAt = input.endsAt ?? null;

  return {
    owner: ownerId,
    user_id: ownerId,
    slug,
    room_code: slug,
    title: input.title.trim() || `Room ${slug}`,
    description: input.description ?? null,
    starts_at: startsAt,
    started_at: startsAt,
    ends_at: endsAt,
    ended_at: endsAt,
    is_public: input.isPublic ?? true,
    org_id: input.orgId ?? null,
  };
}

export async function createExplicitMeeting(
  supabase: SupabaseClient,
  ownerId: string,
  requestedSlug?: string | null,
): Promise<ExplicitMeetingCreationResult> {
  const normalizedOwnerId = ensureUuid(ownerId, 'ownerId');
  const explicitSlug = requestedSlug ? normalizeMeetingSlug(requestedSlug) : null;
  const attempts = explicitSlug ? 1 : MAX_SLUG_ATTEMPTS;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const slug = explicitSlug ?? generateMeetingSlug();
    const insertPayload = buildMeetingInsert({
      ownerId: normalizedOwnerId,
      slug,
      title: `Room ${slug}`,
      isPublic: true,
    });

    const { data, error } = await supabase
      .from('meetings')
      .insert(insertPayload)
      .select('id, slug, owner')
      .single();

    if (!error && data?.id && data.slug === slug && data.owner === normalizedOwnerId) {
      return { ok: true, id: data.id, slug: data.slug };
    }

    if ((error as SupabaseErrorLike | null)?.code === '23505') {
      if (explicitSlug) {
        return { ok: false, status: 409, error: 'slug_conflict' };
      }
      continue;
    }

    return { ok: false, status: 500, error: 'creation_failed' };
  }

  return { ok: false, status: 409, error: 'slug_conflict' };
}
