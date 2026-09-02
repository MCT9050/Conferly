// lib/onboarding.ts
// Shared onboarding intent types and validation.
//
// Onboarding intent describes what the user initially wants to do.
// It does NOT describe what the user is globally allowed to do.
//
// These values must NEVER be read by authorization helpers such as:
//   verifyAccess, verifyRoomAccess, verifyClassroomAccess,
//   verifyClassroomTeachingAccess, verifyClassLessonAccess,
//   or any RLS policy, entitlement function, or LiveKit token path.

export type MeetIntent = 'host' | 'attend';
export type ClassIntent = 'teacher' | 'student';

export interface OnboardingState {
  meetIntent: MeetIntent | null;
  classIntent: ClassIntent | null;
  onboardingCompletedAt: string | null;
}

export interface OnboardingUpdatePayload {
  meetIntent?: MeetIntent | null;
  classIntent?: ClassIntent | null;
}

const VALID_MEET_INTENTS: Set<string | null> = new Set(['host', 'attend', null]);
const VALID_CLASS_INTENTS: Set<string | null> = new Set(['teacher', 'student', null]);

export function isValidMeetIntent(value: unknown): value is MeetIntent | null {
  return value === null || VALID_MEET_INTENTS.has(value as string);
}

export function isValidClassIntent(value: unknown): value is ClassIntent | null {
  return value === null || VALID_CLASS_INTENTS.has(value as string);
}

export function validateOnboardingPayload(payload: unknown): {
  valid: false;
  error: string;
} | {
  valid: true;
  data: OnboardingUpdatePayload;
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const obj = payload as Record<string, unknown>;
  const result: OnboardingUpdatePayload = {};

  if ('meetIntent' in obj) {
    if (!isValidMeetIntent(obj.meetIntent)) {
      return { valid: false, error: "meetIntent must be 'host', 'attend', or null" };
    }
    result.meetIntent = obj.meetIntent as MeetIntent | null;
  }

  if ('classIntent' in obj) {
    if (!isValidClassIntent(obj.classIntent)) {
      return { valid: false, error: "classIntent must be 'teacher', 'student', or null" };
    }
    result.classIntent = obj.classIntent as ClassIntent | null;
  }

  return { valid: true, data: result };
}
