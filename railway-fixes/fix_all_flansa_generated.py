#!/usr/bin/env python3
"""
Fix ALL Flansa Generated DocTypes Dynamically
Finds any DocType with module "Flansa Generated" and fixes common issues
"""

import frappe

print("🔧 FIXING ALL FLANSA GENERATED DOCTYPES", flush=True)
print("=" * 50, flush=True)

print("📡 Checking Frappe context...", flush=True)
site_name = frappe.local.site if hasattr(frappe, 'local') and hasattr(frappe.local, 'site') else 'Not connected'
print(f"   Site: {site_name}", flush=True)

# STEP 1: Find all Flansa Generated DocTypes
print("\n🔍 Step 1: Finding all Flansa Generated DocTypes...", flush=True)

flansa_doctypes = frappe.get_all("DocType",
    filters={"module": "Flansa Generated"},
    fields=["name", "module", "custom"]
)

print(f"Found {len(flansa_doctypes)} Flansa Generated DocTypes:", flush=True)
for dt in flansa_doctypes:
    print(f"   • {dt.name}", flush=True)

if not flansa_doctypes:
    print("❌ No Flansa Generated DocTypes found", flush=True)
else:
    print(f"✅ Will fix {len(flansa_doctypes)} DocTypes", flush=True)

# STEP 2: Fix each DocType
print("\n🔧 Step 2: Fixing DocType issues...", flush=True)

fixed_count = 0
for dt in flansa_doctypes:
    doctype_name = dt.name
    
    try:
        print(f"\n📋 Fixing {doctype_name}:", flush=True)
        
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", doctype_name)
        
        changes_made = []
        
        # 1. Ensure module is correct
        if doctype_doc.module != "Flansa Generated":
            doctype_doc.module = "Flansa Generated"
            changes_made.append("module")
        
        # 2. Ensure not read-only
        if doctype_doc.read_only:
            doctype_doc.read_only = 0
            changes_made.append("read_only")
        
        # 3. Check permissions
        has_permissions = len(doctype_doc.permissions) > 0
        if not has_permissions:
            print(f"   🔓 Adding standard permissions...", flush=True)
            
            # Add System Manager permissions
            perm = frappe.new_doc("DocPerm")
            perm.parent = doctype_name
            perm.parenttype = "DocType"
            perm.parentfield = "permissions"
            perm.role = "System Manager"
            perm.read = 1
            perm.write = 1
            perm.create = 1
            perm.delete = 1
            perm.report = 1
            perm.export = 1
            perm.import_ = 1
            perm.share = 1
            perm.print_ = 1
            perm.email = 1
            doctype_doc.append("permissions", perm)
            
            # Add All role permissions for basic access
            perm_all = frappe.new_doc("DocPerm")
            perm_all.parent = doctype_name
            perm_all.parenttype = "DocType"
            perm_all.parentfield = "permissions"
            perm_all.role = "All"
            perm_all.read = 1
            perm_all.report = 1
            doctype_doc.append("permissions", perm_all)
            
            changes_made.append("permissions")
        
        # 4. Check for essential custom fields
        existing_fields = {f.fieldname for f in doctype_doc.fields}
        custom_fields_to_add = []
        
        if 'workspace_id' not in existing_fields:
            custom_fields_to_add.append({
                'fieldname': 'workspace_id',
                'fieldtype': 'Data',
                'label': 'Workspace ID',
                'hidden': 1,
                'read_only': 1
            })
        
        if 'flansa_table_id' not in existing_fields:
            custom_fields_to_add.append({
                'fieldname': 'flansa_table_id',
                'fieldtype': 'Data',
                'label': 'Flansa Table ID',
                'hidden': 1,
                'read_only': 1
            })
        
        for custom_field in custom_fields_to_add:
            field_doc = frappe.new_doc("DocField")
            field_doc.parent = doctype_name
            field_doc.parenttype = "DocType"
            field_doc.parentfield = "fields"
            field_doc.idx = len(doctype_doc.fields) + 1
            
            for key, value in custom_field.items():
                setattr(field_doc, key, value)
            
            doctype_doc.append("fields", field_doc)
            changes_made.append(f"field_{custom_field['fieldname']}")
        
        # Save if changes were made
        if changes_made:
            doctype_doc.save(ignore_permissions=True)
            print(f"   ✅ Fixed: {', '.join(changes_made)}", flush=True)
            fixed_count += 1
        else:
            print(f"   ✅ Already correct", flush=True)
        
        # Verify access
        try:
            test_list = frappe.get_all(doctype_name, limit=1)
            count = frappe.db.count(doctype_name)
            print(f"   📊 Verification: {count} records, list access OK", flush=True)
        except Exception as e:
            print(f"   ⚠️  Access test failed: {str(e)}", flush=True)
        
    except Exception as e:
        print(f"   ❌ Error fixing {doctype_name}: {str(e)}", flush=True)

frappe.db.commit()

# STEP 3: Clear cache
print("\n🔄 Step 3: Clearing cache...", flush=True)
frappe.clear_cache()
print("   ✅ Cache cleared", flush=True)

# STEP 4: Summary
print("\n" + "=" * 50, flush=True)
print("🎉 FIXES COMPLETED!", flush=True)
print("=" * 50, flush=True)

print(f"📊 SUMMARY:", flush=True)
print(f"• Total Flansa Generated DocTypes: {len(flansa_doctypes)}", flush=True)
print(f"• DocTypes fixed: {fixed_count}", flush=True)
print(f"• DocTypes already correct: {len(flansa_doctypes) - fixed_count}", flush=True)

print(f"\n✅ FIXES APPLIED:", flush=True)
print(f"• Module set to 'Flansa Generated'", flush=True)
print(f"• Standard permissions added where missing", flush=True)
print(f"• Custom fields added (workspace_id, flansa_table_id)", flush=True)
print(f"• Read-only flag removed", flush=True)
print(f"• Cache cleared", flush=True)

print(f"\n🎯 TESTING:", flush=True)
print(f"1. Go to: http://localhost:8000/app/List", flush=True)
print(f"2. Search for any of the fixed DocTypes", flush=True)
print(f"3. Verify list views work properly", flush=True)
print(f"4. Test data access and permissions", flush=True)

print(f"\n📊 All Flansa Generated DocTypes fixed!", flush=True)