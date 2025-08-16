"""
DocType hooks for Logic Field calculations
"""
import frappe
from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine

def calculate_logic_fields(doc, method=None):
    """Calculate Logic Fields for any DocType on save/load"""
    
    try:
        # Get Logic Fields for this DocType
        logic_fields = frappe.get_all("Flansa Logic Field", 
                                     filters={
                                         "is_active": 1
                                     },
                                     fields=["name", "field_name", "expression", "table_name"])
        
        # Filter Logic Fields for this DocType
        doctype_logic_fields = []
        for field in logic_fields:
            try:
                # Get the target DocType for this Logic Field
                flansa_table = frappe.get_doc("Flansa Table", field.table_name)
                if flansa_table.doctype_name == doc.doctype:
                    doctype_logic_fields.append(field)
            except:
                continue
        
        if not doctype_logic_fields:
            return
        
        # Calculate each Logic Field using the proper calculation functions
        for logic_field in doctype_logic_fields:
            try:
                # Get the full Logic Field document for calculation
                logic_field_doc = frappe.get_doc("Flansa Logic Field", logic_field.name)
                
                # Use the proper calculation function based on expression type
                from flansa.flansa_core.api.table_api import calculate_field_value_by_type
                calculated_value = calculate_field_value_by_type(doc, logic_field_doc)
                
                # Set the calculated value in the document
                setattr(doc, logic_field.field_name, calculated_value)
                
            except Exception as calc_error:
                # If calculation fails, set to None or error message
                setattr(doc, logic_field.field_name, f"Error: {str(calc_error)}")
                
    except Exception as e:
        # Don't break document save if Logic Field calculation fails
        frappe.log_error(f"Logic Field calculation error: {str(e)}", "FlansaLogic Calculation")

def setup_logic_field_hooks():
    """Setup hooks for Logic Field calculation on all DocTypes"""
    
    # This would be called from hooks.py to setup global hooks
    # For now, we'll handle this per-DocType when Logic Fields are added
    pass
