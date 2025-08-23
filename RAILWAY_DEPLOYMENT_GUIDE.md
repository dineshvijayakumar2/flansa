# Railway Deployment Guide - Smooth Updates

## 🎯 Deployment Philosophy

**Minimize Disruption**: Keep site data persistent across deployments
**Incremental Updates**: Only run migrations when needed
**Smart Detection**: Check if site exists before recreating

## 📋 Pre-Deployment Checklist

Before pushing to Railway:

1. **Test locally first**
   ```bash
   bench --site mysite.local migrate
   bench --site mysite.local clear-cache
   ```

2. **Check for breaking changes**
   - Database schema changes?
   - New required fields?
   - Dependency updates?

## 🚀 Deployment Process

### For Code Changes Only (No DB Changes)

1. **Make changes on main branch**
   ```bash
   git checkout main
   # Make your changes
   git add .
   git commit -m "Feature: Your change description"
   git push origin main
   ```

2. **Sync to Railway branch**
   ```bash
   ./claude-code/sync_to_railway.sh
   ```

3. **Railway auto-deploys**
   - Site persists
   - No login required
   - No data loss

### For Database Schema Changes

1. **Test migration locally first**
   ```bash
   bench --site mysite.local migrate
   ```

2. **Update DEPLOYMENT_VERSION in Dockerfile**
   ```dockerfile
   ENV DEPLOYMENT_VERSION=v6_your_change
   ```

3. **Deploy**
   ```bash
   git add .
   git commit -m "Migration: Your schema change"
   git push origin main
   ./claude-code/sync_to_railway.sh
   ```

## 🔧 Railway Configuration

### Environment Variables (Set in Railway)

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname
ADMIN_PASSWORD=your-secure-password

# Optional
REDIS_URL=redis://default:pass@host:6379
```

### Service Settings

- **Healthcheck Path**: `/api/method/ping`
- **Start Command**: Default (uses Dockerfile CMD)
- **Root Directory**: `/docker-setup`

## 🏗️ How v4 Script Works

1. **Checks if site exists** in PostgreSQL
2. **Reuses existing site** if found
3. **Only creates new site** on first deployment
4. **Skips unnecessary operations**:
   - Asset building (if exists)
   - Migrations (if no changes)
   - Cache clearing (if not needed)

## 🚨 Troubleshooting

### Site Requires Login After Deploy

**Cause**: Site was recreated
**Fix**: v4 script now checks for existing site

### Database Viewer Error

**Cause**: Old code still cached
**Fix**: 
```bash
# Force rebuild
ENV DEPLOYMENT_VERSION=v{n}_force_rebuild
```

### Migration Failures

**Cause**: Schema conflicts
**Fix**: Use `--skip-failing` flag in script

### Redis Connection Issues

**Cause**: Redis URL incorrect
**Fix**: Script gracefully disables Redis if unavailable

## 📊 Monitoring Deployment

### Check Logs in Railway

Look for these markers:
- `✅ Site exists in database` - Good, reusing site
- `📝 Site not found` - Creating new (first deploy)
- `⏭️ Skipping migrations` - No changes needed
- `✅ Assets already built` - Efficient, reusing

### Verify Site Status

```python
# In bench console
frappe.db.sql("SELECT name, creation FROM tabSite WHERE name LIKE '%railway%'")
```

## 🔄 Rollback Process

If deployment fails:

1. **In Railway Dashboard**
   - Click "Rollback" to previous deployment
   - Site data remains intact

2. **Fix locally**
   ```bash
   git checkout main
   # Fix the issue
   git add . && git commit -m "Fix: Issue description"
   ```

3. **Redeploy**
   ```bash
   ./claude-code/sync_to_railway.sh
   ```

## 💡 Best Practices

1. **Incremental Changes**: Small, focused updates
2. **Test Locally**: Always test on mysite.local first
3. **Monitor Logs**: Watch Railway logs during deploy
4. **Version Bumps**: Update DEPLOYMENT_VERSION for Docker cache
5. **Document Changes**: Clear commit messages

## 🎯 Quick Commands

```bash
# Check current branch
git branch

# Sync main to railway-fresh
./claude-code/sync_to_railway.sh

# Force Railway rebuild
# Edit Dockerfile: ENV DEPLOYMENT_VERSION=vX_description

# Check Railway database
PGPASSWORD=pass psql -h host -U user -d railway
\dt tab*  # List tables
SELECT * FROM "tabSite";  # Check sites
```

## 📈 Performance Tips

1. **Asset Pre-building**: Done in Dockerfile
2. **Skip Redundant Operations**: v4 script checks first
3. **Persistent Connections**: Reuse database connections
4. **Conditional Migrations**: Only when needed

This approach ensures:
- ✅ No unnecessary site recreation
- ✅ Persistent login sessions
- ✅ Faster deployments
- ✅ Less database stress
- ✅ Better user experience