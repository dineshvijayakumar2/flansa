#!/usr/bin/env python3
"""
Import Fields from Original DocTypes and Recreate with New Naming
Since Flansa Field DocType doesn't exist, we'll work directly with DocType generation
"""

import frappe
import json

print("🔄 IMPORTING FIELDS AND RECREATING DOCTYPES", flush=True)
print("=" * 55, flush=True)

# Check Frappe context
print("📡 Checking Frappe context...", flush=True)
site_name = frappe.local.site if hasattr(frappe, 'local') and hasattr(frappe.local, 'site') else 'Not connected'
print(f"   Site: {site_name}", flush=True)

# STEP 1: Analyze original DocTypes and extract field definitions
print("\n🔍 Step 1: Extracting field definitions from original DocTypes...", flush=True)

original_doctypes = {
    "Trackers_Expenses": "expenses",
    "Trackers_ExpenseCategories": "expense_categories"
}

field_definitions = {}

for old_doctype, table_name in original_doctypes.items():
    print(f"\n📋 Extracting from {old_doctype}:", flush=True)
    
    try:
        exists = frappe.db.exists("DocType", old_doctype)
        if not exists:
            print(f"   ❌ DocType not found", flush=True)
            continue
        
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", old_doctype)
        
        # Extract field definitions
        fields = []
        for field in doctype_doc.fields:
            if not field.fieldname.startswith('__'):  # Skip system fields
                field_def = {
                    'fieldname': field.fieldname,
                    'fieldtype': field.fieldtype,
                    'label': field.label,
                    'reqd': field.reqd,
                    'unique': field.unique,
                    'read_only': field.read_only,
                    'hidden': field.hidden,
                    'options': field.options,
                    'default': field.default,
                    'description': field.description,
                    'in_list_view': field.in_list_view,
                    'in_standard_filter': field.in_standard_filter
                }
                fields.append(field_def)
        
        print(f"   ✅ Extracted {len(fields)} fields", flush=True)
        print(f"   Fields: {[f['fieldname'] for f in fields[:5]]}{'...' if len(fields) > 5 else ''}", flush=True)
        
        field_definitions[old_doctype] = {
            'table_name': table_name,
            'fields': fields,
            'original_doctype': old_doctype
        }
        
    except Exception as e:
        print(f"   ❌ Error extracting from {old_doctype}: {str(e)}", flush=True)

if not field_definitions:
    print("❌ No field definitions extracted", flush=True)
else:
    print(f"✅ Extracted field definitions from {len(field_definitions)} DocTypes", flush=True)

# STEP 2: Get Flansa Tables and set proper tenant inheritance
print("\n🔍 Step 2: Setting up Flansa Tables...", flush=True)

tables = frappe.get_all("Flansa Table",
    filters={"application": "f41h2vd9ki"},
    fields=["name", "table_name", "doctype_name", "tenant_id"]
)

table_mapping = {}
for table_data in tables:
    print(f"\n📋 Setting up {table_data.table_name}:", flush=True)
    
    table_doc = frappe.get_doc("Flansa Table", table_data.name)
    print(f"   Current tenant_id: {table_doc.tenant_id or 'Not set'}", flush=True)
    
    # Set tenant inheritance
    table_doc.inherit_tenant_from_application()
    print(f"   New tenant_id: {table_doc.tenant_id}", flush=True)
    
    # Generate new DocType name
    new_doctype_name = table_doc.get_generated_doctype_name()
    print(f"   Generated DocType name: {new_doctype_name}", flush=True)
    
    table_mapping[table_data.table_name] = {
        'table_doc': table_doc,
        'new_name': new_doctype_name
    }

# STEP 3: Create new DocTypes manually with extracted field definitions
print("\n🔧 Step 3: Creating new DocTypes with field definitions...", flush=True)

created_doctypes = {}

for old_doctype, field_data in field_definitions.items():
    table_name = field_data['table_name']
    fields = field_data['fields']
    
    if table_name not in table_mapping:
        print(f"   ❌ No Flansa Table found for {table_name}", flush=True)
        continue
    
    new_doctype_name = table_mapping[table_name]['new_name']
    
    print(f"\n🏗️  Creating {new_doctype_name} from {old_doctype}:", flush=True)
    
    try:
        # Delete if exists
        if frappe.db.exists("DocType", new_doctype_name):
            print(f"   🗑️  Deleting existing DocType", flush=True)
            frappe.delete_doc("DocType", new_doctype_name, force=True, ignore_permissions=True)
        
        # Create new DocType document
        doctype_doc = frappe.new_doc("DocType")
        doctype_doc.name = new_doctype_name
        doctype_doc.module = "Flansa Core"
        doctype_doc.custom = 1
        doctype_doc.is_submittable = 0
        doctype_doc.track_changes = 1
        doctype_doc.autoname = "hash"
        
        print(f"   📝 Adding {len(fields)} fields...", flush=True)
        
        # Add fields
        for i, field_def in enumerate(fields):
            field_doc = frappe.new_doc("DocField")
            field_doc.parent = new_doctype_name
            field_doc.parenttype = "DocType"
            field_doc.parentfield = "fields"
            field_doc.idx = i + 1
            
            # Set field properties
            for key, value in field_def.items():
                if hasattr(field_doc, key) and value is not None:
                    setattr(field_doc, key, value)
            
            doctype_doc.append("fields", field_doc)
        
        # Save the DocType
        print(f"   💾 Saving DocType...", flush=True)
        doctype_doc.insert(ignore_permissions=True)
        
        print(f"   ✅ Successfully created {new_doctype_name}", flush=True)
        
        # Verify fields were created
        new_meta = frappe.get_meta(new_doctype_name)
        new_fields = [f.fieldname for f in new_meta.fields if not f.fieldname.startswith('__')]
        print(f"   Verified field count: {len(new_fields)}", flush=True)
        
        created_doctypes[old_doctype] = new_doctype_name
        
    except Exception as e:
        print(f"   ❌ Error creating {new_doctype_name}: {str(e)}", flush=True)
        import traceback
        print(f"   🔍 Details: {traceback.format_exc()[:500]}", flush=True)

