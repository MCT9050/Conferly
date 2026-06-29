import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from './serverEnv';

const env = getServerEnv();
const serviceRoleKey =
  env.SUPABASE_SERVICE_ROLE_KEY ??
  (() => { throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in classroomAuth.ts'); })();
const supabase = createClient(env.SUPABASE_URL, serviceRoleKey);

export type ClassroomAccessRole = 'instructor' | 'ta' | 'student' | 'auditor' | 'spectator';

export type ClassroomAccessResult = {
  granted: boolean;
  accessRole: ClassroomAccessRole;
  classroomId: string;
  lessonId?: string;
  source: 'owner' | 'enrollment' | 'public' | null;
};

export async function verifyClassroomAccess(
  userId: string,
  slugOrId: string
): Promise<ClassroomAccessResult> {
  // 1. Find classroom by slug or ID
  const { data: classroom, error: findError } = await supabase
    .from('classrooms')
    .select('id, owner_id, status, enrollment_type, settings')
    .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .single();

  if (findError || !classroom) {
    return { granted: false, accessRole: 'spectator', classroomId: '', source: null };
  }

  // 2. Owner check
  if (classroom.owner_id === userId) {
    return {
      granted: true,
      accessRole: 'instructor',
      classroomId: classroom.id,
      source: 'owner',
    };
  }

  // 3. Enrollment check
  const { data: enrollment } = await supabase
    .from('classroom_enrollments')
    .select('role, enrollment_status')
    .eq('classroom_id', classroom.id)
    .eq('student_id', userId)
    .single();

  if (enrollment && enrollment.enrollment_status === 'active') {
    return {
      granted: true,
      accessRole: enrollment.role as ClassroomAccessRole,
      classroomId: classroom.id,
      source: 'enrollment',
    };
  }

  // 4. Public auditor fallback
  if (classroom.enrollment_type === 'open' && classroom.status === 'live') {
    return {
      granted: true,
      accessRole: 'auditor',
      classroomId: classroom.id,
      source: 'public',
    };
  }

  return {
    granted: false,
    accessRole: 'spectator',
    classroomId: classroom.id,
    source: null,
  };
}