import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readProjectFile(...segments: string[]) {
  return readFile(path.join(process.cwd(), ...segments), 'utf8');
}

test.describe('Phase 2 — Product-Scoped Monetization and Entitlement Contract', () => {
  test('pricing and contact-sales contracts are represented in source', async () => {
    const pricing = await readProjectFile('app', '(marketing)', 'class', 'pricing', 'page.tsx');
    const classPricing = await readProjectFile('lib', 'pricing', 'class.ts');
    const checkoutActions = await readProjectFile('app', 'actions', 'checkout-actions.ts');

    expect(pricing).toContain('Class 10');
    expect(pricing).toContain('R89');
    expect(pricing).toContain('Class 20');
    expect(pricing).toContain('Class 30');
    expect(pricing).toContain('info@conferly.site');
    expect(classPricing).toContain("id: 'class_10'");
    expect(classPricing).toContain('maxStudents: 10');
    expect(classPricing).toContain('maxTeachers: 2');
    expect(classPricing).toContain("id: 'class_20'");
    expect(classPricing).toContain('monthlyPrice: 120');
    expect(classPricing).toContain('maxStudents: 20');
    expect(classPricing).toContain("id: 'class_30'");
    expect(classPricing).toContain('monthlyPrice: 140');
    expect(classPricing).toContain('maxStudents: 30');
    expect(checkoutActions).toContain("planId === 'class_custom'");
    expect(checkoutActions).toContain("planId === 'meet_enterprise'");
    expect(checkoutActions).not.toContain("createPlanCheckoutInternal('class_custom')");
  });

  test('public checkout fails closed for unverified legacy fallback paths', async () => {
    const checkoutActions = await readProjectFile('app', 'actions', 'checkout-actions.ts');
    const lemon = await readProjectFile('lib', 'lemon-squeezy.ts');

    expect(checkoutActions).toContain("return createPlanCheckoutInternal('class_10')");
    expect(checkoutActions).toContain("return createPlanCheckoutInternal('class_20')");
    expect(checkoutActions).toContain("return createPlanCheckoutInternal('class_30')");
    expect(checkoutActions).toContain('Classroom+ is a legacy plan');
    expect(lemon).toContain('Legacy fallback variant IDs are not accepted for product-scoped checkout');
    expect(lemon).not.toContain('process.env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID');
  });

  test('forward migration uses expand/deploy/contract safety and secures webhook ledger', async () => {
    const migration = await readProjectFile('supabase', 'migrations', '20260806185601_phase2_product_scope_expansion_contract.sql');

    expect(migration).not.toContain('DROP CONSTRAINT IF EXISTS subscriptions_user_id_key');
    expect(migration).toContain('add column if not exists product_line text');
    expect(migration).toContain('idx_subscriptions_user_product_line_unique');
    expect(migration).toContain('public.subscriptions (user_id, product_line)');
    expect(migration).toContain('Ambiguous subscriptions.product_line backfill');
    expect(migration).toContain('alter table public.subscription_webhook_events enable row level security');
    expect(migration).toContain('revoke all on table public.subscription_webhook_events from anon, authenticated');
    expect(migration).toContain('grant execute on function public.process_lemon_squeezy_subscription_webhook');
    expect(migration).toContain('to service_role');
  });

  test('webhook processing is atomic, idempotent, product-scoped, and order-aware', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');
    const migration = await readProjectFile('supabase', 'migrations', '20260806185601_phase2_product_scope_expansion_contract.sql');

    expect(webhook).toContain("'process_lemon_squeezy_subscription_webhook'");
    expect(webhook).toContain('p_webhook_id: webhookId');
    expect(webhook).toContain('p_product_line: planData.productLine');
    expect(webhook).toContain('p_external_event_at: externalEventAt');
    expect(webhook).not.toContain("onConflict: 'user_id'");
    expect(webhook).not.toContain(".from('subscription_webhook_events').insert");
    expect(migration).toContain('on conflict (webhook_id) do nothing');
    expect(migration).toContain("return jsonb_build_object('processed', false, 'duplicate', true)");
    expect(migration).toContain('p_external_event_at < existing_last_event_at');
    expect(migration).toContain('on conflict (user_id, product_line) do update');
  });

  test('unknown, enterprise, and unverified Lemon Squeezy mappings fail closed', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');

    expect(webhook).toContain('Unknown Lemon Squeezy product or variant; refusing entitlement grant');
    expect(webhook).toContain('Legacy classroom_plus webhook mapping is UNVERIFIED; refusing to grant entitlement');
    expect(webhook).toContain('Enterprise is contact-sales only; refusing automatic entitlement grant');
    expect(webhook).toContain('Webhook missing provider ordering timestamp');
  });

  test('Class token and capacity enforcement are server-authoritative and owner-safe', async () => {
    const lkToken = await readProjectFile('app', 'api', 'lk-token', 'route.ts');
    const entitlements = await readProjectFile('lib', 'classEntitlements.ts');
    const migration = await readProjectFile('supabase', 'migrations', '20260827000000_phase2_class_concurrency_atomic.sql');

    expect(lkToken).toContain("domain === 'class'");
    expect(lkToken).toContain('payload.role !== undefined');
    expect(lkToken).toContain('payload.roomId !== undefined');
    expect(lkToken).toContain('verifyClassLessonAccess(session.userId, classroomId, lessonId)');
    // Phase 2 uses the concurrency-safe atomic enforcement path.
    expect(lkToken).toContain('enforceClassCapacityAtomic(');
    expect(lkToken).toContain("verifyAccess('meet', session.userId, roomId)");
    expect(entitlements).toContain(".select('student_id, role, enrollment_status')");
    expect(entitlements).toContain('enrollment.student_id === ownerId');
    expect(entitlements).toContain('teacherCount = 1');
    expect(entitlements).toContain('counts.teacherCount > capacity.teacherLimit');
    expect(entitlements).toContain('counts.studentCount > capacity.studentLimit');

    // The atomic RPC remains the intended concurrency-safe backend: it locks the
    // classroom row (FOR UPDATE), resolves owner/teacher vs student semantics,
    // handles teacher caps / student plan limits / custom participant caps /
    // requester inclusion / no-subscription, and refuses when exceeded.
    expect(migration).toContain('enforce_classroom_capacity_atomic(');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('WHEN \'class_10\' THEN 10');
    expect(migration).toContain('v_teacher_limit := 2');
    expect(migration).toContain('ELSE');
    expect(migration).toContain('v_participant_cap');
    expect(migration).toContain('No active Class subscription for this classroom owner.');
  });
});