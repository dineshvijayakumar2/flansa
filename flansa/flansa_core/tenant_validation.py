"""
Tenant Security Validation Middleware
Comprehensive validation and enforcement of tenant isolation
"""
import frappe
from frappe import _
from frappe.exceptions import PermissionError, ValidationError
import json

class TenantValidator:
    """Handles all tenant-related validation and security checks"""
    
    def __init__(self):
        self.tenant_enabled_doctypes = [
            'Flansa Application',
            'Flansa Table',
            'Flansa Form Config',
            'Flansa Relationship', 
            'Flansa Saved Report',
            'Flansa Logic Field',
            'Flansa Computed Field',
            'Flansa Tenant Registry',
            'Flansa Tenant Domain',
            'Flansa Application Role',
            'Flansa Application User'
        ]
    
    def get_current_tenant(self):
        """Get current user's tenant with fallback logic"""
        try:
            # Check session first
            if hasattr(frappe.local, 'tenant_id') and frappe.local.tenant_id:
                return frappe.local.tenant_id
            
            # Check user session
            session_tenant = frappe.session.get('tenant_id')
            if session_tenant:
                frappe.local.tenant_id = session_tenant
                return session_tenant
            
            # For development/admin: use first active tenant
            if frappe.session.user == "Administrator" or "System Manager" in frappe.get_roles():
                first_tenant = frappe.db.get_value(
                    'Flansa Tenant Registry',
                    filters={'status': 'Active'},
                    fieldname='name',
                    order_by='creation'
                )
                if first_tenant:
                    frappe.local.tenant_id = first_tenant
                    return first_tenant
            
            return None
            
        except Exception as e:
            frappe.log_error(f"Error getting current tenant: {str(e)}")
            return None
    
    def is_system_user(self):
        """Check if current user is system admin"""
        return (frappe.session.user == "Administrator" or 
                "System Manager" in frappe.get_roles())
    
    def validate_document_access(self, doc, method=None):
        """Validate tenant access for document operations"""
        
        # Skip validation for system users
        if self.is_system_user():
            return
        
        # Only validate tenant-enabled DocTypes
        if doc.doctype not in self.tenant_enabled_doctypes:
            return
        
        current_tenant = self.get_current_tenant()
        if not current_tenant:
            frappe.throw(
                _("Tenant access required. Please contact administrator."),
                PermissionError
            )
        
        # Handle new documents
        if doc.is_new():
            if hasattr(doc, 'tenant_id'):
                if not doc.tenant_id:
                    doc.tenant_id = current_tenant
                    frappe.msgprint(f"Document assigned to tenant: {current_tenant}", 
                                   alert=True, indicator='blue')
        
        # Validate existing documents
        else:
            if hasattr(doc, 'tenant_id') and doc.tenant_id:
                if doc.tenant_id != current_tenant:
                    frappe.throw(
                        _("Access denied. Document belongs to different tenant: {0}").format(doc.tenant_id),
                        PermissionError
                    )
    
    def apply_query_filter(self, doctype, filters=None):
        """Apply tenant filter to database queries"""
        
        # Skip non-tenant DocTypes
        if doctype not in self.tenant_enabled_doctypes:
            return filters
        
        # Skip for system users
        if self.is_system_user():
            return filters
        
        current_tenant = self.get_current_tenant()
        if not current_tenant:
            # Restrictive: no tenant = no data
            if isinstance(filters, dict):
                filters = filters or {}
                filters['tenant_id'] = '__no_tenant_access__'  # Impossible value
            else:
                filters = filters or []
                if isinstance(filters, list):
                    filters.append(['tenant_id', '=', '__no_tenant_access__'])
            return filters
        
        # Apply tenant filter
        if isinstance(filters, dict):
            filters = filters or {}
            filters['tenant_id'] = current_tenant
        elif isinstance(filters, list):
            filters = filters or []
            filters.append(['tenant_id', '=', current_tenant])
        else:
            # Handle string filters or other formats
            filters = {'tenant_id': current_tenant}
        
        return filters
    
    def validate_api_access(self, method_path, args=None):
        """Validate API access with tenant context"""
        
        current_tenant = self.get_current_tenant()
        
        # Log API access for audit
        frappe.logger().info(f"API Access: {method_path} | Tenant: {current_tenant} | User: {frappe.session.user}")
        
        # Specific validations for sensitive operations
        if 'delete' in method_path.lower():
            if not current_tenant and not self.is_system_user():
                frappe.throw(_("Deletion operations require tenant access"), PermissionError)
        
        return True
    
    def audit_data_access(self, doctype, operation, document_name=None, count=None):
        """Audit data access for compliance"""
        
        audit_data = {
            'user': frappe.session.user,
            'tenant': self.get_current_tenant(),
            'doctype': doctype,
            'operation': operation,
            'document': document_name,
            'count': count,
            'timestamp': frappe.utils.now(),
            'ip_address': frappe.local.request.environ.get('REMOTE_ADDR') if frappe.local.request else None
        }
        
        # Log to system (can be enhanced to write to audit table)
        frappe.logger().info(f"Data Access Audit: {json.dumps(audit_data)}")

# Global validator instance
tenant_validator = TenantValidator()

# Hook functions for Frappe
def validate_tenant_document_access(doc, method=None):
    """Hook for document validation"""
    tenant_validator.validate_document_access(doc, method)

def apply_tenant_filter(doctype, filters=None):
    """Apply tenant filtering to queries"""
    return tenant_validator.apply_query_filter(doctype, filters)

def validate_api_tenant_access(method_path, args=None):
    """Hook for API validation"""
    return tenant_validator.validate_api_access(method_path, args)

def audit_tenant_access(doctype, operation, document_name=None, count=None):
    """Audit data access"""
    tenant_validator.audit_data_access(doctype, operation, document_name, count)

# Utility functions for API use
def get_current_tenant():
    """Utility to get current tenant"""
    return tenant_validator.get_current_tenant()

def is_system_user():
    """Utility to check if user is system admin"""
    return tenant_validator.is_system_user()

def ensure_tenant_access():
    """Ensure user has tenant access or throw error"""
    if not tenant_validator.get_current_tenant() and not tenant_validator.is_system_user():
        frappe.throw(_("Tenant access required"), PermissionError)
    return True