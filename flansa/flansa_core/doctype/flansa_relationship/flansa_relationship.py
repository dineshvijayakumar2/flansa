import frappe
from frappe.model.document import Document
from frappe import _
import json
import re

class FlansaRelationship(Document):
    def validate(self):
        self.sync_field_names()  # Sync between old and new field names
        self.validate_tables()
        if self.relationship_type == "Many to Many":
            self.set_junction_table_name()
    
    def on_trash(self):
        """Automatically called when relationship is deleted - comprehensive cleanup"""
        self.delete_relationship()
        
        # Additional cleanup to prevent orphaned fields
        self._comprehensive_field_cleanup()
    
    def sync_field_names(self):
        """Sync between new simplified field names and legacy field names"""
        # Sync parent_table <-> from_table
        if self.parent_table and not self.from_table:
            self.from_table = self.parent_table
        elif self.from_table and not self.parent_table:
            self.parent_table = self.from_table
            
        # Sync child_table <-> to_table
        if self.child_table and not self.to_table:
            self.to_table = self.child_table
        elif self.to_table and not self.child_table:
            self.child_table = self.to_table
            
        # Sync junction fields
        if self.parent_junction_field and not self.from_junction_field:
            self.from_junction_field = self.parent_junction_field
        elif self.from_junction_field and not self.parent_junction_field:
            self.parent_junction_field = self.from_junction_field
            
        if self.child_junction_field and not self.to_junction_field:
            self.to_junction_field = self.child_junction_field
        elif self.to_junction_field and not self.child_junction_field:
            self.child_junction_field = self.to_junction_field
            
        # Sync child reference field
        if self.child_reference_field and not self.to_field:
            self.to_field = self.child_reference_field
        elif self.to_field and not self.child_reference_field:
            self.child_reference_field = self.to_field
    
    def get_clean_field_name(self, table_name, suffix="_link"):
        """Generate a clean field name from table name, removing special characters"""
        # Get the table_name from Flansa Table instead of using the ID
        table_doc = frappe.get_doc("Flansa Table", table_name)
        table_label = table_doc.table_label
        table_db_name = table_doc.table_name
        
        # Use the more readable table label for field naming
        if table_label:
            base_name = table_label.lower()
        else:
            base_name = table_db_name.lower()
        
        # Clean the name to remove special characters
        clean_name = base_name.replace('-', '').replace(' ', '_')
        # Remove other special characters except underscores
        import re
        clean_name = re.sub(r'[^a-z0-9_]', '', clean_name)
        # Remove multiple underscores
        clean_name = re.sub(r'_+', '_', clean_name)
        # Remove leading/trailing underscores
        clean_name = clean_name.strip('_')
        
        # Make it singular for link fields (remove plural 's' if present)
        if suffix == "_link" and clean_name.endswith('s') and len(clean_name) > 3:
            clean_name = clean_name[:-1]
        
        return f"{clean_name}{suffix}"
    
    def get_relationship_description(self):
        """Get human-readable description of the relationship"""
        from_table_doc = frappe.get_doc("Flansa Table", self.from_table)
        to_table_doc = frappe.get_doc("Flansa Table", self.to_table)
        
        if self.relationship_type == "One to Many":
            return f"Each {from_table_doc.table_label} can have multiple {to_table_doc.table_label}"
        elif self.relationship_type == "One to One":
            return f"Each {from_table_doc.table_label} links to exactly one {to_table_doc.table_label}"
        elif self.relationship_type == "Many to Many":
            return f"{from_table_doc.table_label} and {to_table_doc.table_label} can have multiple connections"
        else:
            return f"{from_table_doc.table_label} relates to {to_table_doc.table_label}"
    def validate_tables(self):
        # Get table references (handle both old and new field names)
        from_table = getattr(self, 'from_table', None) or getattr(self, 'parent_table', None)
        to_table = getattr(self, 'to_table', None) or getattr(self, 'child_table', None)
        
        # Allow self-referential relationships
        if from_table == to_table and self.relationship_type == "Self Referential":
            # This is valid - self-referential relationship
            pass
        elif from_table == to_table and self.relationship_type not in ["One to One", "Self Referential"]:
            # For other relationship types where both tables are same, suggest using Self Referential
            frappe.throw(_("When parent and child tables are the same, please use 'Self Referential' relationship type"))
    
    def set_junction_table_name(self):
        if not self.junction_table:
            # Handle both old and new field names
            parent_table = getattr(self, 'parent_table', None) or getattr(self, 'from_table', None)
            child_table = getattr(self, 'child_table', None) or getattr(self, 'to_table', None)
            
            if parent_table and child_table:
                parent_table_name = frappe.db.get_value("Flansa Table", parent_table, "table_name")
                child_table_name = frappe.db.get_value("Flansa Table", child_table, "table_name")
                
                # Clean table names for junction table
                parent_clean = self.get_clean_field_name(parent_table_name, "")
                child_clean = self.get_clean_field_name(child_table_name, "")
                
                self.junction_table = f"{parent_clean}_{child_clean}_junction"
                
                # Set both old and new junction field names
                self.parent_junction_field = f"{parent_clean}_id"
                self.child_junction_field = f"{child_clean}_id"
                
                # Legacy field names for backward compatibility
                self.from_junction_field = self.parent_junction_field
                self.to_junction_field = self.child_junction_field
    
    def after_insert(self):
        # Skip automatic field creation if flag is set (used by enterprise API)
        if not getattr(self, '_skip_auto_field_creation', False):
            self.create_relationship()
        # Removed: automatic default computed fields generation
        # Users can manually create computed fields as needed
    
    def on_update(self):
        if self.has_value_changed("status"):
            if self.status == "Active":
                self.create_relationship()
            else:
                self.deactivate_relationship()
        
    
    def on_trash(self):
        self.delete_relationship()
    
    def create_relationship(self):
        if self.status != "Active":
            return
        
        if self.relationship_type == "One to Many":
            self.create_one_to_many()
        elif self.relationship_type == "Many to Many":
            self.create_many_to_many()
        elif self.relationship_type == "One to One":
            self.create_one_to_one()
        elif self.relationship_type == "Self Referential":
            self.create_self_referential()
    
    def create_one_to_many(self):
        # Add link field in the "many" side table
        from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
        
        if not from_doctype or not to_doctype:
            frappe.log_error(f"Missing DocType names: from={from_doctype}, to={to_doctype}", "Relationship Field Creation")
            return
        
        # Ensure both DocTypes exist before proceeding
        if not frappe.db.exists("DocType", from_doctype):
            frappe.log_error(f"From DocType {from_doctype} does not exist", "Relationship Field Creation")
            return
        if not frappe.db.exists("DocType", to_doctype):
            frappe.log_error(f"To DocType {to_doctype} does not exist", "Relationship Field Creation")
            return
        
        # Add the link field to the child table
        field_name = self.to_field or self.get_clean_field_name(self.from_table)
        
        fields_added = False
        if not field_exists(to_doctype, field_name):
            from_table_label = frappe.db.get_value("Flansa Table", self.from_table, "table_label")
            try:
                safe_add_field_to_doctype(to_doctype, {
                    "fieldname": field_name,
                    "label": from_table_label,
                    "fieldtype": "Link",
                    "options": from_doctype,
                    "in_list_view": 1,
                    "in_standard_filter": 1
                })
                fields_added = True
                frappe.logger().info(f"Created Link field {field_name} in {to_doctype}")
            except Exception as e:
                frappe.log_error(f"Failed to create Link field {field_name}: {str(e)}", "Relationship Field Creation")
            
            # Add a section break and HTML field to show related records (instead of invalid Table field)
            section_field = f"{self.get_clean_field_name(self.to_table)}_section"
            html_field = f"{self.get_clean_field_name(self.to_table)}_html"
            
            if not field_exists(from_doctype, section_field):
                to_table_label = frappe.db.get_value("Flansa Table", self.to_table, "table_label")
                try:
                    # Add section break
                    safe_add_field_to_doctype(from_doctype, {
                        "fieldname": section_field,
                        "label": f"Related {to_table_label}",
                        "fieldtype": "Section Break",
                    })
                    
                    # Add HTML field to display related records
                    safe_add_field_to_doctype(from_doctype, {
                        "fieldname": html_field,
                        "label": f"{to_table_label} List",
                        "fieldtype": "HTML",
                        "options": f"<div class='related-records' data-doctype='{to_doctype}' data-link-field='{field_name}'>Loading related {to_table_label.lower()}...</div>",
                        "read_only": 1,
                        "is_virtual": 1
                    })
                    fields_added = True
                    frappe.logger().info(f"Created relationship display fields for {to_table_label} in {from_doctype}")
                except Exception as e:
                    frappe.log_error(f"Failed to create relationship display fields: {str(e)}", "Relationship Field Creation")
        
        # Fields are now managed directly via DocType - no JSON sync needed
        if fields_added:
            frappe.logger().info(f"Created {fields_added} relationship fields")
    
    def create_many_to_many(self):
        # Create junction table
        from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
        
        if not from_doctype or not to_doctype:
            return
        
        if not frappe.db.exists("DocType", from_doctype) or not frappe.db.exists("DocType", to_doctype):
            return
        
        # Create junction DocType with proper naming
        junction_doctype_name = f"Flansa Junction {self.junction_table}"
        
        if not frappe.db.exists("DocType", junction_doctype_name):
            from_table_label = frappe.db.get_value("Flansa Table", self.from_table, "table_label")
            to_table_label = frappe.db.get_value("Flansa Table", self.to_table, "table_label")
            
            junction_doc = frappe.get_doc({
                "doctype": "DocType",
                "name": junction_doctype_name,
                "module": "Flansa Generated",
                "custom": 1,
                "is_submittable": 0,
                "istable": 1,
                "fields": [
                    {
                        "fieldname": self.from_junction_field,
                        "label": from_table_label,
                        "fieldtype": "Link",
                        "options": from_doctype,
                        "reqd": 1,
                        "in_list_view": 1
                    },
                    {
                        "fieldname": self.to_junction_field,
                        "label": to_table_label,
                        "fieldtype": "Link",
                        "options": to_doctype,
                        "reqd": 1,
                        "in_list_view": 1
                    }
                ]
            })
            junction_doc.insert(ignore_permissions=True)
        
        # Add Table field in both tables
        safe_add_field_to_doctype(from_doctype, {
            "fieldname": self.get_clean_field_name(self.to_table, "_links"),
            "label": f"{frappe.db.get_value('Flansa Table', self.to_table, 'table_label')}",
            "fieldtype": "Table",
            "options": junction_doctype_name
        })
        
        safe_add_field_to_doctype(to_doctype, {
            "fieldname": self.get_clean_field_name(self.from_table, "_links"),
            "label": f"{frappe.db.get_value('Flansa Table', self.from_table, 'table_label')}",
            "fieldtype": "Table",
            "options": junction_doctype_name
        })
    
    def create_one_to_one(self):
        # Add link field in both tables with unique constraint
        from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
        
        if not from_doctype or not to_doctype:
            frappe.log_error(f"Missing DocType names: from={from_doctype}, to={to_doctype}", "Relationship Field Creation")
            return
        
        if not frappe.db.exists("DocType", from_doctype):
            frappe.log_error(f"From DocType {from_doctype} does not exist", "Relationship Field Creation")
            return
        if not frappe.db.exists("DocType", to_doctype):
            frappe.log_error(f"To DocType {to_doctype} does not exist", "Relationship Field Creation")
            return
        
        fields_added = False
        
        # Add link field in from table
        field_name = self.from_field or self.get_clean_field_name(self.to_table)
        if not field_exists(from_doctype, field_name):
            try:
                safe_add_field_to_doctype(from_doctype, {
                    "fieldname": field_name,
                    "label": frappe.db.get_value("Flansa Table", self.to_table, "table_label"),
                    "fieldtype": "Link",
                    "options": to_doctype,
                    "unique": 1,
                    "in_list_view": 1
                })
                fields_added = True
                frappe.logger().info(f"Created Link field {field_name} in {from_doctype}")
            except Exception as e:
                frappe.log_error(f"Failed to create Link field {field_name} in {from_doctype}: {str(e)}", "Relationship Field Creation")
        
        # Add link field in to table
        field_name = self.to_field or self.get_clean_field_name(self.from_table)
        if not field_exists(to_doctype, field_name):
            try:
                safe_add_field_to_doctype(to_doctype, {
                    "fieldname": field_name,
                    "label": frappe.db.get_value("Flansa Table", self.from_table, "table_label"),
                    "fieldtype": "Link",
                    "options": from_doctype,
                    "unique": 1,
                    "in_list_view": 1
                })
                fields_added = True
                frappe.logger().info(f"Created Link field {field_name} in {to_doctype}")
            except Exception as e:
                frappe.log_error(f"Failed to create Link field {field_name} in {to_doctype}: {str(e)}", "Relationship Field Creation")
        
        # Fields are now managed directly via DocType - no JSON sync needed
        if fields_added:
            frappe.logger().info(f"Created {fields_added} relationship fields")
    
    def create_self_referential(self):
        """Create a self-referential relationship (e.g., Employee -> Manager)"""
        doctype_name = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        
        if not doctype_name or not frappe.db.exists("DocType", doctype_name):
            return
        
        # Add parent field
        parent_field = self.from_field or "parent_" + self.get_clean_field_name(self.from_table, "")
        if not field_exists(doctype_name, parent_field):
            safe_add_field_to_doctype(doctype_name, {
                "fieldname": parent_field,
                "label": "Parent " + frappe.db.get_value("Flansa Table", self.from_table, "table_label"),
                "fieldtype": "Link",
                "options": doctype_name
            })
        
        # Add children HTML field (virtual display of child records)
        # We cannot use Table field for self-referential as a DocType cannot be a child of itself
        # Instead, we'll create an HTML field that can display the child records
        children_field = "child_" + self.get_clean_field_name(self.from_table, "_list")
        if not field_exists(doctype_name, children_field):
            safe_add_field_to_doctype(doctype_name, {
                "fieldname": children_field,
                "label": "Child " + frappe.db.get_value("Flansa Table", self.from_table, "table_label"),
                "fieldtype": "HTML",
                "options": f"<div class='child-records-container' data-parent-field='{parent_field}'></div>",
                "read_only": 1,
                "description": f"Records where {parent_field} points to this record"
            })
        
        # Add a count field to show number of children
        children_count_field = "child_" + self.get_clean_field_name(self.from_table, "_count")
        if not field_exists(doctype_name, children_count_field):
            safe_add_field_to_doctype(doctype_name, {
                "fieldname": children_count_field,
                "label": "Child Count",
                "fieldtype": "Int",
                "read_only": 1,
                "is_virtual": 1,
                "description": f"Number of child records"
            })
    
    def generate_default_computed_fields(self):
        """Generate default computed fields based on relationship type"""
        if getattr(self, "computed_fields", []):
            return  # Already has computed fields
        
        # Get target table to analyze fields
        to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
        if not to_doctype or not frappe.db.exists("DocType", to_doctype):
            return
        
        # Always add a count field
        self.append("computed_fields", {
            "field_name": f"total_{self.get_clean_field_name(self.to_table, '')}_count",
            "field_label": f"Total {frappe.db.get_value('Flansa Table', self.to_table, 'table_label')}",
            "computation_type": "Count",
            "auto_add": 1
        })
        
        # Analyze target fields for common aggregations
        target_meta = frappe.get_meta(to_doctype)
        
        for field in target_meta.fields:
            if field.fieldtype == "Currency":
                # Add sum for currency fields
                self.append("computed_fields", {
                    "field_name": f"total_{field.fieldname}",
                    "field_label": f"Total {field.label}",
                    "computation_type": "Sum",
                    "target_field": field.fieldname,
                    "auto_add": 0
                })
            elif field.fieldtype in ["Float", "Int"] and "qty" in field.fieldname.lower():
                # Add sum for quantity fields
                self.append("computed_fields", {
                    "field_name": f"total_{field.fieldname}",
                    "field_label": f"Total {field.label}",
                    "computation_type": "Sum",
                    "target_field": field.fieldname,
                    "auto_add": 0
                })
            elif field.fieldtype == "Check":
                # Add percentage for boolean fields
                self.append("computed_fields", {
                    "field_name": f"percent_{field.fieldname}",
                    "field_label": f"% {field.label}",
                    "computation_type": "Percent",
                    "target_field": field.fieldname,
                    "auto_add": 0
                })
            elif field.fieldtype == "Date" and any(word in field.fieldname.lower() for word in ["date", "created", "modified"]):
                # Add latest date
                self.append("computed_fields", {
                    "field_name": f"latest_{field.fieldname}",
                    "field_label": f"Latest {field.label}",
                    "computation_type": "Max",
                    "target_field": field.fieldname,
                    "auto_add": 0
                })
        
        self.save()
    
    def apply_computed_fields(self):
        """Apply computed fields to the parent DocType"""
        if not getattr(self, "computed_fields", []):
            return
        
        from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
        if not from_doctype or not frappe.db.exists("DocType", from_doctype):
            return
        
        # Check existing fields (both DocField and Custom Field)
        existing_docfields = [f.fieldname for f in frappe.get_meta(from_doctype).get("fields")]
        existing_custom_fields = [f.fieldname for f in frappe.get_list("Custom Field", 
            filters={"dt": from_doctype}, fields=["fieldname"])]
        existing_fields = existing_docfields + existing_custom_fields
        
        fields_added = 0
        for cf in getattr(self, "computed_fields", []):
            if cf.auto_add and cf.field_name not in existing_fields:
                # Determine field type based on computation
                field_type = "Int"  # Default for Count, Distinct Count
                
                if cf.computation_type == "Count":
                    field_type = "Int"
                elif cf.computation_type == "Distinct Count":
                    field_type = "Int"
                elif cf.computation_type == "Combine Text":
                    field_type = "Long Text"
                elif cf.computation_type in ["Sum", "Average"] and cf.target_field:
                    # Get target field type
                    to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
                    if to_doctype and frappe.db.exists("DocType", to_doctype):
                        target_field = frappe.get_meta(to_doctype).get_field(cf.target_field)
                        if target_field:
                            field_type = target_field.fieldtype
                elif cf.computation_type == "Percent":
                    field_type = "Percent"
                elif cf.computation_type in ["Maximum", "Minimum"] and cf.target_field:
                    # For date/text fields, preserve original type
                    to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
                    if to_doctype and frappe.db.exists("DocType", to_doctype):
                        target_field = frappe.get_meta(to_doctype).get_field(cf.target_field)
                        if target_field:
                            if target_field.fieldtype in ["Date", "Datetime"]:
                                field_type = target_field.fieldtype
                            elif target_field.fieldtype in ["Data", "Text", "Small Text", "Long Text"]:
                                field_type = target_field.fieldtype
                            else:
                                field_type = target_field.fieldtype
                
                # Add computed field directly to DocType (proper approach for custom DocTypes)
                try:
                    # Get the DocType document
                    doctype_doc = frappe.get_doc("DocType", from_doctype)
                    
                    # Verify this is a custom DocType (Flansa tables should all be custom)
                    if not doctype_doc.custom:
                        frappe.logger().warning(f"DocType {from_doctype} is not custom, skipping computed field creation")
                        continue
                    
                    # Create Flansa metadata for the field
                    flansa_metadata = {
                        "flansa_config": {
                            "field_type": "computed",
                            "computation_type": cf.computation_type,
                            "target_field": cf.target_field,
                            "relationship": self.name,
                            "created_at": frappe.utils.now()
                        },
                        "display_text": f"Auto-calculated: {cf.computation_type}" + (f" of {cf.target_field}" if cf.target_field else "")
                    }
                    
                    # Add field directly to DocType definition
                    doctype_doc.append("fields", {
                        "fieldname": cf.field_name,
                        "label": cf.field_label,
                        "fieldtype": field_type,
                        "read_only": 1,
                        "is_virtual": 1,
                        "in_standard_filter": 1,
                        "description": json.dumps(flansa_metadata),
                        "options": self._generate_virtual_field_options(cf.computation_type, cf.target_field)
                    })
                    
                    # Save the DocType (this updates the schema)
                    doctype_doc.save()
                    
                    # Clear ALL caches so new field is available immediately
                    frappe.clear_cache(doctype=from_doctype)
                    frappe.clear_cache()
                    
                    fields_added += 1
                    frappe.logger().info(f"Added computed field {cf.field_name} to DocType {from_doctype}")
                except Exception as e:
                    frappe.logger().error(f"Failed to create custom computed field {cf.field_name}: {e}")
        
        if fields_added > 0:
            frappe.msgprint(_("Added {0} computed fields to {1}").format(fields_added, from_doctype))
    
    def deactivate_relationship(self):
        """Handle relationship deactivation"""
        # Mark virtual fields as inactive but don't delete them
        # This preserves data integrity
        pass
    
    # Removed: sync_relationship_fields_to_json (fields_json deprecated)
    
    def delete_relationship(self):
        """Clean up when relationship is deleted"""
        try:
            # Remove junction tables for many-to-many
            if self.relationship_type == "Many to Many" and self.junction_table:
                junction_doctype_name = f"Flansa Junction {self.junction_table}"
                if frappe.db.exists("DocType", junction_doctype_name):
                    # Check if junction table has data
                    if frappe.db.count(junction_doctype_name) > 0:
                        frappe.throw(_("Cannot delete relationship with existing data in junction table"))
                    else:
                        frappe.delete_doc("DocType", junction_doctype_name)
            
            # Clean up lookup fields (virtual fields with fetch_from) created for this relationship
            self._cleanup_lookup_fields()
            
            # Clean up computed fields created for this relationship
            self._cleanup_computed_fields()
            
            # Clean up relationship fields created through enterprise API
            self._cleanup_relationship_fields()
            
            # Optionally clean up link fields (commented out to preserve data integrity)
            # self._cleanup_link_fields()
            
        except Exception as e:
            frappe.log_error(f"Error cleaning up relationship {self.name}: {str(e)}", "Relationship Cleanup")
    
    def _cleanup_lookup_fields(self):
        """Remove virtual lookup fields created for this relationship"""
        try:
            # Get the DocTypes involved
            from_table = frappe.get_doc("Flansa Table", self.from_table)
            to_table = frappe.get_doc("Flansa Table", self.to_table)
            
            if not from_table.doctype_name or not to_table.doctype_name:
                return
            
            # Clean up lookup fields in from_table that reference to_table
            self._remove_lookup_fields_from_doctype(from_table.doctype_name, to_table.doctype_name, self.from_field)
            
            # Clean up lookup fields in to_table that reference from_table (for bidirectional)
            if self.relationship_type == "One to One":
                self._remove_lookup_fields_from_doctype(to_table.doctype_name, from_table.doctype_name, self.to_field)
                
        except Exception as e:
            frappe.log_error(f"Error cleaning lookup fields: {str(e)}", "Lookup Field Cleanup")
    
    def _remove_lookup_fields_from_doctype(self, doctype_name, target_doctype, link_field):
        """Remove virtual lookup fields that fetch from the target doctype"""
        try:
            doctype_doc = frappe.get_doc("DocType", doctype_name)
            
            # Find lookup fields that fetch from the target doctype via the link field
            fields_to_remove = []
            for field in doctype_doc.fields:
                if (field.get("is_virtual") and 
                    field.get("fetch_from") and 
                    field.fetch_from.startswith(f"{link_field}.")):
                    fields_to_remove.append(field)
            
            if fields_to_remove:
                # Remove the lookup fields
                for field in fields_to_remove:
                    doctype_doc.fields.remove(field)
                
                # Save the DocType
                doctype_doc.save()
                
                frappe.logger().info(f"Removed {len(fields_to_remove)} lookup fields from {doctype_name}")
                
        except Exception as e:
            frappe.log_error(f"Error removing lookup fields from {doctype_name}: {str(e)}", "Lookup Field Removal")
    
    def _cleanup_computed_fields(self):
        """Remove computed fields created for this relationship - comprehensive cleanup"""
        try:
            # Get the parent DocType (where computed fields are added)
            parent_table = self.parent_table or self.from_table
            if not parent_table:
                return
                
            parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
            if not parent_doctype or not frappe.db.exists("DocType", parent_doctype):
                return
            
            fields_removed = 0
            
            # Method 1: Remove fields tracked in computed_fields child table
            if getattr(self, "computed_fields", []):
                for computed_field in getattr(self, "computed_fields", []):
                    try:
                        # Check if custom field exists
                        custom_field_name = frappe.db.get_value("Custom Field", {
                            "dt": parent_doctype,
                            "fieldname": computed_field.field_name
                        })
                        
                        if custom_field_name:
                            # Delete the custom field
                            custom_field_doc = frappe.get_doc("Custom Field", custom_field_name)
                            custom_field_doc.delete()
                            fields_removed += 1
                            frappe.logger().info(f"Deleted tracked computed field {computed_field.field_name} from {parent_doctype}")
                            
                    except Exception as e:
                        frappe.logger().error(f"Error removing tracked field {computed_field.field_name}: {e}")
            
            # Method 2: Find and remove ALL Custom Fields that claim to belong to this relationship
            # This catches orphaned fields that aren't tracked in computed_fields
            try:
                orphaned_fields = frappe.db.sql("""
                    SELECT name, fieldname, description
                    FROM `tabCustom Field`
                    WHERE dt = %s
                    AND (
                        description LIKE %s
                        OR description LIKE %s
                    )
                """, (parent_doctype, f'%"relationship": "{self.name}"%', f"%Auto-calculated:%"), as_dict=True)
                
                for field in orphaned_fields:
                    try:
                        # Parse description to check if it belongs to this relationship
                        belongs_to_this_rel = False
                        
                        if field.description:
                            # Try JSON format first
                            try:
                                import json
                                desc_data = json.loads(field.description)
                                if desc_data.get("flansa_config", {}).get("relationship") == self.name:
                                    belongs_to_this_rel = True
                            except:
                                # Check old format
                                if "Auto-calculated:" in field.description:
                                    belongs_to_this_rel = True
                        
                        if belongs_to_this_rel:
                            custom_field_doc = frappe.get_doc("Custom Field", field.name)
                            custom_field_doc.delete()
                            fields_removed += 1
                            frappe.logger().info(f"Deleted orphaned computed field {field.fieldname} from {parent_doctype}")
                            
                    except Exception as e:
                        frappe.logger().error(f"Error removing orphaned field {field.fieldname}: {e}")
                        
            except Exception as e:
                frappe.logger().error(f"Error finding orphaned fields: {e}")
            
            # Clear ALL caches after cleanup
            if fields_removed > 0:
                frappe.clear_cache(doctype=parent_doctype)
                if hasattr(frappe, 'model') and hasattr(frappe.model, 'clear_cache'):
                    frappe.model.clear_cache(parent_doctype)
                frappe.clear_cache()
                if hasattr(frappe, 'boot') and frappe.boot.get('docs'):
                    frappe.boot.docs.pop(parent_doctype, None)
                
                frappe.logger().info(f"Removed {fields_removed} total computed fields from {parent_doctype}")
                
        except Exception as e:
            frappe.log_error(f"Error cleaning up computed fields: {str(e)}", "Computed Field Cleanup")
    
    # Note: _track_created_field method removed as we no longer use Custom Fields
    # Fields are now tracked through metadata in the DocType field description
    # which is set when the field is added to the DocType in apply_computed_fields()
    
    def _comprehensive_field_cleanup(self):
        """Comprehensive field cleanup - removes fields from DocType definition"""
        try:
            parent_table = self.parent_table or self.from_table
            if not parent_table:
                return
                
            parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
            if not parent_doctype or not frappe.db.exists("DocType", parent_doctype):
                return
            
            # Get the DocType document
            doctype_doc = frappe.get_doc("DocType", parent_doctype)
            
            # Only proceed if this is a custom DocType
            if not doctype_doc.custom:
                frappe.logger().warning(f"Cannot remove fields from standard DocType {parent_doctype}")
                return
            
            cleanup_count = 0
            fields_to_remove = []
            
            # Find fields that belong to this relationship based on metadata
            for field in doctype_doc.fields:
                try:
                    if field.description:
                        metadata = json.loads(field.description)
                        if "flansa_config" in metadata:
                            if metadata["flansa_config"].get("relationship") == self.name:
                                fields_to_remove.append(field)
                                frappe.logger().info(f"Marked field {field.fieldname} for removal")
                except:
                    # Not JSON or not our field, skip
                    continue
            
            # Remove the fields from DocType
            if fields_to_remove:
                for field in fields_to_remove:
                    doctype_doc.fields.remove(field)
                    cleanup_count += 1
                    frappe.logger().info(f"Removed field {field.fieldname} from DocType {parent_doctype}")
                
                # Save the DocType
                doctype_doc.save()
            
            # Clean up any Property Setters (shouldn't exist for DocType fields, but just in case)
            computed_field_names = [cf.field_name for cf in (getattr(self, "computed_fields", []) or [])]
            for field_name in computed_field_names:
                try:
                    frappe.db.sql("""
                        DELETE FROM `tabProperty Setter`
                        WHERE doc_type = %s AND field_name = %s
                    """, (parent_doctype, field_name))
                except Exception as e:
                    frappe.logger().error(f"Error deleting Property Setters for {field_name}: {e}")
            
            # Clear caches
            if cleanup_count > 0:
                frappe.clear_cache(doctype=parent_doctype)
                frappe.clear_cache()
                frappe.logger().info(f"Comprehensive cleanup: Removed {cleanup_count} fields from DocType")
            
        except Exception as e:
            frappe.log_error(f"Error in comprehensive field cleanup: {str(e)}", "Comprehensive Field Cleanup")
    
    def _cleanup_relationship_fields(self):
        """Remove relationship fields (lookup fields) created for this relationship"""
        try:
            # Clean up lookup fields in both directions
            from_table = self.parent_table or self.from_table
            to_table = self.child_table or self.to_table
            
            if not from_table or not to_table:
                return
                
            from_doctype = frappe.db.get_value("Flansa Table", from_table, "doctype_name")
            to_doctype = frappe.db.get_value("Flansa Table", to_table, "doctype_name")
            
            if not from_doctype or not to_doctype:
                return
            
            # Remove lookup fields that were created for this relationship
            if getattr(self, "lookup_fields", []):
                for lookup_field in getattr(self, "lookup_fields", []):
                    self._remove_specific_field_from_doctype(from_doctype, lookup_field.field_name)
                    
            frappe.logger().info(f"Cleaned up relationship fields for {self.name}")
            
        except Exception as e:
            frappe.log_error(f"Error cleaning up relationship fields: {str(e)}", "Relationship Field Cleanup")
    
    def _remove_specific_field_from_doctype(self, doctype_name, field_name):
        """Remove a specific field from a DocType"""
        try:
            if not frappe.db.exists("DocType", doctype_name):
                return
                
            doctype_doc = frappe.get_doc("DocType", doctype_name)
            field_to_remove = None
            
            for field in doctype_doc.fields:
                if field.fieldname == field_name:
                    field_to_remove = field
                    break
            
            if field_to_remove:
                doctype_doc.fields.remove(field_to_remove)
                doctype_doc.save()
                frappe.logger().info(f"Removed field {field_name} from {doctype_name}")
                
        except Exception as e:
            frappe.log_error(f"Error removing field {field_name} from {doctype_name}: {str(e)}", "Field Removal")
    
    def _generate_virtual_field_options(self, computation_type, target_field):
        """Generate options for virtual computed field"""
        
        try:
            # Get child DocType name
            to_doctype = frappe.db.get_value("Flansa Table", self.to_table, "doctype_name")
            
            if not to_doctype:
                return ""
            
            # Find the link field in child table
            child_meta = frappe.get_meta(to_doctype)
            from_doctype = frappe.db.get_value("Flansa Table", self.from_table, "doctype_name")
            
            link_field = None
            for field in child_meta.fields:
                if field.fieldtype == 'Link' and field.options == from_doctype:
                    link_field = field.fieldname
                    break
            
            if not link_field:
                link_field = "classe_link"  # Fallback
            
            if computation_type == "Count":
                return f"frappe.db.count('{to_doctype}', {{'{link_field}': doc.name, 'docstatus': ['<', 2]}})"
            
            elif computation_type == "Distinct Count" and target_field:
                return f"frappe.db.sql(\"SELECT COUNT(DISTINCT `{target_field}`) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2 AND `{target_field}` IS NOT NULL AND `{target_field}` != ''\", (doc.name,))[0][0] or 0"
            
            elif computation_type == "Sum" and target_field:
                return f"frappe.db.sql(\"SELECT COALESCE(SUM(`{target_field}`), 0) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2\", (doc.name,))[0][0]"
            
            elif computation_type == "Average" and target_field:
                return f"frappe.db.sql(\"SELECT COALESCE(AVG(`{target_field}`), 0) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2\", (doc.name,))[0][0]"
            
            elif computation_type == "Min" and target_field:
                return f"frappe.db.sql(\"SELECT MIN(`{target_field}`) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2 AND `{target_field}` IS NOT NULL\", (doc.name,))[0][0] or ''"
            
            elif computation_type == "Max" and target_field:
                return f"frappe.db.sql(\"SELECT MAX(`{target_field}`) FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2 AND `{target_field}` IS NOT NULL\", (doc.name,))[0][0] or ''"
            
            elif computation_type == "Combine Text" and target_field:
                return f"', '.join(list(set([str(x[0]) for x in frappe.db.sql(\"SELECT DISTINCT `{target_field}` FROM `tab{to_doctype}` WHERE `{link_field}` = %s AND docstatus < 2 AND `{target_field}` IS NOT NULL AND `{target_field}` != '' ORDER BY `{target_field}`\", (doc.name,)) if x[0]])))"
            
            else:
                # Fallback to JSON options
                return json.dumps({
                    "relationship": self.name,
                    "computation_type": computation_type,
                    "target_field": target_field or "",
                    "condition": "",
                    "formula": ""
                })
                
        except Exception as e:
            frappe.log_error(f"Error generating virtual field options: {str(e)}", "Virtual Field Options")
            return ""

