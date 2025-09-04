import frappe

def test_fixed_workspace_api():
    """Test the fixed workspace API"""
    print("🧪 TESTING FIXED WORKSPACE API", flush=True)
    print("=" * 50, flush=True)
    
    try:
        print("Step 1: Testing workspace API directly...", flush=True)
        from flansa.flansa_core.api.workspace_api import get_user_applications
        
        apps = get_user_applications()
        print(f"✅ API returned {len(apps)} applications:", flush=True)
        
        for app in apps:
            print(f"  - {app.get('app_title', 'Unknown')}", flush=True)
            print(f"    Name: {app.get('name', 'N/A')}", flush=True)
            print(f"    Tenant: {app.get('tenant_id', 'N/A')}", flush=True)
            print(f"    Tables: {app.get('table_count', 0)}", flush=True)
            print(f"    Role: {app.get('user_role', 'N/A')}", flush=True)
            print(f"    Can Edit: {app.get('can_edit', False)}", flush=True)
            print("", flush=True)
        
        return apps
        
    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return []