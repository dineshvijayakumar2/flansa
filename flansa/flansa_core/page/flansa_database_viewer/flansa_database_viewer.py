import frappe
import re
from frappe import _

@frappe.whitelist()
def get_database_tables():
    """Get list of all database tables"""
    try:
        # Get all tables from the database
        tables = frappe.db.sql("SHOW TABLES", as_dict=True)
        
        # Extract table names (the column name varies by database)
        table_list = []
        for table in tables:
            # Get the first value from the dictionary (table name)
            table_name = list(table.values())[0]
            table_list.append({
                'name': table_name,
                'is_doctype': table_name.startswith('tab'),
                'is_singles': table_name == 'tabSingles',
                'is_custom': 'custom' in table_name.lower()
            })
        
        # Sort tables alphabetically
        table_list.sort(key=lambda x: x['name'])
        
        return {
            'success': True,
            'tables': table_list,
            'total_count': len(table_list)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting database tables: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_table_data(table_name, limit=50):
    """Get data from a specific table"""
    try:
        # Decode URL-encoded table name
        import urllib.parse
        table_name = urllib.parse.unquote_plus(table_name)
        
        # Validate table name to prevent SQL injection
        # Allow tab prefix and various characters commonly found in table names
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Check if table exists
        table_exists = frappe.db.sql(f"SHOW TABLES LIKE %s", (table_name,))
        if not table_exists:
            raise ValueError(f"Table '{table_name}' does not exist")
        
        # Get table data with limit
        limit = int(limit)
        if limit > 1000:  # Safety limit
            limit = 1000
            
        escaped_table = table_name.replace('`', '``')
        data = frappe.db.sql("SELECT * FROM `{}` LIMIT {}".format(escaped_table, limit), as_dict=True)
        
        # Get column information
        columns = frappe.db.sql("DESCRIBE `{}`".format(escaped_table), as_dict=True)
        
        # Get table row count
        count_result = frappe.db.sql("SELECT COUNT(*) as count FROM `{}`".format(escaped_table), as_dict=True)
        total_rows = count_result[0]['count'] if count_result else 0
        
        return {
            'success': True,
            'data': data,
            'columns': columns,
            'total_rows': total_rows,
            'displayed_rows': len(data),
            'table_name': table_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table data for {table_name}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_table_structure(table_name):
    """Get detailed structure of a table"""
    try:
        # Decode URL-encoded table name
        import urllib.parse
        table_name = urllib.parse.unquote_plus(table_name)
        
        # Validate table name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Get column details
        structure = frappe.db.sql("DESCRIBE `{}`".format(table_name.replace('`', '``')), as_dict=True)
        
        # Get indexes
        indexes = frappe.db.sql("SHOW INDEX FROM `{}`".format(table_name.replace('`', '``')), as_dict=True)
        
        # Get table status (size, engine, etc.)
        status = frappe.db.sql("SHOW TABLE STATUS LIKE %s", (table_name,), as_dict=True)
        
        # Get create table statement
        create_table = frappe.db.sql("SHOW CREATE TABLE `{}`".format(table_name.replace('`', '``')), as_dict=True)
        
        return {
            'success': True,
            'structure': structure,
            'indexes': indexes,
            'status': status[0] if status else {},
            'create_statement': create_table[0]['Create Table'] if create_table else '',
            'table_name': table_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table structure for {table_name}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def execute_sql_query(query):
    """Execute a SQL query (read-only operations only)"""
    try:
        # Clean and validate query
        query = query.strip()
        if not query:
            raise ValueError("Empty query")
        
        # Security check - only allow safe read operations
        query_upper = query.upper().strip()
        allowed_statements = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN']
        
        # Check if query starts with allowed statement
        is_allowed = False
        for statement in allowed_statements:
            if query_upper.startswith(statement):
                is_allowed = True
                break
        
        if not is_allowed:
            raise ValueError("Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed for safety")
        
        # Block dangerous keywords even in SELECT statements
        dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE']
        for keyword in dangerous_keywords:
            if keyword in query_upper:
                raise ValueError(f"Query contains forbidden keyword: {keyword}")
        
        # Execute query
        results = frappe.db.sql(query, as_dict=True)
        
        # Get column names if results exist
        columns = []
        if results:
            columns = list(results[0].keys())
        
        return {
            'success': True,
            'results': results,
            'columns': columns,
            'row_count': len(results),
            'query': query
        }
        
    except Exception as e:
        frappe.log_error(f"Error executing SQL query: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'query': query
        }

@frappe.whitelist()
def scan_orphaned_tables():
    """Scan for tables that exist in database but have no DocType definition"""
    try:
        orphaned_tables = []
        
        # Get all tables that start with 'tab' (DocType tables)
        all_tables = frappe.db.sql("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            AND table_name LIKE 'tab%'
            ORDER BY table_name
        """, as_dict=True)
        
        # Get all registered DocTypes
        registered_doctypes = frappe.db.sql("""
            SELECT name FROM `tabDocType`
        """, as_dict=True)
        
        # Create set of expected table names
        expected_tables = set()
        for dt in registered_doctypes:
            # Handle different naming conventions
            table_name = f"tab{dt['name']}"
            expected_tables.add(table_name)
            
            # Also add with underscores replacing spaces
            table_name_underscore = f"tab{dt['name'].replace(' ', '_')}"
            expected_tables.add(table_name_underscore)
            
            # Also add with + replacing spaces (for tables like tabCustomize+Form+Field)
            table_name_plus = f"tab{dt['name'].replace(' ', '+')}"
            expected_tables.add(table_name_plus)
        
        # Get actual table names from database for more accurate matching
        actual_doctype_tables = frappe.db.sql("""
            SELECT DISTINCT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            AND table_name IN (
                SELECT CONCAT('tab', name) FROM `tabDocType`
                UNION
                SELECT CONCAT('tab', REPLACE(name, ' ', '_')) FROM `tabDocType`
                UNION
                SELECT CONCAT('tab', REPLACE(name, ' ', '+')) FROM `tabDocType`
            )
        """, as_dict=True)
        
        for table in actual_doctype_tables:
            expected_tables.add(table['table_name'])
        
        # Add known system tables that are expected
        system_tables = {
            'tabSingles', 'tabDefaultValue', 'tabDocType', 'tabDocField',
            'tabCustom_Field', 'tabCustom Field', 'tabProperty_Setter', 
            'tabProperty Setter', 'tabSeries', 'tabVersion', 'tabFile',
            'tabCommunication', 'tabActivity_Log', 'tabActivity Log',
            'tabError_Log', 'tabError Log', 'tabScheduled_Job_Log',
            'tabScheduled Job Log', 'tabAccess_Log', 'tabAccess Log'
        }
        expected_tables.update(system_tables)
        
        # Known system tables that don't need DocTypes
        known_system_tables = {
            'tabSingles', 'tabDefaultValue', 'tabVersion', 'tabSeries',
            'tabScheduled Job Type', 'tabSessions', 'tabDeleted Document'
        }
        
        # Find orphaned tables with better accuracy
        for table in all_tables:
            table_name = table['table_name']
            
            # Skip known system tables
            if table_name in known_system_tables:
                continue
                
            # Check if table is truly orphaned
            is_orphaned = True
            
            if table_name.startswith('tab'):
                # Extract base name without 'tab' prefix
                base_name = table_name[3:]
                
                # Try different naming patterns to find the DocType
                potential_doctype_names = [
                    base_name,  # Exact match
                    base_name.replace('_', ' '),  # Underscores to spaces
                    base_name.replace('+', ' '),  # Plus signs to spaces
                    base_name.replace('_', '+'),  # Underscores to plus signs
                ]
                
                # Check if any of these DocType names exist
                for potential_name in potential_doctype_names:
                    if frappe.db.exists('DocType', potential_name):
                        is_orphaned = False
                        break
            
            # If still appears orphaned, double-check against our expected tables set
            if not is_orphaned or table_name in expected_tables:
                continue
                
            # This table is truly orphaned - get its info
            try:
                # Get table info
                table_info = frappe.db.sql("""
                    SELECT 
                        (SELECT COUNT(*) FROM `{}`) as row_count,
                        (SELECT COUNT(*) FROM information_schema.columns 
                         WHERE table_schema = DATABASE() 
                         AND table_name = %s) as column_count
                """.format(table_name.replace('`', '``')), (table_name,), as_dict=True)
                
                # Check if a similar DocType exists (might have naming mismatch)
                probable_doctype = table_name[3:].replace('_', ' ') if table_name.startswith('tab') else 'Unknown'
                possible_doctype = None
                
                # Try to find a matching DocType with different naming
                for potential_name in potential_doctype_names:
                    # Check if DocType exists in list but table name doesn't match
                    doctype_check = frappe.db.sql("""
                        SELECT name FROM `tabDocType` 
                        WHERE name LIKE %s
                        LIMIT 1
                    """, (f"%{potential_name.replace(' ', '%')}%",), as_dict=True)
                    
                    if doctype_check:
                        possible_doctype = doctype_check[0]['name']
                        break
                
                orphaned_tables.append({
                    'table_name': table_name,
                    'row_count': table_info[0]['row_count'] if table_info else 0,
                    'column_count': table_info[0]['column_count'] if table_info else 0,
                    'probable_doctype': probable_doctype,
                    'possible_doctype': possible_doctype  # DocType that might be related
                })
            except:
                # Skip tables we can't query
                pass
        
        return {
            'success': True,
            'orphaned_tables': orphaned_tables,
            'total_count': len(orphaned_tables),
            'scan_summary': f"Found {len(orphaned_tables)} orphaned tables in the database"
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Scan error: {str(e)[:100]}"
        }

@frappe.whitelist()
def scan_orphaned_fields():
    """Scan for fields that exist in database but not in DocType definitions"""
    try:
        orphaned_fields = []
        
        # Get all DocType tables - exclude virtual and single doctypes
        doctype_tables = frappe.db.sql("""
            SELECT name FROM `tabDocType` 
            WHERE (custom = 0 OR custom = 1)
            AND issingle = 0
            AND istable = 0
            AND IFNULL(is_virtual, 0) = 0
        """, as_dict=True)
        
        for doctype_row in doctype_tables:
            doctype_name = doctype_row['name']
            table_name = f"tab{doctype_name.replace(' ', '_')}"
            
            try:
                # Check if table exists - use proper parameter binding
                table_exists = frappe.db.sql("SHOW TABLES LIKE %s", (table_name,))
                if not table_exists:
                    continue
                
                # Get actual table columns - escape table name properly
                escaped_table = table_name.replace('`', '``')
                actual_columns = frappe.db.sql("DESCRIBE `{}`".format(escaped_table), as_dict=True)
                actual_column_names = {col['Field'] for col in actual_columns}
                
                # Get defined fields from DocType and Custom Fields
                defined_fields = set()
                
                # Standard DocType fields
                doctype_fields = frappe.db.sql("""
                    SELECT fieldname FROM `tabDocField` 
                    WHERE parent = %s AND fieldname IS NOT NULL AND fieldname != ''
                """, (doctype_name,), as_dict=True)
                
                for field in doctype_fields:
                    if field['fieldname']:
                        defined_fields.add(field['fieldname'])
                
                # Custom fields
                custom_fields = frappe.db.sql("""
                    SELECT fieldname FROM `tabCustom Field` 
                    WHERE dt = %s AND fieldname IS NOT NULL AND fieldname != ''
                """, (doctype_name,), as_dict=True)
                
                for field in custom_fields:
                    if field['fieldname']:
                        defined_fields.add(field['fieldname'])
                
                # Standard Frappe fields that are always present
                standard_fields = {
                    'name', 'creation', 'modified', 'modified_by', 'owner', 
                    'docstatus', 'idx', '_user_tags', '_comments', '_assign', '_liked_by'
                }
                defined_fields.update(standard_fields)
                
                # Find orphaned fields
                orphaned = actual_column_names - defined_fields
                
                if orphaned:
                    for field_name in orphaned:
                        # Get field details from table structure
                        field_details = next((col for col in actual_columns if col['Field'] == field_name), {})
                        
                        orphaned_fields.append({
                            'doctype': doctype_name,
                            'table_name': table_name,
                            'field_name': field_name,
                            'field_type': field_details.get('Type', ''),
                            'is_nullable': field_details.get('Null', '') == 'YES',
                            'default_value': field_details.get('Default', ''),
                            'extra': field_details.get('Extra', '')
                        })
                        
            except Exception as table_error:
                # Skip individual table errors silently
                # This is expected for:
                # - Virtual DocTypes without actual tables
                # - DocTypes with naming issues
                # - Child tables that may have been removed
                pass
        
        # Sort by doctype and field name
        orphaned_fields.sort(key=lambda x: (x['doctype'], x['field_name']))
        
        # Calculate unique doctypes safely
        unique_doctypes = len(set(f['doctype'] for f in orphaned_fields)) if orphaned_fields else 0
        
        return {
            'success': True,
            'orphaned_fields': orphaned_fields,
            'total_count': len(orphaned_fields),
            'scan_summary': f"Found {len(orphaned_fields)} orphaned fields across {unique_doctypes} DocTypes"
        }
        
    except Exception as e:
        # Don't log to avoid cluttering error log, just return error to UI
        return {
            'success': False,
            'error': f"Scan error: {str(e)[:100]}"  # Limit error message length
        }

@frappe.whitelist()
def delete_orphaned_table(table_name, confirm_delete=False):
    """Delete an orphaned table after verification"""
    try:
        # Security checks
        if not frappe.session.user == 'Administrator':
            raise frappe.PermissionError("Only Administrator can delete tables")
        
        if not confirm_delete:
            raise ValueError("Deletion not confirmed")
        
        # Validate table name format
        if not re.match(r'^tab[a-zA-Z0-9_\+\s]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Verify table exists
        table_exists = frappe.db.sql("SHOW TABLES LIKE %s", (table_name,))
        if not table_exists:
            raise ValueError(f"Table '{table_name}' does not exist")
        
        # Double-check it's truly orphaned (no DocType exists)
        base_name = table_name[3:] if table_name.startswith('tab') else table_name
        potential_names = [
            base_name,
            base_name.replace('_', ' '),
            base_name.replace('+', ' ')
        ]
        
        for name in potential_names:
            if frappe.db.exists('DocType', name):
                raise ValueError(f"Table has corresponding DocType: {name}. Cannot delete.")
        
        # Get row count before deletion
        escaped_table = table_name.replace('`', '``')
        row_count = frappe.db.sql(f"SELECT COUNT(*) FROM `{escaped_table}`")[0][0]
        
        # Create backup information
        backup_info = {
            'table_name': table_name,
            'row_count': row_count,
            'deleted_by': frappe.session.user,
            'deleted_at': frappe.utils.now()
        }
        
        # Log the deletion attempt
        frappe.log_error(
            message=f"Deleting orphaned table: {table_name} with {row_count} rows",
            title="Orphaned Table Deletion"
        )
        
        # Perform the deletion - use frappe.db.sql_ddl for DDL operations
        # DDL operations auto-commit, so we need to handle them specially
        try:
            frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `{escaped_table}`")
        except AttributeError:
            # Fallback if sql_ddl doesn't exist
            frappe.db.commit()  # Commit any pending transactions first
            frappe.db.sql(f"DROP TABLE IF EXISTS `{escaped_table}`")
            # No need to commit again as DROP TABLE auto-commits
        
        return {
            'success': True,
            'message': f"Successfully deleted table '{table_name}' with {row_count} rows",
            'backup_info': backup_info
        }
        
    except frappe.PermissionError as e:
        return {
            'success': False,
            'error': str(e)
        }
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'error': f"Failed to delete table: {str(e)}"
        }

@frappe.whitelist()
def delete_orphaned_field(doctype_name, field_name, confirm_delete=False):
    """Delete an orphaned field from a table"""
    try:
        # Security checks
        if not frappe.session.user == 'Administrator':
            raise frappe.PermissionError("Only Administrator can delete fields")
        
        if not confirm_delete:
            raise ValueError("Deletion not confirmed")
        
        # Get the table name
        table_name = f"tab{doctype_name.replace(' ', '_')}"
        
        # Validate field name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', field_name):
            raise ValueError(f"Invalid field name format: {field_name}")
        
        # Verify table exists
        table_exists = frappe.db.sql("SHOW TABLES LIKE %s", (table_name,))
        if not table_exists:
            raise ValueError(f"Table '{table_name}' does not exist")
        
        # Verify field exists in table
        escaped_table = table_name.replace('`', '``')
        columns = frappe.db.sql(f"DESCRIBE `{escaped_table}`", as_dict=True)
        field_exists = any(col['Field'] == field_name for col in columns)
        
        if not field_exists:
            raise ValueError(f"Field '{field_name}' does not exist in table '{table_name}'")
        
        # Double-check it's truly orphaned (not in DocField or Custom Field)
        docfield_exists = frappe.db.exists('DocField', {
            'parent': doctype_name,
            'fieldname': field_name
        })
        
        custom_field_exists = frappe.db.exists('Custom Field', {
            'dt': doctype_name,
            'fieldname': field_name
        })
        
        if docfield_exists or custom_field_exists:
            raise ValueError(f"Field '{field_name}' has DocField/Custom Field definition. Cannot delete.")
        
        # Get field info before deletion
        field_info = next((col for col in columns if col['Field'] == field_name), {})
        
        # Log the deletion
        frappe.log_error(
            message=f"Deleting orphaned field: {field_name} from {table_name}",
            title="Orphaned Field Deletion"
        )
        
        # Perform the deletion - ALTER TABLE also causes implicit commit
        try:
            frappe.db.sql_ddl(f"ALTER TABLE `{escaped_table}` DROP COLUMN `{field_name}`")
        except AttributeError:
            # Fallback if sql_ddl doesn't exist
            frappe.db.commit()  # Commit any pending transactions first
            frappe.db.sql(f"ALTER TABLE `{escaped_table}` DROP COLUMN `{field_name}`")
            # No need to commit again as ALTER TABLE auto-commits
        
        return {
            'success': True,
            'message': f"Successfully deleted field '{field_name}' from '{doctype_name}'",
            'field_info': field_info
        }
        
    except frappe.PermissionError as e:
        return {
            'success': False,
            'error': str(e)
        }
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'error': f"Failed to delete field: {str(e)}"
        }