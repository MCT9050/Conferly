import { test, expect } from '@playwright/test';
import {
  isTeacherRole,
  isStudentRole,
  isAuditorRole,
  classifyRole,
  selectDefaultDensity,
  selectDefaultLayout,
  sortParticipants,
  partitionParticipants,
  parseClassroomRoleFromMetadata,
  createClassroomRoleMetadata,
  shouldRenderVideoTile,
} from '@/lib/classroomSeating';
import type { ClassroomParticipant } from '@/types';

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
  });
});
