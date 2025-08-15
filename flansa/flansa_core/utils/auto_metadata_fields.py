"""
Auto Metadata Fields - Automatically creates standard metadata fields for new tables
"""

import frappe
from frappe import _

# Standard metadata fields that should be auto-created for every table
METADATA_FIELDS = [
    {
        'field_name': 'id',
        'field_label': 'ID', 
        'field_type': 'Data',
        'is_required': 1,
        'is_unique': 1,
        'description': 'Unique identifier for this record',
        'read_only': 1
    },
    {
        'field_name': 'created_by',
        'field_label': 'Created By',
        'field_type': 'Link',
        'link_doctype': 'User',
        'description': 'User who created this record',
        'read_only': 1
    },
    {
        'field_name': 'created_on',
        'field_label': 'Created On',
        'field_type': 'Datetime',
        'description': 'Date and time when this record was created',
        'read_only': 1
    },
    {
        'field_name': 'modified_by',
        'field_label': 'Modified By',
        'field_type': 'Link',
        'link_doctype': 'User',
        'description': 'User who last modified this record',
        'read_only': 1
    },
    {
        'field_name': 'modified_on',
        'field_label': 'Modified On',
        'field_type': 'Datetime',
        'description': 'Date and time when this record was last modified',
        'read_only': 1
    },
    {
        'field_name': 'status',
        'field_label': 'Status',
        'field_type': 'Select',
        'options': ['Active', 'Inactive', 'Draft', 'Archived'],
        'default': 'Active',
        'description': 'Current status of this record'
    }
]

def create_metadata_fields(table_name, table_id):
    """
    Create standard metadata fields for a new table
    
    Args:
        table_name (str): Display name of the table
        table_id (str): Flansa Table ID (e.g., FT-0001)
    
    Returns:
        list: Created field IDs
    """
    
    created_fields = []
    
    try:
        print(f"Creating metadata fields for table: {table_name} ({table_id})")
        
        for field_data in METADATA_FIELDS:
            # Check if field already exists
            existing = frappe.db.sql("""
                SELECT name FROM `tabFlansa Field`
                WHERE flansa_table = %s AND field_name = %s
            """, (table_id, field_data['field_name']))
            
            if existing:
                print(f"  ⚠️  Field '{field_data['field_name']}' already exists, skipping")
                continue
            
            # Generate field ID
            field_count = frappe.db.count("Flansa Field")
            field_id = f"FF-{str(field_count + 1).zfill(4)}"
            
            # Create field document
            field_doc = frappe.get_doc({
                "doctype": "Flansa Field",
                "name": field_id,
                "flansa_table": table_id,
                "field_name": field_data['field_name'],
                "field_label": field_data['field_label'],
                "field_type": field_data['field_type'],
                "is_required": field_data.get('is_required', 0),
                "is_unique": field_data.get('is_unique', 0),
                "description": field_data.get('description', ''),
                "read_only": field_data.get('read_only', 0),
                "default_value": field_data.get('default', ''),
                "options": field_data.get('options', []),
                "link_doctype": field_data.get('link_doctype', '')
            })
            
            # Handle options for Select fields
            if field_data['field_type'] == 'Select' and field_data.get('options'):
                field_doc.options = '\n'.join(field_data['options'])
            
            field_doc.insert(ignore_permissions=True)
            created_fields.append(field_id)
            
            print(f"  ✅ Created field: {field_id} ({field_data['field_name']})")
        
        frappe.db.commit()
        print(f"✅ Created {len(created_fields)} metadata fields for {table_name}")
        
        return created_fields
        
    except Exception as e:
        frappe.log_error(f"Error creating metadata fields: {e}")
        print(f"❌ Error creating metadata fields: {e}")
        return []

def ensure_metadata_fields_exist(table_id):
    """
    Ensure metadata fields exist for a table, create if missing
    
    Args:
        table_id (str): Flansa Table ID
    
    Returns:
        dict: Status and created fields
    """
    
    try:
        # Get table info
        table = frappe.get_doc("Flansa Table", table_id)
        
        # Check existing fields
        existing_fields = frappe.db.sql("""
            SELECT field_name FROM `tabFlansa Field`
            WHERE flansa_table = %s
        """, (table_id,), as_dict=True)
        
        existing_field_names = {f.field_name for f in existing_fields}
        required_field_names = {f['field_name'] for f in METADATA_FIELDS}
        
        missing_fields = required_field_names - existing_field_names
        
        if missing_fields:
            print(f"Missing metadata fields in {table.display_name}: {missing_fields}")
            
            # Create missing fields
            created_fields = []
            for field_data in METADATA_FIELDS:
                if field_data['field_name'] in missing_fields:
                    field_count = frappe.db.count("Flansa Field")
                    field_id = f"FF-{str(field_count + 1).zfill(4)}"
                    
                    field_doc = frappe.get_doc({
                        "doctype": "Flansa Field",
                        "name": field_id,
                        "flansa_table": table_id,
                        "field_name": field_data['field_name'],
                        "field_label": field_data['field_label'],
                        "field_type": field_data['field_type'],
                        "is_required": field_data.get('is_required', 0),
                        "is_unique": field_data.get('is_unique', 0),
                        "description": field_data.get('description', ''),
                        "read_only": field_data.get('read_only', 0),
                        "default_value": field_data.get('default', ''),
                        "link_doctype": field_data.get('link_doctype', '')
                    })
                    
                    if field_data['field_type'] == 'Select' and field_data.get('options'):
                        field_doc.options = '\n'.join(field_data['options'])
                    
                    field_doc.insert(ignore_permissions=True)
                    created_fields.append(field_id)
            
            frappe.db.commit()
            
            return {
                'status': 'created',
                'missing_count': len(missing_fields),
                'created_fields': created_fields,
                'message': f'Created {len(created_fields)} missing metadata fields'
            }
        else:
            return {
                'status': 'complete',
                'message': 'All metadata fields already exist'
            }
            
    except Exception as e:
        frappe.log_error(f"Error ensuring metadata fields: {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

@frappe.whitelist()
def auto_create_metadata_for_table(table_id):
    """
    API endpoint to create metadata fields for a table
    
    Args:
        table_id (str): Flansa Table ID
    
    Returns:
        dict: Result of metadata field creation
    """
    
    try:
        result = ensure_metadata_fields_exist(table_id)
        return result
        
    except Exception as e:
        frappe.log_error(f"API error creating metadata fields: {e}")
        frappe.throw(_("Error creating metadata fields: {0}").format(str(e)))

@frappe.whitelist()
def batch_create_metadata_for_all_tables():
    """
    Create metadata fields for all existing tables that don't have them
    
    Returns:
        dict: Summary of batch operation
    """
    
    try:
        # Get all tables
        tables = frappe.db.sql("""
            SELECT name, display_name, table_name
            FROM `tabFlansa Table`
            ORDER BY name
        """, as_dict=True)
        
        results = []
        total_created = 0
        
        for table in tables:
            result = ensure_metadata_fields_exist(table.name)
            results.append({
                'table_id': table.name,
                'table_name': table.display_name,
                'result': result
            })
            
            if result['status'] == 'created':
                total_created += len(result.get('created_fields', []))
        
        return {
            'success': True,
            'tables_processed': len(tables),
            'total_fields_created': total_created,
            'results': results,
            'message': f'Processed {len(tables)} tables, created {total_created} metadata fields'
        }
        
    except Exception as e:
        frappe.log_error(f"Batch metadata creation error: {e}")
        frappe.throw(_("Error in batch metadata creation: {0}").format(str(e)))