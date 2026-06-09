/**
 * scripts/sync-variants.ts
 * -----------------------------------------------------------------------------
 * One-shot helper: fetches every Lemon Squeezy variant in the configured store
 * (LEMONSQUEEZY_STORE_ID, default 400906), matches them against the 5
 * Conferly tiers by price + name, and prints a `KEY=VALUE` block on stdout
 * that can be appended to `.env.local` using the requested naming convention:
 *
 *   NEXT_PUBLIC_VARIANT_ID_CLASSROOM
 *   NEXT_PUBLIC_VARIANT_ID_INDIVIDUAL
 *   NEXT_PUBLIC_VARIANT_ID_PRO
 *   NEXT_PUBLIC_VARIANT_ID_CLASSROOM_PLUS
 *   NEXT_PUBLIC_VARIANT_ID_UNLIMITED
 *
 * Usage:
 *   # Loads .env.local automatically and prints results to stdout
 *   npx --yes tsx scripts/sync-variants.ts
 *
 *   # Or to also write the keys straight into .env.local:
 *   npx --yes tsx scripts/sync-variants.ts --write
 *
 * Safety:
 *   - Never logs the API key or webhook signing secret.
 *   - Uses native fetch + a tiny hand-rolled .env parser (no extra deps).
 *
 * API quirk:
 *   The /v1/variants endpoint does NOT accept filter[store_id] (returns 400).
 *   So we list products in the store (which DOES accept the filter) and then
 *   fetch each product's variants via filter[product_id].
 * -----------------------------------------------------------------------------
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal .env loader so this script has zero npm dependencies.
 * - Skips blank lines and comments.
 * - Tolerates `export ` prefixes and single/double-quoted values.
 * - Does not overwrite values that are already in `process.env` (CLI wins).
 */
function loadEnvFile(path: string): void {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return; // File missing — assume shell env is set.
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const [, key, rawVal] = m;
    let val = rawVal.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));

type TierKey =
  | 'CLASSROOM'
  | 'INDIVIDUAL'
  | 'PRO'
  | 'CLASSROOM_PLUS'
  | 'UNLIMITED';

type TierSpec = {
  key: TierKey;
  /** Price in whole ZAR (e.g. 89 for R89). */
  price: number;
  /** Substrings (case-insensitive) that must appear in the variant name. */
  nameHints: string[];
};

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || '400906';

const TIERS: TierSpec[] = [
  { key: 'CLASSROOM',      price: 89,  nameHints: ['classroom'] },
  { key: 'INDIVIDUAL',     price: 110, nameHints: ['individual'] },
  { key: 'PRO',            price: 169, nameHints: ['pro'] },
  { key: 'CLASSROOM_PLUS', price: 220, nameHints: ['classroom', 'plus'] },
  { key: 'UNLIMITED',      price: 389, nameHints: ['unlimited'] },
];

type JsonApiErrors = Array<{ status?: string; title?: string; detail?: string }>;

type ListEnvelope<T> = {
  data: T[];
  links?: { next?: string };
  errors?: JsonApiErrors;
};

type Attributes = Record<string, unknown> & {
  name: string;
  price: number; // in cents
  status?: string;
};

type LsResource = {
  id: string;
  type: string;
  attributes: Attributes;
};

async function lsGet<T>(url: string, apiKey: string): Promise<ListEnvelope<T>> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`Lemon Squeezy request failed (${res.status}) for ${url}: ${body}`);
  }
  const json = (await res.json()) as ListEnvelope<T>;
  if (json.errors && json.errors.length > 0) {
    const summary = json.errors
      .map((e) => `${e.status ?? ''} ${e.title ?? ''}: ${e.detail ?? ''}`)
      .join('; ');
    throw new Error(`Lemon Squeezy returned errors for ${url}: ${summary}`);
  }
  return json;
}

async function lsListAll<T>(
  baseUrl: string,
  filterParams: Record<string, string>,
  apiKey: string,
): Promise<T[]> {
  const collected: T[] = [];
  const MAX_PAGES = 50;
  let page = 1;
  while (page <= MAX_PAGES) {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(filterParams)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set('page[number]', String(page));
    url.searchParams.set('page[size]', '100');

    const json = await lsGet<T>(url.toString(), apiKey);
    if (Array.isArray(json.data)) collected.push(...json.data);
    if (!json.links?.next) break;
    page += 1;
  }
  return collected;
}

