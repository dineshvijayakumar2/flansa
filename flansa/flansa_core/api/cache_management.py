"""
Cache Management API for Flansa
Handles aggressive cache clearing for field operations
"""

import frappe

@frappe.whitelist()
def force_clear_all_cache(doctype_name=None):
    """
    Force clear all caches - use after field operations
    Returns cache clearing info for debugging
    """
    try:
        cleared_caches = []
        
        # Clear Frappe's global cache
        frappe.clear_cache()
        cleared_caches.append("global_frappe_cache")
        
        # Clear specific DocType cache if provided
        if doctype_name:
            frappe.clear_cache(doctype=doctype_name)
            cleared_caches.append(f"doctype_cache_{doctype_name}")
            
            # Clear model cache
            if hasattr(frappe, 'model') and hasattr(frappe.model, 'clear_cache'):
                frappe.model.clear_cache(doctype_name)
                cleared_caches.append(f"model_cache_{doctype_name}")
            
            # Clear boot cache
            if hasattr(frappe, 'boot') and frappe.boot.get('docs'):
                frappe.boot.docs.pop(doctype_name, None)
                cleared_caches.append(f"boot_cache_{doctype_name}")
        
        # Force reload meta for all tables
        tables = frappe.get_all("Flansa Table", fields=["doctype_name"])
        for table in tables:
            if table.doctype_name:
                try:
                    frappe.clear_cache(doctype=table.doctype_name)
                    if hasattr(frappe, 'model') and hasattr(frappe.model, 'clear_cache'):
                        frappe.model.clear_cache(table.doctype_name)
                    cleared_caches.append(f"table_cache_{table.doctype_name}")
                except:
                    pass
        
        # Commit any pending database changes
        frappe.db.commit()
        
        return {
            "success": True,
            "cleared_caches": cleared_caches,
            "total_cleared": len(cleared_caches),
            "message": "All caches cleared successfully"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "cleared_caches": cleared_caches if 'cleared_caches' in locals() else []
        }

@frappe.whitelist()
def get_fresh_field_data(table_name):
    """
    Get completely fresh field data with cache bypass
    Use this after field operations to ensure data is current
    """
    try:
        # Force clear cache for this table first
        table_doc = frappe.get_doc("Flansa Table", table_name)
        if table_doc.doctype_name:
            force_clear_all_cache(table_doc.doctype_name)
        
        # Get fresh field data
        from flansa.native_fields import get_table_fields_native
        result = get_table_fields_native(table_name)
        
        if result.get("success"):
            # Add cache clearing info
            result["cache_cleared"] = True
            result["timestamp"] = frappe.utils.now()
            
        return result
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "cache_cleared": False
        }