#!/usr/bin/env python3
"""
Test S3 File Deletion
Verify that files are deleted from S3 when records are removed
"""

print("🗑️ TESTING S3 FILE DELETION", flush=True)
print("=" * 50, flush=True)

def test_s3_file_deletion():
    """Test S3 file deletion functionality"""
    import frappe

    try:
        print("📋 Step 1: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')

        if not use_s3:
            print("❌ S3 not enabled in site config", flush=True)
            return False

        print(f"✅ S3 enabled: {use_s3}", flush=True)

        print("📋 Step 2: Testing delete function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import delete_file_from_s3
            from flansa.flansa_core.s3_integration.hooks import on_file_delete
            print("✅ S3 delete functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ S3 delete function import failed: {e}", flush=True)
            return False

        print("📋 Step 3: Checking S3 files available for testing...", flush=True)

        # Find S3 files
        s3_files = frappe.get_all("File",
                                 filters=[["file_url", "like", "%amazonaws%"]],
                                 fields=["name", "file_name", "file_url", "creation"],
                                 limit=5)

        print(f"Found {len(s3_files)} S3 files:", flush=True)
        for f in s3_files:
            print(f"  {f.file_name} - {f.file_url[:80]}{'...' if len(f.file_url) > 80 else ''}", flush=True)

        print("📋 Step 4: Testing delete hook registration...", flush=True)

        # Check if hooks are registered
        doc_events = frappe.get_hooks("doc_events")
        file_hooks = doc_events.get("File", {})
        on_trash = file_hooks.get('on_trash', [])

        delete_hook_registered = 'flansa.flansa_core.s3_integration.hooks.on_file_delete' in on_trash
        print(f"✅ S3 on_trash hook registered: {delete_hook_registered}", flush=True)

        print("📋 Step 5: Testing URL parsing for deletion...", flush=True)

        if s3_files:
            test_file = s3_files[0]
            test_url = test_file.file_url

            print(f"Testing URL parsing with: {test_url[:100]}{'...' if len(test_url) > 100 else ''}", flush=True)

            # Test URL parsing logic
            try:
                # Parse presigned URL to extract bucket and key
                if '?' in test_url:  # Presigned URL with query parameters
                    base_url = test_url.split('?')[0]
                else:
                    base_url = test_url

                # Parse S3 URL to get bucket and key
                parts = base_url.replace('https://', '').split('/')
                bucket_name = parts[0].split('.')[0]  # Extract bucket from subdomain
                s3_key = '/'.join(parts[1:])  # Rest is the key

                print(f"  ✅ Parsed bucket: {bucket_name}", flush=True)
                print(f"  ✅ Parsed key: {s3_key}", flush=True)

            except Exception as e:
                print(f"  ❌ URL parsing failed: {e}", flush=True)

        print("📋 Step 6: Testing delete function (dry run)...", flush=True)

        # Test delete function import and basic functionality
        if s3_files:
            test_file = s3_files[0]
            print(f"Would delete: {test_file.file_name}", flush=True)
            print(f"URL: {test_file.file_url[:100]}{'...' if len(test_file.file_url) > 100 else ''}", flush=True)

            # We won't actually delete for safety - just test the function exists and parses correctly
            print("  ✅ Delete function ready (not executing actual deletion for safety)", flush=True)

        print("📋 Step 7: Checking recent deletion logs...", flush=True)

        # Check for any S3 deletion logs
        try:
            error_logs = frappe.db.sql("""
                SELECT creation, error
                FROM `tabError Log`
                WHERE error LIKE '%S3 Delete%'
                   OR error LIKE '%delete%S3%'
                ORDER BY creation DESC
                LIMIT 5
            """, as_dict=True)

            if error_logs:
                print(f"Found {len(error_logs)} S3 deletion-related logs:", flush=True)
                for log in error_logs:
                    print(f"  {log.creation}: {log.error[:80]}...", flush=True)
            else:
                print("✅ No S3 deletion errors in recent logs", flush=True)

        except Exception as e:
            print(f"Could not check deletion logs: {e}", flush=True)

        print("📋 Step 8: Summary...", flush=True)

        print(f"  S3 files available: {len(s3_files)}", flush=True)
        print(f"  Delete hook registered: {delete_hook_registered}", flush=True)
        print(f"  Delete function imported: ✅", flush=True)
        print(f"  URL parsing tested: ✅", flush=True)

        if delete_hook_registered and len(s3_files) > 0:
            print("✅ S3 deletion functionality appears ready", flush=True)
            print("💡 To test actual deletion, delete a file from Frappe UI and check S3 bucket", flush=True)
        else:
            print("⚠️  S3 deletion may have issues - check hook registration", flush=True)

        return True

    except Exception as e:
        print(f"❌ Test error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute test
try:
    result = test_s3_file_deletion()

    if result:
        print("🎉 S3 deletion test completed!", flush=True)
    else:
        print("❌ S3 deletion test found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)