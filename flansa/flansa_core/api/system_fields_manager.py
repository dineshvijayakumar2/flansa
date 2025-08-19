"""
System Fields Manager for Flansa
Handles built-in Frappe fields and makes them available in visual table builder
"""

import frappe
from frappe import _

# Define all Frappe built-in fields with their properties
FRAPPE_SYSTEM_FIELDS = {
    # Core identity and tracking fields
    "name": {
        "fieldname": "name",
        "label": "ID",
        "fieldtype": "Data",
        "description": "Unique identifier for the record",
        "category": "core",
        "read_only": 1,
        "in_list_view": 1,
        "in_standard_filter": 1,
        "bold": 1
    },
    "owner": {
        "fieldname": "owner",
        "label": "Created By",
        "fieldtype": "Link",
        "options": "User",
        "description": "User who created this record",
        "category": "audit",
        "read_only": 1,
        "in_standard_filter": 1
    },
    "creation": {
        "fieldname": "creation",
        "label": "Created On",
        "fieldtype": "Datetime",
        "description": "Date and time when record was created",
        "category": "audit",
        "read_only": 1,
        "in_list_view": 1
    },
    "modified": {
        "fieldname": "modified",
        "label": "Last Modified",
        "fieldtype": "Datetime",
        "description": "Date and time of last modification",
        "category": "audit",
        "read_only": 1,
        "in_list_view": 1
    },
    "modified_by": {
        "fieldname": "modified_by",
        "label": "Modified By",
        "fieldtype": "Link",
        "options": "User",
        "description": "User who last modified this record",
        "category": "audit",
        "read_only": 1
    },
    
    # Document control fields
    "docstatus": {
        "fieldname": "docstatus",
        "label": "Document Status",
        "fieldtype": "Select",
        "options": "0-Draft\n1-Submitted\n2-Cancelled",
        "description": "Workflow status of the document",
        "category": "workflow",
        "read_only": 1,
        "in_standard_filter": 1
    },
    "idx": {
        "fieldname": "idx",
        "label": "Index",
        "fieldtype": "Int",
        "description": "Sort order in child tables",
        "category": "structure",
        "read_only": 1,
        "hidden": 1
    },
    
    # Child table fields
    "parent": {
        "fieldname": "parent",
        "label": "Parent Document",
        "fieldtype": "Data",
        "description": "Parent document reference for child tables",
        "category": "structure",
        "read_only": 1,
        "depends_on": "eval:doc.parenttype"
    },
    "parentfield": {
        "fieldname": "parentfield",
        "label": "Parent Field",
        "fieldtype": "Data",
        "description": "Field name in parent document",
        "category": "structure",
        "read_only": 1,
        "depends_on": "eval:doc.parenttype"
    },
    "parenttype": {
        "fieldname": "parenttype",
        "label": "Parent Type",
        "fieldtype": "Data",
        "description": "DocType of parent document",
        "category": "structure",
        "read_only": 1,
        "depends_on": "eval:doc.parenttype"
    },
    
    # Additional metadata fields
    "naming_series": {
        "fieldname": "naming_series",
        "label": "Series",
        "fieldtype": "Select",
        "description": "Naming series pattern",
        "category": "core",
        "read_only": 0,  # Can be editable during creation
        "depends_on": "eval:doc.__islocal"
    },
    "amended_from": {
        "fieldname": "amended_from",
        "label": "Amended From",
        "fieldtype": "Link",
        "description": "Reference to original document if this is an amendment",
        "category": "workflow",
        "read_only": 1,
        "depends_on": "eval:doc.amended_from"
    }
}

