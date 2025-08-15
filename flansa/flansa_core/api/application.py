import re
import frappe
import yaml
import json
from frappe import _


def normalize_app_name(name):
    """Convert application name to valid format"""
    if not name:
        return name
    
    # Convert to lowercase and replace spaces/special chars with underscores
    normalized = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
    # Remove multiple underscores  
    normalized = re.sub(r'_{2,}', '_', normalized)
    # Remove leading/trailing underscores
    normalized = normalized.strip('_')
    # Ensure it starts with a letter
    if normalized and normalized[0].isdigit():
        normalized = 'app_' + normalized
    
    return normalized or 'my_app'

@frappe.whitelist()
def create_application(app_data):
	"""Create a new Flansa Application with optional template or Excel data"""
	
	app_data = frappe.parse_json(app_data) if isinstance(app_data, str) else app_data
	
	# Create the application
	# Normalize the app name
	raw_app_name = app_data.get("app_name") or app_data.get("app_title", "")
	normalized_app_name = normalize_app_name(raw_app_name)
	
	app_doc = frappe.get_doc({
		"doctype": "Flansa Application",
		"app_name": normalized_app_name,
		"app_title": app_data.get("app_title"),
		"description": app_data.get("description"),
		"app_type": app_data.get("app_type", "Business"),
		"theme_color": app_data.get("theme_color", "#2196F3"),
		"icon": app_data.get("icon"),
		"status": "Active"
	})
	
	app_doc.insert(ignore_permissions=True)
	
	# Handle template-based creation
	if app_data.get("template"):
		create_from_template(app_doc, app_data["template"])
	
	# Handle Excel-based creation
	elif app_data.get("excel_data"):
		create_from_excel(app_doc, app_data["excel_data"])
	
	return app_doc

@frappe.whitelist()
def export_application_schema(app_name, format_type="yaml"):
	"""Export application schema in YAML or JSON format"""
	
	if not frappe.has_permission("Flansa Application", "read"):
		frappe.throw(_("Not permitted"))
	
	app_doc = frappe.get_doc("Flansa Application", app_name)
	
	# Build complete schema
	schema = {
		"application": {
			"name": app_doc.app_name,
			"title": app_doc.app_title,
			"description": app_doc.description,
			"type": app_doc.app_type,
			"theme_color": app_doc.theme_color,
			"icon": app_doc.icon,
			"version": "1.0.0",
			"created": str(app_doc.creation)
		},
		"workspaces": [],
		"tables": [],
		"relationships": []
	}
	
	# Get workspaces
	workspaces = frappe.get_all("Flansa Workspace", 
		filters={"application": app_name},
		fields=["name", "workspace_name", "description", "theme_color", "icon"]
	)
	
	for workspace in workspaces:
		workspace_schema = {
			"name": workspace.workspace_name,
			"description": workspace.description,
			"theme_color": workspace.theme_color,
			"icon": workspace.icon
		}
		schema["workspaces"].append(workspace_schema)
	
	# Get tables
	tables = frappe.get_all("Flansa Table", 
		filters={"application": app_name},
		fields=["name", "table_name", "table_label", "workspace", "doctype_name", 
				"is_submittable", "naming_rule", "autoname_prefix"]
	)
	
	for table in tables:
		table_doc = frappe.get_doc("Flansa Table", table.name)
		
		table_schema = {
			"name": table.table_name,
			"label": table.table_label,
			"workspace": frappe.db.get_value("Flansa Workspace", table.workspace, "workspace_name"),
			"is_submittable": table.is_submittable,
			"naming_rule": table.naming_rule,
			"autoname_prefix": table.autoname_prefix,
			"fields": []
		}
		
		# Get fields from JSON storage
		if table_doc.fields_json:
			try:
				fields_data = json.loads(table_doc.fields_json)
				for field in fields_data:
					field_schema = {
						"name": field.get("field_name"),
						"label": field.get("field_label"),
						"type": field.get("field_type"),
						"required": field.get("is_required", 0),
						"unique": field.get("is_unique", 0),
						"readonly": field.get("is_readonly", 0),
						"hidden": field.get("is_hidden", 0),
						"options": field.get("options"),
						"default": field.get("default_value"),
						"in_list_view": field.get("in_list_view", 0),
						"in_standard_filter": field.get("in_standard_filter", 0),
						"depends_on": field.get("depends_on"),
						"description": field.get("description")
					}
					table_schema["fields"].append(field_schema)
			except (json.JSONDecodeError, TypeError):
				pass
		
		schema["tables"].append(table_schema)
	
	# Get relationships
	relationships = frappe.get_all("Flansa Relationship",
		filters={"application": app_name},
		fields=["name", "relationship_name", "relationship_type", "from_table", 
				"to_table", "from_field", "to_field"]
	)
	
	for rel in relationships:
		rel_schema = {
			"name": rel.relationship_name,
			"type": rel.relationship_type,
			"from_table": frappe.db.get_value("Flansa Table", rel.from_table, "table_name"),
			"to_table": frappe.db.get_value("Flansa Table", rel.to_table, "table_name"),
			"from_field": rel.from_field,
			"to_field": rel.to_field
		}
		schema["relationships"].append(rel_schema)
	
	if format_type == "yaml":
		return yaml.dump(schema, default_flow_style=False, allow_unicode=True)
	else:
		return json.dumps(schema, indent=2)

