#!/usr/bin/env python3
"""
Flansa S3 Hooks
Hooks to integrate S3 upload with Frappe's file system
"""

import frappe
from frappe.utils.file_manager import save_file_on_filesystem
from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3, delete_file_from_s3

def override_file_save():
    """Override Frappe's file save to include S3 upload"""

    # Store the original save_file_on_filesystem function
    original_save_file = save_file_on_filesystem

    def save_file_with_s3(fname, content, dt, dn, folder=None, decode_base64=False, is_private=0, df=None):
        """Custom file save that uploads to S3 after local save"""

        # First, save locally using Frappe's original method
        ret = original_save_file(fname, content, dt, dn, folder, decode_base64, is_private, df)

        # Check if S3 is enabled
        site_config = frappe.get_site_config()
        if not site_config.get('use_s3'):
            return ret

        try:
            # Get the file document that was just created
            file_doc = frappe.get_doc("File", ret['name'])

            # Upload to S3
            s3_url = upload_file_to_s3(file_doc, content)

            if s3_url:
                # Update file document with S3 URL
                file_doc.file_url = s3_url
                file_doc.save(ignore_permissions=True)
                frappe.db.commit()

                # Update return value
                ret['file_url'] = s3_url

                frappe.logger().info(f"File uploaded to S3: {s3_url}")

        except Exception as e:
            # Log error but don't fail the upload - file is still saved locally
            frappe.log_error(f"S3 upload failed for {fname}: {str(e)}", "Flansa S3 Hook")
            frappe.logger().error(f"S3 upload failed: {str(e)}")

        return ret

    # Replace the original function
    import frappe.utils.file_manager
    frappe.utils.file_manager.save_file_on_filesystem = save_file_with_s3

    # Also replace in frappe.handler if it exists
    try:
        import frappe.handler
        if hasattr(frappe.handler, 'save_file_on_filesystem'):
            frappe.handler.save_file_on_filesystem = save_file_with_s3
    except:
        pass


def on_file_delete(doc, method):
    """Hook called when a File document is deleted"""
    try:
        site_config = frappe.get_site_config()
        if site_config.get('use_s3') and doc.file_url:
            # Delete from S3 if it's an S3 file (both presigned and direct URLs)
            if 's3.amazonaws.com' in doc.file_url or 's3.' in doc.file_url:
                frappe.logger().info(f"Deleting S3 file: {doc.file_name}")
                delete_file_from_s3(doc.file_url)
                frappe.logger().info(f"Successfully deleted S3 file: {doc.file_name}")
    except Exception as e:
        error_msg = f"Error deleting S3 file {doc.file_name}: {str(e)}"
        frappe.log_error(error_msg, "Flansa S3 Delete Hook")
        frappe.logger().error(error_msg)


def init_s3_integration():
    """Initialize S3 integration when Frappe starts"""
    try:
        site_config = frappe.get_site_config()
        if site_config.get('use_s3'):
            override_file_save()

            # Also override the upload_file API endpoint
            from flansa.flansa_core.s3_integration.api_hooks import override_upload_api
            override_upload_api()

            frappe.logger().info("Flansa S3 integration initialized (file manager + API)")
    except Exception as e:
        frappe.log_error(f"Failed to initialize S3 integration: {str(e)}", "Flansa S3 Init")