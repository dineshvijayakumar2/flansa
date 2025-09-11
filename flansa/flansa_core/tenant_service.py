#!/usr/bin/env python3
"""
Flansa Tenant Service - Multi-tenant context resolution and management
"""

import frappe
import re
from typing import Optional, Dict, Any

class TenantContext:
    """Manages tenant context throughout the application"""
    
    _current_workspace_id = None
    _tenant_cache = {}
    
    @classmethod
    def get_current_workspace_id(cls) -> str:
        """Get the current active workspace ID"""
        
        if cls._current_workspace_id:
            return cls._current_workspace_id
            
        # Try to resolve from various sources
        workspace_id = (
            cls._resolve_from_domain() or 
            cls._resolve_from_session() or
            cls._resolve_from_user() or
            cls._get_default_tenant()
        )
        
        cls._current_workspace_id = workspace_id
        return workspace_id
    
    @classmethod
    def get_current_tenant(cls) -> Dict[str, Any]:
        """Get full tenant details for current tenant"""
        
        workspace_id = cls.get_current_workspace_id()
        
        if workspace_id in cls._tenant_cache:
            return cls._tenant_cache[workspace_id]
            
        try:
            tenant_doc = frappe.get_doc("Flansa Workspace", workspace_id)
            tenant_data = {
                "workspace_id": tenant_doc.workspace_id,
                "tenant_name": tenant_doc.tenant_name,
                "primary_domain": tenant_doc.primary_domain,
                "status": tenant_doc.status,
                "type": "Production",  # Default type since tenant_type field doesn't exist
                "max_users": tenant_doc.max_users,
                "max_tables": getattr(tenant_doc, 'max_tables', 50)  # Use max_tables instead of max_apps
            }
            
            cls._tenant_cache[workspace_id] = tenant_data
            return tenant_data
            
        except frappe.DoesNotExistError:
            # Fallback to default tenant
            return cls._get_default_tenant_data()
    
    @classmethod
    def set_tenant_context(cls, workspace_id: str):
        """Manually set tenant context (for testing/admin purposes)"""
        cls._current_workspace_id = workspace_id
        if workspace_id in cls._tenant_cache:
            del cls._tenant_cache[workspace_id]  # Refresh cache
    
    @classmethod
    def clear_context(cls):
        """Clear tenant context"""
        cls._current_workspace_id = None
        cls._tenant_cache = {}
    
    @classmethod 
    def _resolve_from_domain(cls) -> Optional[str]:
        """Resolve tenant from current domain/host"""
        
        try:
            if not hasattr(frappe.local, 'request') or not frappe.local.request:
                return None
                
            host = frappe.local.request.host
            if not host:
                return None
            
            # Check exact domain match first
            tenant = frappe.db.get_value("Flansa Workspace", {"primary_domain": host}, "name")
            if tenant:
                return tenant
            
            # Check custom domains
            custom_domain = frappe.db.sql("""
                SELECT parent FROM `tabFlansa Tenant Domain` 
                WHERE domain = %s AND is_verified = 1
            """, (host,))
            
            if custom_domain:
                return custom_domain[0][0]
            
            # Parse subdomain patterns (e.g., mcgi.flansa.io)
            if '.' in host:
                parts = host.split('.')
                if len(parts) >= 2:
                    subdomain = parts[0]
                    
                    # Look for tenant with this subdomain as workspace_id
                    tenant = frappe.db.get_value("Flansa Workspace", {"workspace_id": subdomain}, "name")
                    if tenant:
                        return tenant
            
            return None
            
        except Exception:
            return None
    
    @classmethod
    def _resolve_from_session(cls) -> Optional[str]:
        """Resolve tenant from session data"""
        
        try:
            if hasattr(frappe.local, 'session') and frappe.local.session:
                return frappe.local.session.get('workspace_id')
        except Exception:
            pass
        
        return None
    
    @classmethod
    def _resolve_from_user(cls) -> Optional[str]:
        """Resolve tenant from user preferences/assignments"""
        
        try:
            # For now, return None - in future could check user tenant assignments
            return None
        except Exception:
            return None
    
    @classmethod
    def _get_default_tenant(cls) -> str:
        """Get the default workspace ID"""
        
        try:
            default_tenant = frappe.db.get_value("Flansa Workspace", {"workspace_id": "default"}, "name")
            if default_tenant:
                return default_tenant
                
            # If no default, get the first active tenant
            first_tenant = frappe.db.get_value("Flansa Workspace", {"status": "Active"}, "name")
            if first_tenant:
                return first_tenant
                
            # Last resort - get any tenant
            any_tenant = frappe.db.get_value("Flansa Workspace", {}, "name")
            return any_tenant or "default"
            
        except Exception:
            return "default"
    
    @classmethod
    def _get_default_tenant_data(cls) -> Dict[str, Any]:
        """Get default tenant data when tenant not found"""
        
        return {
            "workspace_id": "default",
            "tenant_name": "Default Tenant", 
            "primary_domain": frappe.local.site or "localhost",
            "status": "Active",
            "type": "Production",
            "max_users": 1000,
            "max_tables": 100
        }

