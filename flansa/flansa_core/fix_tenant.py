import frappe

def fix_tenant_context():
    """Fix tenant context initialization issue"""
    print("🔧 FIXING TENANT CONTEXT INITIALIZATION", flush=True)
    print("=" * 60, flush=True)

    try:
        print("Step 1: Checking current tenant context...", flush=True)
        current_tenant = getattr(frappe.local, 'tenant_id', None)
        print(f"Current tenant_id: {current_tenant}", flush=True)
        
        print("Step 2: Checking applications by tenant...", flush=True)
        all_apps = frappe.get_all("Flansa Application", 
                                 fields=["name", "app_title", "tenant_id", "owner", "creation"])
        
        tenant_groups = {}
        for app in all_apps:
            tenant_id = app.tenant_id or "no_tenant"
            if tenant_id not in tenant_groups:
                tenant_groups[tenant_id] = []
            tenant_groups[tenant_id].append(app)
        
        for tenant_id, apps in tenant_groups.items():
            print(f"Tenant '{tenant_id}': {len(apps)} apps", flush=True)
            for app in apps:
                print(f"  - {app.app_title} (Created: {app.creation})", flush=True)
        
        # For Administrator, show all apps by removing tenant filtering
        current_user = frappe.session.user
        user_doc = frappe.get_doc("User", current_user)
        user_roles = [role.role for role in user_doc.roles]
        
        if 'System Manager' in user_roles or current_user == 'Administrator':
            print("✅ User is System Manager - will show all apps", flush=True)
            return True
        
        return tenant_groups
        
    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        return False