-- Migration: add product_line to subscriptions table
-- This supports the dual-product architecture (Conferly Meet + Conferly Class)

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS product_line text DEFAULT 'meet';

-- Index for queries filtering by product line
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_line ON subscriptions (product_line);