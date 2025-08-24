# Railway Deployment Fix Instructions

## Issues Fixed in Latest Deployment:

1. **✅ Navigation Bar**: `developer_mode` changed from 0 to 1 
2. **✅ PostgreSQL Hooks**: Updated `doctype_hooks.py` for transaction safety
3. **🔄 Workspace Record**: Need to create in Railway database
4. **🔄 Schema Issues**: May need migrations for `tenant_id` columns

## Commands to Execute in Railway:

### 1. After Deployment Completes:

Connect to Railway site and run:

```bash
# Run migrations first
bench --site [your-railway-site-name] migrate

# Execute the fix script
bench --site [your-railway-site-name] console
```

### 2. In Railway Console, Execute:

```python
exec(open('/home/frappe/frappe-bench/claude-code/fix_railway_complete.py').read())
```

### 3. If Schema Issues Persist:

```bash
# Check what doctypes exist
bench --site [site-name] list-doctypes | grep Flansa

# If missing, reinstall app
bench --site [site-name] reinstall-app flansa --force
```

## What the Fix Script Does:

1. **Creates Flansa Workspace** - Replicates the `/app/flansa` super-admin page
2. **Updates DocType Hooks** - Prevents PostgreSQL transaction failures  
3. **Handles Missing Columns** - Gracefully handles missing `tenant_id` fields
4. **Provides Migration Commands** - Instructions for fixing schema issues

## Expected Results:

- ✅ Frappe navigation bar appears (developer_mode=1)
- ✅ `/app/flansa` workspace accessible 
- ✅ Tenant creation works without transaction errors
- ✅ All tenant management functions operational

## If Issues Persist:

The main error was: `column "tenant_id" does not exist`

This means the Railway database schema is missing columns that exist locally. The fix script handles this gracefully, but if needed:

```sql
-- Manual column additions (run in Railway if needed):
ALTER TABLE "tabFlansa Table" ADD COLUMN tenant_id VARCHAR(140);
ALTER TABLE "tabFlansa Application" ADD COLUMN tenant_id VARCHAR(140);
ALTER TABLE "tabFlansa Relationship" ADD COLUMN tenant_id VARCHAR(140);  
ALTER TABLE "tabFlansa Saved Report" ADD COLUMN tenant_id VARCHAR(140);
ALTER TABLE "tabFlansa Form Config" ADD COLUMN tenant_id VARCHAR(140);
```