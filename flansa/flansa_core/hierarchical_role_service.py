#!/usr/bin/env python3
"""
Flansa Hierarchical Role Service - Multi-level role management system
Handles platform, workspace, application, and custom roles with proper hierarchy
"""

import frappe
from typing import Dict, List, Optional, Tuple, Set
from frappe import _
import json


class HierarchicalRoleService:
    """Advanced role management with multi-level hierarchy"""
    
    # Platform-level roles (cross-tenant)
    PLATFORM_ROLES = {
        'Flansa Super Admin': {
            'level': 100,
            'description': 'Full platform access across all tenants',
            'scope': 'platform',
            'permissions': ['*']  # All permissions
        },
        'Flansa Platform Admin': {
            'level': 90,
            'description': 'Platform administration without code access',
            'scope': 'platform', 
            'permissions': ['manage_tenants', 'view_all_tenants', 'manage_platform_settings']
        }
    }
    
    # Workspace-level roles (per tenant)
    WORKSPACE_ROLES = {
        'Workspace Admin': {
            'level': 80,
            'description': 'Full control of a specific workspace/tenant',
            'scope': 'workspace',
            'permissions': ['manage_workspace', 'manage_all_apps', 'manage_users', 'manage_roles', 'create_apps']
        },
        'Workspace Manager': {
            'level': 70,
            'description': 'Manage workspace settings and users',
            'scope': 'workspace',
            'permissions': ['manage_users', 'view_all_apps', 'manage_workspace_settings']
        }
    }
    
    # Application-level roles
    APPLICATION_ROLES = {
        'App Owner': {
            'level': 60,
            'description': 'Creator and owner of the application',
            'scope': 'application',
            'permissions': ['full_app_control', 'manage_app_users', 'manage_app_roles', 'delete_app', 
                          'manage_tables', 'manage_forms', 'manage_reports', 'manage_logic']
        },
        'App Admin': {
            'level': 50,
            'description': 'Application administrator',
            'scope': 'application',
            'permissions': ['manage_app_users', 'manage_app_data', 'manage_tables', 'manage_forms', 
                          'manage_reports', 'create_custom_roles']
        },
        'App Developer': {
            'level': 45,
            'description': 'Can modify application structure',
            'scope': 'application',
            'permissions': ['manage_tables', 'manage_forms', 'manage_reports', 'manage_logic', 
                          'view_app_settings']
        },
        'App Editor': {
            'level': 40,
            'description': 'Can create and modify data',
            'scope': 'application',
            'permissions': ['create_data', 'read_data', 'update_data', 'delete_data', 'create_reports']
        },
        'App User': {
            'level': 30,
            'description': 'Standard application user',
            'scope': 'application',
            'permissions': ['create_data', 'read_data', 'update_own_data', 'view_reports']
        },
        'App Viewer': {
            'level': 20,
            'description': 'Read-only access to application',
            'scope': 'application',
            'permissions': ['read_data', 'view_reports']
        }
    }
    
    # Core page access permissions
    CORE_PAGE_PERMISSIONS = {
        'flansa-table-builder': ['App Owner', 'App Admin', 'App Developer', 'Workspace Admin'],
        'flansa-form-builder': ['App Owner', 'App Admin', 'App Developer', 'Workspace Admin'],
        'flansa-visual-builder': ['App Owner', 'App Admin', 'App Developer', 'Workspace Admin'],
        'flansa-report-builder': ['App Owner', 'App Admin', 'App Developer', 'App Editor'],
        'flansa-database-viewer': ['App Owner', 'Workspace Admin', 'Flansa Super Admin'],
        'flansa-app-builder': ['App Owner', 'Workspace Admin', 'Workspace Manager'],
        'flansa-relationship-builder': ['App Owner', 'App Admin', 'App Developer'],
        'flansa-report-manager': ['App Editor', 'App User', 'App Viewer'],  # All can view reports
        'flansa-record-viewer': ['App Editor', 'App User', 'App Viewer'],  # All can view records
        'flansa-workspace': ['*']  # All authenticated users
    }
    
    @staticmethod
    def get_user_role_hierarchy(user_email: str, context: Dict = None) -> Dict:
        """Get complete role hierarchy for a user"""
        try:
            hierarchy = {
                'platform_roles': [],
                'workspace_roles': [],
                'application_roles': {},
                'custom_roles': {},
                'effective_level': 0,
                'highest_role': None
            }
            
            user_doc = frappe.get_doc('User', user_email)
            user_frappe_roles = [role.role for role in user_doc.roles]
            
            # Check platform roles
            for role_name in HierarchicalRoleService.PLATFORM_ROLES:
                if role_name in user_frappe_roles:
                    hierarchy['platform_roles'].append(role_name)
                    role_level = HierarchicalRoleService.PLATFORM_ROLES[role_name]['level']
                    if role_level > hierarchy['effective_level']:
                        hierarchy['effective_level'] = role_level
                        hierarchy['highest_role'] = role_name
            
            # Get workspace roles for current tenant
            if context and context.get('tenant_id'):
                workspace_roles = HierarchicalRoleService._get_workspace_roles(user_email, context['tenant_id'])
                hierarchy['workspace_roles'] = workspace_roles
                
                for role_name in workspace_roles:
                    if role_name in HierarchicalRoleService.WORKSPACE_ROLES:
                        role_level = HierarchicalRoleService.WORKSPACE_ROLES[role_name]['level']
                        if role_level > hierarchy['effective_level']:
                            hierarchy['effective_level'] = role_level
                            hierarchy['highest_role'] = role_name
            
            # Get application-specific roles
            if context and context.get('application_id'):
                app_roles = HierarchicalRoleService._get_application_roles(
                    user_email, 
                    context.get('application_id')
                )
                hierarchy['application_roles'][context['application_id']] = app_roles
                
                for role_name in app_roles:
                    if role_name in HierarchicalRoleService.APPLICATION_ROLES:
                        role_level = HierarchicalRoleService.APPLICATION_ROLES[role_name]['level']
                        if role_level > hierarchy['effective_level']:
                            hierarchy['effective_level'] = role_level
                            hierarchy['highest_role'] = role_name
            
            # Get custom roles
            custom_roles = HierarchicalRoleService._get_custom_roles(user_email, context)
            hierarchy['custom_roles'] = custom_roles
            
            return hierarchy
            
        except Exception as e:
            frappe.log_error(f"Error getting user role hierarchy: {str(e)}")
            return {
                'platform_roles': [],
                'workspace_roles': [],
                'application_roles': {},
                'custom_roles': {},
                'effective_level': 0,
                'highest_role': None
            }
    
    @staticmethod
    def _get_workspace_roles(user_email: str, tenant_id: str) -> List[str]:
        """Get workspace-level roles for a user in a specific tenant"""
        try:
            # Check if workspace roles are stored in a separate DocType
            workspace_users = frappe.get_all(
                'Flansa Workspace User',
                filters={
                    'user': user_email,
                    'tenant_id': tenant_id
                },
                fields=['workspace_role']
            )
            
            return [user.workspace_role for user in workspace_users if user.workspace_role]
        except:
            # Fallback: Check if user is workspace admin based on tenant ownership
            tenant_doc = frappe.get_value('Flansa Tenant Registry', tenant_id, 'owner')
            if tenant_doc == user_email:
                return ['Workspace Admin']
            return []
    
    @staticmethod
    def _get_application_roles(user_email: str, application_id: str) -> List[str]:
        """Get application-specific roles for a user"""
        roles = []
        
        try:
            # Check if user is the app owner
            app_doc = frappe.get_doc('Flansa Application', application_id)
            if app_doc.owner_user == user_email or app_doc.owner == user_email:
                roles.append('App Owner')
            
            # Get assigned application roles
            app_users = frappe.get_all(
                'Flansa Application User',
                filters={
                    'parent': application_id,
                    'user': user_email
                },
                fields=['role']
            )
            
            for user in app_users:
                if user.role and user.role not in roles:
                    roles.append(user.role)
            
            return roles
            
        except Exception as e:
            frappe.log_error(f"Error getting application roles: {str(e)}")
            return roles
    
    @staticmethod
    def _get_custom_roles(user_email: str, context: Dict) -> Dict:
        """Get custom roles assigned to user"""
        try:
            custom_roles = {}
            
            # Get custom roles from Flansa Custom Role DocType
            if context and context.get('application_id'):
                custom_role_assignments = frappe.get_all(
                    'Flansa Custom Role Assignment',
                    filters={
                        'user': user_email,
                        'application_id': context['application_id']
                    },
                    fields=['custom_role', 'permissions']
                )
                
                for assignment in custom_role_assignments:
                    custom_roles[assignment.custom_role] = json.loads(assignment.permissions or '[]')
            
            return custom_roles
            
        except:
            return {}
    
    @staticmethod
    def can_access_core_page(user_email: str, page_name: str, context: Dict = None) -> bool:
        """Check if user can access a specific Flansa core page"""
        try:
            # Get user's role hierarchy
            hierarchy = HierarchicalRoleService.get_user_role_hierarchy(user_email, context)
            
            # Super admins can access everything
            if 'Flansa Super Admin' in hierarchy['platform_roles']:
                return True
            
            # Check page permissions
            allowed_roles = HierarchicalRoleService.CORE_PAGE_PERMISSIONS.get(page_name, [])
            
            # Wildcard means all authenticated users
            if '*' in allowed_roles:
                return True
            
            # Check if user has any allowed role
            all_user_roles = (
                hierarchy['platform_roles'] + 
                hierarchy['workspace_roles'] + 
                list(hierarchy['application_roles'].get(context.get('application_id', ''), []))
            )
            
            return any(role in allowed_roles for role in all_user_roles)
            
        except Exception as e:
            frappe.log_error(f"Error checking page access: {str(e)}")
            return False
    
    @staticmethod
    def get_effective_permissions(user_email: str, context: Dict = None) -> Set[str]:
        """Get all effective permissions for a user in a given context"""
        permissions = set()
        
        try:
            hierarchy = HierarchicalRoleService.get_user_role_hierarchy(user_email, context)
            
            # Platform role permissions
            for role_name in hierarchy['platform_roles']:
                role_def = HierarchicalRoleService.PLATFORM_ROLES.get(role_name, {})
                role_perms = role_def.get('permissions', [])
                if '*' in role_perms:
                    # Wildcard means all permissions
                    permissions.add('*')
                    return permissions
                permissions.update(role_perms)
            
            # Workspace role permissions
            for role_name in hierarchy['workspace_roles']:
                role_def = HierarchicalRoleService.WORKSPACE_ROLES.get(role_name, {})
                permissions.update(role_def.get('permissions', []))
            
            # Application role permissions
            for app_id, app_roles in hierarchy['application_roles'].items():
                if not context or context.get('application_id') == app_id:
                    for role_name in app_roles:
                        role_def = HierarchicalRoleService.APPLICATION_ROLES.get(role_name, {})
                        permissions.update(role_def.get('permissions', []))
            
            # Custom role permissions
            for custom_role, custom_perms in hierarchy['custom_roles'].items():
                permissions.update(custom_perms)
            
            return permissions
            
        except Exception as e:
            frappe.log_error(f"Error getting effective permissions: {str(e)}")
            return set()
    
    @staticmethod
    def create_custom_role(role_name: str, application_id: str, permissions: List[str], 
                         created_by: str, description: str = "") -> Dict:
        """Create a custom role for an application"""
        try:
            # Validate that creator has permission
            creator_perms = HierarchicalRoleService.get_effective_permissions(
                created_by, 
                {'application_id': application_id}
            )
            
            if 'create_custom_roles' not in creator_perms and '*' not in creator_perms:
                frappe.throw("You don't have permission to create custom roles")
            
            # Create the custom role
            custom_role = frappe.get_doc({
                'doctype': 'Flansa Custom Role',
                'role_name': role_name,
                'application_id': application_id,
                'permissions': json.dumps(permissions),
                'description': description,
                'created_by': created_by,
                'is_active': 1
            })
            
            custom_role.insert()
            frappe.db.commit()
            
            return {
                'success': True,
                'role': custom_role.as_dict(),
                'message': f"Custom role '{role_name}' created successfully"
            }
            
        except Exception as e:
            frappe.log_error(f"Error creating custom role: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def assign_role_to_user(user_email: str, role_name: str, scope: str, 
                           context_id: str = None, assigned_by: str = None) -> Dict:
        """Assign a role to a user at the appropriate level"""
        try:
            # Determine role level and validate
            if scope == 'platform':
                # Only super admins can assign platform roles
                assigner_hierarchy = HierarchicalRoleService.get_user_role_hierarchy(assigned_by)
                if 'Flansa Super Admin' not in assigner_hierarchy['platform_roles']:
                    frappe.throw("Only Super Admins can assign platform roles")
                
                # Add Frappe role
                user_doc = frappe.get_doc('User', user_email)
                user_doc.add_roles(role_name)
                
            elif scope == 'workspace':
                # Workspace admins can assign workspace roles
                assigner_perms = HierarchicalRoleService.get_effective_permissions(
                    assigned_by,
                    {'tenant_id': context_id}
                )
                
                if 'manage_users' not in assigner_perms and '*' not in assigner_perms:
                    frappe.throw("You don't have permission to assign workspace roles")
                
                # Create workspace user entry
                workspace_user = frappe.get_doc({
                    'doctype': 'Flansa Workspace User',
                    'user': user_email,
                    'workspace_role': role_name,
                    'tenant_id': context_id,
                    'assigned_by': assigned_by
                })
                workspace_user.insert()
                
            elif scope == 'application':
                # App owners/admins can assign application roles
                assigner_perms = HierarchicalRoleService.get_effective_permissions(
                    assigned_by,
                    {'application_id': context_id}
                )
                
                if 'manage_app_users' not in assigner_perms and '*' not in assigner_perms:
                    frappe.throw("You don't have permission to assign application roles")
                
                # Add to application users
                app_doc = frappe.get_doc('Flansa Application', context_id)
                app_doc.append('allowed_users', {
                    'user': user_email,
                    'role': role_name
                })
                app_doc.save()
            
            frappe.db.commit()
            
            return {
                'success': True,
                'message': f"Role '{role_name}' assigned to {user_email}"
            }
            
        except Exception as e:
            frappe.log_error(f"Error assigning role: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# API Methods
@frappe.whitelist()
def get_user_hierarchy(application_id=None):
    """Get current user's role hierarchy"""
    context = {
        'tenant_id': frappe.local.tenant_id if hasattr(frappe.local, 'tenant_id') else None,
        'application_id': application_id
    }
    return HierarchicalRoleService.get_user_role_hierarchy(frappe.session.user, context)


@frappe.whitelist()
def check_page_access(page_name, application_id=None):
    """Check if current user can access a specific page"""
    context = {
        'tenant_id': frappe.local.tenant_id if hasattr(frappe.local, 'tenant_id') else None,
        'application_id': application_id
    }
    return HierarchicalRoleService.can_access_core_page(frappe.session.user, page_name, context)


@frappe.whitelist()
def get_user_permissions(application_id=None):
    """Get effective permissions for current user"""
    context = {
        'tenant_id': frappe.local.tenant_id if hasattr(frappe.local, 'tenant_id') else None,
        'application_id': application_id
    }
    permissions = HierarchicalRoleService.get_effective_permissions(frappe.session.user, context)
    return list(permissions)


@frappe.whitelist()
def create_app_custom_role(role_name, application_id, permissions, description=""):
    """Create a custom role for an application"""
    if isinstance(permissions, str):
        permissions = json.loads(permissions)
    return HierarchicalRoleService.create_custom_role(
        role_name, 
        application_id, 
        permissions,
        frappe.session.user,
        description
    )


@frappe.whitelist()
def assign_user_role(user_email, role_name, scope, context_id=None):
    """Assign a role to a user"""
    return HierarchicalRoleService.assign_role_to_user(
        user_email,
        role_name,
        scope,
        context_id,
        frappe.session.user
    )