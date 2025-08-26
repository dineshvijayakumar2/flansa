"""
ID-based utilities for Flansa platform
Uses unique IDs instead of names for DocType generation
"""

import frappe

def generate_id_based_doctype_name(tenant_id, application_id, table_id):
    """Generate DocType name using unique IDs"""
    try:
        # Clean tenant_id
        clean_tenant = str(tenant_id).replace('-', '').replace('_', '')[:10]
        
        # Use first 8 chars of hash IDs
        clean_app = str(application_id)[:8] if application_id else "app"
        clean_table = str(table_id)[:8] if table_id else "table"
        
        # Generate name
        doctype_name = f"{clean_tenant}_{clean_app}_{clean_table}"
        
        # Ensure reasonable length
        if len(doctype_name) > 60:
            clean_tenant = clean_tenant[:8]
            clean_app = clean_app[:6]
            clean_table = clean_table[:6]
            doctype_name = f"{clean_tenant}_{clean_app}_{clean_table}"
        
        return doctype_name
        
    except Exception as e:
        frappe.log_error(f"Error generating ID-based DocType name: {str(e)}")
        return f"ERR_{str(application_id)[:6]}_{str(table_id)[:6]}"

def get_tenant_id_from_context():
    """Get tenant_id from current context or default"""
    try:
        from flansa.flansa_core.tenant_security import get_current_tenant
        tenant_id = get_current_tenant()
        return tenant_id if tenant_id else "default"
    except Exception:
        return "default"
        
def get_application_and_table_ids(application_name, table_name):
    """Get the actual IDs from names"""
    try:
        app_id = application_name  # This is already the ID
        table_id = table_name      # This is already the ID
        return app_id, table_id
    except Exception as e:
        frappe.log_error(f"Error getting IDs: {str(e)}")
        return application_name, table_name