"""
Flansa Logic Templates - Guided creation for complex field types
Provides wizards and templates for lookup, summary, and relationship fields
"""

import frappe
import json
from frappe import _

class LogicTemplates:
    """Template registry for guided Logic Field creation"""
    
    def __init__(self):
        self.templates = {
            "link": {
                "name": "Link Field",
                "description": "Create relationship to another table (e.g., Customer, Product)",
                "icon": "fa-link",
                "category": "relationship",
                "wizard_steps": [
                    {
                        "title": "Link Configuration",
                        "fields": ["target_doctype", "link_scope"]
                    }
                ],
                "generates_formula": False,
                "field_type": "Link"
            },
            
            "fetch": {
                "name": "Fetch Field",
                "description": "Fetch data from linked records (e.g., Customer Name from Customer)",
                "icon": "fa-magic",
                "category": "relationship",
                "wizard_steps": [
                    {
                        "title": "Source Link Selection",
                        "fields": ["source_link_field"]
                    },
                    {
                        "title": "Target Field Selection", 
                        "fields": ["target_field"]
                    }
                ],
                "generates_formula": True,
                "formula_template": "FETCH({source_link_field}, {target_field})"
            },
            
            "rollup": {
                "name": "Roll-up Field",
                "description": "Calculate totals from child records (e.g., Total Order Amount)",
                "icon": "fa-sum", 
                "category": "aggregation",
                "wizard_steps": [
                    {
                        "title": "Child Table & Operation",
                        "fields": ["child_table", "operation_type"]
                    },
                    {
                        "title": "Target Field Selection",
                        "fields": ["target_field"]
                    }
                ],
                "generates_formula": True,
                "formula_template": "{operation}({child_table}, {target_field})"
            },
            
            "formula": {
                "name": "Formula Field",
                "description": "Calculations and logic with current record fields (e.g., Price * Quantity, IF conditions)",
                "icon": "fa-calculator",
                "category": "calculation",
                "wizard_steps": [
                    {
                        "title": "Formula Builder",
                        "fields": ["formula_expression"]
                    }
                ],
                "generates_formula": True,
                "formula_template": "{formula_expression}"
            }
        }
    
    def get_template(self, template_id):
        """Get specific template configuration"""
        return self.templates.get(template_id)
    
    def get_all_templates(self):
        """Get all available templates"""
        return self.templates
    
    def get_templates_by_category(self, category):
        """Get templates filtered by category"""
        return {k: v for k, v in self.templates.items() if v.get("category") == category}

