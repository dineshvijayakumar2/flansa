# Railway Environment Variables Guide

## 🎯 What are Environment Variables in Railway?

Environment variables are configuration settings that your app reads at runtime. In Railway, you set these in the dashboard, and they're injected into your Docker container.

## 📋 How to Set Environment Variables in Railway

### Step 1: Open Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Click on your project
3. Click on the **Flansa service** (not PostgreSQL or Redis)

### Step 2: Navigate to Variables Tab
1. Click on **"Variables"** tab (top of service page)
2. You'll see two sections:
   - **Service Variables** (specific to Flansa)
   - **Shared Variables** (available to all services)

### Step 3: Add Variables
Click **"+ New Variable"** and add:

```env
# Database (usually auto-connected)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (if you have Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# Admin password for Frappe
ADMIN_PASSWORD=your-secure-password-here

# Control flags (change these as needed)
RUN_MIGRATIONS=false
BUILD_ASSETS=true
```

## 🔧 Important Variables for Flansa

### Required Variables (Auto-set by Railway)
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/railway` |
| `REDIS_URL` | Redis connection string | `redis://default:pass@host:6379` |
| `PORT` | Server port (Railway sets this) | `8080` |

### Custom Variables (You set these)
| Variable | Description | When to Use |
|----------|-------------|-------------|
| `ADMIN_PASSWORD` | Frappe admin password | Always set this |
| `RUN_MIGRATIONS` | Run database migrations | Set `true` for DB changes |
| `BUILD_ASSETS` | Rebuild CSS/JS | Set `true` if CSS broken |
| `SKIP_SITE_SETUP` | Skip site creation | Set `true` after first deploy |

## 🚀 For Your Current Situation (CSS Not Loading)

Since you removed the Flansa deployment but kept the database, you need:

### In Railway Variables Tab, set:
```env
# Force asset rebuild to fix CSS
BUILD_ASSETS=true

# Run migrations to ensure DB is updated
RUN_MIGRATIONS=true

# Your admin password
ADMIN_PASSWORD=your-password-here
```

### After First Successful Deploy, change to:
```env
# Faster deployments after initial setup
BUILD_ASSETS=false
RUN_MIGRATIONS=false
```

## 📊 Variable Reference Syntax

Railway uses special syntax for referencing other services:

```env
# Reference PostgreSQL service's DATABASE_URL
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Reference Redis service's URL
REDIS_URL=${{Redis.REDIS_URL}}

# Reference another variable
MY_VAR=${{ANOTHER_VAR}}
```

## 🎮 Quick Setup for New Deployment

1. **Click "+ New Variable"** for each:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
ADMIN_PASSWORD=SecurePass123!
BUILD_ASSETS=true
RUN_MIGRATIONS=true
```

2. **Click "Deploy"** button

3. **After deployment succeeds**, change:
```env
BUILD_ASSETS=false
RUN_MIGRATIONS=false
```

## 🔍 How to Check Current Variables

1. Go to Railway Dashboard
2. Click your Flansa service
3. Click "Variables" tab
4. You'll see all current variables and their values

## 💡 Pro Tips

### Tip 1: Use Railway's Reference Variables
Instead of copying database URL manually:
- ❌ `DATABASE_URL=postgresql://user:pass@...`
- ✅ `DATABASE_URL=${{Postgres.DATABASE_URL}}`

### Tip 2: Change Variables Without Rebuilding
Changing these variables doesn't rebuild Docker:
- `RUN_MIGRATIONS`
- `BUILD_ASSETS`
- `ADMIN_PASSWORD`

But Railway will restart your service.

### Tip 3: Debug with Logs
Check if variables are working:
1. Go to "Deployments" tab
2. Click on latest deployment
3. View logs to see variable values being used

## 🚨 Common Issues

### Issue: "DATABASE_URL not found"
**Fix**: Add `DATABASE_URL=${{Postgres.DATABASE_URL}}` in Variables

### Issue: CSS/JS not loading
**Fix**: Set `BUILD_ASSETS=true` and redeploy

### Issue: Login not working
**Fix**: Check `ADMIN_PASSWORD` variable is set

### Issue: Slow deployments
**Fix**: After first deploy, set:
- `BUILD_ASSETS=false`
- `RUN_MIGRATIONS=false`
- `SKIP_SITE_SETUP=true`

## 🎯 Your Next Steps

1. **Go to Railway Dashboard → Flansa Service → Variables**
2. **Add these variables:**
   ```env
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   ADMIN_PASSWORD=YourPassword123!
   BUILD_ASSETS=true
   RUN_MIGRATIONS=true
   ```
3. **Click "Deploy"**
4. **Wait for deployment** (check Deployments tab)
5. **After success**, set `BUILD_ASSETS=false` for faster future deploys

This will fix your CSS issue and set up the site properly!