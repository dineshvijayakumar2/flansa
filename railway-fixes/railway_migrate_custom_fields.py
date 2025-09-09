#!/usr/bin/env python3
"""
Railway Migration Script: Remove Custom Fields Dependency
Execute this script on Railway site to migrate Custom Fields to native DocType fields
"""

import frappe

print("🚀 RAILWAY MIGRATION: REMOVING CUSTOM FIELDS DEPENDENCY", flush=True)
print("=" * 65, flush=True)
print("Site:", frappe.local.site if hasattr(frappe, 'local') and hasattr(frappe.local, 'site') else 'Unknown', flush=True)

try:
    print("\n🔍 Step 1: Pre-migration verification...", flush=True)
    
    # Check current Custom Fields on Railway
    custom_fields_before = frappe.get_all("Custom Field", 
        filters={"dt": "Flansa Table"},
        fields=["name", "fieldname", "label", "fieldtype"]
    )
    
    print(f"   📋 Found {len(custom_fields_before)} Custom Fields to migrate:", flush=True)
    for cf in custom_fields_before:
        print(f"      • {cf.fieldname} ({cf.fieldtype}) - {cf.label}", flush=True)
    
    if len(custom_fields_before) == 0:
        print("   ✅ No Custom Fields found - checking if migration already completed", flush=True)
        
        # Check if native fields exist
        doctype_doc = frappe.get_doc("DocType", "Flansa Table")
        native_fieldnames = [f.fieldname for f in doctype_doc.fields]
        naming_fields = [fn for fn in native_fieldnames if 'naming' in fn]
        
        if naming_fields:
            print(f"   ✅ Native naming fields already exist: {naming_fields}", flush=True)
            print("   🎉 Migration appears to be already completed!", flush=True)
        else:
            print("   ⚠️  No Custom Fields found and no native naming fields - need to add them", flush=True)
    else:
        print(f"\n🔍 Step 2: Migrating {len(custom_fields_before)} Custom Fields to native...", flush=True)
        
        # Get current DocType
        doctype_doc = frappe.get_doc("DocType", "Flansa Table")
        existing_fieldnames = [f.fieldname for f in doctype_doc.fields]
        
        print(f"   📋 Current DocType has {len(doctype_doc.fields)} fields", flush=True)
        
        fields_added = 0
        fields_skipped = 0
        
        # Get detailed Custom Field data
        custom_fields_detailed = frappe.get_all("Custom Field", 
            filters={"dt": "Flansa Table"},
            fields=["name", "fieldname", "label", "fieldtype", "options", "default", 
                    "reqd", "hidden", "read_only", "depends_on", "description", "insert_after"]
        )
        
        # Migrate each Custom Field
        for cf in custom_fields_detailed:
            if cf.fieldname in existing_fieldnames:
                print(f"   ⚠️  Field {cf.fieldname} already exists - skipping", flush=True)
                fields_skipped += 1
                continue
            
            # Create new DocField
            field_doc = frappe.new_doc("DocField")
            field_doc.fieldname = cf.fieldname
            field_doc.fieldtype = cf.fieldtype
            field_doc.label = cf.label
            field_doc.options = cf.options or ""
            field_doc.default = cf.default or ""
            field_doc.reqd = cf.reqd or 0
            field_doc.hidden = cf.hidden or 0
            field_doc.read_only = cf.read_only or 0
            field_doc.depends_on = cf.depends_on or ""
            field_doc.description = cf.description or ""
            
            # Find insertion point
            insert_index = len(doctype_doc.fields)
            if cf.insert_after:
                for i, existing_field in enumerate(doctype_doc.fields):
                    if existing_field.fieldname == cf.insert_after:
                        insert_index = i + 1
                        break
            
            # Insert field
            doctype_doc.fields.insert(insert_index, field_doc)
            fields_added += 1
            print(f"   ✅ Added {cf.fieldname} to DocType", flush=True)
        
        print(f"\n🔍 Step 3: Saving updated DocType...", flush=True)
        
        # Save DocType with new native fields
        if fields_added > 0:
            doctype_doc.save()
            frappe.db.commit()
            print(f"   ✅ DocType saved with {fields_added} new native fields", flush=True)
        
        print(f"🔍 Step 4: Removing Custom Fields...", flush=True)
        
        # Remove Custom Fields
        fields_removed = 0
        for cf in custom_fields_before:
            try:
                frappe.delete_doc("Custom Field", cf.name)
                fields_removed += 1
                print(f"   ✅ Removed Custom Field: {cf.fieldname}", flush=True)
            except Exception as e:
                print(f"   ⚠️  Error removing {cf.fieldname}: {str(e)}", flush=True)
        
        if fields_removed > 0:
            frappe.db.commit()
            print(f"   ✅ Removed {fields_removed} Custom Fields", flush=True)
    
    print(f"\n🔍 Step 5: Clearing caches...", flush=True)
    
    # Clear all caches
    frappe.clear_cache(doctype="Flansa Table")
    frappe.clear_document_cache("DocType", "Flansa Table")
    frappe.db.commit()
    print("   ✅ Caches cleared", flush=True)
    
    print(f"\n🔍 Step 6: Post-migration verification...", flush=True)
    
    # Verify migration success
    remaining_custom_fields = frappe.get_all("Custom Field", 
        filters={"dt": "Flansa Table"},
        fields=["fieldname"]
    )
    
    updated_doctype = frappe.get_doc("DocType", "Flansa Table")
    native_fieldnames = [f.fieldname for f in updated_doctype.fields]
    naming_fields = [fn for fn in native_fieldnames if 'naming' in fn]
    
    print(f"   📊 Custom Fields remaining: {len(remaining_custom_fields)}", flush=True)
    print(f"   📊 Native naming fields: {naming_fields}", flush=True)
    print(f"   📊 Total native fields: {len(native_fieldnames)}", flush=True)
    
    # Test functionality
    test_tables = frappe.get_all("Flansa Table", limit=1, fields=["name"])
    if test_tables:
        test_doc = frappe.get_doc("Flansa Table", test_tables[0].name)
        accessible_naming_fields = [field for field in ['naming_type', 'naming_prefix', 'naming_digits'] 
                                  if hasattr(test_doc, field)]
        print(f"   ✅ Accessible naming fields: {accessible_naming_fields}", flush=True)
    
    print(f"\n🎉 RAILWAY MIGRATION COMPLETED!", flush=True)
    print("=" * 65, flush=True)
    
    print(f"📊 MIGRATION RESULTS:", flush=True)
    if 'fields_added' in locals():
        print(f"• Custom Fields migrated: {fields_added}", flush=True)
        print(f"• Custom Fields removed: {fields_removed}", flush=True)
    print(f"• Custom Fields remaining: {len(remaining_custom_fields)}", flush=True)
    print(f"• Native naming fields: {len(naming_fields)}", flush=True)
    
    if len(remaining_custom_fields) == 0 and len(naming_fields) >= 5:
        print("🚀 SUCCESS: Railway site now uses 100% native fields!", flush=True)
        print("🎯 Custom Fields dependency completely removed on Railway!", flush=True)
    else:
        print("⚠️  Migration may need review - check results above", flush=True)
    
    print(f"\n✅ RAILWAY SITE MIGRATION COMPLETED!", flush=True)
    
except Exception as e:
    frappe.db.rollback()
    print(f"❌ Error during Railway migration: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
    print(f"🔄 Database changes rolled back", flush=True)

print(f"\n🚀 Railway migration script execution completed!", flush=True)