"""
Enhanced Link Field Search API
Provides search functionality with display field support
"""

import frappe
from frappe import _

@frappe.whitelist()
def search_with_display_field(doctype, txt, searchfield="name", start=0, page_len=10, filters=None, **kwargs):
    """
    Enhanced search for link fields that includes display field values
    
    Args:
        doctype: The target DocType to search
        txt: Search term
        searchfield: Primary field to search (usually 'name')
        start: Pagination start
        page_len: Number of results to return
        filters: Additional filters (includes 'display_field' key)
    
    Returns:
        List of [value, label, description] tuples for autocomplete
    """
    try:
        
        # Handle filters that might be passed as JSON string
        if isinstance(filters, str):
            import json
            filters = json.loads(filters)
        
        if not filters:
            filters = {}
        
        display_field = filters.get('display_field', 'name')
        doctype_name = filters.get('doctype', doctype)
        
        # Verify the DocType exists
        if not frappe.db.exists("DocType", doctype_name):
            return []
        
        # Build search conditions - search both name and display field
        search_conditions = []
        values = []
        
        # Use appropriate quote character based on database type
        quote_char = '"' if frappe.db.db_type == 'postgres' else '`'
        
        if txt and txt.strip():
            search_conditions.append(f"{quote_char}name{quote_char} LIKE %s")
            values.append(f"%{txt}%")
            
            if display_field != 'name':
                search_conditions.append(f"{quote_char}{display_field}{quote_char} LIKE %s")
                values.append(f"%{txt}%")
        
        # Build the query
        search_clause = ""
        if search_conditions:
            search_clause = f"WHERE ({' OR '.join(search_conditions)})"
        else:
            # If no search term, show first 10 records ordered by display field
            pass
        
        # Execute the search - use database-agnostic query
        # Build query using Frappe's database abstraction
        if frappe.db.db_type == 'postgres':
            # PostgreSQL syntax
            query = f"""
                SELECT "name", "{display_field}" as display_value
                FROM "tab{doctype_name}"
                {search_clause}
                ORDER BY "{display_field}", "name"
                LIMIT {page_len} OFFSET {start}
            """
        else:
            # MySQL/MariaDB syntax
            query = f"""
                SELECT `name`, `{display_field}` as display_value
                FROM `tab{doctype_name}`
                {search_clause}
                ORDER BY `{display_field}`, `name`
                LIMIT {start}, {page_len}
            """
        
        results = frappe.db.sql(query, values, as_dict=True)
        
        # Format results for Frappe autocomplete
        # Return format: [value, label, description]
        formatted_results = []
        for row in results:
            name = row.get('name')
            display_value = row.get('display_value') or name
            
            # Only show ID in description if it's different from display value
            description = f"ID: {name}" if name != display_value else ""
            
            formatted_results.append([
                name,                           # value (what gets stored)  
                display_value,                  # label (what user sees)
                description                     # description (additional info)
            ])
        
        return formatted_results
        
    except Exception as e:
        frappe.log_error(f"Link search error: {str(e)}", "Link Search")
        return []