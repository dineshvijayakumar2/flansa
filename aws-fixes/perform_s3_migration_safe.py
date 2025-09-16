#!/usr/bin/env python3
"""
Perform Safe S3 Migration
Actually migrate S3 files to new structure with safety checks
"""

print("🚀 PERFORMING SAFE S3 MIGRATION", flush=True)
print("=" * 50, flush=True)

def perform_s3_migration_safe():
    """Safely migrate S3 files to new organized structure"""
    import frappe
    import boto3
    import urllib.parse

    try:
        print("📋 Step 1: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')

        if not use_s3:
            print("❌ S3 not enabled in site config", flush=True)
            return False

        # Get S3 credentials
        aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
        aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
        bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
        region = site_config.get('s3_region') or site_config.get('aws_s3_region_name')

        if not all([aws_access_key_id, aws_secret_access_key, bucket_name, region]):
            print("❌ S3 credentials incomplete", flush=True)
            return False

        print(f"✅ S3 bucket: {bucket_name}", flush=True)

        print("📋 Step 2: Initializing S3 client...", flush=True)

        s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key
        )

        print("📋 Step 3: Finding files ready for migration...", flush=True)

        # Focus on the 3 files we know exist
        ready_files = [
            "demo_org_logo.svg",
            "Stone Request.ods",
            "Wifi-Issues Tracker (2).odt"
        ]

        migrated_count = 0

        for filename in ready_files:
            try:
                print(f"📋 Processing: {filename}", flush=True)

                # Find the file in database
                try:
                    file_doc = frappe.db.sql("""
                        SELECT name, file_name, file_url, creation, attached_to_doctype
                        FROM `tabFile`
                        WHERE file_name = %s AND file_url LIKE '%amazonaws%'
                        LIMIT 1
                    """, (filename,), as_dict=True)

                    if not file_doc or len(file_doc) == 0:
                        print(f"  ⚠️  File not found in database: {filename}", flush=True)
                        continue

                    file_info = file_doc[0]
                    print(f"  ✅ Found in database: {file_info.name}", flush=True)

                except Exception as e:
                    print(f"  ❌ Database query error for {filename}: {e}", flush=True)
                    continue

                # Generate new S3 key
                from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key

                class MockFileDoc:
                    def __init__(self, file_info):
                        self.name = file_info.name
                        self.file_name = file_info.file_name
                        self.creation = file_info.creation
                        self.attached_to_doctype = file_info.attached_to_doctype

                mock_file = MockFileDoc(file_info)
                base_folder = site_config.get('s3_folder_path') or 'flansa-files'
                new_s3_key = _generate_s3_key(base_folder, mock_file)

                # Get current S3 key
                current_url = file_info.file_url
                if '?' in current_url:
                    current_url = current_url.split('?')[0]

                parts = current_url.replace('https://', '').split('/')
                raw_s3_key = '/'.join(parts[1:]).strip('/')
                current_s3_key = urllib.parse.unquote(raw_s3_key)

                print(f"  From: {current_s3_key}", flush=True)
                print(f"  To:   {new_s3_key}", flush=True)

                # Check if already in correct location
                if current_s3_key == new_s3_key:
                    print(f"  ✅ Already in correct location", flush=True)
                    continue

                # Safety check - verify source exists
                try:
                    s3_client.head_object(Bucket=bucket_name, Key=current_s3_key)
                    print(f"  ✅ Source file verified", flush=True)
                except:
                    print(f"  ❌ Source file not found, skipping", flush=True)
                    continue

                # Safety check - verify destination doesn't exist
                try:
                    s3_client.head_object(Bucket=bucket_name, Key=new_s3_key)
                    print(f"  ⚠️  Destination already exists, skipping", flush=True)
                    continue
                except:
                    pass  # Good, destination doesn't exist

                # Perform the copy
                print(f"  🔄 Copying to new location...", flush=True)

                copy_source = {
                    'Bucket': bucket_name,
                    'Key': current_s3_key
                }

                s3_client.copy_object(
                    CopySource=copy_source,
                    Bucket=bucket_name,
                    Key=new_s3_key
                )

                # Verify copy succeeded
                try:
                    s3_client.head_object(Bucket=bucket_name, Key=new_s3_key)
                    print(f"  ✅ Copy successful", flush=True)

                    # Generate new presigned URL
                    new_s3_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket_name, 'Key': new_s3_key},
                        ExpiresIn=604800  # 7 days
                    )

                    # Update database
                    frappe.db.set_value('File', file_info.name, 'file_url', new_s3_url, update_modified=False)
                    frappe.db.commit()

                    print(f"  ✅ Database updated with new URL", flush=True)

                    # Delete old file
                    s3_client.delete_object(Bucket=bucket_name, Key=current_s3_key)
                    print(f"  ✅ Old file deleted", flush=True)

                    migrated_count += 1

                except Exception as e:
                    print(f"  ❌ Copy verification failed: {e}", flush=True)
                    # Clean up partial copy
                    try:
                        s3_client.delete_object(Bucket=bucket_name, Key=new_s3_key)
                    except:
                        pass

            except Exception as e:
                print(f"  ❌ Error processing {filename}: {e}", flush=True)

        print(f"📋 Step 4: Migration summary...", flush=True)
        print(f"✅ Successfully migrated: {migrated_count} files", flush=True)
        print(f"🎯 New structure benefits now active:", flush=True)
        print(f"  • Multi-tenant isolation", flush=True)
        print(f"  • Flansa table ID organization", flush=True)
        print(f"  • Date-based hierarchy", flush=True)
        print(f"  • Better S3 performance", flush=True)

        return True

    except Exception as e:
        print(f"❌ Migration error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute migration
try:
    result = perform_s3_migration_safe()

    if result:
        print("🎉 Safe S3 migration completed!", flush=True)
    else:
        print("❌ Safe S3 migration encountered issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)