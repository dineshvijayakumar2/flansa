"""
Computed Fields Management API
Manages computed fields for relationships
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def add_computed_field_to_relationship(relationship_name, computed_field):
    """Add a new computed field to an existing relationship"""
    try:
        if isinstance(computed_field, str):
            computed_field = json.loads(computed_field)
        
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Check if field name already exists in relationship
        existing_names = [cf.field_name for cf in relationship.computed_fields]
        if computed_field.get("field_name") in existing_names:
            return {
                "success": False,
                "error": f"Field name {computed_field.get('field_name')} already exists in relationship"
            }
        
        # Also check if field exists in DocType
        parent_table = relationship.parent_table or relationship.from_table
        if parent_table:
            parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
            if parent_doctype and frappe.db.exists("DocType", parent_doctype):
                if frappe.db.exists("DocField", {"parent": parent_doctype, "fieldname": computed_field.get("field_name")}):
                    # Field exists in DocType but not in relationship - this is an orphaned field
                    # Clean it up first
                    from flansa.computed_field_cleanup import cleanup_orphaned_computed_fields
                    cleanup_orphaned_computed_fields(relationship_name)
                    
                    # Check again if it's a virtual computed field for this relationship
                    field_doc = frappe.db.get_value("DocField", 
                                                   {"parent": parent_doctype, "fieldname": computed_field.get("field_name")},
                                                   ["options", "is_virtual"], as_dict=True)
                    if field_doc and field_doc.is_virtual and field_doc.options:
                        try:
                            options = json.loads(field_doc.options)
                            if options.get("relationship") == relationship_name:
                                return {
                                    "success": False,
                                    "error": f"Field {computed_field.get('field_name')} already exists in DocType as a computed field"
                                }
                        except:
                            pass
        
        # Add the computed field
        relationship.append("computed_fields", {
            "field_name": computed_field.get("field_name"),
            "field_label": computed_field.get("field_label"),
            "computation_type": computed_field.get("computation_type"),
            "target_field": computed_field.get("target_field"),
            "auto_add": computed_field.get("auto_add", 1),
            "condition": computed_field.get("condition"),
            "formula": computed_field.get("formula")
        })
        
        relationship.save()
        
        # Apply the computed field if auto_add is set
        if computed_field.get("auto_add"):
            relationship.apply_computed_fields()
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Added computed field {computed_field.get('field_label')}"
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding computed field: {str(e)}", "Computed Field Add")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def remove_computed_field_from_relationship(relationship_name, field_name):
    """Remove a computed field from a relationship"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Find and remove the field
        removed = False
        for i, cf in enumerate(relationship.computed_fields):
            if cf.field_name == field_name:
                relationship.computed_fields.pop(i)
                removed = True
                break
        
        if not removed:
            return {
                "success": False,
                "error": f"Field {field_name} not found"
            }
        
        relationship.save()
        frappe.db.commit()
        
        # Note: We don't remove the field from DocType to preserve data
        # It can be manually removed if needed
        
        return {
            "success": True,
            "message": f"Removed computed field {field_name}",
            "warning": "The field still exists in the DocType. Remove it manually if needed."
        }
        
    except Exception as e:
        frappe.log_error(f"Error removing computed field: {str(e)}", "Computed Field Remove")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_suggested_computed_fields(relationship_name):
    """Get suggested computed fields based on relationship and target table"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get target table DocType
        to_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
        if not to_doctype or not frappe.db.exists("DocType", to_doctype):
            return {"success": False, "error": "Target DocType not found"}
        
        # Get existing computed field names to avoid duplicates
        existing_names = [cf.field_name for cf in relationship.computed_fields]
        
        suggestions = []
        
        # Always suggest a count field if not exists
        count_field_name = f"total_{frappe.scrub(relationship.to_table)}_count"
        if count_field_name not in existing_names:
            suggestions.append({
                "field_name": count_field_name,
                "field_label": f"Total {frappe.db.get_value('Flansa Table', relationship.to_table, 'table_label')}",
                "computation_type": "Count",
                "auto_suggested": True,
                "reason": "Count of related records"
            })
        
        # Analyze target table fields for suggestions
        target_meta = frappe.get_meta(to_doctype)
        
        for field in target_meta.fields:
            # Suggest sum for currency fields
            if field.fieldtype == "Currency":
                sum_field_name = f"total_{field.fieldname}"
                if sum_field_name not in existing_names:
                    suggestions.append({
                        "field_name": sum_field_name,
                        "field_label": f"Total {field.label}",
                        "computation_type": "Sum",
                        "target_field": field.fieldname,
                        "auto_suggested": True,
                        "reason": f"Sum of {field.label} (Currency field)"
                    })
                
                # Also suggest average
                avg_field_name = f"avg_{field.fieldname}"
                if avg_field_name not in existing_names:
                    suggestions.append({
                        "field_name": avg_field_name,
                        "field_label": f"Average {field.label}",
                        "computation_type": "Average",
                        "target_field": field.fieldname,
                        "auto_suggested": True,
                        "reason": f"Average of {field.label}"
                    })
            
            # Suggest sum for quantity fields
            elif field.fieldtype in ["Float", "Int"] and any(keyword in field.fieldname.lower() for keyword in ["qty", "quantity", "count", "number"]):
                sum_field_name = f"total_{field.fieldname}"
                if sum_field_name not in existing_names:
                    suggestions.append({
                        "field_name": sum_field_name,
                        "field_label": f"Total {field.label}",
                        "computation_type": "Sum",
                        "target_field": field.fieldname,
                        "auto_suggested": True,
                        "reason": f"Sum of {field.label} (Quantity field)"
                    })
            
            # Suggest percentage for boolean fields
            elif field.fieldtype == "Check":
                percent_field_name = f"percent_{field.fieldname}"
                if percent_field_name not in existing_names:
                    suggestions.append({
                        "field_name": percent_field_name,
                        "field_label": f"% {field.label}",
                        "computation_type": "Percent",
                        "target_field": field.fieldname,
                        "auto_suggested": True,
                        "reason": f"Percentage of records with {field.label} checked"
                    })
            
            # Suggest latest/earliest for date fields
            elif field.fieldtype in ["Date", "Datetime"]:
                # Latest date
                max_field_name = f"latest_{field.fieldname}"
                if max_field_name not in existing_names:
                    suggestions.append({
                        "field_name": max_field_name,
                        "field_label": f"Latest {field.label}",
                        "computation_type": "Max",
                        "target_field": field.fieldname,
                        "auto_suggested": True,
                        "reason": f"Most recent {field.label}"
                    })
                
                # Earliest date
                min_field_name = f"earliest_{field.fieldname}"
                if min_field_name not in existing_names:
                    suggestions.append({
                        "field_name": min_field_name,
                        "field_label": f"Earliest {field.label}",
                        "computation_type": "Min",
                        "target_field": field.fieldname,
                        "auto_suggested": True,
                        "reason": f"Earliest {field.label}"
                    })
        
        return {
            "success": True,
            "suggestions": suggestions,
            "existing_fields": existing_names
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting computed field suggestions: {str(e)}", "Computed Field Suggestions")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def test_computed_field_calculation(relationship_name, computation_type, target_field=None, sample_record=None):
    """Test a computed field calculation with sample data"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get a sample parent record if not provided
        if not sample_record:
            from_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
            if from_doctype and frappe.db.exists("DocType", from_doctype):
                sample_records = frappe.get_list(from_doctype, limit=1)
                if sample_records:
                    sample_record = sample_records[0].name
        
        if not sample_record:
            return {
                "success": False,
                "error": "No sample record found for testing"
            }
        
        # Import and call the calculation function
        from flansa.flansa_core.doctype.flansa_relationship.flansa_relationship import calculate_computed_field
        
        from_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
        
        result = calculate_computed_field(
            from_doctype,
            sample_record,
            relationship_name,
            computation_type,
            target_field=target_field
        )
        
        return {
            "success": True,
            "sample_record": sample_record,
            "computation_type": computation_type,
            "target_field": target_field,
            "result": result
        }
        
    except Exception as e:
        frappe.log_error(f"Error testing computed field: {str(e)}", "Computed Field Test")
        return {"success": False, "error": str(e)}