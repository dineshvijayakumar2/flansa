from flansa.flansa_core.tenant_service import apply_tenant_filter, get_tenant_filter, TenantContext
from flansa.flansa_core.role_service import FlansaRoleService
"""
Workspace API - Role-based access for the Flansa workspace
Handles user applications, role-based filtering, and workspace customization
"""
import frappe
from typing import Dict, List, Optional
from frappe import _

def get_current_workspace_id():
    """Get the current workspace_id from session or workspace context"""
    # Try to get from frappe session first
    if hasattr(frappe.local, 'current_workspace_id'):
        return frappe.local.current_workspace_id
    
    # Try to get from request headers or params
    if frappe.request and frappe.request.headers:
        workspace_id = frappe.request.headers.get('X-Tenant-Id')
        if workspace_id:
            return workspace_id
    
    # Try to get from form dict (passed from frontend)
    if frappe.form_dict and frappe.form_dict.get('workspace_id'):
        return frappe.form_dict.get('workspace_id')
    
    # Try to get from user's default workspace - check if table/fields exist
    user = frappe.session.user
    try:
        if frappe.db.table_exists("tabFlansa Workspace User"):
            # Check available fields first
            workspace_user = frappe.get_all(
                "Flansa Workspace User",
                filters={"user": user},
                fields=["workspace_id"],  # Only get workspace_id, not workspace
                limit=1
            )
            
            if workspace_user and workspace_user[0].get('workspace_id'):
                return workspace_user[0].get('workspace_id')
    except:
        pass
    
    return None

@frappe.whitelist()
def get_user_applications():
    """Get applications accessible by current user with role information"""
    try:
        user_email = frappe.session.user
        
        # Get current tenant context
        current_workspace_id = get_current_workspace_id()
        
        # Check if user is System Manager or Administrator - they should see all apps
        user_doc = frappe.get_doc('User', user_email)
        user_roles = [role.role for role in user_doc.roles]
        is_system_admin = ('System Manager' in user_roles or 
                          'Flansa Super Admin' in user_roles or 
                          user_email == 'Administrator')
        
        if is_system_admin:
            # System admins see applications filtered by current workspace/tenant
            filters = {"status": "Active"}
            
            # Apply tenant filter only if we have a specific tenant context
            # If no workspace_id, show all apps (for Administrator/System Manager)
            if current_workspace_id:
                filters["workspace_id"] = current_workspace_id
            # If no current_workspace_id, system admins see ALL apps
            
            all_apps = frappe.get_all("Flansa Application", 
                                     fields=["name", "app_name", "app_title", "description", "status", 
                                            "theme_color", "icon", "is_public", "workspace_id", "creation"],
                                     filters=filters,
                                     order_by="creation desc")
            
            enhanced_apps = []
            for app in all_apps:
                # Get table count for this application  
                table_count = frappe.db.count('Flansa Table', filters={'application': app.name})
                
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
            
            return enhanced_apps
        else:
            # Regular users use the role service for filtered access
            applications = FlansaRoleService.get_user_applications(user_email)
            
            # Enhance each application with additional info
            enhanced_apps = []
            for app in applications:
                # Get table count for this application
                table_count = frappe.db.count(
                    'Flansa Table', 
                    filters={'application': app.get('name')}
                )
                
                # Add computed fields
                app['table_count'] = table_count
                app['can_edit'] = 'admin' in app.get('permissions', []) or 'delete' in app.get('permissions', [])
                app['can_create_tables'] = 'create' in app.get('permissions', []) or 'admin' in app.get('permissions', [])
                
                enhanced_apps.append(app)
            
            return enhanced_apps
        
    except Exception as e:
        frappe.log_error(f"Error getting user applications: {str(e)}")
        return []

