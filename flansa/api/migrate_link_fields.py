#!/usr/bin/env python3
"""
Add display_field configuration to Flansa Logic Field for link fields
"""

import frappe

@frappe.whitelist()
def add_display_field_to_logic_field():
    """Add display_field to Flansa Logic Field DocType"""
    print("🔧 Adding display_field to Flansa Logic Field...", flush=True)
    
    try:
        # Check if the field already exists
        doctype_name = "Flansa Logic Field"
        
        if not frappe.db.exists("DocType", doctype_name):
            print(f"❌ DocType {doctype_name} not found", flush=True)
            return False
            
        # Check if field already exists
        if frappe.db.exists("DocField", {"parent": doctype_name, "fieldname": "link_display_field"}):
            print("⚠️ Field link_display_field already exists", flush=True)
            return True
            
        # Get the DocType
        doc = frappe.get_doc("DocType", doctype_name)
        
        # Find the position to insert after logic_expression
        insert_after_idx = None
        for idx, field in enumerate(doc.fields):
            if field.fieldname == "logic_expression":
                insert_after_idx = idx + 1
                break
                
        if insert_after_idx is None:
            insert_after_idx = len(doc.fields)
            
        # Add new fields for link configuration  
        new_fields = [
            {
                "fieldname": "link_target_doctype",
                "fieldtype": "Data", 
                "label": "Link Target Table",
                "description": "The target table for link fields",
                "depends_on": "eval:doc.logic_type=='link'",
                "idx": insert_after_idx
            },
            {
                "fieldname": "link_display_field",
                "fieldtype": "Data",
                "label": "Display Field", 
                "description": "Field from linked table to show in dropdown (e.g., title, name, label)",
                "depends_on": "eval:doc.logic_type=='link'",
                "idx": insert_after_idx + 1
            },
            {
                "fieldname": "link_filters",
                "fieldtype": "Code",
                "label": "Link Filters",
                "description": "JSON filters to apply when fetching link options",
                "depends_on": "eval:doc.logic_type=='link'", 
                "options": "JSON",
                "idx": insert_after_idx + 2
            }
        ]
        
        # Add fields to DocType
        for field_def in new_fields:
            # Create DocField  
            field = frappe.get_doc({
                "doctype": "DocField",
                "parent": doctype_name,
                "parenttype": "DocType", 
                "parentfield": "fields",
                **field_def
            })
            
            # Insert into fields list
            doc.fields.insert(field_def["idx"], field)
            print(f"✅ Added field: {field_def['fieldname']}", flush=True)
        
        # Update field_order - accessing from meta as it's stored in JSON
        if hasattr(doc, 'field_order') and doc.field_order:
            field_order = doc.field_order[:]
        else:
            # Build from existing fields if field_order doesn't exist
            field_order = [f.fieldname for f in doc.fields if f.fieldname]
        
        logic_expr_idx = field_order.index("logic_expression") if "logic_expression" in field_order else len(field_order)
        
        # Insert new field names after logic_expression  
        for i, field_def in enumerate(new_fields):
            field_order.insert(logic_expr_idx + 1 + i, field_def["fieldname"])
        
        # Set the updated field order
        doc.set("field_order", field_order)
        print(f"✅ Updated field_order with {len(new_fields)} new fields", flush=True)
        
        # Save the DocType
        doc.save()
        frappe.db.commit()
        
        print("✅ Successfully added link display configuration fields", flush=True)
        
        # Clear cache
        frappe.clear_cache(doctype=doctype_name)
        
        return True
        
    except Exception as e:
        print(f"❌ Error adding display_field: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        frappe.db.rollback()
        return False

def main():
    """Main execution function"""
    print("=" * 50, flush=True)
    print("🎯 LINK FIELD DISPLAY CONFIGURATION", flush=True)
    print("=" * 50, flush=True)
    
    # Step 1: Add display field configuration
    if not add_display_field_to_logic_field():
        print("❌ Failed to add display field configuration", flush=True)
        return False
        
    print("\n🎉 Link field display configuration completed!", flush=True)
    print("\n📝 Next Steps:", flush=True)
    print("1. Update Table Builder to show display field option for link fields", flush=True)
    print("2. Update Record Viewer to use display field in dropdowns", flush=True)
    print("3. Update Form Builder to allow display field configuration", flush=True)
    
    return True

if __name__ == "__main__":
    main()