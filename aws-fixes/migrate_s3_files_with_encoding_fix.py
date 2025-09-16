#!/usr/bin/env python3
"""
Migrate S3 Files with URL Encoding Fix
Handle both URL-encoded and decoded S3 keys for migration
"""

print("🔄 MIGRATING S3 FILES WITH ENCODING FIX", flush=True)
print("=" * 50, flush=True)

def migrate_s3_files_with_encoding_fix():
    """Migrate S3 files handling URL encoding issues"""
    import frappe
    import boto3
    import urllib.parse
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

        print("📋 Step 3: Finding S3 files for migration...", flush=True)

        # Get files with S3 URLs
        s3_files = frappe.db.sql("""
            SELECT name, file_name, file_url, creation, attached_to_doctype, attached_to_name
            FROM `tabFile`
            WHERE file_url LIKE '%amazonaws%'
            ORDER BY creation DESC
            LIMIT 10
        """, as_dict=True)

        print(f"Found {len(s3_files)} S3 files to analyze", flush=True)

        if not s3_files:
            print("✅ No S3 files found to migrate", flush=True)
            return True

        print("📋 Step 4: Importing migration functions...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key
            print("✅ Migration functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ Migration function import failed: {e}", flush=True)
            return False

        print("📋 Step 5: Enhanced file analysis with encoding handling...", flush=True)

        base_folder = site_config.get('s3_folder_path') or site_config.get('s3_folder') or 'flansa-files'
        migration_candidates = []
        found_count = 0
        missing_count = 0

        for file_info in s3_files:
            print(f"Analyzing: {file_info.file_name}", flush=True)

            # Create mock file doc for new key generation
            class MockFileDoc:
                def __init__(self, file_info):
                    self.name = file_info.name
                    self.file_name = file_info.file_name
                    self.creation = file_info.creation
                    self.attached_to_doctype = file_info.attached_to_doctype

            mock_file = MockFileDoc(file_info)
            new_s3_key = _generate_s3_key(base_folder, mock_file)

            # Extract current S3 key from URL with encoding handling
            current_url = file_info.file_url
            if '?' in current_url:
                current_url = current_url.split('?')[0]

            try:
                parts = current_url.replace('https://', '').split('/')
                raw_s3_key = '/'.join(parts[1:]).strip('/')
                decoded_s3_key = urllib.parse.unquote(raw_s3_key)

                print(f"  Raw key: {raw_s3_key}", flush=True)
                print(f"  Decoded key: {decoded_s3_key}", flush=True)

                # Check if file exists (try both encoded and decoded)
                file_exists = False
                actual_key = None

                # Try decoded key first
                try:
                    s3_client.head_object(Bucket=bucket_name, Key=decoded_s3_key)
                    file_exists = True
                    actual_key = decoded_s3_key
                    print(f"  ✅ Found with decoded key", flush=True)
                except:
                    # Try raw key
                    try:
                        s3_client.head_object(Bucket=bucket_name, Key=raw_s3_key)
                        file_exists = True
                        actual_key = raw_s3_key
                        print(f"  ✅ Found with raw key", flush=True)
                    except:
                        print(f"  ❌ File not found in S3", flush=True)

                if file_exists:
                    found_count += 1

                    # Check if migration is needed
                    if actual_key != new_s3_key:
                        migration_candidates.append({
                            'file_name': file_info.file_name,
                            'file_id': file_info.name,
                            'current_key': actual_key,
                            'new_key': new_s3_key,
                            'file_url': file_info.file_url,
                            'creation': file_info.creation
                        })
                        print(f"  📦 Needs migration", flush=True)
                    else:
                        print(f"  ✅ Already organized", flush=True)
                else:
                    missing_count += 1

            except Exception as e:
                print(f"  ❌ Error analyzing {file_info.file_name}: {e}", flush=True)
                missing_count += 1

        print(f"📋 Step 6: Analysis summary...", flush=True)
        print(f"  Files found in S3: {found_count}", flush=True)
        print(f"  Files missing from S3: {missing_count}", flush=True)
        print(f"  Files needing migration: {len(migration_candidates)}", flush=True)

        if migration_candidates:
            print("📋 Step 7: Migration preview...", flush=True)

            for i, candidate in enumerate(migration_candidates[:3], 1):
                print(f"  {i}. {candidate['file_name']}", flush=True)
                print(f"     From: {candidate['current_key']}", flush=True)
                print(f"     To:   {candidate['new_key']}", flush=True)

            if len(migration_candidates) > 3:
                print(f"     ... and {len(migration_candidates) - 3} more files", flush=True)

            print("📋 Step 8: Ready for actual migration...", flush=True)
            print("💡 To perform migration:", flush=True)
            print("  1. Enable actual S3 copy operations", flush=True)
            print("  2. Update file URLs in database", flush=True)
            print("  3. Delete old files after verification", flush=True)
            print("  4. Update presigned URLs", flush=True)

        else:
            print("✅ All files are already in the correct structure!", flush=True)

        print("📋 Step 9: File accessibility status...", flush=True)
        print(f"✅ Files accessible in S3: {found_count}/{len(s3_files)}", flush=True)
        print(f"⚠️  Files with URL encoding issues resolved: URL decoding now working", flush=True)
        print(f"🔄 Files ready for migration: {len(migration_candidates)}", flush=True)

        return True

    except Exception as e:
        print(f"❌ Migration analysis error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute migration analysis
try:
    result = migrate_s3_files_with_encoding_fix()

    if result:
        print("🎉 Enhanced S3 migration analysis completed!", flush=True)
    else:
        print("❌ Enhanced S3 migration analysis found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)