def field_exists(doctype, fieldname):
    """Check if field exists in a DocType"""
    return frappe.db.exists("DocField", {"parent": doctype, "fieldname": fieldname})

def safe_add_field_to_doctype(doctype, field_dict):
    """Safely add a field to an existing DocType with proper validation"""
    try:
        doc = frappe.get_doc("DocType", doctype)
        
        # Check if field already exists
        existing_field = None
        for field in doc.fields:
            if field.fieldname == field_dict["fieldname"]:
                existing_field = field
                break
        
        if existing_field:
            # Update existing field instead of adding new one
            frappe.logger().info(f"Field {field_dict['fieldname']} already exists in {doctype}, updating")
            for key, value in field_dict.items():
                if hasattr(existing_field, key):
                    setattr(existing_field, key, value)
        else:
            frappe.logger().info(f"Adding new field {field_dict['fieldname']} to {doctype}")
            
            # Add new field, but check if it's a valid table reference
            if field_dict.get("fieldtype") == "Table" and field_dict.get("options"):
                # Verify the child table exists and is actually a child table
                child_doctype = field_dict["options"]
                if not frappe.db.exists("DocType", child_doctype):
                    error_msg = f"Child table {child_doctype} does not exist"
                    frappe.log_error(error_msg, "Relationship Field Creation")
                    raise Exception(error_msg)
                
                child_meta = frappe.get_meta(child_doctype)
                if not child_meta.istable:
                    error_msg = f"DocType {child_doctype} is not a child table"
                    frappe.log_error(error_msg, "Relationship Field Creation")
                    raise Exception(error_msg)
            
            # Append the field to the DocType
            doc.append("fields", field_dict)
        
        # Save the DocType with proper error handling
        doc.save(ignore_permissions=True)
        frappe.logger().info(f"Successfully saved field {field_dict['fieldname']} to {doctype}")
        
        # Clear cache to ensure changes are reflected
        frappe.clear_cache(doctype=doctype)
        
    except Exception as e:
        error_msg = f"Error adding field {field_dict.get('fieldname', 'unknown')} to DocType {doctype}: {str(e)}"
        frappe.log_error(error_msg, "Safe Field Addition")
        raise Exception(error_msg)
