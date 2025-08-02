# Quick Fix Guide for Bun Compatibility Issues

## 🐛 Common Issues and Solutions

### 1. **"logger.runtime is not a function" Error**

**Problem**: The logger.runtime method doesn't exist or isn't recognized.

**Solution**: ✅ **FIXED** - The code now uses `logger.info()` instead of `logger.runtime()`.

```javascript
// OLD (problematic)
logger.runtime('Server started', { port: 8181 });

// NEW (working)
logger.info('Server started on bun runtime', { port: 8181, runtime: 'bun' });
```

### 2. **Module Import Issues**

**Problem**: Some modules might not load correctly with Bun.

**Solution**: 
```bash
# Clear any cached modules
rm -rf node_modules
rm package-lock.json

# Reinstall with Bun
bun install
```

### 3. **Hot Reload Not Working**

**Problem**: Hot reload feature doesn't work in development.

**Solution**:
```bash
# Make sure you're using the --hot flag
bun --hot app.js

# Or use the npm script
bun run dev:bun
```

### 4. **Environment Variables Not Loading**

**Problem**: Environment variables from .env not being read.

**Solution**: Make sure your .env file exists and has proper format:
```bash
# .env
SUPABASE_URL=your_url_here
SUPABASE_SERVICE_KEY=your_key_here
PORT=8181
```

### 5. **Performance Not Improved**

**Problem**: Not seeing expected performance improvements.

**Solution**: 
- Verify you're using `bun run` commands
- Check that optimizations are enabled in logs
- Make sure you're not using Node.js by mistake

### 6. **Package Installation Issues**

**Problem**: Some packages fail to install with Bun.

**Solution**:
```bash
# Try with --force flag
bun install --force

# Or fallback to npm for problematic packages
npm install [package-name]
bun install
```

## 🔧 Quick Diagnostic Commands

### Check Runtime Detection
```bash
bun -e "const { config } = require('./src/config/index.js'); console.log('Runtime:', config.runtime.name, 'isBun:', config.runtime.isBun);"
```

### Test Logger
```bash
bun -e "const logger = require('./src/utils/logger.js'); logger.info('Test message'); console.log('Logger OK');"
```

### Test Configuration
```bash
bun -e "const { validateConfig } = require('./src/config/index.js'); validateConfig(); console.log('Config OK');"
```

### Check Package Compatibility
```bash
bun install --dry-run
```

## 🚨 Emergency Fallback

If Bun isn't working, you can always fall back to Node.js:

```bash
# Use Node.js instead
npm start
# or
npm run dev
```

## 📞 Getting Help

1. **Run the test script**: `./test-bun-compatibility.sh`
2. **Check logs**: Look for runtime detection messages
3. **Verify Bun version**: `bun --version` (should be >= 1.0.0)
4. **Check environment**: Make sure .env file is properly configured

## ✅ Verification Checklist

- [ ] Bun is installed (`bun --version`)
- [ ] Dependencies installed (`bun install`)
- [ ] Environment variables set (`.env` file)
- [ ] Runtime detection working
- [ ] Logger functioning properly
- [ ] Application starts without errors

If all items are checked and you're still having issues, use Node.js as a fallback while troubleshooting.