"""
Native Field Management System
Eliminates Flansa Field doctype - uses DocType fields directly
Works both via Flansa UI and standalone for platform admins
"""

import frappe
import json
import hashlib
import re
from datetime import datetime, timedelta
from frappe.utils import now, cstr, flt, cint

# ==============================================================================
# CORE NATIVE FIELD MANAGEMENT APIS
# ==============================================================================

@frappe.whitelist()
def get_table_fields_native(table_name):
    """
    Get all fields from DocType directly (replaces complex JSON parsing)
    Works for both UI and CLI usage
    """
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated for table", "fields": []}
        
        # Check if DocType exists before trying to access it
        if not frappe.db.exists("DocType", table_doc.doctype_name):
            # Clear the invalid doctype_name reference
            frappe.db.set_value("Flansa Table", table_name, "doctype_name", "")
            frappe.db.commit()
            frappe.log_error(f"Cleared invalid DocType reference {table_doc.doctype_name} for table {table_name}", "Native Fields")
            return {"success": False, "error": "DocType reference was invalid and has been cleared. Please recreate the DocType.", "fields": []}
        
        # Get fields from DocType meta (single source of truth)
        meta = frappe.get_meta(table_doc.doctype_name)
        fields = []
        
        # Use centralized system fields manager to avoid duplication
        from flansa.flansa_core.api.system_fields_manager import FRAPPE_SYSTEM_FIELDS
        
        # Get applicable system fields for this DocType
        applicable_system_fields = ['name', 'owner', 'creation', 'modified', 'modified_by']
        
        # Add docstatus and amended_from for submittable documents
        if meta.is_submittable:
            applicable_system_fields.extend(['docstatus', 'amended_from'])
        
        # Add system fields to the fields list using centralized definitions
        for fieldname in applicable_system_fields:
            if fieldname in FRAPPE_SYSTEM_FIELDS:
                config = FRAPPE_SYSTEM_FIELDS[fieldname]
                
                # Handle special case for amended_from link target
                options = config.get('options', '')
                if fieldname == 'amended_from':
                    options = table_doc.doctype_name  # Link to same DocType
                
                field_data = {
                    "fieldname": config["fieldname"],
                    "label": config["label"],
                    "fieldtype": config["fieldtype"],
                    "options": options,
                    "reqd": config.get('reqd', 0),
                    "read_only": config.get('read_only', 1),  # System fields are read-only by default
                    "hidden": config.get('hidden', 0),
                    "is_virtual": 0,
                    "fetch_from": "",
                    "depends_on": config.get('depends_on', ''),
                    "description": config.get('description', f"System field: {config['label']}")
                }
            
            # Mark as system field
            field_data["created_by_flansa"] = False
            field_data["flansa_field_type"] = "system"
            field_data["is_system_field"] = True
            
            fields.append(field_data)
        
        # Then add user-defined fields from DocType
        for field in meta.get("fields"):
            field_data = {
                "fieldname": field.fieldname,
                "label": field.label,
                "fieldtype": field.fieldtype,
                "options": getattr(field, "options", ""),
                "reqd": getattr(field, "reqd", 0),
                "read_only": getattr(field, "read_only", 0),
                "hidden": getattr(field, "hidden", 0),
                "is_virtual": getattr(field, "is_virtual", 0),
                "fetch_from": getattr(field, "fetch_from", ""),
                "depends_on": getattr(field, "depends_on", ""),
                "description": getattr(field, "description", "")
            }
            
            # Check if field was created by Flansa (from description metadata)
            field_data["created_by_flansa"] = is_flansa_created_field(field)
            field_data["flansa_field_type"] = get_flansa_field_type(field)
            field_data["is_system_field"] = False
            
            fields.append(field_data)
        
        return {
            "success": True,
            "fields": fields,
            "total_count": len(fields),
            "doctype_name": table_doc.doctype_name,
            "source": "native_doctype"
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting native fields: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist() 
def add_basic_field_native(table_name, field_config):
    """
    Add basic field directly to DocType (replaces complex field sync)
    Works for both UI and CLI usage
    """
    try:
        if isinstance(field_config, str):
            field_config = json.loads(field_config)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        # Get DocType document
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Check if this is a calculated field (has formula)
        has_formula = field_config.get("formula") or field_config.get("expression")
        is_calculated = bool(has_formula)
        
        # Create field definition
        field_def = {
            "fieldname": field_config["field_name"],
            "label": field_config["field_label"],
            "fieldtype": field_config["field_type"],
            "reqd": field_config.get("required", 0),
            "hidden": field_config.get("hidden", 0),
            "read_only": field_config.get("read_only", 1 if is_calculated else 0),  # Calculated fields should be readonly
            "options": field_config.get("options", ""),
            "description": create_flansa_field_description("basic" if not is_calculated else "calculated", field_config)
        }
        
        # If it's a calculated field, create Logic Field record for management
        logic_field_name = None
        if is_calculated:
            formula = field_config.get("formula") or field_config.get("expression")
            
            # Create Logic Field document for editing capability
            logic_field = frappe.new_doc("Flansa Logic Field")
            logic_field.table_name = table_name
            logic_field.field_name = field_config["field_name"]
            logic_field.label = field_config["field_label"]
            logic_field.expression = formula
            logic_field.result_type = field_config["field_type"]
            logic_field.is_active = 1
            logic_field.insert()
            logic_field_name = logic_field.name
        
        # Add field directly to DocType (correct approach)
        doctype_doc.append("fields", field_def)
        doctype_doc.save()
        
        # If calculated field, populate existing records
        if is_calculated:
            try:
                from flansa.flansa_core.api.table_api import populate_existing_records_for_cached_field
                populate_existing_records_for_cached_field(table_doc.doctype_name, logic_field)
            except Exception as e:
                frappe.log_error(f"Error populating calculated field values: {str(e)}", "Native Fields")
        
        # Clear cache
        frappe.clear_cache(doctype=table_doc.doctype_name)
        frappe.db.commit()
        
        result = {
            "success": True,
            "message": f"{'Calculated' if is_calculated else 'Basic'} field '{field_config['field_label']}' added successfully",
            "method": "native_doctype_direct",
            "field_name": field_config["field_name"],
            "is_calculated": is_calculated
        }
        
        if is_calculated:
            result.update({
                "logic_field_name": logic_field_name,
                "formula": formula,
                "editable": True  # Can be edited via Logic Field DocType
            })
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error adding basic field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def edit_field_formula(table_name, field_name, new_formula):
    """
    Edit formula for an existing calculated field
    Provides editing capability for Logic Fields
    """
    try:
        # Find the Logic Field record
        logic_field_filters = {
            "table_name": table_name,
            "field_name": field_name
        }
        
        if not frappe.db.exists("Flansa Logic Field", logic_field_filters):
            return {"success": False, "error": f"Logic Field not found for {field_name}"}
        
        # Update Logic Field record
        logic_field_name = frappe.db.get_value("Flansa Logic Field", logic_field_filters, "name")
        logic_field = frappe.get_doc("Flansa Logic Field", logic_field_name)
        logic_field.expression = new_formula
        logic_field.save()
        
        # Get table info
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        # Recalculate values for existing records
        try:
            from flansa.flansa_core.api.table_api import populate_existing_records_for_cached_field
            populate_existing_records_for_cached_field(table_doc.doctype_name, logic_field)
        except Exception as e:
            frappe.log_error(f"Error recalculating field values: {str(e)}", "Native Fields")
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Formula updated for field '{field_name}'",
            "new_formula": new_formula,
            "logic_field_name": logic_field_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error editing field formula: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def add_gallery_field_native(table_name, gallery_config):
    """
    Add gallery field using JSON field with custom control for multiple images
    Works for both UI and CLI usage
    """
    try:
        if isinstance(gallery_config, str):
            gallery_config = json.loads(gallery_config)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        # Get DocType document
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Create gallery field using JSON field with custom description
        gallery_metadata = {
            "gallery_type": gallery_config.get("gallery_type", "Image Gallery"),
            "max_files": gallery_config.get("max_files", 10),
            "allowed_extensions": gallery_config.get("allowed_extensions", "jpg,jpeg,png,gif,webp"),
            "enable_drag_drop": gallery_config.get("enable_drag_drop", 1),
            "show_thumbnails": gallery_config.get("show_thumbnails", 1),
            "is_gallery": True,
            "field_renderer": "gallery"
        }
        
        field_def = {
            "fieldname": gallery_config["field_name"],
            "label": gallery_config["field_label"],
            "fieldtype": "Long Text",  # Using Long Text instead of JSON to avoid constraints
            "reqd": gallery_config.get("required", 0),
            "hidden": gallery_config.get("hidden", 0),
            "read_only": gallery_config.get("read_only", 0),
            "description": create_flansa_field_description("gallery", {
                **gallery_config,
                "gallery_metadata": gallery_metadata
            })
        }
        
        # Add field to DocType
        doctype_doc.append("fields", field_def)
        doctype_doc.save()
        
        return {
            "success": True,
            "message": f"Gallery field '{gallery_config['field_label']}' added successfully",
            "method": "native_gallery_field",
            "field_name": gallery_config["field_name"],
            "metadata": gallery_metadata
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding gallery field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def add_lookup_field_native(table_name, lookup_config):
    """
    Add lookup field using native Frappe fetch_from (zero custom code needed)
    Works for both UI and CLI usage
    """
    try:
        if isinstance(lookup_config, str):
            lookup_config = json.loads(lookup_config)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Create lookup field using native Frappe approach
        # source_field = link field in child table (e.g. "parent_table_link")  
        # lookup_field = field being fetched from parent (e.g. "name", "title")
        field_def = {
            "fieldname": lookup_config["field_name"],
            "label": lookup_config["field_label"],
            "fieldtype": lookup_config.get("field_type", "Data"),
            "fetch_from": f"{lookup_config['source_field']}.{lookup_config['lookup_field']}",
            "read_only": 1,
            "is_virtual": 1,  # Make it virtual to prevent storage and corruption
            "depends_on": lookup_config['source_field'],  # Simplified depends_on
            "description": create_flansa_field_description("lookup", lookup_config)
        }
        
        # Add field to DocType
        doctype_doc.append("fields", field_def)
        doctype_doc.save()
        
        return {
            "success": True,
            "message": f"Lookup field '{lookup_config['field_label']}' created using native fetch_from",
            "method": "native_frappe_fetch_from",
            "fetch_expression": f"{lookup_config['source_field']}.{lookup_config['lookup_field']}"
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding lookup field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def add_formula_field_native(table_name, formula_config):
    """
    Add formula field as virtual field with runtime calculation
    Works for both UI and CLI usage
    """
    try:
        if isinstance(formula_config, str):
            formula_config = json.loads(formula_config)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Extract dependencies from formula
        dependencies = extract_formula_dependencies(formula_config["formula"])
        
        # Create virtual formula field
        field_def = {
            "fieldname": formula_config["field_name"],
            "label": formula_config["field_label"],
            "fieldtype": formula_config.get("result_type", "Float"),
            "read_only": 1,
            "description": create_flansa_field_description("formula", {
                **formula_config,
                "dependencies": dependencies
            })
        }
        
        # Add field to DocType  
        doctype_doc.append("fields", field_def)
        doctype_doc.save()
        
        # Create server script for formula calculation
        script_result = create_formula_server_script(table_doc.doctype_name, formula_config, dependencies)
        
        return {
            "success": True,
            "message": f"Formula field '{formula_config['field_label']}' created with runtime calculation",
            "method": "virtual_field_plus_server_script",
            "formula": formula_config["formula"],
            "dependencies": dependencies,
            "script_created": script_result["success"]
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding formula field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def add_summary_field_native(table_name, summary_config):
    """
    Add summary field with server script calculation
    Works for both UI and CLI usage
    """
    try:
        if isinstance(summary_config, str):
            summary_config = json.loads(summary_config)
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Determine field type based on summary type
        field_type = "Float" if summary_config["summary_type"] in ["Sum", "Average"] else "Int"
        
        # Create summary field
        field_def = {
            "fieldname": summary_config["field_name"],
            "label": summary_config["field_label"],
            "fieldtype": field_type,
            "read_only": 1,
            "default": 0,
            "description": create_flansa_field_description("summary", summary_config)
        }
        
        # Add field to DocType
        doctype_doc.append("fields", field_def)
        doctype_doc.save()
        
        # Create server script for summary calculation
        script_result = create_summary_server_script(table_doc.doctype_name, summary_config)
        
        return {
            "success": True,
            "message": f"Summary field '{summary_config['field_label']}' created with automatic calculation",
            "method": "stored_field_plus_server_script", 
            "summary_type": summary_config["summary_type"],
            "script_created": script_result["success"]
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding summary field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def update_field_native(table_name, field_name, field_updates):
    """
    Update field properties using Custom Fields (seamless for basic and logic fields)
    Works for both UI and CLI usage
    """
    try:
        if isinstance(field_updates, str):
            field_updates = json.loads(field_updates)
            
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_name = table_doc.doctype_name
        
        # Check if it's a Custom Field (new approach)
        custom_field = frappe.db.exists("Custom Field", {
            "dt": doctype_name,
            "fieldname": field_name
        })
        
        if custom_field:
            # Update Custom Field
            custom_field_doc = frappe.get_doc("Custom Field", custom_field)
            
            # Update allowed properties
            if "field_label" in field_updates:
                custom_field_doc.label = field_updates["field_label"]
            if "field_type" in field_updates:
                custom_field_doc.fieldtype = field_updates["field_type"]
            if "options" in field_updates:
                custom_field_doc.options = field_updates["options"]
            if "is_required" in field_updates:
                custom_field_doc.reqd = field_updates["is_required"]
            if "is_readonly" in field_updates:
                custom_field_doc.read_only = field_updates["is_readonly"]
            
            custom_field_doc.save()
            
            # If it's a Logic Field, also update the Logic Field record
            logic_field = frappe.db.exists("Flansa Logic Field", {
                "table_name": table_name,
                "field_name": field_name
            })
            
            if logic_field:
                logic_field_doc = frappe.get_doc("Flansa Logic Field", logic_field)
                if "field_label" in field_updates:
                    logic_field_doc.label = field_updates["field_label"]
                if "field_type" in field_updates:
                    logic_field_doc.result_type = field_updates["field_type"]
                if "formula" in field_updates or "expression" in field_updates:
                    logic_field_doc.expression = field_updates.get("formula") or field_updates.get("expression")
                logic_field_doc.save()
            
            # Clear cache
            frappe.clear_cache(doctype=doctype_name)
            frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Field '{field_name}' updated successfully",
                "field_type": "custom_field"
            }
        else:
            # Fallback: Check DocType fields (legacy support)
            doctype_doc = frappe.get_doc("DocType", doctype_name)
            
            field_found = False
            for field in doctype_doc.fields:
                if field.fieldname == field_name and is_flansa_created_field(field):
                    # Update allowed properties
                    if "field_label" in field_updates:
                        field.label = field_updates["field_label"]
                    if "field_type" in field_updates:
                        field.fieldtype = field_updates["field_type"]
                    if "options" in field_updates:
                        field.options = field_updates["options"]
                    if "is_required" in field_updates:
                        field.reqd = field_updates["is_required"]
                    if "is_readonly" in field_updates:
                        field.read_only = field_updates["is_readonly"]
                if "default_value" in field_updates:
                    field.default = field_updates["default_value"]
                    
                field_found = True
                break
        
        if not field_found:
            return {"success": False, "error": f"Field '{field_name}' not found or not editable"}
        
        doctype_doc.save()
        
        return {
            "success": True,
            "message": f"Field '{field_name}' updated successfully",
            "method": "native_doctype_direct"
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def delete_field_native(table_name, field_name):
    """
    Delete field directly from DocType (replaces complex cleanup)
    Works for both UI and CLI usage
    """
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Find and remove field
        field_found = False
        field_metadata = None
        for i, field in enumerate(doctype_doc.fields):
            if field.fieldname == field_name:
                # Check if it's a deletable field
                # Allow deletion of Flansa-created fields OR Link fields (which might be from relationships)
                if is_flansa_created_field(field) or field.fieldtype == "Link":
                    # Additional check: don't delete essential system link fields
                    if field.fieldname in ['owner', 'modified_by', 'parent', 'parentfield', 'parenttype']:
                        return {"success": False, "error": f"Cannot delete essential system field '{field_name}'"}
                    
                    # If it's a Link field, check if any relationships depend on it
                    if field.fieldtype == "Link":
                        # Check if this field is used in any relationships
                        relationships = frappe.get_all("Flansa Relationship", 
                            filters=[
                                ["child_reference_field", "=", field_name],
                                ["to_table", "=", table_name]
                            ],
                            fields=["name", "relationship_name"]
                        )
                        
                        if relationships:
                            rel_names = ", ".join([r.relationship_name for r in relationships])
                            return {
                                "success": False, 
                                "error": f"Cannot delete Link field '{field_name}' - it's used in relationships: {rel_names}. Delete the relationships first."
                            }
                    
                    # Store field metadata before deletion (for computed field cleanup)
                    field_metadata = {
                        "description": getattr(field, "description", ""),
                        "fieldtype": field.fieldtype,
                        "is_virtual": getattr(field, "is_virtual", 0)
                    }
                    
                    doctype_doc.fields.pop(i)
                    field_found = True
                    break
                else:
                    return {"success": False, "error": "Cannot delete system field"}
        
        if not field_found:
            return {"success": False, "error": f"Field '{field_name}' not found"}
        
        doctype_doc.save()
        
        # Clean up associated server scripts
        cleanup_field_server_scripts(table_doc.doctype_name, field_name)
        
        # Additional cleanup for computed fields: remove from relationship child tables
        cleanup_computed_field_from_relationships(table_name, field_name, field_metadata)
        
        return {
            "success": True,
            "message": f"Field '{field_name}' deleted successfully",
            "method": "native_doctype_direct"
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting field: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def create_flansa_field_description(field_type, config):
    """Create description with Flansa metadata for field tracking"""
    flansa_config = {
        "field_type": field_type,
        "config": config,
        "created_at": now(),
        "created_by": frappe.session.user,
        "version": "2.0_native"
    }
    
    # Add relationship tracking for lookup and computed fields
    if field_type in ["lookup", "computed"] and config.get("relationship"):
        flansa_config["relationship"] = config["relationship"]
    
    metadata = {
        "flansa_config": flansa_config
    }
    return json.dumps(metadata)

def is_flansa_created_field(field):
    """Check if field was created by Flansa"""
    # Get description - might be from DocField or Custom Field
    description = getattr(field, 'description', '') or ''
    
    if not description:
        return False
    
    try:
        # Try to parse as JSON (for new computed fields)
        desc_data = json.loads(description)
        if desc_data.get("flansa_config"):
            return True
    except (json.JSONDecodeError, TypeError):
        pass
    
    # Also check for old-style computed fields
    if "Auto-calculated:" in description:
        return True
        
    return False

def get_flansa_field_type(field):
    """Get Flansa field type from description metadata"""
    if not is_flansa_created_field(field):
        return "system"
    
    description = getattr(field, 'description', '') or ''
    
    try:
        # Try to parse as JSON (for new fields with metadata)
        desc_data = json.loads(description)
        return desc_data["flansa_config"].get("field_type", "basic")
    except (json.JSONDecodeError, TypeError):
        # Check for computed fields by description pattern
        if "Auto-calculated:" in description:
            return "computed"
        return "basic"

@frappe.whitelist()
def create_doctype_native(table_name, fields_data):
    """Create new DocType with fields directly - replaces fields_json approach"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
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
            table_doc.save()
        
        # Create DocType document
        doctype_doc = frappe.get_doc({
            "doctype": "DocType",
            "name": table_doc.doctype_name,
            "module": "Flansa Core",
            "custom": 1,
            "is_submittable": 0,
            "track_changes": 1,
            "fields": []
        })
        
        # Set naming rule based on Flansa Table configuration
        naming_type = getattr(table_doc, 'naming_type', 'Naming Series')
        
        if naming_type == 'Naming Series':
            # Use configured prefix and digits
            prefix = getattr(table_doc, 'naming_prefix', 'REC')
            digits = getattr(table_doc, 'naming_digits', 5)
            doctype_doc.naming_rule = "By \"Naming Series\" field"
            doctype_doc.autoname = f"{prefix}-.{'#' * digits}"
        elif naming_type == 'Auto Increment':
            # Just numbers without prefix
            digits = getattr(table_doc, 'naming_digits', 5)
            doctype_doc.naming_rule = "Autoincrement"
            doctype_doc.autoname = f".{'#' * digits}"
        elif naming_type == 'Field Based':
            # Use a field value for naming
            field_name = getattr(table_doc, 'naming_field', '')
            if field_name:
                doctype_doc.naming_rule = "By fieldname"
                doctype_doc.autoname = f"field:{frappe.scrub(field_name)}"
            else:
                # Fallback to random if no field specified
                doctype_doc.naming_rule = "Random"
        elif naming_type == 'Prompt':
            # User will be prompted to enter the ID
            doctype_doc.naming_rule = "Set by user"
            doctype_doc.autoname = "Prompt"
        else:  # Random or default
            doctype_doc.naming_rule = "Random"
        
        # Add standard fields
        doctype_doc.append("fields", {
            "fieldname": "name", "label": "ID", "fieldtype": "Data", 
            "reqd": 1, "read_only": 1, "in_list_view": 1
        })
        
        # Add provided fields
        for field_data in fields_data:
            field_def = {
                "fieldname": field_data.get("field_name"),
                "label": field_data.get("field_label"),
                "fieldtype": field_data.get("field_type", "Data"),
                "reqd": field_data.get("is_required", 0),
                "hidden": field_data.get("is_hidden", 0),
                "read_only": field_data.get("is_readonly", 0),
                "options": field_data.get("options", ""),
                "description": create_flansa_field_metadata(field_data)
            }
            
            doctype_doc.append("fields", field_def)
        
        # Save DocType
        doctype_doc.insert()
        
        # Clear cache
        frappe.clear_cache(doctype=table_doc.doctype_name)
        
        return {
            "success": True,
            "doctype_name": table_doc.doctype_name,
            "fields_count": len(fields_data)
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating DocType: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def save_fields_to_doctype_native(table_name, fields_data):
    """Save multiple fields directly to DocType - replaces fields_json approach"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        # Get DocType document
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Clear existing non-standard fields (preserve standard fields)
        standard_fields = ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx']
        doctype_doc.fields = [f for f in doctype_doc.fields if f.fieldname in standard_fields]
        
        # Add all provided fields
        for field_data in fields_data:
            field_def = {
                "fieldname": field_data.get("field_name"),
                "label": field_data.get("field_label"),
                "fieldtype": field_data.get("field_type", "Data"),
                "reqd": field_data.get("is_required", 0),
                "hidden": field_data.get("is_hidden", 0),
                "read_only": field_data.get("is_readonly", 0),
                "options": field_data.get("options", ""),
                "description": create_flansa_field_metadata(field_data)
            }
            
            doctype_doc.append("fields", field_def)
        
        # Save DocType
        doctype_doc.save()
        
        # Clear cache
        frappe.clear_cache(doctype=table_doc.doctype_name)
        
        return {
            "success": True,
            "doctype_name": table_doc.doctype_name,
            "fields_count": len(fields_data)
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving fields to DocType: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

def extract_formula_dependencies(formula):
    """Extract field dependencies from formula expression"""
    # Simple dependency extraction - can be enhanced
    dependencies = []
    
    # Find field references (basic pattern matching)
    field_pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b'
    potential_fields = re.findall(field_pattern, formula)
    
    # Filter out function names and keywords
    function_keywords = ['SUM', 'AVG', 'MAX', 'MIN', 'IF', 'AND', 'OR', 'NOT', 'ROUND', 'ABS']
    
    for field in potential_fields:
        if field.upper() not in function_keywords and field not in dependencies:
            dependencies.append(field)
    
    return dependencies

def create_formula_server_script(doctype_name, config, dependencies):
    """Create server script for formula field calculation"""
    try:
        script_name = f"Formula_{doctype_name}_{config['field_name']}"
        
        # Generate safe formula calculation code
        safe_formula = convert_formula_to_safe_python(config["formula"], dependencies)
        
        script_code = f'''# Auto-generated formula field calculation
import math
from datetime import datetime, timedelta

def calculate_formula(doc, method):
    """Calculate formula: {config["formula"]}"""
    try:
        # Get field values safely
        {generate_field_getters(dependencies)}
        
        # Calculate formula
        result = {safe_formula}
        
        # Set result on document
        doc.{config["field_name"]} = result if result is not None else 0
        
    except Exception as e:
        frappe.log_error(f"Formula calculation error in {config['field_name']}: {{str(e)}}", "Formula Field")
        doc.{config["field_name"]} = 0  # Safe fallback
'''
        
        # Create or update server script
        if frappe.db.exists("Server Script", script_name):
            server_script = frappe.get_doc("Server Script", script_name)
            server_script.script = script_code
        else:
            server_script = frappe.get_doc({
                "doctype": "Server Script",
                "name": script_name,
                "script_type": "DocType Event",
                "reference_doctype": doctype_name,
                "event_frequency": "Before Save",
                "script": script_code,
                "enabled": 1
            })
        
        server_script.save()
        return {"success": True, "script_name": script_name}
        
    except Exception as e:
        frappe.log_error(f"Error creating formula server script: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

def create_summary_server_script(doctype_name, config):
    """Create server script for summary field calculation"""
    try:
        script_name = f"Summary_{doctype_name}_{config['field_name']}"
        
        # Generate calculation code based on summary type
        calc_code = generate_summary_calculation_code(config)
        
        script_code = f'''# Auto-generated summary field calculation
def calculate_summary(doc, method):
    """Calculate {config["summary_type"]} of {config["summary_field"]} from {config["target_doctype"]}"""
    try:
        if doc.{config.get("source_field", "name")}:
            # Get related records
            related_records = frappe.get_all(
                "{config["target_doctype"]}",
                filters={{"{config["filter_field"]}": doc.{config.get("source_field", "name")}}},
                fields=["{config["summary_field"]}"]
            )
            
            # Calculate {config["summary_type"].lower()}
            {calc_code}
            
        else:
            doc.{config["field_name"]} = 0
            
    except Exception as e:
        frappe.log_error(f"Summary calculation error in {config['field_name']}: {{str(e)}}", "Summary Field") 
        doc.{config["field_name"]} = 0  # Safe fallback
'''
        
        # Create or update server script
        if frappe.db.exists("Server Script", script_name):
            server_script = frappe.get_doc("Server Script", script_name)
            server_script.script = script_code
        else:
            server_script = frappe.get_doc({
                "doctype": "Server Script",
                "name": script_name,
                "script_type": "DocType Event",
                "reference_doctype": doctype_name,
                "event_frequency": "Before Save", 
                "script": script_code,
                "enabled": 1
            })
        
        server_script.save()
        return {"success": True, "script_name": script_name}
        
    except Exception as e:
        frappe.log_error(f"Error creating summary server script: {str(e)}", "Native Fields")
        return {"success": False, "error": str(e)}

def generate_summary_calculation_code(config):
    """Generate summary calculation code based on type"""
    summary_type = config["summary_type"]
    field_name = config["field_name"]
    summary_field = config["summary_field"]
    
    if summary_type == "Sum":
        return f"doc.{field_name} = sum([float(r.{summary_field} or 0) for r in related_records])"
    elif summary_type == "Average":
        return f"doc.{field_name} = sum([float(r.{summary_field} or 0) for r in related_records]) / len(related_records) if related_records else 0"
    elif summary_type == "Count":
        return f"doc.{field_name} = len(related_records)"
    elif summary_type == "Max":
        return f"doc.{field_name} = max([float(r.{summary_field} or 0) for r in related_records]) if related_records else 0"
    elif summary_type == "Min":
        return f"doc.{field_name} = min([float(r.{summary_field} or 0) for r in related_records]) if related_records else 0"
    else:
        return f"doc.{field_name} = 0"

def convert_formula_to_safe_python(formula, dependencies):
    """Convert Flansa formula to safe Python expression"""
    python_expr = formula
    
    # Basic function replacements
    replacements = {
        r'IF\(([^,]+),\s*([^,]+),\s*([^)]+)\)': r'(\2 if \1 else \3)',
        r'SUM\(([^)]+)\)': r'sum([\1])',
        r'AVG\(([^)]+)\)': r'(sum([\1]) / len([\1]) if \1 else 0)',
        r'MAX\(([^)]+)\)': r'max([\1])',
        r'MIN\(([^)]+)\)': r'min([\1])',
        r'ROUND\(([^,]+),\s*(\d+)\)': r'round(\1, \2)',
        r'ABS\(([^)]+)\)': r'abs(\1)',
        r' AND ': ' and ',
        r' OR ': ' or ',
        r' NOT ': ' not ',
    }
    
    for pattern, replacement in replacements.items():
        python_expr = re.sub(pattern, replacement, python_expr, flags=re.IGNORECASE)
    
    return python_expr

def generate_field_getters(dependencies):
    """Generate safe field getter code for dependencies"""
    getters = []
    for field in dependencies:
        getters.append(f"        {field} = doc.get('{field}', 0)")
    return "\n".join(getters)

def cleanup_field_server_scripts(doctype_name, field_name):
    """Clean up server scripts associated with a field"""
    try:
        # Look for formula and summary scripts
        script_names = [
            f"Formula_{doctype_name}_{field_name}",
            f"Summary_{doctype_name}_{field_name}"
        ]
        
        for script_name in script_names:
            if frappe.db.exists("Server Script", script_name):
                frappe.delete_doc("Server Script", script_name)
                
    except Exception as e:
        frappe.log_error(f"Error cleaning up server scripts: {str(e)}", "Native Fields")

def cleanup_computed_field_from_relationships(table_name, field_name, field_metadata):
    """
    Simplified cleanup: Since we eliminated relationship child tables, 
    this function now just logs the computed field removal.
    The field has already been removed from the DocType above.
    """
    try:
        # Check if this was a computed field (has Flansa metadata)
        if not field_metadata or not field_metadata.get("description"):
            return
        
        description = field_metadata["description"]
        
        # Check if it's a computed field and log the removal
        try:
            metadata = json.loads(description)
            if "flansa_config" in metadata and metadata["flansa_config"].get("field_type") == "computed":
                relationship_name = metadata["flansa_config"].get("relationship")
                frappe.logger().info(f"Cleaned up computed field {field_name} from relationship {relationship_name} (simplified approach)")
        except (json.JSONDecodeError, TypeError):
            # Also check for old-style computed fields
            if "Auto-calculated:" in description:
                frappe.logger().info(f"Cleaned up old-style computed field {field_name} from table {table_name}")
                            
    except Exception as e:
        frappe.log_error(f"Error in computed field cleanup logging: {str(e)}", "Native Fields")

# ==============================================================================
# SYNC HELPER FUNCTIONS
# ==============================================================================

def sync_json_to_native_fields(table_name, fields_data):
    """
    Sync JSON field data to native DocType fields
    Used during transition from JSON storage to native fields
    """
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        synced_count = 0
        
        # Get existing Flansa fields in DocType
        existing_flansa_fields = {}
        for field in doctype_doc.fields:
            if is_flansa_created_field(field):
                existing_flansa_fields[field.fieldname] = field
        
        # Process each field from JSON data
        for field_data in fields_data:
            field_name = field_data.get("field_name")
            if not field_name:
                continue
            
            if field_name in existing_flansa_fields:
                # Update existing field
                existing_field = existing_flansa_fields[field_name]
                existing_field.label = field_data.get("field_label", field_name)
                existing_field.fieldtype = field_data.get("field_type", "Data")
                existing_field.options = field_data.get("options", "")
                existing_field.reqd = field_data.get("is_required", 0)
                existing_field.read_only = field_data.get("is_readonly", 0)
                existing_field.hidden = field_data.get("hidden", 0)
                synced_count += 1
            else:
                # Add new field
                new_field = {
                    "fieldname": field_name,
                    "label": field_data.get("field_label", field_name),
                    "fieldtype": field_data.get("field_type", "Data"),
                    "options": field_data.get("options", ""),
                    "reqd": field_data.get("is_required", 0),
                    "read_only": field_data.get("is_readonly", 0),
                    "hidden": field_data.get("hidden", 0),
                    "description": create_flansa_field_description("basic", field_data)
                }
                doctype_doc.append("fields", new_field)
                synced_count += 1
        
        # Save DocType changes
        doctype_doc.save()
        
        return {
            "success": True,
            "synced_count": synced_count,
            "message": f"Synced {synced_count} fields to native DocType"
        }
        
    except Exception as e:
        frappe.log_error(f"Error syncing JSON to native fields: {str(e)}", "JSON Sync")
        return {"success": False, "error": str(e)}

def refresh_native_fields(table_name):
    """
    Refresh native fields (replacement for bulk_sync_table after migration)
    """
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        # Clear meta cache to ensure fresh field data
        frappe.clear_cache(doctype=table_doc.doctype_name)
        
        # Get current field count
        native_result = get_table_fields_native(table_name)
        if native_result.get("success"):
            field_count = len([f for f in native_result["fields"] if f.get("created_by_flansa")])
            return {
                "success": True,
                "synced": field_count,
                "message": f"Refreshed {field_count} native fields"
            }
        else:
            return native_result
            
    except Exception as e:
        frappe.log_error(f"Error refreshing native fields: {str(e)}", "Native Refresh")
        return {"success": False, "error": str(e)}

def update_native_field_from_flansa_field(table_name, flansa_field_doc):
    """
    Update native DocType field from Flansa Field record
    Used during transition period
    """
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        field_name = flansa_field_doc.field_name
        
        # Find and update the field in DocType
        field_found = False
        for field in doctype_doc.fields:
            if field.fieldname == field_name and is_flansa_created_field(field):
                field.label = flansa_field_doc.field_label or field_name
                field.fieldtype = flansa_field_doc.field_type or "Data"
                field.options = flansa_field_doc.options or ""
                field.reqd = flansa_field_doc.is_required or 0
                field.read_only = flansa_field_doc.is_readonly or 0
                field_found = True
                break
        
        if not field_found:
            # Add new field
            new_field = {
                "fieldname": field_name,
                "label": flansa_field_doc.field_label or field_name,
                "fieldtype": flansa_field_doc.field_type or "Data",
                "options": flansa_field_doc.options or "",
                "reqd": flansa_field_doc.is_required or 0,
                "read_only": flansa_field_doc.is_readonly or 0,
                "description": create_flansa_field_description("basic", {
                    "field_name": field_name,
                    "field_label": flansa_field_doc.field_label,
                    "field_type": flansa_field_doc.field_type
                })
            }
            doctype_doc.append("fields", new_field)
        
        doctype_doc.save()
        
        return {
            "success": True,
            "message": f"Updated native field '{field_name}'"
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating native field: {str(e)}", "Native Update")
        return {"success": False, "error": str(e)}

# ==============================================================================
# ADMIN CLI FUNCTIONS
# ==============================================================================

@frappe.whitelist()
def fix_field_marking():
    """Fix field marking for all tables after migration"""
    try:
        tables = frappe.get_all("Flansa Table", fields=["name", "doctype_name"])
        fixed_count = 0
        
        for table in tables:
            if table.doctype_name:
                doctype_doc = frappe.get_doc("DocType", table.doctype_name)
                
                for field in doctype_doc.fields:
                    # Check if this is a user field (not system)
                    if field.fieldname not in ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx']:
                        # Mark as Flansa-created if not already marked
                        if not field.description or "flansa_config" not in field.description:
                            field.description = create_flansa_field_description("basic", {
                                "field_name": field.fieldname,
                                "field_label": field.label,
                                "field_type": field.fieldtype
                            })
                            fixed_count += 1
                
                if fixed_count > 0:
                    doctype_doc.save()
        
        frappe.db.commit()
        return {"success": True, "message": f"Fixed {fixed_count} field markings"}
        
    except Exception as e:
        frappe.log_error(f"Error fixing field markings: {str(e)}", "Field Marking")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def list_all_flansa_tables():
    """List all Flansa tables for admin use"""
    tables = frappe.get_all("Flansa Table", 
        fields=["name", "table_name", "doctype_name", "creation"],
        order_by="creation desc"
    )
    
    return {
        "success": True,
        "tables": tables,
        "total_count": len(tables)
    }

@frappe.whitelist()
def get_table_field_summary(table_name):
    """Get comprehensive field summary for a table"""
    try:
        native_fields = get_table_fields_native(table_name)
        
        if not native_fields["success"]:
            return native_fields
        
        # Analyze field types
        field_analysis = {
            "total_fields": len(native_fields["fields"]),
            "flansa_fields": 0,
            "system_fields": 0,
            "field_types": {"basic": 0, "lookup": 0, "formula": 0, "summary": 0}
        }
        
        for field in native_fields["fields"]:
            if field["created_by_flansa"]:
                field_analysis["flansa_fields"] += 1
                field_type = field["flansa_field_type"]
                if field_type in field_analysis["field_types"]:
                    field_analysis["field_types"][field_type] += 1
            else:
                field_analysis["system_fields"] += 1
        
        return {
            "success": True,
            "table_name": table_name,
            "doctype_name": native_fields["doctype_name"],
            "analysis": field_analysis,
            "fields": native_fields["fields"]
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def fix_relationship_field_marking(table_name, field_name):
    """Fix marking for relationship fields created by old API"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated"}
        
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        # Find and update the field
        field_found = False
        for field in doctype_doc.fields:
            if field.fieldname == field_name:
                # Mark as Flansa-created
                field.description = create_flansa_field_description("basic", {
                    "field_name": field.fieldname,
                    "field_label": field.label,
                    "field_type": field.fieldtype,
                    "options": field.options or ""
                })
                field_found = True
                break
        
        if not field_found:
            return {"success": False, "error": f"Field '{field_name}' not found"}
        
        doctype_doc.save()
        
        return {
            "success": True,
            "message": f"Fixed marking for field '{field_name}'"
        }
        
    except Exception as e:
        frappe.log_error(f"Error fixing field marking: {str(e)}", "Field Marking")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def test_lookup_field_creation():
    """Test lookup field creation with known relationship"""
    try:
        # Test creating a lookup field from Classes.title to Schedule
        lookup_config = {
            "field_name": "class_title_lookup",
            "field_label": "Class Title",
            "source_field": "classe_link",
            "lookup_field": "title"
        }
        
        result = add_lookup_field_native("FT-0032", lookup_config)
        return result
        
    except Exception as e:
        frappe.log_error(f"Error testing lookup field creation: {str(e)}", "Lookup Test")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def update_gallery_field_db(doctype_name, doc_name, field_name, gallery_data):
    """
    Update gallery field with image data on server-side (ensures consistency)
    Handles both adding images and clearing the field
    """
    try:
        # Validate parameters
        if not doctype_name or not doc_name or not field_name:
            return {"success": False, "error": "Missing required parameters"}
        
        # Check if document exists
        if not frappe.db.exists(doctype_name, doc_name):
            return {"success": False, "error": f"Document {doc_name} not found"}
        
        # Validate gallery_data (should be JSON string or empty)
        if gallery_data and gallery_data.strip():
            try:
                # Validate it's proper JSON
                json.loads(gallery_data)
            except json.JSONDecodeError:
                return {"success": False, "error": "Invalid JSON data provided"}
        
        # Update field value directly in database without modifying timestamps
        frappe.db.set_value(doctype_name, doc_name, field_name, gallery_data or "", update_modified=False)
        
        # Commit to database immediately
        frappe.db.commit()
        
        # Clear document cache
        frappe.clear_document_cache(doctype_name, doc_name)
        
        # Verify the update
        updated_value = frappe.db.get_value(doctype_name, doc_name, field_name)
        
        return {
            "success": True,
            "message": f"Gallery field {field_name} updated in database",
            "method": "direct_database_update",
            "field_value_length": len(updated_value) if updated_value else 0,
            "data_preview": updated_value[:100] if updated_value else "empty"
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating gallery field: {str(e)}", "Gallery Field Update")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def force_clear_gallery_field_db(doctype_name, doc_name, field_name):
    """
    Force clear Long Text field directly in database (bypasses client-side caching)
    Specifically designed to fix gallery field persistence issue
    """
    try:
        # Validate parameters
        if not doctype_name or not doc_name or not field_name:
            return {"success": False, "error": "Missing required parameters"}
        
        # Check if document exists
        if not frappe.db.exists(doctype_name, doc_name):
            return {"success": False, "error": f"Document {doc_name} not found"}
        
        # Check if field exists in DocType
        meta = frappe.get_meta(doctype_name)
        field_exists = False
        for field in meta.get("fields"):
            if field.fieldname == field_name:
                field_exists = True
                break
        
        if not field_exists:
            return {"success": False, "error": f"Field {field_name} not found in DocType {doctype_name}"}
        
        # Force update field value directly in database without modifying timestamps
        frappe.db.set_value(doctype_name, doc_name, field_name, "", update_modified=False)
        
        # Commit to database immediately
        frappe.db.commit()
        
        # Clear document cache
        frappe.clear_document_cache(doctype_name, doc_name)
        
        # Verify the update
        updated_value = frappe.db.get_value(doctype_name, doc_name, field_name)
        
        return {
            "success": True,
            "message": f"Gallery field {field_name} cleared in database",
            "method": "direct_database_update",
            "verified_empty": not updated_value,
            "field_value_length": len(updated_value) if updated_value else 0
        }
        
    except Exception as e:
        frappe.log_error(f"Error force clearing gallery field: {str(e)}", "Gallery Field Clear")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def debug_relationship_fields(parent_table_name, child_table_name=None):
    """
    Debug which fields are available for lookup in relationship builder
    """
    try:
        result = {
            "success": True,
            "parent_table": parent_table_name,
            "debug_info": {}
        }
        
        # Get parent table fields
        parent_fields_result = get_table_fields_native(parent_table_name)
        if parent_fields_result.get("success"):
            all_fields = parent_fields_result["fields"]
            
            # Analyze field types
            field_type_counts = {}
            suitable_for_lookup = []
            excluded_fields = []
            
            for field in all_fields:
                field_type = field.get("fieldtype", "Unknown")
                field_type_counts[field_type] = field_type_counts.get(field_type, 0) + 1
                
                # Apply the same filtering logic as JavaScript
                if (field.get("fieldname") and 
                    not field["fieldname"].startswith('naming_series') and
                    not field["fieldname"].endswith('_count') and
                    field_type not in ['HTML', 'Section Break', 'Column Break', 'Tab Break', 'Button', 'Heading'] and
                    field_type in ['Data', 'Text', 'Select', 'Link', 'Date', 'Datetime', 'Email', 'Phone', 'Int', 'Float', 'Currency', 'Check', 'Small Text']):
                    
                    suitable_for_lookup.append({
                        "fieldname": field["fieldname"],
                        "label": field.get("label", ""),
                        "fieldtype": field_type,
                        "created_by_flansa": field.get("created_by_flansa", False)
                    })
                else:
                    excluded_fields.append({
                        "fieldname": field.get("fieldname", ""),
                        "label": field.get("label", ""),
                        "fieldtype": field_type,
                        "reason": "filtered_out"
                    })
            
            result["debug_info"] = {
                "total_fields": len(all_fields),
                "field_type_counts": field_type_counts,
                "suitable_for_lookup": suitable_for_lookup,
                "suitable_count": len(suitable_for_lookup),
                "excluded_fields": excluded_fields,
                "excluded_count": len(excluded_fields)
            }
        
        # If child table provided, also analyze it
        if child_table_name:
            child_fields_result = get_table_fields_native(child_table_name)
            if child_fields_result.get("success"):
                result["child_table"] = child_table_name
                result["child_fields"] = child_fields_result["fields"]
        
        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def test_fetch_from_generation(relationship_name, source_field):
    """Test the fetch_from string generation for lookup fields"""
    try:
        from flansa.flansa_core.api.relationship_management import get_table_name_for_field, pluralize_to_singular
        
        # Get relationship
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Determine the join field
        parent_table_name = get_table_name_for_field(relationship.from_table)
        parent_singular = pluralize_to_singular(parent_table_name)
        join_field = relationship.to_field or f"{parent_singular}_link"
        
        # Generate fetch_from string
        fetch_from = f"{join_field}.{source_field}"
        
        # Get actual DocType names
        parent_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
        child_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        
        # Check if join field exists in child DocType
        child_meta = frappe.get_meta(child_doctype) if child_doctype else None
        join_field_exists = False
        if child_meta:
            for field in child_meta.fields:
                if field.fieldname == join_field:
                    join_field_exists = True
                    break
        
        return {
            "success": True,
            "relationship": relationship_name,
            "from_table": relationship.from_table,
            "to_table": relationship.to_table,
            "parent_table_name": parent_table_name,
            "parent_singular": parent_singular,
            "join_field": join_field,
            "source_field": source_field,
            "fetch_from": fetch_from,
            "parent_doctype": parent_doctype,
            "child_doctype": child_doctype,
            "join_field_exists": join_field_exists
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def test_singular_conversion():
    """Test the singular conversion function"""
    try:
        from flansa.flansa_core.api.relationship_management import pluralize_to_singular, get_table_name_for_field
        
        test_cases = [
            "classes",
            "categories", 
            "expenses",
            "schedule"
        ]
        
        # Debug the expenses case
        expenses_debug = {}
        word = "expenses"
        expenses_debug["ends_with_es"] = word.endswith('es')
        expenses_debug["ends_with_enses"] = word.endswith('enses')
        expenses_debug["ends_with_nses"] = word.endswith('nses')  
        expenses_debug["length"] = len(word)
        expenses_debug["last_4"] = word[-4:] if len(word) >= 4 else word
        
        results = {}
        for word in test_cases:
            singular = pluralize_to_singular(word)
            results[word] = singular
        
        # Also test with actual table IDs
        table_results = {}
        for table_id in ["FT-0031", "FT-0032", "FT-0030", "FT-0029"]:
            table_name = get_table_name_for_field(table_id)
            singular = pluralize_to_singular(table_name)
            table_results[table_id] = {
                "table_name": table_name,
                "singular": singular,
                "field_name": f"{singular}_link"
            }
        
        return {
            "success": True,
            "word_tests": results,
            "table_tests": table_results,
            "expenses_debug": expenses_debug
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}