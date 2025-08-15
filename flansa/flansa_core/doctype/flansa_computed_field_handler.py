# Virtual Field Handler for Computed Relationships
import frappe
import json
from frappe.model.document import Document


class FlansaComputedFieldHandler:
    """Handler for virtual computed fields in relationships"""
    
    @staticmethod
    def get_virtual_field_value(doc, fieldname):
        """Get computed value for virtual fields"""
        try:
            # Get the field definition from DocType
            meta = frappe.get_meta(doc.doctype)
            field = meta.get_field(fieldname)
            
            if not field or not field.is_virtual or not field.options:
                return None
            
            # Parse the field options JSON
            try:
                options = json.loads(field.options)
            except (json.JSONDecodeError, TypeError):
                return None
            
            relationship_name = options.get("relationship")
            computation_type = options.get("computation_type")
            target_field = options.get("target_field", "")
            condition = options.get("condition", "")
            formula = options.get("formula", "")
            
            if not relationship_name or not computation_type:
                return None
            
            # Import the calculation function
            from flansa.flansa_core.doctype.flansa_relationship.flansa_relationship import calculate_computed_field
            
            # Calculate the value
            result = calculate_computed_field(
                doc.doctype, 
                doc.name,
                relationship_name,
                computation_type,
                target_field=target_field,
                condition=condition,
                formula=formula
            )
            
            return result
            
        except Exception as e:
            frappe.log_error(f"Error calculating virtual field {fieldname}: {str(e)}", "Virtual Field Error")
            return None


# Hook into Frappe's virtual field system
@frappe.whitelist()
def get_computed_field_value(doctype, name, fieldname):
    """API endpoint to get computed field values"""
    try:
        doc = frappe.get_doc(doctype, name)
        handler = FlansaComputedFieldHandler()
        return handler.get_virtual_field_value(doc, fieldname)
    except Exception as e:
        frappe.log_error(f"Error getting computed field value: {str(e)}", "Computed Field API")
        return None


def setup_virtual_field_hooks():
    """Set up hooks for virtual field processing"""
    
    # Add method to all DocTypes for virtual field processing
    def get_virtual_field_value(self, fieldname):
        handler = FlansaComputedFieldHandler()
        return handler.get_virtual_field_value(self, fieldname)
    
    # Monkey patch the method onto Document class
    if not hasattr(Document, 'get_flansa_virtual_field_value'):
        Document.get_flansa_virtual_field_value = get_virtual_field_value


# Initialize the hooks
setup_virtual_field_hooks()