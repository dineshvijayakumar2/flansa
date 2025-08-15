"""
Relationship Management API for Flansa Platform
"""

import frappe
from frappe import _
import re

def get_table_name_for_field(table_id):
    """Get the actual table name from table ID for field naming"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_id)
        return table_doc.table_name or table_id.lower()
    except:
        return table_id.lower()

def pluralize_to_singular(word):
    """Convert plural word to singular form for field names"""
    if not word:
        return word
    
    word = word.lower().strip()
    
    # Handle common plural patterns
    if word.endswith('ies') and len(word) > 3:
        # categories -> category, companies -> company
        return word[:-3] + 'y'
    elif word.endswith('es') and len(word) > 3:
        if word.endswith('nses'):
            # expenses -> expense, responses -> response  
            return word[:-1]  # Just remove 's', not 'es'
        elif word.endswith('ses') or word.endswith('uses') or word.endswith('ases') or word.endswith('xes') or word.endswith('ches') or word.endswith('shes'):
            # classes -> class, senses -> sense, houses -> house, boxes -> box, churches -> church, dishes -> dish
            return word[:-2]
        elif word.endswith('oes'):
            # heroes -> hero, potatoes -> potato
            return word[:-2]
        else:
            # places -> place, houses -> house
            return word[:-1]
    elif word.endswith('s') and len(word) > 1:
        # users -> user, items -> item
        return word[:-1]
    else:
        # already singular or unknown pattern
        return word

@frappe.whitelist()
def create_relationship(relationship_data):
    """Create a new relationship between two Flansa tables"""
    try:
        # Validate input
        if not relationship_data:
            return {"success": False, "error": "No relationship data provided"}
        
        # Create the relationship document
        relationship = frappe.new_doc("Flansa Relationship")
        
        # Set basic fields
        relationship.relationship_name = relationship_data.get("relationship_name")
        relationship.relationship_type = relationship_data.get("relationship_type")
        relationship.from_table = relationship_data.get("from_table")
        relationship.to_table = relationship_data.get("to_table")
        relationship.from_field = relationship_data.get("from_field")
        relationship.to_field = relationship_data.get("to_field")
        relationship.status = "Active"
        
        # Save the relationship
        relationship.insert(ignore_permissions=True)
        
        # Create the actual link fields in the tables based on relationship type
        if relationship.relationship_type == "One to Many":
            # In One-to-Many: from_table is "One" (parent), to_table is "Many" (child)
            # Create link field in the child table (to_table) pointing to parent (from_table)
            # Use proper singular form of parent table name
            parent_table_name = get_table_name_for_field(relationship.from_table)
            parent_singular = pluralize_to_singular(parent_table_name)
            
            create_link_field(
                table_name=relationship.to_table,  # Link field goes in child table
                field_name=relationship.to_field or f"{parent_singular}_link",
                link_to_table=relationship.from_table,  # Points to parent table
                label=relationship.relationship_name
            )
        elif relationship.relationship_type == "One to One":
            # Create link fields in both tables using proper singular forms
            target_table_name = get_table_name_for_field(relationship.to_table)
            target_singular = pluralize_to_singular(target_table_name)
            
            source_table_name = get_table_name_for_field(relationship.from_table)
            source_singular = pluralize_to_singular(source_table_name)
            
            create_link_field(
                table_name=relationship.from_table,
                field_name=relationship.from_field or f"{target_singular}_link",
                link_to_table=relationship.to_table,
                label=f"{relationship.relationship_name} (From)"
            )
            create_link_field(
                table_name=relationship.to_table,
                field_name=relationship.to_field or f"{source_singular}_link",
                link_to_table=relationship.from_table,
                label=f"{relationship.relationship_name} (To)"
            )
        elif relationship.relationship_type == "Many to Many":
            # For Many-to-Many, we'll need a junction table (future enhancement)
            frappe.msgprint("Many-to-Many relationships will be implemented soon", alert=True)
        
        frappe.db.commit()
        
        return {
            "success": True,
            "relationship": relationship.name,
            "message": f"Relationship '{relationship.relationship_name}' created successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship: {str(e)}", "Create Relationship")
        return {"success": False, "error": str(e)}

def create_link_field(table_name, field_name, link_to_table, label):
    """Create a link field in a Flansa table using native field management"""
    try:
        # Import native field management API
        from flansa.native_fields import add_basic_field_native
        
        # Get the source and target tables
        source_table = frappe.get_doc("Flansa Table", table_name)
        target_table = frappe.get_doc("Flansa Table", link_to_table)
        
        if not source_table.doctype_name or not target_table.doctype_name:
            frappe.throw(f"DocTypes not generated for tables: {table_name} -> {source_table.doctype_name}, {link_to_table} -> {target_table.doctype_name}")
        
        # Check if field already exists to prevent duplicates
        if _field_already_exists(source_table.doctype_name, field_name):
            frappe.logger().info(f"Field {field_name} already exists in {source_table.doctype_name}, skipping creation")
            return True
        
        # Create the link field using native API
        field_config = {
            "field_name": field_name,
            "field_label": label,
            "field_type": "Link",
            "options": target_table.doctype_name,
            "required": 0,
            "hidden": 0,
            "read_only": 0
        }
        
        # Add the field using native field management
        result = add_basic_field_native(table_name, field_config)
        
        if not result.get("success"):
            frappe.throw(f"Failed to create link field: {result.get('error', 'Unknown error')}")
        
        return True
        
    except Exception as e:
        frappe.log_error(f"Error creating link field: {str(e)}", "Create Link Field")
        raise

@frappe.whitelist()
def get_relationship_details(relationship_name):
    """Get detailed information about a relationship"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get table details
        from_table = frappe.get_doc("Flansa Table", relationship.from_table)
        to_table = frappe.get_doc("Flansa Table", relationship.to_table)
        
        return {
            "success": True,
            "relationship": {
                "name": relationship.name,
                "relationship_name": relationship.relationship_name,
                "relationship_type": relationship.relationship_type,
                "from_table": {
                    "name": from_table.name,
                    "label": from_table.table_label or from_table.table_name,
                    "doctype_name": from_table.doctype_name
                },
                "to_table": {
                    "name": to_table.name,
                    "label": to_table.table_label or to_table.table_name,
                    "doctype_name": to_table.doctype_name
                },
                "from_field": relationship.from_field,
                "to_field": relationship.to_field,
                "status": relationship.status
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship details: {str(e)}", "Get Relationship Details")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def delete_relationship(relationship_name):
    """Delete a relationship and optionally remove the created fields"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # TODO: Add option to remove the created link fields
        
        # Delete the relationship document
        relationship.delete()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Relationship '{relationship.relationship_name}' deleted successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting relationship: {str(e)}", "Delete Relationship")
        return {"success": False, "error": str(e)}

def _field_already_exists(doctype_name, field_name):
    """Check if a field already exists in a DocType to prevent duplicates"""
    try:
        if not frappe.db.exists("DocType", doctype_name):
            return False
        
        meta = frappe.get_meta(doctype_name)
        for field in meta.fields:
            if field.fieldname == field_name:
                return True
        return False
    except Exception:
        return False