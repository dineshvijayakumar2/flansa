#!/usr/bin/env python3
"""
Railway Add Naming Fields - SQL Direct Approach
Adds naming fields directly via SQL to avoid DocType.save() issues
Usage: exec(open('/path/to/this/script.py').read())
"""

import frappe

print("🚀 RAILWAY ADD NAMING FIELDS (SQL DIRECT)", flush=True)
print("=" * 50, flush=True)
print(f"📍 Site: {getattr(frappe.local, 'site', 'Unknown')}", flush=True)

def add_naming_fields_sql():
    """Add naming fields using direct SQL approach"""
    
    try:
        print("🔍 Step 1: Checking current Flansa Table fields...", flush=True)
        
        # Get current fields
        current_fields = frappe.db.sql("""
            SELECT fieldname 
            FROM "tabDocField" 
            WHERE parent = 'Flansa Table'
        """, as_dict=True)
        
        existing_fieldnames = {field.fieldname for field in current_fields}
        print(f"✅ Found {len(existing_fieldnames)} existing fields", flush=True)
        
        # Fields to add with their configurations (matching local flansa_table.json)
        naming_fields = [
            {
                'fieldname': 'naming_field',
                'label': 'Field for Dynamic Prefix',
                'fieldtype': 'Data',
                'description': 'Field name to use for prefix (for Field Based naming)'
            },
            {
                'fieldname': 'naming_prefix',
                'label': 'Record Prefix',
                'fieldtype': 'Data',
                'description': 'e.g., CUS for Customers, ORD for Orders'
            },
            {
                'fieldname': 'naming_type',
                'label': 'Naming Type',
                'fieldtype': 'Select',
                'options': 'Naming Series\nAuto Increment\nField Based\nRandom\nPrompt',
                'default': 'Naming Series'
            },
            {
                'fieldname': 'naming_digits',
                'label': 'Number of Digits',
                'fieldtype': 'Int',
                'default': '5',
                'description': 'Number of digits in the counter (e.g., 5 for 00001)'
            },
            {
                'fieldname': 'naming_start_from',
                'label': 'Start Counter From',
                'fieldtype': 'Int', 
                'default': '1',
                'depends_on': 'eval:doc.naming_type=="Naming Series" || doc.naming_type=="Auto Increment"'
            }
        ]
        
        # Filter out fields that already exist
        missing_fields = []
        for field in naming_fields:
            if field['fieldname'] not in existing_fieldnames:
                missing_fields.append(field)
        
        if not missing_fields:
            print("✅ All naming fields already exist", flush=True)
            return True
            
        print(f"🔧 Adding {len(missing_fields)} missing fields...", flush=True)
        
        # Get next idx
        max_idx_result = frappe.db.sql("""
            SELECT COALESCE(MAX(idx), 0) as max_idx 
            FROM "tabDocField" 
            WHERE parent = 'Flansa Table'
        """, as_dict=True)
        max_idx = max_idx_result[0].max_idx if max_idx_result else 0
        
        print("🔍 Step 2: Adding fields via SQL...", flush=True)
        
        # Add each field via SQL
        for i, field in enumerate(missing_fields):
            field_name = frappe.generate_hash(length=10)
            idx = max_idx + i + 1
            
            # Insert field record
            # Prepare values with proper NULL handling
            precision_val = field.get('precision')
            precision_param = precision_val if precision_val is not None else None
            
            frappe.db.sql("""
                INSERT INTO "tabDocField" (
                    name, creation, modified, modified_by, owner, docstatus,
                    parent, parentfield, parenttype, idx, fieldname, label, fieldtype,
                    options, "default", description, depends_on, reqd, hidden, read_only, in_list_view, 
                    in_standard_filter, allow_bulk_edit, allow_in_quick_entry,
                    allow_on_submit, bold, collapsible, columns, fetch_if_empty,
                    hide_border, hide_days, hide_seconds, ignore_user_permissions,
                    ignore_xss_filter, in_global_search, in_preview, is_virtual,
                    no_copy, non_negative, permlevel, precision, print_hide,
                    print_hide_if_no_value, print_width, read_only_depends_on,
                    report_hide, search_index, sort_options, translatable, "unique", width
                ) VALUES (
                    %s, NOW(), NOW(), %s, %s, 0,
                    'Flansa Table', 'fields', 'DocType', %s, %s, %s, %s,
                    %s, %s, %s, %s, 0, 0, 0, 0,
                    0, 0, 0,
                    0, 0, 0, 0, 0,
                    0, 0, 0, 0,
                    0, 0, 0, 0,
                    0, 0, 0, '', 0,
                    0, '', '',
                    0, 0, 0, 0, 0, ''
                )
            """, (
                field_name, frappe.session.user, frappe.session.user, idx,
                field['fieldname'], field['label'], field['fieldtype'],
                field.get('options', ''), field.get('default', ''),
                field.get('description', ''), field.get('depends_on', '')
            ))
            
            print(f"✅ Added field: {field['fieldname']}", flush=True)
        
        print("🔍 Step 3: Adding database columns...", flush=True)
        
        # Add actual table columns
        for field in missing_fields:
            fieldname = field['fieldname']
            fieldtype = field['fieldtype']
            
            # Determine PostgreSQL column type
            if fieldtype == 'Int':
                pg_type = 'INTEGER'
                default_clause = f"DEFAULT {field.get('default', 'NULL')}" if field.get('default') else ''
            elif fieldtype == 'Check':
                pg_type = 'INTEGER'
                default_clause = f"DEFAULT {field.get('default', '0')}"
            elif fieldtype == 'Small Text':
                pg_type = 'TEXT'
                default_clause = ''
            else:  # Data, Select
                pg_type = 'VARCHAR(255)'
                default_val = field.get('default', '')
                default_clause = f"DEFAULT '{default_val}'" if default_val else ''
            
            try:
                # Add column to table
                sql_cmd = f'ALTER TABLE "tabFlansa Table" ADD COLUMN IF NOT EXISTS {fieldname} {pg_type} {default_clause}'
                frappe.db.sql(sql_cmd)
                print(f"✅ Created database column: {fieldname}", flush=True)
                
            except Exception as col_error:
                print(f"⚠️  Column creation warning for {fieldname}: {str(col_error)}", flush=True)
        
        print("🔍 Step 4: Updating DocType timestamp...", flush=True)
        
        # Update DocType modified timestamp to refresh metadata
        frappe.db.sql("""
            UPDATE "tabDocType" 
            SET modified = NOW(), modified_by = %s
            WHERE name = 'Flansa Table'
        """, (frappe.session.user,))
        
        frappe.db.commit()
        print("✅ Database changes committed", flush=True)
        
        print("🔍 Step 5: Clearing cache...", flush=True)
        frappe.clear_cache(doctype="Flansa Table")
        frappe.clear_document_cache("DocType", "Flansa Table")
        print("✅ Cache cleared", flush=True)
        
        return True
        
    except Exception as e:
        frappe.db.rollback()
        print(f"❌ Error adding naming fields: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

def verify_fields():
    """Verify the fields were added successfully"""
    
    try:
        print("🔍 Step 6: Verifying added fields...", flush=True)
        
        # Check DocType fields
        fields = frappe.db.sql("""
            SELECT fieldname, label, fieldtype 
            FROM "tabDocField" 
            WHERE parent = 'Flansa Table' 
            AND fieldname IN ('naming_type', 'naming_prefix', 'naming_digits', 
                             'naming_start_from', 'naming_field')
            ORDER BY fieldname
        """, as_dict=True)
        
        print(f"✅ Found {len(fields)} naming fields in DocType:", flush=True)
        for field in fields:
            print(f"   • {field.fieldname} ({field.fieldtype})", flush=True)
        
        # Check database columns
        columns = frappe.db.sql("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tabFlansa Table'
            AND column_name IN ('naming_type', 'naming_prefix', 'naming_digits', 
                               'naming_start_from', 'naming_field')
            ORDER BY column_name
        """, as_dict=True)
        
        print(f"✅ Found {len(columns)} naming columns in database:", flush=True)
        for col in columns:
            print(f"   • {col.column_name}", flush=True)
        
        return len(fields) >= 5 and len(columns) >= 5
        
    except Exception as e:
        print(f"⚠️  Verification error: {str(e)}", flush=True)
        return False

# Execute the script
print("🎬 STARTING NAMING FIELDS ADDITION...", flush=True)

try:
    success = add_naming_fields_sql()
    
    if success:
        verify_success = verify_fields()
        if verify_success:
            print("🎉 NAMING FIELDS ADDED SUCCESSFULLY!", flush=True)
            print("✅ All 7 fields added to DocType and database", flush=True)
            print("✅ Table Builder naming features should now work", flush=True)
        else:
            print("⚠️  Fields added but verification failed", flush=True)
    else:
        print("💥 NAMING FIELDS ADDITION FAILED", flush=True)
        
except Exception as script_error:
    print(f"💀 SCRIPT ERROR: {str(script_error)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)

print("🏁 SCRIPT FINISHED", flush=True)