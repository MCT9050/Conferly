import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

type RuntimeCredentials = {
  email: string;
  password: string;
};

type RuntimeDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  ignoredNoise: string[];
};

type RuntimeActor = {
  context: BrowserContext;
  page: Page;
  diagnostics: RuntimeDiagnostics;
};

const MISSING = 'missing';

const inheritedNoisePatterns = [
  /favicon\.ico/i,
  /Failed to load resource: the server responded with a status of 404.*favicon/i,
];

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function credentials(prefix: 'PRESENTER' | 'VIEWER' | 'TEACHER' | 'LEARNER'): RuntimeCredentials | null {
  const email = env(`PLAYWRIGHT_${prefix}_EMAIL`) ?? env(`TEST_${prefix}_EMAIL`);
  const password = env(`PLAYWRIGHT_${prefix}_PASSWORD`) ?? env(`TEST_${prefix}_PASSWORD`);

  if (!email || !password) return null;
  return { email, password };
}

function missingCredentials(prefix: 'PRESENTER' | 'VIEWER' | 'TEACHER' | 'LEARNER') {
  return `missing PLAYWRIGHT_${prefix}_EMAIL/PLAYWRIGHT_${prefix}_PASSWORD or TEST_${prefix}_EMAIL/TEST_${prefix}_PASSWORD`;
}

function isInheritedNoise(message: string) {
  return inheritedNoisePatterns.some((pattern) => pattern.test(message));
}

function isScreenSharingRelated(message: string) {
  return /screen|share|presentation|getDisplayMedia|display media|livekit|track|publish|unpublish/i.test(message);
}

async function installMediaMocks(page: Page) {
  await page.addInitScript(() => {
    const win = window as typeof window & {
      __playwrightDisplayStreams?: MediaStream[];
      __stopPlaywrightDisplayCapture?: () => void;
    };

    win.__playwrightDisplayStreams = [];
    win.__stopPlaywrightDisplayCapture = () => {
      for (const stream of win.__playwrightDisplayStreams ?? []) {
        for (const track of stream.getTracks()) {
          track.stop();
          track.dispatchEvent(new Event('ended'));
        }
      }
    };

    const createCanvasStream = (label: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#0f172a';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#38bdf8';
        context.font = '48px sans-serif';
        context.fillText(label, 80, 140);
      }

      const stream = canvas.captureStream(10);
      return stream;
    };

    const createUserMediaStream = () => {
      const stream = createCanvasStream('Playwright camera');
      try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) {
          const audioContext = new AudioContextCtor();
          const oscillator = audioContext.createOscillator();
          const destination = audioContext.createMediaStreamDestination();
          oscillator.connect(destination);
          oscillator.start();
          const audioTrack = destination.stream.getAudioTracks()[0];
          if (audioTrack) stream.addTrack(audioTrack);
        }
      } catch {
        // Video-only user media is still sufficient for surfaces that tolerate missing audio.
      }
      return stream;
    };

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {},
      });
    }

    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => createUserMediaStream(),
    });

    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
      configurable: true,
      value: async () => {
        const stream = createCanvasStream('Playwright shared presentation');
        win.__playwrightDisplayStreams?.push(stream);
        return stream;
      },
    });
  });
}

async function stopMockedDisplayTrack(page: Page) {
  await page.evaluate(() => {
    const win = window as typeof window & { __stopPlaywrightDisplayCapture?: () => void };
    win.__stopPlaywrightDisplayCapture?.();
  });
}

function attachDiagnostics(page: Page, label: string): RuntimeDiagnostics {
  const diagnostics: RuntimeDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    ignoredNoise: [],
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = `[${label}] ${message.text()}`;
    if (isInheritedNoise(text)) diagnostics.ignoredNoise.push(text);
    else diagnostics.consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    const text = `[${label}] ${error.message}`;
    if (isInheritedNoise(text)) diagnostics.ignoredNoise.push(text);
    else diagnostics.pageErrors.push(text);
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown failure';
    const text = `[${label}] ${request.method()} ${request.url()} ${failure}`;
    if (isInheritedNoise(text)) diagnostics.ignoredNoise.push(text);
    else diagnostics.failedRequests.push(text);
  });

  return diagnostics;
}

