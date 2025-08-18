#!/usr/bin/env python3
"""
API function to remove logic from fields (revert to normal field)
"""

import frappe

@frappe.whitelist()
def remove_logic_from_field(table_name, field_name):
    """Remove Logic Field entry to revert field back to normal field"""
    
    try:
        # Check if Logic Field entry exists
        logic_field_name = frappe.db.exists("Flansa Logic Field", 
                                           {"table_name": table_name, "field_name": field_name})
        
        if not logic_field_name:
            return {"success": False, "error": "No Logic Field entry found for this field"}
        
        # Delete the Logic Field entry
        frappe.delete_doc("Flansa Logic Field", logic_field_name)
        frappe.db.commit()
        
        # Clear cache
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        if flansa_table.doctype_name:
            frappe.clear_cache(doctype=flansa_table.doctype_name)
        
        return {
            "success": True,
            "message": f"Logic removed from field '{field_name}'. Field is now editable.",
            "field_name": field_name
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error removing logic from field: {str(e)}", "Remove Logic")
        return {"success": False, "error": str(e)}
