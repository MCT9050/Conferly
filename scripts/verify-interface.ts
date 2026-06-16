/**
 * scripts/verify-interface.ts
 *
 * Scalability Interface Test — Contract Verification
 *
 * Checks that the exported constants and types match the expected
 * "contract" (Lemon Squeezy products, unlimited participant cap, etc.)
 *
 * Run with:
 *   npx tsx scripts/verify-interface.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || process.cwd(), '..');
const TYPES_PATH = resolve(ROOT, 'types.ts');
const LEMON_SQUEEZY_PATH = resolve(ROOT, 'lib', 'lemon-squeezy.ts');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name} — ${detail}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

// ============================================================================
// 1. Read source files
// ============================================================================

console.log('\n═══════════════════════════════════════════════');
console.log('  Interface Verification — Contract Check');
console.log('═══════════════════════════════════════════════\n');

let typesContent: string;
let lemonContent: string;

try {
  typesContent = readFileSync(TYPES_PATH, 'utf-8');
  console.log(`📄 Read types.ts (${typesContent.length} chars)`);
} catch (err) {
  console.error(`❌ Could not read ${TYPES_PATH}`);
  process.exit(1);
}

try {
  lemonContent = readFileSync(LEMON_SQUEEZY_PATH, 'utf-8');
  console.log(`📄 Read lib/lemon-squeezy.ts (${lemonContent.length} chars)`);
} catch (err) {
  console.error(`❌ Could not read ${LEMON_SQUEEZY_PATH}`);
  process.exit(1);
}

// ============================================================================
// 2. Check UNLIMITED_PARTICIPANT_CAP
// ============================================================================

console.log('\n── UNLIMITED_PARTICIPANT_CAP ──');

const capMatch = typesContent.match(
  /export\s+const\s+UNLIMITED_PARTICIPANT_CAP\s*=\s*(\d+)/,
);
check(
  'UNLIMITED_PARTICIPANT_CAP is exported',
  !!capMatch,
  capMatch
    ? `Found: UNLIMITED_PARTICIPANT_CAP = ${capMatch[1]}`
    : 'Not found in types.ts',
);

check(
  'UNLIMITED_PARTICIPANT_CAP equals 9999',
  capMatch?.[1] === '9999',
  capMatch
    ? `Value: ${capMatch[1]}`
    : 'Cannot check — constant not found',
);

// ============================================================================
// 3. Check PlanTier types
// ============================================================================

console.log('\n── PlanTier Types ──');

// Extract PlanTier union members
const planTierMatch = typesContent.match(
  /export\s+type\s+PlanTier\s*=\s*\n?\s*\|?\s*'([^']+)'\s*\n?(?:\s*\|\s*'([^']+)'\s*\n?)*\s*;?/,
);

if (!planTierMatch) {
  // Fallback: find the full PlanTier block
  const blockStart = typesContent.indexOf('export type PlanTier');
  if (blockStart === -1) {
    check('PlanTier type exists', false, 'Not found in types.ts');
  }
}

// Simpler approach: find lines between PlanTier and the closing semicolon
const planTierBlock = typesContent.split(/\n/).reduce((acc, line) => {
  if (line.includes('export type PlanTier')) acc.inBlock = true;
  if (acc.inBlock) acc.lines.push(line);
  if (acc.inBlock && line.includes(';') && !line.includes('|')) acc.inBlock = false;
  return acc;
}, { inBlock: false, lines: [] as string[] });

const planTierMembers = planTierBlock.lines
  .join('\n')
  .match(/'([^']+)'/g)
  ?.map(s => s.replace(/'/g, '')) ?? [];

console.log(`  Found PlanTier members: ${planTierMembers.join(', ')}`);

check(
  'PlanTier has 8 members',
  planTierMembers.length === 8,
  `Expected 8, got ${planTierMembers.length}: ${planTierMembers.join(', ')}`,
);

// The 5 commercial tiers that should have Lemon Squeezy variants
const commercialTiers = ['classroom', 'classroom_plus', 'individual', 'pro', 'unlimited'];

console.log('\n── Lemon Squeezy Product Alignment ──');

commercialTiers.forEach((tier) => {
  check(
    `PlanTier contains commercial tier "${tier}"`,
    planTierMembers.includes(tier),
    planTierMembers.includes(tier)
      ? `Found: '${tier}'`
      : `'${tier}' not found in PlanTier`,
  );
});

// Non-commercial tiers should also be present
const nonCommercialTiers = ['trial', 'enterprise', 'business'];
nonCommercialTiers.forEach((tier) => {
  check(
    `PlanTier contains non-commercial tier "${tier}"`,
    planTierMembers.includes(tier),
    planTierMembers.includes(tier)
      ? `Found: '${tier}'`
      : `'${tier}' not found in PlanTier`,
  );
});

// ============================================================================
// 4. Check SupportedPlanTier in lemon-squeezy.ts
// ============================================================================

console.log('\n── SupportedPlanTier in lib/lemon-squeezy.ts ──');

const supportedMatch = lemonContent.match(
  /export\s+type\s+SupportedPlanTier\s*=\s*\n?\s*\|?\s*'([^']+)'\s*\n?(?:\s*\|\s*'([^']+)'\s*\n?)*\s*;?/,
);

// Extract SupportedPlanTier members
const supportedBlock = lemonContent.split(/\n/).reduce((acc, line) => {
  if (line.includes('export type SupportedPlanTier')) acc.inBlock = true;
  if (acc.inBlock) acc.lines.push(line);
  if (acc.inBlock && line.includes(';') && !line.includes('|')) acc.inBlock = false;
  return acc;
}, { inBlock: false, lines: [] as string[] });

const supportedMembers = supportedBlock.lines
  .join('\n')
  .match(/'([^']+)'/g)
  ?.map(s => s.replace(/'/g, '')) ?? [];

console.log(`  Found SupportedPlanTier members: ${supportedMembers.join(', ')}`);

check(
  'SupportedPlanTier has 6 members',
  supportedMembers.length === 6,
  `Expected 6, got ${supportedMembers.length}: ${supportedMembers.join(', ')}`,
);

commercialTiers.forEach((tier) => {
  check(
    `SupportedPlanTier contains "${tier}"`,
    supportedMembers.includes(tier),
    supportedMembers.includes(tier)
      ? `Found: '${tier}'`
      : `'${tier}' not found`,
  );
});

// ============================================================================
// 5. Check PLAN_TO_VARIANT_ENV mapping
// ============================================================================

console.log('\n── PLAN_TO_VARIANT_ENV Mapping ──');

const variantKeys = [
  'NEXT_PUBLIC_VARIANT_ID_CLASSROOM',
  'NEXT_PUBLIC_VARIANT_ID_CLASSROOM_PLUS',
  'NEXT_PUBLIC_VARIANT_ID_INDIVIDUAL',
  'NEXT_PUBLIC_VARIANT_ID_PRO',
  'NEXT_PUBLIC_VARIANT_ID_UNLIMITED',
];

const variantKeysInTypes = variantKeys.filter((k) => lemonContent.includes(k));
check(
  'All 5 variant env vars mapped in PLAN_TO_VARIANT_ENV',
  variantKeysInTypes.length === 5,
  `Found ${variantKeysInTypes.length}/5: ${variantKeysInTypes.join(', ')}`,
);

// ============================================================================
// Summary
// ============================================================================

console.log('\n═══════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════');

if (failures.length > 0) {
  console.log(`\n  Failed checks: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\n  🎉 All interface checks passed!\n');
process.exit(0);