frappe.db.commit()

# STEP 4: Migrate data from original DocTypes
print(f"\n📦 Step 4: Migrating data...", flush=True)

migrated_counts = {}

for old_doctype, new_doctype in created_doctypes.items():
    print(f"\n📊 Migrating {old_doctype} → {new_doctype}:", flush=True)
    
    try:
        # Get all records
        old_records = frappe.get_all(old_doctype, fields=["*"])
        print(f"   Records to migrate: {len(old_records)}", flush=True)
        
        if not old_records:
            print(f"   ✅ No data to migrate", flush=True)
            migrated_counts[old_doctype] = 0
            continue
        
        # Get common fields
        old_meta = frappe.get_meta(old_doctype)
        new_meta = frappe.get_meta(new_doctype)
        
        old_fields = {f.fieldname for f in old_meta.fields if not f.fieldname.startswith('__')}
        new_fields = {f.fieldname for f in new_meta.fields if not f.fieldname.startswith('__')}
        common_fields = old_fields & new_fields
        
        print(f"   Common fields: {len(common_fields)}", flush=True)
        
        # Migrate records
        success_count = 0
        for record in old_records:
            try:
                new_doc = frappe.new_doc(new_doctype)
                
                # Copy common fields
                for field in common_fields:
                    if field in record and record[field] is not None:
                        new_doc.set(field, record[field])
                
                new_doc.insert(ignore_permissions=True)
                success_count += 1
                
            except Exception as e:
                print(f"     ❌ Failed to migrate record: {str(e)}", flush=True)
        
        print(f"   ✅ Migrated {success_count}/{len(old_records)} records", flush=True)
        migrated_counts[old_doctype] = success_count
        
    except Exception as e:
        print(f"   ❌ Error migrating data: {str(e)}", flush=True)
        migrated_counts[old_doctype] = 0

frappe.db.commit()

# STEP 5: Update Flansa Table references
print(f"\n🔗 Step 5: Updating Flansa Table references...", flush=True)

for old_doctype, new_doctype in created_doctypes.items():
    field_data = field_definitions[old_doctype]
    table_name = field_data['table_name']
    
    if table_name in table_mapping:
        table_doc = table_mapping[table_name]['table_doc']
        
        print(f"   🔗 Linking {table_name} → {new_doctype}", flush=True)
        table_doc.doctype_name = new_doctype
        table_doc.save(ignore_permissions=True)

frappe.db.commit()

# STEP 6: Summary
print("\n" + "=" * 55, flush=True)
print("🎉 FIELD IMPORT AND DOCTYPE RECREATION COMPLETED!", flush=True)
print("=" * 55, flush=True)

print("✅ ACHIEVEMENTS:", flush=True)
for old_doctype, new_doctype in created_doctypes.items():
    migrated = migrated_counts.get(old_doctype, 0)
    print(f"• {old_doctype} → {new_doctype} ({migrated} records)", flush=True)

print(f"\n🔍 VERIFICATION:", flush=True)
for old_doctype, new_doctype in created_doctypes.items():
    try:
        meta = frappe.get_meta(new_doctype)
        fields = [f.fieldname for f in meta.fields if not f.fieldname.startswith('__')]
        count = frappe.db.count(new_doctype)
        print(f"• {new_doctype}: {len(fields)} fields, {count} records", flush=True)
    except Exception as e:
        print(f"• {new_doctype}: Error checking - {str(e)}", flush=True)

print(f"\n🎯 NEXT STEPS:", flush=True)
print(f"1. Test the new DocTypes to ensure data is correct", flush=True)
print(f"2. Test report viewer: http://localhost:8000/app/flansa-report-viewer/fe193klof8?type=table", flush=True)
print(f"3. If everything works, consider deleting old DocTypes", flush=True)

print(f"\n📊 Field import and migration completed successfully!", flush=True)