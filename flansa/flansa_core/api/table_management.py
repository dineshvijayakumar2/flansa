"""
Table Management API for Flansa Platform - TIMESTAMP CONFLICT FIXED
Handles table activation, deactivation, and DocType creation
"""

import frappe
from flansa.flansa_core.tenant_security import apply_tenant_filter, get_current_tenant
from frappe import _
import json

@frappe.whitelist()
def activate_table(table_name):
    """Activate a Flansa Table and create its DocType"""
    try:
        print(f"Activating table: {table_name}")
        
        # Get the table document with fresh data
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Check if DocType already exists (indicates table is already active)
        if table_doc.doctype_name and frappe.db.exists("DocType", table_doc.doctype_name):
            frappe.msgprint("Table is already active", indicator="orange")
            return {
                "success": False,
                "error": "Table is already active"
            }
        
        # Generate DocType name if not exists - use server-side method
        if not table_doc.doctype_name:
            # Let the table's get_generated_doctype_name method handle ID-based naming
            doctype_name = table_doc.get_generated_doctype_name()
            if doctype_name:
                table_doc.doctype_name = doctype_name
                print(f"Generated ID-based DocType name: {doctype_name}")
            else:
                print("❌ Failed to generate DocType name")
                return {
                    "success": False,
                    "error": "Could not generate DocType name"
                }
        
        # Parse fields from JSON
        fields_data = []
        if table_doc.fields_json:
            try:
                fields_data = json.loads(table_doc.fields_json)
                print(f"Found {len(fields_data)} fields in JSON")
            except json.JSONDecodeError:
                frappe.msgprint("Invalid fields JSON format", indicator="red")
                return {
                    "success": False,
                    "error": "Invalid fields JSON format"
                }
        
        # Create DocType first
        doctype = create_doctype_from_table(table_doc, fields_data)
        
        if doctype:
            # REFRESH the table document to get latest timestamp
            table_doc.reload()
            
            # Save with ignore_permissions and handle timestamp conflicts
            table_doc.save(ignore_permissions=True)
            frappe.db.commit()
            
            frappe.msgprint(f"Table activated successfully! DocType '{doctype.name}' created.", indicator="green")
            print(f"DocType created: {doctype.name}")
            
            return {
                "success": True,
                "message": f"Table activated successfully. DocType '{doctype.name}' created.",
                "doctype_name": doctype.name
            }
        else:
            frappe.msgprint("Failed to create DocType", indicator="red")
            return {
                "success": False,
                "error": "Failed to create DocType"
            }
            
    except frappe.TimestampMismatchError:
        # Handle timestamp mismatch specifically
        print("Timestamp mismatch detected, retrying with fresh document...")
        try:
            # Get fresh document and try again
            fresh_table_doc = frappe.get_doc("Flansa Table", table_name)
            fresh_table_doc.status = "Active"
            fresh_table_doc.save(ignore_permissions=True)
            frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Table activated successfully after refresh.",
                "doctype_name": fresh_table_doc.doctype_name
            }
        except Exception as retry_error:
            print(f"Retry failed: {retry_error}")
            return {
                "success": False,
                "error": f"Retry failed: {str(retry_error)}"
            }
            
    except Exception as e:
        print(f"Error activating table: {str(e)}")
        frappe.msgprint(f"Error activating table: {str(e)}", indicator="red")
        return {
            "success": False,
            "error": str(e)
        }

