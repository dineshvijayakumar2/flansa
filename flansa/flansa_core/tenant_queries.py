"""
Tenant-aware database query helpers
"""
import frappe
from flansa.flansa_core.workspace_security import apply_workspace_filter, get_current_workspace

def get_tenant_records(doctype, filters=None, fields=None, limit=None, order_by=None):
    """Get records with automatic tenant filtering"""
    filters = apply_workspace_filter(doctype, filters)
    
    return frappe.get_all(doctype, 
                         filters=filters,
                         fields=fields,
                         limit=limit,
                         order_by=order_by)

def get_tenant_doc(doctype, name):
    """Get document with tenant validation"""
    doc = frappe.get_doc(doctype, name)
    
    # Validate tenant access
    current_tenant = get_current_workspace()
    if hasattr(doc, 'workspace_id') and doc.workspace_id != current_tenant:
        frappe.throw("Access denied. Document belongs to different tenant.")
    
    return doc

def count_tenant_records(doctype, filters=None):
    """Count records with tenant filtering"""
    filters = apply_workspace_filter(doctype, filters)
    return frappe.db.count(doctype, filters)

def exists_in_tenant(doctype, name):
    """Check if document exists in current tenant"""
    try:
        doc = get_tenant_doc(doctype, name)
        return True
    except:
        return False
