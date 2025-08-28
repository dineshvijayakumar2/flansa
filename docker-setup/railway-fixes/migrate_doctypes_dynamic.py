#!/usr/bin/env python3
"""
Dynamic DocType Migration Script - Works with ANY Flansa Generated DocTypes
No hardcoding - automatically finds and migrates all Flansa Generated tables
"""

import frappe

print("🔄 DYNAMIC DOCTYPE MIGRATION TO NEW NAMING CONVENTION", flush=True)
print("=" * 65, flush=True)

print("📡 Checking Frappe context...", flush=True)
try:
    site_name = frappe.local.site if hasattr(frappe, 'local') and hasattr(frappe.local, 'site') else 'Not connected'
    print(f"   Site: {site_name}", flush=True)
    test_count = frappe.db.count("DocType", {"name": "DocType"})
    print(f"   Database test: OK ({test_count} DocTypes found)", flush=True)
except Exception as e:
    print(f"   ❌ Frappe context error: {str(e)}", flush=True)

# STEP 1: Find all Flansa Generated DocTypes dynamically
print("\n🔍 Step 1: Finding all Flansa Generated DocTypes...", flush=True)

# Get all DocTypes with module "Flansa Generated"
flansa_generated_doctypes = frappe.get_all("DocType",
    filters={"module": "Flansa Generated"},
    fields=["name", "module", "custom"]
)

print(f"Found {len(flansa_generated_doctypes)} Flansa Generated DocTypes:", flush=True)
for dt in flansa_generated_doctypes:
    print(f"   • {dt.name} (custom: {dt.custom})", flush=True)

if not flansa_generated_doctypes:
    print("❌ No Flansa Generated DocTypes found to migrate", flush=True)
else:
    print(f"✅ Will migrate {len(flansa_generated_doctypes)} DocTypes", flush=True)

# STEP 2: Map DocTypes to Flansa Tables
print("\n🔍 Step 2: Mapping DocTypes to Flansa Tables...", flush=True)

doctype_to_table = {}
unmapped_doctypes = []

for dt in flansa_generated_doctypes:
    doctype_name = dt.name
    
    # Try to find corresponding Flansa Table by doctype_name
    tables = frappe.get_all("Flansa Table",
        filters={"doctype_name": doctype_name},
        fields=["name", "table_name", "application", "tenant_id", "status"]
    )
    
    if tables:
        table = tables[0]
        print(f"   ✅ {doctype_name} → {table.table_name} (App: {table.application})", flush=True)
        doctype_to_table[doctype_name] = table
    else:
        # Try to match by table name pattern
        # Extract possible table name from DocType name
        print(f"   ⚠️  No direct match for {doctype_name}, searching by pattern...", flush=True)
        
        # Look for any Flansa Table without doctype_name set
        empty_tables = frappe.get_all("Flansa Table",
            filters=[
                ["doctype_name", "in", ["", None]],
            ],
            fields=["name", "table_name", "application", "tenant_id", "status"]
        )
        
        if empty_tables:
            print(f"      Found {len(empty_tables)} unlinked Flansa Tables", flush=True)
            for et in empty_tables[:3]:  # Show first 3
                print(f"      ? {et.table_name} (App: {et.application})", flush=True)
        
        unmapped_doctypes.append(doctype_name)

if unmapped_doctypes:
    print(f"\n⚠️  {len(unmapped_doctypes)} DocTypes need manual mapping:", flush=True)
    for ud in unmapped_doctypes:
        print(f"   • {ud}", flush=True)

# STEP 3: Extract field definitions from existing DocTypes
print("\n🔍 Step 3: Extracting field definitions from existing DocTypes...", flush=True)

field_definitions = {}

for dt in flansa_generated_doctypes:
    doctype_name = dt.name
    print(f"\n📋 Extracting from {doctype_name}:", flush=True)
    
    try:
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", doctype_name)
        
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
        
        # Store with table mapping if available
        if doctype_name in doctype_to_table:
            table_info = doctype_to_table[doctype_name]
            field_definitions[doctype_name] = {
                'fields': fields,
                'table_info': table_info,
                'has_mapping': True
            }
        else:
            field_definitions[doctype_name] = {
                'fields': fields,
                'table_info': None,
                'has_mapping': False
            }
        
    except Exception as e:
        print(f"   ❌ Error extracting from {doctype_name}: {str(e)}", flush=True)

# STEP 4: Get all Flansa Tables for the applications
print("\n🔍 Step 4: Getting all Flansa Tables for migration...", flush=True)

# Get unique applications from mapped tables
applications = set()
for doctype, table in doctype_to_table.items():
    if table.get('application'):
        applications.add(table['application'])

print(f"Found applications: {list(applications)}", flush=True)

# Get all tables for these applications
all_tables = []
for app_id in applications:
    tables = frappe.get_all("Flansa Table",
        filters={"application": app_id},
        fields=["name", "table_name", "doctype_name", "tenant_id", "application"]
    )
    all_tables.extend(tables)

print(f"Found {len(all_tables)} total Flansa Tables to process", flush=True)

# STEP 5: Process each table for migration
print("\n🔄 Step 5: Processing tables for migration...", flush=True)

migrations_to_perform = []

