import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readProjectFile(...segments: string[]) {
  return readFile(path.join(process.cwd(), ...segments), 'utf8');
}

test.describe('class Phase 1 workflow contracts', () => {
  test('QuickStart routes Class users to dashboard creation flow without random classroom URLs', async () => {
    const quickStart = await readProjectFile('components', 'marketing', 'QuickStartButton.tsx');

    expect(quickStart).toContain("router.push('/class/dashboard?create=1')");
    expect(quickStart).toContain("encodeURIComponent('/class/dashboard?create=1')");
    expect(quickStart).toContain("if (product === 'class') {");
    expect(quickStart.indexOf("if (product === 'class') {")).toBeLessThan(
      quickStart.indexOf("router.push(`/${product}/classrooms/${segments.join('-')}`);")
    );
  });

  test('classroom creation UI uses the API, returned slug navigation, and duplicate-submit guards', async () => {
    const createButton = await readProjectFile('components', 'CreateClassroomButton.tsx');

    expect(createButton).toContain("fetch('/api/class/classrooms'");
    expect(createButton).toContain('if (pending) return;');
    expect(createButton).toContain('disabled={pending || !title.trim()}');
    expect(createButton).toContain('router.push(`/class/classrooms/${encodeURIComponent(result.slug)}`)');
    expect(createButton).not.toContain('/classrooms/${segments.join');
  });

  test('dashboard loads owned classrooms and supports async searchParams auto-open create flow', async () => {
    const dashboard = await readProjectFile('app', 'class', 'dashboard', 'page.tsx');

    expect(dashboard).toContain('searchParams: Promise<{ create?: string }>');
    expect(dashboard).toContain("redirect('/auth?product=class&redirect=%2Fclass%2Fdashboard')");
    expect(dashboard).toContain(".eq('owner_id', user.id)");
    expect(dashboard).toContain("<CreateClassroomButton autoOpen={create === '1'} />");
  });

  test('lesson management page exists and uses canonical slug-based navigation', async () => {
    const lessonsPage = await readProjectFile('app', 'class', 'classrooms', '[slug]', 'lessons', 'page.tsx');

    expect(lessonsPage).toContain('params: Promise<{ slug: string }>');
    expect(lessonsPage).toContain('const canonicalSlug = classroom.slug;');
    expect(lessonsPage).toContain('CreateLessonForm classroomId={classroom.id}');
    expect(lessonsPage).toContain('LaunchLessonButton lessonId={lesson.id}');
  });

  test('lesson creation endpoint awaits params, requires auth, and assigns the classroom server-side', async () => {
    const lessonRoute = await readProjectFile('app', 'api', 'class', 'classrooms', '[classroomId]', 'lessons', 'route.ts');

    expect(lessonRoute).toContain("{ params }: { params: Promise<{ classroomId: string }> }");
    expect(lessonRoute).toContain('getServerSession(request)');
    expect(lessonRoute).toContain("!session?.userId");
    expect(lessonRoute).toContain('verifyClassroomTeachingAccess(session.userId, classroomId)');
    expect(lessonRoute).toContain("insert({ classroom_id: access.classroom.id");
    expect(lessonRoute).not.toContain('payload.classroom_id');
    expect(lessonRoute).not.toContain('payload.livekit_room_id');
  });

  test('launch flow replaces raw form navigation with canonical slug joinUrl generation', async () => {
    const launchButton = await readProjectFile('components', 'class', 'LaunchLessonButton.tsx');
    const launchRoute = await readProjectFile('app', 'api', 'class', 'lessons', '[id]', 'launch', 'route.ts');

    expect(launchButton).toContain('if (pending) return;');
    expect(launchButton).toContain('router.push(result.joinUrl)');
    expect(launchRoute).toContain('verifyClassroomTeachingAccess(session.userId, lesson.classroom_id)');
    expect(launchRoute).toContain("if (lesson.status === 'cancelled')");
    expect(launchRoute).toContain('lesson.livekit_room_id || `class-${lesson.classroom_id}-${lessonId}`');
    expect(launchRoute).toContain('joinUrl: `/class/classrooms/${classroom.slug}/lessons/${lessonId}/live`');
  });

  test('students and auditors cannot manage lessons, and roster access is teaching-role restricted', async () => {
    const classroomPage = await readProjectFile('app', 'class', 'classrooms', '[slug]', 'page.tsx');
    const studentsPage = await readProjectFile('app', 'class', 'classrooms', '[slug]', 'students', 'page.tsx');

    expect(classroomPage).toContain("const canTeach = access.source === 'owner' || isTeachingRole(access.accessRole);");
    expect(classroomPage).toContain('{canTeach ? (');
    expect(studentsPage).toContain("if (!access.granted || !isTeachingRole(role)) redirect(`/class/classrooms/${classroom.slug}`);");
    expect(studentsPage).toContain('Only safe enrollment identifiers are shown in Phase 1.');
  });

  test('live class page and token route use exact lesson/classroom contracts with server-derived roles', async () => {
    const livePage = await readProjectFile('app', 'class', 'classrooms', '[slug]', 'lessons', '[lessonId]', 'live', 'page.tsx');
    const classSession = await readProjectFile('components', 'class', 'ClassLiveSession.tsx');
    const tokenRoute = await readProjectFile('app', 'api', 'lk-token', 'route.ts');

    expect(livePage).toContain('verifyClassLessonAccess(session.userId, slug, lessonId)');
    expect(livePage).toContain('classroomId={access.classroom.id}');
    expect(livePage).toContain('lessonId={access.lesson.id}');

    expect(classSession).toContain('body: JSON.stringify({ domain: "class", classroomId, lessonId })');
    expect(classSession).not.toContain('body: JSON.stringify({ roomId, role: "participant" })');

    expect(tokenRoute).toContain("if (domain === 'class' && (!classroomId || !lessonId))");
    expect(tokenRoute).toContain('payload.role !== undefined || payload.roomId !== undefined || payload.room !== undefined');
    expect(tokenRoute).toContain('verifyClassLessonAccess(session.userId, classroomId, lessonId)');
    expect(tokenRoute).toContain("if (!classAccess.lesson || classAccess.lesson.status !== 'live')");
    expect(tokenRoute).toContain('effectiveRoomId = classAccess.lesson.livekit_room_id');
    expect(tokenRoute).toContain('role = classAccess.liveKitRole');
  });

  test('meet token path remains present and compatible', async () => {
    const tokenRoute = await readProjectFile('app', 'api', 'lk-token', 'route.ts');

    expect(tokenRoute).toContain("const roomId = String(payload?.roomId ?? payload?.room ?? '').trim();");
    expect(tokenRoute).toContain("const requestedRole = String(payload?.role ?? 'participant').trim() as LiveKitRole;");
    expect(tokenRoute).toContain("if (domain !== 'class' && !roomId)");
    expect(tokenRoute).toContain("if (domain !== 'class' && !VALID_ROLES.has(requestedRole))");
    expect(tokenRoute).toContain("access = await verifyAccess('meet', session.userId, roomId)");
    expect(tokenRoute).toContain("role = access.role === 'spectator' ? 'spectator' : requestedRole;");
  });

  test('classroom authorization helper preserves active enrollment access while restricting teaching rights', async () => {
    const authHelper = await readProjectFile('lib', 'classroomAuth.ts');

    expect(authHelper).toContain(".eq('enrollment_status', 'active')");
    expect(authHelper).toContain("const granted = accessRole === 'instructor' || accessRole === 'ta' || accessRole === 'student' || accessRole === 'auditor';");
    expect(authHelper).toContain("liveKitRole: accessRole === 'auditor' ? 'spectator' : 'participant'");
    expect(authHelper).not.toContain("source: 'public'");
    expect(authHelper).not.toContain("enrollment_type === 'open' && classroom.status === 'live'");
  });

  test('existing accessible classroom pages point to real routes only', async () => {
    const classroomPage = await readProjectFile('app', 'class', 'classrooms', '[slug]', 'page.tsx');

    expect(classroomPage).toContain('href={`/class/classrooms/${canonicalSlug}/lessons`}');
    expect(classroomPage).toContain('href={`/class/classrooms/${canonicalSlug}/students`}');
    expect(classroomPage).not.toContain('/classrooms/${classroom.id}/students');
    expect(classroomPage).not.toContain('/classrooms/${classroom.id}/lessons');
  });
});