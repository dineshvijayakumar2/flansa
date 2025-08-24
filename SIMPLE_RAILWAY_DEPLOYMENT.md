# Simple Railway Deployment Strategy

## 🎯 The Problem
Currently, every small code change triggers:
- Full Docker rebuild (reinstalls Frappe)
- Site recreation
- Database migrations
- Asset rebuilding
- **Result**: 10-15 minute deployments for 1-line changes!

## ✨ The Solution: Three Deployment Modes

### 1. **Code-Only Updates** (Most Common - 2-3 minutes)
For Python/JS code changes without database changes:

```bash
# In Railway Dashboard, set:
RUN_MIGRATIONS=false
SKIP_SITE_SETUP=true
REBUILD_ASSETS=false

# Push your code
git push origin railway-fresh
```

**What happens:**
- ✅ Copies new code
- ✅ Clears cache
- ✅ Restarts server
- ❌ No site recreation
- ❌ No migrations
- ❌ No asset rebuild

### 2. **Database Changes** (5-7 minutes)
For DocType changes or new fields:

```bash
# In Railway Dashboard, set:
RUN_MIGRATIONS=true
SKIP_SITE_SETUP=true
REBUILD_ASSETS=false

# Push your code
git push origin railway-fresh
```

**What happens:**
- ✅ Copies new code
- ✅ Runs migrations
- ❌ No site recreation

### 3. **Full Rebuild** (10-15 minutes)
Only for major changes or first deployment:

```bash
# In Railway Dashboard, set:
RUN_MIGRATIONS=true
SKIP_SITE_SETUP=false
REBUILD_ASSETS=true

# Push your code
git push origin railway-fresh
```

## 🚀 Quick Setup

### Step 1: Update Dockerfile in railway-fresh
```bash
git checkout railway-fresh
```

Edit `docker-setup/Dockerfile` to use simple version:
```dockerfile
# At the top of Dockerfile
FROM frappe/bench:latest

# ... rest of simple Dockerfile
```

### Step 2: Set Railway Variables
In Railway Dashboard → Variables:

```env
# Control flags (change as needed)
RUN_MIGRATIONS=false
SKIP_SITE_SETUP=true
REBUILD_ASSETS=false

# Your existing variables
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ADMIN_PASSWORD=...
```

### Step 3: Use railway.json
The `railway.json` file tells Railway how to build and deploy.

## 📊 Deployment Time Comparison

| Change Type | Old Method | New Method | Time Saved |
|------------|-----------|-----------|------------|
| Fix typo in Python | 15 min | 2 min | 87% |
| Add new field | 15 min | 5 min | 67% |
| Update JS/CSS | 15 min | 3 min | 80% |
| First deploy | 15 min | 15 min | 0% |

## 🔧 How It Works

### Docker Layer Caching
```dockerfile
# These layers are cached (don't rebuild):
RUN bench init ...           # Cached after first build
RUN bench get-app frappe ... # Cached after first build

# Only this changes (fast):
COPY . /apps/flansa/         # Your code changes
```

### Smart Startup Script
```bash
# Checks if site exists
if site_exists_in_db; then
    use_existing_site()      # Fast
else
    create_new_site()        # Slow (only first time)
fi
```

## 💡 Pro Tips

### 1. Development Workflow
```bash
# Local testing
bench --site mysite.local console
# Test your changes

# Deploy to Railway (code only)
git push origin railway-fresh
# 2 minutes later: Live!
```

### 2. Batch Changes
Instead of deploying each small fix:
```bash
# Collect multiple changes
git add file1.py
git add file2.js
git commit -m "Multiple fixes"
git push  # Single deployment
```

### 3. Emergency Rollback
```bash
# In Railway Dashboard
Click "Rollback" to previous deployment
# Site data remains intact!
```

## 🎮 Railway Dashboard Controls

Create these environment variables in Railway:

| Variable | Purpose | When to Set True |
|----------|---------|-----------------|
| `RUN_MIGRATIONS` | Run bench migrate | DocType changes |
| `SKIP_SITE_SETUP` | Use existing site | After first deploy |
| `REBUILD_ASSETS` | Rebuild JS/CSS | Frontend changes |
| `FORCE_REBUILD` | Full Docker rebuild | Major changes |

## 📝 Examples

### Example 1: Fix a Python Bug
```python
# Fix the bug in your code
vim flansa/some_file.py

# Commit and push
git add . && git commit -m "Fix: calculation error"
git push origin railway-fresh

# Railway deploys in 2 minutes (code-only mode)
```

### Example 2: Add New DocType
```bash
# Create DocType locally
bench --site mysite.local new-doctype "New Feature"

# Test locally
bench --site mysite.local migrate

# Deploy with migrations
# Set RUN_MIGRATIONS=true in Railway
git push origin railway-fresh

# Railway runs migrations (5 minutes)
```

## 🚨 Troubleshooting

### Site Not Found Error
```bash
# Set in Railway:
SKIP_SITE_SETUP=false  # Creates site
# Deploy once, then set back to true
```

### Code Changes Not Reflecting
```bash
# Force cache clear
FORCE_CACHE_CLEAR=true
# Or SSH and run:
bench --site your-site clear-cache
```

### Migration Errors
```bash
# Use skip-failing flag
RUN_MIGRATIONS=true
MIGRATION_FLAGS=--skip-failing
```

## 🎯 Summary

**Before**: Every change = 15 minute full rebuild
**After**: Smart deployments based on change type

- Code changes: 2 minutes
- Database changes: 5 minutes  
- Full rebuild: 15 minutes (rare)

This makes Railway deployments almost as fast as local development!