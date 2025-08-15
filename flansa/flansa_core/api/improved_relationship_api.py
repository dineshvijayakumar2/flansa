
# Improved relationship API
import frappe
from frappe import _
import json

def resolve_app_name(app_name):
    """Resolve app name - handle both display name and app ID"""
    # First try as direct app ID
    if frappe.db.exists("Flansa Application", app_name):
        return app_name
    
    # Then try to find by display name (app_name)
    app_id = frappe.db.get_value("Flansa Application", {"app_name": app_name}, "name")
    if app_id:
        return app_id
        
    return None

@frappe.whitelist()
def get_application_tables(app_name):
    """Get all tables for an application with proper field mapping"""
    try:
        # Resolve the actual app ID
        app_id = resolve_app_name(app_name)
        if not app_id:
            frappe.log_error(f"Application not found: {app_name}")
            return []
        
        # Get tables with correct column names
        tables = frappe.db.sql("""
            SELECT 
                ft.name,
                ft.table_name,
                ft.table_label as display_name,
                ft.application,
                ft.fields_count as field_count
            FROM `tabFlansa Table` ft
            WHERE ft.application = %s
            ORDER BY ft.table_label
        """, (app_id,), as_dict=True)
        
        # Add computed field count if not available
        for table in tables:
            if not table.get('field_count'):
                # Count fields from JSON if available
                table_doc = frappe.get_doc("Flansa Table", table.name)
                if table_doc.fields_json:
                    try:
                        fields = json.loads(table_doc.fields_json)
                        table.field_count = len(fields)
                    except:
                        table.field_count = 0
                else:
                    table.field_count = 0
        
        return tables
        
    except Exception as e:
        frappe.log_error(f"Error getting application tables: {e}")
        return []

@frappe.whitelist()
def get_application_relationships(app_name):
    """Get all relationships for an application"""
    try:
        # Resolve the actual app ID
        app_id = resolve_app_name(app_name)
        if not app_id:
            frappe.log_error(f"Application not found: {app_name}")
            return []
        # Check if relationships table exists
        relationships = frappe.get_all("Flansa Relationship",
            filters={"from_table": ["like", "%"]},
            fields=["name", "relationship_name", "from_table", "to_table", "relationship_type", "from_field", "to_field"],
            limit=100
        )
        
        # Filter relationships for this application's tables
        app_tables = get_application_tables(app_id)
        app_table_names = [t['name'] for t in app_tables]
        
        filtered_relationships = []
        for rel in relationships:
            if rel.from_table in app_table_names or rel.to_table in app_table_names:
                # Get table labels for display
                from_table_label = frappe.db.get_value("Flansa Table", rel.from_table, "table_label") or rel.from_table
                to_table_label = frappe.db.get_value("Flansa Table", rel.to_table, "table_label") or rel.to_table
                
                rel['from_table_label'] = from_table_label
                rel['to_table_label'] = to_table_label
                rel['display_name'] = rel.relationship_name or f"{from_table_label} → {to_table_label}"
                filtered_relationships.append(rel)
        
        return filtered_relationships
        
    except Exception as e:
        frappe.log_error(f"Error getting application relationships: {e}")
        return []

@frappe.whitelist()
def auto_generate_field_names(from_table, to_table, relationship_type):
    """Auto-generate suggested field names for relationship"""
    try:
        from_table_doc = frappe.get_doc("Flansa Table", from_table)
        to_table_doc = frappe.get_doc("Flansa Table", to_table)
        
        from_table_name = from_table_doc.table_name or from_table_doc.name
        to_table_name = to_table_doc.table_name or to_table_doc.name
        
        suggestions = {}
        
        if relationship_type == "One to Many":
            # From table gets a field pointing to To table
            suggestions['from_field'] = f"{to_table_name}_id"
            suggestions['to_field'] = f"{from_table_name}_ref"
            
        elif relationship_type == "Many to One":
            # To table gets a field pointing to From table
            suggestions['from_field'] = f"{to_table_name}_ref"
            suggestions['to_field'] = f"{from_table_name}_id"
            
        elif relationship_type == "One to One":
            # Both tables get reference fields
            suggestions['from_field'] = f"{frappe.scrub(to_table_name)}_link"
            suggestions['to_field'] = f"{frappe.scrub(from_table_name)}_link"
            
        elif relationship_type == "Many to Many":
            # Junction table approach
            suggestions['from_field'] = f"{to_table_name}_ids"
            suggestions['to_field'] = f"{from_table_name}_ids"
        
        return suggestions
        
    except Exception as e:
        frappe.log_error(f"Error generating field names: {e}")
        return {
            'from_field': 'related_field',
            'to_field': 'reference_field'
        }

