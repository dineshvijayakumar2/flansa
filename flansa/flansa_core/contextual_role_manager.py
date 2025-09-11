#!/usr/bin/env python3
"""
Contextual Role Manager - Context-aware role management
Handles role management at different scopes: Platform, Tenant, and Application levels
"""

import frappe
from typing import Dict, List, Optional
from frappe import _
from flansa.flansa_core.hierarchical_role_service import HierarchicalRoleService


class ContextualRoleManager:
    """Context-aware role management system"""
    
    # Define what each role level can manage
    ROLE_MANAGEMENT_PERMISSIONS = {
        'Flansa Super Admin': {
            'can_manage': ['platform', 'workspace', 'application'],
            'can_create_custom_roles': True,
            'can_assign_roles': ['all'],
            'can_view_users': 'all'
        },
        'Flansa Platform Admin': {
            'can_manage': ['platform', 'workspace', 'application'],
            'can_create_custom_roles': True,
            'can_assign_roles': ['all_except_super_admin'],
            'can_view_users': 'all'
        },
        'Workspace Admin': {
            'can_manage': ['application'],
            'can_create_custom_roles': True,
            'can_assign_roles': ['workspace_and_application'],
            'can_view_users': 'workspace'
        },
        'App Owner': {
            'can_manage': ['application'],
            'can_create_custom_roles': True,
            'can_assign_roles': ['application'],
            'can_view_users': 'application'
        },
        'App Admin': {
            'can_manage': ['application'],
            'can_create_custom_roles': True,
            'can_assign_roles': ['application_limited'],
            'can_view_users': 'application'
        }
    }
    
    @staticmethod
    def get_context_from_url(url_params: Dict) -> Dict:
        """Determine context from URL parameters"""
        context = {
            'scope': 'platform',  # Default to platform level
            'application_id': url_params.get('app'),
            'workspace_id': url_params.get('tenant'),
            'user_id': url_params.get('user')
        }
        
        # Determine scope based on parameters
        if context['application_id']:
            context['scope'] = 'application'
        elif context['workspace_id']:
            context['scope'] = 'workspace'
        
        return context
    
    @staticmethod
    def get_user_role_management_capabilities(user_email: str, context: Dict) -> Dict:
        """Get what role management capabilities a user has in the given context"""
        try:
            # Get user's highest role in this context
            hierarchy = HierarchicalRoleService.get_user_role_hierarchy(user_email, context)
            highest_role = hierarchy.get('highest_role', 'App Viewer')
            
            # Get role management permissions
            permissions = ContextualRoleManager.ROLE_MANAGEMENT_PERMISSIONS.get(
                highest_role, 
                {
                    'can_manage': [],
                    'can_create_custom_roles': False,
                    'can_assign_roles': [],
                    'can_view_users': None
                }
            )
            
            return {
                'user_role': highest_role,
                'effective_level': hierarchy.get('effective_level', 0),
                'can_manage_scopes': permissions['can_manage'],
                'can_create_custom_roles': permissions['can_create_custom_roles'],
                'can_assign_roles': permissions['can_assign_roles'],
                'can_view_users': permissions['can_view_users'],
                'context': context
            }
            
        except Exception as e:
            frappe.log_error(f"Error getting role management capabilities: {str(e)}")
            return {
                'user_role': 'App Viewer',
                'effective_level': 0,
                'can_manage_scopes': [],
                'can_create_custom_roles': False,
                'can_assign_roles': [],
                'can_view_users': None,
                'context': context
            }
    
    @staticmethod
    def get_manageable_users(user_email: str, context: Dict) -> List[Dict]:
        """Get list of users this user can manage roles for"""
        capabilities = ContextualRoleManager.get_user_role_management_capabilities(user_email, context)
        user_scope = capabilities['can_view_users']
        
        if user_scope == 'all':
            # Super admins see all users
            users = frappe.get_all(
                'User',
                filters={'enabled': 1, 'user_type': 'System User'},
                fields=['name', 'full_name', 'email', 'creation'],
                order_by='full_name'
            )
        elif user_scope == 'workspace':
            # Workspace admins see users in their workspace
            if context.get('workspace_id'):
                # Get users who have roles in this workspace
                users = ContextualRoleManager._get_workspace_users(context['workspace_id'])
            else:
                # If no specific workspace, show users with workspace-related roles
                users = ContextualRoleManager._get_users_with_roles(['Workspace Admin', 'Workspace Manager'])
        elif user_scope == 'application':
            # App admins see users in their application
            if context.get('application_id'):
                users = ContextualRoleManager._get_application_users(context['application_id'])
            else:
                users = []
        else:
            users = []
        
        # Add role information to each user
        enhanced_users = []
        for user in users:
            user_hierarchy = HierarchicalRoleService.get_user_role_hierarchy(user.name, context)
            user['current_role'] = user_hierarchy.get('highest_role', 'App Viewer')
            user['effective_level'] = user_hierarchy.get('effective_level', 0)
            user['platform_roles'] = user_hierarchy.get('platform_roles', [])
            user['workspace_roles'] = user_hierarchy.get('workspace_roles', [])
            user['application_roles'] = user_hierarchy.get('application_roles', {})
            enhanced_users.append(user)
        
        return enhanced_users
    
    @staticmethod
    def _get_workspace_users(workspace_id: str) -> List[Dict]:
        """Get users associated with a specific workspace"""
        # Get users with workspace roles in this workspace
        workspace_users = frappe.get_all(
            'Flansa Workspace User',
            filters={'workspace_id': workspace_id},
            fields=['user']
        )
        
        user_emails = [u.user for u in workspace_users]
        
        # Also get users with applications in this workspace
        app_users = frappe.db.sql("""
            SELECT DISTINCT au.user
            FROM `tabFlansa Application User` au
            JOIN `tabFlansa Application` app ON au.parent = app.name
            WHERE app.workspace_id = %s
        """, (workspace_id,), as_dict=True)
        
        user_emails.extend([u.user for u in app_users])
        user_emails = list(set(user_emails))  # Remove duplicates
        
        if not user_emails:
            return []
        
        # Get user details
        users = frappe.get_all(
            'User',
            filters={'name': ['in', user_emails], 'enabled': 1},
            fields=['name', 'full_name', 'email', 'creation'],
            order_by='full_name'
        )
        
        return users
    
    @staticmethod
    def _get_application_users(application_id: str) -> List[Dict]:
        """Get users associated with a specific application"""
        # Get users assigned to this application
        app_users = frappe.get_all(
            'Flansa Application User',
            filters={'parent': application_id},
            fields=['user']
        )
        
        user_emails = [u.user for u in app_users]
        
        if not user_emails:
            return []
        
        # Get user details
        users = frappe.get_all(
            'User',
            filters={'name': ['in', user_emails], 'enabled': 1},
            fields=['name', 'full_name', 'email', 'creation'],
            order_by='full_name'
        )
        
        return users
    
    @staticmethod
    def _get_users_with_roles(roles: List[str]) -> List[Dict]:
        """Get users who have specific roles"""
        role_users = frappe.get_all(
            'Has Role',
            filters={'role': ['in', roles]},
            fields=['parent']
        )
        
        user_emails = list(set([r.parent for r in role_users]))
        
        if not user_emails:
            return []
        
        users = frappe.get_all(
            'User',
            filters={'name': ['in', user_emails], 'enabled': 1},
            fields=['name', 'full_name', 'email', 'creation'],
            order_by='full_name'
        )
        
        return users
    
    @staticmethod
    def get_available_roles_for_assignment(user_email: str, context: Dict) -> List[Dict]:
        """Get roles that this user can assign in the given context"""
        capabilities = ContextualRoleManager.get_user_role_management_capabilities(user_email, context)
        assignable_roles = capabilities['can_assign_roles']
        
        roles = []
        
        if 'all' in assignable_roles:
            # Super admin can assign any role
            roles.extend([
                {'scope': 'platform', 'role': 'Flansa Super Admin', 'level': 100},
                {'scope': 'platform', 'role': 'Flansa Platform Admin', 'level': 90},
                {'scope': 'workspace', 'role': 'Workspace Admin', 'level': 80},
                {'scope': 'workspace', 'role': 'Workspace Manager', 'level': 70},
                {'scope': 'application', 'role': 'App Owner', 'level': 60},
                {'scope': 'application', 'role': 'App Admin', 'level': 50},
                {'scope': 'application', 'role': 'App Developer', 'level': 45},
                {'scope': 'application', 'role': 'App Editor', 'level': 40},
                {'scope': 'application', 'role': 'App User', 'level': 30},
                {'scope': 'application', 'role': 'App Viewer', 'level': 20}
            ])
        elif 'all_except_super_admin' in assignable_roles:
            # Platform admin can assign all except super admin
            roles.extend([
                {'scope': 'platform', 'role': 'Flansa Platform Admin', 'level': 90},
                {'scope': 'workspace', 'role': 'Workspace Admin', 'level': 80},
                {'scope': 'workspace', 'role': 'Workspace Manager', 'level': 70},
                {'scope': 'application', 'role': 'App Owner', 'level': 60},
                {'scope': 'application', 'role': 'App Admin', 'level': 50},
                {'scope': 'application', 'role': 'App Developer', 'level': 45},
                {'scope': 'application', 'role': 'App Editor', 'level': 40},
                {'scope': 'application', 'role': 'App User', 'level': 30},
                {'scope': 'application', 'role': 'App Viewer', 'level': 20}
            ])
        elif 'workspace_and_application' in assignable_roles:
            # Workspace admin can assign workspace and app roles within their workspace
            roles.extend([
                {'scope': 'workspace', 'role': 'Workspace Manager', 'level': 70},
                {'scope': 'application', 'role': 'App Owner', 'level': 60},
                {'scope': 'application', 'role': 'App Admin', 'level': 50},
                {'scope': 'application', 'role': 'App Developer', 'level': 45},
                {'scope': 'application', 'role': 'App Editor', 'level': 40},
                {'scope': 'application', 'role': 'App User', 'level': 30},
                {'scope': 'application', 'role': 'App Viewer', 'level': 20}
            ])
        elif 'application' in assignable_roles:
            # App admin can assign app roles
            roles.extend([
                {'scope': 'application', 'role': 'App Admin', 'level': 50},
                {'scope': 'application', 'role': 'App Developer', 'level': 45},
                {'scope': 'application', 'role': 'App Editor', 'level': 40},
                {'scope': 'application', 'role': 'App User', 'level': 30},
                {'scope': 'application', 'role': 'App Viewer', 'level': 20}
            ])
        elif 'application_limited' in assignable_roles:
            # Limited app admin (cannot assign other admins)
            roles.extend([
                {'scope': 'application', 'role': 'App Developer', 'level': 45},
                {'scope': 'application', 'role': 'App Editor', 'level': 40},
                {'scope': 'application', 'role': 'App User', 'level': 30},
                {'scope': 'application', 'role': 'App Viewer', 'level': 20}
            ])
        
        # Filter roles based on context
        if context['scope'] == 'application':
            roles = [r for r in roles if r['scope'] == 'application']
        elif context['scope'] == 'tenant':
            roles = [r for r in roles if r['scope'] in ['workspace', 'application']]
        
        # Add custom roles if user can create them
        if capabilities['can_create_custom_roles'] and context.get('application_id'):
            custom_roles = frappe.get_all(
                'Flansa Custom Role',
                filters={'application_id': context['application_id'], 'is_active': 1},
                fields=['role_name', 'description']
            )
            
            for custom_role in custom_roles:
                roles.append({
                    'scope': 'custom',
                    'role': custom_role.role_name,
                    'level': 35,  # Between App Editor and App User
                    'description': custom_role.description
                })
        
        return roles
    
    @staticmethod
    def get_contextual_breadcrumbs(context: Dict) -> List[Dict]:
        """Generate breadcrumbs based on context"""
        breadcrumbs = [
            {'label': 'Home', 'route': '/app/flansa-workspace-builder', 'icon': 'home'}
        ]
        
        if context['scope'] == 'application' and context.get('application_id'):
            # App level: Home > App Name > Role Manager
            try:
                app_doc = frappe.get_doc('Flansa Application', context['application_id'])
                breadcrumbs.extend([
                    {'label': app_doc.app_title, 'route': f'/app/flansa-workspace-builder?app={context["application_id"]}', 'icon': 'mobile'},
                    {'label': 'Role Manager', 'route': '#', 'icon': 'users', 'current': True}
                ])
            except:
                breadcrumbs.append({'label': 'Role Manager', 'route': '#', 'icon': 'users', 'current': True})
        
        elif context['scope'] == 'workspace' and context.get('workspace_id'):
            # Workspace level: Home > Workspace > Role Manager
            breadcrumbs.extend([
                {'label': f'Workspace: {context["workspace_id"]}', 'route': f'/app/flansa-workspace-builder?tenant={context["workspace_id"]}', 'icon': 'building'},
                {'label': 'Role Manager', 'route': '#', 'icon': 'users', 'current': True}
            ])
        
        else:
            # Platform level: Home > Role Manager
            breadcrumbs.append({'label': 'Platform Role Manager', 'route': '#', 'icon': 'globe', 'current': True})
        
        return breadcrumbs


