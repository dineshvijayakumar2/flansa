#!/usr/bin/env python3
"""
Flansa Tenant Service - Multi-tenant context resolution and management
"""

import frappe
import re
from typing import Optional, Dict, Any

class TenantContext:
    """Manages tenant context throughout the application"""
    
    _current_tenant_id = None
    _tenant_cache = {}
    
    @classmethod
    def get_current_tenant_id(cls) -> str:
        """Get the current active tenant ID"""
        
        if cls._current_tenant_id:
            return cls._current_tenant_id
            
        # Try to resolve from various sources
        tenant_id = (
            cls._resolve_from_domain() or 
            cls._resolve_from_session() or
            cls._resolve_from_user() or
            cls._get_default_tenant()
        )
        
        cls._current_tenant_id = tenant_id
        return tenant_id
    
    @classmethod
    def get_current_tenant(cls) -> Dict[str, Any]:
        """Get full tenant details for current tenant"""
        
        tenant_id = cls.get_current_tenant_id()
        
        if tenant_id in cls._tenant_cache:
            return cls._tenant_cache[tenant_id]
            
        try:
            tenant_doc = frappe.get_doc("Flansa Tenant Registry", tenant_id)
            tenant_data = {
                "tenant_id": tenant_doc.tenant_id,
                "tenant_name": tenant_doc.tenant_name,
                "primary_domain": tenant_doc.primary_domain,
                "status": tenant_doc.tenant_status,
                "type": tenant_doc.tenant_type,
                "max_users": tenant_doc.max_users,
                "max_apps": tenant_doc.max_apps
            }
            
            cls._tenant_cache[tenant_id] = tenant_data
            return tenant_data
            
        except frappe.DoesNotExistError:
            # Fallback to default tenant
            return cls._get_default_tenant_data()
    
    @classmethod
    def set_tenant_context(cls, tenant_id: str):
        """Manually set tenant context (for testing/admin purposes)"""
        cls._current_tenant_id = tenant_id
        if tenant_id in cls._tenant_cache:
            del cls._tenant_cache[tenant_id]  # Refresh cache
    
    @classmethod
    def clear_context(cls):
        """Clear tenant context"""
        cls._current_tenant_id = None
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
            tenant = frappe.db.get_value("Flansa Tenant Registry", {"primary_domain": host}, "name")
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
                    
                    # Look for tenant with this subdomain as tenant_id
                    tenant = frappe.db.get_value("Flansa Tenant Registry", {"tenant_id": subdomain}, "name")
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
                return frappe.local.session.get('tenant_id')
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
        """Get the default tenant ID"""
        
        try:
            default_tenant = frappe.db.get_value("Flansa Tenant Registry", {"tenant_id": "default"}, "name")
            if default_tenant:
                return default_tenant
                
            # If no default, get the first active tenant
            first_tenant = frappe.db.get_value("Flansa Tenant Registry", {"tenant_status": "Active"}, "name")
            if first_tenant:
                return first_tenant
                
            # Last resort - get any tenant
            any_tenant = frappe.db.get_value("Flansa Tenant Registry", {}, "name")
            return any_tenant or "default"
            
        except Exception:
            return "default"
    
    @classmethod
    def _get_default_tenant_data(cls) -> Dict[str, Any]:
        """Get default tenant data when tenant not found"""
        
        return {
            "tenant_id": "default",
            "tenant_name": "Default Tenant", 
            "primary_domain": frappe.local.site or "localhost",
            "status": "Active",
            "type": "Production",
            "max_users": 1000,
            "max_apps": 100
        }


def get_tenant_filter() -> Dict[str, str]:
    """Get filter for current tenant - use in all queries"""
    
    tenant_id = TenantContext.get_current_tenant_id()
    return {"tenant_id": tenant_id}


def apply_tenant_filter(filters: Dict[str, Any]) -> Dict[str, Any]:
    """Apply tenant filter to existing filter dict"""
    
    tenant_filter = get_tenant_filter()
    if filters is None:
        return tenant_filter
    
    if isinstance(filters, dict):
        filters.update(tenant_filter)
        return filters
    
    # For list filters, append tenant filter
    if isinstance(filters, list):
        filters.append(["tenant_id", "=", tenant_filter["tenant_id"]])
        return filters
    
    return filters


def set_tenant_on_doc(doc) -> None:
    """Set tenant_id on document before save"""
    
    if hasattr(doc, 'tenant_id') and not doc.tenant_id:
        tenant_id = None
        
        # For Flansa Table, inherit tenant_id from parent application
        if doc.doctype == "Flansa Table" and doc.application:
            app_tenant_id = frappe.db.get_value("Flansa Application", doc.application, "tenant_id")
            if app_tenant_id:
                tenant_id = app_tenant_id
        
        # If no inherited tenant_id, use current tenant context
        if not tenant_id:
            tenant_id = TenantContext.get_current_tenant_id()
        
        doc.tenant_id = tenant_id


# Hook functions for Frappe events
def before_insert(doc, method):
    """Before insert hook to set tenant context"""
    
    # Only apply to Flansa metadata doctypes
    if doc.doctype.startswith("Flansa ") and hasattr(doc, 'tenant_id'):
        set_tenant_on_doc(doc)


def validate_tenant_access(doc, method):
    """Validate user has access to the tenant"""
    
    if doc.doctype.startswith("Flansa ") and hasattr(doc, 'tenant_id'):
        current_tenant = TenantContext.get_current_tenant_id()
        
        if doc.tenant_id and doc.tenant_id != current_tenant:
            frappe.throw(f"Access denied: Document belongs to different tenant", frappe.PermissionError)


# Utility functions
def get_tenant_apps(tenant_id: Optional[str] = None) -> list:
    """Get all applications for a tenant"""
    
    if not tenant_id:
        tenant_id = TenantContext.get_current_tenant_id()
    
    return frappe.get_all("Flansa Application", 
                         filters={"tenant_id": tenant_id},
                         fields=["name", "app_title", "status"])


def get_tenant_tables(app_id: str, tenant_id: Optional[str] = None) -> list:
    """Get all tables for an app within tenant context"""
    
    if not tenant_id:
        tenant_id = TenantContext.get_current_tenant_id()
    
    return frappe.get_all("Flansa Table",
                         filters={
                             "application": app_id,
                             "tenant_id": tenant_id
                         },
                         fields=["name", "table_label", "status"])


def is_multi_tenant_enabled() -> bool:
    """Check if multi-tenant mode is enabled"""
    
    tenant_count = frappe.db.count("Flansa Tenant Registry")
    return tenant_count > 1


def get_tenant_stats(tenant_id: Optional[str] = None) -> Dict[str, int]:
    """Get usage statistics for a tenant"""
    
    if not tenant_id:
        tenant_id = TenantContext.get_current_tenant_id()
    
    return {
        "apps": frappe.db.count("Flansa Application", {"tenant_id": tenant_id}),
        "tables": frappe.db.count("Flansa Table", {"tenant_id": tenant_id}), 
        "relationships": frappe.db.count("Flansa Relationship", {"tenant_id": tenant_id}),
        "reports": frappe.db.count("Flansa Saved Report", {"tenant_id": tenant_id})
    }