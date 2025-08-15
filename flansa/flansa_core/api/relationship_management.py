"""
Relationship Management API for Flansa Platform
"""

import frappe
from frappe import _
import re

def get_table_name_for_field(table_id):
    """Get the actual table name from table ID for field naming"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_id)
        # Prefer table_name, then table_label, avoid using table ID
        if table_doc.table_name and not table_doc.table_name.startswith('FT-'):
            return table_doc.table_name.lower()
        elif table_doc.table_label and not table_doc.table_label.startswith('FT-'):
            # Convert table label to snake_case for field naming
            import re
            clean_name = re.sub(r'[^a-zA-Z0-9]', '_', table_doc.table_label.lower())
            clean_name = re.sub(r'_+', '_', clean_name).strip('_')
            return clean_name
        else:
            # Last resort: use a generic name based on doctype
            if table_doc.doctype_name:
                return table_doc.doctype_name.lower().replace('fls', '').replace('flansa', '')
            return 'table'
    except Exception as e:
        frappe.log_error(f"Error getting table name for field: {str(e)}", "Table Name Resolution")
        return 'table'  # Fallback to generic name

def pluralize_to_singular(word):
    """Convert plural word to singular form for field names"""
    if not word:
        return word
    
    word = word.lower().strip()
    
    # Handle common plural patterns
    if word.endswith('ies') and len(word) > 3:
        # categories -> category, companies -> company
        return word[:-3] + 'y'
    elif word.endswith('es') and len(word) > 3:
        if word.endswith('nses'):
            # expenses -> expense, responses -> response  
            return word[:-1]  # Just remove 's', not 'es'
        elif word.endswith('ses') or word.endswith('uses') or word.endswith('ases') or word.endswith('xes') or word.endswith('ches') or word.endswith('shes'):
            # classes -> class, senses -> sense, houses -> house, boxes -> box, churches -> church, dishes -> dish
            return word[:-2]
        elif word.endswith('oes'):
            # heroes -> hero, potatoes -> potato
            return word[:-2]
        else:
            # places -> place, houses -> house
            return word[:-1]
    elif word.endswith('s') and len(word) > 1:
        # users -> user, items -> item
        return word[:-1]
    else:
        # already singular or unknown pattern
        return word

@frappe.whitelist()

def validate_unique_relationship_name(relationship_name):
    """Validate that relationship name is unique"""
    try:
        if not relationship_name:
            return {"valid": False, "error": "Relationship name is required"}
        
        # Check if relationship with same name already exists
        existing_relationship = frappe.db.exists("Flansa Relationship", {"relationship_name": relationship_name})
        
        if existing_relationship:
            # Get details of existing relationship for better error message
            existing_rel_doc = frappe.get_doc("Flansa Relationship", existing_relationship)
            
            # Get table names for context
            from_table_name = ""
            to_table_name = ""
            try:
                from_table_doc = frappe.get_doc("Flansa Table", existing_rel_doc.from_table)
                to_table_doc = frappe.get_doc("Flansa Table", existing_rel_doc.to_table)
                from_table_name = from_table_doc.table_label or from_table_doc.table_name
                to_table_name = to_table_doc.table_label or to_table_doc.table_name
            except:
                pass
            
            context_info = f" (between {from_table_name} and {to_table_name})" if from_table_name and to_table_name else ""
            
            frappe.logger().warning(f"Attempted to create duplicate relationship name: {relationship_name}")
            return {
                "valid": False, 
                "error": f"A relationship with the name '{relationship_name}' already exists{context_info}. Please choose a different name.",
                "existing_relationship": existing_relationship,
                "existing_rel_details": {
                    "name": existing_rel_doc.name,
                    "relationship_name": existing_rel_doc.relationship_name,
                    "relationship_type": existing_rel_doc.relationship_type,
                    "from_table": existing_rel_doc.from_table,
                    "to_table": existing_rel_doc.to_table,
                    "from_table_name": from_table_name,
                    "to_table_name": to_table_name
                },
                "suggested_names": generate_suggested_names(relationship_name)
            }
        
        return {"valid": True}
        
    except Exception as e:
        frappe.log_error(f"Error validating relationship name: {str(e)}", "Relationship Validation")
        return {"valid": False, "error": f"Validation error: {str(e)}"}

def generate_suggested_names(original_name):
    """Generate suggested alternative names for duplicate relationships"""
    try:
        suggestions = []
        base_name = original_name.strip()
        
        # Try with numbers
        for i in range(2, 6):  # Generate 2-5 alternatives
            suggested_name = f"{base_name} {i}"
            if not frappe.db.exists("Flansa Relationship", {"relationship_name": suggested_name}):
                suggestions.append(suggested_name)
        
        # Try with descriptive suffixes
        suffixes = ["New", "Alt", "Secondary", "Additional", "Extended"]
        for suffix in suffixes:
            suggested_name = f"{base_name} ({suffix})"
            if not frappe.db.exists("Flansa Relationship", {"relationship_name": suggested_name}):
                suggestions.append(suggested_name)
                if len(suggestions) >= 5:  # Limit to 5 suggestions
                    break
        
        return suggestions[:3]  # Return top 3 suggestions
        
    except Exception as e:
        frappe.log_error(f"Error generating suggested names: {str(e)}", "Name Suggestions")
        return []

def create_relationship(relationship_data):
    """Create a new relationship between two Flansa tables"""
    try:
        # Validate input
        if not relationship_data:
            return {"success": False, "error": "No relationship data provided"}
        
        # Validate unique relationship name
        relationship_name = relationship_data.get("relationship_name")
        name_validation = validate_unique_relationship_name(relationship_name)
        
        if not name_validation.get("valid"):
            frappe.msgprint(name_validation.get("error"), alert=True, indicator="red")
            return {
                "success": False, 
                "error": name_validation.get("error"),
                "duplicate_name": True,
                "existing_relationship": name_validation.get("existing_relationship"),
                "existing_rel_details": name_validation.get("existing_rel_details"),
                "suggested_names": name_validation.get("suggested_names")
            }
        
        # Create the relationship document
        relationship = frappe.new_doc("Flansa Relationship")
        
        # Set basic fields
        relationship.relationship_name = relationship_data.get("relationship_name")
        relationship.relationship_type = relationship_data.get("relationship_type")
        relationship.from_table = relationship_data.get("from_table")
        relationship.to_table = relationship_data.get("to_table")
        relationship.from_field = relationship_data.get("from_field")
        relationship.to_field = relationship_data.get("to_field")
        relationship.status = "Active"
        
        # Save the relationship
        relationship.insert(ignore_permissions=True)
        
        # Create the actual link fields in the tables based on relationship type
        if relationship.relationship_type == "One to Many":
            # In One-to-Many: from_table is "One" (parent), to_table is "Many" (child)
            # Create link field in the child table (to_table) pointing to parent (from_table)
            # Use proper singular form of parent table name
            parent_table_name = get_table_name_for_field(relationship.from_table)
            parent_singular = pluralize_to_singular(parent_table_name)
            
            # Generate relationship-specific field name
            if not relationship.to_field:
                specific_field_name = generate_relationship_specific_field_name(
                    relationship.relationship_name, 
                    parent_table_name, 
                    parent_singular
                )
                # Get unique field name (add counter if needed)
                to_doctype = frappe.db.get_value("Flansa Table", relationship.to_table, "doctype_name")
                if to_doctype:
                    unique_field_name = get_unique_field_name(to_doctype, specific_field_name)
                else:
                    unique_field_name = specific_field_name
            else:
                unique_field_name = relationship.to_field
            
            create_link_field(
                table_name=relationship.to_table,  # Link field goes in child table
                field_name=unique_field_name,
                link_to_table=relationship.from_table,  # Points to parent table
                label=relationship.relationship_name
            )
        elif relationship.relationship_type == "One to One":
            # Create link fields in both tables using proper singular forms
            target_table_name = get_table_name_for_field(relationship.to_table)
            target_singular = pluralize_to_singular(target_table_name)
            
            source_table_name = get_table_name_for_field(relationship.from_table)
            source_singular = pluralize_to_singular(source_table_name)
            
            create_link_field(
                table_name=relationship.from_table,
                field_name=relationship.from_field or f"{target_singular}_link",
                link_to_table=relationship.to_table,
                label=f"{relationship.relationship_name} (From)"
            )
            create_link_field(
                table_name=relationship.to_table,
                field_name=relationship.to_field or f"{source_singular}_link",
                link_to_table=relationship.from_table,
                label=f"{relationship.relationship_name} (To)"
            )
        elif relationship.relationship_type == "Many to Many":
            # For Many-to-Many, we'll need a junction table (future enhancement)
            frappe.msgprint("Many-to-Many relationships will be implemented soon", alert=True)
        
        frappe.db.commit()
        
        return {
            "success": True,
            "relationship": relationship.name,
            "message": f"Relationship '{relationship.relationship_name}' created successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating relationship: {str(e)}", "Create Relationship")
        return {"success": False, "error": str(e)}

def create_link_field(table_name, field_name, link_to_table, label):
    """Create a link field in a Flansa table using native field management"""
    try:
        # Import native field management API
        from flansa.native_fields import add_basic_field_native
        
        # Get the source and target tables
        source_table = frappe.get_doc("Flansa Table", table_name)
        target_table = frappe.get_doc("Flansa Table", link_to_table)
        
        if not source_table.doctype_name or not target_table.doctype_name:
            frappe.throw(f"DocTypes not generated for tables: {table_name} -> {source_table.doctype_name}, {link_to_table} -> {target_table.doctype_name}")
        
        # Get a unique field name by adding counter if needed
        unique_field_name = get_unique_field_name(source_table.doctype_name, field_name)
        
        # Check if we had to modify the field name
        if unique_field_name != field_name:
            frappe.logger().info(f"Field {field_name} already exists, using {unique_field_name} instead")
            frappe.msgprint(f"Link field '{field_name}' already exists, creating '{unique_field_name}' instead", alert=True)
            field_name = unique_field_name
        
        # Check if field already exists to prevent duplicates (shouldn't happen with unique name)
        if _field_already_exists(source_table.doctype_name, field_name):
            frappe.logger().info(f"Field {field_name} already exists in {source_table.doctype_name}, skipping creation")
            frappe.msgprint(f"Link field '{field_name}' already exists in table '{source_table.table_name}'", alert=True)
            return True
        
        # Create the link field using native API
        # Generate a meaningful label from target table
        meaningful_label = get_meaningful_table_label(target_table)
        field_config = {
            "field_name": field_name,
            "field_label": meaningful_label,
            "field_type": "Link",
            "options": target_table.doctype_name,
            "required": 0,
            "hidden": 0,
            "read_only": 0
        }
        
        # Add the field using native field management
        result = add_basic_field_native(table_name, field_config)
        
        if not result.get("success"):
            frappe.throw(f"Failed to create link field: {result.get('error', 'Unknown error')}")
        
        return True
        
    except Exception as e:
        frappe.log_error(f"Error creating link field: {str(e)}", "Create Link Field")
        raise

@frappe.whitelist()
def get_relationship_details(relationship_name):
    """Get detailed information about a relationship"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # Get table details
        from_table = frappe.get_doc("Flansa Table", relationship.from_table)
        to_table = frappe.get_doc("Flansa Table", relationship.to_table)
        
        return {
            "success": True,
            "relationship": {
                "name": relationship.name,
                "relationship_name": relationship.relationship_name,
                "relationship_type": relationship.relationship_type,
                "from_table": {
                    "name": from_table.name,
                    "label": from_table.table_label or from_table.table_name,
                    "doctype_name": from_table.doctype_name
                },
                "to_table": {
                    "name": to_table.name,
                    "label": to_table.table_label or to_table.table_name,
                    "doctype_name": to_table.doctype_name
                },
                "from_field": relationship.from_field,
                "to_field": relationship.to_field,
                "status": relationship.status
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting relationship details: {str(e)}", "Get Relationship Details")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def delete_relationship(relationship_name):
    """Delete a relationship and optionally remove the created fields"""
    try:
        relationship = frappe.get_doc("Flansa Relationship", relationship_name)
        
        # TODO: Add option to remove the created link fields
        
        # Delete the relationship document
        relationship.delete()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Relationship '{relationship.relationship_name}' deleted successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting relationship: {str(e)}", "Delete Relationship")
        return {"success": False, "error": str(e)}


def get_unique_field_name(doctype_name, base_field_name):
    """
    Get a unique field name by adding counter suffix if needed.
    
    Examples:
    - classes_link (if doesn't exist)
    - classes_link2 (if classes_link exists)
    - classes_link3 (if classes_link and classes_link2 exist)
    """
    try:
        # Check if base field name exists
        if not _field_already_exists(doctype_name, base_field_name):
            return base_field_name
        
        # Field exists, add counter starting from 2
        counter = 2
        while counter < 100:  # Safety limit to prevent infinite loop
            field_name_with_counter = f"{base_field_name}{counter}"
            if not _field_already_exists(doctype_name, field_name_with_counter):
                frappe.logger().info(f"Generated unique field name: {field_name_with_counter}")
                return field_name_with_counter
            counter += 1
        
        # Fallback with timestamp if too many duplicates (very unlikely)
        import time
        timestamp_field = f"{base_field_name}_{int(time.time())}"
        frappe.logger().warning(f"Too many duplicate fields, using timestamp: {timestamp_field}")
        return timestamp_field
        
    except Exception as e:
        frappe.log_error(f"Error getting unique field name: {str(e)}", "Field Name Generation")
        return base_field_name



def generate_relationship_specific_field_name(relationship_name, parent_table_name, parent_singular):
    """Generate a unique field name based on relationship context"""
    try:
        # Sanitize relationship name for use in field name
        sanitized_rel_name = sanitize_relationship_name_for_field(relationship_name)
        
        frappe.logger().info(f"Generating field name: relationship='{relationship_name}', parent_table='{parent_table_name}', parent_singular='{parent_singular}', sanitized='{sanitized_rel_name}'")
        
        # Base field name
        base_field = f"{parent_singular}_link"
        
        # Prevent redundant prefixes (e.g., avoid 'class_classes_schedule_link')
        if sanitized_rel_name and sanitized_rel_name != parent_singular and not sanitized_rel_name.startswith(parent_singular):
            # Create a more descriptive field name
            context_field = f"{parent_singular}_{sanitized_rel_name}_link"
            
            # Ensure field name isn't too long (Frappe has limits)
            if len(context_field) <= 140:  # Frappe field name limit
                return context_field
            else:
                # Truncate but keep meaningful parts
                max_context_length = 140 - len(f"{parent_singular}_link") - 1
                truncated_context = sanitized_rel_name[:max_context_length]
                return f"{parent_singular}_{truncated_context}_link"
        
        return base_field
        
    except Exception as e:
        frappe.log_error(f"Error generating relationship-specific field name: {str(e)}", "Field Naming")
        return f"{parent_singular}_link"

def sanitize_relationship_name_for_field(relationship_name):
    """Sanitize relationship name to be usable in field names"""
    try:
        if not relationship_name:
            return ""
        
        # Extract meaningful words from relationship name
        import re
        
        # Remove common relationship indicators
        cleaned = relationship_name.lower()
        cleaned = re.sub(r'(to|and|relationship|rel|link|connection)', '', cleaned)
        cleaned = re.sub(r'[→←↔\-_\s]+', '_', cleaned)  # Replace arrows and separators
        cleaned = re.sub(r'[^a-z0-9_]', '', cleaned)  # Remove special chars
        cleaned = re.sub(r'_+', '_', cleaned)  # Collapse multiple underscores
        cleaned = cleaned.strip('_')  # Remove leading/trailing underscores
        
        # Extract meaningful parts
        words = [word for word in cleaned.split('_') if len(word) > 2]  # Skip short words
        
        # Take first 2-3 meaningful words
        if len(words) >= 2:
            return '_'.join(words[:2])
        elif len(words) == 1:
            return words[0]
        else:
            return ""
            
    except Exception as e:
        frappe.log_error(f"Error sanitizing relationship name: {str(e)}", "Field Naming")
        return ""



def get_meaningful_table_label(table_doc):
    """Get a meaningful label for a table field"""
    try:
        # Prefer table_label, then table_name, avoid table IDs
        if table_doc.table_label and not table_doc.table_label.startswith('FT-'):
            return table_doc.table_label
        elif table_doc.table_name and not table_doc.table_name.startswith('FT-'):
            return table_doc.table_name.replace('_', ' ').title()
        elif table_doc.doctype_name:
            # Clean up the doctype name for display
            clean_name = table_doc.doctype_name.replace('FLS', '').replace('Flansa', '')
            return clean_name if clean_name else 'Related Table'
        else:
            return 'Related Table'
    except:
        return 'Related Table'


@frappe.whitelist()
def generate_relationship_field_name(relationship_name, parent_table, child_table):
    """Generate a proper field name for a relationship"""
    try:
        # Get meaningful table names
        parent_name = get_table_name_for_field(parent_table)
        parent_singular = pluralize_to_singular(parent_name)
        
        # Generate context-aware field name
        field_name = generate_relationship_specific_field_name(
            relationship_name, parent_name, parent_singular
        )
        
        # Get target doctype for uniqueness check
        child_doctype = frappe.db.get_value("Flansa Table", child_table, "doctype_name")
        if child_doctype:
            unique_field_name = get_unique_field_name(child_doctype, field_name)
        else:
            unique_field_name = field_name
        
        return {
            "success": True,
            "field_name": unique_field_name,
            "base_name": field_name,
            "parent_singular": parent_singular
        }
        
    except Exception as e:
        frappe.log_error(f"Error generating relationship field name: {str(e)}", "Field Name Generation")
        return {
            "success": False,
            "error": str(e),
            "field_name": "relationship_link"
        }
def _field_already_exists(doctype_name, field_name):
    """Check if a field already exists in a DocType to prevent duplicates"""
    try:
        if not frappe.db.exists("DocType", doctype_name):
            return False
        
        # Clear meta cache to ensure we get latest field info
        frappe.clear_cache(doctype=doctype_name)
        meta = frappe.get_meta(doctype_name)
        
        # Check both regular fields and custom fields
        for field in meta.fields:
            if field.fieldname == field_name:
                frappe.logger().info(f"Field {field_name} already exists in {doctype_name}")
                return True
        
        # Also check custom fields table directly
        custom_field_exists = frappe.db.exists("Custom Field", {
            "dt": doctype_name,
            "fieldname": field_name
        })
        
        if custom_field_exists:
            frappe.logger().info(f"Custom field {field_name} already exists in {doctype_name}")
            return True
        
        return False
    except Exception as e:
        frappe.log_error(f"Error checking field existence: {str(e)}", "Field Check")
        return False