@frappe.whitelist()
def get_system_fields_for_doctype(doctype):
    """
    Get available system fields for a specific DocType
    Returns fields that are applicable based on DocType configuration
    """
    try:
        if not frappe.db.exists("DocType", doctype):
            return {"success": False, "error": "DocType not found"}
        
        doctype_doc = frappe.get_doc("DocType", doctype)
        available_fields = []
        
        # Always include core fields
        core_fields = ["name", "owner", "creation", "modified", "modified_by"]
        for field_name in core_fields:
            if field_name in FRAPPE_SYSTEM_FIELDS:
                field_config = FRAPPE_SYSTEM_FIELDS[field_name].copy()
                field_config["is_system_field"] = 1
                available_fields.append(field_config)
        
        # Include docstatus if document is submittable
        if doctype_doc.is_submittable:
            if "docstatus" in FRAPPE_SYSTEM_FIELDS:
                field_config = FRAPPE_SYSTEM_FIELDS["docstatus"].copy()
                field_config["is_system_field"] = 1
                available_fields.append(field_config)
            
            # Include amended_from for submittable documents
            if "amended_from" in FRAPPE_SYSTEM_FIELDS:
                field_config = FRAPPE_SYSTEM_FIELDS["amended_from"].copy()
                field_config["options"] = doctype  # Link to same DocType
                field_config["is_system_field"] = 1
                available_fields.append(field_config)
        
        # Include child table fields if it's a child table
        if doctype_doc.istable:
            child_fields = ["parent", "parentfield", "parenttype", "idx"]
            for field_name in child_fields:
                if field_name in FRAPPE_SYSTEM_FIELDS:
                    field_config = FRAPPE_SYSTEM_FIELDS[field_name].copy()
                    field_config["is_system_field"] = 1
                    available_fields.append(field_config)
        
        # Include naming_series if autoname uses it
        if doctype_doc.autoname and "naming_series" in doctype_doc.autoname:
            if "naming_series" in FRAPPE_SYSTEM_FIELDS:
                field_config = FRAPPE_SYSTEM_FIELDS["naming_series"].copy()
                field_config["is_system_field"] = 1
                available_fields.append(field_config)
        
        return {
            "success": True,
            "fields": available_fields,
            "doctype_config": {
                "is_submittable": doctype_doc.is_submittable,
                "is_table": doctype_doc.istable,
                "has_naming_series": bool(doctype_doc.autoname and "naming_series" in doctype_doc.autoname)
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting system fields: {str(e)}")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def add_system_field_to_table(table_name, field_name):
    """
    Add a system field reference to Flansa Table's field list
    This doesn't create the field (it already exists) but makes it visible in visual builder
    """
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {"success": False, "error": "Table not found"}
        
        if field_name not in FRAPPE_SYSTEM_FIELDS:
            return {"success": False, "error": "Invalid system field"}
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        field_config = FRAPPE_SYSTEM_FIELDS[field_name]
        
        # Check if field already exists in JSON
        current_fields = []
        if table_doc.fields_json:
            import json
            current_fields = json.loads(table_doc.fields_json)
            
            # Check if system field already added
            for field in current_fields:
                if field.get("field_name") == field_name:
                    return {"success": False, "error": "Field already exists in table"}
        
        # Add system field to JSON
        system_field_entry = {
            "field_name": field_config["fieldname"],
            "field_label": field_config["label"],
            "field_type": field_config["fieldtype"],
            "description": field_config.get("description", ""),
            "is_system_field": True,
            "is_readonly": True,
            "category": field_config.get("category", "system"),
            "options": field_config.get("options", ""),
            "in_list_view": field_config.get("in_list_view", 0),
            "in_standard_filter": field_config.get("in_standard_filter", 0),
            "depends_on": field_config.get("depends_on", "")
        }
        
        current_fields.append(system_field_entry)
        table_doc.fields_json = json.dumps(current_fields)
        table_doc.save()
        
        return {
            "success": True,
            "message": f"System field '{field_config['label']}' added to table",
            "field": system_field_entry
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding system field: {str(e)}")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def create_logic_field_for_system_field(table_name, system_field_name, logic_expression=None):
    """
    Create a Logic Field that references a system field
    This allows system fields to be used in calculations and displayed in forms
    """
    try:
        if system_field_name not in FRAPPE_SYSTEM_FIELDS:
            return {"success": False, "error": "Invalid system field"}
        
        field_config = FRAPPE_SYSTEM_FIELDS[system_field_name]
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Create a logic field that references the system field
        logic_field_name = f"computed_{system_field_name}"
        
        # Default expression just references the system field
        if not logic_expression:
            logic_expression = f"doc.{system_field_name}"
        
        # Check if logic field already exists
        if frappe.db.exists("Flansa Logic Field", {
            "table_name": table_name,
            "field_name": logic_field_name
        }):
            return {"success": False, "error": "Logic field already exists"}
        
        # Create the logic field
        logic_field = frappe.new_doc("Flansa Logic Field")
        logic_field.table_name = table_name
        logic_field.field_name = logic_field_name
        logic_field.field_label = f"{field_config['label']} (System)"
        logic_field.field_type = field_config["fieldtype"]
        logic_field.logic_type = "formula"
        logic_field.logic_expression = logic_expression
        logic_field.description = f"System field: {field_config.get('description', '')}"
        logic_field.is_active = 1
        logic_field.insert()
        
        # Create corresponding Custom Field
        doctype_name = table_doc.doctype_name if hasattr(table_doc, 'doctype_name') and table_doc.doctype_name else table_doc.table_name
        
        custom_field = frappe.new_doc("Custom Field")
        custom_field.dt = doctype_name
        custom_field.fieldname = logic_field_name
        custom_field.label = logic_field.label
        custom_field.fieldtype = field_config["fieldtype"]
        custom_field.read_only = 1
        custom_field.is_virtual = 1
        custom_field.description = logic_field.description
        custom_field.insert()
        
        return {
            "success": True,
            "message": f"Logic field created for system field '{field_config['label']}'",
            "logic_field": logic_field.name,
            "custom_field": custom_field.name
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating logic field for system field: {str(e)}")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_all_system_fields():
    """
    Get all available system fields with their configurations
    Used by visual table builder to show available system fields
    """
    return {
        "success": True,
        "fields": list(FRAPPE_SYSTEM_FIELDS.values()),
        "categories": {
            "core": "Core Fields",
            "audit": "Audit Trail",
            "workflow": "Workflow",
            "structure": "Document Structure"
        }
    }