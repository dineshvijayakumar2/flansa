#!/usr/bin/env python3
"""
Field property update functionality
"""

import frappe

@frappe.whitelist()
def update_field_properties(table_name, field_name, field_config):
    """Update field properties in DocType definition"""
    
    try:
        # Handle Frappe's JSON string conversion
        if isinstance(field_config, str):
            try:
                import json
                field_config = json.loads(field_config)
            except (json.JSONDecodeError, ValueError):
                return {"success": False, "error": f"field_config is not valid JSON"}
        
        if not isinstance(field_config, dict):
            return {"success": False, "error": f"field_config must be a dictionary"}
        
        # Get the Flansa Table
        if not frappe.db.exists("Flansa Table", table_name):
            return {"success": False, "error": "Table not found"}
        
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        if not flansa_table.doctype_name:
            return {"success": False, "error": "DocType not generated for this table"}
        
        source_doctype = flansa_table.doctype_name
        
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", source_doctype)
        
        # Find the field to update
        field_to_update = None
        for field in doctype_doc.fields:
            if field.fieldname == field_name:
                field_to_update = field
                break
        
        if not field_to_update:
            return {"success": False, "error": f"Field '{field_name}' not found in DocType"}
        
        # Store original values for comparison
        original_values = {
            "label": field_to_update.label,
            "fieldtype": field_to_update.fieldtype,
            "options": getattr(field_to_update, 'options', ''),
            "reqd": field_to_update.reqd,
            "read_only": field_to_update.read_only,
            "hidden": field_to_update.hidden
        }
        
        # Update field properties
        updates_made = []
        
        if field_config.get("field_label") and field_config["field_label"] != field_to_update.label:
            field_to_update.label = field_config["field_label"]
            updates_made.append(f"label: '{original_values['label']}' → '{field_config['field_label']}'")
        
        if field_config.get("field_type") and field_config["field_type"] != field_to_update.fieldtype:
            field_to_update.fieldtype = field_config["field_type"]
            updates_made.append(f"type: '{original_values['fieldtype']}' → '{field_config['field_type']}'")
        
        if "options" in field_config:
            new_options = field_config["options"] or ""
            if new_options != getattr(field_to_update, 'options', ''):
                field_to_update.options = new_options
                updates_made.append(f"options: '{original_values['options']}' → '{new_options}'")
        
        if "reqd" in field_config:
            new_reqd = int(field_config["reqd"])
            if new_reqd != field_to_update.reqd:
                field_to_update.reqd = new_reqd
                updates_made.append(f"required: {original_values['reqd']} → {new_reqd}")
        
        if "read_only" in field_config:
            new_read_only = int(field_config["read_only"])
            if new_read_only != field_to_update.read_only:
                field_to_update.read_only = new_read_only
                updates_made.append(f"read-only: {original_values['read_only']} → {new_read_only}")
        
        if "hidden" in field_config:
            new_hidden = int(field_config["hidden"])
            if new_hidden != field_to_update.hidden:
                field_to_update.hidden = new_hidden
                updates_made.append(f"hidden: {original_values['hidden']} → {new_hidden}")
        
        if not updates_made:
            return {"success": True, "message": "No changes to apply", "updates": []}
        
        # Save the DocType
        doctype_doc.save()
        frappe.db.commit()
        
        # Clear cache to reload field definitions
        frappe.clear_cache(doctype=source_doctype)
        
        return {
            "success": True,
            "message": f"Field '{field_name}' updated successfully",
            "updates": updates_made,
            "field_name": field_name
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error updating field properties: {str(e)}", "Field Update")
        return {"success": False, "error": str(e)}