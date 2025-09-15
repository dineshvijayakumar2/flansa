"""
Flansa Deployment Utilities

This module contains functions for ensuring Flansa metadata persistence 
across deployments and system restarts.
"""
import frappe
import json
from datetime import datetime

def ensure_flansa_doctype_metadata():
    """
    Comprehensive function to ensure all Flansa DocTypes and fields are properly registered
    Safe to run multiple times - only creates missing entries
    """
    try:
        # Get all Flansa tables that should have DocTypes
        flansa_tables = frappe.get_all("Flansa Table", 
                                       filters={"doctype_name": ["!=", ""]},
                                       fields=["name", "table_name", "doctype_name", "description"])
        
        if not flansa_tables:
            return True
        
        restored_doctypes = 0
        restored_fields = 0
        
        for table in flansa_tables:
            try:
                doctype_name = table.doctype_name
                
                # Step 1: Ensure DocType record exists in tabDocType
                doctype_restored = ensure_doctype_record(table)
                if doctype_restored:
                    restored_doctypes += 1
                
                # Step 2: Ensure all fields are registered in tabDocField
                fields_restored = ensure_doctype_fields(table)
                restored_fields += fields_restored
                
                # Step 3: Ensure basic permissions exist
                ensure_doctype_permissions(doctype_name)
                
            except Exception as table_error:
                # Use print instead of log_error to avoid character length issues
                print(f"❌ Error processing {table.table_name}: {str(table_error)[:100]}...", flush=True)
                continue
        
        # Commit all changes
        frappe.db.commit()
        
        # Clear cache to reflect changes
        if restored_doctypes > 0 or restored_fields > 0:
            frappe.clear_cache()
        
        return True
        
    except Exception as e:
        print(f"❌ Critical error in deployment restoration: {str(e)[:100]}...", flush=True)
        return False

def ensure_doctype_record(table):
    """Ensure DocType record exists in tabDocType"""
    doctype_name = table.doctype_name
    
    # Check if DocType already exists
    if frappe.db.exists("DocType", doctype_name):
        return False
    
    # Create DocType document
    doctype_doc = frappe.get_doc({
        "doctype": "DocType",
        "name": doctype_name,
        "module": "Flansa Generated",
        "custom": 1,
        "is_virtual": 0,
        "issingle": 0,
        "istable": 0,
        "has_web_view": 0,
        "allow_guest_to_view": 0,
        "track_changes": 1,
        "description": table.description or f"Auto-generated DocType for Flansa table: {table.table_name}",
        "creation": datetime.now(),
        "modified": datetime.now(),
        "owner": frappe.session.user,
        "modified_by": frappe.session.user
    })
    
    # Add standard fields that every DocType needs
    doctype_doc.append("fields", {
        "fieldname": "title",
        "fieldtype": "Data", 
        "label": "Title",
        "reqd": 0,
        "idx": 1
    })
    
    doctype_doc.insert()
    return True

def ensure_doctype_fields(table):
    """Ensure all fields from database table are registered in DocType"""
    doctype_name = table.doctype_name
    
    # Get the DocType document
    doctype_doc = frappe.get_doc("DocType", doctype_name)
    
    # Get existing field names in DocType
    existing_fields = {field.fieldname for field in doctype_doc.fields}
    
    # Get database table columns (correct table name construction)
    table_name = doctype_name
    
    try:
        # Check if table exists first
        if not frappe.db.table_exists(table_name):
            return 0
            
        # Use Frappe's describe method (database-agnostic)
        table_columns = frappe.db.describe(table_name)
        
        # Convert tuples to dictionaries if needed (describe returns different formats)
        if table_columns and isinstance(table_columns[0], tuple):
            # Convert tuple format to dict format
            table_columns = [{'name': col[0], 'type': col[1]} for col in table_columns]
        
        # Filter out standard Frappe columns
        standard_columns = {'name', 'creation', 'modified', 'modified_by', 'owner', 'docstatus', 'idx', '_user_tags', '_comments', '_assign', '_liked_by'}
        custom_columns = [col for col in table_columns if col['name'] not in standard_columns]
        
        fields_added = 0
        max_idx = max([field.idx or 0 for field in doctype_doc.fields]) if doctype_doc.fields else 1
        
        for col in custom_columns:
            column_name = col['name']
            
            # Skip if field already exists in DocType
            if column_name in existing_fields:
                continue
            
            # Map database types to Frappe field types
            field_type = map_db_type_to_frappe_type(col['type'], column_name)
            
            # Add field to DocType
            max_idx += 1
            doctype_doc.append("fields", {
                "fieldname": column_name,
                "fieldtype": field_type,
                "label": column_name.replace('_', ' ').title(),
                "reqd": 0,
                "idx": max_idx
            })
            
            fields_added += 1
        
        if fields_added > 0:
            doctype_doc.save()
        
        return fields_added
        
    except Exception as field_error:
        print(f"❌ Error restoring fields for {doctype_name}: {str(field_error)[:100]}...", flush=True)
        return 0

def map_db_type_to_frappe_type(db_type, column_name):
    """Map database column types to appropriate Frappe field types"""
    db_type = db_type.upper()
    
    # Special handling based on column name patterns
    if 'attach' in column_name.lower() or 'file' in column_name.lower():
        return "Attach"
    
    if 'gallery' in column_name.lower() or 'images' in column_name.lower():
        return "Long Text"
    
    # Map by database type
    type_mapping = {
        'VARCHAR': 'Data',
        'CHAR': 'Data', 
        'TEXT': 'Text',
        'LONGTEXT': 'Long Text',
        'MEDIUMTEXT': 'Text Editor',
        'INT': 'Int',
        'INTEGER': 'Int',
        'BIGINT': 'Int',
        'DECIMAL': 'Float',
        'FLOAT': 'Float',
        'DOUBLE': 'Float',
        'DATE': 'Date',
        'DATETIME': 'Datetime',
        'TIMESTAMP': 'Datetime',
        'TIME': 'Time',
        'TINYINT': 'Check',
        'JSON': 'Long Text'
    }
    
    # Extract base type (remove size specifications)
    base_type = db_type.split('(')[0]
    
    return type_mapping.get(base_type, 'Data')

def ensure_doctype_permissions(doctype_name):
    """Ensure basic permissions exist for the DocType"""
    
    # Check if permissions already exist
    existing_perms = frappe.get_all("Custom DocPerm", 
                                   filters={"parent": doctype_name},
                                   limit=1)
    
    if existing_perms:
        return
    
    # Add basic read/write permissions for System Manager
    try:
        perm_doc = frappe.get_doc({
            "doctype": "Custom DocPerm",
            "parent": doctype_name,
            "parenttype": "DocType",
            "parentfield": "permissions",
            "role": "System Manager",
            "read": 1,
            "write": 1,
            "create": 1,
            "delete": 1,
            "submit": 0,
            "cancel": 0,
            "amend": 0
        })
        perm_doc.insert()
    except Exception as perm_error:
        # Don't fail if permission creation fails
        print(f"⚠️ Error creating permissions for {doctype_name}: {str(perm_error)[:100]}...", flush=True)
        pass