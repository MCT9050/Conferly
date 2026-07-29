import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildCanonicalLobbyInviteUrl,
  buildCanonicalMeetingUrl,
  copyMeetingInviteText,
  normalizeMeetingJoinTarget,
  requestSecureMeetingInvitation,
  shareMeetingInvite,
} from '../../lib/meetingInvite';

test.describe('meeting invite runtime helpers', () => {
  test('canonical URL uses the current origin and encoded route slug', () => {
    const url = buildCanonicalMeetingUrl('https://conferly.site/', 'team weekly/abc123');

    expect(url).toBe('https://conferly.site/meet/rooms/team%20weekly%2Fabc123');
    expect(url).toContain('/meet/rooms/');
    expect(url).not.toContain('00000000-0000-0000-0000-000000000000');
  });

  test('secure invite lobby URL uses room plus raw invite token', () => {
    const url = buildCanonicalLobbyInviteUrl(
      'https://conferly.site/',
      'team-weekly',
      'rawToken_123',
    );

    expect(url).toBe(
      'https://conferly.site/lobby?room=team-weekly&intent=join&invite=rawToken_123',
    );
  });

  test('join target normalization accepts lobby invite URLs, room URLs, and raw codes', () => {
    expect(
      normalizeMeetingJoinTarget(
        'https://conferly.site/lobby?room=alpha-room&intent=join&invite=token_123',
      ),
    ).toEqual({
      ok: true,
      room: 'alpha-room',
      invite: 'token_123',
      href: '/lobby?room=alpha-room&intent=join&invite=token_123',
    });

    expect(normalizeMeetingJoinTarget('/meet/rooms/team%20weekly')).toEqual({
      ok: true,
      room: 'team weekly',
      href: '/lobby?room=team%20weekly&intent=join',
    });

    expect(normalizeMeetingJoinTarget('ABC123')).toEqual({
      ok: true,
      room: 'ABC123',
      href: '/lobby?room=ABC123&intent=join',
    });
  });

  test('persisted UUID selects the invitation endpoint while the generated URL retains the route slug', async () => {
    const persistedMeetingId = '8f267b18-e11c-47db-9729-53af8087f908';
    const routeSlug = 'weekly-product-sync';
    const requests: Array<{ input: string; init: RequestInit }> = [];

    const invitationUrl = await requestSecureMeetingInvitation(
      async (input, init) => {
        requests.push({ input, init });
        return {
          ok: true,
          json: async () => ({
            url: `/lobby?room=${routeSlug}&intent=join&invite=server-token`,
          }),
        };
      },
      'https://conferly.site/',
      persistedMeetingId,
    );

    expect(routeSlug).not.toBe(persistedMeetingId);
    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe(
      `/api/meetings/${persistedMeetingId}/invitations`,
    );
    expect(requests[0].input).not.toContain(routeSlug);
    expect(requests[0].init.method).toBe('POST');
    expect(invitationUrl).toBe(
      `https://conferly.site/lobby?room=${routeSlug}&intent=join&invite=server-token`,
    );
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
  test('active Meet dashboard renders the Join Existing Meeting input', async () => {
    const dashboardPage = await readFile(
      path.join(process.cwd(), 'app', 'meet', 'dashboard', 'page.tsx'),
      'utf8',
    );
    const joinComponent = await readFile(
      path.join(process.cwd(), 'components', 'meet', 'JoinExistingMeeting.tsx'),
      'utf8',
    );

    expect(dashboardPage).toContain("import JoinExistingMeeting from '@/components/meet/JoinExistingMeeting'");
    expect(dashboardPage).toContain('<JoinExistingMeeting />');
    expect(joinComponent).toContain('Meeting link or code');
    expect(joinComponent).toContain('Join meeting');
    expect(joinComponent).toContain('normalizeMeetingJoinTarget');
    expect(joinComponent).not.toContain("fetch('/api/meetings'");
  });

  test('Invite renders in active controls and only owners can generate secure invitation credentials', async () => {
    const controls = await readFile(path.join(process.cwd(), 'components', 'MeetingControls.tsx'), 'utf8');
    const liveSession = await readFile(
      path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'),
      'utf8',
    );

    expect(liveSession).toContain('roomId={roomId}');
    expect(liveSession).toContain('meetingId={meetingId}');
    expect(liveSession).toContain('isOwner={isOwner}');
    expect(controls).toContain('Invite participants: copy secure meeting invitation');
    expect(controls).toContain('Copy secure invite link');
    expect(controls).toContain('Copy meeting code');
    expect(controls).toContain('Share using device');
    expect(controls).toContain('Meeting code');
    expect(controls).toContain('if (!isOwner)');
  });

  test('Invite implementation creates secure invitations without calling generic meeting creation', async () => {
    const controls = await readFile(path.join(process.cwd(), 'components', 'MeetingControls.tsx'), 'utf8');
    const helper = await readFile(path.join(process.cwd(), 'lib', 'meetingInvite.ts'), 'utf8');
    const inviteRoute = await readFile(
      path.join(process.cwd(), 'app', 'api', 'meetings', '[meetingId]', 'invitations', 'route.ts'),
      'utf8',
    );

    expect(controls).toContain('requestSecureMeetingInvitation(fetch, window.location.origin, meetingId)');
    expect(controls).not.toContain('createExplicitMeeting');
    expect(inviteRoute).toContain('token_hash');
    expect(inviteRoute).not.toContain('console.log');
    expect(helper).toContain("/meet/rooms/${encodeURIComponent(roomId)}");
    expect(helper).toContain("/lobby?");
  });

  test('lobby acceptance removes invite token from the visible URL and uses the acceptance endpoint', async () => {
    const lobby = await readFile(path.join(process.cwd(), 'components', 'LobbyPreJoin.tsx'), 'utf8');
    const joinComponent = await readFile(
      path.join(process.cwd(), 'components', 'meet', 'JoinExistingMeeting.tsx'),
      'utf8',
    );
    const acceptRoute = await readFile(
      path.join(process.cwd(), 'app', 'api', 'meeting-invitations', 'accept', 'route.ts'),
      'utf8',
    );

    expect(lobby).toContain("params.delete('invite')");
    expect(lobby).toContain("window.history.replaceState");
    expect(lobby).toContain('/api/meeting-invitations/accept');
    expect(lobby).not.toContain('/api/meetings');
    expect(joinComponent).toContain('Meeting link or code');
    expect(joinComponent).toContain('normalizeMeetingJoinTarget');
    expect(acceptRoute).toContain("rpc('accept_meeting_invitation'");
  });

  test('private slug alone does not grant membership and invalid invites do not navigate to meeting creation', async () => {
    const meetingAuth = await readFile(path.join(process.cwd(), 'lib', 'meetingAuth.ts'), 'utf8');
    const lobby = await readFile(path.join(process.cwd(), 'components', 'LobbyPreJoin.tsx'), 'utf8');

    expect(meetingAuth).toContain("if (meeting.is_public)");
    expect(meetingAuth).toMatch(/if \(meeting\.is_public\)[\s\S]*return null;/);
    expect(lobby).toContain('const accepted = await acceptInvitation();');
    expect(lobby).toContain('if (!accepted) return;');
    expect(lobby.indexOf('const accepted = await acceptInvitation();')).toBeLessThan(
      lobby.indexOf('router.push(`/meet/rooms/${encodeURIComponent(roomId)}`)'),
    );
    expect(lobby).not.toContain("router.push('/meeting')");
    expect(lobby).not.toContain('/api/meetings');
  });

  test('creation authorization is server authoritative and LiveKit uses the route slug consistently', async () => {
    const inviteRoute = await readFile(
      path.join(process.cwd(), 'app', 'api', 'meetings', '[meetingId]', 'invitations', 'route.ts'),
      'utf8',
    );
    const liveSession = await readFile(
      path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'),
      'utf8',
    );

    expect(inviteRoute).toContain(".eq('id', meetingId)");
    expect(inviteRoute).toContain('if (meeting.owner !== session.userId)');
    expect(inviteRoute).toContain("{ status: 403 }");
    expect(liveSession).toContain('const joined = await connectToRoom(roomId);');
    expect(liveSession).toContain('body: JSON.stringify({ roomId, role: "participant" })');
  });

  test('active controls preserve critical meeting controls while adding secure Invite', async () => {
    const controls = await readFile(path.join(process.cwd(), 'components', 'MeetingControls.tsx'), 'utf8');

    expect(controls).toContain('toggleMute');
    expect(controls).toContain('toggleVideo');
    expect(controls).toContain('toggleScreenShare');
    expect(controls).toContain('openSidebarTab');
    expect(controls).toContain('handleLeave');
    expect(controls).toContain('aria-live="polite"');
  });
});