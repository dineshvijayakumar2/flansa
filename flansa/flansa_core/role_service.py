#!/usr/bin/env python3
"""
Flansa Role Service - Central role management and access control
Handles user roles, permissions, and application-level access control
Now integrates with HierarchicalRoleService for advanced role management
"""

import frappe
from typing import Dict, List, Optional, Tuple
from frappe import _


class FlansaRoleService:
    """Service for managing user roles and application access"""
    
    # Define role hierarchy and permissions
    ROLE_HIERARCHY = {
        'App Admin': {
            'level': 4,
            'permissions': ['create', 'read', 'update', 'delete', 'admin', 'manage_users', 'manage_roles']
        },
        'App Editor': {
            'level': 3,
            'permissions': ['create', 'read', 'update', 'delete']
        },
        'App User': {
            'level': 2,
            'permissions': ['create', 'read', 'update']
        },
        'App Viewer': {
            'level': 1,
            'permissions': ['read']
        }
    }
    
    @staticmethod
    def get_user_role(user_email: str, application_id: str = None) -> str:
        """Get user's highest role for a specific application (integrates with hierarchical system)"""
        try:
            # Try to use hierarchical role service first
            try:
                from flansa.flansa_core.hierarchical_role_service import HierarchicalRoleService
                context = {'application_id': application_id}
                if hasattr(frappe.local, 'workspace_id'):
                    context['workspace_id'] = frappe.local.workspace_id
                
                hierarchy = HierarchicalRoleService.get_user_role_hierarchy(user_email, context)
                if hierarchy.get('highest_role'):
                    return hierarchy['highest_role']
                
            except ImportError:
                pass  # Fall back to basic role service
            
            # Fallback to basic role determination
            # If application_id provided, get role from Application Users
            if application_id:
                app_user = frappe.get_value(
                    'Flansa Application User',
                    {'user': user_email, 'parent': application_id},
                    'role'
                )
                if app_user:
                    return app_user
            
            # Default role based on user type
            user_doc = frappe.get_doc('User', user_email)
            user_roles = [role.role for role in user_doc.roles]
            
            # Check for new hierarchical roles first
            if 'Flansa Super Admin' in user_roles:
                return 'App Owner'  # Super admin gets highest app-level role
            
            if 'Flansa Platform Admin' in user_roles:
                return 'App Admin'
                
            # System Manager gets App Admin
            if 'System Manager' in user_roles:
                return 'App Admin'
            
            # Flansa Admin gets App Admin
            if 'Flansa Admin' in user_roles:
                return 'App Admin'
            
            # Flansa Builder gets App Editor
            if 'Flansa Builder' in user_roles:
                return 'App Editor'
            
            # Default to App Viewer for other users
            return 'App Viewer'
            
        except Exception as e:
            frappe.log_error(f"Error getting user role: {str(e)}")
            return 'App Viewer'
    
    @staticmethod
    def get_user_permissions(user_email: str, application_id: str = None) -> List[str]:
        """Get user's permissions for a specific application"""
        user_role = FlansaRoleService.get_user_role(user_email, application_id)
        return FlansaRoleService.ROLE_HIERARCHY.get(user_role, {}).get('permissions', ['read'])
    
    @staticmethod
    def has_permission(user_email: str, permission: str, application_id: str = None) -> bool:
        """Check if user has specific permission"""
        user_permissions = FlansaRoleService.get_user_permissions(user_email, application_id)
        return permission in user_permissions
    
    @staticmethod
    def can_access_application(user_email: str, application_id: str) -> bool:
        """Check if user can access a specific application"""
        try:
            # Check if application exists
            if not frappe.db.exists('Flansa Application', application_id):
                return False
            
            app_doc = frappe.get_doc('Flansa Application', application_id)
            
            # If application is public, allow access
            if app_doc.is_public:
                return True
            
            # Check if user is in allowed_users
            allowed_users = [row.user for row in app_doc.allowed_users if row.user]
            if user_email in allowed_users:
                return True
            
            # Check if user has any of the allowed roles
            user_doc = frappe.get_doc('User', user_email)
            user_roles = [role.role for role in user_doc.roles]
            
            allowed_roles = [row.role for row in app_doc.allowed_roles if row.role]
            if any(role in allowed_roles for role in user_roles):
                return True
            
            # System Manager and Flansa Admin always have access
            if 'System Manager' in user_roles or 'Flansa Admin' in user_roles:
                return True
            
            return False
            
        except Exception as e:
            frappe.log_error(f"Error checking application access: {str(e)}")
            return False
    
    @staticmethod
    def get_user_applications(user_email: str) -> List[Dict]:
        """Get list of applications user can access"""
        try:
            # Check if user is System Manager/Admin - they should see all apps
            user_doc = frappe.get_doc('User', user_email)
            user_roles = [role.role for role in user_doc.roles]
            is_system_admin = ('System Manager' in user_roles or 
                              'Flansa Super Admin' in user_roles or 
                              user_email == 'Administrator')
            
            if is_system_admin:
                # System admins see all applications regardless of tenant
                applications = frappe.get_all(
                    'Flansa Application',
                    filters={'status': 'Active'},
                    fields=['name', 'app_name', 'app_title', 'description', 'status', 'theme_color', 'icon', 'is_public', 'workspace_id']
                )
            else:
                # Regular users: filter by tenant with robust workspace resolution
                filters = {}
                workspace_id = None

                # Try multiple sources for workspace_id
                # 1. First try frappe.local (set by before_request hook)
                if hasattr(frappe.local, 'workspace_id') and frappe.local.workspace_id:
                    workspace_id = frappe.local.workspace_id

                # 2. If not available, use WorkspaceContext directly
                if not workspace_id:
                    try:
                        from flansa.flansa_core.workspace_service import WorkspaceContext
                        workspace_id = WorkspaceContext.get_current_workspace_id()
                        # Also set it in frappe.local for subsequent calls
                        frappe.local.workspace_id = workspace_id
                    except:
                        pass

                # 3. Apply workspace filter if we have a workspace_id
                if workspace_id and workspace_id != "default":
                    filters['workspace_id'] = workspace_id
                
                applications = frappe.get_all(
                    'Flansa Application',
                    filters=filters,
                    fields=['name', 'app_name', 'app_title', 'description', 'status', 'theme_color', 'icon', 'is_public', 'workspace_id']
                )
            
            accessible_apps = []
            for app in applications:
                if FlansaRoleService.can_access_application(user_email, app.name):
                    # Add user's role for this application
                    app['user_role'] = FlansaRoleService.get_user_role(user_email, app.name)
                    app['permissions'] = FlansaRoleService.get_user_permissions(user_email, app.name)
                    accessible_apps.append(app)
            
            return accessible_apps
            
        except Exception as e:
            frappe.log_error(f"Error getting user applications: {str(e)}")
            return []
    
    @staticmethod
    def get_application_users(application_id: str) -> List[Dict]:
        """Get all users who can access an application"""
        try:
            app_doc = frappe.get_doc('Flansa Application', application_id)
            users = []
            
            # Add explicitly allowed users
            for user_row in app_doc.allowed_users:
                if user_row.user:
                    user_doc = frappe.get_doc('User', user_row.user)
                    users.append({
                        'email': user_row.user,
                        'full_name': user_doc.full_name,
                        'role': user_row.role,
                        'added_on': user_row.added_on,
                        'access_type': 'Direct'
                    })
            
            # Add users with allowed roles
            for role_row in app_doc.allowed_roles:
                if role_row.role:
                    role_users = frappe.get_all(
                        'Has Role',
                        filters={'role': role_row.role},
                        fields=['parent']
                    )
                    
                    for role_user in role_users:
                        user_doc = frappe.get_doc('User', role_user.parent)
                        users.append({
                            'email': role_user.parent,
                            'full_name': user_doc.full_name,
                            'role': FlansaRoleService.get_user_role(role_user.parent, application_id),
                            'added_on': None,
                            'access_type': f'Role: {role_row.role}'
                        })
            
            return users
            
        except Exception as e:
            frappe.log_error(f"Error getting application users: {str(e)}")
            return []
    
    @staticmethod
    def get_filtered_tables_for_user(user_email: str, application_id: str = None) -> List[Dict]:
        """Get tables filtered by user's role and permissions"""
        try:
            user_permissions = FlansaRoleService.get_user_permissions(user_email, application_id)

            # Base filter for tenant - ensure workspace context is available
            filters = {}
            workspace_id = None

            # Try multiple sources for workspace_id
            # 1. First try frappe.local (set by before_request hook)
            if hasattr(frappe.local, 'workspace_id') and frappe.local.workspace_id:
                workspace_id = frappe.local.workspace_id

            # 2. If not available, use WorkspaceContext directly
            if not workspace_id:
                try:
                    from flansa.flansa_core.workspace_service import WorkspaceContext
                    workspace_id = WorkspaceContext.get_current_workspace_id()
                    # Also set it in frappe.local for subsequent calls
                    frappe.local.workspace_id = workspace_id
                except:
                    pass

            # 3. Apply workspace filter if we have a workspace_id
            if workspace_id and workspace_id != "default":
                filters['workspace_id'] = workspace_id
            
            # If application_id provided, filter by application
            if application_id:
                filters['application'] = application_id
            
            tables = frappe.get_all(
                'Flansa Table',
                filters=filters,
                fields=['name', 'table_name', 'table_label', 'description', 'owner', 'creation']
            )
            
            # Filter based on role permissions
            filtered_tables = []
            for table in tables:
                # App Admin and App Editor can see all tables
                if 'admin' in user_permissions or 'delete' in user_permissions:
                    filtered_tables.append(table)
                # App User can see all tables (remove status filter for now)
                elif 'update' in user_permissions:
                    filtered_tables.append(table)
                # App Viewer can see all tables (read-only, remove status filter for now)
                elif 'read' in user_permissions:
                    table['readonly'] = True
                    filtered_tables.append(table)
            
            return filtered_tables
            
        except Exception as e:
            frappe.log_error(f"Error getting filtered tables: {str(e)}")
            return []
    
    @staticmethod
    def get_role_based_menu_items(user_email: str, application_id: str = None) -> Dict:
        """Get menu items based on user role"""
        user_permissions = FlansaRoleService.get_user_permissions(user_email, application_id)
        user_role = FlansaRoleService.get_user_role(user_email, application_id)
        
        menu_items = {
            'main_menu': [],
            'admin_menu': [],
            'tools_menu': []
        }
        
        # Main menu items for all users
        if 'read' in user_permissions:
            menu_items['main_menu'].extend([
                {'label': 'Home', 'route': '/app/flansa_workspace', 'icon': 'home'},
                {'label': 'Tables', 'route': '/app/flansa_record_viewer', 'icon': 'table'},
                {'label': 'Reports', 'route': '/app/flansa_report_manager', 'icon': 'chart-bar'}
            ])
        
        # Tools menu for users with create/update permissions
        if 'create' in user_permissions or 'update' in user_permissions:
            menu_items['tools_menu'].extend([
                {'label': 'Report Builder', 'route': '/app/flansa_report_builder', 'icon': 'chart-line'}
            ])
        
        # Admin menu for admins and editors
        if 'admin' in user_permissions or 'delete' in user_permissions:
            menu_items['admin_menu'].extend([
                {'label': 'Table Builder', 'route': '/app/flansa_table_builder', 'icon': 'table'},
                {'label': 'Form Builder', 'route': '/app/flansa_form_builder', 'icon': 'edit'},
                {'label': 'Visual Builder', 'route': '/app/flansa_visual_builder', 'icon': 'paint-brush'}
            ])
        
        # Super admin items
        if 'admin' in user_permissions and user_role == 'App Admin':
            menu_items['admin_menu'].extend([
                {'label': 'App Builder', 'route': '/app/flansa_app_builder', 'icon': 'cogs'},
                {'label': 'Database Viewer', 'route': '/app/flansa_database_viewer', 'icon': 'database'},
                {'label': 'Relationship Builder', 'route': '/app/flansa_relationship_builder', 'icon': 'project-diagram'}
            ])
        
        return menu_items


