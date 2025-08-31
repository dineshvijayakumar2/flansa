#!/usr/bin/env python3
"""Check if link fields were added correctly"""

import frappe

@frappe.whitelist()
def check_link_fields():
    """Check if link display fields exist"""
    print("🔍 Checking link fields in Flansa Logic Field...", flush=True)
    
    try:
        # Check if fields exist in database
        fields = frappe.db.sql("""
            SELECT fieldname, label, fieldtype, depends_on 
            FROM tabDocField 
            WHERE parent='Flansa Logic Field' 
            AND fieldname LIKE '%link%'
        """, as_dict=1)
        
        print(f"📊 Found {len(fields)} link-related fields:", flush=True)
        for field in fields:
            print(f"  • {field.fieldname}: {field.label} ({field.fieldtype})", flush=True)
            if field.depends_on:
                print(f"    - Depends on: {field.depends_on}", flush=True)
        
        # Check current DocType structure
        doc = frappe.get_doc("DocType", "Flansa Logic Field")
        link_field_names = [f.fieldname for f in doc.fields if 'link' in f.fieldname]
        
        print(f"\n📋 Fields in DocType structure: {link_field_names}", flush=True)
        
        expected_fields = ['link_target_doctype', 'link_display_field', 'link_filters']
        missing_fields = [f for f in expected_fields if f not in link_field_names]
        
        if missing_fields:
            print(f"❌ Missing fields: {missing_fields}", flush=True)
            return False
        else:
            print("✅ All expected link fields are present", flush=True)
            return True
            
    except Exception as e:
        print(f"❌ Error checking fields: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

if __name__ == "__main__":
    check_link_fields()