def create_doctype_from_table(table_doc, fields_data):
    """Create a DocType from Flansa Table definition"""
    try:
        print(f"Creating DocType: {table_doc.doctype_name}")
        
        # Check if DocType already exists and delete it
        if frappe.db.exists("DocType", table_doc.doctype_name):
            print("Existing DocType found, deleting...")
            frappe.delete_doc("DocType", table_doc.doctype_name, force=True, ignore_permissions=True)
            frappe.db.commit()  # Commit the deletion
        
        # Create new DocType
        doctype = frappe.new_doc("DocType")
        doctype.name = table_doc.doctype_name
        doctype.module = "Flansa Core"
        doctype.custom = 1
        
        # Use default naming initially - will be updated by apply_naming_to_doctype later
        print(f"🔧 Setting default naming for DocType: {table_doc.doctype_name}")
        print(f"   - Will be updated by apply_naming_to_doctype after creation")
        
        # Set basic default naming (will be overridden by apply_naming_to_doctype)
        doctype.naming_rule = "Random"  # Safe default
        
        # Basic settings - simplified
        doctype.track_changes = 0
        doctype.allow_rename = 0
        doctype.quick_entry = 0
        doctype.is_submittable = 0
        doctype.allow_import = 0
        
        # Add basic fields first
        if not fields_data:
            # Add a default field if no fields provided
            doctype.append("fields", {
                "fieldname": "title",
                "label": "Title",
                "fieldtype": "Data",
                "reqd": 1,
                "in_list_view": 1,
                "in_standard_filter": 1
            })
            print("Added default title field")
        else:
            # Add fields from table definition
            field_count = 0
            for field_data in fields_data:
                field_name = field_data.get("field_name", "")
                if not field_name:
                    continue
                    
                field_dict = {
                    "fieldname": frappe.scrub(field_name),
                    "label": field_data.get("field_label", field_name),
                    "fieldtype": map_field_type(field_data.get("field_type", "Data")),
                    "reqd": field_data.get("is_required", 0),
                    "in_list_view": 1 if field_count < 3 else 0,
                    "in_standard_filter": 1 if field_count < 2 else 0
                }
                
                # Add options for select fields
                if field_data.get("options"):
                    field_dict["options"] = field_data.get("options")
                
                doctype.append("fields", field_dict)
                field_count += 1
                print(f"Added field: {field_name}")
        
        # Set basic permissions
        doctype.append("permissions", {
            "role": "System Manager",
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "submit": 0,
            "cancel": 0,
            "amend": 0,
            "print": 1,
            "email": 1,
            "export": 1,
            "import": 0,
            "share": 1,
            "report": 1
        })
        
        # Save the DocType
        doctype.insert(ignore_permissions=True)
        frappe.db.commit()
        
        print(f"DocType {doctype.name} created successfully")
        return doctype
        
    except Exception as e:
        print(f"Error creating DocType: {str(e)}")
        return None

def map_field_type(flansa_type):
    """Map Flansa field types to Frappe field types"""
    type_mapping = {
        "Text": "Data",
        "Data": "Data",
        "Number": "Int", 
        "Decimal": "Float",
        "Currency": "Currency",
        "Date": "Date",
        "DateTime": "Datetime",
        "Time": "Time",
        "Select": "Select",
        "Multi-Select": "Small Text",
        "Link": "Data",
        "Check": "Check",
        "Text Area": "Text",
        "Long Text": "Long Text",
        "HTML": "Text Editor",
        "Image": "Data",
        "File": "Data",
        "Gallery": "Long Text",
        "JSON": "Long Text",
        "Code": "Code",
        "Signature": "Data"
    }
    
    return type_mapping.get(flansa_type, "Data")

