#!/usr/bin/env python3
"""
Railway Bench Migrate Commands for Containerized Environment
Alternative approaches to run bench migrate in Railway's containerized setup
"""

import frappe
import os

print("🚀 RAILWAY BENCH MIGRATE ALTERNATIVES", flush=True)
print("=" * 50, flush=True)
print(f"📍 Site: {getattr(frappe.local, 'site', 'Unknown')}", flush=True)

def approach_1_direct_migration():
    """Approach 1: Direct migration using Frappe's internal functions"""
    
    print("\n🔧 APPROACH 1: DIRECT MIGRATION", flush=True)
    print("-" * 30, flush=True)
    
    try:
        # Set migration flag
        frappe.flags.in_migrate = True
        
        print("📋 Commands to run manually:", flush=True)
        print("", flush=True)
        print("# 1. Run patches", flush=True)
        print("from frappe.modules.patch_handler import run_all", flush=True)
        print("run_all()", flush=True)
        print("", flush=True)
        print("# 2. Sync DocTypes", flush=True)
        print("from frappe.model.sync import sync_for", flush=True)
        print("sync_for('frappe')", flush=True)
        print("sync_for('flansa')", flush=True)
        print("", flush=True)
        print("# 3. Build search index", flush=True)
        print("try:", flush=True)
        print("    from frappe.search import build_search_index", flush=True)
        print("    build_search_index()", flush=True)
        print("except:", flush=True)
        print("    print('Search index build skipped')", flush=True)
        print("", flush=True)
        print("# 4. Clear cache and commit", flush=True)
        print("frappe.clear_cache()", flush=True)
        print("frappe.db.commit()", flush=True)
        
        frappe.flags.in_migrate = False
        
    except Exception as e:
        frappe.flags.in_migrate = False
        print(f"❌ Error in approach 1: {str(e)}", flush=True)

def approach_2_sql_patches():
    """Approach 2: Check and run SQL patches manually"""
    
    print("\n🔧 APPROACH 2: MANUAL PATCH EXECUTION", flush=True)
    print("-" * 35, flush=True)
    
    try:
        # Check patch status
        patches = frappe.db.sql("""
            SELECT patch_name, executed 
            FROM "tabPatch Log" 
            WHERE executed = 0 
            ORDER BY patch_name
        """, as_dict=True)
        
        print(f"📊 Found {len(patches)} unexecuted patches:", flush=True)
        for patch in patches[:10]:  # Show first 10
            print(f"   • {patch.patch_name}", flush=True)
        
        if len(patches) > 10:
            print(f"   ... and {len(patches) - 10} more", flush=True)
        
        print("", flush=True)
        print("📋 To execute patches manually:", flush=True)
        print("from frappe.modules.patch_handler import execute_patch", flush=True)
        print("# Then for each patch:", flush=True)
        print("# execute_patch('patch_name_here')", flush=True)
        
    except Exception as e:
        print(f"❌ Error checking patches: {str(e)}", flush=True)

def approach_3_schema_sync():
    """Approach 3: Schema sync without full migration"""
    
    print("\n🔧 APPROACH 3: SCHEMA SYNC ONLY", flush=True)
    print("-" * 30, flush=True)
    
    try:
        print("📋 Commands for schema sync only:", flush=True)
        print("", flush=True)
        print("# Sync specific app DocTypes", flush=True)
        print("from frappe.model.sync import sync_for", flush=True)
        print("", flush=True)
        print("# Sync frappe core", flush=True)
        print("sync_for('frappe')", flush=True)
        print("", flush=True)
        print("# Sync flansa app", flush=True)
        print("sync_for('flansa')", flush=True)
        print("", flush=True)
        print("# Clear cache", flush=True)
        print("frappe.clear_cache()", flush=True)
        print("frappe.db.commit()", flush=True)
        
    except Exception as e:
        print(f"❌ Error in approach 3: {str(e)}", flush=True)

def approach_4_docker_exec():
    """Approach 4: Using docker exec approach"""
    
    print("\n🔧 APPROACH 4: DOCKER EXEC COMMANDS", flush=True)
    print("-" * 35, flush=True)
    
    print("🐳 If you have access to Railway container directly:", flush=True)
    print("", flush=True)
    print("# Option A: Force migrate without service checks", flush=True)
    print("export FRAPPE_SITE_NAME='flansa-production-4543.up.railway.app'", flush=True)
    print("cd /home/frappe/frappe-bench", flush=True)
    print("python -c \"import frappe; frappe.init('flansa-production-4543.up.railway.app'); frappe.connect(); from frappe.modules.patch_handler import run_all; run_all()\"", flush=True)
    print("", flush=True)
    print("# Option B: Set environment to skip service checks", flush=True)
    print("export FRAPPE_SKIP_REDIS_CONFIG_GENERATION=1", flush=True)
    print("export FRAPPE_SKIP_NGINX_CONFIG_GENERATION=1", flush=True)
    print("bench migrate --site flansa-production-4543.up.railway.app", flush=True)
    print("", flush=True)
    print("# Option C: Direct Python migration", flush=True)
    print("cd /home/frappe/frappe-bench", flush=True)
    print("python -m frappe.cli migrate --site flansa-production-4543.up.railway.app", flush=True)

def approach_5_custom_migrate():
    """Approach 5: Custom migrate function"""
    
    print("\n🔧 APPROACH 5: CUSTOM MIGRATE FUNCTION", flush=True)
    print("-" * 40, flush=True)
    
    print("📋 Complete custom migration function:", flush=True)
    print("", flush=True)
    print("def custom_migrate():", flush=True)
    print("    import frappe", flush=True)
    print("    from frappe.modules.patch_handler import run_all", flush=True)
    print("    from frappe.model.sync import sync_for", flush=True)
    print("    ", flush=True)
    print("    try:", flush=True)
    print("        frappe.flags.in_migrate = True", flush=True)
    print("        ", flush=True)
    print("        # Run patches", flush=True)
    print("        print('Running patches...')", flush=True)
    print("        run_all()", flush=True)
    print("        ", flush=True)
    print("        # Sync apps", flush=True)
    print("        for app in frappe.get_installed_apps():", flush=True)
    print("            print(f'Syncing {app}...')", flush=True)
    print("            sync_for(app)", flush=True)
    print("        ", flush=True)
    print("        # Commit and clear cache", flush=True)
    print("        frappe.db.commit()", flush=True)
    print("        frappe.clear_cache()", flush=True)
    print("        ", flush=True)
    print("        print('Migration completed!')", flush=True)
    print("        return True", flush=True)
    print("        ", flush=True)
    print("    except Exception as e:", flush=True)
    print("        print(f'Migration failed: {str(e)}')", flush=True)
    print("        frappe.db.rollback()", flush=True)
    print("        return False", flush=True)
    print("    finally:", flush=True)
    print("        frappe.flags.in_migrate = False", flush=True)
    print("", flush=True)
    print("# Then run: custom_migrate()", flush=True)

# Show all approaches
print("🎯 AVAILABLE MIGRATION APPROACHES FOR RAILWAY", flush=True)
approach_1_direct_migration()
approach_2_sql_patches()
approach_3_schema_sync()
approach_4_docker_exec()
approach_5_custom_migrate()

print("\n" + "=" * 50, flush=True)
print("🎉 MIGRATION APPROACH GUIDE COMPLETED", flush=True)
print("✅ Choose the approach that works best for your Railway setup", flush=True)
print("🚀 Most recommended: Approach 1 (Direct Migration) or Approach 5 (Custom Function)", flush=True)
print("=" * 50, flush=True)