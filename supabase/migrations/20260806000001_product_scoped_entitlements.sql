-- Migration: product-scoped subscriptions and idempotent webhook processing
-- Phase 2: Product-Scoped Monetization and Entitlement Plan
--
-- Changes:
-- 1. Drop UNIQUE(user_id) constraint; add UNIQUE(user_id, product_line)
-- 2. Add subscription_webhook_events table for idempotency
-- 3. Add indexes for product-scoped lookups
-- 4. Backfill product_line for legacy records
-- 5. Report ambiguous records that cannot be safely migrated

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Fix uniqueness constraint to be product-scoped
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove the old user_id-only uniqueness constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_key;

-- Add product-scoped uniqueness (user_id, product_line)
-- Composite unique constraint ensures:
--   - One Meet subscription per user
--   - One Class subscription per user
--   - Both can coexist (different product_line values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_product
  ON subscriptions (user_id, product_line);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Webhook idempotency table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscription_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id text NOT NULL UNIQUE,
  event_name text NOT NULL,
  subscription_id text,
  user_id uuid,
  product_line text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast idempotency checks
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id
  ON subscription_webhook_events (webhook_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Additional indexes for product-scoped lookups
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_product_line
  ON subscriptions (user_id, product_line);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Backfill product_line for legacy records
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Heuristic: records with plan starting with 'class_' or 'classroom' are Class.
--            All others (including NULL product_line) default to Meet.
-- This is safe because:
--   - Class is a new product line; existing records are Meet by default.
--   - The product_line column was added in a prior migration with DEFAULT 'meet'.
--   - We only backfill rows where product_line is explicitly NULL.

UPDATE subscriptions
SET product_line = 'class'
WHERE product_line IS NULL
  AND (
    plan LIKE 'class_%'
    OR plan IN ('classroom', 'classroom_plus', 'class_unlimited')
  );

UPDATE subscriptions
SET product_line = 'meet'
WHERE product_line IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Validation: report any ambiguous records
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The following SELECT will identify any rows where a single user has multiple
-- active subscriptions for the same product_line — which should not happen after
-- the unique constraint is applied. These are reported, not deleted.

-- Validate: count rows per (user_id, product_line) to find duplicates
CREATE TEMP VIEW IF NOT EXISTS duplicate_subscriptions AS
SELECT user_id, product_line, COUNT(*) as subscription_count
FROM subscriptions
GROUP BY user_id, product_line
HAVING COUNT(*) > 1;