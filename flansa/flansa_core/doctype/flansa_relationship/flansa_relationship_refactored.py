"""
Refactored Flansa Relationship - Uses DocType fields instead of Custom Fields
This is the proper approach for custom DocTypes
"""

import frappe
import json
from frappe import _
from frappe.utils import now

class FlansaRelationshipRefactored:
    """
    New approach: Add computed fields directly to DocType definition
    instead of using Custom Fields (which are meant for standard DocTypes only)
    """
    
    def apply_computed_fields(self):
        """Apply computed fields directly to the DocType definition"""
        if not self.computed_fields:
            return
        
        from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        if not from_doctype or not frappe.db.exists("DocType", from_doctype):
            return
        
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", from_doctype)
        
        # Check if this is a custom DocType (it should be for Flansa tables)
        if not doctype_doc.custom:
            frappe.throw(_("Cannot add computed fields to standard DocType. Use Custom Fields instead."))
            return
        
        # Get existing field names
        existing_fields = [f.fieldname for f in doctype_doc.fields]
        
        fields_added = 0
        fields_to_add = []
        
        for cf in self.computed_fields:
            if cf.auto_add and cf.field_name not in existing_fields:
                # Determine field type based on computation
                field_type = self._determine_field_type(cf)
                
                # Create Flansa metadata for tracking
                flansa_metadata = {
                    "flansa_config": {
                        "field_type": "computed",
                        "computation_type": cf.computation_type,
                        "target_field": cf.target_field,
                        "relationship": self.name,
                        "created_at": now()
                    },
                    "display_text": f"Auto-calculated: {cf.computation_type}" + (f" of {cf.target_field}" if cf.target_field else "")
                }
                
                # Prepare field definition
                field_def = {
                    "fieldname": cf.field_name,
                    "label": cf.field_label,
                    "fieldtype": field_type,
                    "read_only": 1,
                    "is_virtual": 1,  # Virtual field - no database column
                    "in_standard_filter": 1,
                    "description": json.dumps(flansa_metadata),
                    "options": self._generate_virtual_field_options(cf.computation_type, cf.target_field)
                }
                
                fields_to_add.append(field_def)
                fields_added += 1
        
        if fields_to_add:
            # Add all fields to DocType
            for field_def in fields_to_add:
                doctype_doc.append("fields", field_def)
                frappe.logger().info(f"Added computed field {field_def['fieldname']} to DocType {from_doctype}")
            
            # Save the DocType (this updates the database schema if needed)
            doctype_doc.save()
            
            # Clear caches
            frappe.clear_cache(doctype=from_doctype)
            frappe.clear_cache()
            
            frappe.msgprint(_("Added {0} computed fields to {1}").format(fields_added, from_doctype))
    
    def _determine_field_type(self, cf):
        """Determine appropriate field type for computed field"""
        field_type = "Int"  # Default
        
        if cf.computation_type in ["Sum", "Average"] and cf.target_field:
            # Get target field type
            to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
            if to_doctype and frappe.db.exists("DocType", to_doctype):
                target_field = frappe.get_meta(to_doctype).get_field(cf.target_field)
                if target_field:
                    field_type = target_field.fieldtype
        elif cf.computation_type == "Percent":
            field_type = "Percent"
        elif cf.computation_type in ["Max", "Min"] and cf.target_field:
            # For date fields
            to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
            if to_doctype and frappe.db.exists("DocType", to_doctype):
                target_field = frappe.get_meta(to_doctype).get_field(cf.target_field)
                if target_field and target_field.fieldtype in ["Date", "Datetime"]:
                    field_type = target_field.fieldtype
        
        return field_type
    
    def _generate_virtual_field_options(self, computation_type, target_field=None):
        """Generate the options/formula for virtual field calculation"""
        to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
        link_field = self.to_field or f"{self.from_table}_link"
        
        if computation_type == "Count":
            # Count related records
            return f"frappe.db.count('{to_doctype}', {{'{link_field}': doc.name, 'docstatus': ['<', 2]}})"
        
        elif computation_type == "Sum" and target_field:
            # Sum a specific field
            return f"""frappe.db.sql("SELECT COALESCE(SUM(`{target_field}`), 0) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2", (doc.name,))[0][0]"""
        
        elif computation_type == "Average" and target_field:
            # Average a specific field
            return f"""frappe.db.sql("SELECT COALESCE(AVG(`{target_field}`), 0) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2", (doc.name,))[0][0]"""
        
        elif computation_type == "Max" and target_field:
            # Maximum value
            return f"""frappe.db.sql("SELECT MAX(`{target_field}`) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2", (doc.name,))[0][0] or ''"""
        
        elif computation_type == "Min" and target_field:
            # Minimum value
            return f"""frappe.db.sql("SELECT MIN(`{target_field}`) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2", (doc.name,))[0][0] or ''"""
        
        return ""
    
    def delete_computed_fields(self):
        """Remove computed fields from DocType definition when relationship is deleted"""
        from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        if not from_doctype or not frappe.db.exists("DocType", from_doctype):
            return
        
        # Get the DocType document
        doctype_doc = frappe.get_doc("DocType", from_doctype)
        
        if not doctype_doc.custom:
            # If it's a standard DocType, we would need to delete Custom Fields
            # But this shouldn't happen with Flansa tables
            return
        
        # Find fields to remove based on relationship tracking in description
        fields_to_remove = []
        for field in doctype_doc.fields:
            try:
                if field.description:
                    metadata = json.loads(field.description)
                    if "flansa_config" in metadata:
                        if metadata["flansa_config"].get("relationship") == self.name:
                            fields_to_remove.append(field)
            except:
                continue
        
        if fields_to_remove:
            # Remove fields from DocType
            for field in fields_to_remove:
                doctype_doc.fields.remove(field)
                frappe.logger().info(f"Removed computed field {field.fieldname} from DocType {from_doctype}")
            
            # Save the updated DocType
            doctype_doc.save()
            
            # Clear caches
            frappe.clear_cache(doctype=from_doctype)
            frappe.clear_cache()
            
            frappe.msgprint(_("Removed {0} computed fields from {1}").format(len(fields_to_remove), from_doctype))


