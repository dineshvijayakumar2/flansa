"""
Relationship Details API
Provides detailed information about relationships including created fields
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def get_relationship_details(relationship_name):
    """Get comprehensive details about a relationship including all created fields"""
    try:
        if not relationship_name:
            return {"success": False, "error": "Relationship name is required"}
            
        if not frappe.db.exists("Flansa Relationship", relationship_name):
            return {"success": False, "error": f"Relationship {relationship_name} not found"}
            
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get table information
        if not relationship.from_table or not relationship.to_table:
            return {"success": False, "error": "Relationship is missing table information"}
            
        from_table = frappe.get_doc("Flansa Table", relationship.from_table)
        to_table = frappe.get_doc("Flansa Table", relationship.to_table)
        
        # Get created fields in both tables
        from_fields = get_relationship_fields(from_table.doctype_name, relationship_name) if from_table.doctype_name else []
        to_fields = get_relationship_fields(to_table.doctype_name, relationship_name) if to_table.doctype_name else []
        
        # Get computed fields details
        computed_fields_details = []
        if relationship.computed_fields:
            for cf in relationship.computed_fields:
                computed_fields_details.append({
                    "field_name": cf.field_name,
                    "field_label": cf.field_label,
                    "computation_type": cf.computation_type,
                    "target_field": cf.target_field if hasattr(cf, 'target_field') else None,
                    "auto_add": cf.auto_add if hasattr(cf, 'auto_add') else 0,
                    "condition": cf.condition if hasattr(cf, 'condition') else None,
                    "formula": cf.formula if hasattr(cf, 'formula') else None
                })
        
        # Build comprehensive details
        details = {
            "relationship": {
                "name": relationship.name,
                "relationship_name": relationship.relationship_name if hasattr(relationship, 'relationship_name') else relationship.name,
                "relationship_type": relationship.relationship_type,
                "status": relationship.status if hasattr(relationship, 'status') else 'Active',
                "description": relationship.description if hasattr(relationship, 'description') else '',
                "created": relationship.creation,
                "modified": relationship.modified
            },
            "tables": {
                "from": {
                    "name": from_table.name,
                    "label": from_table.table_label,
                    "doctype": from_table.doctype_name,
                    "fields_created": from_fields
                },
                "to": {
                    "name": to_table.name,
                    "label": to_table.table_label,
                    "doctype": to_table.doctype_name,
                    "fields_created": to_fields
                }
            },
            "field_mapping": {
                "from_field": relationship.from_field if hasattr(relationship, 'from_field') else None,
                "to_field": relationship.to_field if hasattr(relationship, 'to_field') else None,
                "junction_table": relationship.junction_table if hasattr(relationship, 'junction_table') else None,
                "from_junction_field": relationship.from_junction_field if hasattr(relationship, 'from_junction_field') else None,
                "to_junction_field": relationship.to_junction_field if hasattr(relationship, 'to_junction_field') else None
            },
            "computed_fields": computed_fields_details,
            "statistics": {
                "total_computed_fields": len(computed_fields_details),
                "auto_added_fields": sum(1 for cf in computed_fields_details if cf.get("auto_add", 0)),
                "has_junction_table": bool(relationship.junction_table) if hasattr(relationship, 'junction_table') else False,
                "is_self_referential": relationship.from_table == relationship.to_table
            },
            "editable_properties": get_editable_properties(relationship)
        }
        
        return {"success": True, "details": details}
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship details: {str(e)}", "Relationship Details")
        return {"success": False, "error": str(e)}


def get_relationship_fields(doctype_name, relationship_name):
    """Get fields created by a specific relationship"""
    if not doctype_name or not frappe.db.exists("DocType", doctype_name):
        return []
    
    fields = []
    doctype = frappe.get_doc("DocType", doctype_name)
    
    for field in doctype.fields:
        # Check if field was created by this relationship
        is_relationship_field = False
        
        # Check virtual fields with relationship reference
        if field.is_virtual and field.options:
            try:
                options = json.loads(field.options)
                if options.get("relationship") == relationship_name:
                    is_relationship_field = True
            except:
                pass
        
        # Check link fields that might be from relationship
        # This is a heuristic - we look for fields that match expected patterns
        if field.fieldtype == "Link" and (
            field.fieldname in ["from_field", "to_field"] or
            "_link" in field.fieldname or
            "_id" in field.fieldname
        ):
            is_relationship_field = True
        
        # Check table fields for relationships
        if field.fieldtype == "Table" and (
            "_list" in field.fieldname or
            "_links" in field.fieldname or
            "junction" in field.options.lower()
        ):
            is_relationship_field = True
        
        if is_relationship_field:
            fields.append({
                "fieldname": field.fieldname,
                "label": field.label,
                "fieldtype": field.fieldtype,
                "options": field.options,
                "is_virtual": field.is_virtual,
                "read_only": field.read_only,
                "in_list_view": field.in_list_view,
                "reqd": field.reqd
            })
    
    return fields


def get_editable_properties(relationship):
    """Determine which properties can be safely edited"""
    
    # Check if relationship has data
    has_data = check_relationship_has_data(relationship)
    
    editable = {
        "relationship_name": True,  # Display name can always be changed
        "description": True,        # Description can always be changed
        "status": True,             # Status can be toggled
        "computed_fields": not has_data,  # Can only edit if no data exists
        "cascade_settings": not has_data,  # Cascade settings only if no data
        "field_names": False,       # Field names should not be changed after creation
        "relationship_type": False, # Type cannot be changed
        "tables": False            # Tables cannot be changed
    }
    
    # Add warnings for each property
    warnings = {}
    if has_data:
        warnings["computed_fields"] = "Cannot modify computed fields - relationship has existing data"
        warnings["cascade_settings"] = "Cannot modify cascade settings - relationship has existing data"
    
    return {
        "editable": editable,
        "warnings": warnings,
        "has_data": has_data
    }


def check_relationship_has_data(relationship):
    """Check if relationship has any data"""
    try:
        # Get the doctype names
        from_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
        to_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        
        if not from_doctype or not to_doctype:
            return False
        
        # Check based on relationship type
        if relationship.relationship_type == "One to Many":
            # Check if any child records have the link field populated
            link_field = relationship.to_field or f"{relationship.from_table}_link"
            if frappe.db.exists("DocType", to_doctype):
                count = frappe.db.count(to_doctype, {link_field: ("is", "set")})
                if count > 0:
                    return True
                    
        elif relationship.relationship_type == "Many to Many":
            # Check junction table
            if relationship.junction_table:
                junction_doctype = f"Flansa Junction {relationship.junction_table}"
                if frappe.db.exists("DocType", junction_doctype):
                    count = frappe.db.count(junction_doctype)
                    if count > 0:
                        return True
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error checking relationship data: {str(e)}", "Relationship Data Check")
        return True  # Assume has data to be safe


@frappe.whitelist()
def update_relationship(relationship_name, updates):
    """Safely update relationship properties"""
    try:
        if isinstance(updates, str):
            updates = json.loads(updates)
        
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get editable properties
        editable_info = get_editable_properties(relationship)
        editable = editable_info["editable"]
        
        # Track what was updated
        updated_fields = []
        
        # Update only safe properties
        if "relationship_name" in updates and editable["relationship_name"]:
            relationship.relationship_name = updates["relationship_name"]
            updated_fields.append("relationship_name")
        
        if "description" in updates and editable["description"]:
            relationship.description = updates["description"]
            updated_fields.append("description")
        
        if "status" in updates and editable["status"]:
            old_status = relationship.status
            relationship.status = updates["status"]
            updated_fields.append("status")
            
            # Handle status change implications
            if old_status != updates["status"]:
                if updates["status"] == "Active":
                    relationship.create_relationship()
                else:
                    relationship.deactivate_relationship()
        
        # Update computed fields if allowed
        if "computed_fields" in updates and editable["computed_fields"]:
            # Clear existing computed fields
            relationship.computed_fields = []
            
            # Add new computed fields
            for cf in updates["computed_fields"]:
                relationship.append("computed_fields", {
                    "field_name": cf.get("field_name"),
                    "field_label": cf.get("field_label"),
                    "computation_type": cf.get("computation_type"),
                    "target_field": cf.get("target_field"),
                    "auto_add": cf.get("auto_add", 0),
                    "condition": cf.get("condition"),
                    "formula": cf.get("formula")
                })
            
            updated_fields.append("computed_fields")
            
            # Apply the computed fields
            relationship.apply_computed_fields()
        
        # Save the document
        relationship.save()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Updated fields: {', '.join(updated_fields)}",
            "updated_fields": updated_fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating relationship: {str(e)}", "Relationship Update")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_relationship_data_preview(relationship_name, limit=5):
    """Get preview of data using this relationship"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get doctype names
        from_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
        to_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        
        preview = {
            "from_table_sample": [],
            "to_table_sample": [],
            "relationship_usage": {}
        }
        
        if from_doctype and frappe.db.exists("DocType", from_doctype):
            # Get sample records from parent table
            from_records = frappe.get_list(from_doctype, fields=["name"], limit=limit)
            
            for record in from_records:
                doc = frappe.get_doc(from_doctype, record.name)
                
                # Get related child count
                if relationship.relationship_type == "One to Many":
                    link_field = relationship.to_field or f"{relationship.from_table}_link"
                    if to_doctype and frappe.db.exists("DocType", to_doctype):
                        child_count = frappe.db.count(to_doctype, {link_field: record.name})
                    else:
                        child_count = 0
                else:
                    child_count = 0
                
                preview["from_table_sample"].append({
                    "name": record.name,
                    "related_count": child_count
                })
        
        if to_doctype and frappe.db.exists("DocType", to_doctype):
            # Get sample records from child table
            to_records = frappe.get_list(to_doctype, fields=["name"], limit=limit)
            
            for record in to_records:
                doc = frappe.get_doc(to_doctype, record.name)
                
                # Get parent reference
                if relationship.relationship_type == "One to Many":
                    link_field = relationship.to_field or f"{relationship.from_table}_link"
                    parent_ref = getattr(doc, link_field, None) if hasattr(doc, link_field) else None
                else:
                    parent_ref = None
                
                preview["to_table_sample"].append({
                    "name": record.name,
                    "parent_reference": parent_ref
                })
        
        # Get usage statistics
        if relationship.relationship_type == "One to Many" and to_doctype:
            link_field = relationship.to_field or f"{relationship.from_table}_link"
            preview["relationship_usage"] = {
                "total_linked": frappe.db.count(to_doctype, {link_field: ("is", "set")}),
                "total_unlinked": frappe.db.count(to_doctype, {link_field: ("is", "not set")})
            }
        
        return {"success": True, "preview": preview}
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship preview: {str(e)}", "Relationship Preview")
        return {"success": False, "error": str(e)}