import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readProjectFile(...segments: string[]) {
  return readFile(path.join(process.cwd(), ...segments), 'utf8');
}

test.describe('Meet shared live-room foundation contracts', () => {
  test('Meet uses the shared stage, gallery, and filmstrip foundation', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');

    expect(meetContent).toContain('SharedLiveRoomActivityProvider');
    expect(meetContent).toContain('LiveStage');
    expect(meetContent).toContain('ResponsiveParticipantGallery');
    expect(meetContent).toContain('PresentationFilmstrip');
    expect(meetContent).toContain('domain="meet"');
  });

  test('Meet shared activities stay Meet-safe and exclude whiteboard and audio-only sync', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');
    const sync = await readProjectFile('lib', 'liveRoomActivitySync.ts');

    expect(meetContent).toContain("(['gallery', 'focus', 'discussion'] as SharedLiveRoomActivity[])");
    expect(meetContent).not.toContain('whiteboard');
    expect(sync).toContain("const MEET_ACTIVITIES = new Set<SharedLiveRoomActivity>([");
    expect(sync).toContain("'screen-share'");
    expect(sync).toContain("'presentation'");
    expect(sync).not.toContain("SHARED_MEET_CONTROL_ROLES = new Set<SharedLiveRoomRole>(['host', 'co-host', 'presenter'])");
  });

  test('Meet keeps local-only audio-only and layout/density preferences unsynchronized', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');

    expect(meetContent).toContain("const [audioOnly, setAudioOnly] = useState(false);");
    expect(meetContent).toContain("const [layout, setLayout] = useState<PersonalLayout>('standard');");
    expect(meetContent).toContain("const [density, setDensity] = useState<ParticipantDensity>('standard');");
    expect(meetContent).toContain("layout={audioOnly ? 'audio-only' : layout}");
    expect(meetContent).not.toContain("setActivity('audio-only')");
  });

  test('Real screen share drives the Meet stage from local or remote LiveKit tracks', async () => {
    const meetSession = await readProjectFile('components', 'meet', 'MeetLiveSession.tsx');
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');

    expect(meetSession).toContain('const remoteScreenShareStreams = new Map<string, MediaStream>()');
    expect(meetSession).toContain('Track.Source.ScreenShare');
    expect(meetSession).toContain('screenShareStream,');
    expect(meetContent).toContain('const activeScreenShareParticipant = useMemo(');
    expect(meetContent).toContain("if (activeScreenShareParticipant?.screenShareStream) {");
    expect(meetContent).toContain('screenShareParticipant={activeScreenShareParticipant}');
  });

  test('Presentation state drives the Meet presentation layout', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');

    expect(meetContent).toContain("if (focusedPresentation) {");
    expect(meetContent).toContain("if (activity !== 'presentation') void setActivity('presentation');");
    expect(meetContent).toContain('presentationContent={focusedPresentation ? <PresentationStage presentation={focusedPresentation}');
  });

  test('Meet renders accessible hydration, empty, unavailable, rejection, and media status states', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');
    const provider = await readProjectFile('components', 'live', 'SharedLiveRoomActivityProvider.tsx');

    expect(provider).toContain('hydrated: boolean;');
    expect(meetContent).toContain('Restoring the shared Meet activity state.');
    expect(meetContent).toContain('No participants are visible in the shared Meet gallery yet.');
    expect(meetContent).toContain('No active screen share is currently available for the shared Meet stage.');
    expect(meetContent).toContain('No shared presentation is currently available for the Meet stage.');
    expect(meetContent).toContain('Ignored an invalid shared activity update:');
    expect(meetContent).toContain('Media issue:');
    expect(meetContent).toContain('Screen sharing issue:');
  });

  test('Meet uses server-derived authorization mapping only', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');
    const tokenRoute = await readProjectFile('app', 'api', 'lk-token', 'route.ts');
    const sync = await readProjectFile('lib', 'liveRoomActivitySync.ts');

    expect(meetContent).toContain("if (accessRole === 'owner') return 'host';");
    expect(meetContent).toContain("if (accessRole === 'presenter') return 'presenter';");
    expect(meetContent).toContain("if (accessRole === 'participant') return 'participant';");
    expect(tokenRoute).toContain("participantRoleForToken = mapMeetAccessRoleToSharedRole(access.role);");
    expect(sync).toContain("export const SHARED_MEET_CONTROL_ROLES = new Set<SharedLiveRoomRole>(['host', 'presenter']);");
    expect(sync).not.toContain("role === 'co-host'");
  });

  test('Meet contains no Classroom component import or Classroom terminology', async () => {
    const meetContent = await readProjectFile('components', 'meet', 'MeetSharedLiveRoomContent.tsx');
    const meetSession = await readProjectFile('components', 'meet', 'MeetLiveSession.tsx');

    expect(meetContent).not.toContain('Classroom');
    expect(meetContent).not.toContain('whiteboard');
    expect(meetSession).not.toContain('ClassLiveSession');
    expect(meetSession).not.toContain('ClassroomWhiteboard');
  });

  test('Recording, transcript, AI, notes, chat, slides, and invite/access controls remain wired', async () => {
    const meetSession = await readProjectFile('components', 'meet', 'MeetLiveSession.tsx');
    const controls = await readProjectFile('components', 'MeetingControls.tsx');

    expect(meetSession).toContain('toggleRecording={toggleRecording}');
    expect(meetSession).toContain('Transcript');
    expect(meetSession).toContain('AI Assistant');
    expect(meetSession).toContain('AI Pulse');
    expect(meetSession).toContain('Notes');
    expect(meetSession).toContain('Slides');
    expect(meetSession).toContain('roomId={roomId}');
    expect(meetSession).toContain('meetingId={meetingId}');
    expect(controls).toContain('Copy secure invite link');
  });
});