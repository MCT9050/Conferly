import type { ClassroomRole, ParticipantDensity, ViewportSize, ClassroomParticipant } from '@/types';

// ── Role classification ──────────────────────────────────────────────────────

export function isTeacherRole(role: ClassroomRole): boolean {
  return role === 'owner' || role === 'instructor' || role === 'ta';
}

export function isStudentRole(role: ClassroomRole): boolean {
  return role === 'student';
}

export function isAuditorRole(role: ClassroomRole): boolean {
  return role === 'auditor';
}

export function classifyRole(raw: unknown): ClassroomRole | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.toLowerCase().trim();
  if (['owner', 'instructor', 'ta', 'student', 'auditor'].includes(normalized)) {
    return normalized as ClassroomRole;
  }
  return null;
}

// ── Density selection ────────────────────────────────────────────────────────

export function selectDefaultDensity(
  participantCount: number,
  teacherCount: number,
  viewport: ViewportSize
): ParticipantDensity {
  const studentCount = participantCount - teacherCount;

  if (viewport === 'mobile') {
    return 'paginated';
  }

  if (studentCount <= 10) {
    return 'comfortable';
  }

  if (studentCount <= 20) {
    return 'standard';
  }

  return 'compact';
}

export function selectDefaultLayout(
  participantCount: number,
  viewport: ViewportSize
): 'standard' | 'paginated' | 'filmstrip' {
  if (viewport === 'mobile') {
    return 'paginated';
  }

  if (participantCount <= 15) {
    return 'standard';
  }

  return 'filmstrip';
}

// ── Viewport detection ───────────────────────────────────────────────────────

export function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  if (width < 768) {
    return 'mobile';
  }
  if (width < 1024) {
    return 'tablet';
  }
  return 'desktop';
}

// ── Participant ordering ─────────────────────────────────────────────────────

export function sortParticipants(
  participants: ClassroomParticipant[],
  localUserId?: string
): ClassroomParticipant[] {
  return [...participants].sort((a, b) => {
    // Local user first
    if (a.id === localUserId) return -1;
    if (b.id === localUserId) return 1;

    // Teachers before students
    const aIsTeacher = isTeacherRole(a.role);
    const bIsTeacher = isTeacherRole(b.role);
    if (aIsTeacher && !bIsTeacher) return -1;
    if (!aIsTeacher && bIsTeacher) return 1;

    // Within same role group, sort by name
    return a.name.localeCompare(b.name);
  });
}

export function partitionParticipants(
  participants: ClassroomParticipant[]
): {
  teachers: ClassroomParticipant[];
  students: ClassroomParticipant[];
  auditors: ClassroomParticipant[];
} {
  const teachers: ClassroomParticipant[] = [];
  const students: ClassroomParticipant[] = [];
  const auditors: ClassroomParticipant[] = [];

  for (const participant of participants) {
    if (isTeacherRole(participant.role)) {
      teachers.push(participant);
    } else if (isAuditorRole(participant.role)) {
      auditors.push(participant);
    } else {
      students.push(participant);
    }
  }

  return { teachers, students, auditors };
}

// ── LiveKit metadata parsing ─────────────────────────────────────────────────

export function parseClassroomRoleFromMetadata(metadata: string | undefined): ClassroomRole | null {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && 'classroomRole' in parsed) {
      return classifyRole(parsed.classroomRole);
    }
  } catch {
    // Not JSON, try direct string
  }

  return classifyRole(metadata);
}

export function createClassroomRoleMetadata(role: ClassroomRole): string {
  return JSON.stringify({ classroomRole: role });
}

// ── Screen share detection ───────────────────────────────────────────────────

export function findActiveScreenShare(
  participants: ClassroomParticipant[]
): ClassroomParticipant | null {
  return participants.find((p) => p.isScreenSharing && p.screenShareStream !== null) || null;
}

// ── Filmstrip camera-off fix ─────────────────────────────────────────────────

export function shouldRenderVideoTile(
  stream: MediaStream | null,
  isVideoOn: boolean,
  isAudioOnly: boolean
): boolean {
  // Require active video track and isVideoOn flag
  if (isAudioOnly) return false;
  if (!isVideoOn) return false;
  if (!stream) return false;

  const hasVideoTrack = stream.getVideoTracks().some((track) => track.readyState === 'live');
  return hasVideoTrack;
}