"""
Native Field Sync Utilities - Replacement for auto_sync.py
Eliminates complex multi-layer synchronization by using native DocType fields directly
Provides backward compatibility during transition period
"""

import frappe
import json
from frappe.utils import now

# ==============================================================================
# NATIVE FIELD SYNC FUNCTIONS (REPLACEMENT FOR COMPLEX SYNC)
# ==============================================================================

def sync_table_to_native_fields(doc, method):
    """
    NATIVE REPLACEMENT: Convert Flansa Table changes to native DocType fields
    Replaces: sync_table_to_fields() - eliminates Flansa Field intermediate storage
    """
    try:
        # Skip if table doesn't have generated DocType
        if not doc.doctype_name:
            return
        
        # Skip during migration to avoid conflicts
        if hasattr(doc, 'flags') and doc.flags.get('ignore_hooks'):
            return
        
        # Get fields from JSON storage (temporary during migration)
        fields_data = []
        if doc.fields_json:
            try:
                fields_data = json.loads(doc.fields_json)
            except json.JSONDecodeError:
                frappe.logger().warning(f"Invalid JSON in fields_json for table {doc.name}")
                return
        
        if not fields_data:
            return
        
        # Use native field management
        from flansa.native_fields import sync_json_to_native_fields
        result = sync_json_to_native_fields(doc.name, fields_data)
        
        if result.get("success"):
            frappe.logger().info(f"Native sync successful for table {doc.name}: {result['synced_count']} fields")
        else:
            frappe.log_error(f"Native sync failed for table {doc.name}: {result.get('error')}", "Native Sync")
    
    except Exception as e:
        frappe.log_error(f"Error in native table sync: {str(e)}", "Native Table Sync")

@frappe.whitelist()
def migrate_table_sync_to_native(table_id):
    """
    MIGRATION HELPER: Convert table from Flansa Field sync to native field management
    This replaces bulk_sync_table() after migration
    """
    try:
        from flansa.migration import complete_table_migration
        
        # Perform complete migration to native fields
        result = complete_table_migration(table_id)
        
        if result.get("success"):
            frappe.logger().info(f"Successfully migrated table {table_id} to native field management")
            return {
                "success": True,
                "message": f"Table {table_id} migrated to native field management",
                "details": result
            }
        else:
            return {
                "success": False,
                "error": f"Migration failed for table {table_id}",
                "details": result
            }
    
    except Exception as e:
        frappe.log_error(f"Error migrating table sync: {str(e)}", "Native Migration")
        return {"success": False, "error": str(e)}

# ==============================================================================
# BACKWARD COMPATIBILITY FUNCTIONS (FOR TRANSITION PERIOD)
# ==============================================================================

@frappe.whitelist()
def bulk_sync_table(table_id):
    """
    BACKWARD COMPATIBILITY: Wrapper that checks if table is migrated
    If migrated: Use native field management
    If not migrated: Fall back to legacy sync
    """
    try:
        # Check if table has been migrated to native fields
        if is_table_migrated_to_native(table_id):
            # Use native field refresh
            from flansa.native_fields import refresh_native_fields
            return refresh_native_fields(table_id)
        else:
            # Fall back to legacy sync (import from original auto_sync.py)
            from flansa.flansa_core.utils.auto_sync import bulk_sync_table as legacy_bulk_sync
            return legacy_bulk_sync(table_id)
    
    except Exception as e:
        frappe.log_error(f"Error in bulk sync wrapper: {str(e)}", "Bulk Sync Wrapper")
        return {"success": False, "error": str(e)}

def sync_field_to_json(doc, method):
    """
    BACKWARD COMPATIBILITY: Handle Flansa Field changes
    If table migrated: Update native DocType field
    If not migrated: Fall back to JSON sync
    """
    try:
        if not hasattr(doc, 'flansa_table') or not doc.flansa_table:
            return
        
        table_id = doc.flansa_table
        
        # Check if table has been migrated
        if is_table_migrated_to_native(table_id):
            # Update native DocType field
            from flansa.native_fields import update_native_field_from_flansa_field
            result = update_native_field_from_flansa_field(table_id, doc)
            if not result.get("success"):
                frappe.log_error(f"Failed to update native field: {result.get('error')}", "Native Field Update")
        else:
            # Fall back to legacy JSON sync
            from flansa.flansa_core.utils.auto_sync import sync_field_to_json as legacy_sync
            legacy_sync(doc, method)
    
    except Exception as e:
        frappe.log_error(f"Error in field sync wrapper: {str(e)}", "Field Sync Wrapper")

