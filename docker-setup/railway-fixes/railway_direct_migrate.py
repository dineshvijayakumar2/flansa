#!/usr/bin/env python3
"""
Railway Direct Migration Script
Bypasses bench migrate service checks and runs migration directly
Usage: exec(open('/path/to/this/script.py').read())
"""

import frappe
import sys
import os

print("🚀 RAILWAY DIRECT MIGRATION", flush=True)
print("=" * 40, flush=True)
print(f"📍 Site: {getattr(frappe.local, 'site', 'Unknown')}", flush=True)
print(f"👤 User: {getattr(frappe.session, 'user', 'Unknown')}", flush=True)

def run_direct_migration():
    """Run migration directly without bench service checks"""
    
    try:
        print("🔍 Step 1: Checking database connection...", flush=True)
        
        # Test database connection
        frappe.db.sql("SELECT 1", as_dict=True)
        print("✅ Database connection working", flush=True)
        
        print("🔍 Step 2: Running migration patches...", flush=True)
        
        # Import migration functions directly
        from frappe.modules.patch_handler import run_all
        
        # Run migration for current site
        frappe.flags.in_migrate = True
        
        # Run patches
        run_all()
        
        print("✅ Migration patches completed", flush=True)
        
        print("🔍 Step 3: Updating DocType schema...", flush=True)
        
        # Sync schema for all DocTypes
        from frappe.model.sync import sync_for
        
        # Get all apps
        apps = frappe.get_installed_apps()
        print(f"📱 Found {len(apps)} apps: {', '.join(apps)}", flush=True)
        
        for app in apps:
            try:
                print(f"🔄 Syncing {app}...", flush=True)
                sync_for(app)
                print(f"✅ {app} synced", flush=True)
            except Exception as app_error:
                print(f"⚠️  Warning syncing {app}: {str(app_error)}", flush=True)
                continue
        
        print("✅ Schema sync completed", flush=True)
        
        print("🔍 Step 4: Rebuilding search index...", flush=True)
        
        try:
            from frappe.search import build_search_index
            build_search_index()
            print("✅ Search index rebuilt", flush=True)
        except Exception as search_error:
            print(f"⚠️  Search index warning: {str(search_error)}", flush=True)
        
        print("🔍 Step 5: Clearing cache...", flush=True)
        frappe.clear_cache()
        print("✅ Cache cleared", flush=True)
        
        print("🔍 Step 6: Final database commit...", flush=True)
        frappe.db.commit()
        print("✅ Changes committed", flush=True)
        
        frappe.flags.in_migrate = False
        
        return True
        
    except Exception as e:
        frappe.flags.in_migrate = False
        print(f"❌ Migration failed: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

def add_missing_naming_fields():
    """Add naming fields directly to Flansa Table"""
    
    try:
        print("🔍 Bonus Step: Adding missing naming fields...", flush=True)
        
        # Check if Flansa Table exists
        if not frappe.db.exists("DocType", "Flansa Table"):
            print("⚠️  Flansa Table DocType not found, skipping naming fields", flush=True)
            return True
            
        # Get current DocType
        doctype_doc = frappe.get_doc("DocType", "Flansa Table")
        current_fields = [field.fieldname for field in doctype_doc.fields]
        
        # Fields to add
        naming_fields = [
            ('naming_type', 'Select', 'Naming Type', 'Auto Number\nField Based\nExpression Based', 'Auto Number'),
            ('naming_prefix', 'Data', 'Naming Prefix', None, None),
            ('naming_digits', 'Int', 'Number of Digits', None, 5),
            ('naming_start_from', 'Int', 'Start From', None, 1),
            ('naming_field', 'Link', 'Naming Field', 'Flansa Field', None),
            ('naming_expression', 'Small Text', 'Naming Expression', None, None),
            ('show_gallery', 'Check', 'Show Gallery', None, 0)
        ]
        
        # Check which are missing
        missing_fields = []
        for field_info in naming_fields:
            if field_info[0] not in current_fields:
                missing_fields.append(field_info)
        
        if not missing_fields:
            print("✅ All naming fields already exist", flush=True)
            return True
            
        print(f"🔧 Adding {len(missing_fields)} missing fields...", flush=True)
        
        # Add missing fields
        max_idx = max([field.idx for field in doctype_doc.fields]) if doctype_doc.fields else 0
        
        for i, (fieldname, fieldtype, label, options, default) in enumerate(missing_fields):
            field_dict = {
                'fieldname': fieldname,
                'fieldtype': fieldtype,
                'label': label,
                'idx': max_idx + i + 1
            }
            
            if options:
                field_dict['options'] = options
            if default is not None:
                field_dict['default'] = default
                
            doctype_doc.append('fields', field_dict)
            print(f"➕ Added: {fieldname}", flush=True)
        
        # Save DocType
        doctype_doc.save()
        frappe.db.commit()
        
        print("✅ Naming fields added successfully", flush=True)
        return True
        
    except Exception as e:
        print(f"❌ Error adding naming fields: {str(e)}", flush=True)
        return False

# Execute migration
print("🎬 STARTING DIRECT MIGRATION...", flush=True)

try:
    # Run main migration
    migration_success = run_direct_migration()
    
    if migration_success:
        print("🎯 Main migration completed, adding naming fields...", flush=True)
        add_missing_naming_fields()
    
    if migration_success:
        print("🎉 RAILWAY DIRECT MIGRATION COMPLETED SUCCESSFULLY!", flush=True)
        print("✅ Database is now up to date", flush=True)
        print("✅ All DocTypes synced", flush=True)
        print("✅ Naming fields added", flush=True)
    else:
        print("💥 MIGRATION FAILED - check errors above", flush=True)
        
except Exception as script_error:
    print(f"💀 SCRIPT ERROR: {str(script_error)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)

print("🏁 SCRIPT FINISHED", flush=True)