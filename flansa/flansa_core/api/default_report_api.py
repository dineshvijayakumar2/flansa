import frappe
from frappe import _

@frappe.whitelist()
def get_default_report(table_name):
    """
    Get the default report for a table
    """
    try:
        if not table_name:
            return {
                "success": False,
                "error": "Table name is required"
            }
        
        # Check if table exists
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        # Look for a report marked as default for this table
        default_reports = frappe.get_all(
            "Flansa Saved Report",
            filters={
                "base_table": table_name,
                "is_default": 1
            },
            fields=["name", "report_title", "report_config", "created_on"],
            order_by="created_on desc",
            limit=1
        )
        
        if default_reports:
            return {
                "success": True,
                "default_report": default_reports[0]
            }
        
        # If no default report, get the first report for this table
        first_reports = frappe.get_all(
            "Flansa Saved Report",
            filters={
                "base_table": table_name
            },
            fields=["name", "report_title", "report_config", "created_on"],
            order_by="created_on desc",
            limit=1
        )
        
        if first_reports:
            return {
                "success": True,
                "default_report": first_reports[0],
                "is_fallback": True
            }
        
        return {
            "success": False,
            "error": "No reports found for this table"
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting default report for {table_name}: {str(e)}", "Default Report API Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def set_default_report(table_name, report_id):
    """
    Set a report as default for a table
    """
    try:
        if not table_name or not report_id:
            return {
                "success": False,
                "error": "Table name and report ID are required"
            }
        
        # Verify the report exists and belongs to the table
        report_doc = frappe.get_doc("Flansa Saved Report", report_id)
        if report_doc.base_table != table_name:
            return {
                "success": False,
                "error": "Report does not belong to the specified table"
            }
        
        # Clear any existing default for this table
        frappe.db.sql("""
            UPDATE `tabFlansa Saved Report` 
            SET is_default = 0 
            WHERE base_table = %s AND is_default = 1
        """, (table_name,))
        
        # Set the new default
        report_doc.is_default = 1
        report_doc.save()
        
        return {
            "success": True,
            "message": "Default report set successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error setting default report: {str(e)}", "Default Report API Error")
        return {
            "success": False,
            "error": str(e)
        }