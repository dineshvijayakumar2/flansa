"""
Flansa API - Main API module for Flansa platform
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def get_table_metadata(table_name):
    """Get metadata for a Flansa table"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get table document
        table_doc = frappe.get_doc('Flansa Table', table_name)
        
        # Use native fields instead of Flansa Field doctype
        from flansa.native_fields import get_table_fields_native
        
        native_result = get_table_fields_native(table_name)
        if not native_result.get('success'):
            return native_result
        
        # Format fields for frontend
        formatted_fields = []
        for field in native_result.get('fields', []):
            # Only include fields created by Flansa (exclude standard Frappe fields)
            if field.get('created_by_flansa'):
                formatted_fields.append({
                    'fieldname': field['fieldname'],
                    'label': field['label'],
                    'fieldtype': field['fieldtype'],
                    'options': field.get('options', ''),
                    'in_list_view': field.get('in_list_view', 0),
                    'is_title_field': field.get('is_title_field', 0),
                    'required': field.get('reqd', 0),
                    'read_only': field.get('read_only', 0)
                })
        
        return {
            'success': True,
            'table_label': table_doc.table_label,
            'fields': formatted_fields,
            'doctype_name': table_doc.doctype_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table metadata: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_table_records(table_name, page=1, page_size=20, search='', filters=None, sort=None):
    """Get records from a Flansa table with pagination, search and filters"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get the actual DocType name from the table
        table_doc = frappe.get_doc('Flansa Table', table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name:
            return {'success': False, 'error': f'DocType not generated for table {table_name}'}
        
        page = int(page)
        page_size = int(page_size)
        
        # Parse filters if provided
        if filters:
            if isinstance(filters, str):
                filters = json.loads(filters)
        else:
            filters = []
        
        # Parse sort if provided
        if sort:
            if isinstance(sort, str):
                sort = json.loads(sort)
        else:
            sort = []
        
        # Build query filters
        query_filters = {'docstatus': ['!=', 2]}  # Exclude deleted records
        
        # Add search functionality
        search_fields = []
        if search:
            # Get fields that can be searched using native fields
            from flansa.native_fields import get_table_fields_native
            native_result = get_table_fields_native(table_name)
            
            if native_result.get('success'):
                # Get searchable field types
                searchable_types = ['Data', 'Text', 'Link', 'Small Text']
                for field in native_result.get('fields', []):
                    if (field.get('created_by_flansa') and 
                        field.get('fieldtype') in searchable_types):
                        search_fields.append(field['fieldname'])
            
            if search_fields:
                search_conditions = []
                for field in search_fields:
                    search_conditions.append([field, 'like', f'%{search}%'])
                
                # Add OR condition for search
                if len(search_conditions) > 1:
                    query_filters.update({'or': search_conditions})
                else:
                    query_filters.update({search_fields[0]: ['like', f'%{search}%']})
        
        # Add custom filters
        for filter_item in filters:
            if isinstance(filter_item, dict) and 'field' in filter_item:
                field = filter_item['field']
                operator = filter_item.get('operator', '=')
                value = filter_item.get('value')
                
                if operator == 'like':
                    query_filters[field] = ['like', f'%{value}%']
                elif operator == 'in':
                    query_filters[field] = ['in', value]
                elif operator == '!=':
                    query_filters[field] = ['!=', value]
                elif operator == '>':
                    query_filters[field] = ['>', value]
                elif operator == '<':
                    query_filters[field] = ['<', value]
                elif operator == '>=':
                    query_filters[field] = ['>=', value]
                elif operator == '<=':
                    query_filters[field] = ['<=', value]
                else:
                    query_filters[field] = value
        
        # Build order by
        order_by = 'modified desc'  # Default sort
        if sort:
            sort_conditions = []
            for sort_item in sort:
                if isinstance(sort_item, dict) and 'field' in sort_item:
                    field = sort_item['field']
                    direction = sort_item.get('direction', 'asc')
                    sort_conditions.append(f'{field} {direction}')
            
            if sort_conditions:
                order_by = ', '.join(sort_conditions)
        
        # Get total count
        total_count = frappe.db.count(doctype_name, filters=query_filters)
        
        # Get paginated records
        start = (page - 1) * page_size
        
        records = frappe.get_all(doctype_name,
            filters=query_filters,
            fields=['*'],
            order_by=order_by,
            start=start,
            page_length=page_size
        )
        
        return {
            'success': True,
            'data': records,
            'total': total_count,
            'page': page,
            'page_size': page_size,
            'has_more': start + page_size < total_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table records: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def create_record(table_name, record_data):
    """Create a new record in a Flansa table"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get the actual DocType name
        table_doc = frappe.get_doc('Flansa Table', table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name:
            return {'success': False, 'error': f'DocType not generated for table {table_name}'}
        
        # Parse record data
        if isinstance(record_data, str):
            record_data = json.loads(record_data)
        
        # Create new document
        doc = frappe.new_doc(doctype_name)
        
        # Set field values
        for field_name, value in record_data.items():
            if hasattr(doc, field_name):
                setattr(doc, field_name, value)
        
        # Save document
        doc.insert()
        
        return {
            'success': True,
            'record_name': doc.name,
            'message': 'Record created successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating record: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def update_record(table_name, record_name, record_data):
    """Update an existing record in a Flansa table"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get the actual DocType name
        table_doc = frappe.get_doc('Flansa Table', table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name:
            return {'success': False, 'error': f'DocType not generated for table {table_name}'}
        
        if not frappe.db.exists(doctype_name, record_name):
            return {'success': False, 'error': f'Record {record_name} not found'}
        
        # Parse record data
        if isinstance(record_data, str):
            record_data = json.loads(record_data)
        
        # Get existing document
        doc = frappe.get_doc(doctype_name, record_name)
        
        # Update field values
        for field_name, value in record_data.items():
            if hasattr(doc, field_name):
                setattr(doc, field_name, value)
        
        # Save document
        doc.save()
        
        return {
            'success': True,
            'record_name': doc.name,
            'message': 'Record updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating record: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def delete_record(table_name, record_name):
    """Delete a record from a Flansa table"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get the actual DocType name
        table_doc = frappe.get_doc('Flansa Table', table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name:
            return {'success': False, 'error': f'DocType not generated for table {table_name}'}
        
        if not frappe.db.exists(doctype_name, record_name):
            return {'success': False, 'error': f'Record {record_name} not found'}
        
        # Delete document
        frappe.delete_doc(doctype_name, record_name)
        
        return {
            'success': True,
            'message': 'Record deleted successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting record: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_app_info(app_id):
    """Get app information by app_id"""
    try:
        # Check if app_id exists as a Flansa App
        if frappe.db.exists('Flansa App', app_id):
            app_doc = frappe.get_doc('Flansa App', app_id)
            return {
                'success': True,
                'app_id': app_id,
                'app_name': app_doc.app_name,
                'app_label': app_doc.app_label or app_doc.app_name,
                'description': app_doc.description
            }
        else:
            return {'success': False, 'error': f'App {app_id} not found'}
            
    except Exception as e:
        frappe.log_error(f"Error getting app info: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def export_table_data(table_name, format='csv', filters=None):
    """Export table data in various formats"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get the actual DocType name
        table_doc = frappe.get_doc('Flansa Table', table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name:
            return {'success': False, 'error': f'DocType not generated for table {table_name}'}
        
        # Parse filters if provided
        if filters:
            if isinstance(filters, str):
                filters = json.loads(filters)
        else:
            filters = {}
        
        # Add default filter to exclude deleted records
        filters['docstatus'] = ['!=', 2]
        
        # Get all records
        records = frappe.get_all(doctype_name,
            filters=filters,
            fields=['*'],
            order_by='modified desc'
        )
        
        if format.lower() == 'csv':
            # Generate CSV
            import csv
            import io
            
            output = io.StringIO()
            
            if records:
                writer = csv.DictWriter(output, fieldnames=records[0].keys())
                writer.writeheader()
                writer.writerows(records)
            
            csv_data = output.getvalue()
            output.close()
            
            return {
                'success': True,
                'data': csv_data,
                'filename': f'{table_name}_export.csv',
                'content_type': 'text/csv'
            }
        
        elif format.lower() == 'json':
            return {
                'success': True,
                'data': json.dumps(records, indent=2, default=str),
                'filename': f'{table_name}_export.json',
                'content_type': 'application/json'
            }
        
        else:
            return {'success': False, 'error': f'Unsupported export format: {format}'}
        
    except Exception as e:
        frappe.log_error(f"Error exporting table data: {str(e)}")
        return {'success': False, 'error': str(e)}