@frappe.whitelist()
def migrate_custom_fields_to_doctype():
    """
    One-time migration: Move all computed fields from Custom Fields to DocType fields
    """
    print("=== MIGRATING COMPUTED FIELDS FROM CUSTOM FIELDS TO DOCTYPE FIELDS ===")
    
    # Find all Custom Fields with Flansa metadata
    custom_fields = frappe.db.sql("""
        SELECT name, dt, fieldname, description
        FROM `tabCustom Field`
        WHERE description LIKE '%"field_type": "computed"%'
    """, as_dict=True)
    
    print(f"Found {len(custom_fields)} computed Custom Fields to migrate")
    
    migrated_count = 0
    by_doctype = {}
    
    # Group by DocType
    for cf in custom_fields:
        if cf.dt not in by_doctype:
            by_doctype[cf.dt] = []
        by_doctype[cf.dt].append(cf)
    
    # Process each DocType
    for doctype_name, fields in by_doctype.items():
        print(f"\nProcessing {doctype_name}...")
        
        if not frappe.db.exists("DocType", doctype_name):
            print(f"  ❌ DocType {doctype_name} not found")
            continue
        
        doctype_doc = frappe.get_doc("DocType", doctype_name)
        
        if not doctype_doc.custom:
            print(f"  ⚠ {doctype_name} is a standard DocType, skipping")
            continue
        
        # Get full Custom Field documents
        for cf_summary in fields:
            cf = frappe.get_doc("Custom Field", cf_summary.name)
            
            # Check if field already exists in DocType
            existing = [f for f in doctype_doc.fields if f.fieldname == cf.fieldname]
            if existing:
                print(f"  ⚠ Field {cf.fieldname} already exists in DocType")
                continue
            
            # Add to DocType fields
            doctype_doc.append("fields", {
                "fieldname": cf.fieldname,
                "label": cf.label,
                "fieldtype": cf.fieldtype,
                "options": cf.options,
                "reqd": cf.reqd,
                "read_only": cf.read_only,
                "is_virtual": cf.is_virtual,
                "hidden": cf.hidden,
                "description": cf.description,
                "in_list_view": cf.in_list_view,
                "in_standard_filter": cf.in_standard_filter,
                "depends_on": cf.depends_on,
                "fetch_from": cf.fetch_from,
                "default": cf.default
            })
            
            print(f"  ✓ Migrated field {cf.fieldname}")
            migrated_count += 1
            
            # Delete the Custom Field
            frappe.delete_doc("Custom Field", cf.name)
        
        # Save the DocType with new fields
        doctype_doc.save()
        frappe.clear_cache(doctype=doctype_name)
        print(f"  ✓ Saved {doctype_name} with migrated fields")
    
    frappe.db.commit()
    
    print(f"\n=== MIGRATION COMPLETE ===")
    print(f"Migrated {migrated_count} computed fields from Custom Fields to DocType fields")
    
    return {
        "success": True,
        "migrated_count": migrated_count,
        "doctypes_processed": list(by_doctype.keys())
    }