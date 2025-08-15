"""
Flansa Relationship API
Provides endpoints for relationship management in the visual table builder
"""

import frappe
from frappe import _
import json

@frappe.whitelist()
def generate_computed_fields(relationship_name):
    """Generate computed fields for a relationship"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get the parent and child table details
        from_table = frappe.get_doc("Flansa Table", relationship.from_table)
        to_table = frappe.get_doc("Flansa Table", relationship.to_table)
        
        # Get UI configuration
        ui_config = {}
        if relationship.ui_config:
            try:
                ui_config = json.loads(relationship.ui_config)
            except:
                ui_config = {}
        
        computed_fields = []
        
        # Always add a count field if requested
        if ui_config.get('add_count_field', True):
            count_field = {
                "field_name": f"total_{to_table.table_name.lower()}_count",
                "field_label": f"Total {to_table.table_label}",
                "computation_type": "Count"
            }
            computed_fields.append(count_field)
        
        # Add sum fields for numeric fields if requested
        if ui_config.get('add_sum_fields') and to_table.doctype_name and frappe.db.exists("DocType", to_table.doctype_name):
            try:
                doctype_fields = frappe.get_meta(to_table.doctype_name).fields
                
                for field in doctype_fields:
                    if field.fieldtype in ["Currency", "Float", "Int"]:
                        sum_field = {
                            "field_name": f"total_{field.fieldname}",
                            "field_label": f"Total {field.label}",
                            "computation_type": "Sum",
                            "target_field": field.fieldname
                        }
                        computed_fields.append(sum_field)
            except Exception as e:
                frappe.log_error(f"Error analyzing fields: {str(e)}", "Computed Fields Generation")
        
        # Update the relationship with computed fields
        if computed_fields:
            # Clear existing and add new
            getattr(relationship, 'computed_fields', []) = []
            for cf in computed_fields:
                relationship.append("computed_fields", cf)
            
            relationship.save(ignore_permissions=True)
            frappe.db.commit()
        
        return computed_fields
        
    except Exception as e:
        frappe.log_error(f"Error generating computed fields: {str(e)}", "Relationship API")
        frappe.throw(_("Error generating computed fields: {0}").format(str(e)))

@frappe.whitelist()
def get_relationship_graph(application=None):
    """Get data for relationship visualization"""
    
    try:
        filters = {}
        if application:
            # Get all tables for this application
            tables = frappe.get_all("Flansa Table", 
                                   filters={"application": application},
                                   fields=["name"])
            table_names = [t.name for t in tables]
            
            # Get relationships involving these tables
            relationships = frappe.get_all("Flansa Relationship",
                                          filters=[
                                              ["from_table", "in", table_names],
                                              ["or", "to_table", "in", table_names]
                                          ],
                                          fields=["name", "relationship_name", "relationship_type",
                                                 "from_table", "to_table", "status"])
        else:
            relationships = frappe.get_all("Flansa Relationship",
                                          fields=["name", "relationship_name", "relationship_type",
                                                 "from_table", "to_table", "status"])
        
        # Build graph data
        nodes = {}
        edges = []
        
        for rel in relationships:
            # Add nodes
            if rel.from_table not in nodes:
                try:
                    from_table_doc = frappe.get_doc("Flansa Table", rel.from_table)
                    nodes[rel.from_table] = {
                        "id": rel.from_table,
                        "label": from_table_doc.table_label,
                        "type": "table"
                    }
                except:
                    continue
            
            if rel.to_table not in nodes:
                try:
                    to_table_doc = frappe.get_doc("Flansa Table", rel.to_table)
                    nodes[rel.to_table] = {
                        "id": rel.to_table,
                        "label": to_table_doc.table_label,
                        "type": "table"
                    }
                except:
                    continue
            
            # Add edge
            edges.append({
                "from": rel.from_table,
                "to": rel.to_table,
                "label": rel.relationship_name,
                "type": rel.relationship_type,
                "active": rel.status == "Active"
            })
        
        return {
            "nodes": list(nodes.values()),
            "edges": edges
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship graph: {str(e)}", "Relationship API")
        return {"nodes": [], "edges": []}

@frappe.whitelist()
def validate_relationship(from_table, to_table, relationship_type):
    """Validate if a relationship can be created"""
    
    try:
        # Check for existing relationships
        existing = frappe.get_all("Flansa Relationship",
                                 filters={
                                     "from_table": from_table,
                                     "to_table": to_table,
                                     "relationship_type": relationship_type
                                 })
        
        if existing:
            return {
                "valid": False,
                "message": _("A {0} relationship already exists between these tables").format(relationship_type)
            }
        
        # Check for circular dependencies
        if from_table == to_table and relationship_type not in ["One to One", "Self Referential"]:
            return {
                "valid": False,
                "message": _("Self-referencing relationships must be One to One or Self Referential")
            }
        
        return {
            "valid": True,
            "message": _("Relationship can be created")
        }
        
    except Exception as e:
        frappe.log_error(f"Error validating relationship: {str(e)}", "Relationship API")
        return {
            "valid": False,
            "message": str(e)
        }

@frappe.whitelist()
def get_table_fields_for_relationship(table_name):
    """Get fields from a table for relationship configuration"""
    
    try:
        table = frappe.get_doc("Flansa Table", table_name)
        
        if not table.doctype_name or not frappe.db.exists("DocType", table.doctype_name):
            return []
        
        meta = frappe.get_meta(table.doctype_name)
        fields = []
        
        for field in meta.fields:
            if field.fieldtype not in ['Section Break', 'Column Break', 'HTML']:
                fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "fieldtype": field.fieldtype,
                    "options": field.options
                })
        
        return fields
        
    except Exception as e:
        frappe.log_error(f"Error getting table fields: {str(e)}", "Relationship API")
        return []

@frappe.whitelist()
def get_available_tables_for_relationship(current_table):
    """Get list of tables available for creating relationships"""
    
    try:
        # Get all active tables except the current one
        tables = frappe.get_all("Flansa Table",
                               filters={
                                   "status": "Active",
                                   "name": ["!=", current_table]
                               },
                               fields=["name", "table_label", "table_name", "application"])
        
        return tables
        
    except Exception as e:
        frappe.log_error(f"Error getting available tables: {str(e)}", "Relationship API")
        return []
