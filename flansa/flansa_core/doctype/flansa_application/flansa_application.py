import frappe
from frappe.model.document import Document
from frappe import _

class FlansaApplication(Document):
	def validate(self):
		if not self.owner_user:
			self.owner_user = frappe.session.user
		
		if not self.created_date:
			self.created_date = frappe.utils.now()
		
		self.validate_app_name()
		self.update_statistics()
	
	def validate_app_name(self):
		"""Ensure app name follows Frappe naming conventions"""
		if self.app_name:
			import re
			
			# Check if app_name contains only allowed characters
			if not re.match(r'^[a-z][a-z0-9_]*$', self.app_name):
				frappe.throw(_(
					"Application Name must start with a lowercase letter and contain only "
					"lowercase letters, numbers, and underscores. "
					f"Current value: '{self.app_name}'"
				))
			
			# Check for reserved names
			reserved_names = [
				'frappe', 'erpnext', 'flansa', 'admin', 'root', 'system', 'api', 'app',
				'www', 'assets', 'files', 'private', 'public', 'site', 'desk'
			]
			
			if self.app_name in reserved_names:
				frappe.throw(_(f"Application Name '{self.app_name}' is reserved. Please use a different name."))
			
			# Check for existing DocType names to avoid conflicts
			existing_doctype = frappe.db.exists("DocType", f"FLS {self.app_name.replace('_', ' ').title()}")
			if existing_doctype and self.is_new():
				frappe.throw(_(f"An application with name '{self.app_name}' already exists or conflicts with existing DocTypes."))
	
	def update_statistics(self):
		if not self.is_new():
			# Workspace count disabled
			self.workspace_count = 0
			
			# Count tables
			self.table_count = frappe.db.count("Flansa Table", 
				filters={"application": self.name})
			
			# Count active users
			self.user_count = len(self.allowed_users or [])
	
	def after_insert(self):
		# Add creator as allowed user
		self.add_user_access(self.owner_user)
	
	def add_user_access(self, user):
		"""Add a user to the allowed users list"""
		if not self.allowed_users:
			self.allowed_users = []
		
		# Check if user already has access
		existing_users = [u.user for u in self.allowed_users]
		if user not in existing_users:
			self.append("allowed_users", {
				"user": user,
				"role": "App Admin"
			})
			self.save(ignore_permissions=True)
	
	def has_user_access(self, user=None):
		"""Check if a user has access to this application"""
		if not user:
			user = frappe.session.user
		
		# System Manager always has access
		if "System Manager" in frappe.get_roles(user):
			return True
		
		# Check if user is the owner
		if self.owner_user == user:
			return True
		
		# Check allowed users
		if self.allowed_users:
			allowed_users = [u.user for u in self.allowed_users]
			if user in allowed_users:
				return True
		
		# Check if user has any of the allowed roles
		if self.allowed_roles:
			user_roles = frappe.get_roles(user)
			allowed_roles = [r.role for r in self.allowed_roles]
			if any(role in allowed_roles for role in user_roles):
				return True
		
		# Check if application is public
		return self.is_public
	
	def get_user_role(self, user=None):
		"""Get the user's role in this application"""
		if not user:
			user = frappe.session.user
		
		if user == self.owner_user or "System Manager" in frappe.get_roles(user):
			return "App Admin"
		
		if self.allowed_users:
			for allowed_user in self.allowed_users:
				if allowed_user.user == user:
					return allowed_user.role
		
		return "App User"
	
	@frappe.whitelist()
	def get_application_context(self):
		"""Get full application context for the frontend"""
		return {
			"application": self.as_dict(),
			"workspaces": self.get_workspaces(),
			"user_role": self.get_user_role(),
			"statistics": {
				"workspaces": self.workspace_count,
				"tables": self.table_count,
				"records": self.record_count,
				"users": self.user_count
			}
		}
	
	def get_workspaces(self):
		"""Get all workspaces for this application - DISABLED"""
		# Workspace functionality removed
		return []
	
	def on_trash(self):
		"""Clean up all related records when application is deleted"""
		try:
			# Get all tables in this application
			tables = frappe.get_all("Flansa Table", 
				filters={"application": self.name},
				fields=["name", "doctype_name", "status"]
			)
			
			# Delete all generated DocTypes for active tables
			for table in tables:
				if table.status == "Active" and table.doctype_name:
					try:
						if frappe.db.exists("DocType", table.doctype_name):
							# Delete all data first
							frappe.db.sql(f"DELETE FROM `tab{table.doctype_name}`")
							# Delete the DocType
							frappe.delete_doc("DocType", table.doctype_name, force=True)
							# Drop the table
							frappe.db.sql(f"DROP TABLE IF EXISTS `tab{table.doctype_name}`")
					except Exception as e:
						frappe.log_error(f"Error cleaning up table {table.doctype_name}: {str(e)}", 
									   "Flansa Application Cleanup")
			
			# Delete all Flansa Tables
			for table in tables:
				frappe.delete_doc("Flansa Table", table.name, force=True)
			
			# Workspace cleanup removed - workspaces no longer used
			
			frappe.msgprint(_(f"Cleaned up application {self.app_title} and all related tables"))
			
		except Exception as e:
			frappe.log_error(f"Error cleaning up application {self.name}: {str(e)}", 
						   "Flansa Application Cleanup")

@frappe.whitelist()
def cleanup_application_data(application_name):
	"""Clean up all data for an application"""
	app_doc = frappe.get_doc("Flansa Application", application_name)
	
	# Get all tables
	tables = frappe.get_all("Flansa Table", 
		filters={"application": application_name},
		fields=["name", "doctype_name", "status"]
	)
	
	cleaned_tables = []
	for table in tables:
		if table.status == "Active" and table.doctype_name:
			try:
				if frappe.db.exists("DocType", table.doctype_name):
					# Delete all data
					frappe.db.sql(f"DELETE FROM `tab{table.doctype_name}`")
					cleaned_tables.append(table.doctype_name)
			except Exception as e:
				frappe.log_error(f"Error cleaning data from {table.doctype_name}: {str(e)}", 
							   "Flansa Data Cleanup")
	
	return {
		"status": "success",
		"cleaned_tables": cleaned_tables,
		"message": f"Cleaned data from {len(cleaned_tables)} tables"
	}