import frappe
from frappe.model.document import Document
from frappe import _
from flansa.id_based_utils import generate_id_based_doctype_name, get_workspace_id_from_context, get_workspace_id_from_application

class FlansaTable(Document):
    def validate(self):
        """Validate table configuration"""
        self.validate_naming_convention()
        self.inherit_tenant_from_application()
        # Auto-generate DocType name if needed
        if not self.doctype_name and self.application and self.table_name:
            self.doctype_name = self.get_generated_doctype_name()
    
    def inherit_tenant_from_application(self):
        """Inherit workspace_id from the parent Application for consistent multi-tenancy"""
        try:
            if self.application:
                # Get the workspace_id from the Application
                app_workspace_id = get_workspace_id_from_application(self.application)
                
                if app_workspace_id and app_workspace_id != "default":
                    # Set workspace_id if not already set or different
                    if not self.workspace_id or self.workspace_id != app_workspace_id:
                        self.workspace_id = app_workspace_id
                        
        except Exception as e:
            frappe.log_error(f"Error inheriting tenant from application: {str(e)}")
    
    def after_insert(self):
        """Auto-trigger DocType creation after table creation"""
        try:
            # For new tables created from dashboard, auto-generate DocType immediately
            if self.application and self.table_name and self.doctype_name and not frappe.db.exists("DocType", self.doctype_name):
                # Generate DocType immediately for dashboard-created tables
                result = self.force_generate_doctype()
                if result and result.get("success"):
                    frappe.publish_realtime(
                        "doctype_created",
                        {
                            "table_name": self.name,
                            "doctype_name": result.get("doctype_name"),
                            "message": f" Table and DocType created successfully!"
                        }
                    )
        except Exception as e:
            frappe.log_error(f"Error in after_insert hook for {self.name}: {str(e)}", "Flansa Table Auto-Creation")
    
    def validate_naming_convention(self):
        """Ensure table name follows Frappe conventions"""
        if self.table_name:
            import re
            if not re.match(r'^[a-z][a-z0-9_]*$', self.table_name):
                frappe.throw(_(
                    "Table Name must start with a lowercase letter and contain only "
                    "lowercase letters, numbers, and underscores. "
                    "Current value: '{0}'"
                ).format(self.table_name))
    
    # Removed redundant DocType naming methods - only get_generated_doctype_name() is needed
    
    def get_generated_doctype_name(self):
        """Get the generated DocType name using ID-based naming for guaranteed uniqueness"""
        if not self.application or not self.table_name:
            return ""
        
        try:
            # IMPORTANT: Get workspace_id from the Application for consistent multi-tenant naming
            # This ensures all tables in the same application use the same workspace_id
            workspace_id = get_workspace_id_from_application(self.application)
            
            # Use application and table IDs directly (they're already hashes from autoname)
            application_id = self.application  # This is the hash ID
            table_id = self.name              # This is the hash ID
            
            # Generate ID-based DocType name
            doctype_name = generate_id_based_doctype_name(workspace_id, application_id, table_id)
            
            return doctype_name
            
        except Exception as e:
            frappe.log_error("Error generating ID-based DocType name: {0}".format(str(e)))
            # Fallback to simple combination
            return f"T_{self.application[:6]}_{self.name[:6]}"
    
    @frappe.whitelist()
    def regenerate_doctype(self):
        """Force Generate/Regenerate DocType (works even without fields)"""
        try:
            # First, clear any invalid DocType reference
            if self.doctype_name and not frappe.db.exists("DocType", self.doctype_name):
                frappe.log_error(f"Cleared invalid DocType reference {self.doctype_name} for table {self.name}", "Force Regenerate")
                frappe.db.set_value("Flansa Table", self.name, "doctype_name", "")
                self.doctype_name = ""
                frappe.db.commit()
            
            # Delete existing DocType if it exists and is valid
            if self.doctype_name and frappe.db.exists("DocType", self.doctype_name):
                frappe.delete_doc("DocType", self.doctype_name, force=True)
                frappe.msgprint(f"Deleted existing DocType: {self.doctype_name}")
                frappe.db.commit()
            
            # Clear the doctype_name to force regeneration
            self.doctype_name = ""
            
            # Generate new DocType name using proper method
            if self.application and self.table_name:
                self.doctype_name = self.get_generated_doctype_name()
            else:
                return {"success": False, "message": "Application and Table Name are required for DocType generation"}
            
            # Force generate DocType even without fields
            result = self.force_generate_doctype()
            
            if result and result.get("success"):
                # Update status to Active only after successful generation
                self.status = "Active"
                self.save()
                return {"success": True, "message": f"Successfully generated DocType: {result.get('doctype_name')}"}
            else:
                return {"success": False, "message": result.get("message", "DocType generation failed")}
                
        except Exception as e:
            frappe.log_error(f"Error regenerating DocType for table {self.name}: {str(e)}")
            return {"success": False, "message": str(e)}
    
    def force_generate_doctype(self):
        """Generate DocType even without fields (creates minimal DocType)"""
        try:
            if not self.application or not self.table_name:
                return {"success": False, "message": "Application and Table Name are required"}
            
            if not self.doctype_name:
                self.doctype_name = self.get_generated_doctype_name()
            
            doctype_name = self.doctype_name
            
            # Check if DocType already exists
            if frappe.db.exists("DocType", doctype_name):
                return {"success": False, "message": f"DocType {doctype_name} already exists"}
            
            # Get existing fields from native DocType (if DocType exists)
            fields = []
            if self.doctype_name and frappe.db.exists("DocType", self.doctype_name):
                from flansa.native_fields import get_table_fields_native
                result = get_table_fields_native(self.name)
                if result.get("success"):
                    # Convert native fields to expected format
                    for field in result.get("fields", []):
                        if field.get("created_by_flansa"):
                            fields.append(frappe._dict({
                                "field_name": field["fieldname"],
                                "field_label": field["label"], 
                                "field_type": field["fieldtype"],
                                "is_required": field.get("reqd", 0),
                                "options": field.get("options", ""),
                                "default_value": field.get("default", "")
                            }))
            
            # Create DocType structure
            doctype_doc = {
                "doctype": "DocType",
                "name": doctype_name,
                "module": "Flansa Generated",
                "custom": 1,
                "naming_rule": "Autoincrement",
                "autoname": self.get_unique_naming_series(),
                "description": f"Generated from Flansa Table: {self.table_label or self.table_name}",
                "sort_field": "creation",
                "sort_order": "DESC",
                "track_changes": 1,
                "fields": []
            }
            
            # Add standard Flansa metadata fields
            self.add_flansa_metadata_fields(doctype_doc)
            
            # Add user-defined fields (if any exist)
            if fields:
                self.add_user_fields(doctype_doc, fields)
                doctype_doc["title_field"] = self.get_title_field(fields)
                doctype_doc["search_fields"] = self.get_search_fields(fields)
            # Note: No default fields are added for empty tables - keep it clean and simple
            
            # Add permissions
            self.add_permissions(doctype_doc)
            
            # Create the DocType
            dt = frappe.get_doc(doctype_doc)
            dt.insert(ignore_permissions=True)
            
            # Update table record
            self.doctype_name = doctype_name
            
            message = f"Successfully generated DocType: {doctype_name}"
            if not fields:
                message += " (ready for you to add custom fields as needed)"
            
            frappe.msgprint(message, indicator="green")
            return {"success": True, "doctype_name": doctype_name, "message": message}
            
        except Exception as e:
            frappe.log_error(f"Error force generating DocType: {str(e)}")
            return {"success": False, "message": f"Error creating DocType: {str(e)}"}

    def add_flansa_metadata_fields(self, doctype_doc):
        """Add minimal essential metadata fields following low-code best practices"""
        # Only add essential fields - use Frappe's default 'name' field as ID
        metadata_fields = [
            # Optional status field - only if really needed
            # Most low-code tools don't have status by default
        ]
        
        # Don't add excessive metadata - keep it clean and simple
        # Frappe provides: name, owner, creation, modified, modified_by automatically
        doctype_doc["fields"].extend(metadata_fields)

    def add_user_fields(self, doctype_doc, fields):
        """Add user-defined fields from Flansa Field records"""
        for field in fields:
            field_def = {
                "fieldname": getattr(field, 'field_name', 'unnamed_field'),
                "fieldtype": getattr(field, 'field_type', 'Data'),
                "label": getattr(field, 'field_label', 'Unnamed Field'),
                "reqd": getattr(field, 'is_required', 0) or 0
            }
            
            # Add field-specific properties
            if hasattr(field, 'default_value') and field.default_value:
                field_def["default"] = field.default_value
                
            if hasattr(field, 'options') and field.options:
                field_def["options"] = field.options
            
            doctype_doc["fields"].append(field_def)

    def get_title_field(self, fields):
        """Determine the best field to use as title"""
        title_candidates = ['name', 'title', 'label', 'subject', 'description']
        
        for field in fields:
            if hasattr(field, 'field_name') and field.field_name.lower() in title_candidates:
                if hasattr(field, 'field_type') and field.field_type in ['Data', 'Text']:
                    return field.field_name
        
        # Default to first Data field
        for field in fields:
            if hasattr(field, 'field_type') and field.field_type == 'Data':
                return field.field_name
        
        return None

    def get_search_fields(self, fields):
        """Get fields that should be searchable"""
        search_fields = []
        
        for field in fields:
            if (hasattr(field, 'field_type') and field.field_type in ['Data', 'Text', 'Select']):
                search_fields.append(field.field_name)
        
        return ','.join(search_fields[:5])  # Limit to 5 fields

    def add_permissions(self, doctype_doc):
        """Add permissions for generated DocType"""
        permissions = [
            {
                "role": "System Manager",
                "read": 1, "write": 1, "create": 1, "delete": 1,
                "export": 1, "report": 1, "share": 1, "email": 1, "print": 1
            },
            {
                "role": "All",
                "read": 1, "write": 1, "create": 1,
                "export": 1, "report": 1, "share": 1, "email": 1, "print": 1
            }
        ]
        
        doctype_doc["permissions"] = permissions

    def get_unique_naming_series(self):
        """Generate clean, simple naming series following low-code best practices"""
        try:
            # Use simple, clean naming like modern low-code tools (Airtable, Notion, etc.)
            # Format: REC-00001 (clean sequential IDs)
            
            # First try the simple format
            naming_series = "REC-.#####"
            
            # Check if this series is already in use
            existing = frappe.db.sql("""
                SELECT name FROM `tabDocType` 
                WHERE autoname = %s
            """, (naming_series,))
            
            if not existing:
                return naming_series
            
            # If REC is taken, use table name prefix (max 3 chars, clean)
            if self.table_name:
                table_prefix = self.table_name.upper()[:3].replace("-", "").replace("_", "")
                naming_series = f"{table_prefix}-.#####"
                
                existing = frappe.db.sql("""
                    SELECT name FROM `tabDocType` 
                    WHERE autoname = %s
                """, (naming_series,))
                
                if not existing:
                    return naming_series
            
            # Ultimate fallback - generate unique ID-based series
            import uuid
            unique_suffix = str(uuid.uuid4())[:4].upper()
            return f"ID{unique_suffix}-.#####"
            
        except Exception as e:
            # Clean fallback
            return "REC-.#####"

    @frappe.whitelist()
    def get_table_data_view(self):
        """Get data viewing options for generated table"""
        try:
            if not self.doctype_name or not frappe.db.exists("DocType", self.doctype_name):
                return {"error": "No generated DocType found. Please generate DocType first."}
            
            # Get record count
            record_count = frappe.db.count(self.doctype_name)
            
            # Get sample records
            sample_records = []
            if record_count > 0:
                try:
                    sample_records = frappe.get_all(self.doctype_name, 
                        fields=["name", "creation", "modified"],
                        limit=5,
                        order_by="creation desc"
                    )
                except Exception:
                    # Handle cases where DocType structure might be different
                    sample_records = frappe.get_all(self.doctype_name, 
                        fields=["name"],
                        limit=5,
                        order_by="creation desc"
                    )
            
            # Generate proper URLs
            doctype_slug = self.doctype_name.lower().replace(' ', '-').replace('_', '-')
            
            return {
                "doctype_name": self.doctype_name,
                "record_count": record_count,
                "sample_records": sample_records,
                "list_view_url": f"/app/{doctype_slug}",
                "form_url": f"/app/{doctype_slug}/new",
                "has_data": record_count > 0,
                "table_label": self.table_label
            }
            
        except Exception as e:
            frappe.log_error(f"Data view error: {str(e)}")
            return {"error": f"Data view failed: {str(e)}"}

    def on_trash(self):
        """Clean up when table is deleted - Remove associated DocType and data"""
        if self.doctype_name and frappe.db.exists("DocType", self.doctype_name):
            try:
                # Get record count before deletion
                record_count = 0
                try:
                    record_count = frappe.db.count(self.doctype_name)
                except:
                    pass
                
                # Delete all records first
                if record_count > 0:
                    try:
                        frappe.db.sql(f"DELETE FROM `tab{self.doctype_name}`")
                        frappe.msgprint(f"Deleted {record_count} records from {self.doctype_name}")
                    except:
                        pass
                
                # Try normal DocType deletion first
                try:
                    frappe.delete_doc("DocType", self.doctype_name, force=True)
                    frappe.msgprint(f"✅ Successfully deleted DocType: {self.doctype_name}", indicator="green")
                    
                except Exception as normal_delete_error:
                    # If normal deletion fails (e.g., unhashable type error), use force cleanup
                    frappe.log_error(f"Normal deletion failed for {self.doctype_name}: {str(normal_delete_error)}", "DocType Normal Delete")
                    
                    try:
                        self._force_cleanup_corrupted_doctype()
                        frappe.msgprint(f"✅ Force cleaned corrupted DocType: {self.doctype_name}", indicator="green")
                    except Exception as force_error:
                        frappe.log_error(f"Force cleanup failed for {self.doctype_name}: {str(force_error)}", "DocType Force Cleanup")
                        frappe.msgprint(f"⚠️ Warning: Could not delete DocType '{self.doctype_name}'. Error: {str(force_error)}", indicator="orange")
                
            except Exception as e:
                frappe.log_error(f"Error in on_trash for {self.doctype_name}: {str(e)}", "DocType Cleanup")
                frappe.msgprint(f"⚠️ Warning: Could not delete DocType '{self.doctype_name}'. Error: {str(e)}", indicator="orange")

    def _force_cleanup_corrupted_doctype(self):
        """Force cleanup corrupted DocType using direct SQL deletion"""
        doctype_name = self.doctype_name
        
        try:
            # Clear cache first
            frappe.clear_cache(doctype=doctype_name)
            
            # Drop the actual table first
            table_name = f"tab{doctype_name}"
            try:
                frappe.db.sql(f"DROP TABLE IF EXISTS `{table_name}`")
            except Exception:
                pass
            
            # Delete DocType record and related records directly via SQL
            frappe.db.sql("DELETE FROM `tabDocType` WHERE name = %s", (doctype_name,))
            frappe.db.sql("DELETE FROM `tabDocField` WHERE parent = %s", (doctype_name,))
            frappe.db.sql("DELETE FROM `tabDocPerm` WHERE parent = %s", (doctype_name,))
            
            # Clean up any remaining references
            frappe.db.sql("""
                DELETE FROM `tabDocField` 
                WHERE options = %s AND fieldtype = 'Link'
            """, (doctype_name,))
            
            frappe.db.commit()
            
        except Exception as e:
            frappe.log_error(f"Force cleanup failed: {str(e)}", "Force DocType Cleanup")
            raise e

    @frappe.whitelist()
    def delete_with_doctype(self):
        """Safe method to delete table with user confirmation for DocType deletion"""
        try:
            if not self.doctype_name or not frappe.db.exists("DocType", self.doctype_name):
                # No DocType to worry about, proceed with normal deletion
                return {"success": True, "message": "Table deleted (no associated DocType)"}
            
            # Get record count
            record_count = 0
            try:
                record_count = frappe.db.count(self.doctype_name)
            except:
                pass
            
            message = f"This will delete:\n"
            message += f"• Flansa Table: {self.table_name}\n"
            message += f"• DocType: {self.doctype_name}\n"
            if record_count > 0:
                message += f"• {record_count} data records\n"
            message += f"\nThis action cannot be undone. Continue?"
            
            return {
                "success": True, 
                "confirmation_required": True,
                "message": message,
                "record_count": record_count
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}


@frappe.whitelist()
def generate_doctype_now(table_name):
    """Generate DocType immediately for a table"""
    try:
        table = frappe.get_doc("Flansa Table", table_name)
        
        # Check if already generated
        if table.doctype_name and frappe.db.exists("DocType", table.doctype_name):
            return {"success": True, "message": "DocType already exists", "doctype_name": table.doctype_name}
        
        # Generate it using regenerate method
        result = table.regenerate_doctype()
        
        if result and result.get("success"):
            return {"success": True, "message": "DocType generated successfully", "doctype_name": table.doctype_name}
        else:
            return {"success": False, "error": result.get("message", "Generation failed")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}