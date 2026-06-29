// lib/pricing/class.ts
// Class product line — for Conferly Class (class.conferly.site)

export const CLASS_PLANS = [
  {
    id: 'class_free',
    name: 'Free',
    description: 'For tutors trying out virtual teaching',
    monthlyPrice: 0,
    annualPrice: 0,
    maxClassrooms: 1,
    maxStudents: 5,
    features: ['1 classroom', 'Basic whiteboard', 'Up to 5 students', 'Lesson scheduling'],
    cta: 'Start Teaching',
    popular: false,
  },
  {
    id: 'class_room',
    name: 'Classroom',
    description: 'For independent tutors and coaches',
    monthlyPrice: 89,
    annualPrice: 71,
    maxClassrooms: 5,
    maxStudents: 25,
    features: ['5 classrooms', 'Whiteboard + recordings', 'Student roster', 'Assignments'],
    cta: 'Get Classroom',
    popular: true,
  },
  {
    id: 'class_room_plus',
    name: 'Classroom Plus',
    description: 'For training businesses and schools',
    monthlyPrice: 220,
    annualPrice: 176,
    maxClassrooms: 0, // unlimited
    maxStudents: 100,
    features: ['Unlimited classrooms', 'Up to 100 students', 'Grading & submissions', 'Payment collection'],
    cta: 'Go Plus',
    popular: false,
  },
  {
    id: 'class_unlimited',
    name: 'Unlimited',
    description: 'For institutions with no limits',
    monthlyPrice: 389,
    annualPrice: 311,
    maxClassrooms: 0,
    maxStudents: 0,
    features: ['Unlimited everything', 'White-label branding', 'API access', 'Dedicated success manager'],
    cta: 'Contact Sales',
    popular: false,
  },
] as const;

export type ClassPlanId = (typeof CLASS_PLANS)[number]['id'];