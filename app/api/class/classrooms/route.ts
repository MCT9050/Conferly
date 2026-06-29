import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, description, subject, enrollment_type, price_cents } = await request.json();

  const supabase = createSupabaseServerClient({ request });
  
  // Generate slug from title
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      owner_id: session.userId,
      title,
      description,
      subject,
      enrollment_type: enrollment_type || 'open',
      price_cents: price_cents || 0,
      status: 'draft',
      slug,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServerClient({ request });
  const { data, error } = await supabase
    .from('classrooms')
    .select('*, classroom_enrollments(role, enrollment_status)')
    .or(`owner_id.eq.${session.userId},classroom_enrollments.student_id.eq.${session.userId}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}