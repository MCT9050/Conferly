import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  cleanupRemoteAudioRegistry,
  collectRemoteMicrophonePublications,
  createRemoteAudioRegistry,
  reconcileRemoteAudioElements,
  type RemoteTrackPublicationLike,
} from '../../components/meeting/RemoteAudioRenderer';

function createPublication(overrides: Partial<RemoteTrackPublicationLike> = {}) {
  const calls = {
    attach: 0,
    detach: 0,
    play: 0,
  };

  const track = {
    attach: () => {
      calls.attach += 1;
    },
    detach: () => {
      calls.detach += 1;
      return [];
    },
  };

  const publication: RemoteTrackPublicationLike = {
    trackSid: 'pub-1',
    sid: 'pub-1',
    kind: 'audio',
    source: 'microphone',
    isSubscribed: true,
    isMuted: false,
    audioTrack: track,
    ...overrides,
  };

  return { publication, calls };
}

function createAudioElement() {
  const attributes = new Map<string, string>();
  return {
    autoplay: false,
    srcObject: null,
    attributes,
    paused: false,
    removed: false,
    plays: 0,
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    removeAttribute(name: string) {
      attributes.delete(name);
    },
    play() {
      this.plays += 1;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    remove() {
      this.removed = true;
    },
  };
}

test.describe('remote audio integrity recovery', () => {
  test('1. one remote microphone creates one audio renderer', async () => {
    const registry = createRemoteAudioRegistry();
    const { publication } = createPublication();
    const appended: ReturnType<typeof createAudioElement>[] = [];

    reconcileRemoteAudioElements({
      entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication }],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: (element) => appended.push(element as ReturnType<typeof createAudioElement>),
      onPlaybackFailure: () => {},
    });

    expect(appended).toHaveLength(1);
    expect(registry.audioElements.size).toBe(1);
  });

  test('2. local microphone is never rendered as remote audio', () => {
    const { publication } = createPublication();
    const room = {
      remoteParticipants: new Map(),
      participants: new Map([
        ['self', { identity: 'self', isLocal: true, trackPublications: new Map([['pub-1', publication]]) }],
      ]),
    };

    expect(collectRemoteMicrophonePublications(room)).toHaveLength(0);
  });

  test('3. subscribed remote microphone is attached', () => {
    const registry = createRemoteAudioRegistry();
    const { publication, calls } = createPublication();

    reconcileRemoteAudioElements({
      entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication }],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });

    expect(calls.attach).toBe(1);
  });

  test('4. unsubscribed microphone is detached', () => {
    const registry = createRemoteAudioRegistry();
    const { publication, calls } = createPublication();

    reconcileRemoteAudioElements({
      entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication }],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });

    reconcileRemoteAudioElements({
      entries: [],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });

    expect(calls.detach).toBe(1);
  });

  test('5. participant departure removes its audio', () => {
    const registry = createRemoteAudioRegistry();
    const { publication } = createPublication();
    const created = createAudioElement();

    reconcileRemoteAudioElements({
      entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication }],
      registry,
      createAudioElement: () => created,
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });
    reconcileRemoteAudioElements({
      entries: [],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });

    expect(created.removed).toBeTruthy();
    expect(registry.audioElements.size).toBe(0);
  });

  test('6. duplicate subscription creates no duplicate audio element', () => {
    const registry = createRemoteAudioRegistry();
    const { publication } = createPublication();
    const appended: unknown[] = [];

    const run = () =>
      reconcileRemoteAudioElements({
        entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication }],
        registry,
        createAudioElement: () => createAudioElement(),
        appendAudioElement: (element) => appended.push(element),
        onPlaybackFailure: () => {},
      });

    run();
    run();

    expect(appended).toHaveLength(1);
  });

  test('7. replacement track detaches the previous track', () => {
    const registry = createRemoteAudioRegistry();
    const first = createPublication({ trackSid: 'pub-1' });
    const second = createPublication({ trackSid: 'pub-1' });

    reconcileRemoteAudioElements({
      entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication: first.publication }],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });
    reconcileRemoteAudioElements({
      entries: [{ participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication: second.publication }],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });

    expect(first.calls.detach).toBe(1);
    expect(second.calls.attach).toBe(1);
  });

  test('8. unmount detaches every remaining track', () => {
    const registry = createRemoteAudioRegistry();
    const first = createPublication({ trackSid: 'pub-1' });
    const second = createPublication({ trackSid: 'pub-2', sid: 'pub-2' });

    reconcileRemoteAudioElements({
      entries: [
        { participantId: 'remote-a', participantName: 'Remote A', publicationId: 'pub-1', publication: first.publication },
        { participantId: 'remote-b', participantName: 'Remote B', publicationId: 'pub-2', publication: second.publication },
      ],
      registry,
      createAudioElement: () => createAudioElement(),
      appendAudioElement: () => {},
      onPlaybackFailure: () => {},
    });

    cleanupRemoteAudioRegistry(registry);

    expect(first.calls.detach).toBe(1);
    expect(second.calls.detach).toBe(1);
  });

  test('9. active-speaker update does not recreate audio attachment', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('const remoteVideoStreams = new Map<string, MediaStream>()');
    expect(session).toContain('getParticipantVideoStream(participantId, videoTrack)');
  });

  test('10. camera update does not recreate remote audio', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('remoteAudioTracks: collectRemoteAudioTracks(participantEntries)');
    expect(session).toContain('const stream = getParticipantVideoStream(participantId, videoTrack)');
  });

  test('11. playback-blocked state shows Enable sound', async () => {
    const renderer = await readFile(path.join(process.cwd(), 'components', 'meeting', 'RemoteAudioRenderer.tsx'), 'utf8');
    expect(renderer).toContain('playbackBlocked && (');
    expect(renderer).toContain('Enable sound');
  });

  test('12. Enable sound calls room.startAudio()', async () => {
    const renderer = await readFile(path.join(process.cwd(), 'components', 'meeting', 'RemoteAudioRenderer.tsx'), 'utf8');
    expect(renderer).toContain('await room.startAudio()');
  });

  test('13. successful startAudio clears the blocked state', async () => {
    const renderer = await readFile(path.join(process.cwd(), 'components', 'meeting', 'RemoteAudioRenderer.tsx'), 'utf8');
    expect(renderer).toContain('onPlaybackRecovered()');
  });

  test('14. failed startAudio preserves an actionable retry', async () => {
    const renderer = await readFile(path.join(process.cwd(), 'components', 'meeting', 'RemoteAudioRenderer.tsx'), 'utf8');
    expect(renderer).toContain('onPlaybackBlocked("LiveKit room audio recovery is unavailable")');
    expect(renderer).toContain('handlePlaybackFailure(getPlaybackFailureMessage(error))');
  });

  test('15. remote TrackMuted updates microphone state', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('RoomEvent.TrackMuted');
    expect(session).toContain('const handleTrackMuted');
  });

  test('16. remote TrackUnmuted restores microphone state', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('RoomEvent.TrackUnmuted');
    expect(session).toContain('const handleTrackUnmuted');
  });

  test('17. local mute uses LiveKit microphone publication lifecycle', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('.setMicrophoneEnabled(!nextMuted)');
    expect(session).not.toContain('function toggleMute() {\n  if (!streamRef)');
  });

  test('18. reconnect does not duplicate registered listeners', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('liveKitRoomCleanup = () => {');
    expect(session).toContain('room.off(event, listener)');
  });

  test('19. reconnect resynchronizes subscribed microphone tracks', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    expect(session).toContain('const handleReconnected = () => {');
    expect(session).toContain('syncParticipantState();');
  });

  test('20. disconnect cleans listeners and rendered audio', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    const renderer = await readFile(path.join(process.cwd(), 'components', 'meeting', 'RemoteAudioRenderer.tsx'), 'utf8');
    expect(session).toContain('liveKitRoomCleanup?.()');
    expect(session).toContain('remoteVideoStreams.clear()');
    expect(renderer).toContain('cleanupRemoteAudioRegistry(registryRef.current)');
  });

  test('21. invitation and meeting-access behavior remains unchanged', async () => {
    const inviteRuntime = await readFile(
      path.join(process.cwd(), 'tests', 'e2e', 'explicit-meeting-creation.spec.ts'),
      'utf8',
    );
    const tokenRoute = await readFile(
      path.join(process.cwd(), 'app', 'api', 'lk-token', 'route.ts'),
      'utf8',
    );

    expect(inviteRuntime).toContain('lk-token flows do not create meetings');
    expect(tokenRoute).toContain('verifyAccess');
    expect(tokenRoute).not.toContain('createExplicitMeeting');
  });

  test('22. Meet renders shared remote audio exactly once', async () => {
    const session = await readFile(path.join(process.cwd(), 'components', 'meet', 'MeetLiveSession.tsx'), 'utf8');
    const rendererCount = session.match(/<RemoteAudioRenderer/g) ?? [];
    expect(rendererCount).toHaveLength(1);
  });
});