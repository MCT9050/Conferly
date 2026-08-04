import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("presentation component source contracts", () => {
  let presentationVideoTsx: string;
  let presenterLabelTsx: string;
  let presentationStageTsx: string;

  test.beforeAll(async () => {
    presentationVideoTsx = await readFile(
      path.resolve(process.cwd(), "components/presentation/PresentationVideo.tsx"),
      "utf-8"
    );
    presenterLabelTsx = await readFile(
      path.resolve(process.cwd(), "components/presentation/PresenterLabel.tsx"),
      "utf-8"
    );
    presentationStageTsx = await readFile(
      path.resolve(process.cwd(), "components/presentation/PresentationStage.tsx"),
      "utf-8"
    );
  });

  test.describe("PresentationVideo", () => {
    test("declares a client component and imports RemoteVideoTrack", () => {
      expect(presentationVideoTsx).toMatch(/^"use client";/);
      expect(presentationVideoTsx).toMatch(/RemoteVideoTrack/);
    });

    test("renders an autoplaying inline video element", () => {
      expect(presentationVideoTsx).toMatch(/<video/);
      expect(presentationVideoTsx).toMatch(/autoPlay/);
      expect(presentationVideoTsx).toMatch(/playsInline/);
      expect(presentationVideoTsx).toMatch(/aria-label/);
    });

    test("attaches and detaches the LiveKit track", () => {
      expect(presentationVideoTsx).toMatch(/track\.attach\(/);
      expect(presentationVideoTsx).toMatch(/track\.detach\(/);
    });

    test("uses object-contain styling", () => {
      expect(presentationVideoTsx).toMatch(/object-contain/);
    });

    test("does not include forbidden capture, audio, room, or production behavior", () => {
      expect(presentationVideoTsx).not.toMatch(/camera/i);
      expect(presentationVideoTsx).not.toMatch(/microphone/i);
      expect(presentationVideoTsx).not.toMatch(/getDisplayMedia/);
      expect(presentationVideoTsx).not.toMatch(/new Room\(/);
      expect(presentationVideoTsx).not.toMatch(/room\.connect/);
      expect(presentationVideoTsx).not.toMatch(/wss?:\/\//);
    });
  });

  test.describe("PresenterLabel", () => {
    test("supports local presenter wording", () => {
      expect(presenterLabelTsx).toMatch(/isLocal/);
      expect(presenterLabelTsx).toContain("You are presenting");
    });

    test("contains remote presenter wording", () => {
      expect(presenterLabelTsx).toMatch(/is presenting/);
    });

    test("contains a blank-name fallback", () => {
      expect(presenterLabelTsx).toMatch(/Participant/);
      expect(presenterLabelTsx).toMatch(/trim\(\)/);
    });
  });

  test.describe("PresentationStage", () => {
    test("imports RemotePresentation and accepts a nullable presentation", () => {
      expect(presentationStageTsx).toMatch(/RemotePresentation/);
      expect(presentationStageTsx).toMatch(/presentation: RemotePresentation \| null/);
    });

    test("returns nothing for a null presentation", () => {
      expect(presentationStageTsx).toMatch(/if \(!presentation\)/);
      expect(presentationStageTsx).toMatch(/return null/);
    });

    test("renders presentation video and presenter label", () => {
      expect(presentationStageTsx).toMatch(/<PresentationVideo/);
      expect(presentationStageTsx).toMatch(/<PresenterLabel/);
    });

    test("contains a polite loading state", () => {
      expect(presentationStageTsx).toContain("Starting presentation…");
      expect(presentationStageTsx).toMatch(/aria-live="polite"/);
    });

    test("does not manage room events or forbidden rendering/capture behavior", () => {
      expect(presentationStageTsx).not.toMatch(/RoomEvent/);
      expect(presentationStageTsx).not.toMatch(/<audio/);
      expect(presentationStageTsx).not.toMatch(/fullscreen/i);
      expect(presentationStageTsx).not.toMatch(/getDisplayMedia/);
      expect(presentationStageTsx).not.toMatch(/wss?:\/\//);
    });
  });
});