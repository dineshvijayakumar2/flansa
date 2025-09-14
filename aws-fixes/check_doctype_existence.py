#!/usr/bin/env python3
"""
Check if DocTypes exist in database with correct queries
"""
import frappe

print("🔍 CHECKING DOCTYPE EXISTENCE", flush=True)
print("=" * 60, flush=True)

# Get Flansa Tables
flansa_tables = frappe.db.sql("""
    SELECT name, table_name, doctype_name, application
    FROM `tabFlansa Table`
    WHERE doctype_name IS NOT NULL 
    AND doctype_name != ''
    ORDER BY name
""", as_dict=True)

print(f"\nFound {len(flansa_tables)} Flansa Tables with DocType references:", flush=True)

for table in flansa_tables:
    print(f"\n📋 Table: {table.table_name}", flush=True)
    print(f"   DocType Name: {table.doctype_name}", flush=True)
    
    # Method 1: Check using frappe.db.exists
    exists_frappe = frappe.db.exists("DocType", table.doctype_name)
    print(f"   frappe.db.exists: {exists_frappe}", flush=True)
    
    # Method 2: Direct SQL query to tabDocType
    sql_check = frappe.db.sql("""
        SELECT name FROM `tabDocType` 
        WHERE name = %s
    """, table.doctype_name)
    print(f"   SQL query result: {sql_check}", flush=True)
    
    # Method 3: Check if the table exists
    table_name = f"tab{table.doctype_name}"
    table_exists = frappe.db.table_exists(table.doctype_name)
    print(f"   Table exists (tab{table.doctype_name}): {table_exists}", flush=True)
    
    # Method 4: Try to get the DocType
    try:
        doc = frappe.get_doc("DocType", table.doctype_name)
        print(f"   ✅ DocType loaded successfully", flush=True)
        print(f"      Module: {doc.module}", flush=True)
    except Exception as e:
        print(f"   ❌ Could not load DocType: {str(e)}", flush=True)

print("\n" + "=" * 60, flush=True)
print("🔍 CHECK COMPLETE", flush=True)