#!/usr/bin/env python3
"""
Debug S3 Background Processing
Check why S3 uploads aren't happening in background
"""

print("🔍 DEBUGGING S3 BACKGROUND PROCESSING", flush=True)
print("=" * 50, flush=True)

def debug_s3_background_processing():
    """Debug S3 background processing"""
    import frappe

    try:
        print("📋 Step 1: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')
        s3_bucket = site_config.get('s3_bucket')

        print(f"✅ S3 enabled: {use_s3}", flush=True)
        print(f"✅ S3 bucket: {s3_bucket}", flush=True)

        print("📋 Step 2: Checking doc_events hook registration...", flush=True)

        doc_events = frappe.get_hooks("doc_events")
        file_hooks = doc_events.get("File", {})
        after_insert = file_hooks.get('after_insert', [])

        print(f"File hooks: {file_hooks}", flush=True)
        print(f"After insert hooks: {after_insert}", flush=True)

        s3_hook_registered = 'flansa.flansa_core.s3_integration.doc_events.upload_to_s3_after_insert' in after_insert
        print(f"✅ S3 hook registered: {s3_hook_registered}", flush=True)

        print("📋 Step 3: Testing hook function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.doc_events import upload_to_s3_after_insert
            print("✅ Hook function imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ Hook function import failed: {e}", flush=True)
            return False

        print("📋 Step 4: Testing background function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.doc_events import process_s3_upload_background
            print("✅ Background function imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ Background function import failed: {e}", flush=True)
            return False

        print("📋 Step 5: Checking recent files and their status...", flush=True)

        # Get recent files uploaded
        recent_files = frappe.get_all("File",
                                     fields=["name", "file_name", "file_url", "creation"],
                                     order_by="creation desc",
                                     limit=5)

        print(f"Recent files ({len(recent_files)}):", flush=True)
        for f in recent_files:
            is_local = f.file_url and f.file_url.startswith('/')
            is_s3 = 's3://' in f.file_url or 'amazonaws' in f.file_url.lower()

            print(f"  {f.file_name} ({f.creation})", flush=True)
            print(f"    URL: {f.file_url}", flush=True)
            print(f"    Status: {'Local' if is_local else ('S3' if is_s3 else 'Unknown')}", flush=True)

        print("📋 Step 6: Checking background job queue...", flush=True)

        # Check if there are any background jobs
        try:
            jobs = frappe.db.sql("""
                SELECT name, method_name, creation, status
                FROM `tabRQ Job`
                WHERE method_name LIKE '%s3%'
                ORDER BY creation DESC
                LIMIT 10
            """, as_dict=True)

            print(f"S3-related background jobs: {len(jobs)}", flush=True)
            for job in jobs:
                print(f"  {job.method_name} - {job.status} ({job.creation})", flush=True)

        except Exception as e:
            print(f"Could not check background jobs: {e}", flush=True)

        print("📋 Step 7: Manual test of background function...", flush=True)

        # Test the background function with a recent local file
        local_files = [f for f in recent_files if f.file_url and f.file_url.startswith('/')]

        if local_files:
            test_file = local_files[0]
            print(f"Testing background processing with: {test_file.file_name}", flush=True)

            try:
                from flansa.flansa_core.s3_integration.doc_events import process_s3_upload_background
                process_s3_upload_background(test_file.name)

                # Check if file was updated
                updated_file = frappe.get_doc("File", test_file.name)
                if 's3://' in updated_file.file_url or 'amazonaws' in updated_file.file_url.lower():
                    print("✅ Manual background processing worked!", flush=True)
                else:
                    print("❌ Manual background processing didn't update file URL", flush=True)

            except Exception as e:
                print(f"❌ Manual background processing failed: {e}", flush=True)
                import traceback
                print(f"Traceback: {traceback.format_exc()}", flush=True)
        else:
            print("No local files found to test", flush=True)

        return True

    except Exception as e:
        print(f"❌ Debug error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute debug
try:
    result = debug_s3_background_processing()

    if result:
        print("🎉 Debug completed!", flush=True)
    else:
        print("❌ Debug found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)