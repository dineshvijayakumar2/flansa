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
                                     fields=["field_name", "expression", "table_name"])
        
        # Filter Logic Fields for this DocType
        doctype_logic_fields = []
        for field in logic_fields:
            try:
                # Get the target DocType for this Logic Field
                flansa_table = frappe.get_doc("Flansa Table", field.table_name)
                if flansa_table.table_name == doc.doctype:
                    doctype_logic_fields.append(field)
            except:
                continue
        
        if not doctype_logic_fields:
            return
        
        # Calculate each Logic Field
        engine = get_logic_engine()
        
        for logic_field in doctype_logic_fields:
            try:
                # Get field data for calculation
                field_data = {}
                
                # Add all doc fields to the calculation context
                for fieldname, value in doc.as_dict().items():
                    if not fieldname.startswith('_'):
                        field_data[fieldname] = value
                
                # Calculate the Logic Field value
                result = engine.evaluate(logic_field.expression, field_data)
                
                # Set the calculated value in the document
                setattr(doc, logic_field.field_name, result)
                
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
