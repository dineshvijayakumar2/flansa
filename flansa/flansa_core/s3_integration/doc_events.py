#!/usr/bin/env python3
"""
Flansa S3 Document Events
Process files after upload to move them to S3
"""

import frappe
from flansa.flansa_core.s3_integration.s3_upload import upload_file_to_s3

def upload_to_s3_after_insert(doc, method):
    """Upload file to S3 after it's inserted in the database - DIRECT VERSION"""

    try:
        # Quick checks first - never let S3 processing break file uploads
        site_config = frappe.get_site_config()
        if not site_config.get('use_s3'):
            return

        # Skip if already on S3
        if doc.file_url and ('s3://' in doc.file_url or 'amazonaws' in doc.file_url.lower()):
            return

        # Skip if no local file URL
        if not doc.file_url or not doc.file_url.startswith('/'):
            return

        # Process S3 upload directly but safely
        process_s3_upload_safe(doc)

    except Exception as e:
        # Never let S3 processing break file uploads
        frappe.logger().error(f"S3 hook error (non-blocking): {str(e)}")


def process_s3_upload_safe(doc):
    """Safe S3 processing that won't break file uploads"""

    try:
        frappe.logger().info(f"Processing file {doc.name} for S3 upload")

        # Get file content safely
        try:
            file_path = doc.get_full_path()

            if not file_path or not frappe.utils.os.path.exists(file_path):
                frappe.logger().error(f"File not found for S3 upload: {file_path}")
                return

            with open(file_path, 'rb') as f:
                file_content = f.read()

            frappe.logger().info(f"Uploading {doc.file_name} to S3 ({len(file_content)} bytes)")

            # Upload to S3
            s3_url = upload_file_to_s3(doc, file_content)

            if s3_url:
                # Update file document
                frappe.db.set_value('File', doc.name, 'file_url', s3_url, update_modified=False)

                # Update parent record if attached
                if doc.attached_to_doctype and doc.attached_to_name and doc.attached_to_field:
                    try:
                        frappe.db.set_value(
                            doc.attached_to_doctype,
                            doc.attached_to_name,
                            doc.attached_to_field,
                            s3_url,
                            update_modified=False
                        )
                        frappe.logger().info(f"Updated parent record with S3 URL: {doc.attached_to_doctype}/{doc.attached_to_name}")
                    except Exception as e:
                        frappe.logger().error(f"Failed to update parent record: {str(e)}")

                frappe.db.commit()
                frappe.logger().info(f"✅ File {doc.name} successfully uploaded to S3")
            else:
                frappe.logger().error(f"S3 upload returned None for {doc.name}")

        except Exception as e:
            frappe.logger().error(f"Error processing file {doc.name}: {str(e)}")

    except Exception as e:
        frappe.logger().error(f"S3 upload processing failed: {str(e)}")


def process_s3_upload_background(doc_name):
    """Background S3 processing that won't break file uploads"""

    try:
        # Get the file document
        doc = frappe.get_doc("File", doc_name)

        # Double-check it's still a local file
        if not doc.file_url or not doc.file_url.startswith('/'):
            return

        if 's3://' in doc.file_url or 'amazonaws' in doc.file_url.lower():
            return

        frappe.logger().info(f"Processing file {doc.name} for S3 upload in background")

        # Get file content safely
        try:
            file_path = doc.get_full_path()

            if not file_path or not frappe.utils.os.path.exists(file_path):
                frappe.logger().error(f"File not found for S3 upload: {file_path}")
                return

            with open(file_path, 'rb') as f:
                file_content = f.read()

            frappe.logger().info(f"Uploading {doc.file_name} to S3 ({len(file_content)} bytes)")

            # Upload to S3
            s3_url = upload_file_to_s3(doc, file_content)

            if s3_url:
                # Update file document
                frappe.db.set_value('File', doc.name, 'file_url', s3_url, update_modified=False)

                # Update parent record if attached
                if doc.attached_to_doctype and doc.attached_to_name and doc.attached_to_field:
                    try:
                        frappe.db.set_value(
                            doc.attached_to_doctype,
                            doc.attached_to_name,
                            doc.attached_to_field,
                            s3_url,
                            update_modified=False
                        )
                        frappe.logger().info(f"Updated parent record with S3 URL: {doc.attached_to_doctype}/{doc.attached_to_name}")
                    except Exception as e:
                        frappe.logger().error(f"Failed to update parent record: {str(e)}")

                frappe.db.commit()
                frappe.logger().info(f"✅ File {doc.name} successfully uploaded to S3")
            else:
                frappe.logger().error(f"S3 upload returned None for {doc.name}")

        except Exception as e:
            frappe.logger().error(f"Error processing file {doc.name}: {str(e)}")

    except Exception as e:
        frappe.log_error(f"Background S3 upload failed for {doc_name}: {str(e)}", "S3 Background Upload")
        frappe.logger().error(f"Background S3 upload failed: {str(e)}")