# API Methods
@frappe.whitelist()
def get_contextual_role_data(app_id=None, workspace_id=None, user_id=None):
    """Get role management data for the given context"""
    context = {
        'application_id': app_id,
        'workspace_id': workspace_id,
        'user_id': user_id,
        'scope': 'platform'
    }
    
    # Determine scope
    if app_id:
        context['scope'] = 'application'
    elif workspace_id:
        context['scope'] = 'tenant'
    
    current_user = frappe.session.user
    
    # Get user's capabilities in this context
    capabilities = ContextualRoleManager.get_user_role_management_capabilities(current_user, context)
    
    # Get manageable users
    manageable_users = ContextualRoleManager.get_manageable_users(current_user, context)
    
    # Get available roles for assignment
    available_roles = ContextualRoleManager.get_available_roles_for_assignment(current_user, context)
    
    # Get breadcrumbs
    breadcrumbs = ContextualRoleManager.get_contextual_breadcrumbs(context)
    
    return {
        'context': context,
        'capabilities': capabilities,
        'users': manageable_users,
        'available_roles': available_roles,
        'breadcrumbs': breadcrumbs,
        'page_title': f"Role Manager - {context['scope'].title()} Level"
    }


@frappe.whitelist()
def assign_contextual_role(user_email, role_name, scope, context_id=None):
    """Assign a role in the appropriate context"""
    current_user = frappe.session.user
    
    # Build context
    context = {'scope': scope}
    if scope == 'application':
        context['application_id'] = context_id
    elif scope == 'tenant':
        context['workspace_id'] = context_id
    
    # Check if current user can assign this role
    capabilities = ContextualRoleManager.get_user_role_management_capabilities(current_user, context)
    available_roles = ContextualRoleManager.get_available_roles_for_assignment(current_user, context)
    
    # Verify the role is available for assignment
    role_found = any(r['role'] == role_name for r in available_roles)
    if not role_found:
        frappe.throw(f"You don't have permission to assign the role '{role_name}'")
    
    # Use the hierarchical role service to assign the role
    return HierarchicalRoleService.assign_role_to_user(
        user_email, 
        role_name, 
        scope, 
        context_id, 
        current_user
    )


@frappe.whitelist()
def create_contextual_custom_role(role_name, application_id, permissions, description=""):
    """Create a custom role for a specific application"""
    current_user = frappe.session.user
    
    context = {
        'scope': 'application',
        'application_id': application_id
    }
    
    # Check if user can create custom roles
    capabilities = ContextualRoleManager.get_user_role_management_capabilities(current_user, context)
    
    if not capabilities['can_create_custom_roles']:
        frappe.throw("You don't have permission to create custom roles")
    
    # Use the hierarchical role service to create the role
    return HierarchicalRoleService.create_custom_role(
        role_name,
        application_id,
        permissions if isinstance(permissions, list) else frappe.parse_json(permissions),
        current_user,
        description
    )