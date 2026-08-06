export const CLASS_ENROLLMENT_TYPES = ['open', 'approval', 'invite'] as const;

export type ClassEnrollmentType = (typeof CLASS_ENROLLMENT_TYPES)[number];

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function normaliseOptionalText(
  value: unknown,
  maxLength: number,
  field: string
): ValidationResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: `${field} must be text.` };

  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) return { ok: false, error: `${field} is too long.` };

  return { ok: true, value: trimmed };
}

export function normaliseRequiredTitle(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, error: 'Title is required.' };

  const title = value.trim();
  if (!title) return { ok: false, error: 'Title is required.' };
  if (title.length > 120) {
    return { ok: false, error: 'Title must be 120 characters or fewer.' };
  }

  return { ok: true, value: title };
}

export function normaliseSubject(value: unknown): ValidationResult<string | null> {
  return normaliseOptionalText(value, 80, 'Subject');
}

export function normaliseDescription(value: unknown): ValidationResult<string | null> {
  return normaliseOptionalText(value, 1000, 'Description');
}

export function normaliseEnrollmentType(value: unknown): ValidationResult<ClassEnrollmentType> {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : 'open';
  if (CLASS_ENROLLMENT_TYPES.includes(requested as ClassEnrollmentType)) {
    return { ok: true, value: requested as ClassEnrollmentType };
  }

  return { ok: false, error: 'Enrollment type is invalid.' };
}

export function normalisePriceCents(value: unknown): ValidationResult<number> {
  if (value === undefined || value === null || value === '') return { ok: true, value: 0 };
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100_000_000
  ) {
    return { ok: false, error: 'Price must be a valid non-negative number.' };
  }

  return { ok: true, value };
}

export function createClassroomSlug(title: string, suffix?: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
    .replace(/-$/g, '');

  return [base || 'classroom', suffix].filter(Boolean).join('-');
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}