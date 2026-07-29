import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildCanonicalMeetingUrl,
  copyMeetingInviteText,
  shareMeetingInvite,
} from '../../lib/meetingInvite';

test.describe('meeting invite runtime helpers', () => {
  test('canonical URL uses the current origin and encoded route slug', () => {
    const url = buildCanonicalMeetingUrl('https://conferly.site/', 'team weekly/abc123');

    expect(url).toBe('https://conferly.site/meet/rooms/team%20weekly%2Fabc123');
    expect(url).toContain('/meet/rooms/');
    expect(url).not.toContain('00000000-0000-0000-0000-000000000000');
  });

  test('native share is preferred when available', async () => {
    const shared: ShareData[] = [];
    const navigatorLike = {
      share: async (data: ShareData) => {
        shared.push(data);
      },
      clipboard: {
        writeText: async () => {
          throw new Error('clipboard should not be used');
        },
      },
    };

    const result = await shareMeetingInvite(navigatorLike, {
      title: 'Join my Conferly meeting',
      text: 'Meeting code: owner-room-1',
      url: 'https://conferly.site/meet/rooms/owner-room-1',
    });

    expect(result).toEqual({ status: 'shared' });
    expect(shared).toEqual([
      {
        title: 'Join my Conferly meeting',
        text: 'Meeting code: owner-room-1',
        url: 'https://conferly.site/meet/rooms/owner-room-1',
      },
    ]);
  });

  test('clipboard link fallback succeeds when native share is unavailable', async () => {
    const writes: string[] = [];
    const result = await shareMeetingInvite(
      {
        clipboard: {
          writeText: async (text: string) => {
            writes.push(text);
          },
        },
      },
      {
        title: 'Join my Conferly meeting',
        text: 'Meeting code: participant-room-1',
        url: 'https://app.test/meet/rooms/participant-room-1',
      },
    );

    expect(result).toEqual({ status: 'copied', kind: 'link' });
    expect(writes).toEqual(['https://app.test/meet/rooms/participant-room-1']);
  });

  test('copy meeting code succeeds separately from link copy', async () => {
    const writes: string[] = [];
    const result = await copyMeetingInviteText(
      {
        clipboard: {
          writeText: async (text: string) => {
            writes.push(text);
          },
        },
      },
      'team-weekly-abc123',
      'code',
    );

    expect(result).toEqual({ status: 'copied', kind: 'code' });
    expect(writes).toEqual(['team-weekly-abc123']);
  });

  test('clipboard failure reports a genuine failed state', async () => {
    const result = await copyMeetingInviteText(
      {
        clipboard: {
          writeText: async () => {
            throw new Error('denied');
          },
        },
      },
      'https://app.test/meet/rooms/team-weekly-abc123',
      'link',
    );

    expect(result.status).toBe('failed');
  });

  test('AbortError from native share cancellation is ignored', async () => {
    const result = await shareMeetingInvite(
      {
        share: async () => {
          throw new DOMException('Share cancelled', 'AbortError');
        },
      },
      {
        title: 'Join my Conferly meeting',
        text: 'Meeting code: owner-room-1',
        url: 'https://conferly.site/meet/rooms/owner-room-1',
      },
    );

    expect(result).toEqual({ status: 'cancelled' });
  });

  test('non-Abort native share failure falls back to clipboard', async () => {
    const writes: string[] = [];
    const result = await shareMeetingInvite(
      {
        share: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        },
        clipboard: {
          writeText: async (text: string) => {
            writes.push(text);
          },
        },
      },
      {
        title: 'Join my Conferly meeting',
        text: 'Meeting code: owner-room-1',
        url: 'https://conferly.site/meet/rooms/owner-room-1',
      },
    );

    expect(result).toEqual({ status: 'copied', kind: 'link' });
    expect(writes).toEqual(['https://conferly.site/meet/rooms/owner-room-1']);
  });

  test('non-Abort native share failure reports failure when clipboard also fails', async () => {
    const result = await shareMeetingInvite(
      {
        share: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        },
        clipboard: {
          writeText: async () => {
            throw new Error('Clipboard denied');
          },
        },
      },
      {
        title: 'Join my Conferly meeting',
        text: 'Meeting code: owner-room-1',
        url: 'https://conferly.site/meet/rooms/owner-room-1',
      },
    );

    expect(result.status).toBe('failed');
  });
});

test.describe('meeting invite active runtime wiring', () => {
  test('Invite renders in active controls and is available independent of owner role', async () => {
    const controls = await readFile(path.join(process.cwd(), 'components', 'MeetingControls.tsx'), 'utf8');
    const liveSession = await readFile(
      path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'),
      'utf8',
    );

    expect(liveSession).toContain('roomId={roomId}');
    expect(controls).toContain('Invite participants: copy meeting link');
    expect(controls).toContain('Copy meeting link');
    expect(controls).toContain('Copy meeting code');
    expect(controls).toContain('Share using device');
    expect(controls).toContain('Meeting code');
    expect(controls).not.toContain('role ===');
    expect(controls).not.toContain('isOwner');
  });

  test('Invite implementation does not call meeting creation or leak LiveKit room UUIDs into shared URLs', async () => {
    const controls = await readFile(path.join(process.cwd(), 'components', 'MeetingControls.tsx'), 'utf8');
    const helper = await readFile(path.join(process.cwd(), 'lib', 'meetingInvite.ts'), 'utf8');

    expect(controls).not.toContain('/api/meetings');
    expect(controls).not.toContain('createExplicitMeeting');
    expect(helper).not.toContain('/api/meetings');
    expect(helper).toContain("/meet/rooms/${encodeURIComponent(roomId)}");
    expect(helper).not.toContain('meetingId');
  });

  test('active controls preserve critical meeting controls while adding Invite', async () => {
    const controls = await readFile(path.join(process.cwd(), 'components', 'MeetingControls.tsx'), 'utf8');

    expect(controls).toContain('toggleMute');
    expect(controls).toContain('toggleVideo');
    expect(controls).toContain('toggleScreenShare');
    expect(controls).toContain('openSidebarTab');
    expect(controls).toContain('handleLeave');
    expect(controls).toContain('aria-live="polite"');
  });
});