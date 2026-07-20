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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const normalized = slug.trim();
  if (!normalized) {
    throw new Error('slug is required');
  }

  return normalized;
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
