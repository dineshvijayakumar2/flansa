"""
Unified Field Synchronization Utilities
Handles all field synchronization between:
- Flansa Field records ↔ Flansa Table JSON storage
- JSON storage ↔ Flansa Field records
- Bulk sync operations
"""

import frappe
import json

def sync_field_to_json(doc, method):
    """Automatically sync a single field to JSON storage when it changes"""
    try:
        if not hasattr(doc, 'flansa_table') or not doc.flansa_table:
            return
        
        # Prevent recursion during auto-sync operations
        if hasattr(doc, 'flags') and doc.flags.get('ignore_auto_sync'):
            return
            
        table_id = doc.flansa_table
        
        # Get table document and update JSON directly without hooks
        table_doc = frappe.get_doc("Flansa Table", table_id)
        current_fields = []
        
        if table_doc.fields_json:
            try:
                current_fields = json.loads(table_doc.fields_json)
            except json.JSONDecodeError:
                current_fields = []
        
        # Prepare this field's data
        field_data = {
            "field_name": getattr(doc, 'field_name', ''),
            "field_label": getattr(doc, 'field_label', ''),
            "field_type": getattr(doc, 'field_type', 'Data'),
            "options": getattr(doc, 'options', ''),
            "description": getattr(doc, 'description', ''),
            "default_value": getattr(doc, 'default_value', ''),
            "is_required": getattr(doc, 'is_required', 0),
            "is_unique": getattr(doc, 'is_unique', 0),
            "is_readonly": getattr(doc, 'is_readonly', 0),
            "in_list_view": getattr(doc, 'in_list_view', 0),
            "in_standard_filter": getattr(doc, 'in_standard_filter', 0),
            "field_order": getattr(doc, 'field_order', 1)
        }
        
        # Find and update this field, or add it if new
        field_found = False
        for i, field in enumerate(current_fields):
            if field.get('field_name') == field_data['field_name']:
                current_fields[i] = field_data
                field_found = True
                break
        
        if not field_found:
            current_fields.append(field_data)
        
        # Save directly without triggering hooks
        table_doc.flags.ignore_hooks = True
        table_doc.fields_json = json.dumps(current_fields)
        table_doc.save(ignore_permissions=True)
        
        frappe.logger().info(f"Auto-synced field {field_data['field_name']} to JSON for table {table_id}")
        
    except Exception as e:
        frappe.log_error(f"Error in auto sync field: {str(e)}", "Auto Sync Field")

def sync_field_deletion(doc, method):
    """Remove field from JSON when Flansa Field is deleted"""
    try:
        if not hasattr(doc, 'flansa_table') or not doc.flansa_table:
            return
        
        table_id = doc.flansa_table
        field_name = getattr(doc, 'field_name', '')
        
        if not field_name:
            return
        
        # Get table document and update JSON directly without hooks
        table_doc = frappe.get_doc("Flansa Table", table_id)
        current_fields = []
        
        if table_doc.fields_json:
            try:
                current_fields = json.loads(table_doc.fields_json)
            except json.JSONDecodeError:
                current_fields = []
        
        # Remove this field
        updated_fields = [f for f in current_fields if f.get('field_name') != field_name]
        
        # Save directly without triggering hooks
        table_doc.flags.ignore_hooks = True
        table_doc.fields_json = json.dumps(updated_fields)
        table_doc.save(ignore_permissions=True)
        
        frappe.logger().info(f"Auto-removed field {field_name} from JSON for table {table_id}")
        
    except Exception as e:
        frappe.log_error(f"Error in auto sync deletion: {str(e)}", "Auto Sync Delete")

@frappe.whitelist()
def bulk_sync_table(table_id):
    """Sync all fields for a specific table - from Flansa Field to JSON only"""
    try:
        # Check for recursion flag to prevent infinite loops
        if hasattr(frappe.local, 'bulk_sync_in_progress') and table_id in frappe.local.bulk_sync_in_progress:
            return {"success": True, "message": "Sync already in progress, skipping"}
        
        # Set recursion flag
        if not hasattr(frappe.local, 'bulk_sync_in_progress'):
            frappe.local.bulk_sync_in_progress = set()
        frappe.local.bulk_sync_in_progress.add(table_id)
        
        try:
            # Get table document
            table_doc = frappe.get_doc("Flansa Table", table_id)
            
            # Get all Flansa Field records for this table
            flansa_fields = frappe.get_all("Flansa Field",
                                          filters={"flansa_table": table_id},
                                          fields=["name", "field_name", "field_label", "field_type", "options", 
                                                 "description", "default_value", "is_required", "is_unique", 
                                                 "is_readonly", "in_list_view", "in_standard_filter", "field_order"],
                                          order_by="field_order")
            
            # Convert to JSON format
            json_fields = []
            for i, field in enumerate(flansa_fields):
                json_fields.append({
                    "field_name": field.field_name,
                    "field_label": field.field_label or field.field_name.replace('_', ' ').title(),
                    "field_type": field.field_type or "Data",
                    "options": field.options or "",
                    "description": field.description or "",
                    "default_value": field.default_value or "",
                    "is_required": field.is_required or 0,
                    "is_unique": field.is_unique or 0,
                    "is_readonly": field.is_readonly or 0,
                    "in_list_view": field.in_list_view or 0,
                    "in_standard_filter": field.in_standard_filter or 0,
                    "field_order": field.field_order or (i + 1)
                })
            
            # Save directly to table doc without triggering hooks
            table_doc.flags.ignore_hooks = True
            table_doc.fields_json = json.dumps(json_fields)
            table_doc.save(ignore_permissions=True)
            frappe.db.commit()
            
            return {"success": True, "synced": len(json_fields)}
            
        finally:
            # Clear recursion flag
            frappe.local.bulk_sync_in_progress.discard(table_id)
        
    except Exception as e:
        frappe.log_error(f"Error in bulk sync: {str(e)}", "Bulk Sync")
        return {"success": False, "error": str(e)}

