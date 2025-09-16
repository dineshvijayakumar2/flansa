#!/usr/bin/env python3
"""
Flansa S3 Document Events
Process files after upload to move them to S3
"""

import frappe
from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3

def upload_to_s3_after_insert(doc, method):
    """Upload file to S3 after it's inserted in the database"""

    # Check if S3 is enabled
    site_config = frappe.get_site_config()
    if not site_config.get('use_s3'):
        return

    try:
        # Skip if already on S3
        if doc.file_url and ('s3' in doc.file_url.lower() or 'amazonaws' in doc.file_url.lower()):
            frappe.logger().info(f"File {doc.name} already on S3, skipping")
            return

        # Skip if no local file
        if not doc.file_url or not doc.file_url.startswith('/'):
            frappe.logger().info(f"File {doc.name} has no local URL, skipping")
            return

        frappe.logger().info(f"Processing file {doc.name} for S3 upload")

        # Get the file content
        file_path = doc.get_full_path()

        if not file_path or not frappe.utils.os.path.exists(file_path):
            frappe.logger().error(f"File path not found: {file_path}")
            return

        with open(file_path, 'rb') as f:
            file_content = f.read()

        frappe.logger().info(f"Uploading {doc.file_name} to S3 ({len(file_content)} bytes)")

        # Upload to S3
        s3_url = upload_file_to_s3(doc, file_content)

        if s3_url:
            # Update file document with S3 URL
            frappe.db.set_value('File', doc.name, 'file_url', s3_url, update_modified=False)
            frappe.db.commit()

            frappe.logger().info(f"✅ File {doc.name} uploaded to S3: {s3_url}")

            # Optionally delete local file after successful S3 upload
            # import os
            # if os.path.exists(file_path):
            #     os.remove(file_path)
            #     frappe.logger().info(f"Deleted local file: {file_path}")
        else:
            frappe.logger().error(f"Failed to upload {doc.name} to S3")

    except Exception as e:
        frappe.log_error(f"S3 upload failed for file {doc.name}: {str(e)}", "Flansa S3 Doc Event")
        frappe.logger().error(f"S3 doc event failed: {str(e)}")
        import traceback
        frappe.logger().error(f"Traceback: {traceback.format_exc()}")