@frappe.whitelist()
def create_flansa_table(app_id, table_name, table_label, description=None, 
                       naming_type="By \"Naming Series\" field", naming_prefix="REC", naming_digits=5, 
                       naming_start_from=1, naming_field=None):
    """Create a new Flansa Table with specified configuration"""
    try:
        print(f"🎯 Creating Flansa Table: {table_name} for app: {app_id}", flush=True)
        
        # Validate inputs
        if not app_id:
            return {
                "success": False,
                "error": "Application ID is required"
            }
            
        if not table_name or not table_label:
            return {
                "success": False,
                "error": "Table name and label are required"
            }
            
        # Check if table already exists
        if frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": f"Table '{table_name}' already exists"
            }
            
        # Validate that the app exists
        if not frappe.db.exists("Flansa Application", app_id):
            return {
                "success": False,
                "error": f"Application '{app_id}' does not exist"
            }
            
        # Create new Flansa Table document
        table_doc = frappe.new_doc("Flansa Table")
        table_doc.name = table_name
        table_doc.table_name = table_name
        table_doc.table_label = table_label
        table_doc.description = description or f"Table for {table_label}"
        table_doc.application = app_id  # Use correct field name 'application'
        
        # Set naming configuration
        table_doc.naming_type = naming_type
        table_doc.naming_prefix = naming_prefix
        table_doc.naming_digits = int(naming_digits) if naming_digits else 5
        table_doc.naming_start_from = int(naming_start_from) if naming_start_from else 1
        table_doc.naming_field = naming_field
        
        # Add default fields JSON (basic title field)
        default_fields = [
            {
                "field_name": "title",
                "field_label": "Title",
                "field_type": "Data",
                "is_required": 1,
                "display_order": 1
            }
        ]
        table_doc.fields_json = json.dumps(default_fields)
        
        # Insert the document
        table_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        print(f"✅ Flansa Table created successfully: {table_doc.name}", flush=True)
        
        # Auto-activate the table to create the DocType with naming settings
        print(f"🎯 Auto-activating table to create DocType with naming settings...", flush=True)
        try:
            activation_result = activate_table(table_doc.name)
            if activation_result.get("success"):
                print(f"✅ Table activated and DocType created: {activation_result.get('doctype_name')}", flush=True)
                
                # Apply naming configuration using the working Visual Builder method
                print(f"🎯 Applying naming settings to DocType...", flush=True)
                from flansa.flansa_core.api.field_management import apply_naming_to_doctype
                naming_result = apply_naming_to_doctype(table_doc.name)
                
                if naming_result.get("success"):
                    print(f"✅ Naming settings applied successfully", flush=True)
                else:
                    print(f"⚠️ Warning: Naming settings could not be applied: {naming_result.get('message')}", flush=True)
                
                return {
                    "success": True,
                    "message": f"Table '{table_label}' created and activated successfully with naming settings",
                    "table_name": table_doc.name,
                    "table_id": table_doc.name,
                    "doctype_name": activation_result.get('doctype_name'),
                    "naming_applied": naming_result.get("success", False)
                }
            else:
                print(f"⚠️ Table created but activation failed: {activation_result.get('error')}", flush=True)
                return {
                    "success": True,
                    "message": f"Table '{table_label}' created successfully (activation pending)",
                    "table_name": table_doc.name,
                    "table_id": table_doc.name,
                    "warning": f"Auto-activation failed: {activation_result.get('error')}"
                }
        except Exception as activation_error:
            print(f"⚠️ Table created but auto-activation error: {str(activation_error)}", flush=True)
            return {
                "success": True,
                "message": f"Table '{table_label}' created successfully (manual activation required)",
                "table_name": table_doc.name,
                "table_id": table_doc.name,
                "warning": f"Auto-activation error: {str(activation_error)}"
            }
        
    except frappe.DuplicateEntryError:
        return {
            "success": False,
            "error": f"Table '{table_name}' already exists"
        }
    except Exception as e:
        print(f"❌ Error creating Flansa Table: {str(e)}", flush=True)
        frappe.db.rollback()
        return {
            "success": False,
            "error": f"Failed to create table: {str(e)}"
        }

@frappe.whitelist()
def force_activate_table(table_name):
    """Force activate table by updating directly in database"""
    try:
        # Update status directly in database to avoid timestamp conflicts
        frappe.db.set_value("Flansa Table", table_name, "status", "Active")
        frappe.db.commit()
        
        # Get the updated document
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        return {
            "success": True,
            "message": f"Table {table_name} force activated",
            "doctype_name": table_doc.doctype_name
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
