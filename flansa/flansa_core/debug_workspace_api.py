import frappe

def debug_workspace_api_detailed():
    """Debug workspace API in detail"""
    print("🔍 DETAILED WORKSPACE API DEBUG", flush=True)
    print("=" * 50, flush=True)
    
    try:
        current_user = frappe.session.user
        print(f"Current user: {current_user}", flush=True)
        
        print("Step 1: Check user roles in workspace API context...", flush=True)
        user_doc = frappe.get_doc('User', current_user)
        user_roles = [role.role for role in user_doc.roles]
        is_system_admin = ('System Manager' in user_roles or 
                          'Flansa Super Admin' in user_roles or 
                          current_user == 'Administrator')
        
        print(f"User roles: {user_roles}", flush=True)
        print(f"Is system admin: {is_system_admin}", flush=True)
        
        print("Step 2: Test application query directly...", flush=True)
        if is_system_admin:
            all_apps = frappe.get_all("Flansa Application", 
                                     fields=["name", "app_name", "app_title", "description", "status", 
                                            "theme_color", "icon", "is_public", "workspace_id", "creation"],
                                     filters={"status": "Active"},
                                     order_by="creation desc")
            print(f"Direct query returned {len(all_apps)} apps:", flush=True)
            for app in all_apps:
                print(f"  - {app.app_title} ({app.name})", flush=True)
        
        print("Step 3: Test role service call from workspace API...", flush=True)
        from flansa.flansa_core.role_service import FlansaRoleService
        
        applications = FlansaRoleService.get_user_applications(current_user)
        print(f"Role service returned {len(applications)} apps:", flush=True)
        for app in applications:
            print(f"  - {app.get('app_title', 'Unknown')}", flush=True)
        
        print("Step 4: Test workspace API execution path...", flush=True)
        
        # Simulate the workspace API logic
        if is_system_admin:
            print("Taking System Admin path...", flush=True)
            # This should be the path taken
            all_apps = frappe.get_all("Flansa Application", 
                                     fields=["name", "app_name", "app_title", "description", "status", 
                                            "theme_color", "icon", "is_public", "workspace_id", "creation"],
                                     filters={"status": "Active"},
                                     order_by="creation desc")
            
            enhanced_apps = []
            for app in all_apps:
                # Get table count for this application  
                table_count = frappe.db.count('Flansa Table', filters={'application_id': app.name})
                
                # Add computed fields for system admin
                app_data = {
                    'name': app.name,
                    'app_name': app.app_name,
                    'app_title': app.app_title,
                    'description': app.description,
                    'status': app.status,
                    'theme_color': app.theme_color,
                    'icon': app.icon,
                    'is_public': app.is_public,
                    'workspace_id': app.workspace_id,
                    'table_count': table_count,
                    'user_role': 'App Owner',  # System admins get owner privileges
                    'permissions': ['admin', 'create', 'read', 'update', 'delete', 'manage_users'],
                    'can_edit': True,
                    'can_create_tables': True
                }
                enhanced_apps.append(app_data)
            
            print(f"Enhanced apps: {len(enhanced_apps)}", flush=True)
            return enhanced_apps
        else:
            print("Taking Regular User path...", flush=True)
            # This shouldn't be taken for Administrator
            return []
        
    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return []