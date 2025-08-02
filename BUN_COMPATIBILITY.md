# Bun Runtime Compatibility

This file contains specific instructions and optimizations for running the WhatsApp webhook API with Bun runtime.

## 🔥 Installation with Bun

### Install Bun
```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Or on Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Install Dependencies
```bash
# Install dependencies with Bun (faster than npm)
bun install

# Or use the script
npm run install:bun
```

## 🚀 Running with Bun

### Development Mode
```bash
# Run with hot reload (Bun feature)
bun run dev:bun

# Or manually
bun --hot app.js
```

### Production Mode
```bash
# Run in production
bun run start:bun

# Or manually
bun run app.js
```

### Legacy Mode (if needed)
```bash
# Run legacy file with Bun
bun run start:legacy:bun
```

## ⚡ Bun Optimizations Enabled

When running on Bun, the following optimizations are automatically enabled:

### 1. **Performance Optimizations**
- Native JSON parsing/stringifying
- Optimized HTTP server
- Faster file operations
- Memory optimizations

### 2. **Development Features**
- Hot reload support (`--hot` flag)
- Faster startup times
- Improved error messages

### 3. **Database Optimizations**
- Connection pooling optimizations
- Query performance monitoring
- Native module usage where possible

### 4. **WebSocket Optimizations**
- Compression enabled
- Optimized binary handling
- Better memory management

## 🔧 Configuration

The application automatically detects Bun runtime and enables optimizations:

```javascript
// Runtime detection is automatic
const runtime = {
    isBun: typeof Bun !== 'undefined',
    name: typeof Bun !== 'undefined' ? 'bun' : 'node'
};
```

## 📊 Performance Benefits

Expected performance improvements with Bun:

- **Startup Time**: ~3x faster
- **HTTP Requests**: ~1.5-2x faster
- **File Operations**: ~2-3x faster
- **Memory Usage**: ~20-30% lower
- **JSON Operations**: ~2x faster

## 🐛 Compatibility Notes

### Working Features
- ✅ All Express.js functionality
- ✅ Socket.IO operations
- ✅ Database connections (Supabase)
- ✅ File uploads and processing
- ✅ WhatsApp Baileys integration
- ✅ Session management
- ✅ All existing APIs

### Bun-Specific Features
- ✅ Hot reload in development
- ✅ Faster startup and runtime
- ✅ Optimized file operations
- ✅ Native TypeScript support (if needed)

### Fallbacks
- Node.js compatibility maintained for all core functionality
- Automatic fallback to Node.js methods when Bun-specific features unavailable

## 🔍 Monitoring

### Runtime Detection
The application logs which runtime is being used:
```
🚀 Running on bun runtime
⚡ Bun optimizations enabled
```

### Performance Monitoring
Performance metrics are logged with runtime-specific prefixes:
```
⚡ [BUN] Database Query: 2.3ms
🐢 [NODE] Database Query: 4.7ms
```

## 🧪 Testing

```bash
# Run tests with Bun
bun test

# Or use npm script
npm run test:bun
```

## 📈 Benchmarking

To compare performance between Node.js and Bun:

```bash
# Test with Node.js
time npm start

# Test with Bun
time bun run start:bun
```

## 🔧 Troubleshooting

### Common Issues

1. **Module Import Issues**
   - Ensure all requires use `.js` extensions if needed
   - Check for Node.js specific APIs that might not be available

2. **Performance Not Improved**
   - Verify Bun optimizations are enabled in logs
   - Check that you're using `bun run` command

3. **Hot Reload Not Working**
   - Use `bun --hot app.js` command
   - Ensure you're in development mode

### Environment Variables
```bash
# Optional: Force Bun optimizations
BUN_OPTIMIZATIONS=true

# Development mode for hot reload
NODE_ENV=development
```

## 🔄 Switching Between Runtimes

You can easily switch between Node.js and Bun:

```bash
# Node.js
npm start

# Bun
bun run start:bun
```

Both will work identically with the same functionality!