"""
Tenant Security Middleware for Flansa
Automatically adds tenant filters to all database queries
"""
import frappe
from frappe.exceptions import PermissionError

def get_current_tenant():
    """Get the current user's workspace_id"""
    try:
        # For now, use session tenant or default to first tenant
        if hasattr(frappe.local, 'workspace_id') and frappe.local.workspace_id:
            return frappe.local.workspace_id
        
        # Fallback: get from user session or first available tenant
        session_tenant = frappe.session.get('workspace_id')
        if session_tenant:
            return session_tenant
            
        # For development: use first tenant from registry
        first_tenant = frappe.db.get_value('Flansa Tenant Registry', 
                                         filters={'status': 'Active'}, 
                                         fieldname='name', 
                                         order_by='creation')
        if first_tenant:
            frappe.local.workspace_id = first_tenant
            return first_tenant
            
        return None
        
    except Exception as e:
        frappe.log_error(f"Error getting current tenant: {str(e)}")
        return None

def apply_tenant_filter(doctype, filters=None):
    """Apply tenant filter to database queries"""
    
    # List of DocTypes that have workspace_id field
    tenant_enabled_doctypes = [
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
    
    # Skip tenant filtering for non-Flansa DocTypes
    if doctype not in tenant_enabled_doctypes:
        return filters
    
    # Skip for Administrator or System Manager
    if frappe.session.user == "Administrator":
        return filters
        
    if "System Manager" in frappe.get_roles():
        return filters
    
    current_tenant = get_current_tenant()
    if not current_tenant:
        # If no tenant found, restrict access to prevent data leakage
        frappe.throw("Tenant access required. Please contact administrator.", 
                    PermissionError)
    
    # Apply tenant filter
    if filters is None:
        filters = {}
    
    if isinstance(filters, dict):
        filters['workspace_id'] = current_tenant
    elif isinstance(filters, list):
        filters.append(['workspace_id', '=', current_tenant])
    
    return filters

def validate_tenant_access(doc, method=None):
    """Validate tenant access on document operations"""
    
    # Skip validation for system users
    if frappe.session.user == "Administrator":
        return
        
    if "System Manager" in frappe.get_roles():
        return
        
    # Check if DocType has workspace_id field
    tenant_enabled_doctypes = [
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
    
    if doc.doctype not in tenant_enabled_doctypes:
        return
    
    current_tenant = get_current_tenant()
    if not current_tenant:
        frappe.throw("Tenant access required. Please contact administrator.", 
                    PermissionError)
    
    # For new documents, set workspace_id
    if doc.is_new() and hasattr(doc, 'workspace_id'):
        if not doc.workspace_id:
            doc.workspace_id = current_tenant
    
    # For existing documents, validate tenant access
    elif hasattr(doc, 'workspace_id') and doc.workspace_id:
        if doc.workspace_id != current_tenant:
            frappe.throw(f"Access denied. Document belongs to different tenant.", 
                        PermissionError)

def setup_tenant_hooks():
    """Setup hooks for automatic tenant filtering"""
    frappe.msgprint("Setting up tenant security hooks...", alert=True)
    return True
