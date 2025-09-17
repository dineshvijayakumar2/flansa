#!/usr/bin/env python3
"""
Debug Upload Flow - Test S3 Integration End-to-End
Check if uploads from record viewer are processed correctly
"""

print("🔍 DEBUGGING UPLOAD FLOW", flush=True)
print("=" * 50, flush=True)

def debug_upload_flow():
    """Debug the complete upload flow"""
    import frappe

    try:
        print("📋 Step 1: Checking API override registration...", flush=True)

        # Check if API override is registered
        override_methods = frappe.get_hooks("override_whitelisted_methods")
        upload_override = override_methods.get("frappe.handler.upload_file")

        if upload_override:
            print(f"✅ Upload API override registered: {upload_override}", flush=True)
        else:
            print("❌ Upload API override NOT registered", flush=True)
            return False

        print("📋 Step 2: Checking doc_events hook registration...", flush=True)

        doc_events = frappe.get_hooks("doc_events")
        file_hooks = doc_events.get("File", {})
        after_insert = file_hooks.get('after_insert', [])
        on_trash = file_hooks.get('on_trash', [])

        s3_insert_hook = 'flansa.flansa_core.s3_integration.doc_events.upload_to_s3_after_insert' in after_insert
        s3_delete_hook = 'flansa.flansa_core.s3_integration.hooks.on_file_delete' in on_trash

        print(f"✅ S3 after_insert hook: {'REGISTERED' if s3_insert_hook else 'NOT REGISTERED'}", flush=True)
        print(f"✅ S3 on_trash hook: {'REGISTERED' if s3_delete_hook else 'NOT REGISTERED'}", flush=True)

        print("📋 Step 3: Testing API override import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.api_hooks import upload_file_with_s3
            print("✅ API hook function imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ API hook import failed: {e}", flush=True)
            return False

        print("📋 Step 4: Testing doc_events import...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.doc_events import upload_to_s3_after_insert, process_s3_upload_safe
            print("✅ Doc events functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ Doc events import failed: {e}", flush=True)
            return False

        print("📋 Step 5: Checking recent file uploads...", flush=True)

        # Get recent files to see current upload behavior
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "file_url", "creation", "attached_to_doctype", "attached_to_name"],
                                    order_by="creation desc",
                                    limit=5)

        print(f"Recent files ({len(recent_files)}):", flush=True)
        for f in recent_files:
            is_s3 = 'amazonaws' in f.file_url.lower() if f.file_url else False
            is_organized = False

            if is_s3:
                # Check if it follows the new organized structure
                url_parts = f.file_url.split('/')
                if len(url_parts) >= 7 and 'attachments' in url_parts:
                    is_organized = True

            status = "Organized S3" if is_organized else ("Flat S3" if is_s3 else "Local")
            attached_info = f"→ {f.attached_to_doctype}:{f.attached_to_name}" if f.attached_to_doctype else "→ No attachment"

            print(f"  {f.file_name} ({f.creation})", flush=True)
            print(f"    Status: {status} {attached_info}", flush=True)

        print("📋 Step 6: Testing workspace context...", flush=True)

        try:
            from flansa.flansa_core.workspace_service import WorkspaceContext
            current_workspace = WorkspaceContext.get_current_workspace_id()
            print(f"✅ Current workspace: {current_workspace}", flush=True)
        except Exception as e:
            print(f"⚠️  Workspace context error: {e}", flush=True)

        print("📋 Step 7: Testing S3 key generation...", flush=True)

        if recent_files:
            test_file = recent_files[0]
            print(f"Testing with file: {test_file.file_name}", flush=True)

            try:
                from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key

                # Create mock file doc
                class MockFile:
                    def __init__(self, file_info):
                        self.name = file_info.name
                        self.file_name = file_info.file_name
                        self.creation = file_info.creation
                        self.attached_to_doctype = file_info.attached_to_doctype

                mock_file = MockFile(test_file)
                base_folder = "flansa-files"

                generated_key = _generate_s3_key(base_folder, mock_file)
                print(f"  Expected S3 key: {generated_key}", flush=True)

                if test_file.file_url and 'amazonaws' in test_file.file_url.lower():
                    current_url = test_file.file_url.split('?')[0]  # Remove query params
                    url_parts = current_url.split('/')
                    current_key = '/'.join(url_parts[3:]) if len(url_parts) > 3 else "unknown"
                    print(f"  Actual S3 key: {current_key}", flush=True)

                    if generated_key in current_key or current_key in generated_key:
                        print(f"  ✅ Structure matches or is similar", flush=True)
                    else:
                        print(f"  ❌ Structure mismatch - using flat structure", flush=True)

            except Exception as e:
                print(f"  ❌ Error testing S3 key generation: {e}", flush=True)

        print("📋 Step 8: Recommendations...", flush=True)

        organized_count = 0
        flat_count = 0
        local_count = 0

        for f in recent_files:
            if f.file_url:
                if 'amazonaws' in f.file_url.lower():
                    url_parts = f.file_url.split('/')
                    if len(url_parts) >= 7 and 'attachments' in url_parts:
                        organized_count += 1
                    else:
                        flat_count += 1
                else:
                    local_count += 1

        print(f"📊 Upload structure analysis:", flush=True)
        print(f"  Organized S3: {organized_count}/{len(recent_files)}", flush=True)
        print(f"  Flat S3: {flat_count}/{len(recent_files)}", flush=True)
        print(f"  Local: {local_count}/{len(recent_files)}", flush=True)

        if organized_count > 0:
            print("✅ Auto-categorization is working!", flush=True)
        elif flat_count > 0:
            print("⚠️  Files uploading to S3 but using flat structure", flush=True)
            print("💡 Recommendations:", flush=True)
            print("  1. Clear cache: bench clear-cache", flush=True)
            print("  2. Restart: bench restart", flush=True)
            print("  3. Check if API override is active", flush=True)
        else:
            print("ℹ️  Upload a test file to check current behavior", flush=True)

        return True

    except Exception as e:
        print(f"❌ Debug error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute debug
try:
    result = debug_upload_flow()

    if result:
        print("🎉 Upload flow debug completed!", flush=True)
    else:
        print("❌ Upload flow debug found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)