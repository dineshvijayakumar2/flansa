"""API to fix invalid DocType references in Flansa Tables"""

import frappe

@frappe.whitelist()
def fix_invalid_doctype_references():
    """Fix all tables that have invalid doctype_name references"""
    try:
        # Get all Flansa Tables with doctype_name set
        tables = frappe.get_all('Flansa Table', 
                               fields=['name', 'table_name', 'table_label', 'doctype_name', 'status'],
                               filters={'doctype_name': ['is', 'set']})
        
        fixed_count = 0
        results = []
        
        for table in tables:
            result = {
                'table_id': table.name,
                'table_name': table.table_name,
                'table_label': table.table_label,
                'doctype_name': table.doctype_name,
                'old_status': table.status,
                'action': 'None'
            }
            
            # Check if DocType actually exists
            if not frappe.db.exists('DocType', table.doctype_name):
                # Clear invalid reference and reset status
                frappe.db.set_value('Flansa Table', table.name, 'doctype_name', '')
                frappe.db.set_value('Flansa Table', table.name, 'status', 'Draft')
                
                result['action'] = 'Cleared invalid reference, reset to Draft'
                result['new_status'] = 'Draft'
                fixed_count += 1
            else:
                result['action'] = 'DocType exists - no changes needed'
                result['new_status'] = table.status
            
            results.append(result)
        
        frappe.db.commit()
        
        return {
            'success': True,
            'fixed_count': fixed_count,
            'total_tables': len(tables),
            'results': results
        }
        
    except Exception as e:
        frappe.log_error(f"Error fixing invalid doctype references: {str(e)}", "Fix Invalid DocTypes")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def clear_invalid_reference(table_name):
    """Clear invalid DocType reference for a specific table"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if table_doc.doctype_name:
            # Check if DocType exists
            if not frappe.db.exists('DocType', table_doc.doctype_name):
                # Clear invalid reference
                old_doctype = table_doc.doctype_name
                frappe.db.set_value('Flansa Table', table_name, 'doctype_name', '')
                frappe.db.set_value('Flansa Table', table_name, 'status', 'Draft')
                frappe.db.commit()
                
                return {
                    'success': True,
                    'message': f'Cleared invalid DocType reference: {old_doctype}',
                    'cleared_doctype': old_doctype
                }
            else:
                return {
                    'success': True,
                    'message': 'DocType exists - no action needed'
                }
        else:
            return {
                'success': True,
                'message': 'No DocType reference to clear'
            }
        
    except Exception as e:
        frappe.log_error(f"Error clearing invalid reference for {table_name}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }