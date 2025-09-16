#!/usr/bin/env python3
"""
Fix S3 URL Access for Existing Files
Convert s3:// URLs to proper presigned URLs for immediate access
"""

print("🔧 FIXING S3 URL ACCESS", flush=True)
print("=" * 50, flush=True)

def fix_s3_url_access():
    """Fix S3 URL access for existing files"""
    import frappe

    try:
        print("📋 Step 1: Finding files with s3:// URLs...", flush=True)

        # Find files with s3:// URLs
        s3_files = frappe.get_all("File",
                                 filters=[["file_url", "like", "s3://%"]],
                                 fields=["name", "file_name", "file_url"])

        print(f"Found {len(s3_files)} files with s3:// URLs", flush=True)

        if not s3_files:
            print("✅ No s3:// URLs found to fix", flush=True)
            return True

        print("📋 Step 2: Converting to presigned URLs for immediate access...", flush=True)

        # Import the S3 handler
        from flansa.flansa_core.s3_integration.s3_handler import get_s3_signed_url

        fixed_count = 0
        for file_info in s3_files:
            try:
                print(f"Processing: {file_info.file_name}", flush=True)

                # Generate fresh presigned URL
                presigned_url = get_s3_signed_url(file_info.file_url)

                if presigned_url:
                    # Update with presigned URL for immediate access
                    frappe.db.set_value('File', file_info.name, 'file_url', presigned_url)
                    fixed_count += 1
                    print(f"  ✅ Updated with presigned URL", flush=True)
                else:
                    print(f"  ❌ Failed to generate presigned URL", flush=True)

            except Exception as e:
                print(f"  ❌ Error: {str(e)}", flush=True)

        frappe.db.commit()
        print(f"📋 Step 3: Fixed {fixed_count} files", flush=True)

        print("📋 Step 4: Updating parent record attachment fields...", flush=True)

        # Find and update parent record attachment fields that have s3:// URLs
        updated_records = 0

        # This is a bit complex - we need to check all possible attachment fields
        # For now, let's update known attachment fields

        # Get tables that have attachment fields
        tables = frappe.db.sql("""
            SELECT DISTINCT parent as doctype, fieldname
            FROM `tabDocField`
            WHERE fieldtype = 'Attach'
            AND parent LIKE 'test%'
        """, as_dict=True)

        for table_info in tables:
            try:
                doctype = table_info.doctype
                fieldname = table_info.fieldname

                print(f"Checking {doctype}.{fieldname}...", flush=True)

                # Find records with s3:// URLs in attachment fields
                records_with_s3 = frappe.db.sql(f"""
                    SELECT name, `{fieldname}` as field_value
                    FROM `tab{doctype}`
                    WHERE `{fieldname}` LIKE 's3://%'
                """, as_dict=True)

                for record in records_with_s3:
                    # Generate presigned URL
                    presigned_url = get_s3_signed_url(record.field_value)
                    if presigned_url:
                        frappe.db.set_value(doctype, record.name, fieldname, presigned_url)
                        updated_records += 1
                        print(f"  ✅ Updated {doctype}/{record.name}", flush=True)

            except Exception as e:
                print(f"  ❌ Error with {doctype}: {str(e)}", flush=True)

        frappe.db.commit()
        print(f"Updated {updated_records} parent record fields", flush=True)

        print("🎉 S3 URL access fix completed successfully!", flush=True)
        return True

    except Exception as e:
        print(f"❌ Error in S3 URL fix: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute the fix
try:
    result = fix_s3_url_access()

    if result:
        print("🎉 Fix completed successfully!", flush=True)
    else:
        print("❌ Fix failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)