@frappe.whitelist()
def import_application_schema(schema_content, format_type="yaml"):
	"""Import application from YAML or JSON schema"""
	
	if not frappe.has_permission("Flansa Application", "create"):
		frappe.throw(_("Not permitted"))
	
	try:
		if format_type == "yaml":
			schema = yaml.safe_load(schema_content)
		else:
			schema = json.loads(schema_content)
	except Exception as e:
		frappe.throw(_("Invalid schema format: {0}").format(str(e)))
	
	# Create application
	app_data = schema.get("application", {})
	app_doc = frappe.get_doc({
		"doctype": "Flansa Application",
		"app_name": app_data.get("name"),
		"app_title": app_data.get("title"),
		"description": app_data.get("description"),
		"app_type": app_data.get("type", "Business"),
		"theme_color": app_data.get("theme_color", "#2196F3"),
		"icon": app_data.get("icon"),
		"status": "Active"
	})
	app_doc.insert(ignore_permissions=True)
	
	# Create workspaces
	workspace_map = {}
	for ws_data in schema.get("workspaces", []):
		ws_doc = frappe.get_doc({
			"doctype": "Flansa Workspace",
			"application": app_doc.name,
			"workspace_name": ws_data.get("name"),
			"description": ws_data.get("description"),
			"theme_color": ws_data.get("theme_color"),
			"icon": ws_data.get("icon"),
			"status": "Active"
		})
		ws_doc.insert(ignore_permissions=True)
		workspace_map[ws_data.get("name")] = ws_doc.name
	
	# Create tables
	table_map = {}
	for table_data in schema.get("tables", []):
		workspace_name = workspace_map.get(table_data.get("workspace"))
		
		table_doc = frappe.get_doc({
			"doctype": "Flansa Table",
			"application": app_doc.name,
			"workspace": workspace_name,
			"table_name": table_data.get("name"),
			"table_label": table_data.get("label"),
			"is_submittable": table_data.get("is_submittable", 0),
			"naming_rule": table_data.get("naming_rule", "Autoincrement"),
			"autoname_prefix": table_data.get("autoname_prefix"),
			"status": "Draft"  # Will be activated after adding fields
		})
		
		# Add fields
		for field_data in table_data.get("fields", []):
			table_doc.append("fields", {
				"field_name": field_data.get("name"),
				"field_label": field_data.get("label"),
				"field_type": field_data.get("type"),
				"is_required": field_data.get("required", 0),
				"is_unique": field_data.get("unique", 0),
				"is_readonly": field_data.get("readonly", 0),
				"is_hidden": field_data.get("hidden", 0),
				"options": field_data.get("options"),
				"default_value": field_data.get("default"),
				"in_list_view": field_data.get("in_list_view", 0),
				"in_standard_filter": field_data.get("in_standard_filter", 0),
				"depends_on": field_data.get("depends_on"),
				"description": field_data.get("description")
			})
		
		table_doc.insert(ignore_permissions=True)
		table_map[table_data.get("name")] = table_doc.name
		
		# Activate table to create DocType
		table_doc.status = "Active"
		table_doc.save(ignore_permissions=True)
	
	# Create relationships
	for rel_data in schema.get("relationships", []):
		from_table = table_map.get(rel_data.get("from_table"))
		to_table = table_map.get(rel_data.get("to_table"))
		
		if from_table and to_table:
			rel_doc = frappe.get_doc({
				"doctype": "Flansa Relationship",
				"application": app_doc.name,
				"relationship_name": rel_data.get("name"),
				"relationship_type": rel_data.get("type"),
				"from_table": from_table,
				"to_table": to_table,
				"from_field": rel_data.get("from_field"),
				"to_field": rel_data.get("to_field"),
				"status": "Active"
			})
			rel_doc.insert(ignore_permissions=True)
	
	return app_doc

def create_from_template(app_doc, template_name):
	"""Create application structure from a predefined template"""
	
	templates = {
		"crm": {
			"workspaces": [
				{"name": "sales", "label": "Sales Management"}
			],
			"tables": [
				{
					"name": "customers",
					"label": "Customers",
					"workspace": "sales",
					"fields": [
						{"name": "customer_name", "label": "Customer Name", "type": "Data", "required": 1},
						{"name": "email", "label": "Email", "type": "Data"},
						{"name": "phone", "label": "Phone", "type": "Data"},
						{"name": "company", "label": "Company", "type": "Data"},
						{"name": "status", "label": "Status", "type": "Select", "options": "Active\nInactive"}
					]
				},
				{
					"name": "deals",
					"label": "Deals",
					"workspace": "sales",
					"fields": [
						{"name": "deal_name", "label": "Deal Name", "type": "Data", "required": 1},
						{"name": "customer", "label": "Customer", "type": "Link", "options": "FLS " + app_doc.app_name + " customers"},
						{"name": "amount", "label": "Amount", "type": "Currency"},
						{"name": "stage", "label": "Stage", "type": "Select", "options": "Prospecting\nQualified\nProposal\nNegotiation\nClosed Won\nClosed Lost"},
						{"name": "close_date", "label": "Expected Close Date", "type": "Date"}
					]
				}
			],
			"relationships": [
				{
					"name": "customer_deals",
					"type": "One to Many",
					"from_table": "customers",
					"to_table": "deals"
				}
			]
		}
		# Add more templates as needed
	}
	
	template_data = templates.get(template_name)
	if not template_data:
		return
	
	# Create workspaces
	workspace_map = {}
	for ws_data in template_data.get("workspaces", []):
		ws_doc = frappe.get_doc({
			"doctype": "Flansa Workspace",
			"application": app_doc.name,
			"workspace_name": f"{app_doc.app_name}_{ws_data['name']}",
			"description": ws_data.get("label"),
			"status": "Active"
		})
		ws_doc.insert(ignore_permissions=True)
		workspace_map[ws_data["name"]] = ws_doc.name
	
	# Create tables (implementation similar to import_application_schema)
	# ... rest of template creation logic

def create_from_excel(app_doc, excel_data):
	"""Create application structure from Excel data"""
	# Implementation for Excel import
	pass