async function fetchAllVariants(apiKey: string, storeId: string): Promise<LsResource[]> {
  const base = 'https://api.lemonsqueezy.com/v1';

  // 1) List all products in the store.
  const products = await lsListAll<LsResource>(`${base}/products`, { 'filter[store_id]': storeId }, apiKey);

  if (products.length === 0) {
    return [];
  }

  // 2) For each product, list its variants in parallel.
  const variantLists = await Promise.all(
    products.map((p) =>
      lsListAll<LsResource>(
        `${base}/variants`,
        { 'filter[product_id]': String(p.id) },
        apiKey,
      ),
    ),
  );
  return variantLists.flat();
}

function findTierVariant(variants: LsResource[], tier: TierSpec): LsResource | null {
  const candidates = variants.filter((v) => {
    if (v.attributes.status && v.attributes.status !== 'active') return false;
    return Math.round(v.attributes.price / 100) === tier.price;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Disambiguate multiple variants at the same price by name hints.
  const lowerHints = tier.nameHints.map((h) => h.toLowerCase());
  const scored = candidates
    .map((v) => {
      const name = v.attributes.name.toLowerCase();
      const score = lowerHints.reduce((acc, hint) => acc + (name.includes(hint) ? 1 : 0), 0);
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0].score > 0 ? scored[0].v : candidates[0];
}

async function main(): Promise<void> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error('LEMONSQUEEZY_API_KEY is not set. Add it to .env.local or export it before running.');
  }

  const storeVariants = await fetchAllVariants(apiKey, STORE_ID);

  if (storeVariants.length === 0) {
    throw new Error(
      `No products (and therefore no variants) exist in store ${STORE_ID}.\n` +
        `In the Lemon Squeezy dashboard, open the "Conferly" store (ID ${STORE_ID}) and:\n` +
        `  1. Create 5 products — one per Conferly tier:\n` +
        `       - Classroom      (R89 / month)\n` +
        `       - Individual     (R110 / month)\n` +
        `       - Pro            (R169 / month)\n` +
        `       - Classroom Plus (R220 / month)\n` +
        `       - Unlimited      (R389 / month)\n` +
        `  2. Give each product a single ZAR variant at the price above and mark it Active.\n` +
        `  3. Re-run: npx --yes tsx scripts/sync-variants.ts --write`,
    );
  }

  console.log(`Fetched ${storeVariants.length} variant(s) from store ${STORE_ID}.\n`);

  const resolved: Partial<Record<TierKey, { id: string; price: number; name: string }>> = {};
  const missing: TierKey[] = [];

  for (const tier of TIERS) {
    const v = findTierVariant(storeVariants, tier);
    if (!v) {
      missing.push(tier.key);
      continue;
    }
    resolved[tier.key] = {
      id: v.id,
      price: Math.round(v.attributes.price / 100),
      name: v.attributes.name,
    };
  }

  console.log('Matched tiers:');
  for (const tier of TIERS) {
    const r = resolved[tier.key];
    if (r) {
      console.log(
        `  - R${r.price}  ${r.name.padEnd(28)}  -> NEXT_PUBLIC_VARIANT_ID_${tier.key}=${r.id}`,
      );
    }
  }

  if (missing.length > 0) {
    console.warn(
      `\nCould not find variants for: ${missing.join(', ')}. ` +
        `Check the Lemon Squeezy dashboard to confirm those tiers exist and are active for store ${STORE_ID}.`,
    );
  }

  const envBlock =
    '\n# Auto-synced Lemon Squeezy variant IDs (generated by scripts/sync-variants.ts)\n' +
    TIERS.map((t) => `NEXT_PUBLIC_VARIANT_ID_${t.key}=${resolved[t.key]?.id ?? ''}`).join('\n') +
    '\n';

  console.log('\nAppend the following to .env.local:\n' + envBlock);

  if (process.argv.includes('--write')) {
    const envPath = resolve(process.cwd(), '.env.local');
    appendFileSync(envPath, envBlock, 'utf8');
    console.log(`\nWrote ${TIERS.length} variant IDs to ${envPath}`);
  }
}

main().catch((err) => {
  console.error('\n[sync-variants] FAILED');
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
