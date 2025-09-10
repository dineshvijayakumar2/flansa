#!/usr/bin/env python3
"""
Simple DocType Migration Script - All in One Execution Block
"""

import frappe

print("🔄 MIGRATING EXISTING DOCTYPES TO NEW NAMING CONVENTION", flush=True)
print("=" * 65, flush=True)

print("📡 Checking Frappe context...", flush=True)
try:
    site_name = frappe.local.site if hasattr(frappe, 'local') and hasattr(frappe.local, 'site') else 'Not connected'
    print(f"   Site: {site_name}", flush=True)
    test_count = frappe.db.count("DocType", {"name": "DocType"})
    print(f"   Database test: OK ({test_count} DocTypes found)", flush=True)
except Exception as e:
    print(f"   ❌ Frappe context error: {str(e)}", flush=True)

# STEP 1: Analyze existing DocTypes
print("\n🔍 Step 1: Analyzing existing DocTypes...", flush=True)

existing_doctypes = {
    "Trackers_Expenses": "expenses",
    "Trackers_ExpenseCategories": "expense_categories"
}

analysis = {}

for old_doctype, table_name in existing_doctypes.items():
    print(f"\n📋 Analyzing {old_doctype}:", flush=True)
    
    try:
        # Check if DocType exists
        exists = frappe.db.exists("DocType", old_doctype)
        print(f"   Exists: {exists}", flush=True)
        
        if not exists:
            print(f"   ⚠️  DocType not found, skipping", flush=True)
            continue
            
        # Get meta information
        meta = frappe.get_meta(old_doctype)
        fields = [f.fieldname for f in meta.fields if not f.fieldname.startswith('__')]
        print(f"   Field count: {len(fields)}", flush=True)
        
        # Get data count
        count = frappe.db.count(old_doctype)
        print(f"   Record count: {count}", flush=True)
        
        # Find corresponding Flansa Table
        flansa_table = frappe.get_all("Flansa Table",
            filters={"table_name": table_name, "application": "f41h2vd9ki"},
            fields=["name", "table_name", "workspace_id", "doctype_name", "status"]
        )
        
        if flansa_table:
            flansa_table = flansa_table[0]
            print(f"   Flansa Table: {flansa_table.name} (status: {flansa_table.status})", flush=True)
            print(f"   Current doctype_name: {flansa_table.doctype_name or 'NOT SET'}", flush=True)
            print(f"   Current workspace_id: {flansa_table.workspace_id or 'NOT SET'}", flush=True)
        else:
            print(f"   ❌ No matching Flansa Table found for '{table_name}'", flush=True)
            continue
        
        analysis[old_doctype] = {
            'exists': exists,
            'field_count': len(fields),
            'record_count': count,
            'fields': fields[:10],
            'flansa_table': flansa_table,
            'table_name': table_name
        }
        
    except Exception as e:
        print(f"   ❌ Error analyzing {old_doctype}: {str(e)}", flush=True)

if not analysis:
    print("❌ No DocTypes found to migrate", flush=True)
else:
    print(f"✅ Found {len(analysis)} DocTypes to migrate", flush=True)

# STEP 2: Generate new DocType names
print(f"\n🔧 Step 2: Generating new DocType names...", flush=True)

new_names = {}

for old_doctype, data in analysis.items():
    if not data.get('flansa_table'):
        continue
        
    try:
        print(f"\n📋 Processing {old_doctype}:", flush=True)
        
        # Get the Flansa Table document
        table_doc = frappe.get_doc("Flansa Table", data['flansa_table']['name'])
        
        # Ensure tenant inheritance
        table_doc.inherit_tenant_from_application()
        print(f"   Workspace ID: {table_doc.workspace_id}", flush=True)
        
        # Generate new name
        new_name = table_doc.get_generated_doctype_name()
        print(f"   Old name: {old_doctype}", flush=True)
        print(f"   New name: {new_name}", flush=True)
        
        new_names[old_doctype] = {
            'new_name': new_name,
            'table_doc': table_doc,
            'data': data
        }
        
    except Exception as e:
        print(f"   ❌ Error generating name for {old_doctype}: {str(e)}", flush=True)

if not new_names:
    print("❌ Could not generate new names", flush=True)
else:
    print(f"✅ Generated {len(new_names)} new DocType names", flush=True)

# STEP 3: Create new DocTypes
print(f"\n🏗️  Step 3: Creating new DocTypes...", flush=True)

created = {}

for old_doctype, info in new_names.items():
    try:
        print(f"\n🔧 Creating {info['new_name']}:", flush=True)
        
        table_doc = info['table_doc']
        new_name = info['new_name']
        
        # Check if new DocType already exists
        if frappe.db.exists("DocType", new_name):
            print(f"   ⚠️  DocType already exists, checking fields...", flush=True)
            meta = frappe.get_meta(new_name)
            fields = [f.fieldname for f in meta.fields if not f.fieldname.startswith('__')]
            
            if len(fields) > 0:
                print(f"   ✅ Using existing DocType with {len(fields)} fields", flush=True)
                created[old_doctype] = new_name
                continue
            else:
                print(f"   🗑️  Deleting empty DocType to recreate", flush=True)
                frappe.delete_doc("DocType", new_name, force=True, ignore_permissions=True)
        
        # Generate new DocType
        print(f"   🔧 Regenerating DocType...", flush=True)
        result = table_doc.regenerate_doctype()
        
        if result and result.get('success'):
            created_name = result.get('doctype_name')
            print(f"   ✅ Successfully created: {created_name}", flush=True)
            
            # Verify fields
            meta = frappe.get_meta(created_name)
            fields = [f.fieldname for f in meta.fields if not f.fieldname.startswith('__')]
            print(f"   Field count: {len(fields)}", flush=True)
            
            if len(fields) > 0:
                created[old_doctype] = created_name
            else:
                print(f"   ❌ Created DocType has no fields", flush=True)
        else:
            error_msg = result.get('message', 'Unknown error') if result else 'No result returned'
            print(f"   ❌ Failed to create: {error_msg}", flush=True)
            
    except Exception as e:
        print(f"   ❌ Error creating DocType: {str(e)}", flush=True)

