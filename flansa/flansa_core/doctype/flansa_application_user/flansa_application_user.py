from frappe.model.document import Document
import frappe

class FlansaApplicationUser(Document):
	def validate(self):
		if not self.added_on:
			self.added_on = frappe.utils.now()