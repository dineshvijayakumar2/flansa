#!/usr/bin/env python3
"""
Flansa S3 API Hooks
Override Frappe's upload_file API to include S3 upload
"""

import frappe
from frappe.handler import upload_file as original_upload_file
from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3

@frappe.whitelist()
def upload_file_with_s3():
    """Custom upload_file API that uploads to S3 after local save - WITH DEBUG LOGGING"""

    frappe.logger().info("🔍 DEBUG: upload_file_with_s3 called!")
    print("🔍 DEBUG: upload_file_with_s3 called!", flush=True)

    try:
        # First, use Frappe's original upload_file
        frappe.logger().info("🔍 DEBUG: Calling original_upload_file")
        result = original_upload_file()
        frappe.logger().info(f"🔍 DEBUG: Original upload result: {result}")
        print(f"🔍 DEBUG: Original upload successful: {result}", flush=True)

    except Exception as e:
        error_msg = f"🔍 DEBUG: Original upload failed: {str(e)}"
        frappe.logger().error(error_msg)
        print(error_msg, flush=True)
        raise  # Re-raise the exception

    # Check if S3 is enabled
    site_config = frappe.get_site_config()
    if not site_config.get('use_s3'):
        frappe.logger().info("🔍 DEBUG: S3 not enabled, returning original result")
        print("🔍 DEBUG: S3 not enabled", flush=True)
        return result

    frappe.logger().info("🔍 DEBUG: S3 is enabled, proceeding with S3 upload")
    print("🔍 DEBUG: S3 enabled, uploading to S3...", flush=True)

    try:
        # Get the file document that was just created
        if result and result.get('name'):
            frappe.logger().info(f"🔍 DEBUG: Getting file doc: {result['name']}")
            print(f"🔍 DEBUG: Getting file doc: {result['name']}", flush=True)
            file_doc = frappe.get_doc("File", result['name'])

            # Get the file content
            file_path = file_doc.get_full_path()
            frappe.logger().info(f"🔍 DEBUG: File path: {file_path}")

            if not file_path or not frappe.utils.os.path.exists(file_path):
                error_msg = f"🔍 DEBUG: File path not found: {file_path}"
                frappe.logger().error(error_msg)
                print(error_msg, flush=True)
                return result

            with open(file_path, 'rb') as f:
                file_content = f.read()

            frappe.logger().info(f"🔍 DEBUG: File content loaded, size: {len(file_content)} bytes")
            print(f"🔍 DEBUG: File loaded, {len(file_content)} bytes", flush=True)

            # Use the new S3 processing with organized structure
            frappe.logger().info("🔍 DEBUG: Calling process_s3_upload_safe with new structure")
            from flansa.flansa_core.s3_integration.doc_events import process_s3_upload_safe

            process_s3_upload_safe(file_doc)

            # Reload the file doc to get the updated S3 URL
            file_doc.reload()

            if file_doc.file_url and ('s3://' in file_doc.file_url or 'amazonaws' in file_doc.file_url.lower()):
                frappe.logger().info(f"🔍 DEBUG: S3 upload successful with new structure")
                print(f"🔍 DEBUG: S3 upload successful with new organized structure!", flush=True)

                # Update result with new S3 URL
                result['file_url'] = file_doc.file_url

                frappe.logger().info(f"🔍 DEBUG: File now in organized S3 structure")
                print("🔍 DEBUG: File organized in new S3 structure", flush=True)
            else:
                error_msg = "🔍 DEBUG: S3 upload with new structure failed"
                frappe.logger().error(error_msg)
                print(error_msg, flush=True)

        else:
            error_msg = "🔍 DEBUG: No file name in result"
            frappe.logger().error(error_msg)
            print(error_msg, flush=True)

    except Exception as e:
        # Log error but don't fail the upload - file is still saved locally
        error_msg = f"🔍 DEBUG: S3 upload failed: {str(e)}"
        frappe.log_error(f"S3 upload failed in API hook: {str(e)}", "Flansa S3 API Hook")
        frappe.logger().error(error_msg)
        print(error_msg, flush=True)
        import traceback
        traceback_msg = f"🔍 DEBUG: Traceback: {traceback.format_exc()}"
        frappe.logger().error(traceback_msg)
        print(traceback_msg, flush=True)

    frappe.logger().info("🔍 DEBUG: upload_file_with_s3 completed")
    print("🔍 DEBUG: Upload function completed", flush=True)
    return result

def override_upload_api():
    """Override Frappe's upload_file API"""
    import frappe.handler

    # Replace the upload_file function
    frappe.handler.upload_file = upload_file_with_s3

    frappe.logger().info("Frappe upload_file API overridden with S3 integration")