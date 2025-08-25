#!/usr/bin/env python3
"""
Import Flansa Data into Railway PostgreSQL
Run this in Railway bench console
"""

import frappe
import json

print("🚀 IMPORTING FLANSA DATA INTO RAILWAY", flush=True)
print("=" * 50, flush=True)

# Load exported data
with open('flansa_export.json', 'r') as f:
    exported_data = json.load(f)

print(f"📋 Found data for {len(exported_data)} DocTypes", flush=True)

for doctype_name, doctype_data in exported_data.items():
    print(f"\n🔄 Processing {doctype_name}...", flush=True)
    
    try:
        records = doctype_data['records']
        imported = 0
        skipped = 0
        
        for record in records:
            try:
                # Check if record already exists
                existing = frappe.db.get_value(doctype_name, record.get('name'))
                if existing:
                    print(f"   ⚠️  Skipping existing: {record.get('name')}", flush=True)
                    skipped += 1
                    continue
                
                # Ensure tenant_id is set
                if 'tenant_id' not in record or not record['tenant_id']:
                    record['tenant_id'] = 'default'
                
                # Create new document
                doc = frappe.new_doc(doctype_name)
                
                # Set all fields from record
                for field, value in record.items():
                    if hasattr(doc, field):
                        setattr(doc, field, value)
                
                # Insert the document
                doc.insert(ignore_permissions=True, ignore_mandatory=True)
                print(f"   ✅ Imported: {record.get('name', 'unnamed')}", flush=True)
                imported += 1
                
            except Exception as e:
                print(f"   ❌ Error importing {record.get('name', 'unnamed')}: {str(e)}", flush=True)
                continue
        
        frappe.db.commit()
        print(f"✅ {doctype_name}: {imported} imported, {skipped} skipped", flush=True)
        
    except Exception as e:
        print(f"❌ Error with {doctype_name}: {str(e)}", flush=True)
        frappe.db.rollback()
        continue

print("\n🎉 Data import completed!", flush=True)
print("📋 Summary:", flush=True)

# Show final counts
for doctype_name in exported_data.keys():
    try:
        count = frappe.db.count(doctype_name)
        print(f"   - {doctype_name}: {count} total records", flush=True)
    except:
        print(f"   - {doctype_name}: Error counting", flush=True)