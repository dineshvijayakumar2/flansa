#!/usr/bin/env python3
"""
Migrate All S3 Files - Robust Version
Get actual files from database and migrate them safely
"""

print("🔄 MIGRATING ALL S3 FILES - ROBUST VERSION", flush=True)
print("=" * 50, flush=True)

def migrate_all_s3_files_robust():
    """Robustly migrate all S3 files to new organized structure"""
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

        print("📋 Step 3: Getting S3 files from database...", flush=True)

        # Get files with S3 URLs - limit to a reasonable number for safety
        try:
            s3_files = frappe.db.sql("""
                SELECT name, file_name, file_url, creation, attached_to_doctype
                FROM `tabFile`
                WHERE file_url LIKE '%amazonaws%'
                ORDER BY creation DESC
                LIMIT 5
            """, as_dict=True)

            print(f"Found {len(s3_files)} S3 files in database", flush=True)

            if not s3_files:
                print("✅ No S3 files found to migrate", flush=True)
                return True

            # Display files found
            for i, file_info in enumerate(s3_files, 1):
                print(f"  {i}. {file_info.file_name} (ID: {file_info.name})", flush=True)

        except Exception as e:
            print(f"❌ Database query error: {e}", flush=True)
            return False

        print("📋 Step 4: Importing migration functions...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key
            print("✅ Migration functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ Migration function import failed: {e}", flush=True)
            return False

        print("📋 Step 5: Processing each file for migration...", flush=True)

        base_folder = site_config.get('s3_folder_path') or site_config.get('s3_folder') or 'flansa-files'
        migrated_count = 0
        skipped_count = 0

        for file_info in s3_files:
            try:
                print(f"📋 Processing: {file_info.file_name}", flush=True)

                # Generate new S3 key
                class MockFileDoc:
                    def __init__(self, file_info):
                        self.name = file_info.name
                        self.file_name = file_info.file_name
                        self.creation = file_info.creation
                        self.attached_to_doctype = file_info.attached_to_doctype

                mock_file = MockFileDoc(file_info)
                new_s3_key = _generate_s3_key(base_folder, mock_file)

                # Get current S3 key from URL
                current_url = file_info.file_url
                if '?' in current_url:
                    current_url = current_url.split('?')[0]

                try:
                    parts = current_url.replace('https://', '').split('/')
                    raw_s3_key = '/'.join(parts[1:]).strip('/')
                    current_s3_key = urllib.parse.unquote(raw_s3_key)

                    print(f"  Current: {current_s3_key}", flush=True)
                    print(f"  New:     {new_s3_key}", flush=True)

                    # Check if already in correct location
                    if current_s3_key == new_s3_key:
                        print(f"  ✅ Already in correct location", flush=True)
                        skipped_count += 1
                        continue

                    # Verify source exists in S3
                    source_exists = False
                    actual_source_key = None

                    # Try decoded key first
                    try:
                        s3_client.head_object(Bucket=bucket_name, Key=current_s3_key)
                        source_exists = True
                        actual_source_key = current_s3_key
                        print(f"  ✅ Source found (decoded key)", flush=True)
                    except:
                        # Try raw key as fallback
                        try:
                            s3_client.head_object(Bucket=bucket_name, Key=raw_s3_key)
                            source_exists = True
                            actual_source_key = raw_s3_key
                            print(f"  ✅ Source found (raw key)", flush=True)
                        except:
                            print(f"  ❌ Source file not found in S3", flush=True)

                    if not source_exists:
                        skipped_count += 1
                        continue

                    # Check if destination already exists
                    try:
                        s3_client.head_object(Bucket=bucket_name, Key=new_s3_key)
                        print(f"  ⚠️  Destination already exists, skipping", flush=True)
                        skipped_count += 1
                        continue
                    except:
                        pass  # Good, destination doesn't exist

                    # Perform the copy
                    print(f"  🔄 Copying to new organized location...", flush=True)

                    copy_source = {
                        'Bucket': bucket_name,
                        'Key': actual_source_key
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
                        s3_client.delete_object(Bucket=bucket_name, Key=actual_source_key)
                        print(f"  ✅ Old file deleted", flush=True)

                        migrated_count += 1

                    except Exception as e:
                        print(f"  ❌ Copy verification failed: {e}", flush=True)
                        # Clean up partial copy
                        try:
                            s3_client.delete_object(Bucket=bucket_name, Key=new_s3_key)
                        except:
                            pass
                        skipped_count += 1

                except Exception as e:
                    print(f"  ❌ URL parsing error: {e}", flush=True)
                    skipped_count += 1

            except Exception as e:
                print(f"  ❌ Error processing {file_info.file_name}: {e}", flush=True)
                skipped_count += 1

        print(f"📋 Step 6: Migration summary...", flush=True)
        print(f"✅ Successfully migrated: {migrated_count} files", flush=True)
        print(f"⏭️  Skipped: {skipped_count} files", flush=True)
        print(f"📊 Total processed: {len(s3_files)} files", flush=True)

        if migrated_count > 0:
            print(f"🎯 Migration benefits now active:", flush=True)
            print(f"  • Multi-tenant isolation by workspace", flush=True)
            print(f"  • Flansa table ID organization", flush=True)
            print(f"  • Date-based hierarchy (year/month)", flush=True)
            print(f"  • Better S3 performance with distributed prefixes", flush=True)

        return True

    except Exception as e:
        print(f"❌ Migration error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute migration
try:
    result = migrate_all_s3_files_robust()

    if result:
        print("🎉 Robust S3 migration completed!", flush=True)
    else:
        print("❌ Robust S3 migration encountered issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)