def resolve_tenant_from_request():
    """Resolve tenant context from current request domain - called on every request"""
    try:
        if hasattr(frappe.local, 'request') and frappe.local.request:
            # Get current tenant from domain
            workspace_id = TenantContext.get_current_workspace_id()
            
            # Set in frappe.local for easy access throughout request
            frappe.local.workspace_id = workspace_id
            
            # Optional: Set in session for persistence
            if hasattr(frappe.local, 'session') and frappe.local.session:
                frappe.local.session.workspace_id = workspace_id
                
    except Exception as e:
        # Fail silently to not break requests
        frappe.local.workspace_id = "default"


def get_workspace_filter() -> Dict[str, str]:
    """Get filter for current tenant - use in all queries"""
    
    workspace_id = TenantContext.get_current_workspace_id()
    return {"workspace_id": workspace_id}


def apply_tenant_filter(filters: Dict[str, Any]) -> Dict[str, Any]:
    """Apply tenant filter to existing filter dict"""
    
    tenant_filter = get_workspace_filter()
    if filters is None:
        return tenant_filter
    
    if isinstance(filters, dict):
        filters.update(tenant_filter)
        return filters
    
    # For list filters, append tenant filter
    if isinstance(filters, list):
        filters.append(["workspace_id", "=", tenant_filter["workspace_id"]])
        return filters
    
    return filters


def set_tenant_on_doc(doc) -> None:
    """Set workspace_id on document before save"""
    
    if hasattr(doc, 'workspace_id') and not doc.workspace_id:
        workspace_id = None
        
        # For Flansa Table, inherit workspace_id from parent application
        if doc.doctype == "Flansa Table" and doc.application:
            app_workspace_id = frappe.db.get_value("Flansa Application", doc.application, "workspace_id")
            if app_workspace_id:
                workspace_id = app_workspace_id
        
        # If no inherited workspace_id, use current tenant context
        if not workspace_id:
            workspace_id = TenantContext.get_current_workspace_id()
        
        doc.workspace_id = workspace_id


# Hook functions for Frappe events
def before_insert(doc, method):
    """Before insert hook to set tenant context"""
    
    # Only apply to Flansa metadata doctypes
    if doc.doctype.startswith("Flansa ") and hasattr(doc, 'workspace_id'):
        set_tenant_on_doc(doc)


def validate_tenant_access(doc, method):
    """Validate user has access to the tenant"""
    
    if doc.doctype.startswith("Flansa ") and hasattr(doc, 'workspace_id'):
        current_tenant = TenantContext.get_current_workspace_id()
        
        if doc.workspace_id and doc.workspace_id != current_tenant:
            frappe.throw(f"Access denied: Document belongs to different tenant", frappe.PermissionError)


# Utility functions
def get_workspace_apps(workspace_id: Optional[str] = None) -> list:
    """Get all applications for a tenant"""
    
    if not workspace_id:
        workspace_id = TenantContext.get_current_workspace_id()
    
    return frappe.get_all("Flansa Application", 
                         filters={"workspace_id": workspace_id},
                         fields=["name", "app_title", "status"])


