#!/usr/bin/env python3
"""
Railway Migration Script: Add Missing Naming Fields to Flansa Table
Execute this script on Railway site to add the naming-related fields that are missing
Usage: exec(open('/path/to/this/script.py').read())
"""

import frappe

print("🎯 MIGRATION SCRIPT LOADED SUCCESSFULLY", flush=True)
print("🚀 RAILWAY MIGRATION: ADDING MISSING NAMING FIELDS", flush=True)
print("=" * 55, flush=True)
print(f"📍 Current site: {getattr(frappe.local, 'site', 'Unknown')}", flush=True)
print(f"👤 Current user: {getattr(frappe.session, 'user', 'Unknown')}", flush=True)

def check_current_fields():
    """Check current fields in Flansa Table DocType"""
    
    try:
        print("🔍 Step 1: Checking current Flansa Table fields...", flush=True)
        
        # Get current DocType structure
        doctype_doc = frappe.get_doc("DocType", "Flansa Table")
        current_fields = [field.fieldname for field in doctype_doc.fields]
        
        print(f"✅ Found {len(current_fields)} existing fields", flush=True)
        print(f"Current fields: {', '.join(current_fields[:10])}{'...' if len(current_fields) > 10 else ''}", flush=True)
        
        return current_fields, doctype_doc
        
    except Exception as e:
        print(f"❌ Error checking fields: {str(e)}", flush=True)
        return [], None

