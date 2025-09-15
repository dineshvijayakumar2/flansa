#!/usr/bin/env python3
"""
Test S3 Integration After Real Upload
Check if files uploaded through web interface get S3 processing
"""

print("🔍 TEST S3 INTEGRATION AFTER REAL UPLOAD", flush=True)
print("=" * 50, flush=True)

def test_s3_after_upload():
    """Test S3 integration after real upload"""
    import frappe

    try:
        print("📋 Step 1: Getting the most recent file upload...", flush=True)

        # Get the most recent file (should be the one just uploaded)
        recent_files = frappe.get_all("File",
                                     fields=["name", "file_name", "file_url", "creation", "is_private"],
                                     order_by="creation desc",
                                     limit=1)

        if not recent_files:
            print("❌ No files found", flush=True)
            return False

        file_doc = frappe.get_doc("File", recent_files[0].name)
        print(f"📄 Most recent file: {file_doc.file_name}", flush=True)
        print(f"📄 Current URL: {file_doc.file_url}", flush=True)
        print(f"📄 Uploaded: {file_doc.creation}", flush=True)

        # Check if it's already in S3
        if 's3' in file_doc.file_url.lower():
            print("✅ File is already in S3!", flush=True)
            return True

        print("📋 Step 2: File is in local storage, uploading to S3...", flush=True)

        # Get the file content
        file_path = file_doc.get_full_path()
        print(f"📄 Local path: {file_path}", flush=True)

        if not file_path or not frappe.utils.os.path.exists(file_path):
            print("❌ File not found locally", flush=True)
            return False

        with open(file_path, 'rb') as f:
            file_content = f.read()

        print(f"📄 File size: {len(file_content)} bytes", flush=True)

        # Upload to S3
        from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3
        s3_url = upload_file_to_s3(file_doc, file_content)

        if s3_url:
            print(f"✅ S3 upload successful!", flush=True)
            print(f"📄 S3 URL: {s3_url}", flush=True)

            # Update the file document
            file_doc.file_url = s3_url
            file_doc.save(ignore_permissions=True)
            frappe.db.commit()

            print("✅ File document updated with S3 URL", flush=True)
            print("", flush=True)
            print("🎉 SUCCESS! The file is now served from S3", flush=True)
            return True
        else:
            print("❌ S3 upload failed", flush=True)
            return False

    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute the test
try:
    result = test_s3_after_upload()

    if result:
        print("🎉 S3 integration test completed successfully!", flush=True)
    else:
        print("❌ S3 integration test failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)