def bulk_sync_table_wrapper(doc, method):
    """Wrapper for bulk_sync_table to be used in hooks"""
    try:
        bulk_sync_table(doc.name)
    except Exception as e:
        frappe.log_error(f"Error in bulk sync wrapper: {str(e)}", "Bulk Sync Wrapper")

def sync_table_to_fields(doc, method):
    """Sync Flansa Table JSON fields to create/update Flansa Field records"""
    try:
        # Skip if this is being called by bulk sync to avoid conflicts
        if hasattr(doc, 'flags') and doc.flags.get('ignore_hooks'):
            return
            
        # Get fields from JSON storage
        fields_data = []
        if doc.fields_json:
            try:
                fields_data = json.loads(doc.fields_json)
            except json.JSONDecodeError:
                fields_data = []
        
        if not fields_data:
            return
            
        # Get existing Flansa Field records for this table
        existing_fields = frappe.get_all("Flansa Field", 
                                        filters={"flansa_table": doc.name},
                                        fields=["name", "field_name"])
        existing_dict = {f.field_name: f.name for f in existing_fields}
        current_field_names = set()
        
        # Process each field from JSON
        for field in fields_data:
            field_name = field.get("field_name")
            if field_name:
                current_field_names.add(field_name)
                
                if field_name in existing_dict:
                    # Update existing Flansa Field
                    field_doc = frappe.get_doc("Flansa Field", existing_dict[field_name])
                    field_doc.flags.ignore_auto_sync = True  # Prevent auto-sync loop
                    field_doc.field_label = field.get("field_label", field_name)
                    field_doc.field_type = field.get("field_type", "Data")
                    field_doc.options = field.get("options", "")
                    field_doc.default_value = field.get("default_value", "")
                    field_doc.description = field.get("description", "")
                    field_doc.is_required = field.get("is_required", 0)
                    field_doc.is_unique = field.get("is_unique", 0)
                    field_doc.is_readonly = field.get("is_readonly", 0)
                    field_doc.in_list_view = field.get("in_list_view", 0)
                    field_doc.in_standard_filter = field.get("in_standard_filter", 0)
                    field_doc.field_order = field.get("field_order", 1)
                    field_doc.save(ignore_permissions=True)
                else:
                    # Create new Flansa Field
                    new_field = frappe.get_doc({
                        "doctype": "Flansa Field",
                        "flansa_table": doc.name,
                        "field_name": field_name,
                        "field_label": field.get("field_label", field_name),
                        "field_type": field.get("field_type", "Data"),
                        "options": field.get("options", ""),
                        "default_value": field.get("default_value", ""),
                        "description": field.get("description", ""),
                        "is_required": field.get("is_required", 0),
                        "is_unique": field.get("is_unique", 0),
                        "is_readonly": field.get("is_readonly", 0),
                        "in_list_view": field.get("in_list_view", 0),
                        "in_standard_filter": field.get("in_standard_filter", 0),
                        "field_order": field.get("field_order", 1)
                    })
                    new_field.flags.ignore_auto_sync = True  # Prevent auto-sync loop
                    new_field.insert(ignore_permissions=True)
        
        # Remove Flansa Fields that are no longer in the JSON
        for field_name, field_id in existing_dict.items():
            if field_name not in current_field_names:
                frappe.delete_doc("Flansa Field", field_id, ignore_permissions=True)
        
    except Exception as e:
        frappe.log_error(f"Error syncing table to fields: {str(e)}", "Table Field Sync")

@frappe.whitelist()
def cleanup_duplicate_field_records(table_id):
    """Remove duplicate Flansa Field records for a table, keeping only the latest"""
    try:
        # Get all field records for this table grouped by field_name
        fields = frappe.get_all("Flansa Field",
                               filters={"flansa_table": table_id},
                               fields=["name", "field_name", "creation"],
                               order_by="field_name, creation desc")
        
        # Group by field_name and remove duplicates
        seen_fields = set()
        duplicates_to_remove = []
        
        for field in fields:
            if field.field_name in seen_fields:
                duplicates_to_remove.append(field.name)
            else:
                seen_fields.add(field.field_name)
        
        # Remove duplicate records
        for field_id in duplicates_to_remove:
            frappe.delete_doc("Flansa Field", field_id, ignore_permissions=True)
        
        frappe.db.commit()
        
        return {
            "success": True,
            "removed": len(duplicates_to_remove),
            "message": f"Removed {len(duplicates_to_remove)} duplicate field records"
        }
        
    except Exception as e:
        frappe.log_error(f"Error cleaning up duplicates: {str(e)}", "Cleanup Duplicates")
        return {"success": False, "error": str(e)}
