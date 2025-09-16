#!/usr/bin/env python3
"""
Test Upload API with New S3 Structure
Verify that file uploads via API use the new organized structure
"""

print("🔍 TESTING UPLOAD API WITH NEW S3 STRUCTURE", flush=True)
print("=" * 50, flush=True)

def test_upload_api_with_new_structure():
    """Test that upload API uses new organized S3 structure"""
    import frappe

    try:
        print("📋 Step 1: Checking API override registration...", flush=True)

        # Check if the API override is registered
        override_methods = frappe.get_hooks("override_whitelisted_methods")
        upload_override = override_methods.get("frappe.handler.upload_file")

        if upload_override:
            print(f"✅ Upload API override registered: {upload_override}", flush=True)
        else:
            print("❌ Upload API override not registered", flush=True)
            return False

        print("📋 Step 2: Checking S3 configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')

        if not use_s3:
            print("❌ S3 not enabled in site config", flush=True)
            return False

        print(f"✅ S3 enabled: {use_s3}", flush=True)

        print("📋 Step 3: Testing API function import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.api_hooks import upload_file_with_s3
            print("✅ API hook function imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ API hook function import failed: {e}", flush=True)
            return False

        print("📋 Step 4: Testing process_s3_upload_safe import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.doc_events import process_s3_upload_safe
            print("✅ New S3 processing function imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ New S3 processing function import failed: {e}", flush=True)
            return False

        print("📋 Step 5: Checking recent file uploads...", flush=True)

        # Get recent files uploaded via API
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "file_url", "creation", "attached_to_doctype"],
                                    order_by="creation desc",
                                    limit=3)

        print(f"Recent files ({len(recent_files)}):", flush=True)
        for f in recent_files:
            is_local = f.file_url and f.file_url.startswith('/')
            is_s3 = 'amazonaws' in f.file_url.lower() if f.file_url else False
            is_organized = False

            if is_s3:
                # Check if it follows the new organized structure
                # Structure: flansa-files/{workspace_id}/attachments/{table_id}/year/month/file
                url_parts = f.file_url.split('/')
                if len(url_parts) >= 7 and 'attachments' in url_parts:
                    is_organized = True

            status = "Organized S3" if is_organized else ("S3 (flat)" if is_s3 else ("Local" if is_local else "Unknown"))

            print(f"  {f.file_name} ({f.creation})", flush=True)
            print(f"    Status: {status}", flush=True)
            if is_s3:
                print(f"    URL: {f.file_url[:100]}{'...' if len(f.file_url) > 100 else ''}", flush=True)

        print("📋 Step 6: API integration status...", flush=True)

        organized_count = 0
        flat_s3_count = 0
        local_count = 0

        for f in recent_files:
            if f.file_url:
                if 'amazonaws' in f.file_url.lower():
                    url_parts = f.file_url.split('/')
                    if len(url_parts) >= 7 and 'attachments' in url_parts:
                        organized_count += 1
                    else:
                        flat_s3_count += 1
                elif f.file_url.startswith('/'):
                    local_count += 1

        print(f"✅ File upload structure analysis:", flush=True)
        print(f"  Organized S3 structure: {organized_count}/{len(recent_files)} files", flush=True)
        print(f"  Flat S3 structure: {flat_s3_count}/{len(recent_files)} files", flush=True)
        print(f"  Local storage: {local_count}/{len(recent_files)} files", flush=True)

        print("📋 Step 7: Testing workspace context integration...", flush=True)

        try:
            from flansa.flansa_core.workspace_service import WorkspaceContext
            current_workspace = WorkspaceContext.get_current_workspace_id()
            print(f"✅ Current workspace for uploads: {current_workspace}", flush=True)
        except Exception as e:
            print(f"⚠️  Workspace context error: {e}", flush=True)

        print("📋 Step 8: Recommendations...", flush=True)

        if organized_count > 0:
            print("✅ API is using the new organized S3 structure!", flush=True)
        elif flat_s3_count > 0:
            print("⚠️  API is still using flat S3 structure", flush=True)
            print("💡 Recommendation: Clear cache and restart to apply API override", flush=True)
        else:
            print("ℹ️  Upload a test file through Flansa viewer to verify structure", flush=True)

        return True

    except Exception as e:
        print(f"❌ Test error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute test
try:
    result = test_upload_api_with_new_structure()

    if result:
        print("🎉 Upload API test completed!", flush=True)
    else:
        print("❌ Upload API test found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)