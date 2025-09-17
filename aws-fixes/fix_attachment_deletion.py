#!/usr/bin/env python3
"""
Fix Attachment Deletion Issue
Ensure File documents are properly deleted when attachments are removed
"""

print("🔧 FIXING ATTACHMENT DELETION", flush=True)
print("=" * 50, flush=True)

def fix_attachment_deletion():
    """Add proper File document deletion to attachment removal"""
    import frappe

    try:
        print("📋 Step 1: Creating server-side method for attachment deletion...", flush=True)

        # Create the Python method for proper attachment deletion
        api_content = '''import frappe
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
'''

        # Write the API method
        api_file_path = "/home/ubuntu/frappe-bench/apps/flansa/flansa/flansa_core/api/attachment_handler.py"
        with open(api_file_path, "w") as f:
            f.write(api_content)

        print(f"✅ Created attachment handler API: {api_file_path}", flush=True)

        print("\n📋 Step 2: Creating JavaScript update for record viewer...", flush=True)

        # JavaScript code to update the record viewer
        js_update = '''
// Update the clear_attachment method to properly delete File documents
clear_attachment(fieldName) {
    // Confirm before clearing
    frappe.confirm('Are you sure you want to remove this attachment?', () => {
        const currentValue = this.record_data[fieldName];

        if (currentValue) {
            // Call server method to properly delete the File document
            frappe.call({
                method: 'flansa.flansa_core.api.attachment_handler.remove_attachment',
                args: {
                    doctype: this.doctype,
                    name: this.record_name,
                    fieldname: fieldName,
                    file_url: currentValue
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        // Update the field value locally
                        this.record_data[fieldName] = '';

                        // Update the hidden input
                        const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
                        if (hiddenInput) {
                            hiddenInput.value = '';
                        }

                        // Refresh the attachment display
                        this.refresh_attachment_display(fieldName, '');

                        frappe.show_alert({
                            message: 'Attachment removed successfully',
                            indicator: 'green'
                        });
                    } else {
                        frappe.show_alert({
                            message: r.message?.message || 'Failed to remove attachment',
                            indicator: 'red'
                        });
                    }
                },
                error: (r) => {
                    frappe.show_alert({
                        message: 'Failed to remove attachment',
                        indicator: 'red'
                    });
                }
            });
        } else {
            // No file to remove, just clear the display
            this.record_data[fieldName] = '';
            const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
            if (hiddenInput) {
                hiddenInput.value = '';
            }
            this.refresh_attachment_display(fieldName, '');
            frappe.show_alert({
                message: 'Field cleared',
                indicator: 'green'
            });
        }
    });
}'''

        print("✅ JavaScript update prepared", flush=True)
        print("\n📋 Update needed in flansa_record_viewer.js:", flush=True)
        print("  Replace the clear_attachment method with the new version above", flush=True)

        print("\n📋 Step 3: Testing orphaned File documents...", flush=True)

        # Check for orphaned File documents
        orphaned_files = frappe.db.sql("""
            SELECT f.name, f.file_name, f.file_url, f.attached_to_doctype, f.attached_to_name
            FROM `tabFile` f
            LEFT JOIN `tabDynamic Link` dl ON dl.link_name = f.name AND dl.parenttype = 'File'
            WHERE f.attached_to_doctype IS NOT NULL
            AND f.attached_to_name IS NOT NULL
            AND f.file_url LIKE '%amazonaws%'
            ORDER BY f.creation DESC
            LIMIT 10
        """, as_dict=True)

        if orphaned_files:
            print(f"📁 Recent S3 File documents ({len(orphaned_files)}):", flush=True)
            for f in orphaned_files:
                print(f"  {f.file_name} -> {f.attached_to_doctype}:{f.attached_to_name}", flush=True)

        return True

    except Exception as e:
        print(f"❌ Fix error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute fix
try:
    result = fix_attachment_deletion()

    if result:
        print("\n🎉 Attachment deletion fix completed!", flush=True)
        print("\n📌 Next steps:", flush=True)
        print("1. Update flansa_record_viewer.js with the new clear_attachment method", flush=True)
        print("2. Test attachment removal to verify File documents are deleted", flush=True)
        print("3. Check S3 to confirm files are removed", flush=True)
    else:
        print("\n❌ Fix failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)