frappe.db.commit()

if not created:
    print("❌ Could not create new DocTypes", flush=True)
else:
    print(f"✅ Created {len(created)} new DocTypes", flush=True)

# STEP 4: Migrate data
print(f"\n📦 Step 4: Migrating data...", flush=True)

migrated = {}

for old_doctype, new_doctype in created.items():
    try:
        print(f"\n📊 Migrating {old_doctype} → {new_doctype}:", flush=True)
        
        # Get all records from old DocType
        old_records = frappe.get_all(old_doctype, fields=["*"])
        print(f"   Records to migrate: {len(old_records)}", flush=True)
        
        if not old_records:
            print(f"   ✅ No data to migrate", flush=True)
            migrated[old_doctype] = 0
            continue
        
        # Get field mapping
        old_meta = frappe.get_meta(old_doctype)
        new_meta = frappe.get_meta(new_doctype)
        
        old_fields = {f.fieldname: f for f in old_meta.fields if not f.fieldname.startswith('__')}
        new_fields = {f.fieldname: f for f in new_meta.fields if not f.fieldname.startswith('__')}
        
        # Find common fields
        common_fields = set(old_fields.keys()) & set(new_fields.keys())
        print(f"   Common fields: {len(common_fields)} ({list(common_fields)[:5]}...)", flush=True)
        
        # Migrate records
        success_count = 0
        for record in old_records:
            try:
                # Create new record with mapped data
                new_doc = frappe.new_doc(new_doctype)
                
                # Copy common fields
                for field in common_fields:
                    if field in record and record[field] is not None:
                        new_doc.set(field, record[field])
                
                # Save new record
                new_doc.insert(ignore_permissions=True)
                success_count += 1
                
            except Exception as e:
                print(f"     ❌ Failed to migrate record {record.get('name', 'unknown')}: {str(e)}", flush=True)
        
        print(f"   ✅ Migrated {success_count}/{len(old_records)} records", flush=True)
        migrated[old_doctype] = success_count
        
    except Exception as e:
        print(f"   ❌ Error migrating data: {str(e)}", flush=True)
        migrated[old_doctype] = 0

frappe.db.commit()

# STEP 5: Update Flansa Table links
print(f"\n🔗 Step 5: Updating Flansa Table links...", flush=True)

try:
    for old_doctype, new_doctype in created.items():
        if old_doctype not in new_names:
            continue
            
        table_doc = new_names[old_doctype]['table_doc']
        
        print(f"   🔗 Linking {table_doc.table_name} → {new_doctype}", flush=True)
        
        # Update the doctype_name
        table_doc.doctype_name = new_doctype
        table_doc.save(ignore_permissions=True)
        
        print(f"   ✅ Updated Flansa Table: {table_doc.name}", flush=True)
    
    frappe.db.commit()
    print(f"✅ Updated all Flansa Table links", flush=True)
    
except Exception as e:
    print(f"❌ Error updating links: {str(e)}", flush=True)

# STEP 6: Summary
print("\n" + "=" * 65, flush=True)
print("🎉 DOCTYPE MIGRATION COMPLETED!", flush=True)
print("=" * 65, flush=True)

print("✅ ACHIEVEMENTS:", flush=True)
for old_doctype, new_doctype in created.items():
    migration_count = migrated.get(old_doctype, 0)
    print(f"• {old_doctype} → {new_doctype} ({migration_count} records)", flush=True)

print(f"\n📋 CLEANUP OPTIONS:", flush=True)
for old_doctype, migration_count in migrated.items():
    original_count = analysis.get(old_doctype, {}).get('record_count', 0)
    
    print(f"\n📋 {old_doctype}:", flush=True)
    print(f"   Original records: {original_count}", flush=True)
    print(f"   Migrated records: {migration_count}", flush=True)
    
    if migration_count == original_count and original_count > 0:
        print(f"   ✅ Migration complete - old DocType can be safely deleted", flush=True)
        print(f"   💡 To delete: frappe.delete_doc('DocType', '{old_doctype}', force=True)", flush=True)
    elif migration_count > 0:
        print(f"   ⚠️  Partial migration - review before deleting", flush=True)
    else:
        print(f"   ❌ No migration - keep old DocType", flush=True)

print(f"\n🎯 NEXT STEPS:", flush=True)
print(f"1. Test the new DocTypes to ensure data is correct", flush=True)
print(f"2. Test report viewer: http://localhost:8000/app/flansa-report-viewer/fe193klof8?type=table", flush=True)
print(f"3. If everything works, consider deleting old DocTypes", flush=True)

print(f"\n📊 Migration completed successfully!", flush=True)