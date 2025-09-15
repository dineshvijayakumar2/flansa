#!/usr/bin/env python3
"""
Flansa Attachment API - Handle file attachments for records
"""

import frappe
from frappe import _

@frappe.whitelist()
def attach_uploaded_files(doctype, docname, file_urls_json):
    """
    Attach uploaded files to a saved record

    Args:
        doctype: The doctype to attach files to
        docname: The document name to attach files to
        file_urls_json: JSON string of file URLs to attach
    """
    try:
        import json

        if not doctype or not docname:
            return {"success": False, "error": "Missing doctype or docname"}

        if not file_urls_json:
            return {"success": True, "message": "No files to attach"}

        # Parse file URLs
        try:
            file_urls = json.loads(file_urls_json)
            if not isinstance(file_urls, list):
                file_urls = [file_urls]
        except json.JSONDecodeError:
            return {"success": False, "error": "Invalid file URLs JSON"}

        attached_count = 0

        for file_url in file_urls:
            if not file_url or not isinstance(file_url, str):
                continue

            # Find the file record by URL
            file_doc = frappe.db.get_value("File", {"file_url": file_url}, "name")
            if file_doc:
                # Update the file to attach it to the record
                frappe.db.set_value("File", file_doc, {
                    "attached_to_doctype": doctype,
                    "attached_to_name": docname
                })
                attached_count += 1

        frappe.db.commit()

        return {
            "success": True,
            "message": f"Successfully attached {attached_count} file(s) to {doctype} {docname}",
            "attached_count": attached_count
        }

    except Exception as e:
        frappe.log_error(f"Error attaching files: {str(e)}", "Attachment API")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_attachment_info(file_url):
    """
    Get attachment information for a file URL

    Args:
        file_url: The file URL to get info for
    """
    try:
        if not file_url:
            return {"success": False, "error": "File URL is required"}

        file_info = frappe.db.get_value("File",
                                       {"file_url": file_url},
                                       ["name", "file_name", "file_size", "is_private",
                                        "attached_to_doctype", "attached_to_name", "creation"],
                                       as_dict=True)

        if file_info:
            return {
                "success": True,
                "file_info": file_info
            }
        else:
            return {"success": False, "error": "File not found"}

    except Exception as e:
        frappe.log_error(f"Error getting attachment info: {str(e)}", "Attachment API")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def check_s3_configuration():
    """
    Check if S3 is properly configured for file uploads
    """
    try:
        site_config = frappe.get_site_config()

        s3_configured = bool(
            site_config.get('s3_bucket') and
            site_config.get('aws_access_key_id') and
            site_config.get('aws_secret_access_key')
        )

        # Also check System Settings
        system_settings = frappe.get_single("System Settings")
        file_storage = getattr(system_settings, 'file_storage', 'Local')

        return {
            "success": True,
            "s3_configured": s3_configured,
            "file_storage": file_storage,
            "s3_bucket": site_config.get('s3_bucket', ''),
            "aws_region": site_config.get('aws_region', 'us-east-1')
        }

    except Exception as e:
        frappe.log_error(f"Error checking S3 configuration: {str(e)}", "Attachment API")
        return {"success": False, "error": str(e)}