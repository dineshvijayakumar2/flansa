import frappe
from frappe import _

@frappe.whitelist()
def save_report(report_id=None, report_title=None, base_table=None, report_config=None, report_type="Table", is_public=0):
    """
    Custom API endpoint for saving reports that handles field validation properly
    """
    try:
        if not report_title:
            return {
                "success": False,
                "error": "Report title is required"
            }
            
        if not base_table:
            return {
                "success": False,
                "error": "Base table is required"
            }
            
        if not report_config:
            return {
                "success": False,
                "error": "Report configuration is required"
            }
        
        if report_id and frappe.db.exists("Flansa Saved Report", report_id):
            # Update existing report
            doc = frappe.get_doc("Flansa Saved Report", report_id)
            doc.report_title = report_title
            doc.base_table = base_table
            doc.report_config = report_config
            doc.report_type = report_type
            doc.is_public = int(is_public)
            doc.save()
            
            return {
                "success": True,
                "message": "Report updated successfully",
                "name": doc.name,
                "modified": doc.modified
            }
        else:
            # Create new report
            doc = frappe.new_doc("Flansa Saved Report")
            doc.naming_series = "FR-.YYYY.-.#####"
            doc.report_title = report_title
            doc.base_table = base_table
            doc.report_config = report_config
            doc.report_type = report_type
            doc.is_public = int(is_public)
            doc.insert()
            
            return {
                "success": True,
                "message": "Report saved successfully",
                "name": doc.name,
                "modified": doc.modified
            }
            
    except Exception as e:
        frappe.log_error(f"Error saving report: {str(e)}", "Report Save API Error")
        return {
            "success": False,
            "error": str(e)
        }