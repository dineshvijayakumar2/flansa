"""
Cleanup utilities for removing unused code and fields after migration
"""

import frappe
import os
import shutil

@frappe.whitelist()
def check_fields_json_usage():
    """Check if any tables still have fields_json data"""
    try:
        tables = frappe.get_all('Flansa Table', fields=['name', 'fields_json'])
        tables_with_data = []
        
        for table in tables:
            if table.fields_json and table.fields_json != '[]' and table.fields_json != 'null':
                tables_with_data.append(table.name)
        
        if tables_with_data:
            return {
                "success": False,
                "message": f"Found {len(tables_with_data)} tables with fields_json data",
                "tables": tables_with_data
            }
        else:
            return {
                "success": True,
                "message": "No tables have fields_json data - safe to remove"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def clear_fields_json():
    """Clear fields_json from all Flansa Tables"""
    try:
        frappe.db.sql("UPDATE `tabFlansa Table` SET fields_json = NULL")
        frappe.db.commit()
        return {"success": True, "message": "Cleared fields_json from all tables"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def list_poc_files():
    """List POC and test files that can be removed"""
    try:
        poc_files = []
        
        # POC files in apps/flansa
        flansa_path = frappe.get_app_path("flansa")
        poc_patterns = ["poc_", "POC_", "test_poc", "debug_"]
        
        for root, dirs, files in os.walk(flansa_path):
            for file in files:
                for pattern in poc_patterns:
                    if pattern in file:
                        poc_files.append(os.path.join(root, file))
        
        # POC files in claude-code directory
        claude_code_path = "/home/ubuntu/frappe-bench/claude-code"
        if os.path.exists(claude_code_path):
            for file in os.listdir(claude_code_path):
                if any(pattern in file for pattern in poc_patterns):
                    poc_files.append(os.path.join(claude_code_path, file))
        
        return {
            "success": True,
            "poc_files": poc_files,
            "count": len(poc_files)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def remove_poc_files():
    """Remove POC and test files"""
    try:
        result = list_poc_files()
        if not result.get("success"):
            return result
        
        removed = []
        errors = []
        
        for file_path in result.get("poc_files", []):
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    removed.append(file_path)
            except Exception as e:
                errors.append(f"{file_path}: {str(e)}")
        
        return {
            "success": True,
            "removed": removed,
            "removed_count": len(removed),
            "errors": errors
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def list_unused_api_functions():
    """List field management API functions that are no longer needed"""
    unused_functions = [
        "flansa.flansa_core.api.field_management.save_table_fields_seamless",
        "flansa.flansa_core.api.field_management.seamless_save_fields",
        "flansa.flansa_core.api.field_management.seamless_update_field",
        "flansa.flansa_core.utils.auto_sync.sync_field_to_json",
        "flansa.flansa_core.utils.auto_sync.sync_table_to_fields",
        "flansa.flansa_core.utils.auto_sync.bulk_sync_table",
        "flansa.flansa_core.utils.field_sync",  # Entire module can be removed
    ]
    
    return {
        "success": True,
        "unused_functions": unused_functions,
        "message": "These functions can be removed or simplified"
    }

@frappe.whitelist()
def cleanup_hooks():
    """Check hooks.py for references to removed functions"""
    try:
        hooks_path = frappe.get_app_path("flansa", "hooks.py")
        
        with open(hooks_path, 'r') as f:
            content = f.read()
        
        outdated_references = []
        
        # Check for old sync references
        if "sync_field_to_json" in content:
            outdated_references.append("sync_field_to_json in doc_events")
        if "sync_table_to_fields" in content:
            outdated_references.append("sync_table_to_fields in doc_events")
        if "field_sync" in content:
            outdated_references.append("field_sync module references")
        
        if outdated_references:
            return {
                "success": False,
                "message": "Found outdated references in hooks.py",
                "outdated": outdated_references
            }
        else:
            return {
                "success": True,
                "message": "No outdated references found in hooks.py"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def full_cleanup():
    """Perform full cleanup of unused code and fields"""
    results = {
        "fields_json": check_fields_json_usage(),
        "poc_files": list_poc_files(),
        "unused_apis": list_unused_api_functions(),
        "hooks": cleanup_hooks()
    }
    
    return {
        "success": True,
        "cleanup_report": results,
        "next_steps": [
            "1. Run clear_fields_json() to clear all fields_json data",
            "2. Run remove_poc_files() to delete POC files",
            "3. Manually review and remove unused API functions",
            "4. Update hooks.py to remove old sync references"
        ]
    }