def sync_field_deletion(doc, method):
    """
    BACKWARD COMPATIBILITY: Handle Flansa Field deletion
    If table migrated: Remove from DocType
    If not migrated: Remove from JSON
    """
    try:
        if not hasattr(doc, 'flansa_table') or not doc.flansa_table:
            return
        
        table_id = doc.flansa_table
        field_name = getattr(doc, 'field_name', '')
        
        # Check if table has been migrated
        if is_table_migrated_to_native(table_id):
            # Remove from DocType
            from flansa.native_fields import delete_field_native
            result = delete_field_native(table_id, field_name)
            if not result.get("success"):
                frappe.log_error(f"Failed to delete native field: {result.get('error')}", "Native Field Delete")
        else:
            # Fall back to legacy JSON removal
            from flansa.flansa_core.utils.auto_sync import sync_field_deletion as legacy_deletion
            legacy_deletion(doc, method)
    
    except Exception as e:
        frappe.log_error(f"Error in field deletion wrapper: {str(e)}", "Field Deletion Wrapper")

# ==============================================================================
# NATIVE FIELD MANAGEMENT HELPERS
# ==============================================================================

def is_table_migrated_to_native(table_id):
    """Check if a table has been migrated to native field management"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_id)
        
        # Check if table has migration marker
        if hasattr(table_doc, 'native_field_management') and table_doc.native_field_management:
            return True
        
        # Alternative check: Look for Flansa Field records
        flansa_field_count = frappe.db.count("Flansa Field", {"flansa_table": table_id})
        
        # If no Flansa Field records but DocType exists, likely migrated
        if flansa_field_count == 0 and table_doc.doctype_name:
            # Check if DocType has Flansa-created fields
            from flansa.native_fields import get_table_fields_native
            native_result = get_table_fields_native(table_id)
            
            if native_result.get("success"):
                flansa_fields = [f for f in native_result["fields"] if f.get("created_by_flansa")]
                return len(flansa_fields) > 0
        
        return False
    
    except Exception as e:
        frappe.log_error(f"Error checking migration status: {str(e)}", "Migration Check")
        return False

@frappe.whitelist()
def mark_table_as_migrated(table_id):
    """Mark a table as migrated to native field management"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_id)
        table_doc.flags.ignore_hooks = True
        
        # Add migration marker (if custom field exists)
        if hasattr(table_doc, 'native_field_management'):
            table_doc.native_field_management = 1
        
        # Add migration metadata to description
        migration_info = {
            "migrated_to_native": True,
            "migration_date": now(),
            "migration_version": "2.0"
        }
        
        current_description = table_doc.description or ""
        if "migration_info" not in current_description:
            table_doc.description = f"{current_description}\nMigration Info: {json.dumps(migration_info)}"
        
        table_doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        return {"success": True, "message": f"Table {table_id} marked as migrated"}
    
    except Exception as e:
        frappe.log_error(f"Error marking table as migrated: {str(e)}", "Migration Marker")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_migration_status_report():
    """Get comprehensive migration status for all tables"""
    try:
        all_tables = frappe.get_all("Flansa Table", fields=["name", "table_name", "doctype_name"])
        
        report = {
            "total_tables": len(all_tables),
            "migrated_tables": 0,
            "pending_migration": 0,
            "tables_detail": []
        }
        
        for table in all_tables:
            is_migrated = is_table_migrated_to_native(table["name"])
            flansa_field_count = frappe.db.count("Flansa Field", {"flansa_table": table["name"]})
            
            table_status = {
                "table_id": table["name"],
                "table_name": table["table_name"],
                "doctype_name": table["doctype_name"],
                "is_migrated": is_migrated,
                "flansa_field_count": flansa_field_count,
                "status": "migrated" if is_migrated else "pending_migration"
            }
            
            report["tables_detail"].append(table_status)
            
            if is_migrated:
                report["migrated_tables"] += 1
            else:
                report["pending_migration"] += 1
        
        return {
            "success": True,
            "migration_report": report
        }
    
    except Exception as e:
        frappe.log_error(f"Error generating migration report: {str(e)}", "Migration Report")
        return {"success": False, "error": str(e)}

