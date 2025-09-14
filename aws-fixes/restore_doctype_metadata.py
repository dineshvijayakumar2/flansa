#!/usr/bin/env python3
"""
Restore missing DocType metadata entries
The tables exist in DB (with tab prefix) but DocType records are missing
"""
import frappe
import json

print("🔧 RESTORING DOCTYPE METADATA", flush=True)
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
    
    print(f"Found {len(flansa_tables)} Flansa Tables to check", flush=True)
    
    restored_count = 0
    already_exists = 0
    table_missing = 0
    
    for table_record in flansa_tables:
        print(f"\n📋 Checking: {table_record.table_name}", flush=True)
        print(f"   DocType name: {table_record.doctype_name}", flush=True)
        
        # Check if DocType record exists in tabDocType
        doctype_exists = frappe.db.exists("DocType", table_record.doctype_name)
        
        if doctype_exists:
            print(f"   ✅ DocType metadata already exists", flush=True)
            already_exists += 1
            continue
        
        # Check if the actual table exists in database
        table_name = f"tab{table_record.doctype_name}"
        
        # Use SQL to check if table exists
        table_check = frappe.db.sql("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = %s
        """, table_name)[0][0]
        
        if not table_check:
            print(f"   ⚠️ Table {table_name} doesn't exist in database", flush=True)
            table_missing += 1
            continue
        
        print(f"   ✅ Table {table_name} exists", flush=True)
        
        # Get column information from the existing table
        columns = frappe.db.sql("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            AND table_name = %s
            AND COLUMN_NAME NOT IN ('name', 'creation', 'modified', 'modified_by', 
                                    'owner', 'docstatus', 'idx', '_user_tags', 
                                    '_comments', '_assign', '_liked_by')
            ORDER BY ORDINAL_POSITION
        """, table_name, as_dict=True)
        
        print(f"   Found {len(columns)} custom columns", flush=True)
        
        # Create minimal DocType entry to make Frappe recognize the existing table
        print(f"   🔄 Creating DocType metadata entry...", flush=True)
        
        # Direct SQL insert into tabDocType
        frappe.db.sql("""
            INSERT INTO `tabDocType` 
            (name, module, custom, istable, issingle, is_virtual, 
             editable_grid, track_changes, allow_rename, quick_entry,
             search_fields, sort_field, sort_order, autoname, naming_rule,
             creation, modified, modified_by, owner)
            VALUES 
            (%s, %s, 1, 0, 0, 0, 
             1, 1, 1, 1,
             'name', 'modified', 'DESC', 'hash', 'Random',
             NOW(), NOW(), 'Administrator', 'Administrator')
        """, (table_record.doctype_name, "Flansa Generated"))
        
        # Add basic fields to tabDocField
        field_idx = 1
        
        # Add standard name field
        frappe.db.sql("""
            INSERT INTO `tabDocField`
            (name, parent, parentfield, parenttype, idx, fieldname, 
             label, fieldtype, reqd, in_list_view, bold,
             creation, modified, modified_by, owner)
            VALUES
            (%s, %s, 'fields', 'DocType', %s, 'name',
             'Name', 'Data', 1, 1, 1,
             NOW(), NOW(), 'Administrator', 'Administrator')
        """, (frappe.generate_hash(length=10), table_record.doctype_name, field_idx))
        
        field_idx += 1
        
        # Add fields based on actual table columns
        for col in columns:
            # Determine field type based on database column type
            if 'int' in col.DATA_TYPE.lower():
                fieldtype = 'Int'
            elif 'decimal' in col.DATA_TYPE.lower() or 'float' in col.DATA_TYPE.lower():
                fieldtype = 'Float'
            elif 'date' in col.DATA_TYPE.lower() and 'time' in col.DATA_TYPE.lower():
                fieldtype = 'Datetime'
            elif 'date' in col.DATA_TYPE.lower():
                fieldtype = 'Date'
            elif 'text' in col.DATA_TYPE.lower() or 'long' in col.DATA_TYPE.lower():
                fieldtype = 'Text'
            else:
                fieldtype = 'Data'
            
            # Create field label from column name
            label = col.COLUMN_NAME.replace('_', ' ').title()
            
            frappe.db.sql("""
                INSERT INTO `tabDocField`
                (name, parent, parentfield, parenttype, idx, fieldname,
                 label, fieldtype, reqd,
                 creation, modified, modified_by, owner)
                VALUES
                (%s, %s, 'fields', 'DocType', %s, %s,
                 %s, %s, %s,
                 NOW(), NOW(), 'Administrator', 'Administrator')
            """, (frappe.generate_hash(length=10), table_record.doctype_name, 
                  field_idx, col.COLUMN_NAME, label, fieldtype, 
                  1 if col.IS_NULLABLE == 'NO' else 0))
            
            field_idx += 1
        
        # Add basic permission
        frappe.db.sql("""
            INSERT INTO `tabDocPerm`
            (name, parent, parentfield, parenttype, idx, role,
             `read`, `write`, `create`, `delete`, `submit`, `cancel`,
             `amend`, print, email, export, import, share, report,
             creation, modified, modified_by, owner)
            VALUES
            (%s, %s, 'permissions', 'DocType', 1, 'System Manager',
             1, 1, 1, 1, 0, 0,
             0, 1, 1, 1, 1, 1, 1,
             NOW(), NOW(), 'Administrator', 'Administrator')
        """, (frappe.generate_hash(length=10), table_record.doctype_name))
        
        frappe.db.commit()
        
        print(f"   ✅ DocType metadata restored!", flush=True)
        restored_count += 1
        
        # Clear cache for this DocType
        frappe.clear_cache(doctype=table_record.doctype_name)
    
    # Clear global caches
    print("\n🔄 Clearing Frappe caches...", flush=True)
    frappe.clear_cache()
    frappe.cache().delete_value("app_modules")
    frappe.cache().delete_value("doctype_map")
    frappe.cache().delete_value("table_columns")
    frappe.cache().delete_value("module_doctypes")
    
    print("\n📊 SUMMARY:", flush=True)
    print("=" * 60, flush=True)
    print(f"✅ Restored: {restored_count} DocType metadata entries", flush=True)
    print(f"⏭️  Already exists: {already_exists} DocTypes", flush=True)
    print(f"⚠️  Table missing: {table_missing} DocTypes", flush=True)
    
    if restored_count > 0:
        print("\n🎉 SUCCESS! DocType metadata has been restored!", flush=True)
        print("\n💡 NEXT STEPS:", flush=True)
        print("1. Refresh your browser (Ctrl+Shift+R)", flush=True)
        print("2. Navigate to the Flansa Tables", flush=True)
        print("3. DocTypes should now be accessible", flush=True)
        frappe.msgprint(f"✅ Restored {restored_count} DocType metadata entries!")
    
except Exception as e:
    error_msg = f"❌ Script error: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = traceback.format_exc()
    print(f"🔍 Error details:\n{details}", flush=True)

print("\n" + "=" * 60, flush=True)
print("🔄 RESTORATION COMPLETE", flush=True)
frappe.msgprint("🔄 DocType metadata restoration complete")