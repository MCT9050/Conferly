import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test.describe("useScreenShare source contracts", () => {
  let hookTs: string;

  test.beforeAll(async () => {
    hookTs = await readFile(
      path.resolve(process.cwd(), "hooks/useScreenShare.ts"),
      "utf-8"
    );
  });

  test("is a client module and uses LiveKit Room", () => {
    expect(hookTs).toMatch(/^["']use client["'];/);
    expect(hookTs).toMatch(/Room/);
    expect(hookTs).toMatch(/room: Room \| null/);
  });

  test("captures display video only", () => {
    expect(hookTs).toMatch(/getDisplayMedia/);
    expect(hookTs).toMatch(/video:\s*true/);
    expect(hookTs).toMatch(/audio:\s*false/);
    expect(hookTs).not.toMatch(/getUserMedia/);
    expect(hookTs).not.toMatch(/Microphone/);
    expect(hookTs).not.toMatch(/ScreenShareAudio/);
  });

  test("publishes with screen-share source and explicitly unpublishes the same track", () => {
    expect(hookTs).toMatch(/publishTrack\(localScreenTrack/);
    expect(hookTs).toMatch(/Track\.Source\.ScreenShare/);
    expect(hookTs).toMatch(/unpublishTrack\(currentTrack, false\)/);
    expect(hookTs).toMatch(/localScreenTrackRef/);
  });

  test("stops captured media tracks", () => {
    expect(hookTs).toMatch(/getTracks\(\)\.forEach/);
    expect(hookTs).toMatch(/track\.stop\(\)/);
  });

  test("handles native ended and removes listeners", () => {
    expect(hookTs).toMatch(/addEventListener\("ended", endedListener\)/);
    expect(hookTs).toMatch(/removeEventListener\("ended", endedListener\)/);
    expect(hookTs).toMatch(/cleanupCurrentShare/);
  });

  test("handles user cancellation silently", () => {
    expect(hookTs).toMatch(/AbortError/);
    expect(hookTs).toMatch(/NotAllowedError/);
    expect(hookTs).toMatch(/isPickerCancellation/);
  });

  test("has all required states and public operations", () => {
    for (const state of ["starting", "active", "stopping", "idle", "error"]) {
      expect(hookTs).toContain(`"${state}"`);
    }

    expect(hookTs).toMatch(/startScreenShare/);
    expect(hookTs).toMatch(/stopScreenShare/);
    expect(hookTs).toMatch(/toggleScreenShare/);
  });

  test("protects concurrency and stop-during-picker with generation cancellation", () => {
    expect(hookTs).toMatch(/captureGenerationRef/);
    expect(hookTs).toMatch(/cancelledCaptureGenerationsRef/);
    expect(hookTs).toMatch(/activeCaptureGenerationRef/);
    expect(hookTs).toMatch(/stoppingRef/);
  });

  test("does not create or connect a Room and has no production URLs", () => {
    expect(hookTs).not.toMatch(/new Room\(/);
    expect(hookTs).not.toMatch(/\.connect\(/);
    expect(hookTs).not.toMatch(/wss?:\/\//);
  });
});
