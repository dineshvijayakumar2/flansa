# DocType Migration for Railway Deployment

## 🎯 Purpose
Migrate existing `Trackers_Expenses` and `Trackers_ExpenseCategories` DocTypes to new ID-based naming convention with proper multi-tenant architecture.

## 📦 Migration Scripts Included

### 1. **import_fields_and_recreate.py**
- **Purpose**: Main migration script that extracts fields from original DocTypes and recreates them with new naming
- **What it does**:
  - Extracts field definitions from `Trackers_Expenses` and `Trackers_ExpenseCategories`  
  - Creates new DocTypes with ID-based naming (e.g., `tenant_f41h2vd9_fe193klo`)
  - Migrates all existing data preserving records
  - Updates Flansa Table references
- **Usage**: `exec(open('railway-fixes/import_fields_and_recreate.py').read())`

### 2. **fix_doctype_issues.py** 
- **Purpose**: Fixes post-migration issues like permissions, module names, custom fields
- **What it does**:
  - Changes module from "Flansa Core" to "Flansa Generated"
  - Adds proper permissions for list view access
  - Creates custom fields (tenant_id, flansa_table_id)
  - Clears cache and refreshes DocTypes
- **Usage**: `exec(open('railway-fixes/fix_doctype_issues.py').read())`

### 3. **migrate_doctypes_simple.py**
- **Purpose**: Alternative simplified migration script (backup option)
- **Usage**: If the main migration fails, use this as fallback

## 🚀 Railway Deployment Steps

### Step 1: Access Railway Console
```bash
# Connect to your Railway PostgreSQL service console
railway shell
```

### Step 2: Navigate to App Directory  
```bash
cd frappe-bench/apps/flansa
```

### Step 3: Start Frappe Console
```bash
bench --site [your-site-name] console
```

### Step 4: Run Migration Scripts
```python
# Step 1: Main migration (extract fields and recreate DocTypes)
exec(open('docker-setup/railway-fixes/import_fields_and_recreate.py').read())

# Step 2: Fix issues (permissions, module name, custom fields)
exec(open('docker-setup/railway-fixes/fix_doctype_issues.py').read())
```

### Step 5: Verify Migration Success
```python
# Check new DocTypes exist with fields
frappe.db.exists("DocType", "your_new_doctype_name")
frappe.get_meta("your_new_doctype_name").fields

# Check data migrated
frappe.db.count("your_new_doctype_name")

# Test list access
frappe.get_all("your_new_doctype_name", limit=1)
```

## ✅ Expected Results

### Before Migration:
- `Trackers_Expenses` and `Trackers_ExpenseCategories` with old naming
- Inconsistent tenant prefixes
- Data in old DocTypes

### After Migration:
- New DocTypes with ID-based naming (e.g., `testtenant_f41h2vd9_fe193klo`)
- Consistent tenant prefixes for same application
- All data migrated to new DocTypes
- Proper permissions and list view access
- Module set to "Flansa Generated"
- Custom fields for tenant isolation

## 🔍 Verification Steps

1. **Check DocTypes Created**:
   - Go to `/app/List` and search for new DocType names
   - Verify fields are present and data is visible

2. **Test Report Viewer**:
   - Access: `/app/flansa-report-viewer/[table-id]?type=table`
   - Should work without SQL field errors

3. **Check Flansa Tables**:
   - Verify `doctype_name` field is updated with new names
   - Confirm `tenant_id` is properly set

## 🛠️ Troubleshooting

### If Migration Fails:
1. Check original DocTypes exist: `frappe.db.exists("DocType", "Trackers_Expenses")`
2. Verify Flansa Tables exist: `frappe.get_all("Flansa Table", filters={"application": "f41h2vd9ki"})`
3. Use the simple migration as backup: `migrate_doctypes_simple.py`

### If List Views Don't Work:
- Re-run `fix_doctype_issues.py`
- Clear cache: `frappe.clear_cache()`
- Check permissions in DocType

### If Data Missing:
- Check migration counts in script output
- Verify field mapping between old and new DocTypes
- Test data queries manually

## 📊 Multi-Tenant Benefits

After migration, you'll have:
- ✅ **Consistent Naming**: All tables in same app use same tenant prefix
- ✅ **Row-Level Security**: Tenant isolation enforced automatically  
- ✅ **Scalable Architecture**: Ready for thousands of tenants
- ✅ **Data Integrity**: All existing records preserved
- ✅ **Report Compatibility**: Works with Flansa Report Viewer

## 🔄 Railway-Specific Notes

- **PostgreSQL Compatible**: All scripts work with Railway's PostgreSQL service
- **Production Safe**: Includes proper error handling and rollback capabilities  
- **Zero Downtime**: Migration preserves existing data throughout process
- **Environment Agnostic**: Same scripts work on local development and Railway production

---

**Created**: August 27, 2025  
**For**: Flansa Multi-Tenant DocType Migration  
**Railway Ready**: ✅