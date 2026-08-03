import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("presentation main-stage layout source contracts", () => {
  let presentationStageTsx: string;
  let meetLiveSessionTsx: string;
  let classLiveSessionTsx: string;

  test.beforeAll(async () => {
    presentationStageTsx = await readFile(
      path.resolve(process.cwd(), "components/presentation/PresentationStage.tsx"),
      "utf-8"
    );
    meetLiveSessionTsx = await readFile(
      path.resolve(process.cwd(), "components/meet/MeetLiveSession.tsx"),
      "utf-8"
    );
    classLiveSessionTsx = await readFile(
      path.resolve(process.cwd(), "components/class/ClassLiveSession.tsx"),
      "utf-8"
    );
  });

  test.describe("PresentationStage", () => {
    test("keeps the nullable remote presentation contract", () => {
      expect(presentationStageTsx).toMatch(/presentation: RemotePresentation \| null/);
      expect(presentationStageTsx).toMatch(/if \(!presentation\)/);
      expect(presentationStageTsx).toMatch(/return null/);
    });

    test("renders the accessible shared-presentation surface", () => {
      expect(presentationStageTsx).toMatch(/<section/);
      expect(presentationStageTsx).toMatch(/aria-label="Shared presentation"/);
      expect(presentationStageTsx).toMatch(/border/);
      expect(presentationStageTsx).toMatch(/shadow/);
      expect(presentationStageTsx).toMatch(/bg-slate-950/);
    });

    test("preserves approved presentation primitives and loading status", () => {
      expect(presentationStageTsx).toMatch(/<PresentationVideo/);
      expect(presentationStageTsx).toMatch(/<PresenterLabel/);
      expect(presentationStageTsx).toContain("Starting presentation…");
      expect(presentationStageTsx).toMatch(/aria-live="polite"/);
    });

    test("uses responsive sizing and overflow protection", () => {
      expect(presentationStageTsx).toMatch(/aspect-video/);
      expect(presentationStageTsx).toMatch(/min-h-\[/);
      expect(presentationStageTsx).toMatch(/max-h-\[/);
      expect(presentationStageTsx).toMatch(/sm:/);
      expect(presentationStageTsx).toMatch(/lg:/);
      expect(presentationStageTsx).toMatch(/overflow-hidden/);
      expect(presentationStageTsx).toMatch(/max-h-full/);
    });

    test("does not add forbidden behavior", () => {
      expect(presentationStageTsx).not.toMatch(/object-cover/);
      expect(presentationStageTsx).not.toMatch(/import \{ Room/);
      expect(presentationStageTsx).not.toMatch(/RoomEvent/);
      expect(presentationStageTsx).not.toMatch(/\.on\(/);
      expect(presentationStageTsx).not.toMatch(/fullscreen|requestFullscreen|exitFullscreen/i);
      expect(presentationStageTsx).not.toMatch(/<audio/);
      expect(presentationStageTsx).not.toMatch(/MediaStream/);
      expect(presentationStageTsx).not.toMatch(/screenStream/);
      expect(presentationStageTsx).not.toMatch(/getDisplayMedia/);
    });
  });

  test.describe("Meet", () => {
    test("renders the focused presentation before the participant grid", () => {
      expect(meetLiveSessionTsx).toMatch(
        /<PresentationStage presentation=\{focusedPresentation\} \/>[\s\S]*?<VideoGrid/
      );
      expect(meetLiveSessionTsx).toMatch(/<VideoGrid/);
      expect(meetLiveSessionTsx).toMatch(/<MeetingControls/);
    });

    test("keeps remote and local screen-share hooks", () => {
      expect(meetLiveSessionTsx).toMatch(/useRemotePresentations\(presentationRoom\)/);
      expect(meetLiveSessionTsx).toMatch(/useScreenShare\(\{\s*room: presentationRoom,\s*\}\)/);
      expect(meetLiveSessionTsx).toMatch(/screenStream=\{screenStream\}/);
    });

    test("does not alter room lifecycle or add screen-share audio", () => {
      expect(meetLiveSessionTsx.match(/new Room\(/g) ?? []).toHaveLength(1);
      expect(meetLiveSessionTsx.match(/\.connect\(/g) ?? []).toHaveLength(1);
      expect(meetLiveSessionTsx).not.toMatch(/Track\.Source\.ScreenShareAudio|ScreenShareAudio/);
      expect(meetLiveSessionTsx).toMatch(/source: Track\.Source\.Camera/);
      expect(meetLiveSessionTsx).toMatch(/source: Track\.Source\.Microphone/);
      expect(meetLiveSessionTsx).toMatch(/setMicrophoneEnabled/);
    });
  });

  test.describe("Class", () => {
    test("renders the focused presentation before classroom participant UI", () => {
      expect(classLiveSessionTsx).toMatch(
        /<PresentationStage presentation=\{focusedPresentation\} \/>[\s\S]*?\{\/\* Classroom layout: whiteboard \+ filmstrip \+ sidebar \*\/\}/
      );
      expect(classLiveSessionTsx).toMatch(/<ParticipantFilmstrip/);
      expect(classLiveSessionTsx).toMatch(/<MeetingControls/);
      expect(classLiveSessionTsx).toMatch(/<ClassroomWhiteboard/);
    });

    test("keeps remote and local screen-share hooks", () => {
      expect(classLiveSessionTsx).toMatch(/useRemotePresentations\(presentationRoom\)/);
      expect(classLiveSessionTsx).toMatch(/useScreenShare\(\{\s*room: presentationRoom,\s*\}\)/);
      expect(classLiveSessionTsx).toMatch(/screenStream=\{screenStream\}/);
    });

    test("does not alter room lifecycle or add screen-share audio", () => {
      expect(classLiveSessionTsx.match(/new Room\(/g) ?? []).toHaveLength(1);
      expect(classLiveSessionTsx.match(/\.connect\(/g) ?? []).toHaveLength(1);
      expect(classLiveSessionTsx).not.toMatch(/Track\.Source\.ScreenShareAudio|ScreenShareAudio/);
      expect(classLiveSessionTsx).toMatch(/source: Track\.Source\.Camera/);
      expect(classLiveSessionTsx).toMatch(/source: Track\.Source\.Microphone/);
      expect(classLiveSessionTsx).toMatch(/role/);
      expect(classLiveSessionTsx).toMatch(/isLocalHost/);
    });
  });
});