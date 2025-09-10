"""
Enhanced Field Management API - SEAMLESS WORKFLOW
Auto-syncs fields and activates tables automatically
"""

import frappe
from frappe import _
import json

@frappe.whitelist()
def get_filtered_table_fields(table_name, field_type=None, search_term=None):
    """Get filtered fields for a table - now uses native DocType fields"""
    try:
        # Get all fields using the updated get_table_fields function
        result = get_table_fields(table_name)
        
        if not result.get("success"):
            return result
        
        fields = result.get("fields", [])
        
        # Apply filters
        filtered_fields = []
        for field in fields:
            # Filter by field type
            if field_type and field.get("field_type") != field_type:
                continue
            
            # Filter by search term
            if search_term:
                search_lower = search_term.lower()
                field_name_match = search_lower in (field.get("field_name", "").lower())
                field_label_match = search_lower in (field.get("field_label", "").lower())
                if not (field_name_match or field_label_match):
                    continue
            
            filtered_fields.append(field)
        
        return {
            "success": True,
            "fields": filtered_fields,
            "total_fields": len(fields),
            "filtered_count": len(filtered_fields)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting filtered fields: {str(e)}", "Field Management")
        return {
            "success": False,
            "error": str(e),
            "fields": []
        }

@frappe.whitelist()
def get_visual_builder_fields(table_name):
    """Get only user-visible fields for Visual Builder - hide tenant fields"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Check if DocType exists
        if not table_doc.doctype_name or not frappe.db.exists("DocType", table_doc.doctype_name):
            return {
                "success": False,
                "error": "DocType not found or not generated yet",
                "fields": []
            }
        
        meta = frappe.get_meta(table_doc.doctype_name)
        
        # Define tenant system fields that should be hidden
        tenant_system_fields = ['workspace_id', 'flansa_table_id', 'application_id']
        
        visible_fields = []
        
        # First, add essential system fields that should always be available for forms
        # These may not appear in meta.fields but are important for form building
        essential_system_fields = [
            {
                'fieldname': 'name',
                'fieldtype': 'Data',
                'label': 'ID/Name',
                'hidden': 0,
                'read_only': 1,  # Name field is typically read-only in forms
                'reqd': 0,
                'options': '',
                'description': 'Document identifier',
                'in_list_view': 1,
                'category': 'system'
            },
            {
                'fieldname': 'owner',
                'fieldtype': 'Link',
                'label': 'Created By',
                'hidden': 0,
                'read_only': 1,
                'reqd': 0,
                'options': 'User',
                'description': 'User who created this record',
                'in_list_view': 0,
                'category': 'system'
            },
            {
                'fieldname': 'creation',
                'fieldtype': 'Datetime',
                'label': 'Created On',
                'hidden': 0,
                'read_only': 1,
                'reqd': 0,
                'options': '',
                'description': 'Date and time when record was created',
                'in_list_view': 1,
                'category': 'system'
            },
            {
                'fieldname': 'modified',
                'fieldtype': 'Datetime', 
                'label': 'Last Modified',
                'hidden': 0,
                'read_only': 1,
                'reqd': 0,
                'options': '',
                'description': 'Date and time when record was last modified',
                'in_list_view': 1,
                'category': 'system'
            },
            {
                'fieldname': 'modified_by',
                'fieldtype': 'Link',
                'label': 'Modified By',
                'hidden': 0,
                'read_only': 1,
                'reqd': 0,
                'options': 'User',
                'description': 'User who last modified this record',
                'in_list_view': 0,
                'category': 'system'
            }
        ]
        
        # Track which system fields we've added to avoid duplicates
        added_fieldnames = set()
        
        # Add essential system fields first
        for sys_field in essential_system_fields:
            visible_fields.append(sys_field)
            added_fieldnames.add(sys_field['fieldname'])
        
        # Now add fields from DocType meta, skipping duplicates and filtered fields
        for field in meta.fields:
            # Skip tenant system fields
            if field.fieldname in tenant_system_fields:
                continue
                
            # Skip Frappe internal fields
            if field.fieldname.startswith('__'):
                continue
            
            # Skip if we already added this field (from essential system fields)
            if field.fieldname in added_fieldnames:
                continue
            
            # Include user and system fields
            visible_fields.append({
                'fieldname': field.fieldname,
                'fieldtype': field.fieldtype,
                'label': field.label,
                'hidden': field.hidden,
                'read_only': field.read_only,
                'reqd': field.reqd,
                'options': field.options,
                'description': field.description,
                'in_list_view': field.in_list_view,
                'category': get_field_category(field.fieldname)
            })
        
        return {
            'success': True,
            'fields': visible_fields,
            'total_visible': len(visible_fields),
            'table_name': table_name,
            'doctype_name': table_doc.doctype_name
        }
    
    except Exception as e:
        frappe.log_error(f"Error getting Visual Builder fields: {str(e)}", "Visual Builder Fields")
        return {
            'success': False, 
            'error': str(e),
            'fields': []
        }

def get_field_category(fieldname):
    """Categorize fields for Visual Builder"""
    system_fields = ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus']
    
    if fieldname in system_fields:
        return 'system'
    else:
        return 'user'

@frappe.whitelist()
def get_table_fields(table_name):
    """Get all fields for a table - now uses native DocType fields"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Use native field management to get fields
        from flansa.native_fields import get_table_fields_native
        native_result = get_table_fields_native(table_name)
        
        if not native_result.get("success"):
            # No fallback - native fields only
            fields = []
        else:
            # Convert native fields to expected format for visual builder
            fields = []
            for field in native_result.get("fields", []):
                # Only include Flansa-created fields
                if field.get("created_by_flansa"):
                    fields.append({
                        "field_name": field["fieldname"],
                        "field_label": field["label"],
                        "field_type": field["fieldtype"],
                        "is_required": field.get("reqd", 0),
                        "is_readonly": field.get("read_only", 0),
                        "is_hidden": field.get("hidden", 0),
                        "options": field.get("options", ""),
                        "description": field.get("description", ""),
                        "field_order": fields.__len__() + 1
                    })
        
        return {
            "success": True,
            "fields": fields,
            "table_name": table_name,
            "table_label": table_doc.table_label,
            "table_status": table_doc.status,
            "doctype_name": table_doc.doctype_name
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "fields": []
        }

@frappe.whitelist() 
def save_table_fields(table_name, fields_data):
    """Save fields - seamless workflow (main method)"""
    return save_table_fields_seamless(table_name, fields_data)

@frappe.whitelist()
def cleanup_duplicate_fields(doctype_name):
    """Remove duplicate fields from a DocType with retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if not frappe.db.exists("DocType", doctype_name):
                return {"success": False, "error": f"DocType {doctype_name} does not exist"}
            
            # Reload the document each time to get latest version
            doctype = frappe.get_doc("DocType", doctype_name)
            doctype.reload()  # Ensure we have the latest version
            
            seen_fieldnames = set()
            cleaned_fields = []
            duplicates_removed = 0
            
            for field in doctype.fields:
                if field.fieldname in seen_fieldnames:
                    duplicates_removed += 1
                    frappe.logger().info(f"Removing duplicate field: {field.fieldname}")
                    continue
                seen_fieldnames.add(field.fieldname)
                cleaned_fields.append(field)
            
            if duplicates_removed == 0:
                return {
                    "success": True,
                    "message": f"No duplicate fields found in {doctype_name}",
                    "duplicates_removed": 0
                }
            
            # Update the fields
            doctype.fields = cleaned_fields
            doctype.save()
            frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Removed {duplicates_removed} duplicate fields from {doctype_name}",
                "duplicates_removed": duplicates_removed
            }
            
        except frappe.TimestampMismatchError as e:
            if attempt < max_retries - 1:
                frappe.logger().info(f"Document modified concurrently, retrying attempt {attempt + 1}")
                continue
            else:
                return {
                    "success": False, 
                    "error": f"Document modified too many times, please try again: {str(e)}"
                }
        except Exception as e:
            frappe.log_error(f"Error cleaning duplicate fields: {str(e)}", "Field Cleanup")
            return {"success": False, "error": str(e)}

@frappe.whitelist()
def add_field(table_name, field_data):
    """Add a field and auto-sync"""
    try:
        if isinstance(field_data, str):
            field_data = json.loads(field_data)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        existing_fields = []
        
        if table_doc.fields_json:
            existing_fields = json.loads(table_doc.fields_json)
        
        # Check for duplicate field names
        field_name = field_data.get("field_name")
        if field_name:
            # Remove any existing field with the same name
            existing_fields = [f for f in existing_fields if f.get("field_name") != field_name]
            frappe.logger().info(f"Adding field {field_name} to {table_name}, removed any duplicates")
        
        existing_fields.append(field_data)
        return save_table_fields_seamless(table_name, existing_fields)
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def update_field(table_name, field_name, field_data):
    """Update a field and auto-sync"""
    try:
        if isinstance(field_data, str):
            field_data = json.loads(field_data)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        existing_fields = []
        
        if table_doc.fields_json:
            existing_fields = json.loads(table_doc.fields_json)
        
        # Update the field
        for i, field in enumerate(existing_fields):
            if field.get("field_name") == field_name:
                existing_fields[i] = field_data
                break
        else:
            existing_fields.append(field_data)
        
        return save_table_fields_seamless(table_name, existing_fields)
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def delete_field(table_name, field_name):
    """Delete a field using native field management"""
    try:
        # Use native field management
        from flansa.native_fields import delete_field_native
        
        # Delete field using native API
        result = delete_field_native(table_name, field_name)
        
        if result.get("success"):
            frappe.logger().info(f"Deleted field {field_name} from {table_name} using native API")
            
            # Get updated fields list
            fields_result = get_table_fields(table_name)
            if fields_result.get("success"):
                return {
                    "success": True,
                    "message": f"Field deleted successfully",
                    "fields": fields_result.get("fields", [])
                }
        
        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def seamless_delete_field(table_name, field_name):
    """Seamless delete field - alias for delete_field"""
    return delete_field(table_name, field_name)

@frappe.whitelist()
def seamless_add_field(table_name, field_data):
    """Seamless add field - now uses native field management with deduplication"""
    try:
        if isinstance(field_data, str):
            field_data = json.loads(field_data)
        
        # Global deduplication check for link fields
        field_name = field_data.get("field_name")
        field_type = field_data.get("field_type")
        
        if field_type == "Link" and field_name:
            # Get target doctype
            doctype_name = frappe.db.get_value("Flansa Table", table_name, "doctype_name")
            if doctype_name:
                # Check if any link field with same purpose already exists
                if _check_duplicate_link_field(doctype_name, field_name, field_data.get("options")):
                    frappe.logger().info(f"Skipping duplicate link field creation: {field_name} in {doctype_name}")
                    return {"success": True, "message": f"Field {field_name} already exists", "skipped": True}
                
                # Log field creation for debugging
                frappe.logger().info(f"Creating link field: {field_name} in {doctype_name} pointing to {field_data.get('options')}")
        
        # Use native field management
        from flansa.native_fields import add_basic_field_native
        
        # Check if this is a lookup field with fetch_from
        if field_data.get("fetch_from"):
            # Use lookup field native API for fetch fields
            from flansa.native_fields import add_lookup_field_native
            
            # Extract the source field and lookup field from fetch_from
            fetch_from = field_data.get("fetch_from", "")
            if "." in fetch_from:
                source_field, lookup_field = fetch_from.split(".", 1)
            else:
                source_field = fetch_from
                lookup_field = "name"  # Default fallback
            
            field_name = field_data.get("field_name")
            if not field_name:
                return {"success": False, "error": "Field name is required"}
            
            lookup_config = {
                "field_name": field_name,
                "field_label": field_data.get("field_label", field_name.replace("_", " ").title()),
                "field_type": field_data.get("field_type", "Data"),
                "source_field": source_field,
                "lookup_field": lookup_field
            }
            
            result = add_lookup_field_native(table_name, lookup_config)
        else:
            # Convert field data to native format for basic fields
            field_name = field_data.get("field_name")
            if not field_name:
                return {"success": False, "error": "Field name is required"}
            
            native_config = {
                "field_name": field_name,
                "field_label": field_data.get("field_label", field_name.replace("_", " ").title()),
                "field_type": field_data.get("field_type", "Data"),
                "required": field_data.get("is_required", 0) or field_data.get("reqd", 0),
                "hidden": field_data.get("is_hidden", 0),
                "read_only": field_data.get("is_readonly", 0) or field_data.get("read_only", 0),
                "options": field_data.get("options", "")
            }
            
            # Add field using native API
            result = add_basic_field_native(table_name, native_config)
        
        if result.get("success"):
            frappe.logger().info(f"Added field {field_data.get('field_name')} to {table_name} using native API")
            
            # Get updated fields list
            fields_result = get_table_fields(table_name)
            if fields_result.get("success"):
                return {
                    "success": True,
                    "message": f"Field added successfully",
                    "fields": fields_result.get("fields", [])
                }
        
        return result
        table_doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Field '{field_name}' added successfully",
            "fields_count": len(existing_fields)
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding field: {str(e)}", "Seamless Add Field")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def seamless_update_field(table_name, field_name, field_data):
    """Seamless update field - alias for update_field"""
    return update_field(table_name, field_name, field_data)

@frappe.whitelist()
def seamless_save_fields(table_name, fields_data):
    """Seamless save fields - alias for save_table_fields"""
    return save_table_fields_seamless(table_name, fields_data)

@frappe.whitelist()
def get_table_schema(table_name):
    """Get complete table schema including status"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        fields = []
        if table_doc.fields_json:
            try:
                fields = json.loads(table_doc.fields_json)
            except json.JSONDecodeError:
                fields = []
        
        # Check DocType status
        doctype_exists = False
        if table_doc.doctype_name:
            doctype_exists = frappe.db.exists("DocType", table_doc.doctype_name)
        
        return {
            "success": True,
            "table_name": table_name,
            "table_label": table_doc.table_label,
            "table_status": table_doc.status,
            "doctype_name": table_doc.doctype_name,
            "doctype_exists": doctype_exists,
            "fields": fields,
            "fields_count": len(fields),
            "schema": {
                "table": {
                    "name": table_name,
                    "label": table_doc.table_label,
                    "status": table_doc.status,
                    "doctype_name": table_doc.doctype_name
                },
                "fields": fields,
                "metadata": {
                    "total_fields": len(fields),
                    "doctype_exists": doctype_exists,
                    "is_active": table_doc.status == "Active"
                }
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "schema": None
        }

@frappe.whitelist()
def get_field_types():
    """Get available field types for the visual builder"""
    return {
        "success": True,
        "field_types": [
            {"value": "Data", "label": "Text"},
            {"value": "Text", "label": "Text Area"}, 
            {"value": "Long Text", "label": "Long Text"},
            {"value": "Int", "label": "Number"},
            {"value": "Float", "label": "Decimal"},
            {"value": "Currency", "label": "Currency"},
            {"value": "Date", "label": "Date"},
            {"value": "Datetime", "label": "Date & Time"},
            {"value": "Time", "label": "Time"},
            {"value": "Select", "label": "Dropdown"},
            {"value": "Check", "label": "Checkbox"},
            {"value": "Link", "label": "Link"},
            {"value": "Text Editor", "label": "Rich Text"},
            {"value": "Code", "label": "Code"},
            {"value": "JSON", "label": "JSON"}
        ]
    }

@frappe.whitelist()
def sync_all_fields_to_doctype(table_name):
    """Sync all fields from JSON to DocType"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not table_doc.doctype_name or not frappe.db.exists("DocType", table_doc.doctype_name):
            return {"success": False, "error": "DocType not found"}
        
        fields = []
        if table_doc.fields_json:
            fields = json.loads(table_doc.fields_json)
        
        result = create_or_update_doctype(table_doc, fields)
        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def preserve_relationship_fields(table_doc, new_fields_data):
    """Preserve existing relationship Link fields when saving new fields"""
    try:
        # Get existing fields from JSON
        existing_fields = []
        if table_doc.fields_json:
            try:
                existing_fields = json.loads(table_doc.fields_json)
            except json.JSONDecodeError:
                existing_fields = []
        
        # Identify relationship fields (Link fields with specific patterns)
        relationship_fields = []
        for field in existing_fields:
            if (field.get("field_type") == "Link" and 
                ("relationship" in field.get("description", "").lower() or
                 "master" in field.get("field_label", "").lower() or
                 field.get("field_name", "").endswith("_link") or
                 field.get("options"))):  # Link fields usually have options for target DocType
                relationship_fields.append(field)
                print(f"Preserving relationship field: {field.get('field_name')} (Link to {field.get('options')})")
        
        # Get field names from new data
        new_field_names = [f.get("field_name") for f in new_fields_data if f.get("field_name")]
        
        # Add preserved relationship fields that aren't in new data
        preserved_fields = list(new_fields_data)  # Start with new fields
        for rel_field in relationship_fields:
            if rel_field.get("field_name") not in new_field_names:
                preserved_fields.append(rel_field)
                print(f"Added preserved relationship field: {rel_field.get('field_name')}")
        
        return preserved_fields
        
    except Exception as e:
        print(f"Error preserving relationship fields: {str(e)}")
        return new_fields_data  # Return original data if preservation fails

@frappe.whitelist()
def save_table_fields_seamless(table_name, fields_data):
    """Save fields and auto-activate table with seamless DocType creation - now native fields only"""
    try:
        if isinstance(fields_data, str):
            fields_data = json.loads(fields_data)
        
        print(f"Saving {len(fields_data)} fields for table {table_name}")
        
        # Get table document
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Use native field management instead of fields_json
        from flansa.native_fields import save_fields_to_doctype_native
        
        # Initial field count (will be updated after DocType creation with actual count)
        table_doc.fields_count = len(fields_data)
        
        # Generate DocType name if not exists
        if not table_doc.doctype_name:
            clean_name = (table_doc.table_label or table_doc.name).replace(" ", "").replace("-", "")
            base_name = f"FLS{clean_name}"
            doctype_name = base_name
            counter = 1
            
            while frappe.db.exists("DocType", doctype_name):
                doctype_name = f"{base_name}{counter}"
                counter += 1
            
            table_doc.doctype_name = doctype_name
        
        # Save table changes with retry logic for concurrency
        max_retries = 3
        for attempt in range(max_retries):
            try:
                if attempt > 0:  # Reload on retry
                    table_doc.reload()
                table_doc.save(ignore_permissions=True)
                break  # Success, exit retry loop
            except frappe.TimestampMismatchError as e:
                if attempt < max_retries - 1:
                    frappe.logger().info(f"Table document modified concurrently, retrying attempt {attempt + 1}")
                    continue
                else:
                    return {
                        "success": False, 
                        "error": f"Table document modified too many times, please try again: {str(e)}"
                    }
        
        # Auto-create or update DocType using native fields
        if not table_doc.doctype_name:
            # Create new DocType
            from flansa.native_fields import create_doctype_native  
            doctype_result = create_doctype_native(table_name, fields_data)
        else:
            # Update existing DocType
            doctype_result = save_fields_to_doctype_native(table_name, fields_data)
        
        # Auto-activate table if DocType creation successful
        if doctype_result["success"]:
            # Get actual field count from the created/updated DocType
            actual_fields_count = len(fields_data)  # Default to custom fields count
            try:
                if table_doc.doctype_name:
                    doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
                    actual_fields_count = len(doctype_doc.fields)
            except Exception as e:
                frappe.logger().warning(f"Could not get actual field count for {table_doc.doctype_name}: {str(e)}")
            
            # Update status and field count directly in DB to avoid timestamp conflicts
            frappe.db.set_value("Flansa Table", table_name, "status", "Active")
            frappe.db.set_value("Flansa Table", table_name, "fields_count", actual_fields_count)
            frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Fields saved and table activated! DocType '{table_doc.doctype_name}' is ready.",
                "doctype_name": table_doc.doctype_name,
                "doctype_url": f"/app/{table_doc.doctype_name.lower().replace(' ', '-')}",
                "fields_count": actual_fields_count,
                "auto_activated": True,
                "feedback": {
                    "title": "✅ Table Ready!",
                    "message": f"Created DocType with {actual_fields_count} fields",
                    "indicator": "green",
                    "show_link": True,
                    "link_text": "Open Data Table",
                    "link_url": f"/app/{table_doc.doctype_name.lower().replace(' ', '-')}"
                }
            }
        else:
            return {
                "success": False,
                "error": doctype_result["error"],
                "feedback": {
                    "title": "⚠️ Fields Saved",
                    "message": "Fields saved but DocType creation failed",
                    "indicator": "orange"
                }
            }
        
    except Exception as e:
        frappe.log_error(f"Error in seamless field save: {str(e)}", "Seamless Workflow")
        return {
            "success": False,
            "error": str(e),
            "feedback": {
                "title": "❌ Error",
                "message": f"Failed to save fields: {str(e)}",
                "indicator": "red"
            }
        }

def create_or_update_doctype(table_doc, fields_data):
    """Create or update DocType based on fields"""
    try:
        doctype_name = table_doc.doctype_name
        print(f"Creating/updating DocType: {doctype_name}")
        
        # Delete existing DocType if it exists
        if frappe.db.exists("DocType", doctype_name):
            print("Deleting existing DocType...")
            frappe.delete_doc("DocType", doctype_name, force=True, ignore_permissions=True)
            frappe.db.commit()
        
        # Create new DocType
        doctype = frappe.new_doc("DocType")
        doctype.name = doctype_name
        doctype.module = "Flansa Generated"
        doctype.custom = 1
        doctype.naming_rule = "Random"
        doctype.track_changes = 0
        doctype.allow_rename = 0
        doctype.quick_entry = 0
        doctype.is_submittable = 0
        doctype.allow_import = 0
        
        # Add fields from visual builder
        valid_fields = 0
        for field_data in fields_data:
            field_name = field_data.get("field_name", "")
            if not field_name:
                continue
            
            # Clean field name
            fieldname = frappe.scrub(field_name)
            
            # Skip if fieldname would be empty
            if not fieldname:
                continue
            
            field_dict = {
                "fieldname": fieldname,
                "label": field_data.get("field_label", field_name),
                "fieldtype": map_field_type_safe(field_data.get("field_type", "Data")),
                "reqd": 1 if field_data.get("is_required") else 0,
                "unique": 1 if field_data.get("is_unique") else 0,
                "in_list_view": 1 if valid_fields < 4 else 0,  # First 4 fields in list view
                "in_standard_filter": 1 if valid_fields < 3 else 0  # First 3 as filters
            }
            
            # Handle lookup field properties
            if field_data.get("fetch_from"):
                field_dict["fetch_from"] = field_data.get("fetch_from")
                field_dict["read_only"] = 1  # Lookup fields should be read-only
                
            if field_data.get("depends_on"):
                field_dict["depends_on"] = field_data.get("depends_on")
                
            # Handle read-only fields
            if field_data.get("is_readonly"):
                field_dict["read_only"] = 1
            
            # Add options for select fields and link fields
            if field_data.get("field_type") == "Select" and field_data.get("options"):
                field_dict["options"] = field_data.get("options")
            elif field_data.get("field_type") == "Link" and field_data.get("options"):
                field_dict["options"] = field_data.get("options")
            
            # Add default value
            if field_data.get("default_value"):
                field_dict["default"] = field_data.get("default_value")
            
            doctype.append("fields", field_dict)
            valid_fields += 1
            print(f"Added field: {fieldname} ({field_dict['fieldtype']})")
        
        # Add a default field if no valid fields
        if valid_fields == 0:
            doctype.append("fields", {
                "fieldname": "record_name",
                "label": "Record Name",
                "fieldtype": "Data",
                "reqd": 1,
                "in_list_view": 1,
                "in_standard_filter": 1
            })
            print("Added default record_name field")
        
        # Set permissions
        doctype.append("permissions", {
            "role": "System Manager",
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "print": 1,
            "email": 1,
            "export": 1,
            "import": 0,
            "share": 1,
            "report": 1
        })
        
        # Insert DocType
        doctype.insert(ignore_permissions=True)
        frappe.db.commit()
        
        print(f"✅ DocType {doctype_name} created with {valid_fields} fields")
        
        return {
            "success": True,
            "doctype_name": doctype_name,
            "fields_count": valid_fields
        }
        
    except Exception as e:
        print(f"Error creating DocType: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def map_field_type_safe(flansa_type):
    """Safely map field types with fallback to Data"""
    type_mapping = {
        "Text": "Data",
        "Data": "Data",
        "Number": "Int", 
        "Float": "Float",
        "Decimal": "Float",
        "Currency": "Currency",
        "Date": "Date",
        "DateTime": "Datetime",
        "Time": "Time",
        "Select": "Select",
        "Multi-Select": "Small Text",
        "Dropdown": "Select",
        "Link": "Data",  # Simplified to avoid link issues
        "Check": "Check",
        "Checkbox": "Check",
        "Text Area": "Text",
        "Textarea": "Text",
        "Long Text": "Long Text",
        "HTML": "Text Editor",
        "Rich Text": "Text Editor",
        "Image": "Data",
        "File": "Data",
        "Gallery": "Long Text",
        "JSON": "Long Text",
        "Code": "Code"
    }
    
    mapped_type = type_mapping.get(flansa_type, "Data")
    print(f"Mapping {flansa_type} -> {mapped_type}")
    return mapped_type

@frappe.whitelist()
def get_table_doctype_status(table_name):
    """Get real-time status of table and its DocType"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Check DocType status
        doctype_exists = False
        doctype_accessible = False
        doctype_fields_count = 0
        
        if table_doc.doctype_name:
            doctype_exists = frappe.db.exists("DocType", table_doc.doctype_name)
            if doctype_exists:
                try:
                    dt = frappe.get_doc("DocType", table_doc.doctype_name)
                    doctype_fields_count = len(dt.fields)
                    doctype_accessible = True
                except:
                    doctype_accessible = False
        
        # Legacy fields_json removed
        json_fields_count = 0
        
        status = {
            "table_name": table_name,
            "table_status": table_doc.status,
            "doctype_name": table_doc.doctype_name,
            "doctype_exists": doctype_exists,
            "doctype_accessible": doctype_accessible,
            "json_fields_count": json_fields_count,
            "doctype_fields_count": doctype_fields_count,
            "is_synced": json_fields_count == doctype_fields_count if doctype_exists else False,
            "access_url": f"/app/{table_doc.doctype_name.lower().replace(' ', '-')}" if doctype_exists else None
        }
        
        return {
            "success": True,
            "status": status
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def recreate_doctype(table_name):
    """Recreate DocType from scratch for a Flansa Table - called from client script"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not table_doc.fields_json:
            return {
                "success": False,
                "error": "No fields found in table. Please add fields first."
            }
        
        # Parse fields from JSON
        fields_data = json.loads(table_doc.fields_json)
        
        if not fields_data:
            return {
                "success": False,
                "error": "No valid fields found. Please add fields first."
            }
        
        # Force recreate DocType
        doctype_result = create_or_update_doctype(table_doc, fields_data)
        
        if doctype_result["success"]:
            # Update table status to Active
            frappe.db.set_value("Flansa Table", table_name, "status", "Active")
            frappe.db.commit()
            
            return {
                "success": True,
                "message": f"DocType '{table_doc.doctype_name}' recreated successfully with {doctype_result['fields_count']} fields!",
                "doctype_name": table_doc.doctype_name,
                "fields_count": doctype_result['fields_count'],
                "doctype_url": f"/app/{table_doc.doctype_name.lower().replace(' ', '-')}",
                "feedback": {
                    "title": "🔄 DocType Recreated!",
                    "message": f"Successfully recreated with {doctype_result['fields_count']} fields",
                    "indicator": "green",
                    "show_link": True,
                    "link_text": "Open Data Table",
                    "link_url": f"/app/{table_doc.doctype_name.lower().replace(' ', '-')}"
                }
            }
        else:
            return {
                "success": False,
                "error": f"Failed to recreate DocType: {doctype_result['error']}",
                "feedback": {
                    "title": "❌ Recreation Failed",
                    "message": f"DocType recreation failed: {doctype_result['error']}",
                    "indicator": "red"
                }
            }
        
    except Exception as e:
        frappe.log_error(f"Error recreating DocType for {table_name}: {str(e)}", "DocType Recreation")
        return {
            "success": False,
            "error": str(e),
            "feedback": {
                "title": "❌ Error",
                "message": f"Recreation failed: {str(e)}",
                "indicator": "red"
            }
        }

@frappe.whitelist()
def quick_create_sample_record(doctype_name, sample_data=None):
    """Create a sample record in the generated DocType"""
    try:
        if not frappe.db.exists("DocType", doctype_name):
            return {"success": False, "error": "DocType not found"}
        
        # Get DocType fields
        dt = frappe.get_doc("DocType", doctype_name)
        
        # Create new document
        doc = frappe.new_doc(doctype_name)
        
        # Fill with sample data or defaults
        for field in dt.fields:
            if field.fieldtype in ["Data", "Text"] and field.reqd:
                doc.set(field.fieldname, f"Sample {field.label}")
            elif field.fieldtype == "Int" and field.reqd:
                doc.set(field.fieldname, 1)
            elif field.fieldtype == "Select" and field.options and field.reqd:
                options = field.options.split("\n")
                if options:
                    doc.set(field.fieldname, options[0])
        
        # Insert the document
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Sample record created in {doctype_name}",
            "record_name": doc.name
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def sync_json_to_flansa_fields(table_name):
    """DEPRECATED: Flansa Field records removed - using native fields only"""
    # Function deprecated - return immediately
    return {"success": False, "error": "Flansa Field sync deprecated - using native DocType fields only"}

@frappe.whitelist()
def sync_out_of_sync_fields(table_name):
    """Sync fields that are out of sync between JSON and Flansa Field records"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not table_doc.fields_json:
            return {"success": False, "error": "No JSON fields to sync"}
        
        fields_data = json.loads(table_doc.fields_json)
        json_fields = {f.get("field_name"): f for f in fields_data if f.get("field_name")}
        
        # Get existing Flansa Field records
        flansa_fields = frappe.get_all("Flansa Field", 
            filters={"flansa_table": table_name},
            fields=["name", "field_name", "field_label", "field_type", "is_required"]
        )
        
        synced_count = 0
        details = []
        
        for flansa_field in flansa_fields:
            field_name = flansa_field.field_name
            if field_name in json_fields:
                json_field = json_fields[field_name]
                
                # Check if fields are out of sync
                needs_update = (
                    flansa_field.field_label != json_field.get("field_label") or
                    flansa_field.field_type != json_field.get("field_type") or
                    flansa_field.is_required != json_field.get("is_required", 0)
                )
                
                if needs_update:
                    # Update the Flansa Field record
                    field_doc = frappe.get_doc("Flansa Field", flansa_field.name)
                    field_doc.field_label = json_field.get("field_label", field_name)
                    field_doc.field_type = json_field.get("field_type", "Data")
                    field_doc.is_required = json_field.get("is_required", 0)
                    field_doc.is_unique = json_field.get("is_unique", 0)
                    field_doc.default_value = json_field.get("default_value", "")
                    field_doc.options = json_field.get("options", "")
                    field_doc.save(ignore_permissions=True)
                    synced_count += 1
                    details.append(f"Updated {field_name}")
        
        frappe.db.commit()
        return {
            "success": True,
            "synced": synced_count,
            "details": "<br>".join(details) if details else "All fields are in sync",
            "message": f"Synced {synced_count} out-of-sync fields"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def sync_fields_to_doctype(table_name, doctype_name):
    """Sync all fields to the DocType"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not table_doc.fields_json:
            return {"success": False, "error": "No fields to sync"}
        
        fields_data = json.loads(table_doc.fields_json)
        
        # Use existing create_or_update_doctype function
        result = create_or_update_doctype(table_doc, fields_data)
        
        if result["success"]:
            return {
                "success": True,
                "count": result["fields_count"],
                "details": f"Synced {result['fields_count']} fields to DocType {doctype_name}",
                "message": f"Successfully synced fields to DocType"
            }
        else:
            return {
                "success": False,
                "error": result["error"]
            }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def sync_doctype_to_json(table_name, doctype_name):
    """Sync DocType fields back to JSON"""
    try:
        if not frappe.db.exists("DocType", doctype_name):
            return {"success": False, "error": "DocType not found"}
        
        dt = frappe.get_doc("DocType", doctype_name)
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Convert DocType fields to JSON format
        json_fields = []
        for field in dt.fields:
            # Skip standard fields
            if field.fieldname in ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx"]:
                continue
            
            # Skip virtual fields except computed fields - they shouldn't be synced to JSON storage
            # But we need computed fields in JSON for visual builder display
            is_virtual = getattr(field, 'is_virtual', 0)
            is_computed = field.description and 'Auto-calculated:' in field.description
            
            if is_virtual and not is_computed:
                continue
            
            json_field = {
                "field_name": field.fieldname,
                "field_label": field.label,
                "field_type": reverse_map_field_type(field.fieldtype),
                "is_required": 1 if field.reqd else 0,
                "is_unique": 1 if field.unique else 0,
                "default_value": field.default or "",
                "options": field.options or ""
            }
            
            # Preserve lookup field properties
            if hasattr(field, 'fetch_from') and field.fetch_from:
                json_field["fetch_from"] = field.fetch_from
                json_field["is_lookup_field"] = True
                
            if hasattr(field, 'depends_on') and field.depends_on:
                json_field["depends_on"] = field.depends_on
                
            # Preserve read-only status (important for lookup fields)
            if hasattr(field, 'read_only') and field.read_only:
                json_field["is_readonly"] = 1
            json_fields.append(json_field)
        
        # Update the table's fields_json
        table_doc.fields_json = json.dumps(json_fields, indent=2)
        table_doc.save(ignore_permissions=True)
        
        frappe.db.commit()
        return {
            "success": True,
            "count": len(json_fields),
            "message": f"Synced {len(json_fields)} fields from DocType to JSON"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def _check_duplicate_link_field(doctype_name, field_name, target_doctype):
    """Check if a duplicate link field already exists - enhanced for relationship-specific fields"""
    try:
        # Clear cache to get latest fields
        frappe.clear_cache(doctype=doctype_name)
        
        # Check if exact field name exists
        if frappe.db.exists("Custom Field", {"dt": doctype_name, "fieldname": field_name}):
            return True
        
        # For relationship-specific fields, be more selective about what constitutes a duplicate
        if target_doctype:
            existing_link_fields = frappe.get_all("Custom Field",
                filters={
                    "dt": doctype_name,
                    "fieldtype": "Link",
                    "options": target_doctype
                },
                fields=["fieldname"]
            )
            
            if existing_link_fields:
                existing_names = [f.fieldname for f in existing_link_fields]
                frappe.logger().info(f"Found existing link fields to {target_doctype}: {existing_names}")
                
                # Only consider it a duplicate if:
                # 1. It's an exact match, OR
                # 2. It's a very basic field name (like "classes_link") and new field is also basic
                # 3. Allow relationship-specific names (with context) to coexist
                
                import difflib
                for existing_name in existing_names:
                    # Check for exact similarity (typos, etc.)
                    similarity = difflib.SequenceMatcher(None, field_name, existing_name).ratio()
                    
                    # If it's a very high similarity (95%+), likely a typo or duplicate
                    if similarity > 0.95:
                        frappe.logger().warning(f"Very high similarity duplicate detected: {field_name} vs {existing_name} (similarity: {similarity:.2f})")
                        return True
                    
                    # If both are basic field names (no context), and similar, it's a duplicate
                    is_new_basic = '_link' in field_name and field_name.count('_') <= 1
                    is_existing_basic = '_link' in existing_name and existing_name.count('_') <= 1
                    
                    if is_new_basic and is_existing_basic and similarity > 0.8:
                        frappe.logger().warning(f"Basic field duplicate detected: {field_name} vs {existing_name} (similarity: {similarity:.2f})")
                        return True
                
                # If new field has context (multiple underscores), allow it even if similar to existing basic field
                has_context = field_name.count('_') > 1 and '_link' in field_name
                if has_context:
                    frappe.logger().info(f"Allowing relationship-specific field: {field_name} (has context)")
                    return False
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error checking duplicate link field: {str(e)}", "Duplicate Check")
        return False

def reverse_map_field_type(frappe_type):
    """Reverse map Frappe field types to Flansa types"""
    reverse_mapping = {
        "Data": "Text",
        "Int": "Number", 
        "Float": "Float",
        "Currency": "Currency",
        "Date": "Date",
        "Datetime": "DateTime",
        "Time": "Time",
        "Select": "Select",
        "Small Text": "Multi-Select",
        "Check": "Check",
        "Text": "Text Area",
        "Long Text": "Long Text",
        "Text Editor": "Rich Text",
        "Code": "Code"
    }
    
    return reverse_mapping.get(frappe_type, "Text")

@frappe.whitelist()
def apply_naming_to_doctype(table_name):
    """Apply naming configuration from Flansa Table to its DocType"""
    try:
        # Get the Flansa Table record
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not table_doc.doctype_name:
            return {"success": False, "message": "No DocType associated with this table"}
        
        if not frappe.db.exists("DocType", table_doc.doctype_name):
            return {"success": False, "message": f"DocType {table_doc.doctype_name} not found"}
        
        # Get the DocType
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Apply naming configuration based on the Flansa Table settings
        naming_type = getattr(table_doc, 'naming_type', 'Autoincrement')
        
        if naming_type == "By \"Naming Series\" field":
            # Frappe naming series format: PREFIX-.#####
            prefix = getattr(table_doc, 'naming_prefix', 'REC')
            digits = getattr(table_doc, 'naming_digits', 5)
            new_autoname = f"{prefix}-.{'#' * digits}"
            
            # Check for naming series conflicts (Frappe enforces global uniqueness)
            conflict_check = frappe.db.sql("""
                SELECT COUNT(*) as count
                FROM `tabDocType` 
                WHERE autoname LIKE %s 
                AND name != %s
            """, (f"{prefix}-.%", table_doc.doctype_name), as_dict=True)
            
            if conflict_check[0]['count'] > 0:
                # Suggest alternative prefixes
                suggestions = []
                for i in range(1, 6):  # Try 5 alternatives
                    alt_prefix = f"{prefix}{i}"
                    alt_check = frappe.db.sql("""
                        SELECT COUNT(*) as count
                        FROM `tabDocType` 
                        WHERE autoname LIKE %s
                    """, (f"{alt_prefix}-.%",), as_dict=True)
                    
                    if alt_check[0]['count'] == 0:
                        suggestions.append(alt_prefix)
                        if len(suggestions) >= 3:  # Provide 3 suggestions
                            break
                
                suggestion_text = ', '.join([f"'{s}'" for s in suggestions[:3]]) if suggestions else "'REC1', 'TBL1'"
                
                return {
                    "success": False, 
                    "message": f"Series '{prefix}-' is already in use by another table. Please try: {suggestion_text}",
                    "suggestions": suggestions[:3] if suggestions else [f"{prefix}1", "REC1", "TBL1"]
                }
            
            doctype_doc.naming_rule = "By \"Naming Series\" field"
            
            # Set the starting counter for the naming series
            start_from = getattr(table_doc, 'naming_start_from', 1)
            if start_from and start_from > 1:
                # Update or create the naming series counter
                series_name = f"{prefix}-"
                
                # Check if series exists in database (using direct SQL to avoid 'modified' column error)
                existing_series_result = frappe.db.sql("SELECT current FROM `tabSeries` WHERE name = %s", series_name)
                existing_series = existing_series_result[0][0] if existing_series_result else None
                
                if existing_series is None:
                    # Create new series entry
                    frappe.db.sql("""
                        INSERT INTO `tabSeries` (name, current) 
                        VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE current = %s
                    """, (series_name, start_from - 1, start_from - 1))
                elif existing_series < (start_from - 1):
                    # Only update if the new start is higher than current
                    frappe.db.sql("""
                        UPDATE `tabSeries` 
                        SET current = %s 
                        WHERE name = %s
                    """, (start_from - 1, series_name))
                
                frappe.db.commit()
            
        elif naming_type == "Autoincrement":
            # Pure auto increment: .#####
            digits = getattr(table_doc, 'naming_digits', 5)
            new_autoname = f".{'#' * digits}"
            doctype_doc.naming_rule = "Autoincrement"
            
        elif naming_type == "By fieldname":
            # Field-based naming
            field_name = getattr(table_doc, 'naming_field', '')
            if field_name:
                new_autoname = f"field:{field_name}"
                doctype_doc.naming_rule = "By fieldname"
            else:
                return {"success": False, "message": "Field-based naming selected but no field specified"}
                
        elif naming_type == "Set by user":
            # User prompt
            new_autoname = "Prompt"
            doctype_doc.naming_rule = "Set by user"
            
        elif naming_type == "Random":
            # Random naming (Frappe default)
            new_autoname = None
            doctype_doc.naming_rule = "Random"
        else:
            return {"success": False, "message": f"Unknown naming type: {naming_type}"}
        
        # Update the DocType
        if new_autoname is not None:
            doctype_doc.autoname = new_autoname
        else:
            # Remove autoname for random naming
            doctype_doc.autoname = None
            
        doctype_doc.save()
        frappe.db.commit()
        
        # Prepare success message with details
        success_message = f"Applied naming configuration: {naming_type}"
        if naming_type == "By \"Naming Series\" field":
            start_from = getattr(table_doc, 'naming_start_from', 1)
            if start_from and start_from > 1:
                success_message += f" (starting from {start_from})"
        
        return {
            "success": True, 
            "message": success_message,
            "autoname": new_autoname,
            "naming_rule": doctype_doc.naming_rule
        }
        
    except Exception as e:
        frappe.log_error(f"Error applying naming to DocType: {str(e)}", "Apply Naming Error")
        return {"success": False, "message": f"Error applying naming: {str(e)}"}
