"""
Workspace API - DISABLED
Workspace functionality has been removed from Flansa
"""
import frappe

@frappe.whitelist()
def get_user_applications():
    """Get applications accessible to current user with dynamic table counts"""
    apps = frappe.get_all("Flansa Application", 
                         fields=["name", "app_name", "app_title", "description", "theme_color", "icon", 
                                "status", "creation"],
                         filters={"status": "Active"},
                         order_by="creation desc")
    
    # Add calculated table count for each application
    for app in apps:
        app['table_count'] = frappe.db.count("Flansa Table", {"application": app['name']})
    
    return apps

@frappe.whitelist()
def get_application_details(app_name):
    """Get detailed information about a specific application"""
    try:
        app_doc = frappe.get_doc("Flansa Application", app_name)
        
        # Get tables for this application
        try:
            tables = frappe.get_all("Flansa Table",
                                   filters={"application": app_name},
                                   fields=["name", "table_name", "table_label", "description", "status", "creation", "fields_count"],
                                   order_by="creation desc")
        except Exception as e:
            frappe.log_error(f"Error getting tables for {app_name}: {str(e)}", "Application Tables Query")
            tables = []
        
        # Get relationships for this application (filter by tables since no application field exists)
        table_names = [table.name for table in tables]
        relationships = []
        
        if table_names:
            try:
                # Get relationships where either parent_table or child_table belongs to this application
                all_relationships = frappe.get_all("Flansa Relationship",
                                                  fields=["name", "relationship_name", "relationship_type", "status", 
                                                         "parent_table", "child_table", "from_table", "to_table"],
                                                  order_by="creation desc")
                
                for rel in all_relationships:
                    # Check if relationship involves tables from this application
                    parent_table = rel.parent_table or rel.from_table
                    child_table = rel.child_table or rel.to_table
                    
                    if parent_table in table_names or child_table in table_names:
                        relationships.append(rel)
                        
            except Exception as e:
                frappe.log_error(f"Error getting relationships for {app_name}: {str(e)}", "Application Relationships Query")
                relationships = []
        
        return {
            "success": True,
            "application": app_doc.as_dict(),
            "tables": tables,
            "relationships": relationships,
            "statistics": {
                "tables": len(tables),
                "relationships": len(relationships),
                "active_tables": len([t for t in tables if t.status == "Active"])
            }
        }
    except Exception as e:
        frappe.log_error(f"Error getting application details for {app_name}: {str(e)}", "Application Details API")
        return {
            "success": False, 
            "error": str(e)
        }

@frappe.whitelist()
def create_flansa_table(table_data, app_name=None):
    """Create a new Flansa Table with auto-included system fields"""
    try:
        if isinstance(table_data, str):
            table_data = frappe.parse_json(table_data)
        
        # Get application - check both table_data and app_name parameter
        application = table_data.get("application") or app_name
        if not application:
            frappe.throw("Application parameter is required")
        
        # Create the table document
        table_doc = frappe.get_doc({
            "doctype": "Flansa Table",
            "application": application,
            "table_name": table_data.get("table_name"),
            "table_label": table_data.get("table_label"),
            "description": table_data.get("description", ""),
            "status": "Active",  # Auto-activate new tables
            # New naming configuration fields
            "naming_type": table_data.get("naming_type", "Naming Series"),
            "naming_prefix": table_data.get("naming_prefix", "REC"),
            "naming_digits": table_data.get("naming_digits", 5),
            "naming_field": table_data.get("naming_field", ""),
            "naming_start_from": table_data.get("naming_start_from", 1),
            "is_submittable": table_data.get("is_submittable", 0)
        })
        
        table_doc.insert(ignore_permissions=True)
        
        # Auto-add system fields to the table
        _add_system_fields_to_new_table(table_doc.name, table_data.get("is_submittable", 0))
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Table '{table_data.get('table_label')}' created successfully with system fields",
            "table": table_doc.as_dict(),
            "table_name": table_doc.name,  # Add table_name at root level for easy access
            "table_id": table_doc.name     # Also provide as table_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating table: {str(e)}", "Create Table API")
        return {
            "success": False,
            "error": str(e)
        }

def _add_system_fields_to_new_table(table_name, is_submittable=0):
    """
    Internal function to add system fields to newly created table
    This ensures all new tables have the built-in Frappe fields available
    """
    try:
        import json
        from flansa.flansa_core.api.system_fields_manager import FRAPPE_SYSTEM_FIELDS
        
        # Get the table document
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Get current fields JSON or initialize empty list
        current_fields = []
        if table_doc.fields_json:
            current_fields = json.loads(table_doc.fields_json)
        
        # Core system fields that should always be added
        core_system_fields = ["name", "owner", "creation", "modified", "modified_by"]
        
        # Add docstatus for submittable documents
        if is_submittable:
            core_system_fields.extend(["docstatus", "amended_from"])
        
        # Add system fields to the fields JSON
        for field_name in core_system_fields:
            if field_name in FRAPPE_SYSTEM_FIELDS:
                field_config = FRAPPE_SYSTEM_FIELDS[field_name]
                
                # Check if field already exists
                field_exists = any(f.get("field_name") == field_name for f in current_fields)
                if not field_exists:
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
                        "depends_on": field_config.get("depends_on", ""),
                        "bold": field_config.get("bold", 0),
                        "hidden": field_config.get("hidden", 0)
                    }
                    
                    # Handle special cases
                    if field_name == "amended_from":
                        # Link amended_from to the same table
                        system_field_entry["options"] = table_doc.table_name
                    
                    current_fields.append(system_field_entry)
        
        # Update the table's fields JSON
        table_doc.fields_json = json.dumps(current_fields)
        table_doc.save()
        
        # Note: System fields are now directly available through native_fields.py
        # No need to create Logic Fields for system fields as they are handled natively
        
        frappe.msgprint(f"Added {len(core_system_fields)} system fields to table {table_name}", alert=True)
        
    except Exception as e:
        frappe.log_error(f"Error adding system fields to table {table_name}: {str(e)}", "System Fields Auto-Add")


@frappe.whitelist()
def delete_flansa_table(table_name):
    """Delete a Flansa Table"""
    try:
        frappe.delete_doc("Flansa Table", table_name, force=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": "Table deleted successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting table {table_name}: {str(e)}", "Delete Table API")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()  
def create_flansa_relationship(relationship_data):
    """Create a new Flansa Relationship"""
    try:
        if isinstance(relationship_data, str):
            relationship_data = frappe.parse_json(relationship_data)
        
        # Create the relationship document
        rel_doc = frappe.get_doc({
            "doctype": "Flansa Relationship",
            "relationship_name": relationship_data.get("relationship_name"),
            "relationship_type": relationship_data.get("relationship_type"),
            "parent_table": relationship_data.get("parent_table"),
            "child_table": relationship_data.get("child_table"),
            "description": relationship_data.get("description", ""),
            "status": relationship_data.get("status", "Active"),
            "cascade_delete": relationship_data.get("cascade_delete", 0),
            "required_reference": relationship_data.get("required_reference", 0)
        })
        
        rel_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Relationship '{relationship_data.get('relationship_name')}' created successfully",
            "relationship": rel_doc.as_dict()
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship: {str(e)}", "Create Relationship API")
        return {
            "success": False,
            "error": str(e)
        }

# All other workspace functions disabled