@frappe.whitelist()
def create_relationship_with_fields(app_name, relationship_data):
    """Create relationship and automatically add required fields"""
    try:
        # Create the relationship first
        relationship_doc = frappe.new_doc("Flansa Relationship")
        relationship_doc.relationship_name = relationship_data.get("display_name")
        relationship_doc.from_table = relationship_data.get("from_table")
        relationship_doc.to_table = relationship_data.get("to_table")
        relationship_doc.relationship_type = relationship_data.get("relationship_type")
        relationship_doc.from_field = relationship_data.get("from_field")
        relationship_doc.to_field = relationship_data.get("to_field")
        relationship_doc.insert(ignore_permissions=True)
        
        # Auto-add fields to tables if requested
        if relationship_data.get("auto_create_fields", True):
            from flansa.flansa_core.api.field_management import seamless_add_field
            
            # Add field to from table
            if relationship_data.get("from_field"):
                from_field_data = {
                    "field_name": relationship_data["from_field"],
                    "field_label": relationship_data["from_field"].replace("_", " ").title(),
                    "field_type": "Link" if relationship_data["relationship_type"] in ["One to Many", "Many to One"] else "Data",
                    "is_required": 0,
                    "description": f"Relationship field to {relationship_data['to_table']}"
                }
                
                try:
                    seamless_add_field(relationship_data["from_table"], from_field_data)
                except Exception as e:
                    print(f"Note: Could not auto-create from_field: {e}")
            
            # Add field to to table  
            if relationship_data.get("to_field"):
                to_field_data = {
                    "field_name": relationship_data["to_field"],
                    "field_label": relationship_data["to_field"].replace("_", " ").title(),
                    "field_type": "Link" if relationship_data["relationship_type"] in ["One to Many", "Many to One"] else "Data",
                    "is_required": 0,
                    "description": f"Relationship field to {relationship_data['from_table']}"
                }
                
                try:
                    seamless_add_field(relationship_data["to_table"], to_field_data)
                except Exception as e:
                    print(f"Note: Could not auto-create to_field: {e}")
        
        # Sync newly created fields back to Flansa Table JSON
        if relationship_data.get("auto_create_fields", True):
            try:
                from flansa.flansa_core.api.field_management import sync_doctype_to_json
                from flansa.flansa_core.api.enterprise_relationship_api import get_doctype_name_for_table
                
                # Sync both tables
                for table_field in ["from_table", "to_table"]:
                    table_name = relationship_data.get(table_field)
                    if table_name:
                        try:
                            doctype_name = get_doctype_name_for_table(table_name)
                            if doctype_name and frappe.db.exists("DocType", doctype_name):
                                sync_doctype_to_json(table_name=table_name, doctype_name=doctype_name)
                        except Exception as sync_error:
                            frappe.log_error(f"Error syncing {table_name} fields to JSON: {str(sync_error)}", "Relationship Field Sync")
            except Exception as e:
                frappe.log_error(f"Error importing sync functions: {str(e)}", "Relationship Sync Import")
        
        frappe.db.commit()
        
        return {
            "success": True,
            "relationship_id": relationship_doc.name,
            "message": "Relationship created successfully with auto-generated fields"
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship: {e}")
        return {
            "success": False,
            "error": str(e)
        }