# ==============================================================================
# CLEANUP FUNCTIONS
# ==============================================================================

@frappe.whitelist()
def cleanup_duplicate_field_records(table_id):
    """
    ENHANCED: Clean up duplicate records and check migration status
    """
    try:
        # If table is migrated, Flansa Fields should not exist
        if is_table_migrated_to_native(table_id):
            remaining_fields = frappe.db.count("Flansa Field", {"flansa_table": table_id})
            if remaining_fields > 0:
                frappe.logger().warning(f"Found {remaining_fields} Flansa Field records for migrated table {table_id}")
                # Optionally auto-cleanup
                cleanup_result = frappe.db.sql("DELETE FROM `tabFlansa Field` WHERE flansa_table = %s", (table_id,))
                frappe.db.commit()
                return {
                    "success": True,
                    "message": f"Cleaned up {remaining_fields} obsolete Flansa Field records for migrated table",
                    "removed": remaining_fields
                }
        
        # For non-migrated tables, use legacy cleanup
        from flansa.flansa_core.utils.auto_sync import cleanup_duplicate_field_records as legacy_cleanup
        return legacy_cleanup(table_id)
    
    except Exception as e:
        frappe.log_error(f"Error in cleanup: {str(e)}", "Cleanup")
        return {"success": False, "error": str(e)}

# ==============================================================================
# TRANSITION HELPER FUNCTIONS
# ==============================================================================

@frappe.whitelist()
def transition_all_tables_to_native():
    """
    ADMIN FUNCTION: Transition all tables to native field management
    This is the main function for complete migration
    """
    try:
        from flansa.migration import migrate_all_tables
        
        # Use comprehensive migration function
        result = migrate_all_tables()
        
        if result.get("success"):
            # Mark all successfully migrated tables
            migrated_count = 0
            for table_result in result["overall_results"]["table_results"]:
                if table_result.get("success"):
                    table_name = table_result.get("table_name") or table_result.get("summary", {}).get("table_id")
                    if table_name:
                        mark_table_as_migrated(table_name)
                        migrated_count += 1
            
            return {
                "success": True,
                "message": f"Successfully transitioned {migrated_count} tables to native field management",
                "details": result
            }
        else:
            return {
                "success": False,
                "error": "Migration failed",
                "details": result
            }
    
    except Exception as e:
        frappe.log_error(f"Error in transition to native: {str(e)}", "Native Transition")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def verify_native_transition():
    """
    VERIFICATION: Ensure all tables have been properly transitioned
    """
    try:
        migration_report = get_migration_status_report()
        
        if not migration_report.get("success"):
            return migration_report
        
        report = migration_report["migration_report"]
        
        verification_result = {
            "transition_complete": report["pending_migration"] == 0,
            "total_tables": report["total_tables"],
            "migrated_tables": report["migrated_tables"],
            "pending_tables": report["pending_migration"],
            "issues": []
        }
        
        # Check for issues
        for table in report["tables_detail"]:
            if not table["is_migrated"] and table["flansa_field_count"] > 0:
                verification_result["issues"].append({
                    "table": table["table_name"],
                    "issue": f"Has {table['flansa_field_count']} unmigrated Flansa Fields"
                })
        
        if verification_result["transition_complete"]:
            verification_result["status"] = "SUCCESS: All tables migrated to native field management"
        else:
            verification_result["status"] = f"PENDING: {verification_result['pending_tables']} tables still need migration"
        
        return {
            "success": True,
            "verification": verification_result
        }
    
    except Exception as e:
        frappe.log_error(f"Error in verification: {str(e)}", "Native Verification")
        return {"success": False, "error": str(e)}