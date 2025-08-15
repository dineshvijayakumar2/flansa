"""
Lookup Fields Management API
Manages multiple lookup fields based on a single relationship join
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def get_available_lookup_fields(relationship_name):
    """Get available fields from the target table that can be used as lookup fields"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # For lookup fields, we need to get fields from the PARENT table (from_table)
        # because lookup fields in the child table fetch data FROM the parent table
        parent_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
        if not parent_doctype or not frappe.db.exists("DocType", parent_doctype):
            return {"success": False, "error": "Parent DocType not found"}
        
        # Get all fields from parent table (this is what we can fetch)
        parent_meta = frappe.get_meta(parent_doctype)
        
        # Get existing lookup fields to avoid duplicates (in child table)
        child_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        existing_lookup_fields = get_existing_lookup_fields(child_doctype, relationship_name) if child_doctype else []
        
        available_fields = []
        
        for field in parent_meta.fields:
            # Skip system fields and complex field types
            if field.fieldtype in ['Section Break', 'Column Break', 'Tab Break', 'HTML', 'Heading', 'Table']:
                continue
            
            # Skip if already exists as lookup field  
            lookup_field_name = f"{frappe.scrub(relationship.from_table)}_{field.fieldname}"
            if lookup_field_name in existing_lookup_fields:
                continue
            
            # Determine if this is a commonly useful lookup field
            is_recommended = field.fieldtype in ['Data', 'Select', 'Link'] or \
                           field.fieldname in ['name', 'title', 'status', 'type', 'category'] or \
                           field.in_list_view or field.in_standard_filter
            
            available_fields.append({
                "fieldname": field.fieldname,
                "label": field.label or field.fieldname.replace('_', ' ').title(),
                "fieldtype": field.fieldtype,
                "options": field.options if field.fieldtype == 'Select' else None,
                "description": field.description,
                "is_recommended": is_recommended,
                "suggested_name": lookup_field_name,
                "suggested_label": f"{frappe.db.get_value('Flansa Table', relationship.from_table, 'table_label')} {field.label or field.fieldname.replace('_', ' ').title()}"
            })
        
        # Sort by recommended first, then alphabetically
        available_fields.sort(key=lambda x: (not x["is_recommended"], x["label"]))
        
        # Find the actual join field in the child table
        actual_join_field = None
        if child_doctype and frappe.db.exists("DocType", child_doctype):
            child_meta = frappe.get_meta(child_doctype)
            parent_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
            
            # Look for a link field that points to the parent table
            for field in child_meta.fields:
                if field.fieldtype == 'Link' and field.options == parent_doctype:
                    actual_join_field = field.fieldname
                    break
        
        # Fallback to expected name
        if not actual_join_field:
            actual_join_field = relationship.to_field or f"{frappe.scrub(relationship.from_table)}_link"

        return {
            "success": True,
            "available_fields": available_fields,
            "relationship_info": {
                "parent_table": frappe.db.get_value("Flansa Table", relationship.from_table, "table_label"),
                "child_table": frappe.db.get_value("Flansa Table", relationship.to_table, "table_label"),
                "join_field": actual_join_field,
                "explanation": f"Lookup fields will be created in {frappe.db.get_value('Flansa Table', relationship.to_table, 'table_label')} to fetch data from {frappe.db.get_value('Flansa Table', relationship.from_table, 'table_label')}"
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting available lookup fields: {str(e)}", "Lookup Fields")
        return {"success": False, "error": str(e)}


def get_existing_lookup_fields(doctype_name, relationship_name):
    """Get existing lookup fields created by this relationship"""
    if not doctype_name or not frappe.db.exists("DocType", doctype_name):
        return []
    
    existing_fields = []
    doctype = frappe.get_doc("DocType", doctype_name)
    
    for field in doctype.fields:
        # Check if this is a lookup field (fetch_from indicates it's a lookup)
        if field.fetch_from and relationship_name in field.description:
            existing_fields.append(field.fieldname)
    
    return existing_fields


@frappe.whitelist()
def add_lookup_field(relationship_name, source_field, field_config):
    """Add a lookup field to the parent table that fetches data from related table"""
    try:
        if isinstance(field_config, str):
            field_config = json.loads(field_config)
        
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get DocType information
        parent_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
        child_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        
        if not parent_doctype or not child_doctype:
            return {"success": False, "error": "DocTypes not found"}
        
        # Determine the join field (the link field that connects the tables)
        # In One-to-Many: link field is in child table (to_table) pointing to parent (from_table)
        # The link field is named using singular form of parent table name
        from flansa.flansa_core.api.relationship_management import get_table_name_for_field, pluralize_to_singular
        
        parent_table_name = get_table_name_for_field(relationship.from_table)
        parent_singular = pluralize_to_singular(parent_table_name)
        
        # Find the actual join field in the child table (link field pointing to parent)
        child_meta = frappe.get_meta(child_doctype)
        join_field = None
        
        # Look for a link field that points to the parent table
        for field in child_meta.fields:
            if field.fieldtype == 'Link' and field.options == parent_doctype:
                join_field = field.fieldname
                break
        
        # Fallback to expected name if not found
        if not join_field:
            join_field = relationship.to_field or f"{parent_singular}_link"
        
        # Log for debugging
        frappe.logger().info(f"Lookup field: join_field={join_field}, source_field={source_field}, from parent={relationship.from_table} to child={relationship.to_table}")
        
        # Create the lookup field configuration
        lookup_field_config = {
            "fieldname": field_config.get("field_name"),
            "label": field_config.get("field_label"),
            "fieldtype": field_config.get("fieldtype", "Data"),
            "fetch_from": f"{join_field}.{source_field}",
            "read_only": 1,
            "description": f"Lookup field from {relationship.to_table} via {relationship_name}",
            "in_list_view": field_config.get("in_list_view", 0),
            "search_index": field_config.get("search_index", 0)
        }
        
        # Add the field to the child DocType (where the lookup fields go)
        from flansa.native_fields import add_lookup_field_native
        
        result = add_lookup_field_native(relationship.to_table, {
            "field_name": lookup_field_config["fieldname"],
            "field_label": lookup_field_config["label"],
            "field_type": lookup_field_config["fieldtype"],
            "source_field": join_field,
            "lookup_field": source_field,
            "description": lookup_field_config["description"]
        })
        
        if result.get("success"):
            # Sync the field to JSON (child table where we added the field)
            try:
                from flansa.flansa_core.api.field_management import sync_doctype_to_json
                sync_doctype_to_json(table_name=relationship.to_table, doctype_name=child_doctype)
                frappe.db.commit()
            except Exception as sync_error:
                frappe.log_error(f"Error syncing lookup field to JSON: {str(sync_error)}", "Lookup Field Sync")
        
        return {
            "success": True,
            "message": f"Added lookup field {field_config.get('field_label')}",
            "field_name": lookup_field_config["fieldname"]
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding lookup field: {str(e)}", "Lookup Field Add")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def remove_lookup_field(relationship_name, field_name):
    """Remove a lookup field from the child table"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        # Lookup fields are in the child table (to_table), not parent table
        child_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        
        if not child_doctype or not frappe.db.exists("DocType", child_doctype):
            return {"success": False, "error": "Child DocType not found"}
        
        # Remove the field from DocType
        doctype = frappe.get_doc("DocType", child_doctype)
        
        field_removed = False
        for i, field in enumerate(doctype.fields):
            if field.fieldname == field_name:
                doctype.fields.pop(i)
                field_removed = True
                break
        
        if not field_removed:
            return {"success": False, "error": f"Field {field_name} not found"}
        
        doctype.save()
        
        # Sync to JSON
        try:
            from flansa.flansa_core.api.field_management import sync_doctype_to_json
            sync_doctype_to_json(table_name=relationship.to_table, doctype_name=child_doctype)
            frappe.db.commit()
        except Exception as sync_error:
            frappe.log_error(f"Error syncing after lookup field removal: {str(sync_error)}", "Lookup Field Sync")
        
        return {
            "success": True,
            "message": f"Removed lookup field {field_name}"
        }
        
    except Exception as e:
        frappe.log_error(f"Error removing lookup field: {str(e)}", "Lookup Field Remove")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_relationship_lookup_fields(relationship_name):
    """Get all lookup fields created by this relationship"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        # Lookup fields are added to the child table (to_table), not parent table
        child_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        
        if not child_doctype or not frappe.db.exists("DocType", child_doctype):
            return {"success": False, "error": "Child DocType not found"}
        
        lookup_fields = []
        doctype = frappe.get_doc("DocType", child_doctype)
        
        # Find fields that are lookup fields for this relationship
        for field in doctype.fields:
            if (field.fetch_from and 
                relationship_name in (field.description or "") and
                field.fieldtype not in ['Section Break', 'Column Break', 'Tab Break', 'HTML']):
                
                # Parse the fetch_from to get source field
                fetch_parts = field.fetch_from.split('.')
                source_field = fetch_parts[-1] if len(fetch_parts) > 1 else field.fetch_from
                
                lookup_fields.append({
                    "field_name": field.fieldname,
                    "field_label": field.label,
                    "fieldtype": field.fieldtype,
                    "source_field": source_field,
                    "fetch_from": field.fetch_from,
                    "in_list_view": field.in_list_view,
                    "search_index": field.search_index,
                    "description": field.description
                })
        
        return {
            "success": True,
            "lookup_fields": lookup_fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship lookup fields: {str(e)}", "Lookup Fields Get")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_join_field_info(relationship_name):
    """Get information about the join field used in the relationship"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get table information
        from_table_doc = frappe.get_doc("Flansa Table", relationship.from_table)
        to_table_doc = frappe.get_doc("Flansa Table", relationship.to_table)
        
        # Find the actual join field in the child table
        parent_doctype = from_table_doc.doctype_name
        child_doctype = to_table_doc.doctype_name
        join_field = None
        
        # Look for a link field that points to the parent table
        if child_doctype and frappe.db.exists("DocType", child_doctype):
            child_meta = frappe.get_meta(child_doctype)
            for field in child_meta.fields:
                if field.fieldtype == 'Link' and field.options == parent_doctype:
                    join_field = field.fieldname
                    break
        
        # Fallback to expected name if not found
        if not join_field:
            join_field = relationship.to_field or f"{frappe.scrub(relationship.from_table)}_link"
        
        # Get join field details from child table
        join_field_info = None
        if to_table_doc.doctype_name and frappe.db.exists("DocType", to_table_doc.doctype_name):
            to_meta = frappe.get_meta(to_table_doc.doctype_name)
            join_field_obj = to_meta.get_field(join_field)
            
            if join_field_obj:
                join_field_info = {
                    "fieldname": join_field_obj.fieldname,
                    "label": join_field_obj.label,
                    "fieldtype": join_field_obj.fieldtype,
                    "options": join_field_obj.options,
                    "required": join_field_obj.reqd
                }
        
        return {
            "success": True,
            "join_info": {
                "from_table": from_table_doc.table_label,
                "to_table": to_table_doc.table_label,
                "join_field": join_field,
                "join_field_info": join_field_info,
                "relationship_type": relationship.relationship_type,
                "description": f"Records in {to_table_doc.table_label} are linked to {from_table_doc.table_label} via the '{join_field}' field"
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting join field info: {str(e)}", "Join Field Info")
        return {"success": False, "error": str(e)}