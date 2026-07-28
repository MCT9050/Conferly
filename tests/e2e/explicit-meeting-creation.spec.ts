import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildMeetingInsert,
  createExplicitMeeting,
  normalizeMeetingSlug,
} from '../../lib/meetingPersistence';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_OWNER_ID = '22222222-2222-4222-8222-222222222222';

type InsertResult = {
  data: { id: string; slug: string; owner: string } | null;
  error: { code?: string } | null;
};

function createFakeSupabase(results: InsertResult[]) {
  const insertedPayloads: unknown[] = [];

  const client = {
    from(table: string) {
      expect(table).toBe('meetings');

      return {
        insert(payload: unknown) {
          insertedPayloads.push(payload);

          return {
            select(columns: string) {
              expect(columns).toBe('id, slug, owner');

              return {
                async single() {
                  const result = results.shift() ?? { data: null, error: { code: 'TEST_NO_RESULT' } };
                  if (result.data?.slug === '$payload.slug') {
                    const inserted = payload as { slug: string; owner: string };

                    return {
                      data: { ...result.data, slug: inserted.slug, owner: inserted.owner },
                      error: result.error,
                    };
                  }

                  return result;
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, insertedPayloads };
}

test.describe('explicit meeting creation contract', () => {
  test('authenticated owner creation payload contains authenticated owner and returned slug matches persisted row', async () => {
    const slug = normalizeMeetingSlug('Owner-Room-1');
    const { client, insertedPayloads } = createFakeSupabase([
      { data: { id: 'meeting-1', slug, owner: OWNER_ID }, error: null },
    ]);

    const result = await createExplicitMeeting(client as never, OWNER_ID, slug);

    expect(result).toEqual({ ok: true, id: 'meeting-1', slug });
    expect(insertedPayloads).toHaveLength(1);
    expect(insertedPayloads[0]).toMatchObject({
      owner: OWNER_ID,
      user_id: OWNER_ID,
      slug,
      room_code: slug,
    });
  });

  test('creation helper never accepts an arbitrary client-supplied owner', () => {
    const payload = buildMeetingInsert({
      ownerId: OWNER_ID,
      slug: 'safe-room-1',
      title: 'Safe room',
    });

    expect(payload.owner).toBe(OWNER_ID);
    expect(payload.user_id).toBe(OWNER_ID);
    expect(payload.owner).not.toBe(OTHER_OWNER_ID);
  });

  test('unauthenticated caller cannot create because owner must be a valid authenticated UUID', async () => {
    const { client, insertedPayloads } = createFakeSupabase([]);

    await expect(createExplicitMeeting(client as never, '', 'safe-room-2')).rejects.toThrow(
      'ownerId is required',
    );
    expect(insertedPayloads).toHaveLength(0);
  });

  test('repeated rapid clicks are guarded by a disabled creating state in both create buttons', async () => {
    const createButton = await readFile(
      path.join(process.cwd(), 'components', 'CreateMeetingButton.tsx'),
      'utf8',
    );
    const legacyDashboard = await readFile(
      path.join(process.cwd(), 'components', 'ClientDashboard.tsx'),
      'utf8',
    );

    expect(createButton).toContain('if (isCreating) return;');
    expect(createButton).toContain('disabled={isCreating}');
    expect(legacyDashboard).toContain('if (createLoading) return;');
    expect(legacyDashboard).toContain('disabled={createLoading}');
  });

  test('duplicate slug handling never returns another owner’s existing meeting', async () => {
    const { client, insertedPayloads } = createFakeSupabase([
      { data: null, error: { code: '23505' } },
    ]);

    const result = await createExplicitMeeting(client as never, OWNER_ID, 'shared-room');

    expect(result).toEqual({ ok: false, status: 409, error: 'slug_conflict' });
    expect(insertedPayloads).toHaveLength(1);
  });

  test('generated duplicate slug retries create exactly one persisted row', async () => {
    const { client, insertedPayloads } = createFakeSupabase([
      { data: null, error: { code: '23505' } },
      { data: { id: 'meeting-2', slug: '$payload.slug', owner: OWNER_ID }, error: null },
    ]);

    const result = await createExplicitMeeting(client as never, OWNER_ID);

    expect(result.ok).toBe(true);
    expect(insertedPayloads).toHaveLength(2);
  });

  test('creation route requires an authenticated session before inserting', async () => {
    const route = await readFile(path.join(process.cwd(), 'app', 'api', 'meetings', 'route.ts'), 'utf8');

    expect(route).toContain('getServerSession(request)');
    expect(route).toContain('!session?.userId');
    expect(route).toContain('{ status: 401 }');
    expect(route).not.toContain('ownerId: payload');
  });
});

test.describe('meeting verification stays read-only', () => {
  test('verifyRoomAccess and unified verifyAccess perform no meeting insert for nonexistent slugs', async () => {
    const meetingAuth = await readFile(path.join(process.cwd(), 'lib', 'meetingAuth.ts'), 'utf8');
    const accessControl = await readFile(path.join(process.cwd(), 'lib', 'accessControl.ts'), 'utf8');

    expect(meetingAuth).toContain('maybeSingle()');
    expect(meetingAuth).not.toContain('.insert(');
    expect(meetingAuth).not.toContain('createExplicitMeeting');
    expect(meetingAuth).not.toContain('createPersonalRoom');
    expect(accessControl).not.toContain('.insert(');
    expect(accessControl).not.toContain('createExplicitMeeting');
    expect(accessControl).not.toContain('createPersonalRoom');
  });

  test('participant, spectator, public, and lk-token flows do not create meetings', async () => {
    const lobbyPreJoin = await readFile(path.join(process.cwd(), 'components', 'LobbyPreJoin.tsx'), 'utf8');
    const tokenRoute = await readFile(path.join(process.cwd(), 'app', 'api', 'lk-token', 'route.ts'), 'utf8');

    expect(lobbyPreJoin).not.toContain('/api/meetings');
    expect(lobbyPreJoin).not.toContain('.insert(');
    expect(tokenRoute).toContain('verifyAccess');
    expect(tokenRoute).not.toContain('/api/meetings');
    expect(tokenRoute).not.toContain(".from('meetings')\n      .insert");
    expect(tokenRoute).not.toContain('createExplicitMeeting');
    expect(tokenRoute).not.toContain('createPersonalRoom');
  });
});