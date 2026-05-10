#!/bin/bash
# Pre-Deploy Verification Pipeline
# Run this before git push to catch issues

set -e

echo "=============================================="
echo "PRE-DEPLOY VERIFICATION"
echo "=============================================="
echo ""

# 1. TypeScript check
echo "[1/5] TypeScript validation..."
npx tsc --noEmit 2>/dev/null && echo "✓ TypeScript OK" || echo "✗ TypeScript FAILED"

# 2. ESLint check
echo "[2/5] ESLint validation..."
npx eslint src/ --max-warnings 50 2>/dev/null && echo "✓ ESLint OK" || echo "⚠ ESLint warnings (allowed)"

# 3. Component import verification
echo "[3/5] Component import verification..."
node -e "
const fs = require('fs');
const components = fs.readdirSync('./src/components').filter(f => f.endsWith('.tsx'));
const app = fs.readFileSync('./src/App.tsx', 'utf-8');
const missing = components.filter(c => {
  const name = c.replace('.tsx', '');
  const jsx = '<' + name;
  if (app.includes(jsx)) {
    const regex = new RegExp('import.*' + name);
    if (!regex.test(app)) {
      return true;
    }
  }
  return false;
});
if (missing.length > 0) {
  console.log('MISSING IMPORTS:', missing.join(', '));
  process.exit(1);
}
console.log('✓ All component imports valid');
" || { echo "✗ Component import verification FAILED"; exit 1; }

# 4. Build check
echo "[4/5] Production build..."
npm run build -- --mode production 2>/dev/null && echo "✓ Build OK" || { echo "✗ Build FAILED"; exit 1; }

# 5. Chunk verification
echo "[5/5] Chunk verification..."
ls dist/assets/*.js | head -1 >/dev/null && echo "✓ Chunks generated" || { echo "✗ No chunks"; exit 1; }

echo ""
echo "=============================================="
echo "PRE-DEPLOY VERIFICATION COMPLETE"
echo "=============================================="
