#!/usr/bin/env python3
"""
Simple field to Link conversion functionality
"""

import frappe

@frappe.whitelist()
def convert_field_to_link(table_name, field_name, target_doctype):
    """Convert any existing field to Link field (keeping Logic Field if exists)"""
    
    try:
        # Get the Flansa Table
        if not frappe.db.exists("Flansa Table", table_name):
            return {"success": False, "error": "Table not found"}
        
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        if not flansa_table.doctype_name:
            return {"success": False, "error": "DocType not generated for this table"}
        
        source_doctype = flansa_table.doctype_name
        
        # Validate target DocType exists
        if not frappe.db.exists("DocType", target_doctype):
            return {"success": False, "error": f"Target DocType '{target_doctype}' not found"}
        
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", source_doctype)
        
        # Find the field in DocType definition
        field_to_convert = None
        
        for field in doctype_doc.fields:
            if field.fieldname == field_name:
                field_to_convert = field
                break
        
        if not field_to_convert:
            return {"success": False, "error": f"Field '{field_name}' not found in DocType"}
        
        # Store original field type
        original_type = field_to_convert.fieldtype
        
        # Update field to Link type
        field_to_convert.fieldtype = "Link"
        field_to_convert.options = target_doctype
        
        # Clear properties that don't apply to Link fields
        if hasattr(field_to_convert, 'precision'):
            field_to_convert.precision = None
        if hasattr(field_to_convert, 'length'):
            field_to_convert.length = None
        
        # Save the DocType
        doctype_doc.save()
        frappe.db.commit()
        
        # Clear cache to reload field definitions
        frappe.clear_cache(doctype=source_doctype)
        
        # Check if Logic Field exists (but don't modify it)
        logic_field_exists = frappe.db.exists("Flansa Logic Field", 
                                             {"table_name": table_name, "field_name": field_name})
        
        return {
            "success": True,
            "message": f"Field '{field_name}' converted to Link field",
            "field_name": field_name,
            "target_doctype": target_doctype,
            "original_type": original_type,
            "has_logic_field": bool(logic_field_exists),
            "behavior": "calculated (read-only)" if logic_field_exists else "editable dropdown"
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error converting field to Link: {str(e)}", "Field Conversion")
        return {"success": False, "error": str(e)}