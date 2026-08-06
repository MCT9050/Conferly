import { getSupabaseServerClient } from './supabaseServerClient';
import { isUuid } from './classValidation';

function getAdminSupabase() {
  return getSupabaseServerClient();
}

export type ClassroomAccessRole = 'instructor' | 'ta' | 'student' | 'auditor' | 'spectator';
export type TeachingClassRole = 'owner' | 'instructor' | 'ta';

export type ClassroomRecord = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string | null;
  subject: string | null;
  status: string;
  enrollment_type: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClassLessonRecord = {
  id: string;
  classroom_id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  livekit_room_id: string | null;
  order_index?: number | null;
};

export type ClassroomAccessResult = {
  granted: boolean;
  accessRole: ClassroomAccessRole;
  classroomId: string;
  classroom: ClassroomRecord | null;
  lessonId?: string;
  source: 'owner' | 'enrollment' | null;
};

export type ClassLessonAccessResult = ClassroomAccessResult & {
  lesson: ClassLessonRecord | null;
  liveKitRole: 'participant' | 'spectator';
};

export function isTeachingRole(role: string | null | undefined): role is TeachingClassRole {
  return role === 'owner' || role === 'instructor' || role === 'ta';
}

export async function resolveClassroom(reference: string): Promise<ClassroomRecord | null> {
  const normalized = reference.trim();
  if (!normalized) return null;

  const supabase = getAdminSupabase();

  const query = supabase
    .from('classrooms')
    .select('id, owner_id, slug, title, description, subject, status, enrollment_type, created_at, updated_at');

  const { data } = isUuid(normalized)
    ? await query.eq('id', normalized).maybeSingle()
    : await query.eq('slug', normalized).maybeSingle();

  return data as ClassroomRecord | null;
}

export async function verifyClassroomAccess(
  userId: string,
  slugOrId: string
): Promise<ClassroomAccessResult> {
  const supabase = getAdminSupabase();
  const classroom = await resolveClassroom(slugOrId);

  if (!classroom) {
    return {
      granted: false,
      accessRole: 'spectator',
      classroomId: '',
      classroom: null,
      source: null,
    };
  }

  if (classroom.owner_id === userId) {
    return {
      granted: true,
      accessRole: 'instructor',
      classroomId: classroom.id,
      classroom,
      source: 'owner',
    };
  }

  const { data: enrollment } = await supabase
    .from('classroom_enrollments')
    .select('role, enrollment_status')
    .eq('classroom_id', classroom.id)
    .eq('student_id', userId)
    .eq('enrollment_status', 'active')
    .maybeSingle();

  if (enrollment?.role) {
    return {
      granted: true,
      accessRole: enrollment.role as ClassroomAccessRole,
      classroomId: classroom.id,
      classroom,
      source: 'enrollment',
    };
  }

  return {
    granted: false,
    accessRole: 'spectator',
    classroomId: classroom.id,
    classroom,
    source: null,
  };
}

export async function verifyClassroomTeachingAccess(
  userId: string,
  classroomReference: string
): Promise<{ granted: boolean; classroom: ClassroomRecord | null; role: TeachingClassRole | null }> {
  const supabase = getAdminSupabase();
  const classroom = await resolveClassroom(classroomReference);
  if (!classroom) return { granted: false, classroom: null, role: null };
  if (classroom.owner_id === userId) return { granted: true, classroom, role: 'owner' };

  const { data: enrollment } = await supabase
    .from('classroom_enrollments')
    .select('role, enrollment_status')
    .eq('classroom_id', classroom.id)
    .eq('student_id', userId)
    .in('role', ['instructor', 'ta'])
    .eq('enrollment_status', 'active')
    .maybeSingle();

  if (enrollment?.role === 'instructor' || enrollment?.role === 'ta') {
    return { granted: true, classroom, role: enrollment.role };
  }

  return { granted: false, classroom, role: null };
}

export async function verifyClassLessonAccess(
  userId: string,
  classroomReference: string,
  lessonId: string
): Promise<ClassLessonAccessResult> {
  const supabase = getAdminSupabase();
  const classroom = await resolveClassroom(classroomReference);
  if (!classroom) {
    return { granted: false, accessRole: 'spectator', classroomId: '', classroom: null, lessonId, source: null, lesson: null, liveKitRole: 'spectator' };
  }

  const { data: lesson } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, title, status, scheduled_at, livekit_room_id, order_index')
    .eq('id', lessonId)
    .eq('classroom_id', classroom.id)
    .maybeSingle();

  if (!lesson) {
    return { granted: false, accessRole: 'spectator', classroomId: classroom.id, classroom, lessonId, source: null, lesson: null, liveKitRole: 'spectator' };
  }

  if (classroom.owner_id === userId) {
    return { granted: true, accessRole: 'instructor', classroomId: classroom.id, classroom, lessonId, source: 'owner', lesson: lesson as ClassLessonRecord, liveKitRole: 'participant' };
  }

  const { data: enrollment } = await supabase
    .from('classroom_enrollments')
    .select('role, enrollment_status')
    .eq('classroom_id', classroom.id)
    .eq('student_id', userId)
    .eq('enrollment_status', 'active')
    .maybeSingle();

  if (!enrollment?.role) {
    return { granted: false, accessRole: 'spectator', classroomId: classroom.id, classroom, lessonId, source: null, lesson: lesson as ClassLessonRecord, liveKitRole: 'spectator' };
  }

  const accessRole = enrollment.role as ClassroomAccessRole;
  const granted = accessRole === 'instructor' || accessRole === 'ta' || accessRole === 'student' || accessRole === 'auditor';

  return {
    granted,
    accessRole,
    classroomId: classroom.id,
    classroom,
    lessonId,
    source: 'enrollment',
    lesson: lesson as ClassLessonRecord,
    liveKitRole: accessRole === 'auditor' ? 'spectator' : 'participant',
  };
}
