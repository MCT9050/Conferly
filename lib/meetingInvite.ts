export type MeetingInviteCopyKind = 'link' | 'code';

export type MeetingInviteResult =
  | { status: 'shared' }
  | { status: 'copied'; kind: MeetingInviteCopyKind }
  | { status: 'cancelled' }
  | { status: 'failed'; error: unknown };

type ClipboardLike = {
  writeText?: (text: string) => Promise<void>;
};

type NavigatorLike = {
  clipboard?: ClipboardLike;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'json'>>;

type SecureInvitationResponse = {
  url?: string;
  error?: string;
};

export function buildCanonicalMeetingUrl(origin: string, roomId: string): string {
  return `${origin.replace(/\/$/, '')}/meet/rooms/${encodeURIComponent(roomId)}`;
}

export function buildCanonicalLobbyInviteUrl(origin: string, room: string, invite: string): string {
  const params = new URLSearchParams({ room, intent: 'join', invite });
  return `${origin.replace(/\/$/, '')}/lobby?${params.toString()}`;
}

export type NormalizedMeetingJoinTarget =
  | { ok: true; room: string; invite?: string; href: string }
  | { ok: false; error: string };

export function normalizeMeetingJoinTarget(input: string, origin = 'https://conferly.site'): NormalizedMeetingJoinTarget {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Meeting link or code is required' };

  try {
    const parsed = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed.startsWith('/') ? trimmed : `/meet/rooms/${encodeURIComponent(trimmed)}`, origin);

    if (parsed.pathname === '/lobby') {
      const room = parsed.searchParams.get('room')?.trim();
      const invite = parsed.searchParams.get('invite')?.trim();
      if (!room) return { ok: false, error: 'Meeting not found' };
      const href = invite
        ? `/lobby?room=${encodeURIComponent(room)}&intent=join&invite=${encodeURIComponent(invite)}`
        : `/lobby?room=${encodeURIComponent(room)}&intent=join`;
      return { ok: true, room, invite: invite || undefined, href };
    }

    const roomMatch = parsed.pathname.match(/^\/meet\/rooms\/([^/]+)$/);
    if (roomMatch?.[1]) {
      const room = decodeURIComponent(roomMatch[1]);
      return { ok: true, room, href: `/lobby?room=${encodeURIComponent(room)}&intent=join` };
    }
  } catch {
    return { ok: false, error: 'Meeting not found' };
  }

  return { ok: false, error: 'Meeting not found' };
}

export async function requestSecureMeetingInvitation(
  fetchLike: FetchLike,
  origin: string,
  persistedMeetingId: string,
): Promise<string> {
  const response = await fetchLike(
    `/api/meetings/${encodeURIComponent(persistedMeetingId)}/invitations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role: 'attendee', expiresAt: null, maxUses: 1 }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as SecureInvitationResponse;

  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? 'Unable to create invitation');
  }

  return `${origin.replace(/\/$/, '')}${payload.url}`;
}

export function isNativeShareAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

export async function copyMeetingInviteText(
  navigatorLike: NavigatorLike,
  text: string,
  kind: MeetingInviteCopyKind,
): Promise<MeetingInviteResult> {
  try {
    if (typeof navigatorLike.clipboard?.writeText !== 'function') {
      throw new Error('Clipboard is unavailable');
    }

    await navigatorLike.clipboard.writeText(text);
    return { status: 'copied', kind };
  } catch (error) {
    return { status: 'failed', error };
  }
}

export async function shareMeetingInvite(
  navigatorLike: NavigatorLike,
  invite: { title: string; text: string; url: string },
): Promise<MeetingInviteResult> {
  if (typeof navigatorLike.share === 'function') {
    const shareData: ShareData = invite;

    try {
      if (!navigatorLike.canShare || navigatorLike.canShare(shareData)) {
        await navigatorLike.share(shareData);
        return { status: 'shared' };
      }
    } catch (error) {
      if (isNativeShareAbort(error)) {
        return { status: 'cancelled' };
      }

      // If native sharing genuinely fails, still honor the clipboard fallback.
    }
  }

  return copyMeetingInviteText(navigatorLike, invite.url, 'link');
}