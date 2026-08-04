import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test.describe('useRemotePresentations source contracts', () => {
  let presentationTs: string;
  let hookTs: string;

  test.beforeAll(async () => {
    presentationTs = await readFile(
      path.resolve(process.cwd(), 'types/presentation.ts'),
      'utf-8'
    );
    hookTs = await readFile(
      path.resolve(process.cwd(), 'hooks/useRemotePresentations.ts'),
      'utf-8'
    );
  });

  test.describe('forbidden imports and APIs', () => {
    test('does not import vitest or testing-library', () => {
      expect(hookTs).not.toMatch(/vitest/);
      expect(hookTs).not.toMatch(/@testing-library/);
      expect(presentationTs).not.toMatch(/vitest/);
      expect(presentationTs).not.toMatch(/@testing-library/);
    });

    test('does not import vite', () => {
      expect(hookTs).not.toMatch(/\bvite\b/);
      expect(presentationTs).not.toMatch(/\bvite\b/);
    });

    test('does not call browser display-capture APIs', () => {
      expect(hookTs).not.toMatch(/getDisplayMedia/);
      expect(hookTs).not.toMatch(/displayMedia/);
      expect(hookTs).not.toMatch(/getUserMedia/);
      expect(presentationTs).not.toMatch(/getDisplayMedia/);
      expect(presentationTs).not.toMatch(/displayMedia/);
    });

    test('does not contain camera or microphone publishing code', () => {
      expect(hookTs).not.toMatch(/camera/i);
      expect(hookTs).not.toMatch(/microphone/i);
      expect(hookTs).not.toMatch(/publish.*camera/i);
      expect(hookTs).not.toMatch(/publish.*microphone/i);
    });

    test('does not create a Room or call room.connect', () => {
      expect(hookTs).not.toMatch(/new Room\(/);
      expect(hookTs).not.toMatch(/\.connect\(/);
    });

    test('does not reference production URLs', () => {
      expect(hookTs).not.toMatch(/wss?:\/\//);
      expect(presentationTs).not.toMatch(/wss?:\/\//);
    });

    test('does not contain polling intervals', () => {
      expect(hookTs).not.toMatch(/setInterval/);
      expect(hookTs).not.toMatch(/setTimeout/);
    });
  });

  test.describe('LiveKit event coverage', () => {
    test('registers TrackPublished', () => {
      expect(hookTs).toMatch(/RoomEvent\.TrackPublished/);
    });

    test('registers TrackSubscribed', () => {
      expect(hookTs).toMatch(/RoomEvent\.TrackSubscribed/);
    });

    test('registers TrackUnsubscribed', () => {
      expect(hookTs).toMatch(/RoomEvent\.TrackUnsubscribed/);
    });

    test('registers TrackUnpublished', () => {
      expect(hookTs).toMatch(/RoomEvent\.TrackUnpublished/);
    });

    test('registers ParticipantDisconnected', () => {
      expect(hookTs).toMatch(/RoomEvent\.ParticipantDisconnected/);
    });

    test('registers Connected', () => {
      expect(hookTs).toMatch(/RoomEvent\.Connected/);
    });

    test('registers Reconnected', () => {
      expect(hookTs).toMatch(/RoomEvent\.Reconnected/);
    });
  });

  test.describe('screen-share source handling', () => {
    test('handles Track.Source.ScreenShare', () => {
      expect(hookTs).toMatch(/Track\.Source\.ScreenShare/);
    });

    test('handles Track.Source.ScreenShareAudio', () => {
      expect(hookTs).toMatch(/Track\.Source\.ScreenShareAudio/);
    });

    test('does not add camera or microphone sources as presentations', () => {
      expect(hookTs).not.toMatch(/Track\.Source\.Camera/);
      expect(hookTs).not.toMatch(/Track\.Source\.Microphone/);
    });
  });

  test.describe('hook contract', () => {
    test('accepts Room | null as dependency', () => {
      expect(hookTs).toMatch(/room: Room \| null/);
    });

    test('does not create a new Room', () => {
      expect(hookTs).not.toMatch(/new Room/);
    });

    test('does not call room.connect', () => {
      expect(hookTs).not.toMatch(/\.connect\(/);
    });

    test('removes listeners during cleanup', () => {
      expect(hookTs).toMatch(/room\.off\(/);
      expect(hookTs).toMatch(/listenerCleanupRef/);
    });

    test('performs initial scan on mount', () => {
      expect(hookTs).toMatch(/scanExistingPresentations/);
    });

    test('rebuilds on Connected', () => {
      expect(hookTs).toMatch(/handleConnected/);
      expect(hookTs).toMatch(/scanExistingPresentations\(roomRef\.current\)/);
    });

    test('rebuilds on Reconnected', () => {
      expect(hookTs).toMatch(/handleReconnected/);
    });

    test('preserves focus when possible', () => {
      expect(hookTs).toMatch(/focusFirstActivePresentation/);
      expect(hookTs).toMatch(/currentFocusExists/);
    });

    test('cleans up on participant disconnect', () => {
      expect(hookTs).toMatch(/handleParticipantDisconnected/);
      expect(hookTs).toMatch(/presentationsRef\.current\.delete/);
    });
  });

  test.describe('type contracts', () => {
    test('presentation type separates video and audio tracks', () => {
      expect(presentationTs).toMatch(/videoTrack: RemoteVideoTrack \| null/);
      expect(presentationTs).toMatch(/audioTrack: RemoteAudioTrack \| null/);
      expect(presentationTs).toMatch(/videoPublication: RemoteTrackPublication \| null/);
      expect(presentationTs).toMatch(/audioPublication: RemoteTrackPublication \| null/);
    });

    test('hook returns presentations, focus, and setter', () => {
      expect(hookTs).toMatch(/presentations: RemotePresentation\[\]/);
      expect(hookTs).toMatch(/focusedPresentationId: string \| null/);
      expect(hookTs).toMatch(/setFocusedPresentationId/);
    });
  });
});