@frappe.whitelist()
def get_application_details(app_name):
    """Get detailed information about a specific application"""
    try:
        app_doc = frappe.get_doc("Flansa Application", app_name)
        
        # Get tables for this application
        try:
            tables = frappe.get_all("Flansa Table",
                                   filters={"application": app_name},
                                   fields=["name", "table_name", "table_label", "description", "status", "creation", "fields_count"],
                                   order_by="creation desc")
        except Exception as e:
            frappe.log_error(f"Error getting tables for {app_name}: {str(e)}", "Application Tables Query")
            tables = []
        
        # Get relationships for this application (filter by tables since no application field exists)
        table_names = [table.name for table in tables]
        relationships = []
        
        if table_names:
            try:
                # Get relationships where either parent_table or child_table belongs to this application
                all_relationships = frappe.get_all("Flansa Relationship",
                                                  fields=["name", "relationship_name", "relationship_type", "status", 
                                                         "parent_table", "child_table", "from_table", "to_table"],
                                                  order_by="creation desc")
                
                for rel in all_relationships:
                    # Check if relationship involves tables from this application
                    parent_table = rel.parent_table or rel.from_table
                    child_table = rel.child_table or rel.to_table
                    
                    if parent_table in table_names or child_table in table_names:
                        relationships.append(rel)
                        
            except Exception as e:
                frappe.log_error(f"Error getting relationships for {app_name}: {str(e)}", "Application Relationships Query")
                relationships = []
        
        return {
            "success": True,
            "application": app_doc.as_dict(),
            "tables": tables,
            "relationships": relationships,
            "statistics": {
                "tables": len(tables),
                "relationships": len(relationships),
                "active_tables": len([t for t in tables if t.status == "Active"])
            }
        }
    except Exception as e:
        frappe.log_error(f"Error getting application details for {app_name}: {str(e)}", "Application Details API")
        return {
            "success": False, 
            "error": str(e)
        }

@frappe.whitelist()
def create_flansa_table(table_data, app_name=None):
    """Create a new Flansa Table with auto-included system fields"""
    try:
        if isinstance(table_data, str):
            table_data = frappe.parse_json(table_data)
        
        # Get application - check both table_data and app_name parameter
        application = table_data.get("application") or app_name
        if not application:
            frappe.throw("Application parameter is required")
        
        # Create the table document
        table_doc = frappe.get_doc({
            "doctype": "Flansa Table",
            "application": application,
            "table_name": table_data.get("table_name"),
            "table_label": table_data.get("table_label"),
            "description": table_data.get("description", ""),
            "status": "Active",  # Auto-activate new tables
            # New naming configuration fields
            "naming_type": table_data.get("naming_type", "Naming Series"),
            "naming_prefix": table_data.get("naming_prefix", "REC"),
            "naming_digits": table_data.get("naming_digits", 5),
            "naming_field": table_data.get("naming_field", ""),
            "naming_start_from": table_data.get("naming_start_from", 1),
            "naming_separator": table_data.get("naming_separator", "-"),
            "is_submittable": table_data.get("is_submittable", 0)
        })
        
        table_doc.insert(ignore_permissions=True)
        
        # Auto-add system fields to the table
        _add_system_fields_to_new_table(table_doc.name, table_data.get("is_submittable", 0))
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Table '{table_data.get('table_label')}' created successfully with system fields",
            "table": table_doc.as_dict(),
            "table_name": table_doc.name,  # Add table_name at root level for easy access
            "table_id": table_doc.name     # Also provide as table_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating table: {str(e)}", "Create Table API")
        return {
            "success": False,
            "error": str(e)
        }

