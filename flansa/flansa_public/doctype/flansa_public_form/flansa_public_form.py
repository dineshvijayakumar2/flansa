import frappe
from frappe.model.document import Document
from frappe.utils import get_url
import secrets
import string

class FlansaPublicForm(Document):
    def validate(self):
        self.validate_table()
        self.generate_public_url()
        
    def validate_table(self):
        """Ensure the selected table is active"""
        table = frappe.get_doc("Flansa Table", self.table)
        if not table.is_active:
            frappe.throw(f"Table {self.table} must be active to create a public form")
            
    def generate_public_url(self):
        """Generate a unique public URL for the form"""
        if not self.public_url:
            # Generate a random token
            token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
            self.public_url = f"{get_url()}/api/method/flansa.core.api.public_form.show_form?token={token}"
            
    def on_update(self):
        """Clear cache when form is updated"""
        frappe.clear_cache(doctype="Flansa Public Form")
        
    def get_form_fields(self):
        """Get the fields to display in the public form"""
        if self.fields_to_show:
            return self.fields_to_show
        else:
            # If no specific fields selected, get all fields from the table
            table = frappe.get_doc("Flansa Table", self.table)
            fields = []
            for field in table.fields:
                if field.fieldtype not in ["Section Break", "Column Break", "Table"]:
                    fields.append({
                        "field": field.field_name,
                        "label": field.label,
                        "fieldtype": field.fieldtype,
                        "reqd": field.reqd,
                        "options": field.options
                    })
            return fields
            
    def increment_submission_count(self):
        """Increment the submission count"""
        self.submissions_count = (self.submissions_count or 0) + 1
        self.last_submission = frappe.utils.now()
        self.save(ignore_permissions=True)