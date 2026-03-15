#!/bin/bash

echo "🔍 Bolna Dashboard Verification"
echo "================================"
echo ""

ERRORS=0

# Check if dashboard directory exists
if [ -d "dashboard" ]; then
    echo "✅ Dashboard directory exists"
else
    echo "❌ Dashboard directory not found"
    ERRORS=$((ERRORS + 1))
fi

# Check package.json
if [ -f "dashboard/package.json" ]; then
    echo "✅ dashboard/package.json exists"
else
    echo "❌ dashboard/package.json not found"
    ERRORS=$((ERRORS + 1))
fi

# Check for required pages
PAGES=("page.tsx" "calls/page.tsx" "analytics/page.tsx" "logs/page.tsx" "config/page.tsx")
for page in "${PAGES[@]}"; do
    if [ -f "dashboard/app/$page" ]; then
        echo "✅ dashboard/app/$page exists"
    else
        echo "❌ dashboard/app/$page not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check lib/api.ts
if [ -f "dashboard/lib/api.ts" ]; then
    echo "✅ dashboard/lib/api.ts exists"
else
    echo "❌ dashboard/lib/api.ts not found"
    ERRORS=$((ERRORS + 1))
fi

# Check .env.local
if [ -f "dashboard/.env.local" ]; then
    echo "✅ dashboard/.env.local exists"
else
    echo "⚠️  dashboard/.env.local not found (optional)"
fi

# Check if node_modules exists
if [ -d "dashboard/node_modules" ]; then
    echo "✅ dashboard/node_modules exists"
else
    echo "⚠️  dashboard/node_modules not found. Run: cd dashboard && npm install"
fi

# Check documentation
DOCS=("README.md" "QUICK_START.md" "VISUAL_GUIDE.md")
for doc in "${DOCS[@]}"; do
    if [ -f "dashboard/$doc" ]; then
        echo "✅ dashboard/$doc exists"
    else
        echo "⚠️  dashboard/$doc not found"
    fi
done

echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Dashboard is ready."
    echo ""
    echo "Next steps:"
    echo "1. cd dashboard && npm install (if not done)"
    echo "2. npm run dev (from dashboard folder)"
    echo "3. Open http://localhost:3001"
else
    echo "❌ Found $ERRORS error(s). Please fix them."
fi
echo ""
