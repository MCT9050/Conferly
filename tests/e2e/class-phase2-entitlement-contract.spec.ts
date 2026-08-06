import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readProjectFile(...segments: string[]) {
  return readFile(path.join(process.cwd(), ...segments), 'utf8');
}

test.describe('Phase 2 — Product-Scoped Monetization and Entitlement Contract', () => {

  // ── Pricing contract ────────────────────────────────────────────────────

  test('class pricing page shows Class 10 at R89, Class 20 at R120, Class 30 at R140', async () => {
    const pricing = await readProjectFile('app', 'class', 'pricing', 'page.tsx');

    // Class 10 at R89
    expect(pricing).toContain('Class 10');
    expect(pricing).toContain('R89');
    expect(pricing).toContain('10 student seats');

    // Class 20 at R120
    expect(pricing).toContain('Class 20');
    expect(pricing).toContain('R120');
    expect(pricing).toContain('20 student seats');

    // Class 30 at R140
    expect(pricing).toContain('Class 30');
    expect(pricing).toContain('R140');
    expect(pricing).toContain('30 student seats');

    // Custom Class — contact sales
    expect(pricing).toContain('Custom Class');
    expect(pricing).toContain('Contact Sales');
    expect(pricing).toContain('info@conferly.site');
  });

  test('class pricing constants match authoritative contract: 10, 20, 30 student seats, up to 2 teachers', async () => {
    const classPricing = await readProjectFile('lib', 'pricing', 'class.ts');

    expect(classPricing).toContain("id: 'class_10'");
    expect(classPricing).toContain('maxStudents: 10');
    expect(classPricing).toContain('maxTeachers: 2');

    expect(classPricing).toContain("id: 'class_20'");
    expect(classPricing).toContain('maxStudents: 20');
    expect(classPricing).toContain('maxTeachers: 2');

    expect(classPricing).toContain("id: 'class_30'");
    expect(classPricing).toContain('maxStudents: 30');
    expect(classPricing).toContain('maxTeachers: 2');

    expect(classPricing).toContain("id: 'class_custom'");
    expect(classPricing).toContain('maxStudents: null');
    expect(classPricing).toContain('maxTeachers: null');
  });

  test('class landing page displays Phase 2 pricing with R89/R120/R140', async () => {
    const landing = await readProjectFile('app', 'class', 'page.tsx');

    expect(landing).toContain('Class 10');
    expect(landing).toContain('R89');
    expect(landing).toContain('Class 20');
    expect(landing).toContain('R120');
    expect(landing).toContain('Class 30');
    expect(landing).toContain('R140');
    expect(landing).toContain('student seats');
    expect(landing).toContain('Up to 2 teachers');
  });

  test('every paid Class CTA references a product-scoped checkout action', async () => {
    const checkoutActions = await readProjectFile('app', 'actions', 'checkout-actions.ts');

    expect(checkoutActions).toContain('createClass10Checkout');
    expect(checkoutActions).toContain('createClass20Checkout');
    expect(checkoutActions).toContain('createClass30Checkout');
    expect(checkoutActions).toContain("return createPlanCheckoutInternal('class_10')");
    expect(checkoutActions).toContain("return createPlanCheckoutInternal('class_20')");
    expect(checkoutActions).toContain("return createPlanCheckoutInternal('class_30')");
  });

  // ── Product-scoped checkout and contact sales ───────────────────────────

  test('Custom Class uses contact-sales action, not a public unlimited checkout', async () => {
    const checkoutActions = await readProjectFile('app', 'actions', 'checkout-actions.ts');

    expect(checkoutActions).toContain("planId === 'class_custom'");
    expect(checkoutActions).toContain('info@conferly.site');
    expect(checkoutActions).not.toContain("createPlanCheckoutInternal('class_custom')");
  });

  test('Meet Enterprise uses contact-sales action', async () => {
    const checkoutActions = await readProjectFile('app', 'actions', 'checkout-actions.ts');

    expect(checkoutActions).toContain("planId === 'meet_enterprise'");
    expect(checkoutActions).toContain('info@conferly.site');
  });

  // ── Product-scoped subscriptions ────────────────────────────────────────

  test('webhook upsert uses product-scoped conflict target', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');

    expect(webhook).toContain("onConflict: 'user_id,product_line'");
    expect(webhook).not.toContain("onConflict: 'user_id'");
  });

  test('webhook maps class_10/class_20/class_30 to correct student limits', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');

    expect(webhook).toContain("case 'class_10':");
    expect(webhook).toContain('participantCap: 10');

    expect(webhook).toContain("case 'class_20':");
    expect(webhook).toContain('participantCap: 20');

    expect(webhook).toContain("case 'class_30':");
    expect(webhook).toContain('participantCap: 30');
  });

  test('subscription-cap API is product-scoped with ?productLine parameter', async () => {
    const capApi = await readProjectFile('app', 'api', 'subscription-cap', 'route.ts');

    expect(capApi).toContain("productLineParam = url.searchParams.get('productLine')");
    expect(capApi).toContain(".eq('product_line', productLine)");
    expect(capApi).toContain('studentCap');
    expect(capApi).toContain('teacherCap');
  });

  test('migration creates (user_id, product_line) uniqueness constraint', async () => {
    const migration = await readProjectFile('supabase', 'migrations', '20260806000001_product_scoped_entitlements.sql');

    expect(migration).toContain('DROP CONSTRAINT IF EXISTS subscriptions_user_id_key');
    expect(migration).toContain('idx_subscriptions_user_product');
    expect(migration).toContain('subscriptions (user_id, product_line)');
  });

  test('migration adds webhook idempotency table', async () => {
    const migration = await readProjectFile('supabase', 'migrations', '20260806000001_product_scoped_entitlements.sql');

    expect(migration).toContain('subscription_webhook_events');
    expect(migration).toContain('webhook_id text NOT NULL UNIQUE');
  });

  test('webhook handler includes idempotency guard', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');

    expect(webhook).toContain('Idempotency guard');
    expect(webhook).toContain('.from(\'subscription_webhook_events\')');
    expect(webhook).toContain('.eq(\'webhook_id\', webhookId)');
  });

  test('webhook handles expiry, pause, resume, and payment_failed events', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');

    expect(webhook).toContain("eventName === 'subscription_expired'");
    expect(webhook).toContain("eventName === 'subscription_paused'");
    expect(webhook).toContain("eventName === 'subscription_resumed'");
    expect(webhook).toContain("eventName === 'subscription_payment_failed'");
  });

  // ── Server-side capacity enforcement ────────────────────────────────────

  test('lk-token route enforces class capacity for Class domain', async () => {
    const lkToken = await readProjectFile('app', 'api', 'lk-token', 'route.ts');

    expect(lkToken).toContain("import { enforceClassCapacity } from '@/lib/classEntitlements'");
    expect(lkToken).toContain('enforceClassCapacity(');
    expect(lkToken).toContain('capacity.allowed');
  });

  test('classEntitlements library resolves teacher/student counts from server-side data', async () => {
    const entitlements = await readProjectFile('lib', 'classEntitlements.ts');

    expect(entitlements).toContain('resolveClassEntitlement');
    expect(entitlements).toContain('countClassroomRoles');
    expect(entitlements).toContain('enforceClassCapacity');
    expect(entitlements).toContain('.eq(\'product_line\', \'class\')');
    expect(entitlements).toContain('teacherCount');
    expect(entitlements).toContain('studentCount');
  });

  test('classEntitlements enforces teacher limit (max 2) and student seat limits', async () => {
    const entitlements = await readProjectFile('lib', 'classEntitlements.ts');

    expect(entitlements).toContain('counts.teacherCount > capacity.teacherLimit');
    expect(entitlements).toContain('counts.studentCount > capacity.studentLimit');
    expect(entitlements).toContain('Teacher limit reached');
    expect(entitlements).toContain('Student seat limit reached');
    expect(entitlements).toContain('info@conferly.site');
  });

  test('classEntitlements resolves standard plans from pricing table', async () => {
    const entitlements = await readProjectFile('lib', 'classEntitlements.ts');

    expect(entitlements).toContain("getClassStudentLimit(planId)");
    expect(entitlements).toContain("getClassTeacherLimit(planId)");
  });

  test('classEntitlements handles custom plans with explicit capacity', async () => {
    const entitlements = await readProjectFile('lib', 'classEntitlements.ts');

    expect(entitlements).toContain('customStudentLimit = data.participant_cap ?? 0');
    expect(entitlements).toContain('custom: true');
  });

  // ── Product-scoped Lemon Squeezy mapping ────────────────────────────────

  test('lemon-squeezy lib supports class_10, class_20, class_30 plan tiers', async () => {
    const ls = await readProjectFile('lib', 'lemon-squeezy.ts');

    expect(ls).toContain("'class_10'");
    expect(ls).toContain("'class_20'");
    expect(ls).toContain("'class_30'");
  });

  test('lemon-squeezy resolves room type correctly for class plans', async () => {
    const ls = await readProjectFile('lib', 'lemon-squeezy.ts');

    expect(ls).toContain("plan === 'class_10'");
    expect(ls).toContain("plan === 'class_20'");
    expect(ls).toContain("plan === 'class_30'");
    expect(ls).toContain("return 'class'");
  });

  // ── Legacy compatibility ────────────────────────────────────────────────

  test('legacy classroom plan maps to class_10 via webhook', async () => {
    const webhook = await readProjectFile('app', 'api', 'webhooks', 'lemon-squeezy', 'route.ts');

    expect(webhook).toContain("case 'classroom':");
    expect(webhook).toContain("return { plan: 'class_10', participantCap: 10 };");
  });

  test('types.ts includes new Class plan IDs and product_line in SubscriptionRecord', async () => {
    const types = await readProjectFile('types.ts');

    expect(types).toContain("'class_10'");
    expect(types).toContain("'class_20'");
    expect(types).toContain("'class_30'");
    expect(types).toContain("'class_custom'");
    expect(types).toContain('product_line: ProductLine');
  });

  // ── Meet coexistence ────────────────────────────────────────────────────

  test('meet pricing is unchanged and preserves existing Meet plans', async () => {
    const meetPricing = await readProjectFile('lib', 'pricing', 'meet.ts');

    expect(meetPricing).toContain("id: 'meet_free'");
    expect(meetPricing).toContain("id: 'meet_individual'");
    expect(meetPricing).toContain("id: 'meet_pro'");
    expect(meetPricing).toContain("id: 'meet_unlimited'");
    expect(meetPricing).toContain("id: 'meet_enterprise'");
    expect(meetPricing).toContain("cta: 'Contact Sales'");
  });
});