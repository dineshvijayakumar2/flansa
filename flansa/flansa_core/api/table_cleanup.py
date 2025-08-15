import frappe
from frappe import _

@frappe.whitelist()
def cleanup_deleted_table(table_name):
    """Clean up generated DocType when a Flansa Table is deleted"""
    try:
        # Get the table record before deletion
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if table_doc.doctype_name:
            # Delete the generated DocType
            if frappe.db.exists("DocType", table_doc.doctype_name):
                frappe.delete_doc("DocType", table_doc.doctype_name, force=True)
                
                # Drop the database table
                table_name = f"tab{table_doc.doctype_name}"
                frappe.db.sql(f"DROP TABLE IF EXISTS `{table_name}`")
                
                frappe.msgprint(_(f"Cleaned up DocType and table: {table_doc.doctype_name}"))
        
        return True
        
    except Exception as e:
        frappe.log_error(f"Error cleaning up table: {str(e)}", "Flansa Table Cleanup")
        return False


@frappe.whitelist()
def cleanup_orphaned_doctypes():
    """Find and clean up orphaned DocTypes created by Flansa"""
    orphaned = []
    
    # Get all DocTypes that start with "FLS "
    fls_doctypes = frappe.get_all("DocType", 
        filters={"name": ["like", "FLS %"]}, 
        fields=["name"])
    
    # Check if corresponding Flansa Table exists
    for dt in fls_doctypes:
        # Find if there's a Flansa Table with this doctype_name
        exists = frappe.db.exists("Flansa Table", 
            {"doctype_name": dt.name})
        
        if not exists:
            orphaned.append(dt.name)
    
    return orphaned


@frappe.whitelist()
def delete_orphaned_doctype(doctype_name):
    """Delete a specific orphaned DocType"""
    if not frappe.db.exists("DocType", doctype_name):
        frappe.throw(_(f"DocType {doctype_name} does not exist"))
    
    if not doctype_name.startswith("FLS "):
        frappe.throw(_("Only Flansa-generated DocTypes can be deleted through this method"))
    
    # Double-check it's orphaned
    exists = frappe.db.exists("Flansa Table", 
        {"doctype_name": doctype_name})
    
    if exists:
        frappe.throw(_("This DocType is still linked to an active Flansa Table"))
    
    # Delete the DocType and drop table
    frappe.delete_doc("DocType", doctype_name, force=True)
    table_name = f"tab{doctype_name}"
    frappe.db.sql(f"DROP TABLE IF EXISTS `{table_name}`")
    
    return {"status": "success", "message": f"Deleted {doctype_name}"}


@frappe.whitelist()
def deactivate_table(table_name):
    """Deactivate a table and optionally delete its DocType"""
    table_doc = frappe.get_doc("Flansa Table", table_name)
    
    if not table_doc.is_active:
        frappe.throw(_("Table is already inactive"))
    
    # Ask user if they want to delete the DocType
    # This would be handled in the UI
    
    table_doc.is_active = 0
    table_doc.save()
    
    return {"status": "deactivated", "doctype": table_doc.doctype_name}