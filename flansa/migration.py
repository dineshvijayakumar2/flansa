"""
Migration utilities for eliminating Flansa Field doctype
Migrates existing Flansa Field records to native DocType fields
"""

import frappe
import json
from frappe.utils import now, cstr

@frappe.whitelist()
def analyze_migration_impact():
    """
    Analyze the impact of migrating from Flansa Fields to native fields
    Returns comprehensive report for admin review
    """
    try:
        # Get all Flansa Tables
        tables = frappe.get_all("Flansa Table", fields=["name", "table_name", "doctype_name"])
        
        migration_report = {
            "total_tables": len(tables),
            "tables_with_fields": 0,
            "total_flansa_fields": 0,
            "field_types": {"basic": 0, "lookup": 0, "formula": 0, "summary": 0, "unknown": 0},
            "tables_details": [],
            "potential_issues": [],
            "estimated_time": "5-15 minutes"
        }
        
        for table in tables:
            table_analysis = analyze_table_migration(table["name"])
            
            if table_analysis["flansa_field_count"] > 0:
                migration_report["tables_with_fields"] += 1
                migration_report["total_flansa_fields"] += table_analysis["flansa_field_count"]
                
                # Add to field type counts
                for field_type, count in table_analysis["field_types"].items():
                    if field_type in migration_report["field_types"]:
                        migration_report["field_types"][field_type] += count
                
                migration_report["tables_details"].append(table_analysis)
                
                # Check for potential issues
                if table_analysis["potential_issues"]:
                    migration_report["potential_issues"].extend(table_analysis["potential_issues"])
        
        return {
            "success": True,
            "migration_report": migration_report
        }
        
    except Exception as e:
        frappe.log_error(f"Error analyzing migration impact: {str(e)}", "Migration")
        return {"success": False, "error": str(e)}