async function createActor(browser: Browser, label: string): Promise<RuntimeActor> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await installMediaMocks(page);
  return { context, page, diagnostics: attachDiagnostics(page, label) };
}

async function signIn(page: Page, baseURL: string, creds: RuntimeCredentials) {
  await page.goto(`${baseURL}/auth`);
  await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"], input[name="email"]').first().fill(creds.email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(creds.password);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue")').first().click({ force: true });
  await page.waitForURL(/\/(dashboard|meet|class)/, { timeout: 30_000 });
}

async function createMeeting(page: Page, slug: string) {
  return page.evaluate(async (roomSlug) => {
    const response = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug: roomSlug }),
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    };
  }, slug);
}

async function openMeetRoom(page: Page, baseURL: string, roomSlug: string) {
  await page.goto(`${baseURL}/meet/rooms/${encodeURIComponent(roomSlug)}`);
  await expect(page.getByRole('button', { name: /start meeting|join meeting/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /start meeting|join meeting/i }).click();
  await expect(page.getByText(/Live meeting/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 45_000 });
}

async function clickPresent(page: Page) {
  await page.locator('button[title="Share screen"], button:has-text("Share Screen"), button:has-text("Stop Sharing")').first().click();
}

function participantUi(page: Page) {
  return page.getByText(/participant|Live meeting|Room:/i).first();
}

function localPresentationIndicator(page: Page) {
  return page.getByText(/You are presenting/i).first();
}

function remotePresentationStage(page: Page) {
  return page.getByLabel('Shared presentation');
}

async function expectNoScreenShareDiagnostics(actors: RuntimeActor[], testInfo: TestInfo) {
  const consoleErrors = actors.flatMap((actor) => actor.diagnostics.consoleErrors.filter(isScreenSharingRelated));
  const pageErrors = actors.flatMap((actor) => actor.diagnostics.pageErrors.filter(isScreenSharingRelated));
  const failedRequests = actors.flatMap((actor) => actor.diagnostics.failedRequests.filter(isScreenSharingRelated));
  const ignoredNoise = actors.flatMap((actor) => actor.diagnostics.ignoredNoise);

  await testInfo.attach('screen-sharing-runtime-diagnostics.json', {
    body: JSON.stringify({ consoleErrors, pageErrors, failedRequests, ignoredNoise }, null, 2),
    contentType: 'application/json',
  });

  expect(consoleErrors, 'screen-sharing-related console errors').toEqual([]);
  expect(pageErrors, 'screen-sharing-related page errors').toEqual([]);
  expect(failedRequests, 'screen-sharing-related failed requests').toEqual([]);
}

test.describe('screen sharing runtime browser validation', () => {
  test('Meet two-context screen sharing lifecycle', async ({ browser, baseURL }, testInfo) => {
    const presenterCreds = credentials('PRESENTER');
    const viewerCreds = credentials('VIEWER');
    const missing = [
      presenterCreds ? null : missingCredentials('PRESENTER'),
      viewerCreds ? null : missingCredentials('VIEWER'),
    ].filter(Boolean);

    test.skip(missing.length > 0, `Meet runtime fixture blocked: ${missing.join('; ')}`);

    const roomSlug = env('PLAYWRIGHT_MEET_ROOM_SLUG') ?? `playwright-screen-share-${Date.now()}`;
    const presenter = await createActor(browser, 'meet-presenter');
    const viewer = await createActor(browser, 'meet-viewer');
    const actors = [presenter, viewer];

    try {
      await signIn(presenter.page, baseURL!, presenterCreds!);
      await signIn(viewer.page, baseURL!, viewerCreds!);

      if (!env('PLAYWRIGHT_MEET_ROOM_SLUG')) {
        const created = await createMeeting(presenter.page, roomSlug);
        test.skip(!created.ok, `Meet runtime fixture blocked: meeting creation failed with status ${created.status}`);
      }

      await openMeetRoom(presenter.page, baseURL!, roomSlug);
      await openMeetRoom(viewer.page, baseURL!, roomSlug);

      await expect(participantUi(presenter.page)).toBeVisible();
      await expect(participantUi(viewer.page)).toBeVisible();

      await clickPresent(presenter.page);
      await expect(localPresentationIndicator(presenter.page)).toBeVisible({ timeout: 15_000 });
      await expect(remotePresentationStage(viewer.page)).toBeVisible({ timeout: 30_000 });
      await expect(remotePresentationStage(viewer.page).getByText(/presentation|@|participant/i).first()).toBeVisible();
      await expect(participantUi(viewer.page)).toBeVisible();

      await clickPresent(presenter.page);
      await expect(remotePresentationStage(viewer.page)).toBeHidden({ timeout: 30_000 });

      await clickPresent(presenter.page);
      await expect(remotePresentationStage(viewer.page)).toBeVisible({ timeout: 30_000 });
      await stopMockedDisplayTrack(presenter.page);
      await expect(remotePresentationStage(viewer.page)).toBeHidden({ timeout: 30_000 });
      await expect(participantUi(viewer.page)).toBeVisible();

      await expectNoScreenShareDiagnostics(actors, testInfo);
    } finally {
      await Promise.all(actors.map((actor) => actor.context.close()));
    }
  });

  test('Class two-context screen sharing lifecycle', async ({ browser, baseURL }, testInfo) => {
    const teacherCreds = credentials('TEACHER');
    const learnerCreds = credentials('LEARNER');
    const classroomSlug = env('PLAYWRIGHT_CLASSROOM_SLUG');
    const lessonId = env('PLAYWRIGHT_CLASS_LESSON_ID');
    const missing = [
      teacherCreds ? null : missingCredentials('TEACHER'),
      learnerCreds ? null : missingCredentials('LEARNER'),
      classroomSlug ? null : 'missing PLAYWRIGHT_CLASSROOM_SLUG',
      lessonId ? null : 'missing PLAYWRIGHT_CLASS_LESSON_ID',
    ].filter(Boolean);

    test.skip(missing.length > 0, `Class runtime fixture blocked: ${missing.join('; ')}`);

    const teacher = await createActor(browser, 'class-teacher');
    const learner = await createActor(browser, 'class-learner');
    const actors = [teacher, learner];
    const classUrl = `${baseURL}/class/classrooms/${encodeURIComponent(classroomSlug!)}/lessons/${encodeURIComponent(lessonId!)}/live`;

    try {
      await signIn(teacher.page, baseURL!, teacherCreds!);
      await signIn(learner.page, baseURL!, learnerCreds!);

      await teacher.page.goto(classUrl);
      await learner.page.goto(classUrl);

      await expect(teacher.page.getByText(/participant|You are presenting|Slides|Ask about the lesson/i).first()).toBeVisible({ timeout: 30_000 });
      await expect(learner.page.getByText(/participant|Slides|Ask about the lesson/i).first()).toBeVisible({ timeout: 30_000 });

      await clickPresent(teacher.page);
      await expect(localPresentationIndicator(teacher.page)).toBeVisible({ timeout: 15_000 });
      await expect(remotePresentationStage(learner.page)).toBeVisible({ timeout: 30_000 });
      await expect(remotePresentationStage(learner.page).getByText(/presentation|@|participant/i).first()).toBeVisible();
      await expect(learner.page.getByText(/participant|Slides|Ask about the lesson/i).first()).toBeVisible();

      await clickPresent(teacher.page);
      await expect(remotePresentationStage(learner.page)).toBeHidden({ timeout: 30_000 });

      await clickPresent(teacher.page);
      await expect(remotePresentationStage(learner.page)).toBeVisible({ timeout: 30_000 });
      await stopMockedDisplayTrack(teacher.page);
      await expect(remotePresentationStage(learner.page)).toBeHidden({ timeout: 30_000 });
      await expect(learner.page.getByText(/participant|Slides|Ask about the lesson/i).first()).toBeVisible();

      await expectNoScreenShareDiagnostics(actors, testInfo);
    } finally {
      await Promise.all(actors.map((actor) => actor.context.close()));
    }
  });
});

export { MISSING };