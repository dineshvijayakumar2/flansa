#!/usr/bin/env python3
"""
Recreate missing DocType records from existing Flansa Tables
The tables exist in DB but DocType metadata is missing
"""
import frappe
import json

print("🔧 RECREATING MISSING DOCTYPE RECORDS", flush=True)
print("=" * 60, flush=True)

try:
    # Get all Flansa Tables with DocType references
    flansa_tables = frappe.db.sql("""
        SELECT name, table_name, doctype_name, application
        FROM `tabFlansa Table`
        WHERE doctype_name IS NOT NULL 
        AND doctype_name != ''
        ORDER BY name
    """, as_dict=True)
    
    print(f"Found {len(flansa_tables)} Flansa Tables to process", flush=True)
    
    recreated_count = 0
    skipped_count = 0
    failed_count = 0
    
    for table_record in flansa_tables:
        print(f"\n📋 Processing: {table_record.table_name}", flush=True)
        print(f"   DocType: {table_record.doctype_name}", flush=True)
        
        # Check if DocType record exists
        if frappe.db.exists("DocType", table_record.doctype_name):
            print(f"   ✅ DocType already exists, skipping", flush=True)
            skipped_count += 1
            continue
        
        # Check if the table exists in database
        if not frappe.db.table_exists(table_record.doctype_name):
            print(f"   ⚠️ Table doesn't exist, cannot recreate", flush=True)
            failed_count += 1
            continue
        
        try:
            print(f"   🔄 Recreating DocType record...", flush=True)
            
            # Get the Flansa Table document
            flansa_table = frappe.get_doc("Flansa Table", table_record.name)
            
            # Get fields from Flansa Field
            fields = frappe.get_all(
                "Flansa Field",
                filters={"parent_table": table_record.name},
                fields=["field_name", "field_label", "field_type", "is_required", 
                        "field_options", "in_list_view", "in_standard_filter"],
                order_by="display_order"
            )
            
            print(f"   Found {len(fields)} fields", flush=True)
            
            # Create DocType document
            doctype = frappe.new_doc("DocType")
            doctype.name = table_record.doctype_name
            doctype.module = "Flansa Generated"
            doctype.custom = 1
            doctype.is_virtual = 0
            doctype.issingle = 0
            doctype.istable = 0
            doctype.editable_grid = 1
            doctype.track_changes = 1
            doctype.track_seen = 0
            doctype.track_views = 0
            doctype.allow_rename = 1
            doctype.quick_entry = 1
            doctype.search_fields = "name"
            doctype.sort_field = "modified"
            doctype.sort_order = "DESC"
            doctype.title_field = "name"
            
            # Add naming rule
            doctype.autoname = "hash"
            doctype.naming_rule = "Random"
            
            # Add fields
            for field_data in fields:
                field = doctype.append("fields", {})
                field.fieldname = field_data.field_name
                field.label = field_data.field_label or field_data.field_name
                field.fieldtype = field_data.field_type
                field.reqd = field_data.is_required
                field.in_list_view = field_data.in_list_view
                field.in_standard_filter = field_data.in_standard_filter
                
                if field_data.field_options:
                    field.options = field_data.field_options
            
            # Add standard fields if not present
            field_names = [f.field_name for f in fields]
            
            # Add name field if not present
            if "name" not in field_names:
                name_field = doctype.append("fields", {})
                name_field.fieldname = "name"
                name_field.label = "Name"
                name_field.fieldtype = "Data"
                name_field.reqd = 1
                name_field.in_list_view = 1
                name_field.bold = 1
            
            # Add permissions
            perm = doctype.append("permissions", {})
            perm.role = "System Manager"
            perm.read = 1
            perm.write = 1
            perm.create = 1
            perm.delete = 1
            perm.submit = 0
            perm.cancel = 0
            perm.amend = 0
            perm.print = 1
            perm.email = 1
            perm.export = 1
            setattr(perm, 'import', 1)  # import is a reserved keyword
            perm.share = 1
            perm.report = 1
            
            # Save the DocType (don't use insert as it might try to create table)
            doctype.db_insert()
            frappe.db.commit()
            
            print(f"   ✅ DocType recreated successfully!", flush=True)
            recreated_count += 1
            
            # Clear cache for this DocType
            frappe.clear_cache(doctype=table_record.doctype_name)
            
        except Exception as e:
            print(f"   ❌ Failed to recreate: {str(e)}", flush=True)
            failed_count += 1
            frappe.db.rollback()
    
    # Clear global caches
    print("\n🔄 Clearing Frappe caches...", flush=True)
    frappe.clear_cache()
    frappe.cache().delete_value("app_modules")
    frappe.cache().delete_value("doctype_map")
    frappe.cache().delete_value("table_columns")
    frappe.cache().delete_value("module_doctypes")
    
    print("\n📊 SUMMARY:", flush=True)
    print("=" * 60, flush=True)
    print(f"✅ Recreated: {recreated_count} DocTypes", flush=True)
    print(f"⏭️  Skipped (already exist): {skipped_count} DocTypes", flush=True)
    print(f"❌ Failed: {failed_count} DocTypes", flush=True)
    
    if recreated_count > 0:
        print("\n🎉 SUCCESS! DocTypes have been recreated!", flush=True)
        print("\n💡 NEXT STEPS:", flush=True)
        print("1. Refresh your browser (Ctrl+Shift+R)", flush=True)
        print("2. Navigate to the Flansa Tables", flush=True)
        print("3. DocTypes should now be accessible", flush=True)
        frappe.msgprint(f"✅ Recreated {recreated_count} DocTypes successfully!")
    
except Exception as e:
    error_msg = f"❌ Script error: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = traceback.format_exc()
    print(f"🔍 Error details:\n{details}", flush=True)

print("\n" + "=" * 60, flush=True)
print("🔄 RECREATION COMPLETE", flush=True)
frappe.msgprint("🔄 DocType recreation complete")