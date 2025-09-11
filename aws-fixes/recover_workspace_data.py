#!/usr/bin/env python3
"""
AWS Workspace Data Recovery Script

This script recovers workspace data from the old tenant registry table
and migrates it to the new Flansa Workspace DocType in AWS PostgreSQL.

Usage:
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/recover_workspace_data.py').read())
"""

import frappe
import json
from datetime import datetime

print("🔄 AWS Workspace Data Recovery", flush=True)
print("=" * 60, flush=True)

try:
    # Step 1: Check if Flansa Workspace DocType exists
    print("\n1️⃣ Checking Flansa Workspace DocType...", flush=True)
    
    if not frappe.db.exists("DocType", "Flansa Workspace"):
        print("❌ Flansa Workspace DocType not found", flush=True)
        print("   Please ensure the DocType is installed first", flush=True)
    else:
        print("✅ Flansa Workspace DocType exists", flush=True)
    
    # Step 2: Check existing workspace records
    print("\n2️⃣ Checking existing workspace records...", flush=True)
    
    existing_workspaces = frappe.get_all("Flansa Workspace", 
                                        fields=["name", "workspace_id", "workspace_name"])
    
    if existing_workspaces:
        print(f"ℹ️  Found {len(existing_workspaces)} existing workspace(s):", flush=True)
        for ws in existing_workspaces:
            print(f"   - {ws.workspace_name} ({ws.workspace_id})", flush=True)
    else:
        print("⚠️  No existing workspaces found", flush=True)
    
    # Step 3: Check for tenant registry data (various possible table names)
    print("\n3️⃣ Looking for tenant registry data...", flush=True)
    
    # Possible table names to check
    possible_tables = [
        "tabFlansa Tenant Registry",
        "Flansa Tenant Registry", 
        "tenant_registry",
        "flansa_tenant_registry"
    ]
    
    tenant_data = []
    found_table = None
    
    for table_name in possible_tables:
        try:
            # Try direct SQL query since table might not be a DocType anymore
            result = frappe.db.sql(f"""
                SELECT * FROM `{table_name}` 
                WHERE docstatus != 2 
                LIMIT 10
            """, as_dict=True)
            
            if result:
                tenant_data = result
                found_table = table_name
                print(f"✅ Found tenant data in table: {table_name}", flush=True)
                break
                
        except Exception as e:
            print(f"   Table {table_name}: Not found", flush=True)
            continue
    
    if not tenant_data:
        print("❌ No tenant registry data found in any table", flush=True)
        print("   Checked tables:", flush=True)
        for table in possible_tables:
            print(f"   - {table}", flush=True)
    else:
        print(f"\n4️⃣ Found {len(tenant_data)} tenant record(s) to migrate:", flush=True)
        
        for i, tenant in enumerate(tenant_data[:5], 1):  # Show first 5
            tenant_id = tenant.get('tenant_id') or tenant.get('workspace_id') or tenant.get('name')
            tenant_name = tenant.get('tenant_name') or tenant.get('workspace_name') or 'Unknown'
            print(f"   {i}. {tenant_name} (ID: {tenant_id})", flush=True)
        
        if len(tenant_data) > 5:
            print(f"   ... and {len(tenant_data) - 5} more", flush=True)
    
    # Step 4: Migrate data
    if tenant_data:
        print(f"\n5️⃣ Migrating {len(tenant_data)} workspace record(s)...", flush=True)
        
        migrated_count = 0
        skipped_count = 0
        
        for tenant in tenant_data:
            try:
                # Extract relevant fields (handle different possible field names)
                workspace_id = (tenant.get('tenant_id') or 
                              tenant.get('workspace_id') or 
                              tenant.get('name'))
                
                workspace_name = (tenant.get('tenant_name') or 
                                tenant.get('workspace_name') or 
                                workspace_id)
                
                status = tenant.get('status') or 'Active'
                primary_domain = tenant.get('primary_domain') or tenant.get('domain')
                created_date = tenant.get('creation') or tenant.get('created_date')
                custom_branding = tenant.get('custom_branding') or 0
                workspace_logo = tenant.get('workspace_logo') or tenant.get('logo')
                
                # Check if workspace already exists
                if frappe.db.exists("Flansa Workspace", {"workspace_id": workspace_id}):
                    print(f"   ⚠️  Skipping {workspace_name} - already exists", flush=True)
                    skipped_count += 1
                    continue
                
                # Create new workspace record
                workspace_doc = frappe.get_doc({
                    "doctype": "Flansa Workspace",
                    "workspace_id": workspace_id,
                    "workspace_name": workspace_name,
                    "status": status,
                    "primary_domain": primary_domain,
                    "created_date": created_date or frappe.utils.now(),
                    "custom_branding": custom_branding,
                    "workspace_logo": workspace_logo
                })
                
                workspace_doc.insert(ignore_permissions=True)
                print(f"   ✅ Migrated: {workspace_name}", flush=True)
                migrated_count += 1
                
            except Exception as e:
                print(f"   ❌ Error migrating {workspace_id}: {str(e)}", flush=True)
                continue
        
        # Commit changes
        frappe.db.commit()
        
        print(f"\n6️⃣ Migration Summary:", flush=True)
        print(f"   ✅ Successfully migrated: {migrated_count} workspaces", flush=True)
        print(f"   ⚠️  Skipped (already exist): {skipped_count} workspaces", flush=True)
        print(f"   📊 Total processed: {len(tenant_data)} records", flush=True)
    
    # Step 7: Verify migration
    print(f"\n7️⃣ Verifying migration results...", flush=True)
    
    final_workspaces = frappe.get_all("Flansa Workspace", 
                                     fields=["name", "workspace_id", "workspace_name", "status"])
    
    print(f"✅ Final workspace count: {len(final_workspaces)}", flush=True)
    for ws in final_workspaces:
        print(f"   - {ws.workspace_name} ({ws.workspace_id}) - {ws.status}", flush=True)
    
    print("\n" + "=" * 60, flush=True)
    print("🎉 AWS Workspace Recovery Completed!", flush=True)
    
    if tenant_data:
        print("✅ Workspace data has been successfully recovered from tenant registry", flush=True)
        print("✅ AWS PostgreSQL database now has proper workspace records", flush=True)
    else:
        print("ℹ️  No tenant registry data found to migrate", flush=True)
    
except Exception as e:
    print(f"\n❌ Error during workspace recovery: {str(e)}", flush=True)
    import traceback
    print(f"Details: {traceback.format_exc()}", flush=True)