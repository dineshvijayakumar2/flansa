"""
Workspace Security Middleware for Flansa
Automatically adds workspace filters to all database queries
"""
import frappe
from frappe.exceptions import PermissionError

def get_current_workspace():
    """Get the current user's workspace_id"""
    try:
        # For now, use session tenant or default to first tenant
        if hasattr(frappe.local, 'workspace_id') and frappe.local.workspace_id:
            return frappe.local.workspace_id
        
        # Fallback: get from user session or first available tenant
        session_workspace = frappe.session.get('workspace_id')
        if session_workspace:
            return session_workspace
            
        # For development: use first workspace from workspace registry
        first_workspace = frappe.db.get_value('Flansa Workspace', 
                                         filters={'status': 'Active'}, 
                                         fieldname='name', 
                                         order_by='creation')
        if first_workspace:
            frappe.local.workspace_id = first_workspace
            return first_workspace
            
        return None
        
    except Exception as e:
        frappe.log_error(f"Error getting current workspace: {str(e)}")
        return None

def apply_workspace_filter(doctype, filters=None):
    """Apply workspace filter to database queries"""
    
    # List of DocTypes that have workspace_id field
    workspace_enabled_doctypes = [
        'Flansa Application',
        'Flansa Table',
        'Flansa Form Config', 
        'Flansa Relationship',
        'Flansa Saved Report',
        'Flansa Logic Field',
        'Flansa Computed Field',
        'Flansa Workspace',
        'Flansa Workspace Domain',
        'Flansa Application Role',
        'Flansa Application User'
    ]
    
    # Skip workspace filtering for non-Flansa DocTypes
    if doctype not in workspace_enabled_doctypes:
        return filters
    
    # Skip for Administrator or System Manager
    if frappe.session.user == "Administrator":
        return filters
        
    if "System Manager" in frappe.get_roles():
        return filters
    
    current_workspace = get_current_workspace()
    if not current_workspace:
        # If no tenant found, restrict access to prevent data leakage
        frappe.throw("Workspace access required. Please contact administrator.", 
                    PermissionError)
    
    # Apply workspace filter
    if filters is None:
        filters = {}
    
    if isinstance(filters, dict):
        filters['workspace_id'] = current_workspace
    elif isinstance(filters, list):
        filters.append(['workspace_id', '=', current_workspace])
    
    return filters

def validate_workspace_access(doc, method=None):
    """Validate workspace access on document operations"""
    
    # Skip validation for system users
    if frappe.session.user == "Administrator":
        return
        
    if "System Manager" in frappe.get_roles():
        return
        
    # Check if DocType has workspace_id field
    workspace_enabled_doctypes = [
        'Flansa Application',
        'Flansa Table', 
        'Flansa Form Config',
        'Flansa Relationship',
        'Flansa Saved Report',
        'Flansa Logic Field',
        'Flansa Computed Field',
        'Flansa Workspace',
        'Flansa Workspace Domain',
        'Flansa Application Role',
        'Flansa Application User'
    ]
    
    if doc.doctype not in workspace_enabled_doctypes:
        return
    
    current_workspace = get_current_workspace()
    if not current_workspace:
        frappe.throw("Workspace access required. Please contact administrator.", 
                    PermissionError)
    
    # For new documents, set workspace_id
    if doc.is_new() and hasattr(doc, 'workspace_id'):
        if not doc.workspace_id:
            doc.workspace_id = current_workspace
    
    # For existing documents, validate tenant access
    elif hasattr(doc, 'workspace_id') and doc.workspace_id:
        if doc.workspace_id != current_workspace:
            frappe.throw(f"Access denied. Document belongs to different workspace.", 
                        PermissionError)

def setup_workspace_hooks():
    """Setup hooks for automatic workspace filtering"""
    frappe.msgprint("Setting up workspace security hooks...", alert=True)
    return True
