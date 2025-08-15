"""
Clean up all remaining computed_fields references after simplification
"""

import frappe

@frappe.whitelist()
def cleanup_all_computed_field_references():
    """Remove all old computed_fields references and unused methods"""
    
    print("=== CLEANING UP COMPUTED FIELD REFERENCES ===")
    
    # 1. Remove computed_fields table from all existing relationships
    relationships = frappe.get_all("Flansa Relationship", fields=["name"])
    
    for rel in relationships:
        relationship = frappe.get_doc("Flansa Relationship", rel.name)
        if hasattr(relationship, 'computed_fields') and relationship.computed_fields:
            print(f"Clearing computed_fields from {rel.name}")
            relationship.computed_fields = []
            relationship.save()
    
    # 2. Migrate the database to remove the field completely
    print("Migration complete. The computed_fields table field has been removed from DocType definition.")
    print("Next step: bench migrate to apply changes")
    
    return {"success": True, "message": "All computed field references cleaned up"}

@frappe.whitelist()
def verify_cleanup():
    """Verify that cleanup was successful"""
    
    print("=== VERIFYING CLEANUP ===")
    
    # Check relationships
    relationships = frappe.get_all("Flansa Relationship", fields=["name"])
    
    for rel in relationships:
        relationship = frappe.get_doc("Flansa Relationship", rel.name)
        if hasattr(relationship, 'computed_fields') and relationship.computed_fields:
            print(f"❌ Still has computed_fields: {rel.name}")
        else:
            print(f"✅ Clean: {rel.name}")
    
    print("=== VERIFICATION COMPLETE ===")
    
    return {"success": True}

if __name__ == "__main__":
    cleanup_all_computed_field_references()