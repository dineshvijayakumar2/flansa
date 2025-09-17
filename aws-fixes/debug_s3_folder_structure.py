#!/usr/bin/env python3
"""
Debug S3 Folder Structure Issue
Check why files are uploading to root instead of organized structure
"""

print("🔍 DEBUGGING S3 FOLDER STRUCTURE", flush=True)
print("=" * 50, flush=True)

def debug_s3_structure():
    """Debug why organized folder structure isn't working"""
    import frappe
    from datetime import datetime

    try:
        print("📋 Step 1: Testing S3 key generation function...", flush=True)

        # Import the function
        from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key

        # Create a mock file doc
        class MockFile:
            def __init__(self):
                self.name = "test123"
                self.file_name = "test_document.pdf"
                self.creation = datetime.now()
                self.attached_to_doctype = "test_customers_tbl"
                self.attached_to_name = "REC-001"

        mock_file = MockFile()
        base_folder = "flansa-files"

        print("🧪 Testing with mock file:", flush=True)
        print(f"  File: {mock_file.file_name}", flush=True)
        print(f"  DocType: {mock_file.attached_to_doctype}", flush=True)

        # Test key generation
        generated_key = _generate_s3_key(base_folder, mock_file)
        print(f"✅ Generated S3 key: {generated_key}", flush=True)

        # Check if it's organized or flat
        if '/' in generated_key and 'attachments' in generated_key:
            print("✅ Using organized structure", flush=True)
        else:
            print("❌ Using flat structure (fallback)", flush=True)

        print("\n📋 Step 2: Testing workspace context...", flush=True)

        try:
            from flansa.flansa_core.workspace_service import WorkspaceContext
            workspace = WorkspaceContext.get_current_workspace_id()
            print(f"✅ Current workspace: {workspace}", flush=True)
        except Exception as e:
            print(f"❌ Workspace context error: {e}", flush=True)
            print("💡 This might cause 'default' workspace in path", flush=True)

        print("\n📋 Step 3: Checking recent S3 uploads...", flush=True)

        # Get recent S3 files
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "file_url", "creation",
                                           "attached_to_doctype", "attached_to_name"],
                                    filters={"file_url": ["like", "%amazonaws%"]},
                                    order_by="creation desc",
                                    limit=5)

        if recent_files:
            print(f"📁 Recent S3 files ({len(recent_files)}):", flush=True)

            for f in recent_files:
                print(f"\n  File: {f.file_name}", flush=True)
                print(f"    Attached to: {f.attached_to_doctype or 'None'}", flush=True)

                if f.file_url:
                    # Parse S3 URL to get key
                    url_parts = f.file_url.split('?')[0].split('/')
                    if len(url_parts) > 3:
                        s3_key = '/'.join(url_parts[3:])
                        print(f"    S3 Key: {s3_key}", flush=True)

                        # Check structure
                        key_parts = s3_key.split('/')
                        if len(key_parts) == 2:
                            print("    Structure: 🔴 Flat (root/file)", flush=True)
                        elif 'attachments' in key_parts:
                            print("    Structure: 🟢 Organized", flush=True)
                        else:
                            print("    Structure: 🟡 Unknown", flush=True)

        print("\n📋 Step 4: Testing direct upload with organized structure...", flush=True)

        # Test if we can generate the right key for a real recent file
        if recent_files and recent_files[0].attached_to_doctype:
            test_file = recent_files[0]

            class RealMockFile:
                def __init__(self, f):
                    self.name = f.name
                    self.file_name = f.file_name
                    self.creation = f.creation
                    self.attached_to_doctype = f.attached_to_doctype
                    self.attached_to_name = f.attached_to_name

            real_mock = RealMockFile(test_file)
            expected_key = _generate_s3_key(base_folder, real_mock)

            print(f"\n  Testing with real file: {test_file.file_name}", flush=True)
            print(f"  Expected S3 key: {expected_key}", flush=True)

            # Check if it matches actual
            if test_file.file_url:
                url_parts = test_file.file_url.split('?')[0].split('/')
                if len(url_parts) > 3:
                    actual_key = '/'.join(url_parts[3:])
                    print(f"  Actual S3 key:   {actual_key}", flush=True)

                    if expected_key == actual_key:
                        print("  ✅ Keys match!", flush=True)
                    else:
                        print("  ❌ Keys don't match - structure issue", flush=True)

        print("\n📋 Step 5: Checking if S3 upload is using the correct function...", flush=True)

        # Check if the upload function is using _generate_s3_key
        from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3
        import inspect

        source = inspect.getsource(upload_file_to_s3)
        if '_generate_s3_key' in source:
            print("✅ upload_file_to_s3 uses _generate_s3_key function", flush=True)
        else:
            print("❌ upload_file_to_s3 doesn't use _generate_s3_key function", flush=True)

        return True

    except Exception as e:
        print(f"❌ Debug error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute debug
try:
    result = debug_s3_structure()

    if result:
        print("\n🎯 Recommendations:", flush=True)
        print("1. Check if file_doc has all required attributes", flush=True)
        print("2. Ensure workspace context is available", flush=True)
        print("3. Verify _generate_s3_key isn't hitting fallback", flush=True)
    else:
        print("\n❌ Debug script found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)