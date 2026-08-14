// app/api/subscription-cap/route.ts
// API route to return the authenticated user's capacity for a specific product line.
// Product-scoped: pass ?productLine=class or ?productLine=meet to get the correct cap.
// Defaults to 'meet' for backward compatibility.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabaseServerClient';
import { getServerSession } from '../../../lib/auth';
import { getClassStudentLimit, getClassTeacherLimit } from '../../../lib/pricing/class';

type ProductLine = 'meet' | 'class';

function isProductLine(value: string): value is ProductLine {
  return value === 'meet' || value === 'class';
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const productLineParam = url.searchParams.get('productLine') ?? 'meet';
    const productLine: ProductLine = isProductLine(productLineParam) ? productLineParam : 'meet';

    const session = await getServerSession(request);

    if (!session?.userId) {
      // Unauthenticated users get the default trial cap for the requested product line
      if (productLine === 'class') {
        return NextResponse.json({ studentCap: 0, teacherCap: 0, plan: 'class_10', productLine });
      }
      return NextResponse.json({ participantCap: 2, plan: 'trial', productLine });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, participant_cap, status')
      .eq('user_id', session.userId)
      .eq('product_line', productLine)
      .maybeSingle();

    if (error || !data) {
      // No subscription record for this product line yet — default to trial
      if (productLine === 'class') {
        return NextResponse.json({ studentCap: 0, teacherCap: 0, plan: 'class_10', productLine });
      }
      return NextResponse.json({ participantCap: 2, plan: 'meet_free', productLine });
    }

    // If subscription is not active, fall back to trial caps for this product line
    if (data.status !== 'active') {
      if (productLine === 'class') {
        return NextResponse.json({ studentCap: 0, teacherCap: 0, plan: data.plan, productLine });
      }
      return NextResponse.json({ participantCap: 2, plan: data.plan, productLine });
    }

    // Class: resolve student and teacher limits from the plan
    if (productLine === 'class') {
      const planId = String(data.plan);
      const studentCap = getClassStudentLimit(planId);
      const teacherCap = getClassTeacherLimit(planId);

      if (studentCap === null || teacherCap === null) {
        // Custom Class plan — limits are contract-defined.
        // participant_cap holds the approved student limit (stored explicitly).
        return NextResponse.json({
          studentCap: data.participant_cap,
          teacherCap: teacherCap ?? 2,
          plan: planId,
          productLine,
          custom: true,
        });
      }

      return NextResponse.json({
        studentCap,
        teacherCap,
        plan: planId,
        productLine,
      });
    }

    // Meet: return the participant cap as before
    return NextResponse.json({
      participantCap: data.participant_cap,
      plan: data.plan,
      productLine,
    });
  } catch (error) {
    console.error('[SubscriptionCap] Error fetching cap:', error);
    // Fail safe — default to trial cap
    return NextResponse.json({ participantCap: 2, plan: 'trial' });
  }
}