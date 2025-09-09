#!/usr/bin/env python3
"""
Sync Database Schema to DocType JSON Files
This script detects columns in the database that are missing from DocType JSON definitions
and optionally adds them to the JSON files.

Usage in bench console:
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-docker-setup/aws-fixes/sync_db_to_json.py').read())
"""

import frappe
import json
import os
from frappe.model import no_value_fields

print("🔄 Database to JSON Schema Sync Tool", flush=True)
print("=" * 60, flush=True)

def get_db_columns(table_name):
    """Get all columns from database table"""
    try:
        # Detect database type
        db_type = frappe.db.db_type if hasattr(frappe.db, 'db_type') else 'mariadb'
        
        # For PostgreSQL
        if db_type == 'postgres':
            columns = frappe.db.sql("""
                SELECT column_name, data_type, character_maximum_length, 
                       is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position
            """, (table_name.lower(),), as_dict=1)
        else:
            # For MariaDB/MySQL - use backticks and proper escaping
            columns = frappe.db.sql("""
                SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type,
                       CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
                       IS_NULLABLE as is_nullable, COLUMN_DEFAULT as column_default
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = %s AND TABLE_SCHEMA = DATABASE()
                ORDER BY ORDINAL_POSITION
            """, (table_name,), as_dict=1)
        
        print(f"  🔍 Database type: {db_type}, Found {len(columns)} columns", flush=True)
        return columns
    except Exception as e:
        print(f"❌ Error getting columns for {table_name}: {str(e)}", flush=True)
        print(f"  🔍 Database type attempted: {db_type if 'db_type' in locals() else 'unknown'}", flush=True)
        return []

def get_doctype_fields(doctype_name):
    """Get all fields from DocType definition"""
    try:
        meta = frappe.get_meta(doctype_name)
        return {field.fieldname: field for field in meta.fields}
    except Exception as e:
        print(f"❌ Error getting DocType fields for {doctype_name}: {str(e)}", flush=True)
        return {}

def map_db_type_to_fieldtype(db_type, max_length=None):
    """Map database column type to Frappe fieldtype"""
    db_type = db_type.lower()
    
    # Common mappings
    type_map = {
        'varchar': 'Data',
        'character varying': 'Data',
        'text': 'Text Editor',
        'longtext': 'Text Editor',
        'int': 'Int',
        'integer': 'Int',
        'bigint': 'Int',
        'smallint': 'Int',
        'decimal': 'Float',
        'numeric': 'Float',
        'float': 'Float',
        'double': 'Float',
        'date': 'Date',
        'datetime': 'Datetime',
        'timestamp': 'Datetime',
        'time': 'Time',
        'boolean': 'Check',
        'bool': 'Check',
        'json': 'JSON',
        'jsonb': 'JSON'
    }
    
    # Check for specific patterns
    if 'varchar' in db_type or 'character' in db_type:
        if max_length and max_length > 140:
            return 'Small Text'
        return 'Data'
    
    return type_map.get(db_type, 'Data')

def get_standard_fields():
    """Get standard Frappe fields that shouldn't be synced"""
    return {
        'name', 'creation', 'modified', 'modified_by', 'owner',
        'docstatus', 'idx', 'parent', 'parentfield', 'parenttype',
        '_user_tags', '_comments', '_assign', '_liked_by'
    }

def find_missing_fields(doctype_name):
    """Find fields that exist in database but not in DocType JSON"""
    print(f"\n📋 Checking {doctype_name}...", flush=True)
    
    # Get table name
    table_name = f"tab{doctype_name}"
    
    # Check if table exists using multiple methods
    table_exists = False
    try:
        # Method 1: frappe.db.table_exists
        if frappe.db.table_exists(table_name):
            table_exists = True
        else:
            # Method 2: Try to query the table directly
            frappe.db.sql(f"SELECT 1 FROM `{table_name}` LIMIT 1")
            table_exists = True
    except Exception as e:
        # Method 3: Check information_schema
        try:
            db_type = frappe.db.db_type if hasattr(frappe.db, 'db_type') else 'mariadb'
            if db_type == 'postgres':
                result = frappe.db.sql("""
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = %s LIMIT 1
                """, (table_name.lower(),))
            else:
                result = frappe.db.sql("""
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = %s AND table_schema = DATABASE() LIMIT 1
                """, (table_name,))
            table_exists = len(result) > 0
        except:
            table_exists = False
    
    if not table_exists:
        print(f"  ⚠️  Table {table_name} does not exist", flush=True)
        return []
    
    print(f"  ✅ Table {table_name} exists", flush=True)
    
    # Get database columns
    db_columns = get_db_columns(table_name)
    db_column_names = {col['column_name'] for col in db_columns}
    
    # Get DocType fields
    doctype_fields = get_doctype_fields(doctype_name)
    doctype_field_names = set(doctype_fields.keys())
    
    # Add standard fields to DocType fields
    doctype_field_names.update(get_standard_fields())
    
    # Find missing fields
    missing_fields = []
    for col in db_columns:
        col_name = col['column_name']
        if col_name not in doctype_field_names and col_name not in get_standard_fields():
            field_info = {
                'fieldname': col_name,
                'fieldtype': map_db_type_to_fieldtype(col['data_type'], col.get('character_maximum_length')),
                'label': col_name.replace('_', ' ').title(),
                'db_type': col['data_type'],
                'nullable': col['is_nullable'] == 'YES',
                'default': col.get('column_default')
            }
            missing_fields.append(field_info)
            print(f"  🔍 Found missing field: {col_name} ({col['data_type']})", flush=True)
    
    if not missing_fields:
        print(f"  ✅ All database columns are defined in DocType", flush=True)
    
    return missing_fields

