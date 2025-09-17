import frappe
from frappe import _

@frappe.whitelist()
def remove_attachment(doctype, name, fieldname, file_url):
    """
    Properly remove an attachment by deleting the File document

    Args:
        doctype: The doctype of the record
        name: The name of the record
        fieldname: The field containing the attachment
        file_url: The URL of the file to remove
    """
    try:
        # Check permissions
        if not frappe.has_permission(doctype, "write", doc=name):
            frappe.throw(_("Not permitted to modify {0}").format(name))

        # Find the File document
        if file_url:
            # Handle both local and S3 URLs
            file_docs = frappe.get_all("File",
                                      filters={
                                          "file_url": file_url,
                                          "attached_to_doctype": doctype,
                                          "attached_to_name": name
                                      },
                                      pluck="name")

            # Delete the File document(s)
            for file_name in file_docs:
                try:
                    frappe.delete_doc("File", file_name, force=True)
                    frappe.logger().info(f"Deleted File document: {file_name}")
                except Exception as e:
                    frappe.logger().error(f"Failed to delete File {file_name}: {str(e)}")

        # Clear the field value
        frappe.db.set_value(doctype, name, fieldname, None)
        frappe.db.commit()

        return {
            "success": True,
            "message": "Attachment removed successfully"
        }

    except Exception as e:
        frappe.logger().error(f"Error removing attachment: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }