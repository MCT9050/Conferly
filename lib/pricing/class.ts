// lib/pricing/class.ts
// Class product line — for Conferly Class (class.conferly.site)
// Authoritative Class commercial contract (Phase 2):
//   Class 10  — R89/mo  — 10 student seats + up to 2 teachers
//   Class 20  — R120/mo — 20 student seats + up to 2 teachers
//   Class 30  — R140/mo — 30 student seats + up to 2 teachers
//   Custom    — Contact sales — >30 seats or >2 teachers

export const CLASS_PLANS = [
  {
    id: 'class_10',
    name: 'Class 10',
    description: 'For independent tutors and small classes',
    monthlyPrice: 89,
    annualPrice: 71,
    maxStudents: 10,
    maxTeachers: 2,
    features: [
      '10 student seats',
      'Up to 2 collaborating teachers',
      'Interactive whiteboard',
      'Lesson scheduling',
      'Student roster',
    ],
    cta: 'Get Class 10',
    popular: true,
  },
  {
    id: 'class_20',
    name: 'Class 20',
    description: 'For growing tutoring businesses',
    monthlyPrice: 120,
    annualPrice: 96,
    maxStudents: 20,
    maxTeachers: 2,
    features: [
      '20 student seats',
      'Up to 2 collaborating teachers',
      'Interactive whiteboard',
      'Lesson scheduling',
      'Student roster',
      'Recordings',
    ],
    cta: 'Get Class 20',
    popular: false,
  },
  {
    id: 'class_30',
    name: 'Class 30',
    description: 'For training businesses and schools',
    monthlyPrice: 140,
    annualPrice: 112,
    maxStudents: 30,
    maxTeachers: 2,
    features: [
      '30 student seats',
      'Up to 2 collaborating teachers',
      'Interactive whiteboard',
      'Lesson scheduling',
      'Student roster',
      'Recordings',
      'Assignments & grading',
    ],
    cta: 'Get Class 30',
    popular: false,
  },
  {
    id: 'class_custom',
    name: 'Custom Class',
    description: 'For institutions with larger or custom needs',
    monthlyPrice: null,
    annualPrice: null,
    maxStudents: null,
    maxTeachers: null,
    features: [
      'More than 30 student seats',
      'More than 2 teachers',
      'Contract-defined capacity',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
] as const;

export type ClassPlanId = (typeof CLASS_PLANS)[number]['id'];

/**
 * Resolve the student-seat limit for a standard Class plan.
 * Returns null for custom plans (contact sales).
 */
export function getClassStudentLimit(planId: string): number | null {
  const plan = CLASS_PLANS.find((p) => p.id === planId);
  if (!plan || plan.maxStudents === null) return null;
  return plan.maxStudents;
}

/**
 * Resolve the teacher limit for a standard Class plan.
 * Standard plans allow up to 2 teachers. Custom plans are contract-defined.
 */
export function getClassTeacherLimit(planId: string): number | null {
  const plan = CLASS_PLANS.find((p) => p.id === planId);
  if (!plan || plan.maxTeachers === null) return null;
  return plan.maxTeachers;
}

/**
 * Resolve the maximum live occupancy for a standard Class plan.
 * maximum_live_occupancy = maximum_students + maximum_teachers
 */
export function getClassLiveOccupancy(planId: string): number | null {
  const students = getClassStudentLimit(planId);
  const teachers = getClassTeacherLimit(planId);
  if (students === null || teachers === null) return null;
  return students + teachers;
}