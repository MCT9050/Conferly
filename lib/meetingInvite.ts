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

export function buildCanonicalMeetingUrl(origin: string, roomId: string): string {
  return `${origin.replace(/\/$/, '')}/meet/rooms/${encodeURIComponent(roomId)}`;
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