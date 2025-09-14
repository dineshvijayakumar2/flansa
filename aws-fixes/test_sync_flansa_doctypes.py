#!/usr/bin/env python3
"""
Test Script: Sync Flansa-generated DocTypes by Module Name
Run this manually to test if DocTypes are restored properly
"""
import frappe
import json

print("🧪 TEST: SYNCING FLANSA DOCTYPES BY MODULE", flush=True)
print("=" * 60, flush=True)

try:
    print("Step 1: Searching for DocTypes with module='Flansa Generated'...", flush=True)
    frappe.msgprint("🔍 Searching for Flansa Generated DocTypes...")
    
    # Get all DocTypes with module='Flansa Generated'
    flansa_doctypes = frappe.db.sql("""
        SELECT name, module, custom, istable, is_submittable
        FROM `tabDocType`
        WHERE module = 'Flansa Generated'
        ORDER BY name
    """, as_dict=True)
    
    if not flansa_doctypes:
        print("⚠️ No DocTypes found with module='Flansa Generated'", flush=True)
        frappe.msgprint("⚠️ No Flansa Generated DocTypes found")
        
        # Let's check what modules exist
        print("\n📊 Checking all available modules with custom DocTypes...", flush=True)
        all_modules = frappe.db.sql("""
            SELECT DISTINCT module, COUNT(*) as count
            FROM `tabDocType`
            WHERE custom = 1
            GROUP BY module
            ORDER BY count DESC
            LIMIT 10
        """, as_dict=True)
        
        if all_modules:
            print("Found custom DocTypes in these modules:", flush=True)
            for mod in all_modules:
                print(f"   • {mod.module}: {mod.count} DocTypes", flush=True)
                frappe.msgprint(f"Module: {mod.module} has {mod.count} custom DocTypes")
        
        # Also check for DocTypes that might be Flansa (by name pattern)
        print("\n🔍 Checking for DocTypes that might be Flansa (various patterns)...", flush=True)
        potential_patterns = [
            "name LIKE 'FLS_%'",
            "name LIKE 'T_%'",
            "name REGEXP '^[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$'"  # workspace_app_table pattern
        ]
        
        for pattern in potential_patterns:
            count = frappe.db.sql(f"""
                SELECT COUNT(*) as count
                FROM `tabDocType`
                WHERE {pattern}
            """)[0][0]
            
            if count > 0:
                print(f"   • Pattern '{pattern}': {count} DocTypes found", flush=True)
                
                # Show first 3 examples
                examples = frappe.db.sql(f"""
                    SELECT name, module
                    FROM `tabDocType`
                    WHERE {pattern}
                    LIMIT 3
                """, as_dict=True)
                
                for ex in examples:
                    print(f"      Example: {ex.name} (Module: {ex.module})", flush=True)
    else:
        print(f"✅ Found {len(flansa_doctypes)} DocTypes in 'Flansa Generated' module:", flush=True)
        frappe.msgprint(f"✅ Found {len(flansa_doctypes)} Flansa Generated DocTypes")
        
        # Show first 5 and last 2 for preview
        preview_count = min(7, len(flansa_doctypes))
        for i, dt in enumerate(flansa_doctypes[:preview_count]):
            table_type = "Child Table" if dt.istable else "DocType"
            submittable = " (Submittable)" if dt.is_submittable else ""
            print(f"   {i+1}. {dt.name} [{table_type}{submittable}]", flush=True)
        
        if len(flansa_doctypes) > preview_count:
            print(f"   ... and {len(flansa_doctypes) - preview_count} more", flush=True)
        
        print("\nStep 2: Testing sync process...", flush=True)
        frappe.msgprint("🔄 Starting sync process...")
        
        synced_count = 0
        failed_count = 0
        failed_names = []
        
        for doctype_data in flansa_doctypes:
            try:
                # Clear cache for this specific DocType
                frappe.clear_cache(doctype=doctype_data.name)
                
                # Try to load the DocType
                doctype = frappe.get_doc("DocType", doctype_data.name)
                
                # Force cache refresh
                frappe.cache().hdel("doctype_cache", doctype_data.name)
                frappe.cache().hdel("doctype_json", doctype_data.name)
                
                synced_count += 1
                
            except Exception as e:
                failed_count += 1
                failed_names.append(doctype_data.name)
                print(f"   ⚠️ Failed: {doctype_data.name} - {str(e)}", flush=True)
        
        print(f"\n📊 Sync Results:", flush=True)
        print(f"   ✅ Successfully synced: {synced_count}/{len(flansa_doctypes)}", flush=True)
        if failed_count > 0:
            print(f"   ❌ Failed to sync: {failed_count}", flush=True)
            print(f"      Failed DocTypes: {', '.join(failed_names[:3])}", flush=True)
        
        frappe.msgprint(f"✅ Synced {synced_count} of {len(flansa_doctypes)} DocTypes")
        
        print("\nStep 3: Clearing Frappe caches...", flush=True)
        
        # Clear all relevant caches
        frappe.clear_cache()
        frappe.cache().delete_value("app_modules")
        frappe.cache().delete_value("doctype_map")
        frappe.cache().delete_value("table_columns")
        frappe.cache().delete_value("module_doctypes")
        
        print("✅ Caches cleared", flush=True)
        frappe.msgprint("✅ Caches cleared")
        
        print("\nStep 4: Verification - Testing DocType accessibility...", flush=True)
        
        # Test if we can actually access the DocTypes
        test_count = min(3, len(flansa_doctypes))
        accessible = 0
        
        for i in range(test_count):
            dt_name = flansa_doctypes[i].name
            try:
                # Try to get metadata
                meta = frappe.get_meta(dt_name)
                if meta:
                    accessible += 1
                    print(f"   ✅ {dt_name}: Accessible (fields: {len(meta.fields)})", flush=True)
                    
                    # Try to count records
                    count = frappe.db.count(dt_name)
                    print(f"      Records in table: {count}", flush=True)
                    
            except Exception as e:
                print(f"   ❌ {dt_name}: Not accessible - {str(e)}", flush=True)
        
        if accessible == test_count:
            print("\n🎉 SUCCESS! All tested DocTypes are accessible!", flush=True)
            frappe.msgprint("🎉 SUCCESS! DocTypes are accessible!")
        else:
            print(f"\n⚠️ Partial success: {accessible}/{test_count} DocTypes accessible", flush=True)
            frappe.msgprint(f"⚠️ Partial: {accessible}/{test_count} accessible")
        
        print("\n📋 FINAL SUMMARY:", flush=True)
        print("-" * 50, flush=True)
        print(f"Total DocTypes found: {len(flansa_doctypes)}", flush=True)
        print(f"Successfully synced: {synced_count}", flush=True)
        print(f"Failed to sync: {failed_count}", flush=True)
        print(f"Verified accessible: {accessible}/{test_count}", flush=True)
        
        print("\n💡 NEXT STEPS TO TEST:", flush=True)
        print("-" * 50, flush=True)
        print("1. Refresh your browser (Ctrl+Shift+R)", flush=True)
        print("2. Go to Desk → Explore → DocType List", flush=True)
        print("3. Search for module 'Flansa Generated'", flush=True)
        print("4. Check if DocTypes appear in the list", flush=True)
        print("\nAlternatively:", flush=True)
        print("• Navigate to any Flansa Table", flush=True)
        print("• Try to open its records", flush=True)
        
        frappe.msgprint("💡 Now refresh browser and check DocType list!")
        
except Exception as e:
    error_msg = f"❌ Script error: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = traceback.format_exc()
    print(f"🔍 Error details:\n{details}", flush=True)

print("\n" + "=" * 60, flush=True)
print("🧪 TEST SCRIPT COMPLETE", flush=True)
frappe.msgprint("🧪 Test complete - check console for details")