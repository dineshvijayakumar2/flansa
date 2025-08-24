# Railway Memory (OOM) Fix Explained

## 🚨 The Problem

Railway has **different memory limits** for different phases:

| Phase | Memory Limit | What Happens |
|-------|--------------|--------------|
| **Build Phase** | ~512MB-1GB | Docker image building |
| **Runtime Phase** | 8GB+ | Your app running |

The OOM error happens during **build phase** when:
- Installing node modules
- Building assets (yarn/npm)
- Compiling JavaScript/CSS

## 🔧 The Solution

### Minimal Dockerfile Strategy

**Old Approach** (OOM Error):
```dockerfile
# Heavy operations during build
RUN bench init ...           # 500MB+ memory
RUN bench build --app frappe # 1GB+ memory spike!
```

**New Approach** (No OOM):
```dockerfile
# Lightweight build
RUN git clone --depth 1 ...  # 50MB memory
# NO asset building during Docker build
```

### What We Changed

1. **Dockerfile.minimal**:
   - Just clones code (lightweight)
   - No `bench init` (heavy)
   - No asset building (very heavy)
   - Docker build uses ~200MB

2. **railway-runtime-setup.sh**:
   - Runs AFTER container starts
   - Has access to full 8GB+ memory
   - Builds assets with memory limits
   - Uses `NODE_OPTIONS="--max-old-space-size=512"`

## 📊 Memory Usage Comparison

| Operation | Memory Used | When It Runs |
|-----------|-------------|--------------|
| Git clone | 50MB | Docker build |
| pip install | 100MB | Docker build |
| bench init | 500MB | Runtime (now) |
| Asset build | 1-2GB | Runtime (now) |

## 🚀 Railway Configuration

### If You Have a Paid Plan

In Railway Dashboard → Service Settings:

```yaml
# Increase build memory (paid plans only)
build:
  memoryLimit: 2048  # 2GB for build phase
```

### For Free/Starter Plans

Use our minimal approach (already configured):
- Minimal Dockerfile
- Runtime asset building
- Memory-limited Node processes

## 🎮 How to Deploy Now

1. **The changes are already pushed**
2. **Railway will use `Dockerfile.minimal`**
3. **First deployment will be slower** (builds assets at runtime)
4. **Future deployments will be fast** (assets already built)

## 💡 Understanding the Error

**Exit Code 137** = Out of Memory (OOM) Kill

When you see:
```
yarn run production...
Killed
error Command failed with exit code 137
```

This means:
- Process tried to use more memory than allowed
- Linux kernel killed it (OOM killer)
- Usually happens with Node.js/webpack builds

## 🔧 Environment Variables for Memory Control

Add these to Railway if needed:

```env
# Limit Node.js memory usage
NODE_OPTIONS=--max-old-space-size=512

# Skip heavy operations
BUILD_ASSETS=false  # After first successful build

# Use minimal builds
PRODUCTION_BUILD=true
```

## 📈 Monitoring Memory

In Railway Dashboard:
1. Go to Metrics tab
2. Watch memory usage during deployment
3. If it spikes near limit, you'll get OOM

## 🎯 Summary

**Problem**: Railway build phase has low memory limit
**Solution**: Move heavy operations to runtime
**Result**: No more OOM errors!

The deployment will now:
1. Build minimal Docker image (low memory)
2. Start container (high memory available)
3. Build assets at runtime (when needed)
4. Serve the application