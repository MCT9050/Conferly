// lib/classEntitlements.ts
// Server-side Class capacity enforcement.
// Resolves teacher/student roles from server-side classroom ownership and
// membership data. A client-supplied role is NEVER authoritative.

import { getSupabaseServerClient } from './supabaseServerClient';
import { getClassStudentLimit, getClassTeacherLimit } from './pricing/class';

export type ClassCapacity = {
  studentLimit: number;
  teacherLimit: number;
  maxLiveOccupancy: number;
  plan: string;
  custom: boolean;
};

export type ClassRoleCounts = {
  studentCount: number;
  teacherCount: number;
};

export type CapacityEnforcementResult = {
  allowed: boolean;
  reason?: string;
  capacity?: ClassCapacity;
  counts?: ClassRoleCounts;
};

/**
 * Resolve the classroom owner's Class entitlement from the subscriptions table.
 * Returns null if no active Class subscription exists.
 */
export async function resolveClassEntitlement(
  userId: string
): Promise<ClassCapacity | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, participant_cap, status')
    .eq('user_id', userId)
    .eq('product_line', 'class')
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const planId = String(data.plan ?? 'class_10');

  // Standard plans: resolve limits from the authoritative pricing table.
  const standardStudentLimit = getClassStudentLimit(planId);
  const standardTeacherLimit = getClassTeacherLimit(planId);

  // Custom plans: participant_cap holds the approved student limit.
  // Teacher limit defaults to 2 unless the contract explicitly defines more.
  if (standardStudentLimit === null || standardTeacherLimit === null) {
    const customStudentLimit = data.participant_cap ?? 0;
    const customTeacherLimit = standardTeacherLimit ?? 2;

    return {
      studentLimit: customStudentLimit,
      teacherLimit: customTeacherLimit,
      maxLiveOccupancy: customStudentLimit + customTeacherLimit,
      plan: planId,
      custom: true,
    };
  }

  return {
    studentLimit: standardStudentLimit,
    teacherLimit: standardTeacherLimit,
    maxLiveOccupancy: standardStudentLimit + standardTeacherLimit,
    plan: planId,
    custom: false,
  };
}

/**
 * Count verified teacher and student roles for a classroom.
 * Teachers = owner + instructor + ta roles in classroom_enrollments.
 * Students = student + auditor roles in classroom_enrollments.
 *
 * The owner is always counted as a teacher (the first of the two included).
 */
export async function countClassroomRoles(
  classroomId: string,
  ownerId: string
): Promise<ClassRoleCounts> {
  const supabase = getSupabaseServerClient();

  const { data: enrollments, error } = await supabase
    .from('classroom_enrollments')
    .select('student_id, role, enrollment_status')
    .eq('classroom_id', classroomId)
    .eq('enrollment_status', 'active');

  if (error) {
    return { studentCount: 0, teacherCount: 1 };
  }

  let teacherCount = 1; // The owner is always the first teacher.
  let studentCount = 0;

  for (const enrollment of enrollments ?? []) {
    // The owner is already counted as the first teacher. If an owner row exists
    // in classroom_enrollments, do not count it again as either a teacher or a
    // student seat.
    if (enrollment.student_id === ownerId) {
      continue;
    }

    const role = enrollment.role;
    if (role === 'instructor' || role === 'ta') {
      teacherCount += 1;
    } else if (role === 'student' || role === 'auditor') {
      studentCount += 1;
    }
  }

  return { studentCount, teacherCount };
}

/**
 * Enforce Class capacity for a user attempting to join a live lesson.
 *
 * Called server-side from the lk-token route after class access is verified.
 * This resolves the classroom owner's entitlement and counts current verified
 * roles — NOT the requesting user's client-supplied role.
 */
