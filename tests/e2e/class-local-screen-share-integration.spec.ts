import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("ClassLiveSession local screen-share hook integration contracts", () => {
  let classLiveSessionTsx: string;

  test.beforeAll(async () => {
    classLiveSessionTsx = await readFile(
      path.resolve(process.cwd(), "components/class/ClassLiveSession.tsx"),
      "utf-8"
    );
  });

  test("imports and calls useScreenShare with the narrowed presentation room", () => {
    expect(classLiveSessionTsx).toMatch(
      /import \{ useScreenShare \} from "@\/hooks\/useScreenShare";/
    );
    expect(classLiveSessionTsx).toMatch(
      /const presentationRoom =\s*liveKitRoom instanceof Room \? liveKitRoom : null;/
    );
    expect(classLiveSessionTsx).toMatch(/useScreenShare\(\{\s*room: presentationRoom,\s*\}\)/);
  });

  test("reads the hook's local screen-share return values", () => {
    expect(classLiveSessionTsx).toMatch(/screenStream,/);
    expect(classLiveSessionTsx).toMatch(/isScreenSharing,/);
    expect(classLiveSessionTsx).toMatch(/toggleScreenShare,/);
    expect(classLiveSessionTsx).toMatch(/stopScreenShare,/);
  });

  test("wires existing Class controls and local presentation UI to hook state", () => {
    expect(classLiveSessionTsx).toMatch(/isScreenSharing=\{isScreenSharing\}/);
    expect(classLiveSessionTsx).toMatch(/toggleScreenShare=\{\(\) => void toggleScreenShare\(\)\}/);
    expect(classLiveSessionTsx).toMatch(
      /<ParticipantFilmstrip participants=\{allParticipants\} screenStream=\{screenStream\} \/>/
    );
    expect(classLiveSessionTsx).toMatch(/screenStream: MediaStream \| null;/);
  });

  test("removes direct Class-local display capture and publishing", () => {
    expect(classLiveSessionTsx).not.toMatch(/getDisplayMedia/);
    expect(classLiveSessionTsx).not.toMatch(/publishScreenShareTrack/);
    expect(classLiveSessionTsx).not.toMatch(/screenStreamRef/);
    expect(classLiveSessionTsx).not.toMatch(/source:\s*Track\.Source\.ScreenShare/);
  });

  test("does not create another Room or add another connection", () => {
    const roomCreations = classLiveSessionTsx.match(/new Room\(/g) ?? [];
    const connectCalls = classLiveSessionTsx.match(/\.connect\(/g) ?? [];

    expect(roomCreations).toHaveLength(1);
    expect(connectCalls).toHaveLength(1);
    expect(classLiveSessionTsx).not.toMatch(/as unknown as Room/);
  });

  test("preserves remote presentation integration", () => {
    expect(classLiveSessionTsx).toMatch(/useRemotePresentations\(presentationRoom\)/);
    expect(classLiveSessionTsx).toMatch(/<PresentationStage presentation=\{focusedPresentation\} \/>/);
  });

  test("does not add screen-share audio, Meet references, or production URLs", () => {
    expect(classLiveSessionTsx).not.toMatch(/Track\.Source\.ScreenShareAudio/);
    expect(classLiveSessionTsx).not.toMatch(/ScreenShareAudio/);
    expect(classLiveSessionTsx).not.toMatch(/components\/meet(?!ing)|@\/components\/meet(?!ing)|app\/meet|@\/app\/meet/);
    expect(classLiveSessionTsx).not.toMatch(/https?:\/\//);
  });

  test("preserves microphone and camera capture and publication contracts", () => {
    expect(classLiveSessionTsx).toMatch(/navigator\?\.mediaDevices\?\.getUserMedia/);
    expect(classLiveSessionTsx).toMatch(/audio:\s*true/);
    expect(classLiveSessionTsx).toMatch(/video:\s*true/);
    expect(classLiveSessionTsx).toMatch(/localStream\.getAudioTracks\(\)\[0\]/);
    expect(classLiveSessionTsx).toMatch(/localStream\.getVideoTracks\(\)\[0\]/);
    expect(classLiveSessionTsx).toMatch(/source: Track\.Source\.Microphone/);
    expect(classLiveSessionTsx).toMatch(/source: Track\.Source\.Camera/);
  });

  test("explicit Class leave stops screen sharing through the hook", () => {
    expect(classLiveSessionTsx).toMatch(/void stopScreenShare\(\)\.finally\(\(\) => \{/);
    expect(classLiveSessionTsx).toMatch(/disconnectFromRoom\(\);/);
    expect(classLiveSessionTsx).toMatch(/router\.push\("\/class\/dashboard"\)/);
  });
});