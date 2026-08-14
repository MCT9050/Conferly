import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Classroom shared live-room integration contracts', () => {
  const root = process.cwd();
  const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('production Classroom route passes server-authoritative classroom context', () => {
    const source = read('app/class/classrooms/[slug]/lessons/[lessonId]/live/page.tsx');
    expect(source).toContain('verifyClassLessonAccess');
    expect(source).toContain('classroomTitle={classroom.title}');
    expect(source).toContain('lessonTitle={lesson.title}');
    expect(source).toContain("access.source === 'owner'");
  });

  test('Classroom layout exposes accessible sync, permission, and error states', () => {
    const source = read('components/class/ClassroomLayout.tsx');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('data-classroom-sync-state');
    expect(source).toContain('data-classroom-permission-state');
    expect(source).toContain('data-classroom-sync-error');
    expect(source).toContain('Only the owner, instructor, or authorized TA');
  });

  test('Classroom preserves shared foundation, remote audio, real screen share, and whiteboard boundary', () => {
    const session = read('components/class/ClassroomSession.tsx');
    const layout = read('components/class/ClassroomLayout.tsx');
    expect(session).toContain('RemoteAudioRenderer');
    expect(session).toContain('setScreenShareEnabled(next)');
    expect(layout).toContain('LiveStage');
    expect(layout).toContain('ResponsiveParticipantGallery');
    expect(layout).toContain('PresentationFilmstrip');
    expect(layout).toContain("mode === 'whiteboard'");
  });

  test('personal layout remains local after shared activity changes', () => {
    const layout = read('components/class/ClassroomLayout.tsx');
    expect(layout).toContain("const [personalLayout, setPersonalLayout] = useState<PersonalLayout>('standard')");
    expect(layout).toContain('const handleLayoutChange = useCallback((newLayout: PersonalLayout) => {');
    expect(layout).toContain('setPersonalLayout(newLayout);');
    expect(layout).toContain('void setActivity((newMode === \'teacher-focus\' ? \'focus\' : newMode) as LiveRoomActivity);');
    expect(layout).not.toContain('setPersonalLayout(activity');
    expect(layout).not.toContain('setPersonalLayout(mode');
  });

  test('local audio-only preference remains local and is not promoted into shared activity state', () => {
    const preJoin = read('components/class/ClassroomPreJoin.tsx');
    const sync = read('lib/liveRoomActivitySync.ts');
    expect(preJoin).toContain('const [audioOnly, setAudioOnly] = useState(userRole === \'auditor\')');
    expect(preJoin).toContain('audioOnly: isAuditor || audioOnly');
    expect(sync).not.toContain("'audio-only'");
  });

  test('shared activity provider registers and unregisters matching LiveKit listeners', () => {
    const provider = read('components/live/SharedLiveRoomActivityProvider.tsx');
    expect(provider).toContain('room.on(RoomEvent.DataReceived, onData);');
    expect(provider).toContain('room.off(RoomEvent.DataReceived, onData);');
    expect(provider).toContain('room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);');
    expect(provider).toContain('room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);');
  });
});