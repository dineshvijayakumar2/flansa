"""
ID-based utilities for Flansa platform
Uses unique IDs instead of names for DocType generation
"""

import frappe

def generate_id_based_doctype_name(workspace_id, application_id, table_id):
    """Generate DocType name using unique IDs - ensures name starts with a letter"""
    try:
        # Clean workspace_id - remove special chars
        clean_tenant = str(workspace_id).replace('-', '').replace('_', '').replace(' ', '')[:10]
        
        # Use first 8 chars of hash IDs
        clean_app = str(application_id)[:8] if application_id else "app"
        clean_table = str(table_id)[:8] if table_id else "table"
        
        # Build the DocType name
        # Pattern: {clean_tenant}_{app_hash}_{table_hash}
        doctype_name = f"{clean_tenant}_{clean_app}_{clean_table}"
        
        # IMPORTANT: Check if name starts with a letter (Frappe requirement)
        # Only add 'FLS' prefix if the name doesn't start with a letter
        if doctype_name and not doctype_name[0].isalpha():
            # Add FLS prefix only when needed
            doctype_name = f"FLS_{doctype_name}"
        
        # Ensure reasonable length (Frappe limit is ~140 but keep it practical)
        if len(doctype_name) > 60:
            # Truncate parts proportionally
            if doctype_name.startswith("FLS_"):
                # Keep FLS prefix and truncate the rest
                clean_tenant = clean_tenant[:6]
                clean_app = clean_app[:6]
                clean_table = clean_table[:6]
                doctype_name = f"FLS_{clean_tenant}_{clean_app}_{clean_table}"
            else:
                clean_tenant = clean_tenant[:8]
                clean_app = clean_app[:6]
                clean_table = clean_table[:6]
                doctype_name = f"{clean_tenant}_{clean_app}_{clean_table}"
        
        # Replace any remaining invalid characters
        import re
        doctype_name = re.sub(r'[^a-zA-Z0-9_\- ]', '', doctype_name)
        
        # Final check - if still doesn't start with letter, add FLS
        if not doctype_name[0].isalpha():
            doctype_name = f"FLS_{doctype_name}"
        
        return doctype_name
        
    except Exception as e:
        frappe.log_error(f"Error generating ID-based DocType name: {str(e)}")
        # Fallback with guaranteed valid prefix
        return f"FLS_ERR_{str(application_id)[:6]}_{str(table_id)[:6]}"

def get_workspace_id_from_context():
    """Get workspace_id from current context or default"""
    try:
        from flansa.flansa_core.tenant_security import get_current_tenant
        workspace_id = get_current_tenant()
        return workspace_id if workspace_id else "default"
    except Exception:
        return "default"

def get_workspace_id_from_application(application_id):
    """Get workspace_id from the Flansa Application (preferred method for consistent tenant lookup)"""
    try:
        if not application_id:
            return get_workspace_id_from_context()  # Fallback
        
        app_doc = frappe.get_doc("Flansa Application", application_id)
        
        if hasattr(app_doc, 'workspace_id') and app_doc.workspace_id:
            return app_doc.workspace_id
        else:
            # Application doesn't have workspace_id set, use context as fallback
            return get_workspace_id_from_context()
            
    except Exception as e:
        frappe.log_error(f"Error getting tenant from application {application_id}: {str(e)}")
        return get_workspace_id_from_context()  # Fallback
        
def get_application_and_table_ids(application_name, table_name):
    """Get the actual IDs from names"""
    try:
        app_id = application_name  # This is already the ID
        table_id = table_name      # This is already the ID
        return app_id, table_id
    except Exception as e:
        frappe.log_error(f"Error getting IDs: {str(e)}")
        return application_name, table_name