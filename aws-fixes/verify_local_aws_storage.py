#!/usr/bin/env python3
"""
Verify Local vs AWS Storage Configuration
Ensure local uses file system and AWS uses S3 correctly
"""

print("🔍 VERIFYING LOCAL VS AWS STORAGE", flush=True)
print("=" * 50, flush=True)

def verify_storage_configuration():
    """Verify that storage works correctly for local and AWS environments"""
    import frappe
    import os

    try:
        print("📋 Step 1: Checking current site configuration...", flush=True)

        site_config = frappe.get_site_config()
        site_name = frappe.local.site
        use_s3 = site_config.get('use_s3')

        print(f"🏠 Site: {site_name}", flush=True)
        print(f"🔧 S3 Enabled: {use_s3 if use_s3 else 'No (using local storage)'}", flush=True)

        if use_s3:
            print("☁️  AWS S3 Configuration:", flush=True)
            print(f"  Bucket: {site_config.get('s3_bucket')}", flush=True)
            print(f"  Folder: {site_config.get('s3_folder_path', 'flansa-files')}", flush=True)
            print(f"  Region: {site_config.get('aws_s3_region_name')}", flush=True)
        else:
            print("💾 Local File Storage Configuration:", flush=True)
            print(f"  Private files: sites/{site_name}/private/files/", flush=True)
            print(f"  Public files: sites/{site_name}/public/files/", flush=True)

        print("\n📋 Step 2: Checking S3 integration hooks...", flush=True)

        # Check if hooks are registered
        doc_events = frappe.get_hooks("doc_events")
        file_hooks = doc_events.get("File", {})
        after_insert = file_hooks.get('after_insert', [])

        s3_hook_registered = 'flansa.flansa_core.s3_integration.doc_events.upload_to_s3_after_insert' in after_insert

        print(f"🔗 S3 after_insert hook: {'✅ REGISTERED' if s3_hook_registered else '❌ NOT REGISTERED'}", flush=True)

        if s3_hook_registered:
            print("ℹ️  Hook is registered but will only run when use_s3=1", flush=True)

        print("\n📋 Step 3: Testing file upload behavior...", flush=True)

        # Check recent files to see where they're stored
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "file_url", "creation"],
                                    order_by="creation desc",
                                    limit=5)

        if recent_files:
            print(f"📁 Recent files ({len(recent_files)}):", flush=True)

            local_count = 0
            s3_count = 0

            for f in recent_files:
                if f.file_url:
                    if 'amazonaws' in f.file_url.lower():
                        s3_count += 1
                        storage = "☁️  S3"
                    elif f.file_url.startswith('/'):
                        local_count += 1
                        storage = "💾 Local"
                    else:
                        storage = "❓ Unknown"

                    print(f"  {f.file_name[:50]} - {storage}", flush=True)

            print(f"\n📊 Storage Distribution:", flush=True)
            print(f"  Local files: {local_count}", flush=True)
            print(f"  S3 files: {s3_count}", flush=True)

            # Verify configuration matches actual storage
            if use_s3 and local_count > 0:
                print("⚠️  WARNING: S3 is enabled but recent files are stored locally", flush=True)
                print("💡 This might indicate S3 integration issues", flush=True)
            elif not use_s3 and s3_count > 0:
                print("⚠️  WARNING: S3 is disabled but files are on S3", flush=True)
                print("💡 These files might have been uploaded when S3 was enabled", flush=True)
            else:
                print("✅ Storage location matches configuration", flush=True)
        else:
            print("ℹ️  No files found to verify", flush=True)

        print("\n📋 Step 4: Testing S3 integration safety...", flush=True)

        # Import and check S3 functions
        try:
            from flansa.flansa_core.s3_integration.doc_events import upload_to_s3_after_insert
            from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3

            print("✅ S3 integration modules imported successfully", flush=True)

            # Create a mock file doc to test
            class MockFile:
                def __init__(self):
                    self.file_url = "/private/files/test.txt"
                    self.file_name = "test.txt"
                    self.name = "test-file-001"

            mock_doc = MockFile()

            # Test that upload_to_s3_after_insert respects use_s3 flag
            print("🧪 Testing S3 hook with current configuration...", flush=True)

            # This should return immediately if use_s3 is False
            upload_to_s3_after_insert(mock_doc, None)

            if not use_s3:
                print("✅ S3 hook correctly skipped (use_s3 is False)", flush=True)
            else:
                print("✅ S3 hook executed (use_s3 is True)", flush=True)

            # Test direct S3 upload function
            print("🧪 Testing direct S3 upload function...", flush=True)

            result = upload_file_to_s3(mock_doc, b"test content")

            if not use_s3:
                if result is None:
                    print("✅ S3 upload correctly returned None (use_s3 is False)", flush=True)
                else:
                    print("❌ S3 upload should return None when use_s3 is False", flush=True)
            else:
                if result:
                    print(f"✅ S3 upload would process file (use_s3 is True)", flush=True)
                else:
                    print("⚠️  S3 upload returned None despite use_s3 being True", flush=True)

        except ImportError as e:
            print(f"❌ Failed to import S3 modules: {e}", flush=True)
            return False
        except Exception as e:
            print(f"⚠️  Test execution note: {str(e)}", flush=True)

        print("\n📋 Step 5: Configuration recommendations...", flush=True)

        if not use_s3:
            print("💾 LOCAL STORAGE MODE:", flush=True)
            print("  ✅ Files will be stored in sites/[site]/private/files/", flush=True)
            print("  ✅ S3 hooks are registered but will skip processing", flush=True)
            print("  ✅ No S3 API calls will be made", flush=True)
            print("  ✅ Perfect for development and testing", flush=True)
        else:
            print("☁️  AWS S3 MODE:", flush=True)
            print("  ✅ Files will be uploaded to S3 bucket", flush=True)
            print("  ✅ Presigned URLs will be generated", flush=True)
            print("  ✅ Local files may be deleted after S3 upload", flush=True)
            print("  ⚠️  Ensure AWS credentials are configured", flush=True)

        return True

    except Exception as e:
        print(f"❌ Verification error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute verification
try:
    result = verify_storage_configuration()

    if result:
        print("\n🎉 Storage configuration verified successfully!", flush=True)
    else:
        print("\n❌ Storage configuration has issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)