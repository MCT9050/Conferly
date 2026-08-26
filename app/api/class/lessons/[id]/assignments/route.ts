import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSupabaseServerClient } from '@/lib/supabaseServerClient';
import { verifyClassroomTeachingAccess } from '@/lib/classroomAuth';
import { isUuid } from '@/lib/classValidation';

/**
 * GET /api/class/lessons/[id]/assignments
 *
 * List assignments for a lesson. Authorization:
 *   - Teaching roles (owner, instructor, ta) see all assignments.
 *   - Enrolled students in active status see all assignments.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: lessonId } = await params;
  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id, status')
    .eq('id', lessonId)
    .maybeSingle();

  if (lessonErr) {
    return NextResponse.json({ error: 'Unable to load lesson' }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  // Authorize against the parent classroom.
  const { verifyClassroomAccess } = await import('@/lib/classroomAuth');
  const access = await verifyClassroomAccess(session.userId, lesson.classroom_id);
  if (!access.granted) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('classroom_assignments')
    .select('id, lesson_id, title, instructions, due_at, max_score, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Unable to load assignments' }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

/**
 * POST /api/class/lessons/[id]/assignments
 *
 * Create an assignment on a lesson. Teaching role only.
 *
 * Body: { title: string, instructions?: string, due_at?: string (ISO), max_score?: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: lessonId } = await params;
  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: 'Invalid lesson id' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: lesson, error: lessonErr } = await supabase
    .from('classroom_lessons')
    .select('id, classroom_id')
    .eq('id', lessonId)
    .maybeSingle();

  if (lessonErr) {
    return NextResponse.json({ error: 'Unable to load lesson' }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
  }

  const access = await verifyClassroomTeachingAccess(session.userId, lesson.classroom_id);
  if (!access.classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }
  if (!access.granted) {
    return NextResponse.json({ error: 'Only teaching roles can create assignments' }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (title.length > 200) {
    return NextResponse.json({ error: 'Title is too long (max 200 characters)' }, { status: 400 });
  }

  const instructions =
    typeof payload.instructions === 'string' && payload.instructions.trim()
      ? payload.instructions.trim().slice(0, 5000)
      : null;

  let dueAt: string | null = null;
  if (typeof payload.due_at === 'string' && payload.due_at.trim()) {
    const parsed = new Date(payload.due_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'due_at is invalid' }, { status: 400 });
    }
    dueAt = parsed.toISOString();
  }

  let maxScore = 100;
  if (typeof payload.max_score === 'number' && Number.isInteger(payload.max_score)) {
    if (payload.max_score < 1 || payload.max_score > 10000) {
      return NextResponse.json({ error: 'max_score must be between 1 and 10000' }, { status: 400 });
    }
    maxScore = payload.max_score;
  }

  const { data, error } = await supabase
    .from('classroom_assignments')
    .insert({
      lesson_id: lessonId,
      title,
      instructions,
      due_at: dueAt,
      max_score: maxScore,
    })
    .select('id, lesson_id, title, instructions, due_at, max_score, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Unable to create assignment' }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
