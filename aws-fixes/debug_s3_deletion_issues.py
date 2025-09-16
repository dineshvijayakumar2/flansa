#!/usr/bin/env python3
"""
Debug S3 Deletion Issues
Analyze why S3 file deletion is not working correctly
"""

print("🔍 DEBUGGING S3 DELETION ISSUES", flush=True)
print("=" * 50, flush=True)

def debug_s3_deletion_issues():
    """Debug S3 file deletion problems"""
    import frappe
    import boto3

    try:
        print("📋 Step 1: Checking S3 deletion hook registration...", flush=True)

        doc_events = frappe.get_hooks("doc_events")
        file_hooks = doc_events.get("File", {})
        on_trash = file_hooks.get('on_trash', [])

        delete_hook_registered = 'flansa.flansa_core.s3_integration.hooks.on_file_delete' in on_trash
        print(f"✅ S3 on_trash hook registered: {delete_hook_registered}", flush=True)

        if not delete_hook_registered:
            print("❌ S3 deletion hook not registered properly!", flush=True)
            return False

        print("📋 Step 2: Testing deletion function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import delete_file_from_s3
            from flansa.flansa_core.s3_integration.hooks import on_file_delete
            print("✅ S3 deletion functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ S3 deletion function import failed: {e}", flush=True)
            return False

        print("📋 Step 3: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')

        if not use_s3:
            print("❌ S3 not enabled in site config", flush=True)
            return False

        print(f"✅ S3 enabled: {use_s3}", flush=True)

        # Get S3 credentials
        aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
        aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
        bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
        region = site_config.get('s3_region') or site_config.get('aws_s3_region_name')

        if not all([aws_access_key_id, aws_secret_access_key, bucket_name, region]):
            print("❌ S3 credentials incomplete", flush=True)
            return False

        print(f"✅ S3 bucket: {bucket_name}", flush=True)

        print("📋 Step 4: Finding test S3 files for deletion testing...", flush=True)

        # Get S3 files
        s3_files = frappe.get_all("File",
                                 filters=[["file_url", "like", "%amazonaws%"]],
                                 fields=["name", "file_name", "file_url", "creation"],
                                 limit=5)

        print(f"Found {len(s3_files)} S3 files for testing:", flush=True)
        for f in s3_files:
            print(f"  {f.file_name} - {f.file_url[:80]}{'...' if len(f.file_url) > 80 else ''}", flush=True)

        if not s3_files:
            print("⚠️  No S3 files found for deletion testing", flush=True)
            return True

        print("📋 Step 5: Testing URL parsing logic...", flush=True)

        test_file = s3_files[0]
        test_url = test_file.file_url

        print(f"Testing with URL: {test_url}", flush=True)

        # Test the parsing logic from delete_file_from_s3
        try:
            # Parse presigned URL to extract bucket and key
            if '?' in test_url:  # Presigned URL with query parameters
                base_url = test_url.split('?')[0]
            else:
                base_url = test_url

            # Parse S3 URL to get bucket and key
            parts = base_url.replace('https://', '').split('/')
            parsed_bucket = parts[0].split('.')[0]  # Extract bucket from subdomain
            parsed_s3_key = '/'.join(parts[1:])  # Rest is the key

            print(f"  ✅ Parsed bucket: {parsed_bucket}", flush=True)
            print(f"  Raw S3 key: {parsed_s3_key}", flush=True)

            # URL decode the S3 key to handle special characters and spaces
            import urllib.parse
            decoded_s3_key = urllib.parse.unquote(parsed_s3_key)
            decoded_s3_key = decoded_s3_key.strip('/')

            print(f"  ✅ Decoded S3 key: {decoded_s3_key}", flush=True)

            # Verify bucket matches configuration
            if parsed_bucket == bucket_name:
                print(f"  ✅ Bucket matches configuration", flush=True)
            else:
                print(f"  ⚠️  Bucket mismatch - parsed: {parsed_bucket}, config: {bucket_name}", flush=True)

        except Exception as e:
            print(f"  ❌ URL parsing failed: {e}", flush=True)

        print("📋 Step 6: Testing S3 client connection...", flush=True)

        try:
            s3_client = boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key
            )

            # Test S3 connection with list operation
            response = s3_client.list_objects_v2(
                Bucket=bucket_name,
                MaxKeys=5
            )

            file_count = response.get('KeyCount', 0)
            print(f"  ✅ S3 connection successful - found {file_count} files in bucket", flush=True)

        except Exception as e:
            print(f"  ❌ S3 connection failed: {e}", flush=True)
            return False

        print("📋 Step 7: Testing file existence check...", flush=True)

        # Check if the test file exists in S3
        test_file = s3_files[0]
        try:
            # Parse the URL to get S3 key
            test_url = test_file.file_url
            if '?' in test_url:
                base_url = test_url.split('?')[0]
            else:
                base_url = test_url

            parts = base_url.replace('https://', '').split('/')
            raw_s3_key = '/'.join(parts[1:]).strip('/')

            # URL decode the S3 key
            import urllib.parse
            s3_key = urllib.parse.unquote(raw_s3_key)

            print(f"  Testing with raw key: {raw_s3_key}", flush=True)
            print(f"  Testing with decoded key: {s3_key}", flush=True)

            # Check if file exists with decoded key
            s3_client.head_object(Bucket=bucket_name, Key=s3_key)
            print(f"  ✅ File exists in S3: {test_file.file_name}", flush=True)

        except s3_client.exceptions.NoSuchKey:
            print(f"  ❌ File not found in S3: {test_file.file_name}", flush=True)
            print(f"    Tried decoded key: {s3_key}", flush=True)
            # Try with raw key as fallback
            try:
                s3_client.head_object(Bucket=bucket_name, Key=raw_s3_key)
                print(f"  ✅ File found with raw key: {test_file.file_name}", flush=True)
            except:
                print(f"    Raw key also not found: {raw_s3_key}", flush=True)
        except Exception as e:
            print(f"  ❌ Error checking file existence: {e}", flush=True)

        print("📋 Step 8: Testing deletion function directly...", flush=True)

        # Test the deletion function without actually deleting
        test_file = s3_files[0]
        print(f"Testing deletion logic for: {test_file.file_name}", flush=True)

        # Create a mock document for testing
        class MockFileDoc:
            def __init__(self, file_info):
                self.name = file_info.name
                self.file_name = file_info.file_name
                self.file_url = file_info.file_url

        mock_doc = MockFileDoc(test_file)

        try:
            # Test the hook function (but don't actually delete)
            print(f"  Testing on_file_delete hook logic...", flush=True)

            # Simulate the hook conditions
            if site_config.get('use_s3') and mock_doc.file_url:
                if 's3.amazonaws.com' in mock_doc.file_url or 's3.' in mock_doc.file_url:
                    print(f"  ✅ Hook conditions satisfied for deletion", flush=True)
                    print(f"  ✅ Would call delete_file_from_s3() for: {mock_doc.file_name}", flush=True)
                else:
                    print(f"  ❌ URL doesn't match S3 patterns", flush=True)
            else:
                print(f"  ❌ Hook conditions not satisfied", flush=True)

        except Exception as e:
            print(f"  ❌ Error in deletion logic test: {e}", flush=True)

        print("📋 Step 9: Checking recent deletion attempts...", flush=True)

        # Check error logs for deletion issues
        try:
            error_logs = frappe.db.sql("""
                SELECT creation, error
                FROM `tabError Log`
                WHERE error LIKE '%delete%S3%'
                   OR error LIKE '%S3 Delete%'
                ORDER BY creation DESC
                LIMIT 5
            """, as_dict=True)

            if error_logs:
                print(f"Found {len(error_logs)} recent S3 deletion error logs:", flush=True)
                for log in error_logs:
                    print(f"  {log.creation}: {log.error[:100]}...", flush=True)
            else:
                print("✅ No recent S3 deletion errors in logs", flush=True)

        except Exception as e:
            print(f"Could not check error logs: {e}", flush=True)

        print("📋 Step 10: Summary and recommendations...", flush=True)

        print("✅ Deletion system status:", flush=True)
        print(f"  Hook registered: {delete_hook_registered}", flush=True)
        print(f"  S3 configured: {use_s3}", flush=True)
        print(f"  S3 connection: Working", flush=True)
        print(f"  Files to test with: {len(s3_files)}", flush=True)

        print("💡 To test actual deletion:", flush=True)
        print("  1. Create a test file", flush=True)
        print("  2. Delete it from Frappe UI", flush=True)
        print("  3. Check S3 bucket to verify deletion", flush=True)
        print("  4. Monitor error logs during the process", flush=True)

        return True

    except Exception as e:
        print(f"❌ Debug error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute debug
try:
    result = debug_s3_deletion_issues()

    if result:
        print("🎉 S3 deletion debug completed!", flush=True)
    else:
        print("❌ S3 deletion debug found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)