for table_data in all_tables:
    print(f"\n📋 Processing {table_data.table_name}:", flush=True)
    
    table_doc = frappe.get_doc("Flansa Table", table_data.name)
    
    # Set tenant inheritance
    print(f"   Current tenant_id: {table_doc.tenant_id or 'Not set'}", flush=True)
    table_doc.inherit_tenant_from_application()
    print(f"   New tenant_id: {table_doc.tenant_id}", flush=True)
    
    # Generate new DocType name
    new_doctype_name = table_doc.get_generated_doctype_name()
    print(f"   New DocType name: {new_doctype_name}", flush=True)
    
    # Check if old DocType exists and has fields to migrate
    old_doctype_name = table_data.doctype_name
    if old_doctype_name and old_doctype_name != new_doctype_name:
        if old_doctype_name in field_definitions:
            field_data = field_definitions[old_doctype_name]
            if field_data['fields']:
                migrations_to_perform.append({
                    'old_doctype': old_doctype_name,
                    'new_doctype': new_doctype_name,
                    'table_doc': table_doc,
                    'fields': field_data['fields'],
                    'table_name': table_data.table_name
                })
                print(f"   ✅ Will migrate: {old_doctype_name} → {new_doctype_name}", flush=True)
            else:
                print(f"   ⚠️  No fields to migrate", flush=True)
        else:
            print(f"   ⚠️  Old DocType not in field definitions", flush=True)
    elif old_doctype_name == new_doctype_name:
        print(f"   ✅ Already using correct naming", flush=True)
    else:
        print(f"   ⚠️  No old DocType to migrate from", flush=True)

print(f"\n📊 Total migrations to perform: {len(migrations_to_perform)}", flush=True)

# STEP 6: Create new DocTypes with extracted fields
print("\n🏗️  Step 6: Creating new DocTypes with field definitions...", flush=True)

created_doctypes = {}

for migration in migrations_to_perform:
    old_doctype = migration['old_doctype']
    new_doctype = migration['new_doctype']
    fields = migration['fields']
    table_doc = migration['table_doc']
    
    print(f"\n🔧 Creating {new_doctype} from {old_doctype}:", flush=True)
    
    try:
        # Delete if exists
        if frappe.db.exists("DocType", new_doctype):
            print(f"   🗑️  Deleting existing DocType", flush=True)
            frappe.delete_doc("DocType", new_doctype, force=True, ignore_permissions=True)
        
        # Create new DocType document
        doctype_doc = frappe.new_doc("DocType")
        doctype_doc.name = new_doctype
        doctype_doc.module = "Flansa Generated"  # Keep consistent module
        doctype_doc.custom = 1
        doctype_doc.is_submittable = 0
        doctype_doc.track_changes = 1
        doctype_doc.autoname = "hash"
        
        print(f"   📝 Adding {len(fields)} fields...", flush=True)
        
        # Add fields
        for i, field_def in enumerate(fields):
            field_doc = frappe.new_doc("DocField")
            field_doc.parent = new_doctype
            field_doc.parenttype = "DocType"
            field_doc.parentfield = "fields"
            field_doc.idx = i + 1
            
            # Set field properties
            for key, value in field_def.items():
                if hasattr(field_doc, key) and value is not None:
                    setattr(field_doc, key, value)
            
            doctype_doc.append("fields", field_doc)
        
        # Add standard permissions
        print(f"   🔓 Adding permissions...", flush=True)
        
        # System Manager permissions
        perm = frappe.new_doc("DocPerm")
        perm.parent = new_doctype
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
        doctype_doc.append("permissions", perm)
        
        # Save the DocType
        print(f"   💾 Saving DocType...", flush=True)
        doctype_doc.insert(ignore_permissions=True)
        
        print(f"   ✅ Successfully created {new_doctype}", flush=True)
        
        # Update table reference
        table_doc.doctype_name = new_doctype
        table_doc.save(ignore_permissions=True)
        print(f"   🔗 Updated Flansa Table reference", flush=True)
        
        created_doctypes[old_doctype] = new_doctype
        
    except Exception as e:
        print(f"   ❌ Error creating {new_doctype}: {str(e)}", flush=True)

frappe.db.commit()

# STEP 7: Migrate data from old to new DocTypes
print(f"\n📦 Step 7: Migrating data...", flush=True)

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

# STEP 8: Summary
print("\n" + "=" * 65, flush=True)
print("🎉 DYNAMIC DOCTYPE MIGRATION COMPLETED!", flush=True)
print("=" * 65, flush=True)

print("📊 MIGRATION SUMMARY:", flush=True)
print(f"• Flansa Generated DocTypes found: {len(flansa_generated_doctypes)}", flush=True)
print(f"• Migrations performed: {len(created_doctypes)}", flush=True)
print(f"• Total records migrated: {sum(migrated_counts.values())}", flush=True)

print("\n✅ MIGRATIONS COMPLETED:", flush=True)
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

print(f"\n💡 CLEANUP OPTIONS:", flush=True)
for old_doctype, migration_count in migrated_counts.items():
    if migration_count > 0:
        print(f"• Delete old: frappe.delete_doc('DocType', '{old_doctype}', force=True)", flush=True)

print(f"\n🎯 NEXT STEPS:", flush=True)
print(f"1. Test the new DocTypes to ensure data is correct", flush=True)
print(f"2. Verify list views work properly", flush=True)
print(f"3. Test report viewer with new DocTypes", flush=True)
print(f"4. If everything works, delete old DocTypes using cleanup commands above", flush=True)

print(f"\n📊 Dynamic migration completed successfully!", flush=True)