def update_doctype_json(doctype_name, missing_fields, dry_run=True):
    """Update DocType JSON file with missing fields"""
    if not missing_fields:
        return
    
    # Find JSON file path
    app_name = frappe.db.get_value("DocType", doctype_name, "module")
    if not app_name:
        print(f"  ❌ Could not find module for {doctype_name}", flush=True)
        return
    
    # Convert module to app path
    if app_name.startswith("Flansa"):
        json_path = os.path.join(
            frappe.get_app_path("flansa"),
            "flansa",
            app_name.lower().replace(" ", "_"),
            "doctype",
            doctype_name.lower().replace(" ", "_"),
            f"{doctype_name.lower().replace(' ', '_')}.json"
        )
    else:
        json_path = os.path.join(
            frappe.get_app_path(app_name.lower()),
            app_name.lower(),
            "doctype",
            doctype_name.lower().replace(" ", "_"),
            f"{doctype_name.lower().replace(' ', '_')}.json"
        )
    
    if not os.path.exists(json_path):
        print(f"  ❌ JSON file not found at {json_path}", flush=True)
        return
    
    print(f"  📁 JSON file: {json_path}", flush=True)
    
    if dry_run:
        print(f"  🔍 DRY RUN - Would add {len(missing_fields)} fields:", flush=True)
        for field in missing_fields:
            print(f"    - {field['fieldname']} ({field['fieldtype']})", flush=True)
        return
    
    # Read existing JSON
    with open(json_path, 'r') as f:
        doctype_json = json.load(f)
    
    # Add missing fields
    for field in missing_fields:
        new_field = {
            "fieldname": field['fieldname'],
            "fieldtype": field['fieldtype'],
            "label": field['label']
        }
        
        # Add optional properties
        if not field['nullable']:
            new_field["reqd"] = 1
        if field['default'] and field['default'] != 'NULL':
            new_field["default"] = field['default']
        
        doctype_json['fields'].append(new_field)
        
        # Add to field_order if it exists
        if 'field_order' in doctype_json:
            doctype_json['field_order'].append(field['fieldname'])
    
    # Write updated JSON
    with open(json_path, 'w') as f:
        json.dump(doctype_json, f, indent=1)
    
    print(f"  ✅ Added {len(missing_fields)} fields to JSON", flush=True)

def sync_all_doctypes(app_name="flansa", dry_run=True):
    """Sync all DocTypes in an app"""
    print(f"\n🔍 Scanning all DocTypes in {app_name} app...", flush=True)
    
    # Get all DocTypes for the app
    doctypes = frappe.get_all(
        "DocType",
        filters={"module": ("like", f"%{app_name.title()}%"), "custom": 0},
        pluck="name"
    )
    
    if not doctypes:
        # Try alternative approach
        doctypes = frappe.get_all(
            "DocType",
            filters={"module": ("like", f"%Flansa%"), "custom": 0},
            pluck="name"
        )
    
    print(f"Found {len(doctypes)} DocTypes to check", flush=True)
    
    all_missing = {}
    for doctype in doctypes:
        missing = find_missing_fields(doctype)
        if missing:
            all_missing[doctype] = missing
            update_doctype_json(doctype, missing, dry_run=dry_run)
    
    return all_missing

# Check if running in bench console (frappe already initialized)
if 'frappe' in locals() and frappe.local.site:
    print("\n🎯 Scanning ALL Flansa DocTypes for schema mismatches...", flush=True)
    
    # Get all Flansa DocTypes
    doctypes = frappe.get_all(
        "DocType",
        filters={"module": ("like", "%Flansa%"), "custom": 0},
        pluck="name"
    )
    
    print(f"Found {len(doctypes)} Flansa DocTypes to check", flush=True)
    
    all_missing = {}
    total_missing_fields = 0
    
    for doctype in doctypes:
        missing = find_missing_fields(doctype)
        if missing:
            all_missing[doctype] = missing
            total_missing_fields += len(missing)
    
    if all_missing:
        print(f"\n📊 SUMMARY: Found {total_missing_fields} missing fields across {len(all_missing)} DocTypes", flush=True)
        print("=" * 60, flush=True)
        
        for doctype, missing_fields in all_missing.items():
            print(f"\n📋 {doctype}: {len(missing_fields)} missing fields", flush=True)
            for field in missing_fields:
                print(f"  - {field['fieldname']} ({field['fieldtype']})", flush=True)
        
        print("\n" + "=" * 60, flush=True)
        print("🔧 TO FIX ALL AUTOMATICALLY (DRY RUN):", flush=True)
        print("  all_missing = sync_all_doctypes(dry_run=True)", flush=True)
        print("\n🔧 TO APPLY ALL FIXES:", flush=True)
        print("  all_missing = sync_all_doctypes(dry_run=False)", flush=True)
        print("\n🔧 TO FIX INDIVIDUAL DocTypes:", flush=True)
        for doctype in all_missing.keys():
            print(f"  # Fix {doctype}")
            print(f"  missing = find_missing_fields('{doctype}')")
            print(f"  update_doctype_json('{doctype}', missing, dry_run=False)")
    else:
        print("\n✅ All Flansa DocTypes are in sync with database schema!", flush=True)
    
    print("\n✅ Schema sync check completed!", flush=True)
else:
    print("❌ This script should be run in bench console", flush=True)
    print("Run: bench --site mysite.local console", flush=True)
    print("Then: exec(open('/path/to/this/script.py').read())", flush=True)