import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("ClassLiveSession remote presentation integration contracts", () => {
  let classLiveSessionTsx: string;

  test.beforeAll(async () => {
    classLiveSessionTsx = await readFile(
      path.resolve(process.cwd(), "components/class/ClassLiveSession.tsx"),
      "utf-8"
    );
  });

  test("imports the approved remote presentation primitives", () => {
    expect(classLiveSessionTsx).toMatch(
      /import \{ useRemotePresentations \} from "@\/hooks\/useRemotePresentations";/
    );
    expect(classLiveSessionTsx).toMatch(
      /import PresentationStage from "@\/components\/presentation\/PresentationStage";/
    );
  });

  test("retains the existing structural Class room type", () => {
    expect(classLiveSessionTsx).toMatch(/let liveKitRoom: any = null;/);
    expect(classLiveSessionTsx).not.toMatch(/let liveKitRoom: Room \| null = null;/);
  });

  test("uses runtime Room narrowing without unsafe double casting", () => {
    expect(classLiveSessionTsx).toMatch(/import \{ Room \} from "livekit-client";/);
    expect(classLiveSessionTsx).not.toMatch(/import type \{ Room \} from "livekit-client";/);
    expect(classLiveSessionTsx).toMatch(
      /const presentationRoom =\s*liveKitRoom instanceof Room \? liveKitRoom : null;/
    );
    expect(classLiveSessionTsx).not.toMatch(/as unknown as Room/);
  });

  test("calls the remote presentation hook with the narrowed room", () => {
    expect(classLiveSessionTsx).toMatch(
      /const \{ focusedPresentation \} = useRemotePresentations\(presentationRoom\);/
    );
    expect(classLiveSessionTsx).not.toMatch(/useRemotePresentations\(liveKitRoom/);
  });

  test("renders the focused remote presentation above the Class participant layout", () => {
    expect(classLiveSessionTsx).toMatch(
      /<PresentationStage presentation=\{focusedPresentation\} \/>\s*\{\/\* Classroom layout: whiteboard \+ filmstrip \+ sidebar \*\/\}\s*<div className="grid gap-4 xl:grid-cols-\[1fr,auto\]">/
    );
    expect(classLiveSessionTsx).not.toMatch(/<PresentationStage[^>]*screenStream=/);
  });

  test("does not create a second Room or add another connect call", () => {
    const roomCreations = classLiveSessionTsx.match(/new Room\(/g) ?? [];
    const connectCalls = classLiveSessionTsx.match(/\.connect\(/g) ?? [];

    expect(roomCreations).toHaveLength(1);
    expect(connectCalls).toHaveLength(1);
  });

  test("does not add screen-share audio handling", () => {
    expect(classLiveSessionTsx).not.toMatch(/Track\.Source\.ScreenShareAudio/);
    expect(classLiveSessionTsx).not.toMatch(/ScreenShareAudio/);
  });

  test("delegates the local Class screen-share lifecycle to useScreenShare", () => {
    expect(classLiveSessionTsx).toMatch(
      /import \{ useScreenShare \} from "@\/hooks\/useScreenShare";/
    );
    expect(classLiveSessionTsx).toMatch(/useScreenShare\(\{\s*room: presentationRoom,\s*\}\)/);
    expect(classLiveSessionTsx).not.toMatch(/getDisplayMedia/);
    expect(classLiveSessionTsx).not.toMatch(/publishScreenShareTrack/);
    expect(classLiveSessionTsx).not.toMatch(/screenStreamRef/);
    expect(classLiveSessionTsx).toMatch(/toggleScreenShare=\{\(\) => void toggleScreenShare\(\)\}/);
  });

  test("does not reference Meet route code or production URLs", () => {
    expect(classLiveSessionTsx).not.toMatch(/components\/meet(?!ing)|@\/components\/meet(?!ing)|app\/meet|@\/app\/meet/);
    expect(classLiveSessionTsx).not.toMatch(/https?:\/\//);
  });

  test("preserves microphone and camera publication sources", () => {
    expect(classLiveSessionTsx).toMatch(/source: Track\.Source\.Microphone/);
    expect(classLiveSessionTsx).toMatch(/source: Track\.Source\.Camera/);
    expect(classLiveSessionTsx).toMatch(/localStream\.getAudioTracks\(\)\[0\]/);
    expect(classLiveSessionTsx).toMatch(/localStream\.getVideoTracks\(\)\[0\]/);
  });
});