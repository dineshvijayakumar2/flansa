"""
Safe Relationship API - handles missing fields gracefully
"""

import frappe

@frappe.whitelist()
def get_table_relationships(table_id):
    """Get relationships for a table with safe field handling"""
    try:
        # Get all relationships where this table is involved
        relationships = frappe.db.sql("""
            SELECT name, from_table, to_table, relationship_type,
                   COALESCE(link_field, '') as link_field,
                   COALESCE(field_name, '') as field_name
            FROM `tabFlansa Relationship`
            WHERE from_table = %(table_id)s OR to_table = %(table_id)s
        """, {"table_id": table_id}, as_dict=True)
        
        return {
            "success": True,
            "relationships": relationships,
            "count": len(relationships)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table relationships: {str(e)}", "Get Table Relationships")
        return {
            "success": False,
            "error": str(e),
            "relationships": []
        }

@frappe.whitelist()
def get_relationship_fields():
    """Get available fields in Flansa Relationship DocType"""
    try:
        if not frappe.db.exists("DocType", "Flansa Relationship"):
            return {"success": False, "error": "Flansa Relationship DocType not found"}
        
        relationship_doctype = frappe.get_doc("DocType", "Flansa Relationship")
        
        fields = []
        for field in relationship_doctype.fields:
            if field.fieldtype not in ['Section Break', 'Column Break']:
                fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "fieldtype": field.fieldtype
                })
        
        return {
            "success": True,
            "fields": fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship fields: {str(e)}", "Get Relationship Fields")
        return {"success": False, "error": str(e)}
