import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("MeetLiveSession remote presentation integration contracts", () => {
  let meetLiveSessionTsx: string;

  test.beforeAll(async () => {
    meetLiveSessionTsx = await readFile(
      path.resolve(process.cwd(), "components/meet/MeetLiveSession.tsx"),
      "utf-8"
    );
  });

  test("retains the LiveKitRoomLike room declaration", () => {
    expect(meetLiveSessionTsx).toMatch(
      /let liveKitRoom: LiveKitRoomLike \| null = null;/
    );
    expect(meetLiveSessionTsx).not.toMatch(/let liveKitRoom: Room \| null = null;/);
  });

  test("keeps the LiveKitRoomLike assignment assertion", () => {
    expect(meetLiveSessionTsx).toMatch(
      /const room = new Room\(\{ adaptiveStream: true, dynacast: true \}\) as unknown as LiveKitRoomLike;/
    );
    expect(meetLiveSessionTsx).toMatch(/liveKitRoom = room;/);
  });

  test("imports Room as a runtime value", () => {
    expect(meetLiveSessionTsx).toMatch(/import \{ Room \} from "livekit-client";/);
    expect(meetLiveSessionTsx).not.toMatch(/import type \{ Room \} from "livekit-client";/);
  });

  test("uses instanceof Room to narrow for the presentation hook", () => {
    expect(meetLiveSessionTsx).toMatch(
      /const presentationRoom =\s*liveKitRoom instanceof Room \? liveKitRoom : null;/
    );
  });

  test("does not use an unsafe double cast to Room", () => {
    expect(meetLiveSessionTsx).not.toMatch(/as unknown as Room/);
  });

  test("passes presentationRoom to useRemotePresentations", () => {
    expect(meetLiveSessionTsx).toMatch(/useRemotePresentations\(presentationRoom\)/);
    expect(meetLiveSessionTsx).not.toMatch(/useRemotePresentations\(liveKitRoom/);
  });

  test("passes focused presentation into the shared Meet foundation", () => {
    expect(meetLiveSessionTsx).toContain('focusedPresentation={focusedPresentation}');
    expect(meetLiveSessionTsx).toContain('<MeetSharedLiveRoomContent');
    expect(meetLiveSessionTsx).not.toContain('<VideoGrid');
  });

  test("does not create a second Room", () => {
    const roomCreations = meetLiveSessionTsx.match(/new Room\(/g) ?? [];
    expect(roomCreations).toHaveLength(1);
  });

  test("does not add a second connect call", () => {
    const connectCalls = meetLiveSessionTsx.match(/\.connect\(/g) ?? [];
    expect(connectCalls).toHaveLength(1);
  });

  test("delegates the local screen-sharing lifecycle to useScreenShare", () => {
    expect(meetLiveSessionTsx).toMatch(/import \{ useScreenShare \} from "@\/hooks\/useScreenShare";/);
    expect(meetLiveSessionTsx).toMatch(/useScreenShare\(\{\s*room: presentationRoom,\s*\}\)/);
    expect(meetLiveSessionTsx).not.toMatch(/async function toggleScreenShare\(\)/);
    expect(meetLiveSessionTsx).not.toMatch(/async function publishScreenShareTrack/);
    expect(meetLiveSessionTsx).not.toMatch(/getDisplayMedia/);
    expect(meetLiveSessionTsx).toMatch(/toggleScreenShare=\{\(\) => void toggleScreenShare\(\)\}/);
    expect(meetLiveSessionTsx).toMatch(/screenStream=\{screenStream\}/);
    expect(meetLiveSessionTsx).toMatch(/isScreenSharing=\{isScreenSharing\}/);
  });

  test("synchronizes remote screen-share tracks into participant screenShareStream", () => {
    expect(meetLiveSessionTsx).toContain('const remoteScreenShareStreams = new Map<string, MediaStream>()');
    expect(meetLiveSessionTsx).toContain('const screenSharePub = participant.getTrackPublication?.(Track.Source.ScreenShare);');
    expect(meetLiveSessionTsx).toContain('const screenShareStream = getParticipantScreenShareStream(participantId, screenShareTrack);');
    expect(meetLiveSessionTsx).toContain('screenShareStream,');
  });
});