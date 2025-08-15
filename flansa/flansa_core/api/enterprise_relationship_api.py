# Enterprise Relationship API - Integration with Architecture
import frappe
from frappe import _
from frappe.utils import now
import json
from typing import Dict, List, Optional
import sys
import os

def get_relationship_field_name(relationship):
    """Get the link field name in child table that points to parent table"""
    # Try to find the actual link field name from the child table
    child_table = relationship.child_table or relationship.to_table
    parent_table = relationship.parent_table or relationship.from_table
    
    if child_table and parent_table:
        child_doctype = frappe.db.get_value("Flansa Table", child_table, "doctype_name")
        parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
        
        if child_doctype and parent_doctype:
            # Look for link field in child table that points to parent DocType
            link_fields = frappe.get_all("DocField", 
                filters={
                    "parent": child_doctype,
                    "fieldtype": "Link",
                    "options": parent_doctype
                },
                fields=["fieldname"],
                limit=1
            )
            
            if link_fields:
                return link_fields[0].fieldname
    
    # Fallback to naming convention
    from flansa.flansa_core.api.relationship_management import get_table_name_for_field, pluralize_to_singular
    parent_table_name = get_table_name_for_field(parent_table)
    singular_name = pluralize_to_singular(parent_table_name)
    return f"{singular_name}_link"

# Add the enterprise architecture to the path
sys.path.append('/home/ubuntu/frappe-bench/claude-code')

try:
    from enterprise_relationship_architecture import (
        EnterpriseRelationshipBuilder,
        RelationshipType,
        RelationshipBehavior
    )
except ImportError:
    # Fallback if architecture not available
    frappe.log_error("Enterprise architecture not available", "Import Error")
    EnterpriseRelationshipBuilder = None


@frappe.whitelist()
def get_relationship_templates():
    """Get pre-defined relationship templates with descriptions"""
    
    templates = [
        {
            "name": "Customer-Orders",
            "description": "Master-Detail: Customer owns multiple orders. Deleting customer deletes all orders.",
            "type": "Master-Detail",
            "icon": "fa fa-shopping-cart",
            "example": "E-commerce: Customers have multiple orders"
        },
        {
            "name": "Product-Categories", 
            "description": "Many to Many: Products can belong to multiple categories through junction table.",
            "type": "Many to Many",
            "icon": "fa fa-tags",
            "example": "Inventory: Products in multiple categories"
        },
        {
            "name": "Employee-Manager",
            "description": "Parent-Child: Hierarchical reporting structure with self-reference.",
            "type": "Parent-Child", 
            "icon": "fa fa-sitemap",
            "example": "Organization: Employee reports to manager"
        },
        {
            "name": "Invoice-Items",
            "description": "Summary: Invoice with automatic totals calculated from line items.",
            "type": "Summary",
            "icon": "fa fa-calculator", 
            "example": "Billing: Invoice totals from line items"
        },
        {
            "name": "Order-Customer",
            "description": "Lookup: Order references customer without ownership or cascade.",
            "type": "Lookup",
            "icon": "fa fa-link",
            "example": "Reference: Order points to customer record"
        },
        {
            "name": "User-Profile",
            "description": "One to One: Each user has exactly one profile record.",
            "type": "One to One", 
            "icon": "fa fa-user",
            "example": "Authentication: User with profile details"
        }
    ]
    
    return {"templates": templates}


@frappe.whitelist() 
def create_enterprise_relationship(relationship_config):
    """Create simplified relationship (One to Many or Many to Many only)"""
    
    if isinstance(relationship_config, str):
        relationship_config = json.loads(relationship_config)
    
    try:
        # Get relationship type directly (simplified approach)
        relationship_type = relationship_config.get("relationship_type")
        
        # Validate relationship type
        if relationship_type not in ["One to Many", "Many to Many", "Self Referential"]:
            return {
                "success": False,
                "error": f"Invalid relationship type: {relationship_type}. Must be 'One to Many', 'Many to Many', or 'Self Referential'"
            }
        
        # Map field names for simplified approach
        if "parent_table" in relationship_config:
            relationship_config["from_table"] = relationship_config["parent_table"]
        if "child_table" in relationship_config:
            relationship_config["to_table"] = relationship_config["child_table"]
        
        # Create the simplified relationship directly
        return create_simplified_relationship(relationship_config)
            
    except Exception as e:
        frappe.log_error(f"Enterprise relationship creation failed: {str(e)}", "Relationship Error")
        return {
            "success": False,
            "error": f"Failed to create enterprise relationship: {str(e)}"
        }


