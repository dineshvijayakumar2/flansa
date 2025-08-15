"""
Demonstrate the proper way to add fields to custom DocTypes in Flansa
"""

import frappe
import json

@frappe.whitelist()
def add_field_to_custom_doctype_properly(doctype_name, field_config):
    """
    The CORRECT way to add fields to custom DocTypes:
    Add them directly to the DocType definition, not as Custom Fields
    """
    
    # Get the DocType document
    doctype = frappe.get_doc("DocType", doctype_name)
    
    # Check if it's a custom DocType
    if not doctype.custom:
        return {"error": "This is a standard DocType, use Custom Fields instead"}
    
    # Add field directly to the DocType's fields
    doctype.append("fields", {
        "fieldname": field_config.get("fieldname"),
        "label": field_config.get("label"),
        "fieldtype": field_config.get("fieldtype"),
        "options": field_config.get("options"),
        "reqd": field_config.get("reqd", 0),
        "read_only": field_config.get("read_only", 0),
        "is_virtual": field_config.get("is_virtual", 0),
        "description": field_config.get("description"),
        "in_list_view": field_config.get("in_list_view", 0),
        "in_standard_filter": field_config.get("in_standard_filter", 0)
    })
    
    # Save the DocType (this will update the database schema)
    doctype.save()
    
    # Clear cache
    frappe.clear_cache(doctype=doctype_name)
    
    return {"success": True, "message": f"Field added to {doctype_name}"}


@frappe.whitelist()
def show_why_custom_fields_fail():
    """
    Demonstrate why Custom Fields fail for custom DocTypes
    """
    
    # Check a Flansa DocType
    doctype_name = "ExpenseTracker_Categories"
    
    if frappe.db.exists("DocType", doctype_name):
        doctype = frappe.get_doc("DocType", doctype_name)
        
        print(f"DocType: {doctype_name}")
        print(f"Is Custom: {doctype.custom}")  # This will be 1 (True)
        print(f"Module: {doctype.module}")
        
        if doctype.custom:
            print("\n❌ This is a CUSTOM DocType")
            print("   - Cannot add Custom Fields through UI")
            print("   - Must add fields directly to DocType definition")
            print("   - Custom Fields are only for STANDARD DocTypes")
        else:
            print("\n✅ This is a STANDARD DocType")
            print("   - Can add Custom Fields through UI")
            print("   - Custom Fields extend standard functionality")
        
        # Show current approach (wrong but works)
        print("\n\nCURRENT APPROACH (Bypasses Validation):")
        print("-" * 50)
        custom_fields = frappe.get_all("Custom Field", 
            filters={"dt": doctype_name},
            fields=["name", "fieldname"])
        
        if custom_fields:
            print(f"Found {len(custom_fields)} Custom Fields (shouldn't exist!):")
            for cf in custom_fields:
                print(f"  - {cf.fieldname}")
            print("\nThese work because created programmatically, bypassing validation")
        
        # Show proper approach
        print("\n\nPROPER APPROACH:")
        print("-" * 50)
        print("Add fields directly to DocType definition:")
        print("  1. Get DocType document")
        print("  2. Append to doctype.fields")
        print("  3. Save DocType")
        print("  4. Fields become part of DocType definition")
        
        return {
            "doctype": doctype_name,
            "is_custom": doctype.custom,
            "custom_fields_count": len(custom_fields),
            "recommendation": "Migrate Custom Fields to DocType fields"
        }


@frappe.whitelist()
def migrate_custom_fields_to_doctype_fields(doctype_name):
    """
    Migrate improperly created Custom Fields to proper DocType fields
    """
    
    if not frappe.db.exists("DocType", doctype_name):
        return {"error": f"DocType {doctype_name} not found"}
    
    doctype = frappe.get_doc("DocType", doctype_name)
    
    if not doctype.custom:
        return {"error": "This is a standard DocType, Custom Fields are appropriate"}
    
    # Get all Custom Fields for this DocType
    custom_fields = frappe.get_all("Custom Field",
        filters={"dt": doctype_name},
        fields=["*"])
    
    if not custom_fields:
        return {"message": "No Custom Fields to migrate"}
    
    migrated = []
    
    for cf in custom_fields:
        # Check if field already exists in DocType
        existing = [f for f in doctype.fields if f.fieldname == cf.fieldname]
        
        if not existing:
            # Add to DocType fields
            doctype.append("fields", {
                "fieldname": cf.fieldname,
                "label": cf.label,
                "fieldtype": cf.fieldtype,
                "options": cf.options,
                "reqd": cf.reqd,
                "read_only": cf.read_only,
                "is_virtual": cf.is_virtual,
                "hidden": cf.hidden,
                "description": cf.description,
                "in_list_view": cf.in_list_view,
                "in_standard_filter": cf.in_standard_filter,
                "depends_on": cf.depends_on,
                "fetch_from": cf.fetch_from,
                "default": cf.default
            })
            
            migrated.append(cf.fieldname)
            
            # Delete the Custom Field
            frappe.delete_doc("Custom Field", cf.name)
    
    if migrated:
        # Save the DocType with new fields
        doctype.save()
        frappe.clear_cache(doctype=doctype_name)
        
        return {
            "success": True,
            "migrated_fields": migrated,
            "message": f"Migrated {len(migrated)} fields from Custom Fields to DocType fields"
        }
    
    return {"message": "No fields needed migration"}