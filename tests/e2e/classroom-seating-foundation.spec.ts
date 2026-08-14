import { test, expect } from '@playwright/test';
import {
  canPublishClassroomMedia,
  canUseClassroomTeacherControls,
  isTeacherRole,
  isStudentRole,
  isAuditorRole,
  classifyRole,
  classifyViewport,
  selectPageSize,
  paginateParticipants,
  partitionStageAndFilmstrip,
  selectActivityForMedia,
  stableParticipantIdentity,
  mapClassroomRoleToLiveRoomRole,
  selectDefaultDensity,
  selectDefaultLayout,
  sortParticipants,
  partitionParticipants,
  parseClassroomRoleFromMetadata,
  createClassroomRoleMetadata,
  shouldRenderVideoTile,
} from '@/lib/classroomSeating';
import type { LiveRoomParticipant } from '@/lib/liveRoomSeating';
import type { ClassroomParticipant } from '@/types';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Classroom Seating Foundation', () => {
  test.describe('Role Classification', () => {
    test('owner derivation from access.source', () => {
      // Owner is NOT an enrollment role - it comes from access.source === 'owner'
      expect(isTeacherRole('owner')).toBe(true);
      expect(classifyRole('owner')).toBe('owner');
    });

    test('instructor/TA/student/auditor mapping', () => {
      expect(isTeacherRole('instructor')).toBe(true);
      expect(isTeacherRole('ta')).toBe(true);
      expect(isStudentRole('student')).toBe(true);
      expect(isAuditorRole('auditor')).toBe(true);
    });

    test('malformed metadata safe fallback', () => {
      expect(parseClassroomRoleFromMetadata(undefined)).toBeNull();
      expect(parseClassroomRoleFromMetadata('invalid')).toBeNull();
      expect(parseClassroomRoleFromMetadata('not json')).toBeNull();

      // Valid JSON but missing classroomRole
      expect(parseClassroomRoleFromMetadata(JSON.stringify({ other: 'field' }))).toBeNull();
    });

    test('student never classified as teacher', () => {
      expect(isTeacherRole('student')).toBe(false);
      expect(isStudentRole('student')).toBe(true);
      expect(isAuditorRole('student')).toBe(false);
    });

    test('classroom adapter maps controls and neutral roles safely', () => {
      expect(canUseClassroomTeacherControls('owner')).toBe(true);
      expect(canUseClassroomTeacherControls('instructor')).toBe(true);
      expect(canUseClassroomTeacherControls('ta')).toBe(true);
      expect(canUseClassroomTeacherControls('student')).toBe(false);
      expect(canUseClassroomTeacherControls('auditor')).toBe(false);
      expect(canUseClassroomTeacherControls(null)).toBe(false);
      expect(canPublishClassroomMedia('student')).toBe(true);
      expect(canPublishClassroomMedia('auditor')).toBe(false);
      expect(canPublishClassroomMedia(null)).toBe(false);
      expect(mapClassroomRoleToLiveRoomRole('owner')).toBe('owner');
      expect(mapClassroomRoleToLiveRoomRole('ta')).toBe('moderator');
      expect(mapClassroomRoleToLiveRoomRole('auditor')).toBe('spectator');
    });

    test('owner plus one collaborator partition', () => {
      const participants: ClassroomParticipant[] = [
        {
          id: '1',
          name: 'Teacher Alice',
          avatar: 'TA',
          role: 'owner',
          isSpeaking: false,
          isVideoOn: true,
          isMuted: false,
          audioLevel: 0,
          stream: null,
          screenShareStream: null,
          isScreenSharing: false,
        },
        {
          id: '2',
          name: 'Student Bob',
          avatar: 'SB',
          role: 'student',
          isSpeaking: false,
          isVideoOn: false,
          isMuted: true,
          audioLevel: 0,
          stream: null,
          screenShareStream: null,
          isScreenSharing: false,
        },
      ];

      const { teachers, students, auditors } = partitionParticipants(participants);
      expect(teachers).toHaveLength(1);
      expect(teachers[0].role).toBe('owner');
      expect(students).toHaveLength(1);
      expect(auditors).toHaveLength(0);
    });
  });

  test.describe('Media Preferences', () => {
    test('camera-off avatar decision', () => {
      const stream = {
        getVideoTracks: () => [{ readyState: 'live' }],
      } as MediaStream;
      expect(shouldRenderVideoTile(stream, false, false)).toBe(false);
      expect(shouldRenderVideoTile(null, true, false)).toBe(false);
    });

    test('audio-only media preference', () => {
      const stream = {
        getVideoTracks: () => [{ readyState: 'live' }],
      } as MediaStream;
      expect(shouldRenderVideoTile(stream, true, true)).toBe(false);
    });
  });

  test.describe('Density and Layout', () => {
    test('viewport classification and page sizes', () => {
      expect(classifyViewport(375)).toBe('mobile');
      expect(classifyViewport(900)).toBe('tablet');
      expect(classifyViewport(1280)).toBe('desktop');
      expect(selectPageSize('mobile', 'paginated')).toBe(4);
      expect(selectPageSize('desktop', 'standard')).toBe(20);
      expect(selectPageSize('desktop', 'compact')).toBe(32);
    });

    test('pagination clamps pages', () => {
      expect(paginateParticipants([1, 2, 3, 4, 5], 0, 2)).toEqual({ pageItems: [1, 2], currentPage: 0, pageCount: 3 });
      expect(paginateParticipants([1, 2, 3, 4, 5], 9, 2)).toEqual({ pageItems: [5], currentPage: 2, pageCount: 3 });
    });

    test('automatic Class 10/20/30 density', () => {
      // Class 10: comfortable for up to 10 students
      expect(selectDefaultDensity(10, 0, 'desktop')).toBe('comfortable');

      // Class 20: standard for 11-20 students
      expect(selectDefaultDensity(15, 0, 'desktop')).toBe('standard');
      expect(selectDefaultDensity(20, 0, 'desktop')).toBe('standard');

      // Class 30: compact for >20 students
      expect(selectDefaultDensity(25, 0, 'desktop')).toBe('compact');
      expect(selectDefaultDensity(30, 0, 'desktop')).toBe('compact');
    });

    test('pagination boundaries', () => {
      // Mobile always uses paginated
      expect(selectDefaultDensity(5, 0, 'mobile')).toBe('paginated');
      expect(selectDefaultLayout(5, 'mobile')).toBe('paginated');

      // Desktop uses standard/filmstrip
      expect(selectDefaultLayout(10, 'desktop')).toBe('standard');
      expect(selectDefaultLayout(20, 'desktop')).toBe('filmstrip');
    });

    test('mobile layout selection', () => {
      expect(selectDefaultLayout(5, 'mobile')).toBe('paginated');
      expect(selectDefaultDensity(5, 0, 'mobile')).toBe('paginated');
    });
  });

  test.describe('Participant Ordering', () => {
    test('stable participant ordering', () => {
      const participants: ClassroomParticipant[] = [
        {
          id: '3',
          name: 'Charlie',
          avatar: 'C',
          role: 'student',
          isSpeaking: false,
          isVideoOn: false,
          isMuted: true,
          audioLevel: 0,
          stream: null,
          screenShareStream: null,
          isScreenSharing: false,
        },
        {
          id: '1',
          name: 'Alice',
          avatar: 'A',
          role: 'owner',
          isSpeaking: false,
          isVideoOn: true,
          isMuted: false,
          audioLevel: 0,
          stream: null,
          screenShareStream: null,
          isScreenSharing: false,
        },
        {
          id: '2',
          name: 'Bob',
          avatar: 'B',
          role: 'instructor',
          isSpeaking: false,
          isVideoOn: true,
          isMuted: false,
          audioLevel: 0,
          stream: null,
          screenShareStream: null,
          isScreenSharing: false,
        },
      ];

      const sorted = sortParticipants(participants, '1');
      expect(sorted[0].id).toBe('1'); // Local user first
      expect(sorted[1].id).toBe('2'); // Teacher (instructor)
      expect(sorted[2].id).toBe('3'); // Student
    });
  });

  test.describe('LiveKit Token Contract', () => {
    test('Meet token contract remains present', () => {
      // Verify the metadata creation function exists and works
      const metadata = createClassroomRoleMetadata('instructor');
      expect(metadata).toBe(JSON.stringify({ classroomRole: 'instructor' }));

      // Verify parsing works
      expect(parseClassroomRoleFromMetadata(metadata)).toBe('instructor');
    });

    test('stage and filmstrip partition uses active screen share first', () => {
      const participants = [
        liveParticipant('teacher', 'Teacher', 'moderator'),
        { ...liveParticipant('student', 'Student', 'participant'), screenShareStream: {} as MediaStream },
      ];
      const { stage, filmstrip } = partitionStageAndFilmstrip(participants, 'screen-share');
      expect(stage?.identity).toBe('student');
      expect(filmstrip.map((p) => p.identity)).toEqual(['teacher']);
      expect(stableParticipantIdentity(stage!)).toBe('student');
    });

    test('screen-share fallback returns gallery after share ends', () => {
      expect(selectActivityForMedia('gallery', true)).toBe('screen-share');
      expect(selectActivityForMedia('screen-share', false, 'gallery')).toBe('gallery');
      expect(selectActivityForMedia('screen-share', false, 'discussion')).toBe('discussion');
    });
  });

  test.describe('Phase 1 source contracts', () => {
    const root = process.cwd();
    const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

    test('production route still renders ClassroomSession', () => {
      expect(read('app/class/classrooms/[slug]/lessons/[lessonId]/live/page.tsx')).toContain('ClassroomSession');
    });

    test('ClassroomSession uses shared foundation, remote audio, microphone mute, and real screen-share API', () => {
      const source = read('components/class/ClassroomSession.tsx');
      expect(source).toContain('@/components/live/RemoteAudioRenderer');
      expect(source).toContain('collectRemoteMicrophonePublications(room)');
      expect(source).toContain('Track.Source.Microphone');
      expect(source).toContain('micPub?.isMuted ?? micPub?.muted ?? true');
      expect(source).toContain('setScreenShareEnabled(next)');
      expect(source).not.toContain('Screen sharing is not yet available');
      expect(source).not.toContain('LIVEKIT_TRACK_SOURCE');
    });

    test('ClassroomLayout uses shared stage/gallery/filmstrip and synchronized activity', () => {
      const source = read('components/class/ClassroomLayout.tsx');
      expect(source).toContain('@/components/live/LiveStage');
      expect(source).toContain('@/components/live/ResponsiveParticipantGallery');
      expect(source).toContain('@/components/live/PresentationFilmstrip');
      expect(source).toContain("useState<ClassroomMode>('gallery')");
      expect(source).toContain('useSharedLiveRoomActivity');
      expect(source).toContain('selectActivityForMedia');
    });

    test('shared components contain no Classroom whiteboard import and isolate synchronization transport', () => {
      for (const file of fs.readdirSync(path.join(root, 'components/live'))) {
        const source = read(`components/live/${file}`);
        expect(source).not.toContain('ClassroomWhiteboard');
        if (file !== 'SharedLiveRoomActivityProvider.tsx') {
          expect(source).not.toContain('DataPacket');
          expect(source).not.toContain('publishData');
        }
      }
    });

    test('Meet source remains unchanged in Phase 1 and is not whiteboard-coupled', () => {
      const meetSource = read('components/meet/MeetLiveSession.tsx');
      expect(meetSource).toContain('@/components/meeting/RemoteAudioRenderer');
      expect(meetSource).not.toContain('ClassroomWhiteboard');
    });

    test('monitoring keeps dd-trace behind the Node.js server boundary', () => {
      const clientSafeMonitoring = read('lib/monitoring.ts');
      const serverMonitoring = read('lib/monitoring.server.ts');
      const instrumentation = read('instrumentation.ts');

      expect(clientSafeMonitoring).not.toContain('dd-trace');
      expect(serverMonitoring).toContain("import 'server-only'");
      expect(instrumentation).toContain("process.env.NEXT_RUNTIME === 'nodejs'");
      expect(instrumentation).toContain("import('./lib/monitoring.server')");
    });

    test('protocol document describes Phase 2 synchronization', () => {
      const doc = read('docs/shared-live-room-activity-protocol.md');
      expect(doc).toContain('Phase 2 implements a versioned LiveKit synchronization protocol');
      expect(doc).toContain('Late join hydration');
      expect(doc).toContain('Client packet roles are never trusted by themselves');
    });
  });
});

function liveParticipant(identity: string, name: string, role: LiveRoomParticipant['role']): LiveRoomParticipant {
  return {
    id: identity,
    identity,
    name,
    role,
    cameraStream: null,
    screenShareStream: null,
    isLocal: false,
    isSpeaking: false,
  };
}
