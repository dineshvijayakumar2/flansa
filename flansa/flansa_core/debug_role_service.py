import frappe

def debug_role_service():
    """Debug the role service application filtering"""
    print("🔍 DEBUGGING ROLE SERVICE", flush=True)
    print("=" * 50, flush=True)
    
    try:
        current_user = frappe.session.user
        print(f"Current user: {current_user}", flush=True)
        
        print("Step 1: Testing FlansaRoleService directly...", flush=True)
        from flansa.flansa_core.role_service import FlansaRoleService
        
        # Test get_user_applications method
        try:
            user_apps = FlansaRoleService.get_user_applications(current_user)
            print(f"FlansaRoleService.get_user_applications returned: {len(user_apps)} apps", flush=True)
            for app in user_apps:
                print(f"  - {app}", flush=True)
        except Exception as e:
            print(f"❌ Error in FlansaRoleService.get_user_applications: {str(e)}", flush=True)
            import traceback
            print(f"Details: {traceback.format_exc()}", flush=True)
        
        print("Step 2: Testing role determination...", flush=True)
        user_role = FlansaRoleService.get_user_role(current_user)
        print(f"User role: {user_role}", flush=True)
        
        user_permissions = FlansaRoleService.get_user_permissions(current_user)
        print(f"User permissions: {user_permissions}", flush=True)
        
        print("Step 3: Testing application access...", flush=True)
        all_apps = frappe.get_all("Flansa Application", fields=["name", "app_title"])
        for app in all_apps:
            can_access = FlansaRoleService.can_access_application(current_user, app.name)
            print(f"  - {app.app_title}: {'✅ CAN ACCESS' if can_access else '❌ NO ACCESS'}", flush=True)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return False