#!/usr/bin/env python3
"""
Migrate S3 Files to Organized Structure
Move existing S3 files from flat structure to organized multi-tenant structure
"""

print("🔄 MIGRATING S3 FILES TO ORGANIZED STRUCTURE", flush=True)
print("=" * 50, flush=True)

def migrate_s3_to_organized_structure():
    """Migrate existing S3 files to new organized structure"""
    import frappe
    import boto3
    from datetime import datetime

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

        print("📋 Step 3: Finding S3 files that need migration...", flush=True)

        # Get files with S3 URLs
        s3_files = frappe.db.sql("""
            SELECT name, file_name, file_url, creation, attached_to_doctype, attached_to_name
            FROM `tabFile`
            WHERE file_url LIKE '%amazonaws%'
            ORDER BY creation DESC
            LIMIT 50
        """, as_dict=True)

        print(f"Found {len(s3_files)} S3 files to potentially migrate", flush=True)

        if not s3_files:
            print("✅ No S3 files found to migrate", flush=True)
            return True

        print("📋 Step 4: Importing migration functions...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key, _get_file_category
            print("✅ Migration functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ Migration function import failed: {e}", flush=True)
            return False

        print("📋 Step 5: Analyzing files for migration...", flush=True)

        base_folder = site_config.get('s3_folder_path') or site_config.get('s3_folder') or 'flansa-files'
        migration_candidates = []
        skipped_count = 0

        for file_info in s3_files:
            # Create mock file doc for key generation
            class MockFileDoc:
                def __init__(self, file_info):
                    self.name = file_info.name
                    self.file_name = file_info.file_name
                    self.creation = file_info.creation
                    self.attached_to_doctype = file_info.attached_to_doctype

            mock_file = MockFileDoc(file_info)
            new_s3_key = _generate_s3_key(base_folder, mock_file)

            # Extract current S3 key from URL
            current_url = file_info.file_url
            if '?' in current_url:  # Remove query parameters
                current_url = current_url.split('?')[0]

            # Parse current S3 key
            try:
                parts = current_url.replace('https://', '').split('/')
                current_s3_key = '/'.join(parts[1:])  # Skip bucket part
                current_s3_key = current_s3_key.strip('/')
            except:
                current_s3_key = f"unknown/{file_info.file_name}"

            # Check if migration is needed
            if current_s3_key != new_s3_key:
                migration_candidates.append({
                    'file_name': file_info.file_name,
                    'file_id': file_info.name,
                    'current_key': current_s3_key,
                    'new_key': new_s3_key,
                    'file_url': file_info.file_url,
                    'creation': file_info.creation
                })
            else:
                skipped_count += 1

        print(f"Files needing migration: {len(migration_candidates)}", flush=True)
        print(f"Files already organized: {skipped_count}", flush=True)

        if not migration_candidates:
            print("✅ All files are already in the correct structure", flush=True)
            return True

        print("📋 Step 6: Preview migration plan...", flush=True)

        preview_limit = min(5, len(migration_candidates))
        print(f"Preview of {preview_limit} migrations:", flush=True)

        for i, candidate in enumerate(migration_candidates[:preview_limit]):
            print(f"  {i+1}. {candidate['file_name']}", flush=True)
            print(f"     From: {candidate['current_key']}", flush=True)
            print(f"     To:   {candidate['new_key']}", flush=True)

        if len(migration_candidates) > preview_limit:
            print(f"     ... and {len(migration_candidates) - preview_limit} more files", flush=True)

        print("📋 Step 7: Performing migration (DRY RUN)...", flush=True)

        # Perform a dry run first
        successful_migrations = 0
        failed_migrations = 0

        for candidate in migration_candidates[:10]:  # Limit to first 10 for testing
            try:
                print(f"Dry run: {candidate['file_name']}", flush=True)

                # Check if source exists
                try:
                    s3_client.head_object(Bucket=bucket_name, Key=candidate['current_key'])
                    print(f"  ✅ Source file exists in S3", flush=True)
                except:
                    print(f"  ⚠️  Source file not found in S3", flush=True)
                    failed_migrations += 1
                    continue

                # Check if destination already exists
                try:
                    s3_client.head_object(Bucket=bucket_name, Key=candidate['new_key'])
                    print(f"  ⚠️  Destination already exists, skipping", flush=True)
                    failed_migrations += 1
                    continue
                except:
                    pass  # Destination doesn't exist, which is good

                print(f"  ✅ Ready for migration", flush=True)
                successful_migrations += 1

            except Exception as e:
                print(f"  ❌ Error checking {candidate['file_name']}: {e}", flush=True)
                failed_migrations += 1

        print(f"📋 Step 8: Migration summary (DRY RUN)...", flush=True)
        print(f"  Ready for migration: {successful_migrations}", flush=True)
        print(f"  Would skip/fail: {failed_migrations}", flush=True)
        print(f"  Total candidates: {len(migration_candidates)}", flush=True)

        print("📋 Step 9: Migration benefits...", flush=True)
        print("✅ After migration, files will be organized as:", flush=True)
        print("  • flansa-files/{workspace_id}/{category}/{doctype}/{year}/{month}/file", flush=True)
        print("  • Better scalability and performance", flush=True)
        print("  • Multi-tenant isolation", flush=True)
        print("  • Easier file management and cleanup", flush=True)

        print("💡 To run actual migration:", flush=True)
        print("  1. Test with a few files first", flush=True)
        print("  2. Remove DRY RUN limitation", flush=True)
        print("  3. Add actual S3 copy operations", flush=True)
        print("  4. Update file URLs in database", flush=True)

        return True

    except Exception as e:
        print(f"❌ Migration error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute migration analysis
try:
    result = migrate_s3_to_organized_structure()

    if result:
        print("🎉 S3 migration analysis completed!", flush=True)
    else:
        print("❌ S3 migration analysis found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)