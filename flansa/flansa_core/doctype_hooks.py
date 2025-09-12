"""
DocType hooks for Logic Field calculations and tenant inheritance
"""
import frappe
from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine

def calculate_logic_fields(doc, method=None):
    """Calculate Logic Fields for any DocType on save/load"""
    
    try:
        # Check if Flansa Logic Field DocType exists
        if not frappe.db.exists("DocType", "Flansa Logic Field"):
            return
            
        # Get Logic Fields for this DocType
        logic_fields = frappe.get_all("Flansa Logic Field", 
                                     filters={
                                         "is_active": 1
                                     },
                                     fields=["name", "field_name", "logic_expression", "table_name"])
        
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
                
                # Skip Link fields - they should preserve user-entered values, not be calculated
                if hasattr(logic_field_doc, 'logic_type') and logic_field_doc.logic_type == 'link':
                    print(f"⏭️  Skipping Link field calculation for {logic_field.field_name}", flush=True)
                    continue
                
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

def validate_logic_fields(doc, method=None):
    """Prevent manual editing of Logic Fields"""
    
    try:
        # Check if Flansa Logic Field DocType exists
        if not frappe.db.exists("DocType", "Flansa Logic Field"):
            return
            
        # Get Logic Fields for this DocType
        logic_fields = frappe.get_all("Flansa Logic Field", 
                                     filters={
                                         "is_active": 1
                                     },
                                     fields=["field_name", "table_name"])
        
        # Filter Logic Fields for this DocType
        doctype_logic_fields = []
        for field in logic_fields:
            try:
                flansa_table = frappe.get_doc("Flansa Table", field.table_name)
                if flansa_table.doctype_name == doc.doctype:
                    doctype_logic_fields.append(field.field_name)
            except:
                continue
        
        if not doctype_logic_fields:
            return
        
        # Check if any logic fields were manually modified
        if hasattr(doc, '_doc_before_save') and doc._doc_before_save:
            for field_name in doctype_logic_fields:
                old_value = getattr(doc._doc_before_save, field_name, None)
                new_value = getattr(doc, field_name, None)
                
                # Allow system/calculation updates but prevent manual user edits
                if (old_value != new_value and 
                    not getattr(doc, '_logic_field_update', False) and
                    frappe.session.user != 'Administrator'):
                    
                    frappe.throw(
                        f"Field '{field_name}' is a calculated Logic Field and cannot be edited manually. "
                        f"It will be automatically calculated based on its formula."
                    )
                    
    except Exception as e:
        # Don't break document save if validation fails
        frappe.log_error(f"Logic Field validation error: {str(e)}", "FlansaLogic Validation")

def apply_tenant_inheritance(doc, method=None):
    """Auto-populate tenant fields for Flansa Generated DocTypes"""
    
    # Only apply to Flansa Generated DocTypes
    if not hasattr(doc, 'meta') or doc.meta.module != "Flansa Generated":
        return
    
    try:
        # Auto-populate workspace_id if not set
        if hasattr(doc, 'workspace_id') and not doc.workspace_id:
            from flansa.id_based_utils import get_workspace_id_from_context
            doc.workspace_id = get_workspace_id_from_context()
        
        # Auto-populate application_id if available from context  
        if hasattr(doc, 'application_id') and not doc.application_id:
            # Try to get from session or request context
            application_id = frappe.local.form_dict.get('application') or frappe.session.get('current_application')
            if application_id:
                doc.application_id = application_id
        
        # Auto-populate flansa_table_id if available
        if hasattr(doc, 'flansa_table_id') and not doc.flansa_table_id:
            # Try to determine from DocType name mapping
            table_mapping = frappe.cache().get_value("flansa_doctype_table_mapping")
            if table_mapping and doc.doctype in table_mapping:
                doc.flansa_table_id = table_mapping[doc.doctype]
            else:
                # Rebuild table mapping cache if not found
                rebuild_doctype_table_mapping()
                table_mapping = frappe.cache().get_value("flansa_doctype_table_mapping")
                if table_mapping and doc.doctype in table_mapping:
                    doc.flansa_table_id = table_mapping[doc.doctype]
    
    except Exception as e:
        frappe.log_error(f"Tenant inheritance error: {str(e)}", "Tenant Inheritance")

def rebuild_doctype_table_mapping():
    """Rebuild the DocType to Table mapping cache"""
    try:
        tables = frappe.get_all("Flansa Table", 
            filters={"doctype_name": ["!=", ""]},
            fields=["name", "doctype_name"]
        )
        
        table_mapping = {}
        for table in tables:
            if table.doctype_name:
                table_mapping[table.doctype_name] = table.name
        
        frappe.cache().set_value("flansa_doctype_table_mapping", table_mapping)
        
    except Exception as e:
        frappe.log_error(f"Error rebuilding DocType table mapping: {str(e)}", "Tenant Inheritance")