# Computed field calculation engine
@frappe.whitelist()
def calculate_computed_field(doctype, name, relationship_name, computation_type, **kwargs):
    """Calculate value for a computed field"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Determine the link field and target table based on relationship direction
        if relationship.relationship_type == "One to Many":
            # Get the actual DocType names
            from_doctype = frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name")
            to_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
            
            if not from_doctype or not to_doctype:
                return 0
            
            # Check which direction this calculation is for
            if doctype == from_doctype:
                # This is the parent table, count children
                # Find the actual link field in child table that points to parent
                link_field = None
                if frappe.db.exists("DocType", to_doctype):
                    to_meta = frappe.get_meta(to_doctype)
                    for field in to_meta.fields:
                        if field.fieldtype == 'Link' and field.options == from_doctype:
                            link_field = field.fieldname
                            break
                
                # Fallback to expected name if not found
                if not link_field:
                    link_field = relationship.to_field or relationship.get_clean_field_name(relationship.from_table)
                
                target_doctype = to_doctype
                filters = {link_field: name}
            elif doctype == to_doctype:
                # This is the child table, get parent count (usually 1)
                link_field = relationship.from_field or relationship.get_clean_field_name(relationship.to_table)
                target_doctype = from_doctype
                filters = {"name": name}  # For reverse lookup
                return 1 if frappe.db.exists(target_doctype, filters) else 0
            else:
                return 0
        elif relationship.relationship_type == "Many to Many":
            # Handle junction table queries
            junction_doctype = f"Flansa Junction {relationship.junction_table}"
            if frappe.db.exists("DocType", junction_doctype):
                # Count records in junction table
                junction_field = f"{relationship.from_table}_id" if doctype == frappe.db.get_value("Flansa Table", relationship.from_table, "doctype_name") else f"{relationship.to_table}_id"
                return frappe.db.count(junction_doctype, {junction_field: name})
            return 0
        else:
            return 0
        
        # Perform calculation
        if computation_type == "Count":
            if not target_doctype or not frappe.db.exists("DocType", target_doctype):
                return 0
            return frappe.db.count(target_doctype, filters)
            
    except Exception as e:
        frappe.log_error(f"Error calculating computed field: {str(e)}", "Computed Field Calculation")
        return 0


def calculate_computed_field_extended(doctype, name, relationship_name, computation_type, target_doctype, filters, **kwargs):
    """Extended calculations for other computation types"""
    
    if computation_type == "Sum":
        target_field = kwargs.get("target_field")
        if not target_field:
            return 0
        result = frappe.db.sql("""
            SELECT SUM(`{field}`) 
            FROM `tab{doctype}` 
            WHERE {conditions}
        """.format(
            field=target_field,
            doctype=target_doctype,
            conditions=" AND ".join([f"`{k}` = %s" for k in filters.keys()])
        ), tuple(filters.values()))
        return result[0][0] or 0
    
    elif computation_type == "Average":
        target_field = kwargs.get("target_field")
        if not target_field:
            return 0
        result = frappe.db.sql("""
            SELECT AVG(`{field}`) 
            FROM `tab{doctype}` 
            WHERE {conditions}
        """.format(
            field=target_field,
            doctype=target_doctype,
            conditions=" AND ".join([f"`{k}` = %s" for k in filters.keys()])
        ), tuple(filters.values()))
        return result[0][0] or 0
    
    elif computation_type == "Max":
        target_field = kwargs.get("target_field")
        if not target_field:
            return None
        return frappe.db.get_value(target_doctype, filters, target_field, order_by=f"{target_field} desc")
    
    elif computation_type == "Min":
        target_field = kwargs.get("target_field")
        if not target_field:
            return None
        return frappe.db.get_value(target_doctype, filters, target_field, order_by=f"{target_field} asc")
    
    elif computation_type == "Percent":
        target_field = kwargs.get("target_field")
        if not target_field:
            return 0
        total = frappe.db.count(target_doctype, filters)
        if total == 0:
            return 0
        true_count = frappe.db.count(target_doctype, dict(filters, **{target_field: 1}))
        return (true_count / total) * 100
    
    elif computation_type == "Formula":
        # Custom formula evaluation
        formula = kwargs.get("formula")
        if not formula:
            return None
        # This would need safe evaluation with access to related data
        return None  # Placeholder
    
    return None


# Removed: sync_relationship_fields_to_json - fields_json approach deprecated
# Fields are now managed directly via DocType and Custom Fields
    def get_lookup_fields(self):
        """Get lookup fields associated with this relationship"""
        try:
            # Get lookup fields from the lookup_fields_management API
            from flansa.flansa_core.api.lookup_fields_management import get_relationship_lookup_fields
            return get_relationship_lookup_fields(self.name)
        except:
            return []
    
    def get_computed_fields(self):
        """Get computed fields associated with this relationship"""
        try:
            # Get computed fields from the computed_fields_management API
            from flansa.flansa_core.api.computed_fields_management import get_relationship_computed_fields
            return get_relationship_computed_fields(self.name)
        except:
            return []
    
    @property
    def lookup_fields(self):
        """Property to access lookup fields safely"""
        return self.get_lookup_fields()
    
    @property
    def computed_fields(self):
        """Property to access computed fields safely"""
        return self.get_computed_fields()

