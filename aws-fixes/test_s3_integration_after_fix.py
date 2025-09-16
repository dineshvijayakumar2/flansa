#!/usr/bin/env python3
"""
Test S3 Integration After ValidationError Fix
Verify that presigned URLs work and no ValidationError occurs
"""

print("🔍 TESTING S3 INTEGRATION AFTER FIX", flush=True)
print("=" * 50, flush=True)

def test_s3_integration_after_fix():
    """Test S3 integration after fixing ValidationError"""
    import frappe

    try:
        print("📋 Step 1: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')
        s3_bucket = site_config.get('s3_bucket')

        if not use_s3:
            print("❌ S3 not enabled in site config", flush=True)
            return False

        print(f"✅ S3 enabled: {use_s3}", flush=True)
        print(f"✅ S3 bucket: {s3_bucket}", flush=True)

        print("📋 Step 2: Testing S3 upload function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3
            from flansa.flansa_core.s3_integration.doc_events import process_s3_upload_safe
            print("✅ S3 functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ S3 function import failed: {e}", flush=True)
            return False

        print("📋 Step 3: Checking recent file uploads...", flush=True)

        # Get recent files to see current state
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "file_url", "creation"],
                                    order_by="creation desc",
                                    limit=3)

        print(f"Recent files ({len(recent_files)}):", flush=True)
        for f in recent_files:
            is_local = f.file_url and f.file_url.startswith('/')
            is_s3 = 'amazonaws' in f.file_url.lower() if f.file_url else False
            is_presigned = 'AWSAccessKeyId' in f.file_url if f.file_url else False

            print(f"  {f.file_name} ({f.creation})", flush=True)
            print(f"    URL: {f.file_url[:100]}{'...' if len(f.file_url) > 100 else ''}", flush=True)
            print(f"    Status: {'Local' if is_local else ('S3 Presigned' if is_presigned else ('S3' if is_s3 else 'Unknown'))}", flush=True)

        print("📋 Step 4: Testing doc_events hook registration...", flush=True)

        # Check if hooks are registered
        doc_events = frappe.get_hooks("doc_events")
        file_hooks = doc_events.get("File", {})
        after_insert = file_hooks.get('after_insert', [])

        s3_hook_registered = 'flansa.flansa_core.s3_integration.doc_events.upload_to_s3_after_insert' in after_insert
        print(f"✅ S3 after_insert hook registered: {s3_hook_registered}", flush=True)

        print("📋 Step 5: Checking for any validation errors in logs...", flush=True)

        # Check recent error logs for ValidationError
        try:
            error_logs = frappe.db.sql("""
                SELECT creation, error, traceback
                FROM `tabError Log`
                WHERE error LIKE '%ValidationError%'
                   OR error LIKE '%Cannot access file path%'
                   OR error LIKE '%s3://%'
                ORDER BY creation DESC
                LIMIT 5
            """, as_dict=True)

            if error_logs:
                print(f"⚠️  Found {len(error_logs)} recent validation errors:", flush=True)
                for log in error_logs:
                    print(f"  {log.creation}: {log.error[:100]}...", flush=True)
            else:
                print("✅ No recent ValidationError logs found", flush=True)

        except Exception as e:
            print(f"Could not check error logs: {e}", flush=True)

        print("📋 Step 6: Manual test with local file...", flush=True)

        # Find a local file to test processing
        local_files = [f for f in recent_files if f.file_url and f.file_url.startswith('/')]

        if local_files:
            test_file = local_files[0]
            print(f"Testing S3 processing with: {test_file.file_name}", flush=True)

            try:
                # Get the file document
                doc = frappe.get_doc("File", test_file.name)
                print(f"  Original URL: {doc.file_url}", flush=True)

                # Test S3 processing
                process_s3_upload_safe(doc)

                # Check result
                doc.reload()
                if 'amazonaws' in doc.file_url.lower():
                    print("✅ S3 processing successful - file now has AWS URL", flush=True)
                    print(f"  New URL: {doc.file_url[:100]}{'...' if len(doc.file_url) > 100 else ''}", flush=True)
                else:
                    print("❌ S3 processing didn't update URL", flush=True)
                    print(f"  Current URL: {doc.file_url}", flush=True)

            except Exception as e:
                print(f"❌ S3 processing test failed: {e}", flush=True)
                import traceback
                print(f"Traceback: {traceback.format_exc()}", flush=True)
        else:
            print("No local files found for testing", flush=True)

        print("📋 Step 7: Summary...", flush=True)

        s3_files_count = len([f for f in recent_files if f.file_url and 'amazonaws' in f.file_url.lower()])
        local_files_count = len([f for f in recent_files if f.file_url and f.file_url.startswith('/')])

        print(f"  S3 files: {s3_files_count}/{len(recent_files)}", flush=True)
        print(f"  Local files: {local_files_count}/{len(recent_files)}", flush=True)
        print(f"  Hook registered: {s3_hook_registered}", flush=True)

        return True

    except Exception as e:
        print(f"❌ Test error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute test
try:
    result = test_s3_integration_after_fix()

    if result:
        print("🎉 S3 integration test completed!", flush=True)
    else:
        print("❌ S3 integration test found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)