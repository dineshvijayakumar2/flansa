"""
DocType Overrides for Enhanced Virtual Fields
Dynamically enhances DocTypes with virtual field capabilities
"""

import frappe
from frappe.model.document import Document


def get_enhanced_document_class(doctype):
    """Get enhanced document class with virtual fields"""
    
    if doctype == "UnschoolingTracker_Classes":
        return EnhancedUnschoolingTrackerClasses
    
    # Return default Document class for other types
    return Document


class EnhancedUnschoolingTrackerClasses(Document):
    """Enhanced UnschoolingTracker_Classes with virtual field support"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._virtual_field_cache = {}
    
    @property
    def count_of_schedule(self):
        """Count of related Schedule records with caching"""
        
        if not self.name:
            return 0
            
        # Check cache first
        cache_key = f"count_of_schedule_{self.name}"
        if cache_key in self._virtual_field_cache:
            return self._virtual_field_cache[cache_key]
        
        try:
            # Count related schedule records
            count = frappe.db.count('UnschoolingTracker_Schedule', {
                'classe_link': self.name,
                'docstatus': ['<', 2]  # Exclude cancelled documents
            })
            
            # Cache the result
            self._virtual_field_cache[cache_key] = count
            return count
            
        except Exception as e:
            frappe.logger().error(f"Error calculating count_of_schedule: {e}")
            return 0
    
    def clear_virtual_field_cache(self, field_name=None):
        """Clear virtual field cache"""
        if field_name:
            cache_key = f"{field_name}_{self.name}"
            self._virtual_field_cache.pop(cache_key, None)
        else:
            self._virtual_field_cache.clear()
    
    def get_value(self, fieldname, *args, **kwargs):
        """Override get_value to handle virtual fields"""
        
        # Check if it's our virtual field
        if fieldname == 'count_of_schedule':
            return self.count_of_schedule
        
        # For other fields, use the parent implementation
        return super().get_value(fieldname, *args, **kwargs)


def setup_doctype_overrides():
    """Setup DocType overrides using frappe's document class registry"""
    
    try:
        # Register the enhanced class for UnschoolingTracker_Classes
        import frappe.model.document
        
        # Store the enhanced class in frappe's document registry
        frappe.model.document._class_overrides = getattr(frappe.model.document, '_class_overrides', {})
        frappe.model.document._class_overrides['UnschoolingTracker_Classes'] = EnhancedUnschoolingTrackerClasses
        
        frappe.logger().info("Enhanced DocType overrides activated for UnschoolingTracker_Classes")
        
    except Exception as e:
        frappe.logger().error(f"Error setting up DocType overrides: {e}")


@frappe.whitelist()
def get_virtual_field_value(doctype, name, fieldname):
    """API to get virtual field value"""
    
    try:
        # For UnschoolingTracker_Classes, calculate directly
        if doctype == "UnschoolingTracker_Classes" and fieldname == "count_of_schedule":
            count = frappe.db.count('UnschoolingTracker_Schedule', {
                'classe_link': name,
                'docstatus': ['<', 2]  # Exclude cancelled documents
            })
            return count
        
        # For other cases, try to get from document
        doc = frappe.get_doc(doctype, name)
        
        if hasattr(doc, fieldname):
            value = getattr(doc, fieldname)
            return value
        else:
            return doc.get_value(fieldname)
            
    except Exception as e:
        frappe.logger().error(f"Error getting virtual field {fieldname}: {e}")
        return None