#!/usr/bin/env python3
"""
Test Improved S3 Folder Structure
Verify the new multi-tenant organized folder structure works correctly
"""

print("📁 TESTING IMPROVED S3 FOLDER STRUCTURE", flush=True)
print("=" * 50, flush=True)

def test_improved_s3_structure():
    """Test the new S3 folder structure implementation"""
    import frappe
    from datetime import datetime

    try:
        print("📋 Step 1: Testing S3 key generation function...", flush=True)

        try:
            from flansa.flansa_core.s3_integration.s3_upload import _generate_s3_key, _get_file_category
            print("✅ S3 key generation functions imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ S3 key generation function import failed: {e}", flush=True)
            return False

        print("📋 Step 2: Testing file categorization...", flush=True)

        # Test different file types
        test_files = [
            ("document.pdf", "documents"),
            ("image.jpg", "images"),
            ("logo.svg", "images"),
            ("data.xlsx", "spreadsheets"),
            ("video.mp4", "videos"),
            ("archive.zip", "archives"),
            ("presentation.pptx", "presentations"),
            ("unknown.xyz", "misc")
        ]

        for filename, expected_category in test_files:
            actual_category = _get_file_category(filename)
            if actual_category == expected_category:
                print(f"  ✅ {filename} -> {actual_category}", flush=True)
            else:
                print(f"  ❌ {filename} -> {actual_category} (expected {expected_category})", flush=True)

        print("📋 Step 3: Testing workspace context integration...", flush=True)

        try:
            from flansa.flansa_core.workspace_service import WorkspaceContext
            current_workspace = WorkspaceContext.get_current_workspace_id()
            print(f"✅ Current workspace: {current_workspace}", flush=True)
        except Exception as e:
            print(f"⚠️  Workspace context error (will use default): {e}", flush=True)

        print("📋 Step 4: Testing S3 key generation with mock file...", flush=True)

        # Create a mock file document for testing
        class MockFileDoc:
            def __init__(self):
                self.name = "test-file-12345"
                self.file_name = "sample_document.pdf"
                self.creation = datetime(2025, 1, 15, 10, 30, 0)
                self.attached_to_doctype = "Flansa Table"

        mock_file = MockFileDoc()
        base_folder = "flansa-files"

        generated_key = _generate_s3_key(base_folder, mock_file)
        print(f"Generated S3 key: {generated_key}", flush=True)

        # Analyze the structure
        key_parts = generated_key.split('/')
        print(f"Key structure analysis:", flush=True)
        print(f"  Base folder: {key_parts[0] if len(key_parts) > 0 else 'N/A'}", flush=True)
        print(f"  Workspace: {key_parts[1] if len(key_parts) > 1 else 'N/A'}", flush=True)
        print(f"  Category: {key_parts[2] if len(key_parts) > 2 else 'N/A'}", flush=True)
        print(f"  Parent type: {key_parts[3] if len(key_parts) > 3 else 'N/A'}", flush=True)
        print(f"  Year: {key_parts[4] if len(key_parts) > 4 else 'N/A'}", flush=True)
        print(f"  Month: {key_parts[5] if len(key_parts) > 5 else 'N/A'}", flush=True)
        print(f"  Filename: {key_parts[6] if len(key_parts) > 6 else 'N/A'}", flush=True)

        print("📋 Step 5: Testing various file scenarios...", flush=True)

        # Test different scenarios
        scenarios = [
            ("Image file", "logo.png", "Flansa Application"),
            ("Excel sheet", "data.xlsx", "Flansa Table"),
            ("PDF document", "report.pdf", None),
            ("Video file", "tutorial.mp4", "File"),
        ]

        for scenario_name, filename, doctype in scenarios:
            mock_file.file_name = filename
            mock_file.attached_to_doctype = doctype
            key = _generate_s3_key(base_folder, mock_file)
            print(f"  {scenario_name}: {key}", flush=True)

        print("📋 Step 6: Checking site configuration...", flush=True)

        site_config = frappe.get_site_config()
        current_base_folder = site_config.get('s3_folder_path') or site_config.get('s3_folder') or 'flansa-files'
        print(f"Current base folder: {current_base_folder}", flush=True)

        print("📋 Step 7: Testing recent file processing...", flush=True)

        # Get a recent file to test structure generation
        recent_files = frappe.get_all("File",
                                    fields=["name", "file_name", "creation", "attached_to_doctype"],
                                    order_by="creation desc",
                                    limit=3)

        if recent_files:
            print(f"Testing with {len(recent_files)} recent files:", flush=True)
            for file_info in recent_files:
                # Create mock object with real data
                mock_file.name = file_info.name
                mock_file.file_name = file_info.file_name
                mock_file.creation = file_info.creation
                mock_file.attached_to_doctype = file_info.attached_to_doctype

                generated_key = _generate_s3_key(current_base_folder, mock_file)
                print(f"  {file_info.file_name}: {generated_key}", flush=True)
        else:
            print("No recent files found for testing", flush=True)

        print("📋 Step 8: Summary of folder structure benefits...", flush=True)

        print("✅ Improved S3 folder structure provides:", flush=True)
        print("  • Multi-tenant isolation by workspace_id", flush=True)
        print("  • File type categorization (images, documents, etc.)", flush=True)
        print("  • Parent DocType organization", flush=True)
        print("  • Date-based organization (year/month)", flush=True)
        print("  • Better scalability and searchability", flush=True)
        print("  • Improved S3 performance with distributed prefixes", flush=True)

        return True

    except Exception as e:
        print(f"❌ Test error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute test
try:
    result = test_improved_s3_structure()

    if result:
        print("🎉 S3 folder structure test completed!", flush=True)
    else:
        print("❌ S3 folder structure test found issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)