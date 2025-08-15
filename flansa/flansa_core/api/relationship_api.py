import frappe
from frappe import _

@frappe.whitelist()
def get_application_tables(app_name):
    """Get all tables for an application"""
    try:
        tables = frappe.db.sql("""
            SELECT 
                ft.name,
                ft.table_name,
                ft.display_name,
                ft.description,
                COUNT(ff.name) as field_count
            FROM `tabFlansa Table` ft
            LEFT JOIN `tabFlansa Field` ff ON ft.name = ff.flansa_table
            WHERE ft.flansa_application = %s
            GROUP BY ft.name
            ORDER BY ft.table_name
        """, (app_name,), as_dict=True)
        
        return tables
    except Exception as e:
        frappe.log_error(f"Error getting application tables: {e}")
        return []

@frappe.whitelist()
def get_application_relationships(app_name):
    """Get all relationships for an application"""
    try:
        relationships = frappe.db.sql("""
            SELECT 
                name,
                display_name,
                from_table,
                to_table,
                relationship_type,
                from_field,
                to_field,
                description
            FROM `tabFlansa Relationship`
            WHERE flansa_application = %s
            ORDER BY name
        """, (app_name,), as_dict=True)
        
        return relationships
    except Exception as e:
        frappe.log_error(f"Error getting application relationships: {e}")
        return []

@frappe.whitelist()
def create_relationship(app_name, relationship_data):
    """Create a new relationship"""
    try:
        # Generate relationship ID
        relationship_count = frappe.db.count("Flansa Relationship", {"flansa_application": app_name})
        relationship_id = f"REL-{str(relationship_count + 1).zfill(3)}"
        
        # Create relationship document
        relationship_doc = frappe.get_doc({
            "doctype": "Flansa Relationship",
            "name": relationship_id,
            "display_name": relationship_data.get("display_name"),
            "flansa_application": app_name,
            "from_table": relationship_data.get("from_table"),
            "to_table": relationship_data.get("to_table"),
            "relationship_type": relationship_data.get("relationship_type"),
            "from_field": relationship_data.get("from_field"),
            "to_field": relationship_data.get("to_field"),
            "description": relationship_data.get("description", "")
        })
        
        relationship_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "relationship_id": relationship_id,
            "message": "Relationship created successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship: {e}")
        frappe.throw(_("Error creating relationship: {0}").format(str(e)))

@frappe.whitelist()
def delete_relationship(relationship_name):
    """Delete a relationship"""
    try:
        if frappe.db.exists("Flansa Relationship", relationship_name):
            frappe.delete_doc("Flansa Relationship", relationship_name, ignore_permissions=True)
            frappe.db.commit()
            
            return {
                "success": True,
                "message": "Relationship deleted successfully"
            }
        else:
            frappe.throw(_("Relationship not found"))
            
    except Exception as e:
        frappe.log_error(f"Error deleting relationship: {e}")
        frappe.throw(_("Error deleting relationship: {0}").format(str(e)))

@frappe.whitelist()
def get_table_fields(table_name):
    """Get all fields for a table"""
    try:
        fields = frappe.db.sql("""
            SELECT 
                name,
                field_name,
                field_label,
                field_type,
                is_required
            FROM `tabFlansa Field`
            WHERE flansa_table = %s
            ORDER BY field_name
        """, (table_name,), as_dict=True)
        
        return fields
    except Exception as e:
        frappe.log_error(f"Error getting table fields: {e}")
        return []

@frappe.whitelist()
def validate_relationship(from_table, to_table, from_field, to_field):
    """Validate a relationship between two tables"""
    try:
        # Check if tables exist
        if not frappe.db.exists("Flansa Table", from_table):
            return {"valid": False, "error": f"From table '{from_table}' not found"}
            
        if not frappe.db.exists("Flansa Table", to_table):
            return {"valid": False, "error": f"To table '{to_table}' not found"}
        
        # Check if fields exist in respective tables
        from_field_exists = frappe.db.sql("""
            SELECT name FROM `tabFlansa Field`
            WHERE flansa_table = %s AND field_name = %s
        """, (from_table, from_field))
        
        if not from_field_exists:
            return {"valid": False, "error": f"Field '{from_field}' not found in table '{from_table}'"}
        
        to_field_exists = frappe.db.sql("""
            SELECT name FROM `tabFlansa Field`
            WHERE flansa_table = %s AND field_name = %s
        """, (to_table, to_field))
        
        if not to_field_exists:
            return {"valid": False, "error": f"Field '{to_field}' not found in table '{to_table}'"}
        
        return {"valid": True, "message": "Relationship is valid"}
        
    except Exception as e:
        frappe.log_error(f"Error validating relationship: {e}")
        return {"valid": False, "error": str(e)}