# Copyright (c) 2024, Flansa and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FlansaFormConfig(Document):
	def validate(self):
		"""Validate form configuration"""
		if not self.table_name:
			frappe.throw("Table name is required")
			
		# Validate that the table exists
		if not frappe.db.exists('Flansa Table', self.table_name):
			frappe.throw(f"Flansa Table '{self.table_name}' does not exist")
	
	def before_save(self):
		"""Set name to table_name for easy lookup"""
		if not self.name or self.name != self.table_name:
			self.name = self.table_name