def analyze_table_migration(table_name):
    """Analyze migration requirements for a single table"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Get existing Flansa Field records
        flansa_fields = frappe.get_all("Flansa Field",
            filters={"flansa_table": table_name},
            fields=["field_name", "field_label", "field_type", "formula_expression", "lookup_field", "summary_type", "is_formula_field", "is_lookup_field", "is_summary_field"]
        )
        
        analysis = {
            "table_name": table_name,
            "table_id": table_doc.name,
            "doctype_name": table_doc.doctype_name,
            "flansa_field_count": len(flansa_fields),
            "field_types": {"basic": 0, "lookup": 0, "formula": 0, "summary": 0, "unknown": 0},
            "fields_detail": [],
            "potential_issues": []
        }
        
        for field in flansa_fields:
            # Determine field type from Flansa Field structure
            field_type = determine_field_type_from_record(field)
            
            if field_type in analysis["field_types"]:
                analysis["field_types"][field_type] += 1
            else:
                analysis["field_types"]["unknown"] += 1
            
            field_detail = {
                "field_name": field.field_name,
                "field_label": field.field_label,
                "field_type": field_type,
                "migration_method": get_migration_method(field_type)
            }
            
            # Check for potential migration issues
            issues = check_field_migration_issues(field)
            if issues:
                field_detail["issues"] = issues
                analysis["potential_issues"].extend(issues)
            
            analysis["fields_detail"].append(field_detail)
        
        return analysis
        
    except Exception as e:
        return {
            "table_name": table_name,
            "error": str(e),
            "flansa_field_count": 0,
            "field_types": {},
            "potential_issues": [f"Error analyzing table: {str(e)}"]
        }

def determine_field_type_from_record(field):
    """Determine field type from Flansa Field record structure"""
    # Check the is_* flags first (more accurate)
    if field.get("is_formula_field"):
        return "formula"
    elif field.get("is_lookup_field"):
        return "lookup"
    elif field.get("is_summary_field"):
        return "summary"
    # Fallback to content-based detection
    elif field.get("formula_expression"):
        return "formula"
    elif field.get("lookup_field"):
        return "lookup"
    # Don't rely on summary_type alone - it's set to "Count" by default
    elif field.get("is_summary_field") or (field.get("summary_type") and field.get("summary_type") != "Count"):
        return "summary"
    else:
        return "basic"

def get_migration_method(field_type):
    """Get the migration method for each field type"""
    methods = {
        "basic": "direct_doctype_field",
        "lookup": "native_fetch_from",
        "formula": "virtual_field_plus_server_script", 
        "summary": "stored_field_plus_server_script"
    }
    return methods.get(field_type, "manual_review_required")

def check_field_migration_issues(field):
    """Check for potential migration issues with a field"""
    issues = []
    
    # Check for complex formula expressions
    if field.get("formula_expression"):
        formula = field.get("formula_expression", "")
        if len(formula) > 200:
            issues.append("Complex formula expression may need optimization")
        
        # Check for unsupported functions
        unsupported_funcs = ["VLOOKUP", "INDEX", "MATCH"]
        for func in unsupported_funcs:
            if func in formula.upper():
                issues.append(f"Formula contains potentially unsupported function: {func}")
    
    # Check for complex lookup configurations
    field_type = determine_field_type_from_record(field)
    if field_type == "lookup" and not field.get("lookup_field"):
        issues.append("Lookup field missing lookup_field configuration")
    
    # Check for summary field configurations
    if field_type == "summary" and not field.get("summary_type"):
        issues.append("Summary field missing summary_type configuration")
    
    return issues

@frappe.whitelist()
def migrate_table_fields(table_name, dry_run=True):
    """
    Migrate all Flansa Fields for a table to native DocType fields
    
    Args:
        table_name: Flansa Table name
        dry_run: If True, only simulate migration without making changes
    """
    try:
        if isinstance(dry_run, str):
            dry_run = dry_run.lower() == "true"
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if not table_doc.doctype_name:
            return {"success": False, "error": "DocType not generated for table"}
        
        # Get existing Flansa Field records
        flansa_fields = frappe.get_all("Flansa Field",
            filters={"flansa_table": table_name},
            fields=["name", "field_name", "field_label", "field_type", "formula_expression", "lookup_field", "summary_type", "is_formula_field", "is_lookup_field", "is_summary_field"]
        )
        
        migration_results = {
            "table_name": table_name,
            "doctype_name": table_doc.doctype_name,
            "dry_run": dry_run,
            "total_fields": len(flansa_fields),
            "migrated_successfully": 0,
            "migration_errors": 0,
            "field_results": []
        }
        
        for field in flansa_fields:
            field_result = migrate_single_field(table_name, field, dry_run)
            migration_results["field_results"].append(field_result)
            
            if field_result["success"]:
                migration_results["migrated_successfully"] += 1
            else:
                migration_results["migration_errors"] += 1
        
        return {
            "success": True,
            "migration_results": migration_results
        }
        
    except Exception as e:
        frappe.log_error(f"Error migrating table fields: {str(e)}", "Migration")
        return {"success": False, "error": str(e)}

def migrate_single_field(table_name, field_record, dry_run=True):
    """Migrate a single Flansa Field to native DocType field"""
    try:
        from flansa.native_fields import (
            add_basic_field_native, add_lookup_field_native, 
            add_formula_field_native, add_summary_field_native
        )
        
        field_name = field_record["field_name"]
        field_type = determine_field_type_from_record(field_record)
        
        # Prepare migration config based on field type
        migration_config = {
            "field_name": field_name,
            "field_label": field_record["field_label"] or field_name.replace("_", " ").title(),
            "field_type": field_record.get("field_type", "Data")
        }
        
        # Add specific configurations based on field type
        if field_type == "formula":
            migration_config["formula"] = field_record.get("formula_expression", "")
            migration_config["result_type"] = "Float"
        elif field_type == "lookup":
            migration_config["source_field"] = "unknown"  # Will need manual config
            migration_config["lookup_field"] = field_record.get("lookup_field", "name")
        elif field_type == "summary":
            migration_config["summary_type"] = field_record.get("summary_type", "Count")
            migration_config["target_doctype"] = "Unknown"  # Will need manual config
            migration_config["filter_field"] = "unknown"
            migration_config["summary_field"] = "name"
        
        if dry_run:
            # Simulate migration
            return {
                "field_name": field_name,
                "field_type": field_type,
                "success": True,
                "action": "simulated",
                "migration_method": get_migration_method(field_type),
                "config": migration_config
            }
        
        # Perform actual migration based on field type
        if field_type == "basic":
            result = add_basic_field_native(table_name, migration_config)
        elif field_type == "lookup":
            result = add_lookup_field_native(table_name, migration_config)
        elif field_type == "formula":
            result = add_formula_field_native(table_name, migration_config)
        elif field_type == "summary":
            result = add_summary_field_native(table_name, migration_config)
        else:
            return {
                "field_name": field_name,
                "field_type": field_type,
                "success": False,
                "error": f"Unsupported field type: {field_type}"
            }
        
        # Add migration metadata to result
        result.update({
            "field_name": field_name,
            "field_type": field_type,
            "action": "migrated" if result.get("success") else "failed"
        })
        
        return result
        
    except Exception as e:
        return {
            "field_name": field_record["field_name"],
            "field_type": field_record["field_type"],
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def cleanup_flansa_fields_after_migration(table_name, confirm=False):
    """
    Clean up Flansa Field records after successful migration
    
    Args:
        table_name: Flansa Table name
        confirm: Must be True to actually delete records
    """
    try:
        if not confirm or (isinstance(confirm, str) and confirm.lower() != "true"):
            # Get count for confirmation
            field_count = frappe.db.count("Flansa Field", {"flansa_table": table_name})
            return {
                "success": False,
                "message": f"Found {field_count} Flansa Field records for table '{table_name}'. Set confirm=True to delete.",
                "field_count": field_count,
                "warning": "This action cannot be undone!"
            }
        
        # Get all Flansa Field records for this table
        flansa_fields = frappe.get_all("Flansa Field",
            filters={"flansa_table": table_name},
            fields=["name"]
        )
        
        deleted_count = 0
        errors = []
        
        for field in flansa_fields:
            try:
                frappe.delete_doc("Flansa Field", field["name"])
                deleted_count += 1
            except Exception as e:
                errors.append(f"Error deleting {field['name']}: {str(e)}")
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} Flansa Field records",
            "table_name": table_name,
            "deleted_count": deleted_count,
            "errors": errors if errors else None
        }
        
    except Exception as e:
        frappe.log_error(f"Error cleaning up Flansa Fields: {str(e)}", "Migration")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def mark_existing_fields_as_native(table_name):
    """
    For tables where fields already exist in DocType but need to be marked as Flansa-created
    This handles the transition scenario where sync has already created the fields
    """
    try:
        # Get existing DocType fields
        from flansa.native_fields import get_table_fields_native
        native_result = get_table_fields_native(table_name)
        if not native_result.get("success"):
            return native_result
        
        # Get Flansa Field records to see what should be marked
        flansa_fields = frappe.get_all("Flansa Field",
            filters={"flansa_table": table_name},
            fields=["field_name", "field_label", "field_type"]
        )
        
        if not flansa_fields:
            return {"success": True, "message": "No Flansa Fields to migrate"}
        
        # Update existing DocType fields to mark them as Flansa-created
        table_doc = frappe.get_doc("Flansa Table", table_name)
        doctype_doc = frappe.get_doc("DocType", table_doc.doctype_name)
        
        updated_count = 0
        for flansa_field in flansa_fields:
            field_name = flansa_field["field_name"]
            
            # Find matching field in DocType
            for doctype_field in doctype_doc.fields:
                if doctype_field.fieldname == field_name:
                    # Update description to mark as Flansa-created
                    from flansa.native_fields import create_flansa_field_description
                    doctype_field.description = create_flansa_field_description("basic", {
                        "field_name": field_name,
                        "field_label": flansa_field.get("field_label", field_name),
                        "field_type": flansa_field.get("field_type", "Data"),
                        "migrated_from_flansa_field": True
                    })
                    updated_count += 1
                    break
        
        # Save DocType with updated field descriptions
        doctype_doc.save()
        
        return {
            "success": True,
            "message": f"Marked {updated_count} existing fields as Flansa-created",
            "updated_fields": updated_count,
            "table_name": table_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error marking fields as native: {str(e)}", "Native Migration")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def complete_table_migration(table_name):
    """
    Complete migration for a table - handles both new fields and existing fields
    This is the main function for full table migration
    """
    try:
        # Step 1: Analyze migration
        analysis = analyze_table_migration(table_name)
        if analysis.get("error"):
            return {"success": False, "error": analysis["error"]}
        
        if analysis["flansa_field_count"] == 0:
            return {"success": True, "message": "No Flansa Fields to migrate", "analysis": analysis}
        
        # Step 2: Check if fields already exist in DocType (common scenario due to current sync)
        from flansa.native_fields import get_table_fields_native
        native_result = get_table_fields_native(table_name)
        
        if native_result.get("success"):
            existing_field_names = {f["fieldname"] for f in native_result["fields"]}
            flansa_field_names = {f["field_name"] for f in analysis["fields_detail"]}
            
            fields_already_exist = len(flansa_field_names & existing_field_names) > 0
            
            if fields_already_exist:
                # Use mark-existing approach for tables where fields already exist
                mark_result = mark_existing_fields_as_native(table_name)
                if not mark_result["success"]:
                    return {"success": False, "error": "Failed to mark existing fields", "details": mark_result}
                
                # Clean up Flansa Field records
                cleanup_result = cleanup_flansa_fields_after_migration(table_name, confirm=True)
                
                return {
                    "success": True,
                    "message": f"Migration completed successfully for table '{table_name}' (existing fields marked)",
                    "summary": {
                        "fields_migrated": mark_result["updated_fields"],
                        "flansa_fields_cleaned": cleanup_result.get("deleted_count", 0),
                        "migration_method": "mark_existing_fields_as_native"
                    },
                    "details": {
                        "analysis": analysis,
                        "mark_result": mark_result,
                        "cleanup": cleanup_result
                    }
                }
        
        # Step 3: Try normal migration for new fields
        migration_result = migrate_table_fields(table_name, dry_run=False)
        if not migration_result["success"]:
            return {"success": False, "error": "Migration failed", "details": migration_result}
        
        # Check if all fields migrated successfully
        results = migration_result["migration_results"]
        if results["migration_errors"] > 0:
            return {
                "success": False,
                "error": f"Migration completed with {results['migration_errors']} errors",
                "details": results
            }
        
        # Step 4: Clean up Flansa Field records (only if migration was 100% successful)
        cleanup_result = cleanup_flansa_fields_after_migration(table_name, confirm=True)
        
        return {
            "success": True,
            "message": f"Migration completed successfully for table '{table_name}'",
            "summary": {
                "fields_migrated": results["migrated_successfully"],
                "flansa_fields_cleaned": cleanup_result.get("deleted_count", 0),
                "migration_method": "native_doctype_fields"
            },
            "details": {
                "analysis": analysis,
                "migration": results,
                "cleanup": cleanup_result
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error in complete table migration: {str(e)}", "Migration")
        return {"success": False, "error": str(e)}

@frappe.whitelist() 
def migrate_all_tables():
    """
    Migrate all Flansa Tables from Flansa Fields to native fields
    For admin use - comprehensive migration
    """
    try:
        # Get all tables with Flansa Fields
        tables_with_fields = frappe.db.sql("""
            SELECT DISTINCT ft.name, ft.table_name, ft.doctype_name, COUNT(ff.name) as field_count
            FROM `tabFlansa Table` ft
            LEFT JOIN `tabFlansa Field` ff ON ff.flansa_table = ft.name
            WHERE ff.name IS NOT NULL
            GROUP BY ft.name
            ORDER BY field_count DESC
        """, as_dict=True)
        
        overall_results = {
            "total_tables": len(tables_with_fields),
            "successfully_migrated": 0,
            "failed_migrations": 0,
            "table_results": []
        }
        
        for table in tables_with_fields:
            table_result = complete_table_migration(table["name"])
            table_result["table_name"] = table["table_name"]
            table_result["field_count"] = table["field_count"]
            
            overall_results["table_results"].append(table_result)
            
            if table_result["success"]:
                overall_results["successfully_migrated"] += 1
            else:
                overall_results["failed_migrations"] += 1
        
        return {
            "success": True,
            "message": f"Migration completed for {overall_results['successfully_migrated']}/{overall_results['total_tables']} tables",
            "overall_results": overall_results
        }
        
    except Exception as e:
        frappe.log_error(f"Error in migrate all tables: {str(e)}", "Migration")
        return {"success": False, "error": str(e)}

# ==============================================================================
# VERIFICATION FUNCTIONS  
# ==============================================================================

@frappe.whitelist()
def verify_migration_success(table_name):
    """
    Verify that migration was successful for a table
    Compare native fields with original Flansa Field records
    """
    try:
        from flansa.native_fields import get_table_fields_native
        
        # Get current native fields
        native_result = get_table_fields_native(table_name)
        if not native_result["success"]:
            return {"success": False, "error": native_result["error"]}
        
        native_fields = [f for f in native_result["fields"] if f["created_by_flansa"]]
        
        # Check if any Flansa Field records remain
        remaining_flansa_fields = frappe.db.count("Flansa Field", {"flansa_table": table_name})
        
        verification_result = {
            "table_name": table_name,
            "native_flansa_fields": len(native_fields),
            "remaining_flansa_field_records": remaining_flansa_fields,
            "migration_successful": remaining_flansa_fields == 0 and len(native_fields) > 0,
            "native_fields": native_fields
        }
        
        if verification_result["migration_successful"]:
            verification_result["status"] = "SUCCESS: Migration completed and verified"
        elif remaining_flansa_fields > 0:
            verification_result["status"] = "WARNING: Flansa Field records still exist"
        else:
            verification_result["status"] = "ERROR: No native fields found"
        
        return {
            "success": True,
            "verification": verification_result
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}