# API Methods for frontend
@frappe.whitelist()
def get_current_user_role(application_id=None):
    """API method to get current user's role"""
    return FlansaRoleService.get_user_role(frappe.session.user, application_id)


@frappe.whitelist()
def get_current_user_permissions(application_id=None):
    """API method to get current user's permissions"""
    return FlansaRoleService.get_user_permissions(frappe.session.user, application_id)


@frappe.whitelist()
def check_user_permission(permission, application_id=None):
    """API method to check if current user has a specific permission"""
    return FlansaRoleService.has_permission(frappe.session.user, permission, application_id)


@frappe.whitelist()
def get_accessible_applications():
    """API method to get applications accessible by current user"""
    return FlansaRoleService.get_user_applications(frappe.session.user)


@frappe.whitelist()
def get_filtered_tables(application_id=None):
    """API method to get tables filtered by user role"""
    return FlansaRoleService.get_filtered_tables_for_user(frappe.session.user, application_id)


@frappe.whitelist()
def get_user_menu_items(application_id=None):
    """API method to get menu items based on user role"""
    return FlansaRoleService.get_role_based_menu_items(frappe.session.user, application_id)


@frappe.whitelist()
def can_access_app(application_id):
    """API method to check if user can access specific application"""
    return FlansaRoleService.can_access_application(frappe.session.user, application_id)