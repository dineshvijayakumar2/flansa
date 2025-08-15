import frappe
from frappe import _
from frappe.utils import cint
import json

@frappe.whitelist(allow_guest=True)
def show_form(token):
    """Display the public form based on token"""
    # Find the form by token in the URL
    forms = frappe.get_all("Flansa Public Form", 
                          filters={"public_url": ["like", f"%{token}%"], "is_active": 1},
                          fields=["*"])
    
    if not forms:
        frappe.throw(_("Form not found or inactive"))
        
    form = forms[0]
    form_doc = frappe.get_doc("Flansa Public Form", form.name)
    
    # Get fields to display
    fields = form_doc.get_form_fields()
    
    # Get the table structure
    table = frappe.get_doc("Flansa Table", form.table)
    
    context = {
        "form": form,
        "fields": fields,
        "table": table,
        "no_cache": 1
    }
    
    # Render the public form template
    return frappe.render_template("flansa/templates/public_form.html", context)

@frappe.whitelist(allow_guest=True)
def submit_form():
    """Handle public form submission"""
    try:
        data = json.loads(frappe.form_dict.data)
        token = data.get("token")
        
        # Find the form configuration
        forms = frappe.get_all("Flansa Public Form", 
                              filters={"public_url": ["like", f"%{token}%"], "is_active": 1},
                              fields=["*"])
        
        if not forms:
            return {"success": False, "message": _("Form not found or inactive")}
            
        form = forms[0]
        form_doc = frappe.get_doc("Flansa Public Form", form.name)
        
        # Get the table to submit to
        table = frappe.get_doc("Flansa Table", form.table)
        
        # Get the actual DocType name
        doctype_name = table.doctype_name
        
        # Create new document
        new_doc = frappe.new_doc(doctype_name)
        
        # Set field values
        for field_name, value in data.get("fields", {}).items():
            if hasattr(new_doc, field_name):
                new_doc.set(field_name, value)
                
        # Handle file uploads if enabled
        if form_doc.allow_file_uploads and "files" in data:
            # Process file uploads
            pass
            
        # Insert the document
        new_doc.insert(ignore_permissions=True)
        
        # Increment submission count
        form_doc.increment_submission_count()
        
        return {
            "success": True,
            "message": form_doc.success_message or _("Thank you for your submission!"),
            "doc_name": new_doc.name
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Public Form Submission Error")
        return {
            "success": False,
            "message": _("Error submitting form. Please try again.")
        }

@frappe.whitelist()
def get_form_preview(form_name):
    """Get a preview of the public form"""
    if not frappe.has_permission("Flansa Public Form", "read"):
        frappe.throw(_("Not permitted"))
        
    form = frappe.get_doc("Flansa Public Form", form_name)
    fields = form.get_form_fields()
    
    return {
        "form": form.as_dict(),
        "fields": fields
    }