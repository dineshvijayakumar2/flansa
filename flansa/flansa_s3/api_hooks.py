#!/usr/bin/env python3
"""
Flansa S3 API Hooks
Override Frappe's upload_file API to include S3 upload
"""

import frappe
from frappe.handler import upload_file as original_upload_file
from .s3_upload import upload_file_to_s3

@frappe.whitelist()
def upload_file_with_s3():
    """Custom upload_file API that uploads to S3 after local save"""

    # First, use Frappe's original upload_file
    result = original_upload_file()

    # Check if S3 is enabled
    site_config = frappe.get_site_config()
    if not site_config.get('use_s3'):
        return result

    try:
        # Get the file document that was just created
        if result and result.get('name'):
            file_doc = frappe.get_doc("File", result['name'])

            # Get the file content
            file_path = file_doc.get_full_path()

            if not file_path or not frappe.utils.os.path.exists(file_path):
                frappe.logger().error(f"File path not found: {file_path}")
                return result

            with open(file_path, 'rb') as f:
                file_content = f.read()

            # Upload to S3
            s3_url = upload_file_to_s3(file_doc, file_content)

            if s3_url:
                # Update file document with S3 URL
                file_doc.file_url = s3_url
                file_doc.save(ignore_permissions=True)
                frappe.db.commit()

                # Update result
                result['file_url'] = s3_url

                frappe.logger().info(f"API upload to S3 successful: {s3_url}")
            else:
                frappe.logger().error("S3 upload returned None - check logs for errors")

    except Exception as e:
        # Log error but don't fail the upload - file is still saved locally
        frappe.log_error(f"S3 upload failed in API hook: {str(e)}", "Flansa S3 API Hook")
        frappe.logger().error(f"S3 API upload failed: {str(e)}")
        import traceback
        frappe.logger().error(f"S3 API traceback: {traceback.format_exc()}")

    return result

def override_upload_api():
    """Override Frappe's upload_file API"""
    import frappe.handler

    # Replace the upload_file function
    frappe.handler.upload_file = upload_file_with_s3

    frappe.logger().info("Frappe upload_file API overridden with S3 integration")