@frappe.whitelist()
def get_logic_templates():
    """API to get all Logic Templates"""
    try:
        templates = LogicTemplates()
        return {
            "success": True,
            "templates": templates.get_all_templates()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist() 
def get_lookup_wizard_data(table_name):
    """Get data for lookup field wizard"""
    try:
        # Get current table info
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        # Get fields from current table (potential source fields)
        meta = frappe.get_meta(target_doctype)
        source_fields = []
        
        for field in meta.get("fields"):
            if field.fieldtype in ["Link", "Data", "Select"]:
                source_fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "fieldtype": field.fieldtype,
                    "options": getattr(field, "options", "")
                })
        
        # Get available DocTypes for lookup targets
        all_doctypes = frappe.get_all("DocType", 
                                     filters={"custom": 1},
                                     fields=["name"])
        
        # Also get Flansa Tables
        flansa_tables = frappe.get_all("Flansa Table",
                                      fields=["name", "table_label", "doctype_name"])
        
        target_tables = []
        
        # Add Flansa Tables first
        flansa_doctype_names = set()
        for ft in flansa_tables:
            if ft.doctype_name:
                target_tables.append({
                    "value": ft.doctype_name,
                    "label": ft.table_label or ft.name,
                    "type": "flansa_table"
                })
                flansa_doctype_names.add(ft.doctype_name)
        
        # Add other DocTypes (excluding those already added as Flansa Tables)
        for dt in all_doctypes:
            if dt.name not in flansa_doctype_names:
                target_tables.append({
                    "value": dt.name,
                    "label": dt.name,
                    "type": "doctype"
                })
        
        return {
            "success": True,
            "source_fields": source_fields,
            "target_tables": target_tables,
            "current_doctype": target_doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting lookup wizard data: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_target_table_fields(target_doctype):
    """Get fields from target table for lookup selection"""
    try:
        meta = frappe.get_meta(target_doctype)
        fields = []
        
        # Include system fields first
        system_fields = [
            {"fieldname": "name", "label": "Name", "fieldtype": "Data"},
            {"fieldname": "creation", "label": "Creation", "fieldtype": "Datetime"},
            {"fieldname": "modified", "label": "Modified", "fieldtype": "Datetime"},
            {"fieldname": "modified_by", "label": "Modified By", "fieldtype": "Link"},
            {"fieldname": "owner", "label": "Owner", "fieldtype": "Link"},
            {"fieldname": "idx", "label": "Index", "fieldtype": "Int"}
        ]
        
        fields.extend(system_fields)
        
        # Include custom fields - expanded to include more useful field types
        allowed_fieldtypes = [
            "Data", "Text", "Small Text", "Long Text", "Text Editor",
            "Int", "Float", "Currency", "Percent",
            "Date", "Datetime", "Time",
            "Select", "Check", "Link",
            "Attach", "Attach Image", "Color", "Rating"
        ]
        
        for field in meta.get("fields"):
            # Skip fields that are tenant-related or internal based on category
            if hasattr(field, 'category') and field.category in ['tenant', 'internal']:
                continue
                
            # Skip already added system fields
            if field.fieldname in ["name", "creation", "modified", "modified_by", "owner", "idx"]:
                continue
                
            if field.fieldtype in allowed_fieldtypes:
                fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label or field.fieldname,
                    "fieldtype": field.fieldtype
                })
        
        return {
            "success": True,
            "fields": fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting target table fields: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_rollup_wizard_data(table_name):
    """Get data for rollup field wizard (renamed from summary)"""
    try:
        # Get current table info
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        # Get child tables (Table fields in current DocType)
        meta = frappe.get_meta(target_doctype)
        child_tables = []
        
        for field in meta.get("fields"):
            if field.fieldtype == "Table":
                child_tables.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "options": field.options  # Child DocType name
                })
        
        # Summary operations
        operations = [
            {"value": "SUM", "label": "Sum - Add all values"},
            {"value": "COUNT", "label": "Count - Count records"},
            {"value": "AVERAGE", "label": "Average - Calculate average"},
            {"value": "MAX", "label": "Maximum - Find highest value"},
            {"value": "MIN", "label": "Minimum - Find lowest value"}
        ]
        
        return {
            "success": True,
            "child_tables": child_tables,
            "operations": operations,
            "current_doctype": target_doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting summary wizard data: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_child_table_fields(child_doctype):
    """Get fields from child table for summary operations"""
    try:
        meta = frappe.get_meta(child_doctype)
        fields = []
        
        for field in meta.get("fields"):
            if field.fieldtype in ["Int", "Float", "Currency", "Data", "Check"]:
                fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "fieldtype": field.fieldtype,
                    "suitable_for": get_suitable_operations(field.fieldtype)
                })
        
        return {
            "success": True,
            "fields": fields
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def get_suitable_operations(fieldtype):
    """Get suitable summary operations for field type"""
    if fieldtype in ["Int", "Float", "Currency"]:
        return ["SUM", "COUNT", "AVERAGE", "MAX", "MIN"]
    elif fieldtype == "Check":
        return ["COUNT", "SUM"]  # Sum of checkboxes = count of checked
    else:
        return ["COUNT"]

@frappe.whitelist()
def get_formula_wizard_data(table_name):
    """Get data for formula field wizard"""
    try:
        # Get current table info
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        # Get all useful fields from current table for formula building
        meta = frappe.get_meta(target_doctype)
        available_fields = []
        
        for field in meta.get("fields"):
            # Include fields that can be used in formulas
            if field.fieldtype in ["Int", "Float", "Currency", "Data", "Select", "Check", "Date", "Datetime"]:
                available_fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "fieldtype": field.fieldtype,
                    "category": "numeric" if field.fieldtype in ["Int", "Float", "Currency"] else "other"
                })
        
        # Mathematical operators
        operators = [
            {"value": "+", "label": "Add (+)", "category": "arithmetic"},
            {"value": "-", "label": "Subtract (-)", "category": "arithmetic"},
            {"value": "*", "label": "Multiply (*)", "category": "arithmetic"},
            {"value": "/", "label": "Divide (/)", "category": "arithmetic"},
            {"value": "**", "label": "Power (**)", "category": "arithmetic"},
            {"value": "%", "label": "Modulo (%)", "category": "arithmetic"},
            {"value": "==", "label": "Equals (==)", "category": "comparison"},
            {"value": "!=", "label": "Not Equals (!=)", "category": "comparison"},
            {"value": ">", "label": "Greater Than (>)", "category": "comparison"},
            {"value": "<", "label": "Less Than (<)", "category": "comparison"},
            {"value": ">=", "label": "Greater or Equal (>=)", "category": "comparison"},
            {"value": "<=", "label": "Less or Equal (<=)", "category": "comparison"}
        ]
        
        # Predefined functions
        functions = [
            # Mathematical functions
            {"value": "ABS", "label": "Absolute Value", "syntax": "ABS(number)", "category": "math", "description": "Returns absolute value"},
            {"value": "ROUND", "label": "Round Number", "syntax": "ROUND(number, decimals)", "category": "math", "description": "Round to specified decimals"},
            {"value": "MAX", "label": "Maximum", "syntax": "MAX(a, b)", "category": "math", "description": "Returns larger value"},
            {"value": "MIN", "label": "Minimum", "syntax": "MIN(a, b)", "category": "math", "description": "Returns smaller value"},
            {"value": "CEIL", "label": "Ceiling", "syntax": "CEIL(number)", "category": "math", "description": "Round up to next integer"},
            {"value": "FLOOR", "label": "Floor", "syntax": "FLOOR(number)", "category": "math", "description": "Round down to previous integer"},
            
            # Conditional functions
            {"value": "IF", "label": "If Condition", "syntax": "IF(condition, true_value, false_value)", "category": "logic", "description": "Conditional logic"},
            {"value": "CASE", "label": "Case When", "syntax": "CASE WHEN condition THEN value ELSE default END", "category": "logic", "description": "Multiple conditions"},
            
            # Date functions
            {"value": "TODAY", "label": "Today's Date", "syntax": "TODAY()", "category": "date", "description": "Current date"},
            {"value": "NOW", "label": "Current Datetime", "syntax": "NOW()", "category": "date", "description": "Current date and time"},
            {"value": "YEAR", "label": "Extract Year", "syntax": "YEAR(date)", "category": "date", "description": "Get year from date"},
            {"value": "MONTH", "label": "Extract Month", "syntax": "MONTH(date)", "category": "date", "description": "Get month from date"},
            
            # Text functions
            {"value": "CONCAT", "label": "Concatenate", "syntax": "CONCAT(text1, text2)", "category": "text", "description": "Join text values"},
            {"value": "UPPER", "label": "Uppercase", "syntax": "UPPER(text)", "category": "text", "description": "Convert to uppercase"},
            {"value": "LOWER", "label": "Lowercase", "syntax": "LOWER(text)", "category": "text", "description": "Convert to lowercase"}
        ]
        
        return {
            "success": True,
            "available_fields": available_fields,
            "operators": operators,
            "functions": functions,
            "current_doctype": target_doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting formula wizard data: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def debug_and_fix_fetch_field(field_name="logic_auto_fill_product_type"):
    """Debug and fix FETCH field formula and execution"""
    try:
        result = {"success": True, "field_name": field_name, "steps": []}
        
        # Step 1: Check Custom Field
        result["steps"].append("Checking Custom Field")
        custom_fields = frappe.get_all("Custom Field",
                                      filters={"fieldname": field_name},
                                      fields=["name", "dt", "fieldname", "label", "fieldtype", "options", "default"])
        
        if not custom_fields:
            result["error"] = f"Custom Field '{field_name}' not found"
            return result
        
        cf = custom_fields[0]
        result["custom_field"] = cf
        
        # Step 2: Check Logic Field
        result["steps"].append("Checking Logic Field")
        logic_fields = frappe.get_all("Logic Field",
                                     filters={"field_name": field_name},
                                     fields=["name", "table_name", "field_name", "formula", "expression"])
        
        if logic_fields:
            lf = logic_fields[0]
            full_lf = frappe.get_doc("Logic Field", lf.name)
            result["logic_field"] = {
                "name": full_lf.name,
                "formula": full_lf.formula,
                "expression": full_lf.expression,
                "field_type": full_lf.field_type,
                "is_virtual": full_lf.is_virtual
            }
            
            # Step 3: Fix formula if needed
            if full_lf.formula and "LOOKUP" in full_lf.formula:
                result["steps"].append("Fixing LOOKUP to FETCH")
                old_formula = full_lf.formula
                new_formula = old_formula.replace("LOOKUP", "FETCH")
                full_lf.formula = new_formula
                full_lf.save()
                result["formula_update"] = {
                    "old": old_formula,
                    "new": new_formula
                }
        else:
            result["logic_field"] = None
        
        # Step 4: Test with actual data
        result["steps"].append("Testing with actual data")
        doctype_name = cf.dt
        sample_records = frappe.get_all(doctype_name, limit=1)
        
        if sample_records:
            sample_name = sample_records[0].name
            record = frappe.get_doc(doctype_name, sample_name)
            
            link_field_value = getattr(record, "logic_link_field_product_type", None)
            fetch_field_value = getattr(record, field_name, None)
            
            result["sample_test"] = {
                "record_name": sample_name,
                "link_field_value": link_field_value,
                "fetch_field_value": fetch_field_value
            }
            
            # Manual lookup test
            if link_field_value:
                try:
                    linked_record = frappe.get_doc("Product Type", link_field_value)
                    expected_value = getattr(linked_record, "title", None) or getattr(linked_record, "name", None)
                    result["manual_lookup"] = {
                        "expected_value": expected_value,
                        "actual_value": fetch_field_value,
                        "match": str(expected_value) == str(fetch_field_value)
                    }
                except Exception as e:
                    result["manual_lookup"] = {"error": str(e)}
        
        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def debug_all_logic_fields():
    """Debug all Logic Fields and their corresponding database fields"""
    try:
        result = {"success": True, "logic_fields": [], "custom_fields": [], "analysis": {}}
        
        # Check if Logic Field DocType exists
        if not frappe.db.exists("DocType", "Logic Field"):
            result["error"] = "Logic Field DocType does not exist"
            result["suggestion"] = "FlansaLogic system may not be properly installed"
            return result
        
        # Get all Logic Fields
        logic_fields = frappe.get_all("Logic Field",
                                     fields=["name", "table_name", "field_name", "field_label", "formula", "expression", "is_virtual", "field_type"])
        
        result["logic_fields"] = logic_fields
        
        for lf in logic_fields:
            # Check for corresponding Custom Field
            custom_fields = frappe.get_all("Custom Field",
                                          filters={"fieldname": lf.field_name},
                                          fields=["name", "dt", "fieldname", "label", "fieldtype"])
            
            lf["has_custom_field"] = len(custom_fields) > 0
            if custom_fields:
                lf["custom_field_info"] = custom_fields[0]
            
            # Check if field exists in actual DocType
            if lf.table_name:
                try:
                    flansa_table = frappe.get_doc("Flansa Table", lf.table_name)
                    actual_doctype = flansa_table.doctype_name
                    lf["actual_doctype"] = actual_doctype
                    
                    # Check if field exists in DocType meta
                    meta = frappe.get_meta(actual_doctype)
                    field_exists = any(field.fieldname == lf.field_name for field in meta.get("fields"))
                    lf["field_exists_in_doctype"] = field_exists
                    
                except Exception as e:
                    lf["doctype_check_error"] = str(e)
        
        # Get all Custom Fields with "logic_" prefix
        logic_custom_fields = frappe.get_all("Custom Field",
                                            filters={"fieldname": ["like", "logic_%"]},
                                            fields=["name", "dt", "fieldname", "label", "fieldtype", "options"])
        result["custom_fields"] = logic_custom_fields
        
        # Analysis
        result["analysis"] = {
            "total_logic_fields": len(logic_fields),
            "logic_fields_with_custom_fields": len([lf for lf in logic_fields if lf.get("has_custom_field")]),
            "total_logic_custom_fields": len(logic_custom_fields),
            "virtual_logic_fields": len([lf for lf in logic_fields if lf.get("is_virtual")]),
            "real_logic_fields": len([lf for lf in logic_fields if not lf.get("is_virtual")])
        }
        
        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def debug_table_structure(table_name=None):
    """Debug function to understand table structure and app naming"""
    try:
        if not table_name:
            # Get first available table
            tables = frappe.get_all("Flansa Table", limit=1)
            if tables:
                table_name = tables[0].name
            else:
                return {"success": False, "error": "No Flansa Tables found"}
        
        # Get the table record
        table_record = frappe.get_doc("Flansa Table", table_name)
        
        # Get all field values
        all_fields = {}
        for field_name, value in table_record.as_dict().items():
            if not field_name.startswith('_') and field_name not in ['docstatus', 'idx']:
                all_fields[field_name] = value
        
        # Check for related DocTypes
        related_info = {}
        
        # Check if there's a link to app records
        for field_name, value in all_fields.items():
            if value and isinstance(value, str):
                # Check if this looks like a link to another DocType
                if frappe.db.exists("Flansa Application", value):
                    app_record = frappe.get_doc("Flansa Application", value)
                    related_info[f"app_from_{field_name}"] = app_record.as_dict()
        
        return {
            "success": True,
            "table_name": table_name,
            "all_fields": all_fields,
            "related_info": related_info
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_link_wizard_data(table_name=None):
    """Get data for link field wizard"""
    try:
        # Debug: Log API call for troubleshooting
        frappe.logger().debug(f"get_link_wizard_data called with table_name: {table_name}")
        
        if not table_name:
            return {
                "success": False,
                "error": "table_name parameter is required"
            }
        
        # Define friendly app name function first (before any usage)
        def get_friendly_app_name(raw_name):
            """Convert raw app name to user-friendly display name"""
            if not raw_name or raw_name == "Unknown App":
                return "Other App"
            
            # Convert technical names to readable format
            friendly = raw_name
            
            # Convert snake_case to spaces
            friendly = friendly.replace("_", " ")
            
            # Convert kebab-case to spaces  
            friendly = friendly.replace("-", " ")
            
            # Convert camelCase to spaces (insert space before capital letters)
            import re
            friendly = re.sub(r'([a-z])([A-Z])', r'\1 \2', friendly)
            
            # Convert to proper title case
            friendly = friendly.title()
            
            # Clean up multiple spaces
            friendly = re.sub(r'\s+', ' ', friendly).strip()
            
            return friendly
            
        # Get current table info to determine the current app
        current_flansa_table = frappe.get_doc("Flansa Table", table_name)
        current_table_name = current_flansa_table.table_label or current_flansa_table.name
        
        # Debug: Current table processing
        frappe.logger().debug(f"Processing table: {table_name} ({current_table_name})")
        
        # Check if there's a direct app field in the Flansa Table
        current_app_name = None
        app_related_fields = ['app', 'app_name', 'application', 'application_name', 'parent_app', 'module']
        
        for field in app_related_fields:
            if hasattr(current_flansa_table, field):
                value = getattr(current_flansa_table, field)
                if value:
                    # Check if this value is a link to a Flansa Application record
                    if frappe.db.exists("Flansa Application", value):
                        try:
                            app_record = frappe.get_doc("Flansa Application", value)
                            # Use the app title or name from the linked record
                            current_app_name = getattr(app_record, 'title', None) or getattr(app_record, 'app_name', None) or getattr(app_record, 'application_name', None) or value
                            print(f"Found linked current app: {value} → {current_app_name}", flush=True)
                        except Exception as e:
                            print(f"Error reading current Flansa Application {value}: {e}", flush=True)
                            current_app_name = value
                    else:
                        current_app_name = value
                        print(f"Found app from {field}: {current_app_name}", flush=True)
                    break
        
        # If no direct app field found, use table name itself as app (no hardcoded patterns)
        if not current_app_name:
            # Simply use the table name itself as the app name
            current_app_name = current_table_name
            print(f"Using table name as app name: {current_app_name}", flush=True)
        
        # Store the raw current app name for comparison
        raw_current_app_name = current_app_name
        # Apply friendly naming to current app for display
        current_app_name_friendly = get_friendly_app_name(current_app_name)
        
        # Get all Flansa Tables
        flansa_tables = frappe.get_all("Flansa Table",
                                      fields=["name", "table_label", "doctype_name"])
        
        current_app_tables = []
        other_app_tables = []
        
        # Group tables based on their app association
        for ft in flansa_tables:
            if ft.doctype_name:
                ft_label = ft.table_label or ft.name
                
                # Get the full table record to check its app
                try:
                    ft_record = frappe.get_doc("Flansa Table", ft.name)
                    ft_app_name = None
                    
                    # Check for app field in this table
                    for field in app_related_fields:
                        if hasattr(ft_record, field):
                            value = getattr(ft_record, field)
                            if value:
                                # Check if this value is a link to a Flansa Application record
                                if frappe.db.exists("Flansa Application", value):
                                    try:
                                        app_record = frappe.get_doc("Flansa Application", value)
                                        # Use the app title or name from the linked record
                                        ft_app_name = getattr(app_record, 'title', None) or getattr(app_record, 'app_name', None) or getattr(app_record, 'application_name', None) or value
                                        print(f"Found linked app: {value} → {ft_app_name}", flush=True)
                                    except Exception as e:
                                        print(f"Error reading Flansa Application {value}: {e}", flush=True)
                                        ft_app_name = value
                                else:
                                    ft_app_name = value
                                break
                    
                    # If no app field, use table label as app name (no hardcoded patterns)
                    if not ft_app_name:
                        ft_app_name = ft_label
                    
                    table_info = {
                        "value": ft.name,  # Use Flansa Table ID instead of DocType name
                        "label": ft_label,
                        "type": "flansa_table",
                        "doctype_name": ft.doctype_name,  # Keep DocType name for reference
                        "app_name": ft_app_name,  # Keep raw app name for comparison
                        "app_name_friendly": get_friendly_app_name(ft_app_name)  # Add friendly name
                    }
                    
                    # Group by raw app name comparison
                    if ft_app_name == raw_current_app_name:
                        current_app_tables.append(table_info)
                        print(f"Added '{ft_label}' to current app (app: {ft_app_name})", flush=True)
                    else:
                        other_app_tables.append(table_info)
                        print(f"Added '{ft_label}' to other apps (app: {ft_app_name})", flush=True)
                        
                except Exception as e:
                    print(f"Error processing table {ft.name}: {e}", flush=True)
                    # Add to other_app_tables as fallback
                    table_info = {
                        "value": ft.name,  # Use Flansa Table ID instead of DocType name
                        "label": ft_label,
                        "type": "flansa_table",
                        "doctype_name": ft.doctype_name  # Keep DocType name for reference
                    }
                    other_app_tables.append(table_info)
        
        print(f"Grouped by app '{current_app_name_friendly}' (raw: {raw_current_app_name}):", flush=True)
        print(f"  Current app tables: {[t['label'] for t in current_app_tables]}", flush=True)
        print(f"  Other app tables: {[t['label'] + ' (' + t.get('app_name_friendly', t.get('app_name', 'Unknown')) + ')' for t in other_app_tables[:3]]}..." if len(other_app_tables) > 3 else f"  Other app tables: {[t['label'] + ' (' + t.get('app_name_friendly', t.get('app_name', 'Unknown')) + ')' for t in other_app_tables]}", flush=True)
        
        # Get system tables dynamically (no hardcoded DocType names)
        system_tables = []
        system_found = 0
        
        try:
            # Query for all standard DocTypes that are not custom and not tables
            # Use SQL query instead of frappe.get_all to bypass potential permission filtering
            system_doctypes = frappe.db.sql("""
                SELECT name, module
                FROM `tabDocType`
                WHERE custom = 0 
                AND istable = 0 
                AND issingle = 0
                ORDER BY name
            """, as_dict=True)
            
            # Filter out DocTypes that are already in Flansa tables
            existing_flansa_doctypes = [ft["value"] for ft in current_app_tables + other_app_tables]
            
            # Define commonly used DocTypes that should appear first
            # These are dynamically identified by common Link field usage patterns
            common_link_targets = {"User", "Role", "Company", "Customer", "Supplier", "Item", "Employee"}
            
            # Sort DocTypes: priority ones first, then alphabetical
            filtered_doctypes = [dt for dt in system_doctypes if dt.name not in existing_flansa_doctypes]
            
            # Separate priority and regular DocTypes
            priority_dts = [dt for dt in filtered_doctypes if dt.name in common_link_targets]
            regular_dts = [dt for dt in filtered_doctypes if dt.name not in common_link_targets]
            
            # Add all DocTypes (priority first, then regular)
            for dt in priority_dts + regular_dts:
                is_priority = dt.name in common_link_targets
                system_tables.append({
                    "value": dt.name,
                    "label": dt.name,
                    "type": "system",
                    "module": dt.module,
                    **({"priority": True} if is_priority else {})
                })
                system_found += 1
                        
        except Exception as e:
            frappe.logger().error(f"Error querying system DocTypes: {str(e)}")
            # Fallback to empty list if query fails
            system_tables = []
        
        # Group other app tables by app for hierarchical selection
        other_apps_grouped = {}
        available_apps = []
        
        print(f"Raw app names before mapping: {[t.get('app_name') for t in other_app_tables[:3]]}", flush=True)
        
        for table in other_app_tables:
            # Use the pre-calculated friendly name
            display_app_name = table.get("app_name_friendly", "Unknown App")
            raw_app_name = table.get("app_name", "Unknown App")
            
            print(f"App name mapping: '{raw_app_name}' → '{display_app_name}'", flush=True)
            
            if display_app_name not in other_apps_grouped:
                other_apps_grouped[display_app_name] = []
                available_apps.append(display_app_name)
            other_apps_grouped[display_app_name].append(table)
        
        # Log summary for debugging if needed
        frappe.logger().debug(f"Link wizard data: {len(current_app_tables)} current app tables, "
                            f"{len(other_app_tables)} other app tables, {len(system_tables)} system tables")
        
        return {
            "success": True,
            "current_app_tables": current_app_tables,
            "other_app_tables": other_app_tables,  # Keep for backward compatibility
            "other_apps_grouped": other_apps_grouped,
            "available_apps": available_apps,
            "system_tables": system_tables
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting link wizard data: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_fetch_wizard_data(table_name=None):
    """Get data for fetch field wizard"""
    try:
        print(f"get_fetch_wizard_data called with table_name: {table_name}", flush=True)
        
        if not table_name:
            return {
                "success": False,
                "error": "table_name parameter is required"
            }
        # Get current table info
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        # Get existing Link fields in current table
        meta = frappe.get_meta(target_doctype)
        link_fields = []
        
        for field in meta.get("fields"):
            if field.fieldtype == "Link" and field.options:
                link_fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label,
                    "options": field.options  # Linked DocType
                })
        
        return {
            "success": True,
            "link_fields": link_fields,
            "current_doctype": target_doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting fetch wizard data: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_linked_table_fields(linked_doctype=None):
    """Get fields from linked table for auto-fill selection"""
    try:
        print(f"get_linked_table_fields called with linked_doctype: {linked_doctype}", flush=True)
        
        if not linked_doctype:
            return {
                "success": False,
                "error": "linked_doctype parameter is required"
            }
        
        meta = frappe.get_meta(linked_doctype)
        fields = []
        
        print(f"Getting fields from {linked_doctype}", flush=True)
        
        for field in meta.get("fields"):
            # Include commonly useful field types for auto-fill
            if field.fieldtype in ["Data", "Text", "Int", "Float", "Currency", "Date", "Datetime", "Select", "Check", "Email", "Phone"]:
                fields.append({
                    "fieldname": field.fieldname,
                    "label": field.label or field.fieldname,
                    "fieldtype": field.fieldtype
                })
        
        print(f"Found {len(fields)} suitable fields in {linked_doctype}", flush=True)
        
        return {
            "success": True,
            "fields": fields
        }
        
    except Exception as e:
        print(f"Error in get_linked_table_fields: {str(e)}", flush=True)
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def create_field_from_template(table_name, template_id, template_data):
    """Create a Logic Field from template configuration"""
    try:
        if isinstance(template_data, str):
            template_data = json.loads(template_data)
        
        templates = LogicTemplates()
        template = templates.get_template(template_id)
        
        if not template:
            return {"success": False, "error": f"Template {template_id} not found"}
        
        # Prepare field configuration based on template type
        field_config = {
            "field_name": template_data.get("field_name"),
            "field_label": template_data.get("field_label"),
            "field_type": auto_detect_field_type_for_template(template_id, template_data),
            "description": f"Generated from {template['name']} template"
        }
        
        # Generate logic_expression for calculated fields (non-Link templates)
        formula = None
        if template_id != "link":
            formula = generate_formula_from_template(template, template_data)
            field_config.update({
                "logic_expression": formula,
                "read_only": 1  # Template fields are calculated
            })
        else:
            # For Link fields, add target DocType to options and store link configuration
            field_config["options"] = template_data.get("target_doctype", "")
            field_config["logic_type"] = "link"
            field_config["link_target_doctype"] = template_data.get("target_doctype", "")
            field_config["link_display_field"] = template_data.get("display_field", "")
            field_config["link_filters"] = template_data.get("link_filters", "")
        
        # Use the unified field creation system
        from flansa.native_fields import add_basic_field_native
        result = add_basic_field_native(table_name, field_config)
        
        if result.get("success"):
            result["template_used"] = template_id
            if formula:
                result["generated_formula"] = formula
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error creating field from template: {str(e)}", "Logic Templates")
        return {
            "success": False,
            "error": str(e)
        }

def generate_formula_from_template(template, template_data):
    """Generate formula from template and user data"""
    formula_template = template.get("formula_template", "")
    
    # Replace placeholders with actual values
    formula = formula_template
    for key, value in template_data.items():
        placeholder = "{" + key + "}"
        if placeholder in formula:
            formula = formula.replace(placeholder, str(value))
    
    return formula

def auto_detect_field_type_for_template(template_id, template_data):
    """Auto-detect field type based on template"""
    
    if template_id == "link":
        return "Link"
    
    elif template_id == "rollup":
        operation = template_data.get("operation_type", "")
        if operation in ["COUNT"]:
            return "Int"
        elif operation in ["SUM", "AVERAGE", "MAX", "MIN"]:
            return "Float"
        else:
            return "Data"
    
    elif template_id == "fetch":
        # Default to Data for fetch fields
        return "Data"
    
    elif template_id == "formula":
        # Try to detect from formula expression
        formula = template_data.get("formula_expression", "")
        if any(op in formula for op in ["+", "-", "*", "/", "SUM", "AVG"]):
            return "Float"
        else:
            return "Data"
    
    elif template_id == "conditional":
        # Detect based on true/false values
        true_val = template_data.get("true_value", "")
        false_val = template_data.get("false_value", "")
        
        if true_val.isdigit() and false_val.isdigit():
            return "Int"
        elif is_float(true_val) and is_float(false_val):
            return "Float"
        else:
            return "Data"
    
    return "Data"  # Safe default

def is_float(value):
    """Check if string can be converted to float"""
    try:
        float(value)
        return True
    except ValueError:
        return False