def get_workspace_tables(app_id: str, workspace_id: Optional[str] = None) -> list:
    """Get all tables for an app within tenant context"""
    
    if not workspace_id:
        workspace_id = TenantContext.get_current_workspace_id()
    
    return frappe.get_all("Flansa Table",
                         filters={
                             "application": app_id,
                             "workspace_id": workspace_id
                         },
                         fields=["name", "table_label", "status"])


def is_multi_tenant_enabled() -> bool:
    """Check if multi-tenant mode is enabled"""
    
    tenant_count = frappe.db.count("Flansa Workspace")
    return tenant_count > 1


def get_workspace_stats(workspace_id: Optional[str] = None) -> Dict[str, int]:
    """Get usage statistics for a tenant"""
    
    if not workspace_id:
        workspace_id = TenantContext.get_current_workspace_id()
    
    return {
        "apps": frappe.db.count("Flansa Application", {"workspace_id": workspace_id}),
        "tables": frappe.db.count("Flansa Table", {"workspace_id": workspace_id}), 
        "relationships": frappe.db.count("Flansa Relationship", {"workspace_id": workspace_id}),
        "reports": frappe.db.count("Flansa Saved Report", {"workspace_id": workspace_id})
    }

@frappe.whitelist()
def get_workspace_logo(workspace_id=None):
    """Get workspace logo configuration"""
    try:
        if not workspace_id:
            # Try to get workspace_id from session first
            workspace_id = frappe.session.get('workspace_id')
            if not workspace_id:
                # Try to get from TenantContext if available
                try:
                    workspace_id = TenantContext.get_current_workspace_id()
                except:
                    # Fallback: get the first active tenant
                    first_tenant = frappe.db.get_value(
                        "Flansa Workspace", 
                        {"status": "Active"}, 
                        "workspace_id", 
                        order_by="creation"
                    )
                    workspace_id = first_tenant
            
        if not workspace_id:
            return {"logo": None, "workspace_name": None, "error": "No tenant context found"}
        
        # Check if workspace has custom workspace logo configured
        workspace_settings = frappe.db.get_value(
            "Flansa Workspace", 
            workspace_id, 
            ["workspace_logo", "workspace_name"], 
            as_dict=True
        )
        
        if workspace_settings:
            return {
                "logo": workspace_settings.get("workspace_logo"),
                "workspace_name": workspace_settings.get("workspace_name"),
                "success": True
            }
        
        return {"logo": None, "workspace_name": None, "success": True}
        
    except Exception as e:
        frappe.log_error(f"Error getting workspace logo: {str(e)}")
        return {"logo": None, "workspace_name": None, "success": False, "error": str(e)}

# Backward compatibility alias
@frappe.whitelist()
def get_tenant_logo(workspace_id=None):
    """Backward compatibility - use get_workspace_logo instead"""
    return get_workspace_logo(workspace_id)

@frappe.whitelist()
def set_workspace_logo(workspace_logo=None):
    """Set workspace logo for current workspace"""
    try:
        # Try to get workspace_id from session first
        workspace_id = frappe.session.get('workspace_id')
        if not workspace_id:
            # Try to get from TenantContext if available
            try:
                workspace_id = TenantContext.get_current_workspace_id()
            except:
                # Fallback: get the first active tenant
                first_tenant = frappe.db.get_value(
                    "Flansa Workspace", 
                    {"status": "Active"}, 
                    "workspace_id", 
                    order_by="creation"
                )
                workspace_id = first_tenant
        
        if not workspace_id:
            return {"success": False, "message": "No active workspace"}
            
        # Update workspace logo
        frappe.db.set_value("Flansa Workspace", workspace_id, "workspace_logo", workspace_logo)
        frappe.db.commit()
        
        return {"success": True, "message": "Workspace logo updated successfully"}
        
    except Exception as e:
        frappe.log_error(f"Error setting workspace logo: {str(e)}")
        return {"success": False, "message": str(e)}

# Backward compatibility alias
@frappe.whitelist()
def set_tenant_logo(tenant_logo=None):
    """Backward compatibility - use set_workspace_logo instead"""
    return set_workspace_logo(tenant_logo)
