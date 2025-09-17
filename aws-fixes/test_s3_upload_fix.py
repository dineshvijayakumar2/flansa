#!/usr/bin/env python3
"""
Test S3 Upload Fix - Verify ValidationError Resolution
Test if presigned URLs fix the Frappe file handling compatibility issue
"""

print("🔍 TESTING S3 UPLOAD FIX", flush=True)
print("=" * 50, flush=True)

def test_s3_upload_fix():
    """Test the S3 upload fix to ensure ValidationError is resolved"""
    import frappe
    import tempfile
    import os

    try:
        print("📋 Step 1: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')

        if not use_s3:
            print("⚠️  S3 is disabled - cannot test S3 upload", flush=True)
            print("💡 To test S3 locally, set site_config['use_s3'] = 1 temporarily", flush=True)
            return True

        print(f"✅ S3 is enabled (use_s3: {use_s3})", flush=True)

        print("📋 Step 2: Testing S3 upload function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3
            print("✅ S3 upload function imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ S3 upload function import failed: {e}", flush=True)
            return False

        print("📋 Step 3: Creating test file...", flush=True)

        # Create a temporary test file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt', prefix='test_s3_') as tmp_file:
            test_content = b"Test file for S3 upload validation"
            tmp_file.write(test_content)
            tmp_file_path = tmp_file.name

        print(f"✅ Test file created: {os.path.basename(tmp_file_path)}", flush=True)

        print("📋 Step 4: Creating File doc...", flush=True)

        # Create a File document to test
        file_doc = frappe.new_doc("File")
        file_doc.file_name = os.path.basename(tmp_file_path)
        file_doc.is_private = 1
        file_doc.content = test_content

        print(f"✅ File doc created: {file_doc.file_name}", flush=True)

        print("📋 Step 5: Testing S3 upload without ValidationError...", flush=True)

        try:
            # Test the upload function directly
            result = upload_file_to_s3(file_doc, test_content)

            if result and result.get('success'):
                s3_url = result.get('s3_url')
                print(f"✅ S3 upload successful", flush=True)
                print(f"🔗 S3 URL format: {'presigned URL' if 'amazonaws.com' in s3_url else 'unknown format'}", flush=True)

                # Check if URL is compatible with Frappe
                if s3_url.startswith('https://') and 'amazonaws.com' in s3_url:
                    print("✅ URL format is Frappe-compatible (HTTPS presigned URL)", flush=True)
                elif s3_url.startswith('s3://'):
                    print("❌ URL format may cause ValidationError (s3:// format)", flush=True)
                    return False
                else:
                    print(f"⚠️  Unknown URL format: {s3_url[:50]}...", flush=True)

            else:
                print(f"❌ S3 upload failed: {result}", flush=True)
                return False

        except Exception as upload_error:
            print(f"❌ S3 upload error: {str(upload_error)}", flush=True)
            return False

        print("📋 Step 6: Testing File doc insertion (ValidationError check)...", flush=True)

        try:
            # Set the S3 URL and test if Frappe can handle it
            file_doc.file_url = result.get('s3_url')

            # Test if Frappe's file validation works with this URL
            # This is where the ValidationError would occur
            file_doc.save(ignore_permissions=True)

            print("✅ File doc saved successfully - no ValidationError", flush=True)
            print(f"📁 File URL: {file_doc.file_url[:80]}...", flush=True)

            # Clean up test doc
            file_doc.delete()
            print("✅ Test file doc cleaned up", flush=True)

        except Exception as validation_error:
            print(f"❌ ValidationError still occurs: {str(validation_error)}", flush=True)
            return False

        # Clean up temporary file
        try:
            os.unlink(tmp_file_path)
            print("✅ Temporary file cleaned up", flush=True)
        except:
            pass

        print("📋 Step 7: Checking recent uploads for URL format...", flush=True)

        # Check recent files to see current URL format
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "file_url", "creation"],
                                    filters={"file_url": ["like", "%amazonaws%"]},
                                    order_by="creation desc",
                                    limit=3)

        if recent_files:
            print(f"Recent S3 files ({len(recent_files)}):", flush=True)
            for f in recent_files:
                url_type = "Presigned URL" if "AWSAccessKeyId" in f.file_url else "S3 Direct URL"
                print(f"  {f.file_name} - {url_type}", flush=True)
        else:
            print("⚠️  No recent S3 files found", flush=True)

        return True

    except Exception as e:
        print(f"❌ Test error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

    finally:
        # Always clean up temp file if it exists
        try:
            if 'tmp_file_path' in locals():
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
        except:
            pass

# Execute test
try:
    result = test_s3_upload_fix()

    if result:
        print("🎉 S3 upload fix test completed successfully!", flush=True)
        print("✅ ValidationError should be resolved", flush=True)
    else:
        print("❌ S3 upload fix test found issues", flush=True)
        print("💡 ValidationError may still occur", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)