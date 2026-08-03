import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("MeetLiveSession local screen-share hook integration contracts", () => {
  let meetLiveSessionTsx: string;

  test.beforeAll(async () => {
    meetLiveSessionTsx = await readFile(
      path.resolve(process.cwd(), "components/meet/MeetLiveSession.tsx"),
      "utf-8"
    );
  });

  test("imports and calls useScreenShare with the narrowed presentation room", () => {
    expect(meetLiveSessionTsx).toMatch(/import \{ useScreenShare \} from "@\/hooks\/useScreenShare";/);
    expect(meetLiveSessionTsx).toMatch(
      /const presentationRoom =\s*liveKitRoom instanceof Room \? liveKitRoom : null;/
    );
    expect(meetLiveSessionTsx).toMatch(/useScreenShare\(\{\s*room: presentationRoom,\s*\}\)/);
  });

  test("uses returned toggleScreenShare, screenStream, and isScreenSharing", () => {
    expect(meetLiveSessionTsx).toMatch(/toggleScreenShare/);
    expect(meetLiveSessionTsx).toMatch(/screenStream=\{screenStream\}/);
    expect(meetLiveSessionTsx).toMatch(/isScreenSharing=\{isScreenSharing\}/);
    expect(meetLiveSessionTsx).toMatch(/toggleScreenShare=\{\(\) => void toggleScreenShare\(\)\}/);
  });

  test("removes direct Meet-local display capture and publishing", () => {
    expect(meetLiveSessionTsx).not.toMatch(/getDisplayMedia/);
    expect(meetLiveSessionTsx).not.toMatch(/publishScreenShareTrack/);
    expect(meetLiveSessionTsx).not.toMatch(/screenStreamRef/);
  });

  test("does not add another Room or connection", () => {
    const roomCreations = meetLiveSessionTsx.match(/new Room\(/g) ?? [];
    const connectCalls = meetLiveSessionTsx.match(/\.connect\(/g) ?? [];
    expect(roomCreations).toHaveLength(1);
    expect(connectCalls).toHaveLength(1);
  });

  test("preserves remote presentation viewing", () => {
    expect(meetLiveSessionTsx).toMatch(/useRemotePresentations\(presentationRoom\)/);
    expect(meetLiveSessionTsx).toMatch(/<PresentationStage presentation=\{focusedPresentation\} \/>/);
  });

  test("does not reference Class code or alter camera and microphone publication logic", () => {
    expect(meetLiveSessionTsx).not.toMatch(/ClassLiveSession/);
    expect(meetLiveSessionTsx).toMatch(/Track\.Source\.Microphone/);
    expect(meetLiveSessionTsx).toMatch(/Track\.Source\.Camera/);
    expect(meetLiveSessionTsx).toMatch(/setMicrophoneEnabled/);
  });

  test("does not add screen-share audio or production URLs", () => {
    expect(meetLiveSessionTsx).not.toMatch(/ScreenShareAudio/);
    expect(meetLiveSessionTsx).not.toMatch(/source:\s*Track\.Source\.ScreenShareAudio/);
    expect(meetLiveSessionTsx).not.toMatch(/wss?:\/\//);
  });
});