export async function enforceClassCapacity(
  classroomId: string,
  ownerId: string,
  requestingRole: 'owner' | 'instructor' | 'ta' | 'student' | 'auditor'
): Promise<CapacityEnforcementResult> {
  // Resolve the classroom owner's Class subscription.
  const capacity = await resolveClassEntitlement(ownerId);

  // No active Class subscription → standard plans cannot be created/joined.
  // Free/legacy behavior is NOT supported for paid Class rooms in Phase 2.
  if (!capacity) {
    return {
      allowed: false,
      reason: 'No active Class subscription for this classroom owner.',
    };
  }

  // Count verified roles from server-side membership data.
  // The owner is always counted as a teacher (the first of the two included).
  // The requesting user is already counted in these numbers because access
  // was verified from the enrollments table before this function is called.
  const counts = await countClassroomRoles(classroomId, ownerId);
  const isTeacherRequest = requestingRole === 'owner' || requestingRole === 'instructor' || requestingRole === 'ta';
  const isStudentRequest = requestingRole === 'student' || requestingRole === 'auditor';

  // Reject an unapproved third teacher on standard plans.
  // counts.teacherCount includes the requester (their enrollment row exists),
  // so > means the allowance is already exceeded.
  if (isTeacherRequest && counts.teacherCount > capacity.teacherLimit) {
    return {
      allowed: false,
      reason: `Teacher limit reached (${capacity.teacherLimit}). An additional teacher requires an approved Custom Class arrangement.`,
      capacity,
      counts,
    };
  }

  // Reject the next student after the student-seat allowance is reached.
  // counts.studentCount includes the requester (their enrollment row exists),
  // so > means the allowance is already exceeded.
  if (isStudentRequest && counts.studentCount > capacity.studentLimit) {
    return {
      allowed: false,
      reason: `Student seat limit reached (${capacity.studentLimit}). Please contact sales at info@conferly.site for larger capacity.`,
      capacity,
      counts,
    };
  }

  return { allowed: true, capacity, counts };
}

type AtomicCapacityRpcResult = {
  allowed: boolean;
  reason?: string;
  capacity?: { teacher_limit: number; student_limit: number; plan: string };
  counts?: { teacher_count: number; student_count: number };
};

/**
 * Database-authoritative capacity check.
 *
 * Delegates the count + decision to the SECURITY DEFINER RPC
 * `enforce_classroom_capacity_atomic`, which acquires a row-level lock on the
 * classroom before reading enrollment counts. This is the concurrency-safe
 * path and should be preferred over the in-process `enforceClassCapacity`
 * helper for any hot join path (e.g. the lk-token route).
 *
 * The function returns the same shape as `enforceClassCapacity` so callers do
 * not need to branch on the path used.
 */
export async function enforceClassCapacityAtomic(
  classroomId: string,
  ownerId: string,
  requestingRole: 'owner' | 'instructor' | 'ta' | 'student' | 'auditor'
): Promise<CapacityEnforcementResult> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('enforce_classroom_capacity_atomic', {
    p_classroom_id: classroomId,
    p_owner_id: ownerId,
    p_requesting_role: requestingRole,
  });

  if (error) {
    return {
      allowed: false,
      reason: 'Capacity check failed; please try again.',
    };
  }

  const result = (data as unknown) as AtomicCapacityRpcResult | null;
  if (!result || typeof result.allowed !== 'boolean') {
    return {
      allowed: false,
      reason: 'Capacity check returned an unexpected response.',
    };
  }

  if (!result.allowed) {
    return {
      allowed: false,
      reason: result.reason ?? 'Class capacity limit reached',
    };
  }

  const cap = result.capacity;
  const counts = result.counts;
  if (!cap) {
    return { allowed: true };
  }

  return {
    allowed: true,
    capacity: {
      studentLimit: cap.student_limit,
      teacherLimit: cap.teacher_limit,
      maxLiveOccupancy: cap.student_limit + cap.teacher_limit,
      plan: cap.plan,
      custom: cap.plan === 'class_custom',
    },
    counts: counts
      ? { studentCount: counts.student_count, teacherCount: counts.teacher_count }
      : undefined,
  };
}