def _add_system_fields_to_new_table(table_name, is_submittable=0):
    """
    Internal function to add system fields to newly created table
    This ensures all new tables have the built-in Frappe fields available
    """
    try:
        import json
        from flansa.flansa_core.api.system_fields_manager import FRAPPE_SYSTEM_FIELDS
        
        # Get the table document
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Get current fields JSON or initialize empty list
        current_fields = []
        if table_doc.fields_json:
            current_fields = json.loads(table_doc.fields_json)
        
        # Core system fields that should always be added
        core_system_fields = ["name", "owner", "creation", "modified", "modified_by"]
        
        # Add docstatus for submittable documents
        if is_submittable:
            core_system_fields.extend(["docstatus", "amended_from"])
        
        # Add system fields to the fields JSON
        for field_name in core_system_fields:
            if field_name in FRAPPE_SYSTEM_FIELDS:
                field_config = FRAPPE_SYSTEM_FIELDS[field_name]
                
                # Check if field already exists
                field_exists = any(f.get("field_name") == field_name for f in current_fields)
                if not field_exists:
                    system_field_entry = {
                        "field_name": field_config["fieldname"],
                        "field_label": field_config["label"],
                        "field_type": field_config["fieldtype"],
                        "description": field_config.get("description", ""),
                        "is_system_field": True,
                        "is_readonly": True,
                        "category": field_config.get("category", "system"),
                        "options": field_config.get("options", ""),
                        "in_list_view": field_config.get("in_list_view", 0),
                        "in_standard_filter": field_config.get("in_standard_filter", 0),
                        "depends_on": field_config.get("depends_on", ""),
                        "bold": field_config.get("bold", 0),
                        "hidden": field_config.get("hidden", 0)
                    }
                    
                    # Handle special cases
                    if field_name == "amended_from":
                        # Link amended_from to the same table
                        system_field_entry["options"] = table_doc.table_name
                    
                    current_fields.append(system_field_entry)
        
        # Update the table's fields JSON
        table_doc.fields_json = json.dumps(current_fields)
        table_doc.save()
        
        # Note: System fields are now directly available through native_fields.py
        # No need to create Logic Fields for system fields as they are handled natively
        
        frappe.msgprint(f"Added {len(core_system_fields)} system fields to table {table_name}", alert=True)
        
    except Exception as e:
        frappe.log_error(f"Error adding system fields to table {table_name}: {str(e)}", "System Fields Auto-Add")


