#!/usr/bin/env python3
"""
Sync Flansa-generated DocTypes via Flansa Table references
This is the reliable way to find all generated DocTypes
"""
import frappe
import json

print("🔧 SYNCING FLANSA DOCTYPES VIA TABLE REFERENCES", flush=True)
print("=" * 60, flush=True)

try:
    print("Step 1: Getting all Flansa Tables with DocType references...", flush=True)
    frappe.msgprint("🔍 Searching for Flansa Tables...")
    
    # Get all Flansa Tables that have doctype_name references
    flansa_tables = frappe.db.sql("""
        SELECT name, table_name, doctype_name, application
        FROM `tabFlansa Table`
        WHERE doctype_name IS NOT NULL 
        AND doctype_name != ''
        ORDER BY name
    """, as_dict=True)
    
    if not flansa_tables:
        print("⚠️ No Flansa Tables found with DocType references", flush=True)
        frappe.msgprint("⚠️ No Flansa Tables with DocType references found")
        
        # Check if there are any Flansa Tables at all
        all_tables = frappe.db.sql("""
            SELECT COUNT(*) as count
            FROM `tabFlansa Table`
        """)[0][0]
        
        print(f"Total Flansa Tables in system: {all_tables}", flush=True)
        
        if all_tables > 0:
            print("\n📊 Flansa Tables without DocType references:", flush=True)
            tables_without_doctype = frappe.db.sql("""
                SELECT name, table_name
                FROM `tabFlansa Table`
                WHERE (doctype_name IS NULL OR doctype_name = '')
                LIMIT 5
            """, as_dict=True)
            
            for table in tables_without_doctype:
                print(f"   • {table.name} ({table.table_name})", flush=True)
    else:
        print(f"✅ Found {len(flansa_tables)} Flansa Tables with DocType references:", flush=True)
        frappe.msgprint(f"✅ Found {len(flansa_tables)} Flansa Tables with DocTypes")
        
        # Show first few tables
        preview_count = min(5, len(flansa_tables))
        for i, table in enumerate(flansa_tables[:preview_count]):
            print(f"   {i+1}. Table: {table.table_name}", flush=True)
            print(f"      DocType: {table.doctype_name}", flush=True)
        
        if len(flansa_tables) > preview_count:
            print(f"   ... and {len(flansa_tables) - preview_count} more", flush=True)
        
        print("\nStep 2: Checking which DocTypes exist in database...", flush=True)
        
        existing_doctypes = []
        missing_doctypes = []
        
        for table in flansa_tables:
            if frappe.db.exists("DocType", table.doctype_name):
                existing_doctypes.append(table)
            else:
                missing_doctypes.append(table)
        
        print(f"\n📊 DocType Status:", flush=True)
        print(f"   ✅ Existing DocTypes: {len(existing_doctypes)}", flush=True)
        print(f"   ❌ Missing DocTypes: {len(missing_doctypes)}", flush=True)
        frappe.msgprint(f"Found {len(existing_doctypes)} existing DocTypes")
        
        if missing_doctypes:
            print("\n⚠️ Missing DocTypes (need to be recreated):", flush=True)
            for table in missing_doctypes[:5]:
                print(f"   • {table.doctype_name} (Table: {table.table_name})", flush=True)
        
        if existing_doctypes:
            print("\nStep 3: Syncing existing DocTypes to Frappe cache...", flush=True)
            frappe.msgprint("Syncing DocTypes to cache...")
            
            synced_count = 0
            failed_count = 0
            
            for table in existing_doctypes:
                try:
                    # Clear cache for this specific DocType
                    frappe.clear_cache(doctype=table.doctype_name)
                    
                    # Load the DocType to ensure it's in memory
                    doctype = frappe.get_doc("DocType", table.doctype_name)
                    
                    # Force cache refresh
                    frappe.cache().hdel("doctype_cache", table.doctype_name)
                    frappe.cache().hdel("doctype_json", table.doctype_name)
                    
                    # Update the module if needed
                    if doctype.module != "Flansa Generated":
                        print(f"   📝 Updating module for {table.doctype_name}: {doctype.module} → Flansa Generated", flush=True)
                        frappe.db.set_value("DocType", table.doctype_name, "module", "Flansa Generated")
                    
                    synced_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    print(f"   ⚠️ Failed: {table.doctype_name} - {str(e)}", flush=True)
            
            print(f"\n✅ Successfully synced: {synced_count}/{len(existing_doctypes)}", flush=True)
            if failed_count > 0:
                print(f"❌ Failed to sync: {failed_count}", flush=True)
            
            frappe.msgprint(f"✅ Synced {synced_count} DocTypes")
            
            print("\nStep 4: Clearing Frappe caches...", flush=True)
            
            # Clear all relevant caches
            frappe.clear_cache()
            frappe.cache().delete_value("app_modules")
            frappe.cache().delete_value("doctype_map")
            frappe.cache().delete_value("table_columns")
            frappe.cache().delete_value("module_doctypes")
            
            print("✅ Caches cleared", flush=True)
            
            print("\nStep 5: Testing DocType accessibility...", flush=True)
            
            # Test a few DocTypes
            test_count = min(3, len(existing_doctypes))
            accessible = 0
            
            for i in range(test_count):
                dt_name = existing_doctypes[i].doctype_name
                try:
                    # Try to get metadata
                    meta = frappe.get_meta(dt_name)
                    if meta:
                        accessible += 1
                        field_count = len(meta.fields)
                        print(f"   ✅ {dt_name}: Accessible ({field_count} fields)", flush=True)
                        
                        # Try to count records
                        try:
                            count = frappe.db.count(dt_name)
                            print(f"      Records: {count}", flush=True)
                        except:
                            print(f"      Records: Unable to count", flush=True)
                        
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
        print(f"Total Flansa Tables: {len(flansa_tables)}", flush=True)
        print(f"DocTypes Existing: {len(existing_doctypes)}", flush=True)
        print(f"DocTypes Missing: {len(missing_doctypes)}", flush=True)
        print(f"Successfully Synced: {synced_count if existing_doctypes else 0}", flush=True)
        
        if missing_doctypes:
            print("\n⚠️ ACTION REQUIRED:", flush=True)
            print(f"{len(missing_doctypes)} DocTypes need to be recreated", flush=True)
            print("These tables need their DocTypes regenerated", flush=True)
            frappe.msgprint(f"⚠️ {len(missing_doctypes)} DocTypes need regeneration")
        
        print("\n💡 NEXT STEPS:", flush=True)
        print("-" * 50, flush=True)
        print("1. Refresh your browser (Ctrl+Shift+R)", flush=True)
        print("2. Navigate to any Flansa Table", flush=True)
        print("3. Try to open its records", flush=True)
        
        if missing_doctypes:
            print("\nFor missing DocTypes:", flush=True)
            print("• Activate the tables to regenerate DocTypes", flush=True)
            print("• Or run regenerate_doctype() on each table", flush=True)
        
        frappe.msgprint("💡 Refresh browser and check DocType access!")
        
except Exception as e:
    error_msg = f"❌ Script error: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = traceback.format_exc()
    print(f"🔍 Error details:\n{details}", flush=True)

print("\n" + "=" * 60, flush=True)
print("🔄 SYNC COMPLETE", flush=True)
frappe.msgprint("🔄 Sync complete - check console for details")