#!/usr/bin/env python3
"""
Add Missing Fields to DocType JSON Files
This script adds database columns that exist but are missing from DocType JSON definitions.

Usage in AWS container bench console:
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-docker-setup/aws-fixes/add_missing_fields.py').read())
"""

import frappe
import json
import os

print("🔧 Adding Missing Fields to JSON Files", flush=True)
print("=" * 50, flush=True)

# Fields that should be added (excluding standard Frappe fields)
fields_to_add = {
    "Flansa Relationship": [
        {"fieldname": "workspace_id", "fieldtype": "Data", "label": "Workspace ID"},
        {"fieldname": "workspace", "fieldtype": "Data", "label": "Workspace"},
        {"fieldname": "enterprise_type", "fieldtype": "Data", "label": "Enterprise Type"},
        {"fieldname": "inherit_permissions", "fieldtype": "Check", "label": "Inherit Permissions"},
        {"fieldname": "required_field", "fieldtype": "Check", "label": "Required Field"},
        {"fieldname": "summary_field", "fieldtype": "Data", "label": "Summary Field"}
    ],
    "Flansa Saved Report": [
        {"fieldname": "workspace_id", "fieldtype": "Data", "label": "Workspace ID"}
    ],
    "Flansa Form Config": [
        {"fieldname": "workspace_id", "fieldtype": "Data", "label": "Workspace ID"}
    ]
}

def add_fields_to_json(doctype_name, fields_to_add):
    """Add missing fields to DocType JSON file"""
    print(f"\n📋 Processing {doctype_name}...", flush=True)
    
    # Find JSON file path - AWS container path
    json_path = os.path.join(
        frappe.get_app_path("flansa"),
        "flansa_core",
        "doctype",
        doctype_name.lower().replace(" ", "_"),
        f"{doctype_name.lower().replace(' ', '_')}.json"
    )
    
    if not os.path.exists(json_path):
        print(f"  ❌ JSON file not found: {json_path}", flush=True)
        return False
    
    print(f"  📁 JSON file: {json_path}", flush=True)
    
    try:
        # Read existing JSON
        with open(json_path, 'r') as f:
            doctype_json = json.load(f)
        
        # Get existing field names
        existing_fields = {field.get('fieldname') for field in doctype_json.get('fields', [])}
        
        # Add missing fields
        added_count = 0
        for field_info in fields_to_add:
            fieldname = field_info['fieldname']
            if fieldname not in existing_fields:
                # Add to fields array
                doctype_json['fields'].append({
                    "fieldname": fieldname,
                    "fieldtype": field_info['fieldtype'],
                    "label": field_info['label']
                })
                
                # Add to field_order if it exists
                if 'field_order' in doctype_json and fieldname not in doctype_json['field_order']:
                    doctype_json['field_order'].append(fieldname)
                
                added_count += 1
                print(f"    ✅ Added: {fieldname} ({field_info['fieldtype']})", flush=True)
            else:
                print(f"    ⚠️  Exists: {fieldname}", flush=True)
        
        # Write updated JSON
        if added_count > 0:
            with open(json_path, 'w') as f:
                json.dump(doctype_json, f, indent=1)
            print(f"  ✅ Added {added_count} fields to JSON", flush=True)
        else:
            print(f"  ℹ️  No new fields to add", flush=True)
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {e}", flush=True)
        return False

# Check if running in bench console (frappe already initialized)
if 'frappe' in globals() and hasattr(frappe, 'local') and frappe.local.site:
    # Process each DocType
    success_count = 0
    for doctype_name, fields in fields_to_add.items():
        if add_fields_to_json(doctype_name, fields):
            success_count += 1

    print(f"\n📊 Summary:", flush=True)
    print(f"  ✅ Successfully updated: {success_count}/{len(fields_to_add)} DocTypes", flush=True)

    if success_count > 0:
        print(f"\n🔧 Next steps:", flush=True)
        print(f"  1. Run: bench --site flansa.production migrate", flush=True)
        print(f"  2. Check if migrations run successfully", flush=True)
        print(f"  3. Test the application", flush=True)

    print(f"\n✅ Field addition complete!", flush=True)
else:
    print("❌ This script should be run in bench console", flush=True)
    print("Run: bench --site flansa.production console", flush=True)
    print("Then: exec(open('/path/to/this/script.py').read())", flush=True)