def create_simplified_relationship(config: Dict) -> Dict:
    """Create a simplified relationship (One to Many, Many to Many, or Self Referential)"""
    
    try:

        # Validate unique relationship name before creation
        relationship_name = config.get("relationship_name")
        if relationship_name:
            # Import validation function from relationship_management
            from flansa.flansa_core.api.relationship_management import validate_unique_relationship_name
            
            name_validation = validate_unique_relationship_name(relationship_name)
            if not name_validation.get("valid"):
                frappe.logger().warning(f"Enterprise API: Duplicate relationship name attempted: {relationship_name}")
                frappe.msgprint(name_validation.get("error"), alert=True, indicator="red")
                return {
                    "success": False,
                    "error": name_validation.get("error"),
                    "duplicate_name": True,
                    "existing_relationship": name_validation.get("existing_relationship")
                }
        
        # Create the relationship document
        relationship_doc = frappe.new_doc("Flansa Relationship")
        
        # Basic information
        relationship_name = config.get("relationship_name") or config.get("display_name") or config.get("auto_name_display", "")
        
        # Ensure relationship_name is not empty
        if not relationship_name:
            return {
                "success": False,
                "error": "Relationship name is required"
            }
        
        relationship_doc.relationship_name = relationship_name
        relationship_doc.relationship_type = config.get("relationship_type")
        relationship_doc.parent_table = config.get("parent_table")
        relationship_doc.child_table = config.get("child_table")
        
        # Set legacy field names for backward compatibility
        relationship_doc.from_table = config.get("from_table") or config.get("parent_table")
        relationship_doc.to_table = config.get("to_table") or config.get("child_table")
        
        # Relationship options
        relationship_doc.cascade_delete = config.get("cascade_delete", 0)
        relationship_doc.required_reference = config.get("required_reference", 0)
        relationship_doc.create_parent_link = config.get("create_parent_link", 1)
        
        # Junction table for Many to Many
        if config.get("relationship_type") == "Many to Many":
            relationship_doc.junction_table = config.get("junction_table", "")
            relationship_doc.parent_junction_field = config.get("parent_junction_field", "")
            relationship_doc.child_junction_field = config.get("child_junction_field", "")
            
            # Set legacy junction field names
            relationship_doc.from_junction_field = relationship_doc.parent_junction_field
            relationship_doc.to_junction_field = relationship_doc.child_junction_field
        elif config.get("relationship_type") == "Self Referential":
            # Self Referential - both tables are the same
            relationship_doc.from_table = config.get("parent_table")
            relationship_doc.to_table = config.get("parent_table")
            relationship_doc.child_table = config.get("parent_table")
            # Parent field will be created automatically by create_self_referential method
            relationship_doc.from_field = config.get("from_field", "")
        else:
            # One to Many - set child reference field
            relationship_doc.child_reference_field = config.get("child_reference_field", "")
            # Set legacy field names
            relationship_doc.to_field = relationship_doc.child_reference_field
        
        # Additional details
        relationship_doc.description = config.get("description", "")
        relationship_doc.auto_create_fields = config.get("auto_create_fields", 1)
        
        # Skip automatic field creation during insert by setting a flag
        relationship_doc._skip_auto_field_creation = True
        
        # Insert the relationship
        relationship_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        # Create the actual link fields in the DocTypes if auto_create_fields is enabled
        if config.get("auto_create_fields", 1):
            try:
                # Handle Self Referential relationships separately
                if config.get("relationship_type") == "Self Referential":
                    # The create_self_referential method in the DocType will handle field creation
                    relationship_doc.reload()
                    if hasattr(relationship_doc, 'create_self_referential'):
                        relationship_doc.create_self_referential()
                        frappe.db.commit()
                else:
                    # Determine enterprise type based on relationship type
                    enterprise_type = "Master-Detail" if config.get("relationship_type") == "One to Many" else "Many-to-Many"
                    
                    # Generate field names if not provided - ensure proper field naming
                    if config.get("relationship_type") == "One to Many":
                        from_table = config.get("from_table") or config.get("parent_table")
                        if from_table:
                            # Get the actual table name, not the ID
                            from flansa.flansa_core.api.relationship_management import get_table_name_for_field, pluralize_to_singular
                            
                            # Get the proper table name (not ID)
                            parent_table_name = get_table_name_for_field(from_table)
                            parent_singular = pluralize_to_singular(parent_table_name)
                            
                            # Generate relationship-specific field name for multiple relationships
                            to_table = config.get("to_table") or config.get("child_table")
                            if to_table:
                                to_doctype = frappe.db.get_value("Flansa Table", to_table, "doctype_name")
                                if to_doctype:
                                    # Import the new naming function
                                    from flansa.flansa_core.api.relationship_management import generate_relationship_specific_field_name
                                    
                                    # Generate context-aware field name
                                    relationship_name = config.get("relationship_name", "")
                                    base_field_name = generate_relationship_specific_field_name(
                                        relationship_name, parent_table_name, parent_singular
                                    )
                                    
                                    # Get unique field name with counter if needed
                                    proper_field_name = get_unique_field_name(to_doctype, base_field_name)
                                    
                                    frappe.logger().info(f"Generated relationship-specific field name: {proper_field_name} for relationship: {relationship_name}")
                                else:
                                    proper_field_name = f"{parent_singular}_link"
                            else:
                                proper_field_name = f"{parent_singular}_link"
                            
                            # Only set if not already set correctly
                            current_field = config.get("child_reference_field") or config.get("to_field")
                            if not current_field or current_field.startswith(("FT-", "REL-")):
                                config["child_reference_field"] = proper_field_name
                                config["to_field"] = proper_field_name
                                frappe.log_error(f"Set field name to '{proper_field_name}' for relationship from {parent_table_name}", "Field Name Generation")
                    
                    # Create the relationship fields
                    create_relationship_fields(config, enterprise_type)
                    
                    # Update the relationship record with actual field names created
                    relationship_doc.reload()
                    if config.get("child_reference_field"):
                        relationship_doc.child_reference_field = config["child_reference_field"]
                        relationship_doc.to_field = config["child_reference_field"]
                    relationship_doc.save(ignore_permissions=True)
                    frappe.db.commit()
                
            except Exception as field_error:
                frappe.log_error(f"Error creating relationship fields: {str(field_error)}", "Relationship Field Creation")
                # Continue anyway - relationship is created, fields can be added later
        
        # Create reverse relationship if requested
        if config.get("create_reverse") and config.get("relationship_type") == "One to Many":
            try:
                # Check if reverse relationship already exists
                parent_table = config.get("child_table")
                child_table = config.get("parent_table")
                
                existing_reverse = frappe.get_all("Flansa Relationship",
                    filters={
                        "parent_table": parent_table,
                        "child_table": child_table,
                        "relationship_type": "One to Many"
                    },
                    limit=1
                )
                
                if existing_reverse:
                    print(f"⚠️ Reverse relationship already exists between {parent_table} and {child_table}, skipping", flush=True)
                else:
                    # Swap parent and child for reverse relationship
                    reverse_config = {
                        "relationship_name": f"{config.get('child_table')} → {config.get('parent_table')}",
                        "relationship_type": "One to Many",
                        "parent_table": parent_table,
                        "child_table": child_table,
                        "from_table": config.get("to_table") or config.get("child_table"),
                        "to_table": config.get("from_table") or config.get("parent_table"),
                        "description": f"Reverse relationship of {relationship_doc.relationship_name}",
                        "cascade_delete": 0,  # Don't cascade delete in reverse
                        "required_reference": 0,
                        "create_parent_link": 1,
                        "auto_create_fields": 1,
                        "create_reverse": 0  # Don't create reverse of reverse
                    }
                    
                    # Create the reverse relationship
                    reverse_result = create_simplified_relationship(reverse_config)
                    if reverse_result.get("success"):
                        frappe.msgprint(f"Also created reverse relationship: {reverse_config['relationship_name']}")
            except Exception as e:
                frappe.log_error(f"Failed to create reverse relationship: {str(e)}", "Reverse Relationship Error")
                # Continue anyway - main relationship was created successfully
        
        return {
            "success": True,
            "message": f"Created {config.get('relationship_type')} relationship: {relationship_doc.relationship_name}",
            "relationship_name": relationship_doc.name,
            "relationship": {
                "name": relationship_doc.name,
                "type": relationship_doc.relationship_type,
                "parent_table": relationship_doc.parent_table,
                "child_table": relationship_doc.child_table
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating simplified relationship: {str(e)}", "Simplified Relationship Creation")
        return {
            "success": False,
            "error": f"Failed to create relationship: {str(e)}"
        }


def create_flansa_relationship_record(config: Dict, enterprise_result: Dict):
    """Create Flansa relationship record with enterprise metadata"""
    
    # Create the relationship document
    relationship_doc = frappe.new_doc("Flansa Relationship")
    
    # Basic information
    relationship_doc.relationship_name = config.get("display_name", "")
    relationship_doc.relationship_type = config.get("type", "Lookup")
    relationship_doc.from_table = config.get("from_table")
    relationship_doc.to_table = config.get("to_table")
    relationship_doc.from_field = config.get("from_field")
    relationship_doc.to_field = config.get("to_field")
    
    # Enterprise metadata - use original enterprise type, not the mapped standard type
    relationship_doc.enterprise_type = config.get("original_enterprise_type", config.get("type", ""))
    relationship_doc.cascade_delete = config.get("cascade_delete", 0)
    relationship_doc.inherit_permissions = config.get("inherit_permissions", 0)
    relationship_doc.required_field = config.get("required_field", 0)
    relationship_doc.summary_field = config.get("summary_field", "")
    relationship_doc.junction_table = config.get("junction_table", "")
    
    # Additional details
    relationship_doc.description = config.get("description", "")
    relationship_doc.auto_create_fields = config.get("auto_create_fields", 1)
    
    # Enterprise behavior configuration
    if "behaviors" in enterprise_result.get("relationship", {}):
        relationship_doc.behaviors = enterprise_result["relationship"]["behaviors"]
    
    # Trigger code for advanced relationships
    if "trigger_code" in enterprise_result.get("relationship", {}):
        relationship_doc.trigger_code = enterprise_result["relationship"]["trigger_code"]
    
    relationship_doc.insert(ignore_permissions=True)
    frappe.db.commit()
    
    return relationship_doc


def get_doctype_name_for_table(table_name: str) -> str:
    """Get the actual DocType name for a Flansa table"""
    
    try:
        # Get the Flansa table record
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Check if DocType was generated (use doctype_name field)
        if table_doc.doctype_name:
            # Use the generated DocType name
            return table_doc.doctype_name
        else:
            # DocType not generated yet - try to get from naming pattern
            # Usually follows pattern: AppPrefix_TableName
            app_doc = frappe.get_doc("Flansa Application", table_doc.application)
            app_prefix = app_doc.app_name or app_doc.app_title
            
            # Generate expected DocType name
            expected_doctype = f"{app_prefix}_{table_doc.table_name}"
            
            # Check if this DocType exists
            if frappe.db.exists("DocType", expected_doctype):
                return expected_doctype
            
            # Fallback to table name
            return table_doc.table_name
            
    except Exception as e:
        frappe.log_error(f"Error getting DocType for table {table_name}: {str(e)}", "DocType Lookup Error")
        return table_name


def update_field_suggestions(config: Dict):
    """Update auto-generated field names based on enterprise pattern"""
    
    from_table = config.get("from_table")
    to_table = config.get("to_table") 
    enterprise_type = config.get("type")
    
    # Auto-create fields if requested
    if config.get("auto_create_fields"):
        create_relationship_fields(config, enterprise_type)


def create_relationship_fields(config: Dict, enterprise_type: str):
    """Create the actual fields in tables based on relationship type"""
    
    from flansa.flansa_core.api.field_management import seamless_add_field
    
    from_table = config.get("from_table")
    to_table = config.get("to_table")
    from_field = config.get("from_field")
    to_field = config.get("to_field")
    required = config.get("required_field", 0)
    
    try:
        # Get the actual DocType names for the tables
        from_doctype = get_doctype_name_for_table(from_table)
        to_doctype = get_doctype_name_for_table(to_table)
        
        if not from_doctype or not to_doctype:
            frappe.log_error(f"DocType not found for tables: {from_table} -> {from_doctype}, {to_table} -> {to_doctype}", "DocType Error")
            return
        
        # Create fields based on enterprise type (with duplicate prevention)
        if enterprise_type == "Master-Detail":
            # Enhanced duplicate prevention for Master-Detail relationships
            
            # Check if link field already exists before creating
            if not _field_exists_in_doctype(from_doctype, from_field):
                # Master table gets child table field
                seamless_add_field(from_table, {
                    "field_name": from_field,
                    "field_label": f"{to_table.replace('_', ' ').title()} Details",
                    "field_type": "Table",
                    "options": to_doctype,  # Use actual DocType name
                    "description": f"Detail records owned by this {from_table}"
                })
            else:
                frappe.logger().info(f"Skipping master field creation - {from_field} already exists in {from_doctype}")
            
            # More thorough check for link field in child table
            child_link_exists = False
            
            # Check exact field name
            if _field_exists_in_doctype(to_doctype, to_field):
                child_link_exists = True
                frappe.logger().info(f"Link field {to_field} already exists in {to_doctype}")
            else:
                # Check if ANY link field pointing to parent already exists
                existing_parent_links = frappe.get_all("Custom Field",
                    filters={
                        "dt": to_doctype,
                        "fieldtype": "Link", 
                        "options": from_doctype
                    },
                    fields=["fieldname"]
                )
                
                if existing_parent_links:
                    child_link_exists = True
                    existing_field_names = [f.fieldname for f in existing_parent_links]
                    frappe.logger().info(f"Link to {from_doctype} already exists in {to_doctype}: {existing_field_names}")
            
            if not child_link_exists:
                # Detail table gets required master reference
                seamless_add_field(to_table, {
                    "field_name": to_field,
                    "field_label": f"{from_table.replace('_', ' ').title()}",
                    "field_type": "Link",
                    "options": from_doctype,  # Use actual DocType name
                    "reqd": 1,
                    "in_standard_filter": 1,
                    "search_index": 1,
                    "description": f"Parent record in {from_table}"
                })
            else:
                frappe.logger().info(f"Skipping child link field creation - link to {from_doctype} already exists in {to_doctype}")
            
        elif enterprise_type == "Lookup":
            # Simple lookup field
            seamless_add_field(from_table, {
                "field_name": from_field,
                "field_label": f"{to_table.replace('_', ' ').title()}",
                "field_type": "Link", 
                "options": to_doctype,  # Use actual DocType name
                "reqd": required,
                "search_index": 1,
                "description": f"Reference to {to_table}"
            })
            
            # Optional fetch field for performance
            seamless_add_field(from_table, {
                "field_name": f"{to_field}_name",
                "field_label": f"{to_table.replace('_', ' ').title()} Name",
                "field_type": "Data",
                "fetch_from": f"{from_field}.name",
                "read_only": 1,
                "description": "Cached value for performance"
            })
            
        elif enterprise_type == "Summary":
            # Parent gets summary fields
            summary_field_name = config.get("summary_field", "amount")
            
            summary_fields = [
                {
                    "field_name": f"total_{to_table}_count",
                    "field_label": f"Total {to_table.replace('_', ' ').title()} Count",
                    "field_type": "Int",
                    "read_only": 1,
                    "description": f"Count of related {to_table} records"
                },
                {
                    "field_name": f"total_{summary_field_name}_sum",
                    "field_label": f"Total {summary_field_name.replace('_', ' ').title()}",
                    "field_type": "Currency",
                    "read_only": 1, 
                    "description": f"Sum of {summary_field_name} from {to_table}"
                }
            ]
            
            for field_config in summary_fields:
                seamless_add_field(from_table, field_config)
            
            # Child gets parent reference
            seamless_add_field(to_table, {
                "field_name": to_field,
                "field_label": f"{from_table.replace('_', ' ').title()}",
                "field_type": "Link",
                "options": from_doctype,  # Use actual DocType name
                "reqd": required,
                "search_index": 1,
                "description": f"Parent record for summary calculation"
            })
            
        elif enterprise_type == "Many-to-Many":
            # Create junction table
            junction_table = config.get("junction_table", f"{from_table}_{to_table}_junction")
            create_junction_table(junction_table, from_table, to_table)
            
        elif enterprise_type == "Parent-Child":
            # Self-referential hierarchy
            if from_table == to_table:
                seamless_add_field(from_table, {
                    "field_name": "parent_" + from_table.replace('_', ''),
                    "field_label": f"Parent {from_table.replace('_', ' ').title()}",
                    "field_type": "Link",
                    "options": from_doctype,  # Use actual DocType name
                    "search_index": 1,
                    "description": "Parent record in hierarchy"
                })
        
        # Sync newly created fields to JSON for both tables
        try:
            from flansa.flansa_core.api.field_management import sync_doctype_to_json
            
            for table_name in [from_table, to_table]:
                if table_name:
                    try:
                        # Get the doctype name from the table
                        doctype_name = get_doctype_name_for_table(table_name)
                        if doctype_name and frappe.db.exists("DocType", doctype_name):
                            sync_doctype_to_json(table_name=table_name, doctype_name=doctype_name)
                            frappe.db.commit()
                    except Exception as e:
                        frappe.log_error(f"Error syncing {table_name} fields to JSON: {str(e)}", "Field JSON Sync")
        except Exception as sync_error:
            frappe.log_error(f"Error importing sync function: {str(sync_error)}", "Field JSON Sync Import")
                
    except Exception as e:
        frappe.log_error(f"Field creation failed: {str(e)}", "Field Creation Error")


def create_junction_table(junction_name: str, table1: str, table2: str):
    """Create junction table for Many-to-Many relationships"""
    
    try:
        # Check if junction table already exists
        if frappe.db.exists("Flansa Table", junction_name):
            return
        
        # Create junction table
        junction_table = frappe.new_doc("Flansa Table")
        junction_table.name = junction_name
        junction_table.table_name = junction_name
        junction_table.table_label = f"{table1.replace('_', ' ').title()} - {table2.replace('_', ' ').title()} Junction"
        junction_table.description = f"Junction table for many-to-many relationship between {table1} and {table2}"
        junction_table.insert(ignore_permissions=True)
        
        # Add junction fields
        from flansa.flansa_core.api.field_management import seamless_add_field
        
        # First relationship field
        seamless_add_field(junction_name, {
            "field_name": f"{table1}_id",
            "field_label": f"{table1.replace('_', ' ').title()}",
            "field_type": "Link",
            "options": table1,
            "reqd": 1,
            "in_list_view": 1,
            "search_index": 1
        })
        
        # Second relationship field  
        seamless_add_field(junction_name, {
            "field_name": f"{table2}_id",
            "field_label": f"{table2.replace('_', ' ').title()}", 
            "field_type": "Link",
            "options": table2,
            "reqd": 1,
            "in_list_view": 1,
            "search_index": 1
        })
        
        # Additional junction metadata
        additional_fields = [
            {
                "field_name": "relationship_type",
                "field_label": "Relationship Type",
                "field_type": "Select", 
                "options": "Primary\nSecondary\nTertiary",
                "default": "Primary"
            },
            {
                "field_name": "effective_date",
                "field_label": "Effective Date",
                "field_type": "Date",
                "default": "Today"
            },
            {
                "field_name": "is_active",
                "field_label": "Is Active",
                "field_type": "Check",
                "default": 1
            }
        ]
        
        for field_config in additional_fields:
            seamless_add_field(junction_name, field_config)
        
        frappe.db.commit()
        
    except Exception as e:
        frappe.log_error(f"Junction table creation failed: {str(e)}", "Junction Table Error")


def create_basic_relationship(config: Dict):
    """Fallback basic relationship creation"""
    
    try:
        # Use existing improved API as fallback
        from flansa.flansa_core.api.improved_relationship_api import create_relationship_with_fields
        
        # Map enterprise type to standard type if needed
        relationship_type = config.get("relationship_type") or config.get("type", "One to Many")
        
        # Ensure we use standard types
        if relationship_type == "Master-Detail":
            relationship_type = "One to Many"
        elif relationship_type == "Lookup":
            relationship_type = "One to Many"
        elif relationship_type == "Parent-Child":
            relationship_type = "One to Many"
        elif relationship_type == "Summary":
            relationship_type = "One to Many"
        
        # Convert enterprise config to basic format
        basic_config = {
            "from_table": config.get("from_table"),
            "to_table": config.get("to_table"),
            "from_field": config.get("from_field"),
            "to_field": config.get("to_field"),
            "relationship_type": relationship_type,
            "display_name": config.get("display_name"),
            "description": config.get("description", ""),
            "auto_create_fields": config.get("auto_create_fields", 1)
        }
        
        # Get application name from first table
        app_name = frappe.db.get_value("Flansa Table", config.get("from_table"), "application")
        
        return create_relationship_with_fields(app_name, basic_config)
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Basic relationship creation failed: {str(e)}"
        }


@frappe.whitelist()
def get_enterprise_relationship_info(relationship_name):
    """Get detailed information about an enterprise relationship"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        info = {
            "name": relationship.name,
            "relationship_name": relationship.relationship_name,
            "enterprise_type": relationship.get("enterprise_type", relationship.relationship_type),
            "from_table": relationship.from_table,
            "to_table": relationship.to_table,
            "from_field": relationship.from_field,
            "to_field": relationship.to_field,
            "cascade_delete": relationship.get("cascade_delete", 0),
            "inherit_permissions": relationship.get("inherit_permissions", 0),
            "required_field": relationship.get("required_field", 0),
            "summary_field": relationship.get("summary_field", ""),
            "junction_table": relationship.get("junction_table", ""),
            "description": relationship.description or "",
            "behaviors": relationship.get("behaviors", "[]"),
            "trigger_code": relationship.get("trigger_code", "")
        }
        
        return {"success": True, "info": info}
        
    except Exception as e:
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_relationship_source_fields(relationship_name):
    """Get available source fields for lookup field creation"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get parent table (the table we want to fetch fields from for lookup)
        parent_table = relationship.parent_table or relationship.from_table
        parent_table_doc = frappe.get_doc("Flansa Table", parent_table)
        parent_doctype = parent_table_doc.doctype_name
        
        if not parent_doctype or not frappe.db.exists("DocType", parent_doctype):
            return {
                "success": False,
                "error": "Parent table DocType not found"
            }
        
        # Get all fields from the parent DocType that can be used for lookup
        source_fields = frappe.get_all("DocField", 
            filters={
                "parent": parent_doctype,
                "fieldtype": ["not in", ["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Table"]]
            },
            fields=["fieldname", "label", "fieldtype", "options"],
            order_by="idx"
        )
        
        # Add default description to each field since DocField table doesn't have description column
        for field in source_fields:
            field["description"] = f"{field.get('label', field['fieldname'])} ({field['fieldtype']})"
        
        # Add standard fields that might not be in DocField table
        standard_fields = [
            {"fieldname": "name", "label": "ID", "fieldtype": "Data", "options": "", "description": "Record ID"},
            {"fieldname": "creation", "label": "Created On", "fieldtype": "Datetime", "options": "", "description": "Creation date"},
            {"fieldname": "modified", "label": "Last Modified", "fieldtype": "Datetime", "options": "", "description": "Last modification date"},
            {"fieldname": "owner", "label": "Created By", "fieldtype": "Data", "options": "", "description": "User who created the record"}
        ]
        
        # Add standard fields if they don't already exist (avoid duplicates)
        existing_fieldnames = [f["fieldname"] for f in source_fields]
        for std_field in standard_fields:
            if std_field["fieldname"] not in existing_fieldnames:
                source_fields.insert(0, std_field)
        
        # Remove any potential duplicates (defensive programming)
        unique_source_fields = []
        seen_fieldnames = set()
        for field in source_fields:
            if field["fieldname"] not in seen_fieldnames:
                unique_source_fields.append(field)
                seen_fieldnames.add(field["fieldname"])
        
        source_fields = unique_source_fields
        
        # Get child table info
        child_table = relationship.child_table or relationship.to_table
        child_table_doc = frappe.get_doc("Flansa Table", child_table)
        
        return {
            "success": True,
            "source_fields": source_fields,
            "child_table_name": child_table_doc.table_name,
            "child_table_label": child_table_doc.table_label,
            "parent_table_name": parent_table_doc.table_name,
            "parent_table_label": parent_table_doc.table_label
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting source fields: {str(e)}", "Source Fields API")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def add_lookup_field(relationship_name, field_config):
    """Add a lookup field to a relationship"""
    
    if isinstance(field_config, str):
        field_config = json.loads(field_config)
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Determine which table to add the field to (child table for lookup fields)
        child_table = relationship.child_table or relationship.to_table
        child_doctype = frappe.db.get_value("Flansa Table", child_table, "doctype_name")
        
        if not child_doctype or not frappe.db.exists("DocType", child_doctype):
            return {"success": False, "error": "Child table DocType not found"}
        
        # Create the lookup field using native field management API
        from flansa.native_fields import add_lookup_field_native
        
        # Get the relationship field name that links child to parent
        relationship_field = relationship.child_reference_field or relationship.to_field
        if not relationship_field:
            # Auto-determine the relationship field name - check what link field exists
            # Try to find an existing link field in the child table that points to the parent
            parent_doctype = frappe.db.get_value("Flansa Table", relationship.parent_table or relationship.from_table, "doctype_name")
            if parent_doctype:
                # Look for link fields in child table that point to parent DocType
                link_fields = frappe.get_all("DocField", 
                    filters={
                        "parent": child_doctype,
                        "fieldtype": "Link",
                        "options": parent_doctype
                    },
                    fields=["fieldname"],
                    limit=1
                )
                if link_fields:
                    relationship_field = link_fields[0].fieldname
                else:
                    # No link field found - this is an error, lookup needs a link field to reference
                    frappe.log_error(f"No link field found in {child_doctype} referencing {parent_doctype}", "Lookup Field Error")
                    return {"success": False, "error": f"No link field found in {child_doctype} referencing {parent_doctype}. Please create the relationship first."}
        
        lookup_config = {
            "field_name": field_config["target_field"],
            "field_label": field_config["field_label"],
            "source_field": relationship_field,  # The relationship field in child table (e.g., classe_link)
            "lookup_field": field_config["source_field"],  # The field in parent table to fetch (e.g., title)
            "relationship": relationship_name  # Add relationship ID for tracking
        }
        
        # Debug logging
        frappe.log_error(f"Creating lookup field with config: {lookup_config}", "Lookup Field Debug")
        
        result = add_lookup_field_native(child_table, lookup_config)
        
        # Debug logging for result
        frappe.log_error(f"Lookup field creation result: {result}", "Lookup Field Debug")
        
        if result.get("success"):
            return {
                "success": True,
                "message": f"Lookup field '{field_config['field_label']}' created successfully",
                "field_name": field_config["target_field"],
                "fetch_from": f"{relationship_field}.{field_config['source_field']}"
            }
        else:
            return {
                "success": False,
                "error": result.get("error", "Failed to create lookup field")
            }
            
    except Exception as e:
        frappe.log_error(f"Error adding lookup field: {str(e)}", "Lookup Field Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def add_computed_field(relationship_name, field_config):
    """Add a computed field to a relationship"""
    
    if isinstance(field_config, str):
        field_config = json.loads(field_config)
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Simplified approach: Create computed field directly in DocType (no child table)
        parent_table = relationship.parent_table or relationship.from_table
        if not parent_table:
            return {"success": False, "error": "Parent table not found in relationship"}
        
        parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
        if not parent_doctype or not frappe.db.exists("DocType", parent_doctype):
            return {"success": False, "error": "Parent DocType not found"}
        
        # Get DocType document
        doctype_doc = frappe.get_doc("DocType", parent_doctype)
        
        # Determine field type based on computation
        field_type = "Int"  # Default
        if field_config["computation_type"] in ["Sum", "Average"]:
            field_type = "Float"
        elif field_config["computation_type"] == "Combine Text":
            field_type = "Long Text"
        
        # Create Flansa metadata for tracking
        flansa_metadata = {
            "flansa_config": {
                "field_type": "computed",
                "computation_type": field_config["computation_type"],
                "target_field": field_config.get("target_field", ""),
                "relationship": relationship_name,
                "created_at": now()
            },
            "display_text": f"Auto-calculated: {field_config['computation_type']}" + (f" of {field_config['target_field']}" if field_config.get('target_field') else "")
        }
        
        # Generate virtual field options using existing logic from main relationship file
        relationship_doc = frappe.get_doc("Flansa Relationship", relationship_name)
        options = relationship_doc._generate_virtual_field_options(
            field_config["computation_type"], 
            field_config.get("target_field")
        )
        
        # Create field definition
        field_def = {
            "fieldname": field_config["field_name"],
            "label": field_config["field_label"],
            "fieldtype": field_type,
            "read_only": 1,
            "is_virtual": 1,  # Virtual field - no database column
            "in_standard_filter": 1,
            "description": json.dumps(flansa_metadata),
            "options": options
        }
        
        # Add field to DocType
        doctype_doc.append("fields", field_def)
        doctype_doc.save()
        
        # Clear caches
        frappe.clear_cache(doctype=parent_doctype)
        frappe.clear_cache()
        
        return {
            "success": True,
            "message": f"Computed field '{field_config['field_label']}' created successfully",
            "field_name": field_config["field_name"],
            "parent_table": parent_table,
            "method": "simplified_doctype_only"
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding computed field: {str(e)}", "Computed Field Error")
        return {
            "success": False,
            "error": str(e)
        }

def get_computed_fields_from_doctype(relationship_name, from_table):
    """
    Get computed fields for a relationship by reading from DocType field descriptions
    This is the simplified approach - single source of truth
    """
    try:
        if not from_table:
            return []
        
        # Get DocType name for the from_table
        from_doctype = frappe.db.get_value("Flansa Table", from_table, "doctype_name")
        if not from_doctype or not frappe.db.exists("DocType", from_doctype):
            return []
        
        # Get all fields from DocType
        meta = frappe.get_meta(from_doctype)
        computed_fields = []
        
        for field in meta.get("fields"):
            # Check if field has Flansa metadata and belongs to this relationship
            if field.description:
                try:
                    metadata = json.loads(field.description)
                    if ("flansa_config" in metadata and 
                        metadata["flansa_config"].get("field_type") == "computed" and
                        metadata["flansa_config"].get("relationship") == relationship_name):
                        
                        # Extract computed field info
                        computed_fields.append({
                            "field_name": field.fieldname,
                            "field_label": field.label,
                            "computation_type": metadata["flansa_config"].get("computation_type"),
                            "target_field": metadata["flansa_config"].get("target_field")
                        })
                except (json.JSONDecodeError, TypeError):
                    pass
        
        return computed_fields
        
    except Exception as e:
        frappe.log_error(f"Error getting computed fields from DocType: {str(e)}", "Computed Fields")
        return []

@frappe.whitelist()
def get_relationships_with_fields(app_name=None):
    """Get relationships with their lookup and computed fields, optionally filtered by app"""
    
    try:
        # Get relationships - filter by app if provided
        if app_name:
            # Get tables for this app
            app_tables = frappe.get_all("Flansa Table",
                filters={"application": app_name},
                fields=["name"]
            )
            app_table_names = [t.name for t in app_tables]
            
            if not app_table_names:
                return {"success": True, "relationships": []}
            
            # Filter relationships to only include those involving app tables
            relationships = frappe.get_all("Flansa Relationship", 
                filters=[
                    ["from_table", "in", app_table_names],
                    ["to_table", "in", app_table_names]
                ],
                fields=["name", "relationship_name", "relationship_type", "parent_table", "child_table", "from_table", "to_table", "status"],
                order_by="creation desc"
            )
        else:
            # Get all relationships if no app filter
            relationships = frappe.get_all("Flansa Relationship", 
                fields=["name", "relationship_name", "relationship_type", "parent_table", "child_table", "from_table", "to_table", "status"],
                order_by="creation desc"
            )
        
        # Use the single source of truth API for each relationship
        enhanced_relationships = []
        for rel in relationships:
            # Get detailed field information using the authoritative API
            detail_result = get_relationship_fields_detail(rel.name)
            if detail_result.get("success"):
                rel_detail = detail_result["relationship"]
                # Merge the basic relationship info with detailed field info
                rel["computed_fields"] = rel_detail.get("computed_fields", [])
                rel["lookup_fields"] = rel_detail.get("lookup_fields", [])
                rel["link_fields"] = rel_detail.get("link_fields", [])
            else:
                # Fallback if detailed API fails
                rel["computed_fields"] = []
                rel["lookup_fields"] = []
                rel["link_fields"] = []
            
            enhanced_relationships.append(rel)
        
        return {
            "success": True,
            "relationships": enhanced_relationships
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationships with fields: {str(e)}", "Relationship Fields API")
        return {
            "success": False,
            "error": str(e),
            "relationships": []
        }

@frappe.whitelist()
def get_relationship_fields_detail(relationship_name):
    """Get detailed field information for a specific relationship"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get computed fields - use DocType-based approach (simplified)
        computed_fields = []
        parent_table = relationship.parent_table or relationship.from_table
        if parent_table:
            # Use the existing get_computed_fields_from_doctype function
            computed_fields = get_computed_fields_from_doctype(relationship_name, parent_table)
            
            # Also check old approach for backwards compatibility
            if hasattr(relationship, "computed_fields") and not computed_fields:
                parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
                
                for cf in relationship.computed_fields:
                    # Verify the computed field actually exists in the parent DocType
                    field_exists = False
                    if parent_doctype and frappe.db.exists("DocType", parent_doctype):
                        field_exists = frappe.db.exists("DocField", {
                            "parent": parent_doctype,
                            "fieldname": cf.field_name
                        })
                    
                    # Only include computed fields that actually exist in the DocType
                    if field_exists:
                        computed_fields.append({
                            "name": cf.name,
                            "field_name": cf.field_name,
                            "field_label": cf.field_label,
                            "computation_type": cf.computation_type,
                            "target_field": cf.target_field or "",
                            "formula": cf.get("formula", "")
                        })
        
        # Get lookup fields from child table (lookup fields are in child, fetching from parent)
        lookup_fields = []
        child_table = relationship.child_table or relationship.to_table
        if child_table:
            child_doctype = frappe.db.get_value("Flansa Table", child_table, "doctype_name")
            if child_doctype and frappe.db.exists("DocType", child_doctype):
                # Look for fields in child table that have fetch_from and are related to THIS relationship
                all_lookup_fields = frappe.get_all("DocField", 
                    filters={
                        "parent": child_doctype,
                        "fetch_from": ["!=", ""]
                    },
                    fields=["fieldname", "label", "fieldtype", "fetch_from"]
                )
                
                # Filter to show only lookup fields related to THIS specific relationship
                actual_lookup_fields = []
                parent_table = relationship.parent_table or relationship.from_table
                parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name") if parent_table else None
                
                for field in all_lookup_fields:
                    # Check if this field is related to the current relationship
                    include_field = False
                    
                    # Get field details
                    field_details = frappe.db.get_value("DocField", {
                        "parent": child_doctype,
                        "fieldname": field.fieldname
                    }, ["description", "is_virtual"], as_dict=True)
                    
                    is_virtual = field_details.get('is_virtual') if field_details else False
                    
                    # Method 1: Check if this is a Flansa-created lookup field for THIS relationship
                    if field_details and field_details.description:
                        try:
                            desc_data = frappe.parse_json(field_details.description)
                            flansa_config = desc_data.get("flansa_config", {})
                            if (flansa_config.get("field_type") == "lookup" and 
                                flansa_config.get("relationship") == relationship_name):
                                include_field = True
                        except:
                            pass
                    
                    # Method 2: For self-referential relationships, check if fetch_from points to self
                    if not include_field and relationship.relationship_type == "Self Referential":
                        fetch_from = field.get('fetch_from', '')
                        if fetch_from and parent_doctype:
                            # For self-referential, the link field name should be in the fetch_from
                            # Example: "parent_products.title" for self-referential Products
                            link_field_name = fetch_from.split('.')[0] if '.' in fetch_from else ''
                            if link_field_name:
                                # Check if this link field exists and points to parent_doctype (self)
                                link_field_exists = frappe.db.exists("DocField", {
                                    "parent": child_doctype,
                                    "fieldname": link_field_name,
                                    "fieldtype": "Link",
                                    "options": parent_doctype
                                })
                                if link_field_exists:
                                    include_field = True
                    
                    # Method 3: For other relationship types, check if fetch_from uses the parent link field
                    if not include_field and relationship.relationship_type != "Self Referential":
                        # Look for the link field that connects child to parent for this relationship
                        parent_link_fields = frappe.get_all("DocField", 
                            filters={
                                "parent": child_doctype,
                                "fieldtype": "Link",
                                "options": parent_doctype
                            },
                            fields=["fieldname"]
                        )
                        
                        fetch_from = field.get('fetch_from', '')
                        for link_field in parent_link_fields:
                            if fetch_from.startswith(f"{link_field.fieldname}."):
                                # Check if this link field was created for THIS relationship
                                link_field_details = frappe.db.get_value("DocField", {
                                    "parent": child_doctype,
                                    "fieldname": link_field.fieldname
                                }, "description")
                                
                                if link_field_details:
                                    try:
                                        link_desc_data = frappe.parse_json(link_field_details)
                                        link_config = link_desc_data.get("flansa_config", {})
                                        if link_config.get("relationship") == relationship_name:
                                            include_field = True
                                            break
                                    except:
                                        pass
                                
                                # Fallback: Use parent table + child table + field name to determine ownership
                                if not include_field:
                                    # This is much simpler: if this lookup field uses a link field that:
                                    # 1. Is in the child table (we already filtered for this)
                                    # 2. Points to the parent DocType (we already filtered for this)
                                    # 3. And this is the specific parent-child combination for THIS relationship
                                    # Then this lookup field belongs to THIS relationship
                                    
                                    # Since we're already in the loop for parent_link_fields that point to parent_doctype,
                                    # and the field uses this link field in fetch_from, this must be the right relationship
                                    # The combination of child_table + parent_table + link_field uniquely identifies the relationship
                                    include_field = True
                                    break
                    
                    # Method 4: Final fallback for self-referential - check for "parent_" prefix pattern
                    if not include_field and relationship.relationship_type == "Self Referential":
                        fetch_from = field.get('fetch_from', '')
                        link_field_name = fetch_from.split('.')[0] if '.' in fetch_from else ''
                        # For self-referential, check if link field has "parent_" prefix pattern
                        if link_field_name and link_field_name.startswith("parent_"):
                            # Check if this link field points to the same doctype (self)
                            link_field_options = frappe.db.get_value("DocField", {
                                "parent": child_doctype,
                                "fieldname": link_field_name,
                                "fieldtype": "Link"
                            }, "options")
                            if link_field_options == child_doctype:  # Points to self
                                include_field = True
                    
                    if include_field:
                        field["description"] = f"Lookup from {field.get('fetch_from', 'unknown')}"
                        field["is_virtual"] = is_virtual
                        actual_lookup_fields.append(field)
                
                lookup_fields = actual_lookup_fields
        
        # Get Link fields that connect the tables
        link_fields = []
        child_table = relationship.child_table or relationship.to_table
        parent_table = relationship.parent_table or relationship.from_table
        
        if child_table and parent_table:
            child_doctype = frappe.db.get_value("Flansa Table", child_table, "doctype_name")
            parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
            
            if child_doctype and parent_doctype:
                # Find Link fields in child table that point to parent table
                link_field_data = frappe.get_all("DocField", 
                    filters={
                        "parent": child_doctype,
                        "fieldtype": "Link",
                        "options": parent_doctype
                    },
                    fields=["fieldname", "label", "fieldtype", "options", "reqd", "in_list_view"]
                )
                
                for field in link_field_data:
                    link_fields.append({
                        "fieldname": field.fieldname,
                        "label": field.label or field.fieldname,
                        "fieldtype": field.fieldtype,
                        "options": field.options,
                        "description": f"Links {child_doctype} to {parent_doctype}",
                        "required": field.reqd,
                        "in_list_view": field.in_list_view,
                        "is_link_field": True
                    })
        
        return {
            "success": True,
            "relationship": {
                "name": relationship.name,
                "relationship_name": relationship.relationship_name,
                "relationship_type": relationship.relationship_type,
                "status": relationship.status,
                "description": relationship.description or "",
                "parent_table": relationship.parent_table or relationship.from_table,
                "child_table": relationship.child_table or relationship.to_table,
                "from_table": relationship.from_table,
                "to_table": relationship.to_table,
                "computed_fields": computed_fields,
                "lookup_fields": lookup_fields,
                "link_fields": link_fields
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship field details: {str(e)}", "Relationship Detail API")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def remove_computed_field(relationship_name, field_name):
    """Remove a computed field from a relationship"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Remove from parent DocType first (the computed field)
        from_table = relationship.from_table
        from_doctype = frappe.db.get_value("Flansa Table", from_table, "doctype_name")
        
        if from_doctype and frappe.db.exists("DocType", from_doctype):
            doctype_doc = frappe.get_doc("DocType", from_doctype)
            
            # Find and remove the computed field from DocType
            field_removed = False
            for i, field in enumerate(doctype_doc.fields):
                if field.fieldname == field_name:
                    # Check if this is a Flansa computed field by looking at description
                    if field.description:
                        try:
                            metadata = json.loads(field.description)
                            if metadata.get("flansa_config", {}).get("relationship") == relationship_name:
                                doctype_doc.fields.pop(i)
                                field_removed = True
                                break
                        except:
                            pass
                    
            if field_removed:
                doctype_doc.save()
                frappe.clear_cache(doctype=from_doctype)
                frappe.logger().info(f"Removed computed field {field_name} from DocType {from_doctype}")
        
        # Simplified approach: No child table to update, field already removed from DocType above
        if not field_removed:
            return {
                "success": False,
                "error": f"Computed field {field_name} not found or not created by relationship {relationship_name}"
            }
        
        return {
            "success": True,
            "message": f"Successfully removed computed field {field_name}"
        }
        
    except Exception as e:
        frappe.log_error(f"Error removing computed field: {str(e)}", "Remove Computed Field")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def remove_lookup_field(relationship_name, field_name):
    """Remove a lookup field from a relationship"""
    
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Remove from parent DocType
        parent_table = relationship.parent_table or relationship.from_table
        if parent_table:
            parent_doctype = frappe.db.get_value("Flansa Table", parent_table, "doctype_name")
            if parent_doctype and frappe.db.exists("DocType", parent_doctype):
                # Remove the field from DocType
                if frappe.db.exists("DocField", {"parent": parent_doctype, "fieldname": field_name}):
                    frappe.db.delete("DocField", {"parent": parent_doctype, "fieldname": field_name})
                    
                    # Update the DocType
                    doctype = frappe.get_doc("DocType", parent_doctype)
                    doctype.save()
        
        return {
            "success": True,
            "message": "Lookup field removed successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error removing lookup field: {str(e)}", "Remove Lookup Field")
        return {
            "success": False,
            "error": str(e)
        }

def _field_exists_in_doctype(doctype_name, field_name):
    """Check if a field already exists in a DocType to prevent duplicates"""
    try:
        if not frappe.db.exists("DocType", doctype_name):
            return False
        
        meta = frappe.get_meta(doctype_name)
        for field in meta.fields:
            if field.fieldname == field_name:
                return True
        return False
    except Exception:
        return False



def get_unique_field_name(doctype_name, base_field_name):
    """Get a unique field name by adding counter suffix if needed"""
    try:
        # Check if base field name exists
        if not _field_exists_in_doctype(doctype_name, base_field_name):
            return base_field_name
        
        # Field exists, add counter
        counter = 2
        while counter < 100:  # Safety limit
            field_name_with_counter = f"{base_field_name}{counter}"
            if not _field_exists_in_doctype(doctype_name, field_name_with_counter):
                return field_name_with_counter
            counter += 1
        
        # Fallback with timestamp if too many duplicates
        import time
        return f"{base_field_name}_{int(time.time())}"
        
    except Exception as e:
        frappe.log_error(f"Error getting unique field name: {str(e)}", "Field Name Generation")
        return base_field_name



def create_relationship_document_only(config):
    """Create only the relationship document without creating fields"""
    try:
        # Create the relationship document
        relationship = frappe.new_doc("Flansa Relationship")
        
        # Set basic fields
        relationship.relationship_name = config.get("relationship_name")
        relationship.relationship_type = config.get("relationship_type")
        relationship.from_table = config.get("from_table")
        relationship.to_table = config.get("to_table")
        relationship.from_field = config.get("from_field")
        relationship.to_field = config.get("to_field")
        relationship.status = "Active"
        
        # Set enterprise fields if present
        if config.get("parent_table"):
            relationship.parent_table = config.get("parent_table")
        if config.get("child_table"):
            relationship.child_table = config.get("child_table")
        if config.get("child_reference_field"):
            relationship.child_reference_field = config.get("child_reference_field")
        
        # Save the relationship
        relationship.insert(ignore_permissions=True)
        
        return {
            "success": True,
            "relationship": relationship.name,
            "message": f"Relationship '{relationship.relationship_name}' document created successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship document: {str(e)}", "Create Relationship Document")
        return {"success": False, "error": str(e)}

print("Enterprise Relationship API loaded!")
print("Features:")
print("  ✅ Template-based relationship creation")
print("  ✅ Master-Detail with cascade delete")  
print("  ✅ Summary/Rollup relationships")
print("  ✅ Many-to-Many junction tables")
print("  ✅ Enterprise field auto-generation")
print("  ✅ Behavior configuration")
print("  ✅ Dynamic lookup and computed fields")
print("  ✅ Field management and visualization")
print("  ✅ Duplicate field prevention")