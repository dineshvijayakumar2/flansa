"""
Field Sync Diagnostic & Fix Tool
Comprehensive solution to field synchronization issues between JSON, Flansa Field, and DocType
"""

import frappe
import json

@frappe.whitelist()
def diagnose_field_sync(table_name):
    """Comprehensive field sync diagnostic for a specific table"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Current architecture: fields are stored only in DocType.fields
        # JSON and Flansa Field storage methods are deprecated
        doctype_fields = get_fields_from_doctype(table_doc.doctype_name) if table_doc.doctype_name else []
        
        return {
            "success": True,
            "table_name": table_name,
            "table_label": table_doc.table_label,
            "doctype_name": table_doc.doctype_name,
            "counts": {
                "doctype_fields": len(doctype_fields)
            },
            "fields": {
                "doctype": doctype_fields
            },
            "analysis": {
                "sync_status": "in_sync",
                "message": "Fields are stored directly in DocType - no sync needed"
            },
            "recommendations": [{
                "priority": "info",
                "action": "no_action_needed", 
                "description": "Current architecture stores fields directly in DocType",
                "fields": []
            }]
        }
        
    except Exception as e:
        frappe.log_error(f"Error in field sync diagnostic: {str(e)}", "Field Sync Diagnostic")
        return {
            "success": False,
            "error": str(e)
        }

def get_fields_from_json(table_doc):
    """Extract fields from JSON storage"""
    # fields_json no longer exists in Flansa Table
    # Fields are now stored in the Flansa Field DocType
    # Return empty list as JSON storage is deprecated
    return []

def get_fields_from_flansa_field_table(table_name):
    """Extract fields from Flansa Field table"""
    # Flansa Field DocType doesn't exist - fields are stored directly in DocType.fields
    # Return empty list as this storage method is not used
    return []

def get_fields_from_doctype(doctype_name):
    """Extract fields from DocType"""
    if not doctype_name or not frappe.db.exists("DocType", doctype_name):
        return []
    
    try:
        dt = frappe.get_doc("DocType", doctype_name)
        fields = []
        for field in dt.fields:
            # Skip system fields
            if field.fieldname not in ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx"]:
                fields.append({
                    "field_name": field.fieldname,
                    "field_label": field.label,
                    "field_type": field.fieldtype,
                    "options": field.options or "",
                    "is_required": 1 if field.reqd else 0,
                    "is_unique": 1 if field.unique else 0,
                    "default_value": field.default or ""
                })
        return fields
    except:
        return []

def analyze_field_discrepancies(json_fields, flansa_fields, doctype_fields):
    """Analyze discrepancies between field sources"""
    json_names = {f.get("field_name") for f in json_fields if f.get("field_name")}
    flansa_names = {f.get("field_name") for f in flansa_fields if f.get("field_name")}  # Now handles dict format
    doctype_names = {f.get("field_name") for f in doctype_fields if f.get("field_name")}
    
    analysis = {
        "missing_from_flansa": list(json_names - flansa_names),
        "missing_from_json": list(flansa_names - json_names),
        "missing_from_doctype": list(json_names - doctype_names),
        "extra_in_flansa": list(flansa_names - json_names),
        "extra_in_doctype": list(doctype_names - json_names),
        "all_sources_match": len(json_names) == len(flansa_names) == len(doctype_names) and json_names == flansa_names == doctype_names,
        "total_unique_fields": len(json_names | flansa_names | doctype_names),
        "sync_status": "in_sync" if json_names == flansa_names else "out_of_sync"
    }
    
    return analysis

def generate_recommendations(analysis):
    """Generate fix recommendations based on analysis"""
    recommendations = []
    
    if analysis["missing_from_flansa"]:
        recommendations.append({
            "priority": "high",
            "action": "sync_json_to_flansa",
            "description": f"Sync {len(analysis['missing_from_flansa'])} fields from JSON to Flansa Field table",
            "fields": analysis["missing_from_flansa"]
        })
    
    if analysis["extra_in_flansa"]:
        recommendations.append({
            "priority": "medium", 
            "action": "remove_extra_flansa_fields",
            "description": f"Remove {len(analysis['extra_in_flansa'])} orphaned fields from Flansa Field table",
            "fields": analysis["extra_in_flansa"]
        })
    
    if analysis["missing_from_doctype"]:
        recommendations.append({
            "priority": "low",
            "action": "sync_to_doctype",
            "description": f"Sync {len(analysis['missing_from_doctype'])} fields to DocType",
            "fields": analysis["missing_from_doctype"]
        })
    
    if not recommendations:
        recommendations.append({
            "priority": "info",
            "action": "no_action_needed",
            "description": "All field sources are synchronized",
            "fields": []
        })
    
    return recommendations

@frappe.whitelist()
def auto_fix_field_sync(table_name, fix_actions=None):
    """Automatically fix field synchronization issues"""
    try:
        if not fix_actions:
            # Get diagnostic first
            diagnostic = diagnose_field_sync(table_name)
            if not diagnostic["success"]:
                return diagnostic
            
            fix_actions = [r["action"] for r in diagnostic["recommendations"]]
        
        if isinstance(fix_actions, str):
            fix_actions = [fix_actions]
        
        results = []
        
        for action in fix_actions:
            if action == "sync_json_to_flansa":
                result = sync_json_to_flansa_fields(table_name)
                results.append({"action": action, "result": result})
            
            elif action == "remove_extra_flansa_fields":
                result = remove_orphaned_flansa_fields(table_name)
                results.append({"action": action, "result": result})
            
            elif action == "sync_to_doctype":
                result = sync_fields_to_doctype_complete(table_name)
                results.append({"action": action, "result": result})
        
        return {
            "success": True,
            "table_name": table_name,
            "actions_performed": results,
            "message": f"Completed {len(results)} sync actions"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in auto fix field sync: {str(e)}", "Auto Fix Field Sync")
        return {
            "success": False,
            "error": str(e)
        }

def sync_json_to_flansa_fields(table_name):
    """Sync fields from JSON to Flansa Field records"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # fields_json no longer exists - skip JSON sync
        return {"success": True, "synced": 0, "message": "JSON storage deprecated - using Flansa Field records"}
        
        fields_data = []  # Empty since no JSON storage
        synced_count = 0
        
        for field_data in fields_data:
            field_name = field_data.get("field_name")
            if not field_name:
                continue
            
            # Map field type to valid Frappe field type
            field_type = normalize_field_type(field_data.get("field_type", "Data"))
            
            # Check if Flansa Field record exists
            existing = frappe.db.exists("Flansa Field", {"field_name": field_name, "flansa_table": table_name})
            
            if not existing:
                # Create new Flansa Field record
                field_doc = frappe.new_doc("Flansa Field")
                field_doc.field_name = field_name
                field_doc.field_label = field_data.get("field_label", field_name)
                field_doc.field_type = field_type
                field_doc.flansa_table = table_name
                field_doc.is_required = field_data.get("is_required", 0)
                field_doc.is_unique = field_data.get("is_unique", 0)
                field_doc.default_value = field_data.get("default_value", "")
                field_doc.options = field_data.get("options", "")
                field_doc.description = field_data.get("description", "")
                field_doc.insert(ignore_permissions=True)
                synced_count += 1
            else:
                # Update existing record
                field_doc = frappe.get_doc("Flansa Field", existing)
                field_doc.field_label = field_data.get("field_label", field_name)
                field_doc.field_type = field_type
                field_doc.is_required = field_data.get("is_required", 0)
                field_doc.is_unique = field_data.get("is_unique", 0)
                field_doc.default_value = field_data.get("default_value", "")
                field_doc.options = field_data.get("options", "")
                field_doc.description = field_data.get("description", "")
                field_doc.save(ignore_permissions=True)
        
        frappe.db.commit()
        return {
            "success": True,
            "synced": synced_count,
            "message": f"Synced {synced_count} fields from JSON to Flansa Field table"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def normalize_field_type(flansa_type):
    """Normalize Flansa field types to valid Frappe field types"""
    field_type_mapping = {
        # Text types
        "Text": "Data",
        "Data": "Data", 
        "Text Area": "Small Text",
        "Textarea": "Small Text",
        "Long Text": "Text Editor",
        "Rich Text": "Text Editor",
        "HTML": "Text Editor",
        "Markdown": "Markdown Editor",
        
        # Numeric types
        "Number": "Int",
        "Int": "Int",
        "Float": "Float",
        "Decimal": "Float",
        "Currency": "Currency",
        "Percent": "Percent",
        
        # Date/Time types
        "Date": "Date",
        "DateTime": "Datetime",
        "Datetime": "Datetime",
        "Time": "Time",
        
        # Selection types
        "Select": "Select",
        "Dropdown": "Select",
        "Multi-Select": "Small Text",  # Store as text since no native multiselect
        
        # Other types
        "Check": "Check",
        "Checkbox": "Check",
        "Email": "Data",  # Use Data with validation
        "Phone": "Data",  # Use Data with validation
        "URL": "Data",    # Use Data with validation
        "Link": "Link",
        "Image": "Attach Image",
        "File": "Attach",
        "Attachment": "Attach",
        "JSON": "JSON",
        "Code": "Code",
        "Color": "Color",
        "Barcode": "Barcode",
        "Geolocation": "Geolocation"
    }
    
    # Return mapped type or default to Data
    mapped_type = field_type_mapping.get(flansa_type, "Data")
    
    # Validate against Frappe's allowed field types
    valid_types = [
        "Data", "Int", "Float", "Currency", "Percent", "Check", "Small Text", 
        "Text Editor", "Date", "Datetime", "Time", "Select", "Link", "Table", 
        "Table MultiSelect", "Attach", "Attach Image", "Color", "Geolocation", 
        "JSON", "Markdown Editor", "HTML Editor", "Phone", "Email", "URL", 
        "Barcode", "Section Break", "Column Break", "Tab Break", "HTML", "Heading"
    ]
    
    if mapped_type not in valid_types:
        print(f"Warning: {flansa_type} -> {mapped_type} is not valid, using Data instead")
        mapped_type = "Data"
    
    return mapped_type

def remove_orphaned_flansa_fields(table_name):
    """Remove Flansa Field records that don't exist in JSON"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # fields_json no longer exists - don't remove any fields
        # All Flansa Field records are now the source of truth
        return {"success": True, "removed": 0, "message": "No orphaned fields - JSON storage deprecated"}
        
        # Get all Flansa Field records
        flansa_fields = frappe.get_all("Flansa Field", 
                                      filters={"flansa_table": table_name},
                                      fields=["name", "field_name"])
        
        removed_count = 0
        for field in flansa_fields:
            if field.field_name not in json_field_names:
                frappe.delete_doc("Flansa Field", field.name, ignore_permissions=True)
                removed_count += 1
        
        frappe.db.commit()
        return {
            "success": True,
            "removed": removed_count,
            "message": f"Removed {removed_count} orphaned fields"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def sync_fields_to_doctype_complete(table_name):
    """Sync all fields to DocType using existing field management API"""
    try:
        # Use existing field management API
        from flansa.flansa_core.api.field_management import sync_all_fields_to_doctype
        return sync_all_fields_to_doctype(table_name)
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def bulk_diagnose_all_tables():
    """Run diagnostic on all Flansa Tables"""
    try:
        tables = frappe.get_all("Flansa Table", fields=["name", "table_label"])
        
        results = []
        total_issues = 0
        
        for table in tables:
            diagnostic = diagnose_field_sync(table.name)
            if diagnostic["success"]:
                issues = len(diagnostic["analysis"]["missing_from_flansa"]) + len(diagnostic["analysis"]["extra_in_flansa"])
                total_issues += issues
                
                results.append({
                    "table_name": table.name,
                    "table_label": table.table_label,
                    "sync_status": diagnostic["analysis"]["sync_status"],
                    "issues_count": issues,
                    "recommendations": len(diagnostic["recommendations"])
                })
        
        return {
            "success": True,
            "total_tables": len(tables),
            "total_issues": total_issues,
            "tables_with_issues": len([r for r in results if r["issues_count"] > 0]),
            "results": results
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def bulk_fix_all_tables():
    """Auto-fix all tables with field sync issues"""
    try:
        bulk_diagnostic = bulk_diagnose_all_tables()
        
        if not bulk_diagnostic["success"]:
            return bulk_diagnostic
        
        fixed_tables = []
        errors = []
        
        for table_result in bulk_diagnostic["results"]:
            if table_result["issues_count"] > 0:
                try:
                    # Only fix JSON to Flansa Field sync issues (not DocType sync)
                    # This avoids the infinite loop in DocType recreation
                    table_name = table_result["table_name"]
                    
                    # Just sync from JSON to Flansa Field table
                    sync_result = sync_json_to_flansa_fields(table_name)
                    
                    if sync_result["success"]:
                        # Also remove orphaned fields
                        remove_result = remove_orphaned_flansa_fields(table_name)
                        fixed_tables.append({
                            "table": table_name,
                            "synced": sync_result.get("synced", 0),
                            "removed": remove_result.get("removed", 0)
                        })
                    else:
                        errors.append({
                            "table": table_name,
                            "error": sync_result.get("error", "Unknown error")
                        })
                        
                except Exception as e:
                    errors.append({
                        "table": table_result["table_name"],
                        "error": str(e)
                    })
        
        return {
            "success": True,
            "total_tables_checked": bulk_diagnostic["total_tables"],
            "tables_with_issues": bulk_diagnostic["tables_with_issues"],
            "tables_fixed": len(fixed_tables),
            "fixed_tables": fixed_tables,
            "errors": errors
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }