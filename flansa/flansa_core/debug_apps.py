#!/usr/bin/env python3
import frappe

def debug_applications():
    """Debug application visibility issue"""
    print("🔍 DEBUGGING APPLICATION VISIBILITY ISSUE", flush=True)
    print("=" * 60, flush=True)

    try:
        print("Step 1: Checking all Flansa Applications...", flush=True)
        all_apps = frappe.get_all("Flansa Application", 
                                 fields=["name", "app_name", "app_title", "status", "tenant_id", "owner", "creation"],
                                 order_by="creation desc")
        
        print(f"✅ Found {len(all_apps)} total applications:", flush=True)
        for app in all_apps:
            print(f"  - {app.name}: '{app.app_title}' (Status: {app.status}, Tenant: {app.tenant_id}, Owner: {app.owner})", flush=True)
        
        print("Step 2: Checking current tenant context...", flush=True)
        current_tenant = getattr(frappe.local, 'tenant_id', None)
        print(f"✅ Current tenant_id: {current_tenant}", flush=True)
        
        print("Step 3: Checking workspace API without role filtering...", flush=True)
        try:
            # Get apps without role filtering first
            apps_no_filter = frappe.get_all("Flansa Application",
                                           filters={"status": "Active"},
                                           fields=["name", "app_name", "app_title", "description", "theme_color", "icon", "status", "creation"])
            print(f"✅ Apps without filtering: {len(apps_no_filter)}", flush=True)
            for app in apps_no_filter:
                print(f"  - {app.name}: '{app.app_title}'", flush=True)
        except Exception as e:
            print(f"❌ Error getting apps without filter: {str(e)}", flush=True)
        
        print("Step 4: Checking current user and session...", flush=True)
        current_user = frappe.session.user
        print(f"✅ Current user: {current_user}", flush=True)
        
        # Check user roles
        user_doc = frappe.get_doc("User", current_user)
        user_roles = [role.role for role in user_doc.roles]
        print(f"✅ User roles: {user_roles}", flush=True)
        
        print("Step 5: Testing tenant filtering...", flush=True)
        # Test different tenant values
        test_tenants = ["dinesh", "Dinesh", "", None]
        for tenant in test_tenants:
            filters = {"status": "Active"}
            if tenant:
                filters["tenant_id"] = tenant
            
            tenant_apps = frappe.get_all("Flansa Application",
                                        filters=filters,
                                        fields=["name", "app_title", "tenant_id"])
            print(f"  Tenant '{tenant}': {len(tenant_apps)} apps", flush=True)
            for app in tenant_apps:
                print(f"    - {app.app_title} (Tenant: {app.tenant_id})", flush=True)
        
        return {
            "total_apps": len(all_apps),
            "current_tenant": current_tenant,
            "current_user": current_user,
            "user_roles": user_roles,
            "apps": all_apps
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return None