@frappe.whitelist()
def delete_flansa_table(table_name):
    """Delete a Flansa Table"""
    try:
        frappe.delete_doc("Flansa Table", table_name, force=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": "Table deleted successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting table {table_name}: {str(e)}", "Delete Table API")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()  
def create_flansa_relationship(relationship_data):
    """Create a new Flansa Relationship"""
    try:
        if isinstance(relationship_data, str):
            relationship_data = frappe.parse_json(relationship_data)
        
        # Create the relationship document
        rel_doc = frappe.get_doc({
            "doctype": "Flansa Relationship",
            "relationship_name": relationship_data.get("relationship_name"),
            "relationship_type": relationship_data.get("relationship_type"),
            "parent_table": relationship_data.get("parent_table"),
            "child_table": relationship_data.get("child_table"),
            "description": relationship_data.get("description", ""),
            "status": relationship_data.get("status", "Active"),
            "cascade_delete": relationship_data.get("cascade_delete", 0),
            "required_reference": relationship_data.get("required_reference", 0)
        })
        
        rel_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Relationship '{relationship_data.get('relationship_name')}' created successfully",
            "relationship": rel_doc.as_dict()
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship: {str(e)}", "Create Relationship API")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_user_dashboard_stats():
    """Get dashboard statistics based on user's role and access"""
    try:
        user_email = frappe.session.user
        user_role = FlansaRoleService.get_user_role(user_email)
        user_permissions = FlansaRoleService.get_user_permissions(user_email)
        
        # Get accessible applications
        applications = FlansaRoleService.get_user_applications(user_email)
        app_count = len(applications)
        
        # Get accessible tables
        accessible_tables = FlansaRoleService.get_filtered_tables_for_user(user_email)
        table_count = len(accessible_tables)
        
        # Get report count (user can see reports they created or public reports)
        report_count = 0
        if 'read' in user_permissions:
            report_filters = {'owner': user_email}
            if hasattr(frappe.local, 'workspace_id'):
                report_filters['workspace_id'] = frappe.local.workspace_id
            
            report_count = frappe.db.count('Flansa Saved Report', filters=report_filters)
        
        # Get user's menu items
        menu_items = FlansaRoleService.get_role_based_menu_items(user_email)
        
        return {
            'user_role': user_role,
            'permissions': user_permissions,
            'stats': {
                'applications': app_count,
                'tables': table_count, 
                'reports': report_count
            },
            'menu_items': menu_items,
            'quick_actions': get_quick_actions_for_role(user_role, user_permissions)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting dashboard stats: {str(e)}")
        return {
            'user_role': 'App Viewer',
            'permissions': ['read'],
            'stats': {'applications': 0, 'tables': 0, 'reports': 0},
            'menu_items': {'main_menu': [], 'admin_menu': [], 'tools_menu': []},
            'quick_actions': []
        }


@frappe.whitelist()
def get_recent_activity():
    """Get recent activity based on user's role and permissions"""
    try:
        user_email = frappe.session.user
        user_permissions = FlansaRoleService.get_user_permissions(user_email)
        
        activities = []
        
        # Recent applications (if user can see them)
        if 'read' in user_permissions:
            recent_apps = frappe.get_all(
                'Flansa Application',
                filters={'workspace_id': frappe.local.workspace_id if hasattr(frappe.local, 'workspace_id') else ''},
                fields=['name', 'app_title', 'creation', 'owner'],
                order_by='creation desc',
                limit=5
            )
            
            for app in recent_apps:
                if FlansaRoleService.can_access_application(user_email, app.name):
                    activities.append({
                        'type': 'application',
                        'title': f"Application '{app.app_title}' created",
                        'timestamp': app.creation,
                        'user': app.owner,
                        'link': f'/app/flansa-app-builder?app={app.name}'
                    })
        
        # Recent tables (if user can see them)
        if 'read' in user_permissions:
            recent_tables = frappe.get_all(
                'Flansa Table',
                filters={'workspace_id': frappe.local.workspace_id if hasattr(frappe.local, 'workspace_id') else ''},
                fields=['name', 'display_name', 'creation', 'owner', 'application_id'],
                order_by='creation desc',
                limit=5
            )
            
            for table in recent_tables:
                # Check if user can access the application this table belongs to
                if table.application_id and FlansaRoleService.can_access_application(user_email, table.application_id):
                    activities.append({
                        'type': 'table',
                        'title': f"Table '{table.display_name}' created",
                        'timestamp': table.creation,
                        'user': table.owner,
                        'link': f'/app/flansa-record-viewer?table={table.name}'
                    })
        
        # Recent reports (user's own reports)
        user_reports = frappe.get_all(
            'Flansa Saved Report',
            filters={
                'owner': user_email,
                'workspace_id': frappe.local.workspace_id if hasattr(frappe.local, 'workspace_id') else ''
            },
            fields=['name', 'report_title', 'creation'],
            order_by='creation desc',
            limit=3
        )
        
        for report in user_reports:
            activities.append({
                'type': 'report',
                'title': f"Report '{report.report_title}' created",
                'timestamp': report.creation,
                'user': user_email,
                'link': f'/app/flansa-report-viewer?report={report.name}'
            })
        
        # Sort all activities by timestamp
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return activities[:10]  # Return top 10 recent activities
        
    except Exception as e:
        frappe.log_error(f"Error getting recent activity: {str(e)}")
        return []


def get_quick_actions_for_role(user_role: str, permissions: List[str]) -> List[Dict]:
    """Generate quick actions based on user role"""
    actions = []
    
    # Actions for all users with read permission
    if 'read' in permissions:
        actions.append({
            'icon': 'table',
            'title': 'View Tables',
            'description': 'Browse available data tables',
            'route': '/app/flansa-record-viewer',
            'color': 'blue'
        })
        
        actions.append({
            'icon': 'chart-bar',
            'title': 'View Reports',
            'description': 'Access your reports and analytics',
            'route': '/app/flansa-report-manager',
            'color': 'green'
        })
    
    # Actions for users who can create/update
    if 'create' in permissions or 'update' in permissions:
        actions.append({
            'icon': 'chart-line',
            'title': 'Create Report',
            'description': 'Build new reports and visualizations',
            'route': '/app/flansa-report-builder',
            'color': 'purple'
        })
    
    # Actions for editors and admins
    if 'delete' in permissions or 'admin' in permissions:
        actions.append({
            'icon': 'table',
            'title': 'Create Table',
            'description': 'Build new data structures',
            'route': '/app/flansa-table-builder',
            'color': 'orange'
        })
        
        actions.append({
            'icon': 'edit',
            'title': 'Form Builder',
            'description': 'Design custom forms',
            'route': '/app/flansa-form-builder',
            'color': 'indigo'
        })
    
    # Actions for admins only
    if 'admin' in permissions and user_role == 'App Admin':
        actions.append({
            'icon': 'cogs',
            'title': 'App Builder',
            'description': 'Manage applications',
            'route': '/app/flansa-app-builder',
            'color': 'red'
        })
        
        actions.append({
            'icon': 'database',
            'title': 'Database Viewer',
            'description': 'Advanced database management',
            'route': '/app/flansa-database-viewer',
            'color': 'gray'
        })
    
    return actions


@frappe.whitelist()
def get_user_workspace_config():
    """Get workspace configuration based on user role"""
    try:
        user_email = frappe.session.user
        user_role = FlansaRoleService.get_user_role(user_email)
        user_permissions = FlansaRoleService.get_user_permissions(user_email)
        
        # Determine what features to show/hide
        config = {
            'show_create_app_button': 'admin' in user_permissions,
            'show_admin_tools': 'delete' in user_permissions or 'admin' in user_permissions,
            'show_advanced_features': user_role in ['App Admin', 'App Editor'],
            'readonly_mode': user_role == 'App Viewer',
            'user_role_display': get_role_display_name(user_role),
            'available_views': get_available_views_for_role(user_role),
            'dashboard_widgets': get_dashboard_widgets_for_role(user_role, user_permissions)
        }
        
        return config
        
    except Exception as e:
        frappe.log_error(f"Error getting workspace config: {str(e)}")
        return {
            'show_create_app_button': False,
            'show_admin_tools': False,
            'show_advanced_features': False,
            'readonly_mode': True,
            'user_role_display': 'Viewer',
            'available_views': ['tile'],
            'dashboard_widgets': []
        }


def get_role_display_name(role: str) -> str:
    """Get user-friendly role name"""
    role_names = {
        'App Admin': 'Administrator',
        'App Editor': 'Editor',
        'App User': 'User', 
        'App Viewer': 'Viewer'
    }
    return role_names.get(role, 'User')


def get_available_views_for_role(role: str) -> List[str]:
    """Get available view modes based on role"""
    if role in ['App Admin', 'App Editor']:
        return ['tile', 'list']  # Admins and editors get both views
    else:
        return ['tile']  # Users and viewers get tile view only


def get_dashboard_widgets_for_role(role: str, permissions: List[str]) -> List[Dict]:
    """Get dashboard widgets based on role"""
    widgets = []
    
    # Stats widget for all users
    widgets.append({
        'id': 'stats_overview',
        'title': 'Overview',
        'type': 'stats',
        'size': 'large',
        'priority': 1
    })
    
    # Quick actions widget for users with create permissions
    if 'create' in permissions or 'update' in permissions:
        widgets.append({
            'id': 'quick_actions',
            'title': 'Quick Actions',
            'type': 'actions',
            'size': 'medium',
            'priority': 2
        })
    
    # Recent activity widget
    widgets.append({
        'id': 'recent_activity', 
        'title': 'Recent Activity',
        'type': 'activity',
        'size': 'medium',
        'priority': 3
    })
    
    # Admin widgets for administrators
    if 'admin' in permissions:
        widgets.append({
            'id': 'system_info',
            'title': 'System Information',
            'type': 'system',
            'size': 'small',
            'priority': 4
        })
    
    return widgets


@frappe.whitelist()
def check_application_access(application_id):
    """Check if current user can access a specific application"""
    user_email = frappe.session.user
    return FlansaRoleService.can_access_application(user_email, application_id)


@frappe.whitelist()
def get_user_navigation_menu():
    """Get navigation menu items based on user role"""
    try:
        user_email = frappe.session.user
        return FlansaRoleService.get_role_based_menu_items(user_email)
    except Exception as e:
        frappe.log_error(f"Error getting navigation menu: {str(e)}")
        return {'main_menu': [], 'admin_menu': [], 'tools_menu': []}