def add_missing_fields():
    """Add the missing naming fields to Flansa Table DocType"""
    
    try:
        current_fields, doctype_doc = check_current_fields()
        if not doctype_doc:
            return False
            
        # Define the missing naming fields that need to be added
        naming_fields = [
            {
                'fieldname': 'naming_type',
                'label': 'Naming Type',
                'fieldtype': 'Select',
                'options': 'Auto Number\nField Based\nExpression Based',
                'default': 'Auto Number',
                'idx': 0
            },
            {
                'fieldname': 'naming_prefix',
                'label': 'Naming Prefix',
                'fieldtype': 'Data',
                'depends_on': 'eval:doc.naming_type != "Field Based"',
                'idx': 0
            },
            {
                'fieldname': 'naming_digits',
                'label': 'Number of Digits',
                'fieldtype': 'Int',
                'default': 5,
                'depends_on': 'eval:doc.naming_type == "Auto Number"',
                'idx': 0
            },
            {
                'fieldname': 'naming_start_from',
                'label': 'Start From',
                'fieldtype': 'Int',
                'default': 1,
                'depends_on': 'eval:doc.naming_type == "Auto Number"',
                'idx': 0
            },
            {
                'fieldname': 'naming_field',
                'label': 'Naming Field',
                'fieldtype': 'Link',
                'options': 'Flansa Field',
                'depends_on': 'eval:doc.naming_type == "Field Based"',
                'idx': 0
            },
            {
                'fieldname': 'naming_expression',
                'label': 'Naming Expression',
                'fieldtype': 'Small Text',
                'depends_on': 'eval:doc.naming_type == "Expression Based"',
                'idx': 0
            },
            {
                'fieldname': 'show_gallery',
                'label': 'Show Gallery',
                'fieldtype': 'Check',
                'default': 0,
                'idx': 0
            }
        ]
        
        print("🔍 Step 2: Checking which fields are missing...", flush=True)
        
        # Find which fields are actually missing
        missing_fields = []
        for field_config in naming_fields:
            if field_config['fieldname'] not in current_fields:
                missing_fields.append(field_config)
        
        if not missing_fields:
            print("✅ All naming fields already exist!", flush=True)
            return True
            
        print(f"🔍 Found {len(missing_fields)} missing fields to add:", flush=True)
        for field in missing_fields:
            print(f"   - {field['fieldname']} ({field['fieldtype']})", flush=True)
        
        print("🔍 Step 3: Adding missing fields to DocType...", flush=True)
        
        # Get current max idx for proper ordering
        max_idx = max([field.idx for field in doctype_doc.fields]) if doctype_doc.fields else 0
        
        # Add each missing field
        for i, field_config in enumerate(missing_fields):
            field_config['idx'] = max_idx + i + 1
            
            # Create new field
            new_field = frappe.new_doc("DocField")
            
            # Set field properties
            for key, value in field_config.items():
                setattr(new_field, key, value)
            
            # Add to DocType
            doctype_doc.append("fields", new_field)
            print(f"✅ Added field: {field_config['fieldname']}", flush=True)
        
        print("🔍 Step 4: Saving updated DocType...", flush=True)
        
        # Save the DocType
        doctype_doc.save()
        frappe.db.commit()
        
        print("✅ DocType saved successfully", flush=True)
        
        print("🔍 Step 5: Creating database columns...", flush=True)
        
        # Create actual database columns for the new fields
        for field_config in missing_fields:
            fieldname = field_config['fieldname']
            fieldtype = field_config['fieldtype']
            
            # Determine PostgreSQL column type
            if fieldtype == 'Int':
                pg_type = 'INTEGER'
            elif fieldtype == 'Check':
                pg_type = 'INTEGER DEFAULT 0'
            elif fieldtype == 'Small Text':
                pg_type = 'TEXT'
            else:  # Data, Select, Link
                pg_type = 'VARCHAR(255)'
            
            try:
                # Add column to table
                frappe.db.sql(f'''
                    ALTER TABLE "tabFlansa Table" 
                    ADD COLUMN IF NOT EXISTS {fieldname} {pg_type}
                ''')
                print(f"✅ Created database column: {fieldname}", flush=True)
                
            except Exception as col_error:
                print(f"⚠️  Column creation warning for {fieldname}: {str(col_error)}", flush=True)
        
        frappe.db.commit()
        print("✅ Database columns created", flush=True)
        
        print("🔍 Step 6: Clearing cache...", flush=True)
        frappe.clear_cache(doctype="Flansa Table")
        frappe.clear_document_cache("DocType", "Flansa Table")
        
        return True
        
    except Exception as e:
        frappe.db.rollback()
        print(f"❌ Error adding fields: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

def verify_migration():
    """Verify that the fields were added successfully"""
    
    try:
        print("🔍 Step 7: Verifying migration...", flush=True)
        
        # Check updated DocType
        updated_doctype = frappe.get_doc("DocType", "Flansa Table")
        updated_fields = [field.fieldname for field in updated_doctype.fields]
        
        # Check for naming fields
        naming_field_names = ['naming_type', 'naming_prefix', 'naming_digits', 
                             'naming_start_from', 'naming_field', 'naming_expression', 'show_gallery']
        
        found_naming_fields = [field for field in naming_field_names if field in updated_fields]
        
        print(f"✅ Found {len(found_naming_fields)}/{len(naming_field_names)} naming fields", flush=True)
        print(f"Present naming fields: {', '.join(found_naming_fields)}", flush=True)
        
        # Check database columns
        table_columns = frappe.db.sql("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tabFlansa Table'
            AND column_name IN ('naming_type', 'naming_prefix', 'naming_digits', 
                               'naming_start_from', 'naming_field', 'naming_expression', 'show_gallery')
        """, as_dict=True)
        
        db_naming_fields = [col.column_name for col in table_columns]
        print(f"✅ Found {len(db_naming_fields)} naming columns in database", flush=True)
        
        return len(found_naming_fields) == len(naming_field_names)
        
    except Exception as e:
        print(f"❌ Error verifying migration: {str(e)}", flush=True)
        return False

def main():
    """Main migration function"""
    
    try:
        print("🎯 Starting Flansa Table naming fields migration...", flush=True)
        print(f"🔍 Current user: {frappe.session.user}", flush=True)
        print(f"🔍 Site: {frappe.local.site}", flush=True)
        print(f"🔍 Developer mode: {frappe.conf.get('developer_mode', 0)}", flush=True)
        
        if not frappe.conf.get('developer_mode'):
            print("❌ Developer mode is not enabled! Migration may fail.", flush=True)
            print("Enable developer mode first and restart the app.", flush=True)
            return False
        
        # Add missing fields
        if not add_missing_fields():
            print("❌ Migration failed at field addition step", flush=True)
            return False
        
        # Verify migration
        if not verify_migration():
            print("⚠️  Migration completed but verification failed", flush=True)
            return False
        
        print("🎉 MIGRATION COMPLETED SUCCESSFULLY!", flush=True)
        print("✅ All naming fields added to Flansa Table", flush=True)
        print("✅ Database columns created", flush=True)
        print("✅ Table Builder features should now work", flush=True)
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return False

# Execute the migration immediately (for exec() usage)
print("🎬 SCRIPT STARTED - Executing migration...", flush=True)
try:
    result = main()
    if result:
        print("🚀 Railway naming fields migration completed successfully!", flush=True)
    else:
        print("💥 Railway naming fields migration failed - check logs above", flush=True)
except Exception as script_error:
    print(f"💀 SCRIPT EXECUTION ERROR: {str(script_error)}", flush=True)
    import traceback
    print(f"🔍 Script traceback: {traceback.format_exc()}", flush=True)

print("🏁 SCRIPT FINISHED", flush=True)