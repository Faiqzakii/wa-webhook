#!/usr/bin/env bash

# Bun compatibility test script

echo "🧪 Testing Bun Compatibility..."
echo "================================"

# Check if Bun is installed
if command -v bun &> /dev/null; then
    echo "✅ Bun is installed: $(bun --version)"
else
    echo "❌ Bun is not installed"
    echo "📖 Install Bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Test Node.js compatibility first
echo ""
echo "🔧 Testing Node.js compatibility..."
if node -e "const { config } = require('./src/config/index.js'); console.log('✅ Configuration loads with Node.js');" &> /dev/null; then
    echo "✅ Node.js compatibility confirmed"
else
    echo "❌ Node.js compatibility issues found"
    exit 1
fi

# Test Bun installation of dependencies
echo ""
echo "🔧 Testing dependency installation with Bun..."
if bun install --dry-run &> /dev/null; then
    echo "✅ Bun can install dependencies"
else
    echo "❌ Bun dependency installation failed"
    exit 1
fi

# Test syntax checking with Bun
echo ""
echo "🔍 Testing syntax compatibility with Bun..."
if timeout 10s bun -e "console.log('✅ Bun syntax check passed')" &> /dev/null; then
    echo "✅ Basic Bun execution works"
else
    echo "❌ Bun execution failed"
    exit 1
fi

# Test configuration loading with Bun
echo ""
echo "⚙️  Testing configuration loading with Bun..."
if timeout 10s bun -e "const { config } = require('./src/config/index.js'); console.log('✅ Config loaded with Bun, runtime:', config.runtime.name);" 2>/dev/null; then
    echo "✅ Configuration loading works with Bun"
else
    echo "❌ Configuration loading failed with Bun"
    exit 1
fi

# Test logger with Bun
echo ""
echo "📝 Testing logger with Bun..."
if timeout 10s bun -e "const logger = require('./src/utils/logger.js'); logger.info('Test from Bun'); console.log('✅ Logger works with Bun');" 2>/dev/null; then
    echo "✅ Logger works correctly with Bun"
else
    echo "❌ Logger failed with Bun"
    exit 1
fi

echo ""
echo "🎉 All Bun compatibility tests passed!"
echo ""
echo "🚀 To run with Bun:"
echo "   Development: bun run dev:bun"
echo "   Production:  bun run start:bun"
echo ""
echo "📖 See BUN_COMPATIBILITY.md for detailed instructions"