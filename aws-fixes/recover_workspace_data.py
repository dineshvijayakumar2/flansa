#!/usr/bin/env python3
"""
AWS Workspace Data Recovery Script - Direct SQL Copy

This script recovers workspace data from the old tenant registry table
and migrates it to the new Flansa Workspace DocType using direct SQL operations
to avoid deleted DocType issues.

Usage:
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/recover_workspace_data.py').read())
"""

import frappe
import json
from datetime import datetime

print("🔄 AWS Workspace Data Recovery - Direct SQL", flush=True)
print("=" * 60, flush=True)

try:
    # Step 1: Check if Flansa Workspace DocType exists
    print("\n1️⃣ Checking Flansa Workspace DocType...", flush=True)
    
    if not frappe.db.exists("DocType", "Flansa Workspace"):
        print("❌ Flansa Workspace DocType not found", flush=True)
        print("   Please ensure the DocType is installed first", flush=True)
        raise Exception("DocType not found")
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
    
    # Step 3: Direct SQL query for tenant registry data
    print("\n3️⃣ Looking for tenant registry data using direct SQL...", flush=True)
    
    # Try different table names with proper PostgreSQL quoting
    possible_tables = [
        '"tabFlansa Tenant Registry"',
        '"tabflansa tenant registry"',  # lowercase version
        "tabFlansa_Tenant_Registry",
        "tenant_registry"
    ]
    
    tenant_data = []
    found_table = None
    
    for table_name in possible_tables:
        try:
            # Use direct SQL with proper PostgreSQL syntax
            result = frappe.db.sql(f"""
                SELECT 
                    name,
                    tenant_id,
                    tenant_name,
                    status,
                    primary_domain,
                    creation,
                    modified,
                    custom_branding,
                    workspace_logo
                FROM {table_name} 
                WHERE docstatus != 2 
                ORDER BY creation
            """, as_dict=True)
            
            if result:
                tenant_data = result
                found_table = table_name
                print(f"✅ Found tenant data in table: {table_name}", flush=True)
                break
                
        except Exception as e:
            print(f"   Table {table_name}: Not found ({str(e)[:50]}...)", flush=True)
            continue
    
    if not tenant_data:
        print("❌ No tenant registry data found in any table", flush=True)
        print("   Trying to list all tables with 'tenant' in name...", flush=True)
        
        # List all tables containing 'tenant' (PostgreSQL syntax)
        try:
            tables_result = frappe.db.sql("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name LIKE '%tenant%' 
                AND table_schema = 'public'
            """)
            
            if tables_result:
                print("   Found tables with 'tenant' in name:", flush=True)
                for table in tables_result:
                    print(f"   - {table[0]}", flush=True)
            else:
                print("   No tables found with 'tenant' in name", flush=True)
        except Exception as e:
            print(f"   Error listing tables: {str(e)}", flush=True)
    else:
        print(f"\n4️⃣ Found {len(tenant_data)} tenant record(s) to migrate:", flush=True)
        
        for i, tenant in enumerate(tenant_data[:5], 1):  # Show first 5
            tenant_id = tenant.get('tenant_id') or tenant.get('name')
            tenant_name = tenant.get('tenant_name') or 'Unknown'
            print(f"   {i}. {tenant_name} (ID: {tenant_id})", flush=True)
        
        if len(tenant_data) > 5:
            print(f"   ... and {len(tenant_data) - 5} more", flush=True)
    
    # Step 4: Direct SQL migration to avoid DocType issues
    if tenant_data:
        print(f"\n5️⃣ Migrating {len(tenant_data)} workspace record(s) using direct SQL...", flush=True)
        
        migrated_count = 0
        skipped_count = 0
        
        for tenant in tenant_data:
            try:
                # Extract relevant fields
                tenant_id = tenant.get('tenant_id') or tenant.get('name')
                workspace_name = tenant.get('tenant_name') or tenant_id
                status = tenant.get('status') or 'Active'
                primary_domain = tenant.get('primary_domain') or ''
                created_date = tenant.get('creation') or frappe.utils.now()
                custom_branding = tenant.get('custom_branding') or 0
                workspace_logo = tenant.get('workspace_logo') or ''
                
                # Check if workspace already exists using direct SQL (PostgreSQL)
                exists_check = frappe.db.sql("""
                    SELECT name FROM "tabFlansa Workspace" 
                    WHERE workspace_id = %s
                """, (tenant_id,))
                
                if exists_check:
                    print(f"   ⚠️  Skipping {workspace_name} - already exists", flush=True)
                    skipped_count += 1
                    continue
                
                # Generate a proper document name
                doc_name = frappe.generate_hash(length=10)
                
                # Direct SQL insert for PostgreSQL
                frappe.db.sql("""
                    INSERT INTO "tabFlansa Workspace" (
                        name, workspace_id, workspace_name, status, 
                        primary_domain, created_date, custom_branding, 
                        workspace_logo, docstatus, idx, creation, 
                        modified, modified_by, owner
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, 0, 0, %s, %s, %s, %s
                    )
                """, (
                    doc_name, tenant_id, workspace_name, status,
                    primary_domain, created_date, custom_branding,
                    workspace_logo, created_date, frappe.utils.now(),
                    frappe.session.user, frappe.session.user
                ))
                
                print(f"   ✅ Migrated: {workspace_name} ({tenant_id})", flush=True)
                migrated_count += 1
                
            except Exception as e:
                print(f"   ❌ Error migrating {tenant_id}: {str(e)}", flush=True)
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
    
    # Step 8: Update any existing Flansa User Workspace records
    print(f"\n8️⃣ Checking Flansa User Workspace records...", flush=True)
    
    user_workspaces = frappe.get_all("Flansa User Workspace",
                                   fields=["name", "user", "workspace_id"])
    
    if user_workspaces:
        print(f"   Found {len(user_workspaces)} user workspace assignments", flush=True)
        for uw in user_workspaces:
            print(f"   - User: {uw.user} -> Workspace: {uw.workspace_id}", flush=True)
    else:
        print("   No user workspace assignments found", flush=True)
    
    print("\n" + "=" * 60, flush=True)
    print("🎉 AWS Workspace Recovery Completed!", flush=True)
    
    if tenant_data:
        print("✅ Workspace data has been successfully recovered from tenant registry", flush=True)
        print("✅ AWS PostgreSQL database now has proper workspace records", flush=True)
        print("✅ Used direct SQL operations to avoid deleted DocType issues", flush=True)
    else:
        print("ℹ️  No tenant registry data found to migrate", flush=True)
    
except Exception as e:
    print(f"\n❌ Error during workspace recovery: {str(e)}", flush=True)
    import traceback
    print(f"Details: {traceback.format_exc()}", flush=True)