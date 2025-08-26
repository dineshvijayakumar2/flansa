import frappe
import re
from frappe import _

def get_db_type():
    """Get current database type"""
    return getattr(frappe.conf, 'db_type', 'mariadb')

@frappe.whitelist()
def get_database_tables():
    """Get list of all database tables"""
    try:
        db_type = get_db_type()
        
        # Get all tables from the database - database agnostic query
        if db_type == 'postgres':
            tables = frappe.db.sql("""
                SELECT table_name as name
                FROM information_schema.tables 
                WHERE table_schema = current_schema()
                ORDER BY table_name
            """, as_dict=True)
        else:
            # MariaDB/MySQL
            tables = frappe.db.sql("SHOW TABLES", as_dict=True)
        
        # Extract table names (consistent handling for both databases)
        table_list = []
        for table in tables:
            if db_type == 'postgres':
                table_name = table['name']
            else:
                # Get the first value from the dictionary (table name) for MySQL
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
            'total_count': len(table_list),
            'database_type': db_type
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
        db_type = get_db_type()
        
        # Decode URL-encoded table name
        import urllib.parse
        table_name = urllib.parse.unquote_plus(table_name)
        
        # Validate table name to prevent SQL injection
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Check if table exists - database agnostic
        if db_type == 'postgres':
            table_exists = frappe.db.sql("""
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = current_schema() 
                AND table_name = %s
            """, (table_name,))
        else:
            table_exists = frappe.db.sql("SHOW TABLES LIKE %s", (table_name,))
            
        if not table_exists:
            raise ValueError(f"Table '{table_name}' does not exist")
        
        # Get table data with limit
        limit = int(limit)
        if limit > 1000:  # Safety limit
            limit = 1000
        
        # Execute query based on database type
        if db_type == 'postgres':
            # PostgreSQL uses double quotes for identifiers
            data = frappe.db.sql('SELECT * FROM "{}" LIMIT {}'.format(table_name, limit), as_dict=True)
        else:
            # MySQL/MariaDB uses backticks
            escaped_table = table_name.replace('`', '``')
            data = frappe.db.sql("SELECT * FROM `{}` LIMIT {}".format(escaped_table, limit), as_dict=True)
        
        # Get column information - database agnostic
        if db_type == 'postgres':
            columns = frappe.db.sql("""
                SELECT 
                    column_name as "Field",
                    data_type as "Type",
                    is_nullable as "Null",
                    column_default as "Default"
                FROM information_schema.columns 
                WHERE table_schema = current_schema() 
                AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,), as_dict=True)
        else:
            columns = frappe.db.sql("DESCRIBE `{}`".format(escaped_table), as_dict=True)
        
        # Get table row count
        if db_type == 'postgres':
            count_result = frappe.db.sql('SELECT COUNT(*) as count FROM "{}"'.format(table_name), as_dict=True)
        else:
            count_result = frappe.db.sql("SELECT COUNT(*) as count FROM `{}`".format(escaped_table), as_dict=True)
            
        total_rows = count_result[0]['count'] if count_result else 0
        
        return {
            'success': True,
            'data': data,
            'columns': columns,
            'total_rows': total_rows,
            'displayed_rows': len(data),
            'table_name': table_name,
            'database_type': db_type
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
        db_type = get_db_type()
        
        # Decode URL-encoded table name
        import urllib.parse
        table_name = urllib.parse.unquote_plus(table_name)
        
        # Validate table name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Get column details - database agnostic
        if db_type == 'postgres':
            # For PostgreSQL, use exact table name as provided (case-sensitive)
            structure = frappe.db.sql("""
                SELECT 
                    column_name as "Field",
                    data_type as "Type",
                    is_nullable as "Null",
                    column_default as "Default",
                    '' as "Extra"
                FROM information_schema.columns 
                WHERE table_schema = current_schema() 
                AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,), as_dict=True)
            
            # Get indexes for PostgreSQL - handle case sensitive table names
            indexes = frappe.db.sql("""
                SELECT 
                    i.relname as "Key_name",
                    a.attname as "Column_name",
                    CASE WHEN ix.indisunique THEN 0 ELSE 1 END as "Non_unique"
                FROM pg_class t, pg_class i, pg_index ix, pg_attribute a
                WHERE t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relname = %s
                AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = current_schema())
            """, (table_name,), as_dict=True)
            
            # Get table status for PostgreSQL
            # Use quote_ident to properly handle case-sensitive table names
            quoted_table = '"{}"'.format(table_name.replace('"', '""'))
            status = frappe.db.sql("""
                SELECT 
                    schemaname as "Name",
                    n_tup_ins as "Rows",
                    pg_size_pretty(pg_total_relation_size(%s)) as "Data_length"
                FROM pg_stat_user_tables 
                WHERE tablename = %s
            """, (quoted_table, table_name), as_dict=True)
            
            # PostgreSQL doesn't have SHOW CREATE TABLE equivalent
            create_table = [{'Create Table': 'PostgreSQL table schema not available via SHOW CREATE'}]
        else:
            # MySQL/MariaDB queries
            escaped_table = table_name.replace('`', '``')
            structure = frappe.db.sql("DESCRIBE `{}`".format(escaped_table), as_dict=True)
            indexes = frappe.db.sql("SHOW INDEX FROM `{}`".format(escaped_table), as_dict=True)
            status = frappe.db.sql("SHOW TABLE STATUS LIKE %s", (table_name,), as_dict=True)
            create_table = frappe.db.sql("SHOW CREATE TABLE `{}`".format(escaped_table), as_dict=True)
        
        return {
            'success': True,
            'structure': structure,
            'indexes': indexes,
            'status': status[0] if status else {},
            'create_statement': create_table[0].get('Create Table', '') if create_table else '',
            'table_name': table_name,
            'database_type': db_type
        }
        
    except Exception as e:
        # Rollback any failed transaction
        if frappe.db:
            frappe.db.rollback()
        
        # Return error without trying to log (which causes another transaction issue)
        return {
            'success': False,
            'error': str(e),
            'message': f"Error getting table structure for {table_name}"
        }

@frappe.whitelist()
def execute_sql_query(query):
    """Execute a SQL query (read-only operations only)"""
    try:
        db_type = get_db_type()
        
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
        
        # Note: SHOW and DESCRIBE commands don't work in PostgreSQL
        # Convert some common MySQL commands to PostgreSQL equivalents
        if db_type == 'postgres':
            if query_upper.startswith('SHOW TABLES'):
                query = """
                    SELECT table_name as "Tables_in_database"
                    FROM information_schema.tables 
                    WHERE table_schema = current_schema()
                    ORDER BY table_name
                """
            elif query_upper.startswith('DESCRIBE '):
                table_name = query.split()[1].strip('`"')
                query = f"""
                    SELECT 
                        column_name as "Field",
                        data_type as "Type",
                        is_nullable as "Null",
                        column_default as "Default"
                    FROM information_schema.columns 
                    WHERE table_schema = current_schema() 
                    AND table_name = '{table_name}'
                    ORDER BY ordinal_position
                """
        
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
            'query': query,
            'database_type': db_type
        }
        
    except Exception as e:
        frappe.log_error(f"Error executing SQL query: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'query': query
        }

# Keep the other functions (scan_orphaned_tables, etc.) with minimal changes
# They use information_schema which works on both databases

@frappe.whitelist()
def scan_orphaned_tables():
    """Scan for tables that exist in database but have no DocType definition"""
    try:
        db_type = get_db_type()
        orphaned_tables = []
        
        # Get all tables that start with 'tab' (DocType tables) - database agnostic
        if db_type == 'postgres':
            all_tables = frappe.db.sql("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = current_schema()
                AND table_name LIKE 'tab%'
                ORDER BY table_name
            """, as_dict=True)
        else:
            all_tables = frappe.db.sql("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                AND table_name LIKE 'tab%'
                ORDER BY table_name
            """, as_dict=True)
        
        # Get all registered DocTypes
        registered_doctypes = frappe.db.sql("""
            SELECT name FROM "tabDocType" 
        """ if db_type == 'postgres' else """
            SELECT name FROM `tabDocType`
        """, as_dict=True)
        
        # Create a set of registered DocType names for faster lookup
        registered_names = {dt['name'] for dt in registered_doctypes}
        
        # Check each table to see if it has a corresponding DocType
        for table in all_tables:
            table_name = table['table_name']
            
            # Extract DocType name from table name (remove 'tab' prefix)
            if table_name.startswith('tab'):
                doctype_name = table_name[3:]  # Remove 'tab' prefix
                
                # Skip system tables
                if doctype_name in ['Singles', 'Deleted Documents', 'Version', 'Activity Log']:
                    continue
                
                # Check if DocType exists
                if doctype_name not in registered_names:
                    # Get table row count
                    try:
                        if db_type == 'postgres':
                            count_result = frappe.db.sql('SELECT COUNT(*) as count FROM "{}"'.format(table_name), as_dict=True)
                        else:
                            escaped_table = table_name.replace('`', '``')
                            count_result = frappe.db.sql("SELECT COUNT(*) as count FROM `{}`".format(escaped_table), as_dict=True)
                        
                        row_count = count_result[0]['count'] if count_result else 0
                        
                        orphaned_tables.append({
                            'table_name': table_name,
                            'doctype_name': doctype_name,
                            'row_count': row_count,
                            'reason': 'No corresponding DocType found'
                        })
                    except Exception as e:
                        # If we can't count rows, still mark as orphaned
                        orphaned_tables.append({
                            'table_name': table_name,
                            'doctype_name': doctype_name,
                            'row_count': 'Unknown',
                            'reason': f'No DocType found, count error: {str(e)[:50]}'
                        })
        
        return {
            'success': True,
            'orphaned_tables': orphaned_tables,
            'total_count': len(orphaned_tables),
            'scan_summary': f"Found {len(orphaned_tables)} orphaned tables in {db_type} database",
            'database_type': db_type
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Scan error: {str(e)[:100]}"
        }

@frappe.whitelist()
def scan_orphaned_fields():
    """Scan for fields that exist in database tables but not in DocType definitions"""
    try:
        db_type = get_db_type()
        orphaned_fields = []
        
        # Get all DocTypes
        doctypes = frappe.get_all("DocType", fields=["name", "custom"], filters={"istable": 0})
        
        for doctype_info in doctypes:
            doctype_name = doctype_info['name']
            table_name = f"tab{doctype_name}"
            
            # Check if table exists - database agnostic
            if db_type == 'postgres':
                table_exists = frappe.db.sql("""
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = current_schema() 
                    AND table_name = %s
                """, (table_name,))
            else:
                table_exists = frappe.db.sql("SHOW TABLES LIKE %s", (table_name,))
            
            if not table_exists:
                continue
            
            try:
                # Get actual columns from database table
                if db_type == 'postgres':
                    actual_columns = frappe.db.sql("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = current_schema() 
                        AND table_name = %s
                    """, (table_name,), as_dict=True)
                else:
                    desc_result = frappe.db.sql(f"DESCRIBE `{table_name}`", as_dict=True)
                    actual_columns = [{"column_name": col["Field"]} for col in desc_result]
                
                # Get defined fields using Frappe's own method to get table columns
                # This should be the most accurate way to determine what fields SHOULD exist
                try:
                    from frappe.model.meta import get_table_columns
                    defined_fields = set(get_table_columns(doctype_name))
                except:
                    # Fallback to manual method if get_table_columns doesn't work
                    defined_fields = set()
                    
                    # Standard DocType fields
                    meta = frappe.get_meta(doctype_name)
                    for field in meta.fields:
                        defined_fields.add(field.fieldname)
                    
                    # Add standard fields that all DocTypes have
                    # This is the comprehensive list of standard fields that Frappe adds automatically
                    standard_fields = {
                        # Core DocType fields
                        'name', 'owner', 'creation', 'modified', 'modified_by', 
                        'docstatus', 'parent', 'parentfield', 'parenttype', 'idx',
                        
                        # System fields added by Frappe
                        '_user_tags', '_comments', '_assign', '_liked_by',
                        
                        # Communication and tracking fields
                        '_seen', 'reference_doctype', 'reference_name',
                        
                        # Workflow and automation fields
                        'workflow_state', '_action',
                        
                        # Version control
                        '_version',
                        
                        # Additional system fields that may appear
                        'is_cancelled', 'amended_from'
                    }
                    defined_fields.update(standard_fields)
                    
                    # Custom fields
                    custom_fields = frappe.get_all("Custom Field", 
                        filters={"dt": doctype_name}, 
                        fields=["fieldname"])
                    for cf in custom_fields:
                        defined_fields.add(cf.fieldname)
                
                # Find orphaned fields
                for col in actual_columns:
                    column_name = col["column_name"]
                    if column_name not in defined_fields:
                        # Get column details
                        if db_type == 'postgres':
                            col_details = frappe.db.sql("""
                                SELECT data_type, is_nullable, column_default
                                FROM information_schema.columns 
                                WHERE table_schema = current_schema() 
                                AND table_name = %s AND column_name = %s
                            """, (table_name, column_name), as_dict=True)
                        else:
                            col_details = frappe.db.sql(f"""
                                SELECT COLUMN_TYPE as data_type, IS_NULLABLE as is_nullable, COLUMN_DEFAULT as column_default
                                FROM information_schema.columns 
                                WHERE table_schema = DATABASE() 
                                AND table_name = %s AND column_name = %s
                            """, (table_name, column_name), as_dict=True)
                        
                        detail = col_details[0] if col_details else {}
                        
                        orphaned_fields.append({
                            'doctype': doctype_name,
                            'table_name': table_name,
                            'field_name': column_name,
                            'field_type': detail.get('data_type', 'Unknown'),
                            'nullable': detail.get('is_nullable', 'Unknown'),
                            'default_value': detail.get('column_default', None),
                            'is_custom_doctype': doctype_info.get('custom', 0)
                        })
                        
            except Exception as field_error:
                # If we can't analyze a specific DocType, continue with others
                print(f"Error analyzing {doctype_name}: {str(field_error)}", flush=True)
                continue
        
        return {
            'success': True,
            'orphaned_fields': orphaned_fields,
            'total_count': len(orphaned_fields),
            'scan_summary': f"Found {len(orphaned_fields)} orphaned fields across {len(doctypes)} DocTypes in {db_type} database",
            'database_type': db_type
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Orphaned fields scan error: {str(e)[:100]}"
        }

@frappe.whitelist()
def delete_orphaned_field(doctype_name, field_name, confirm_delete=False):
    """Delete an orphaned field from database table"""
    try:
        if not confirm_delete:
            return {
                'success': False,
                'error': 'Deletion not confirmed'
            }
        
        db_type = get_db_type()
        table_name = f"tab{doctype_name}"
        
        # Validate inputs
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', doctype_name):
            raise ValueError(f"Invalid DocType name: {doctype_name}")
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', field_name):
            raise ValueError(f"Invalid field name: {field_name}")
        
        # Execute DROP COLUMN
        if db_type == 'postgres':
            frappe.db.sql(f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{field_name}"')
        else:
            frappe.db.sql(f"ALTER TABLE `{table_name}` DROP COLUMN `{field_name}`")
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully deleted orphaned field {field_name} from {table_name}'
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'error': f"Failed to delete orphaned field: {str(e)}"
        }

@frappe.whitelist()
def delete_orphaned_table(table_name, confirm_delete=False):
    """Delete an orphaned table from database"""
    try:
        if not confirm_delete:
            return {
                'success': False,
                'error': 'Deletion not confirmed'
            }
        
        db_type = get_db_type()
        
        # Validate table name
        if not re.match(r'^tab[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Execute DROP TABLE
        if db_type == 'postgres':
            frappe.db.sql(f'DROP TABLE IF EXISTS "{table_name}"')
        else:
            escaped_table = table_name.replace('`', '``')
            frappe.db.sql(f"DROP TABLE `{escaped_table}`")
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully deleted orphaned table {table_name}'
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'error': f"Failed to delete orphaned table: {str(e)}"
        }

@frappe.whitelist()
def register_orphaned_table_as_doctype(table_name, doctype_name=None, confirm_register=False):
    """Register an orphaned table as a proper Frappe DocType"""
    try:
        if not confirm_register:
            return {
                'success': False,
                'error': 'Registration not confirmed'
            }
        
        db_type = get_db_type()
        
        # Validate table name
        if not re.match(r'^tab[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', table_name):
            raise ValueError(f"Invalid table name format: {table_name}")
        
        # Extract DocType name from table name if not provided
        if not doctype_name:
            doctype_name = table_name[3:]  # Remove 'tab' prefix
        
        # Validate DocType name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_\s\+\-]*$', doctype_name):
            raise ValueError(f"Invalid DocType name format: {doctype_name}")
        
        # Check if DocType already exists
        if frappe.db.exists("DocType", doctype_name):
            return {
                'success': False,
                'error': f'DocType "{doctype_name}" already exists'
            }
        
        # Check if table exists
        if db_type == 'postgres':
            table_exists = frappe.db.sql("""
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = current_schema() 
                AND table_name = %s
            """, (table_name,))
        else:
            table_exists = frappe.db.sql("SHOW TABLES LIKE %s", (table_name,))
        
        if not table_exists:
            raise ValueError(f"Table {table_name} does not exist")
        
        # Get table structure to create DocType fields
        if db_type == 'postgres':
            columns = frappe.db.sql("""
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns 
                WHERE table_schema = current_schema() 
                AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,), as_dict=True)
        else:
            desc_result = frappe.db.sql(f"DESCRIBE `{table_name}`", as_dict=True)
            columns = [{
                'column_name': col['Field'], 
                'data_type': col['Type'], 
                'is_nullable': col['Null'],
                'column_default': col['Default'],
                'character_maximum_length': None
            } for col in desc_result]
        
        # Create DocType structure
        doctype_doc = frappe.get_doc({
            'doctype': 'DocType',
            'name': doctype_name,
            'module': 'Flansa Generated',  # Use a specific module for registered tables
            'custom': 1,
            'is_submittable': 0,
            'track_changes': 1,
            'allow_rename': 1,
            'sort_field': 'modified',
            'sort_order': 'DESC',
            'fields': []
        })
        
        # Define standard fields that should be skipped
        standard_fields = {
            'name', 'owner', 'creation', 'modified', 'modified_by', 
            'docstatus', 'parent', 'parentfield', 'parenttype', 'idx',
            '_user_tags', '_comments', '_assign', '_liked_by', '_seen',
            'reference_doctype', 'reference_name', 'workflow_state', 
            '_action', '_version', 'is_cancelled', 'amended_from'
        }
        
        # Add fields based on table structure
        field_idx = 1
        for col in columns:
            fieldname = col['column_name']
            
            # Skip standard fields
            if fieldname in standard_fields:
                continue
            
            # Determine fieldtype based on data type
            data_type = col['data_type'].lower()
            fieldtype = 'Data'  # Default
            options = None
            precision = None
            
            if 'varchar' in data_type or 'char' in data_type:
                fieldtype = 'Data'
            elif 'text' in data_type or 'longtext' in data_type:
                fieldtype = 'Text Editor' if 'longtext' in data_type else 'Small Text'
            elif 'int' in data_type or 'bigint' in data_type:
                fieldtype = 'Int'
            elif 'decimal' in data_type or 'numeric' in data_type:
                fieldtype = 'Currency'
                precision = 2
            elif 'float' in data_type or 'double' in data_type:
                fieldtype = 'Float'
                precision = 2
            elif 'date' in data_type and 'datetime' not in data_type:
                fieldtype = 'Date'
            elif 'datetime' in data_type or 'timestamp' in data_type:
                fieldtype = 'Datetime'
            elif 'json' in data_type or 'jsonb' in data_type:
                fieldtype = 'JSON'
            elif 'boolean' in data_type or 'tinyint(1)' in data_type:
                fieldtype = 'Check'
            
            # Create field definition
            field_dict = {
                'fieldname': fieldname,
                'fieldtype': fieldtype,
                'label': fieldname.replace('_', ' ').title(),
                'idx': field_idx,
                'reqd': 1 if col['is_nullable'] == 'NO' and fieldname != 'name' else 0,
                'in_list_view': 1 if field_idx <= 5 else 0,  # Show first 5 fields in list view
                'in_standard_filter': 1 if field_idx <= 3 else 0  # Add first 3 as filters
            }
            
            # Add precision for numeric fields
            if precision is not None:
                field_dict['precision'] = precision
            
            # Add options if needed
            if options:
                field_dict['options'] = options
            
            doctype_doc.append('fields', field_dict)
            field_idx += 1
        
        # Add a few permissions for System Manager
        doctype_doc.append('permissions', {
            'role': 'System Manager',
            'read': 1,
            'write': 1,
            'create': 1,
            'delete': 1,
            'submit': 0,
            'cancel': 0,
            'amend': 0
        })
        
        # Insert the DocType
        doctype_doc.flags.ignore_validate = True
        doctype_doc.flags.ignore_links = True
        doctype_doc.flags.ignore_permissions = True
        doctype_doc.insert(ignore_permissions=True)
        
        # Important: Don't sync to database as table already exists
        # Just save the DocType definition
        frappe.db.commit()
        
        # Clear cache to make new DocType available
        frappe.clear_cache(doctype=doctype_name)
        
        # Step 4: Update Flansa Table reference if it exists
        flansa_table_updated = False
        try:
            # Look for Flansa Table records that might reference this table
            flansa_tables = frappe.db.sql("""
                SELECT name, table_name 
                FROM `tabFlansa Table` 
                WHERE table_name = %s 
                AND (doctype_name IS NULL OR doctype_name = '')
            """, (table_name,), as_dict=True)
            
            if flansa_tables:
                for ft in flansa_tables:
                    frappe.db.sql("""
                        UPDATE `tabFlansa Table` 
                        SET doctype_name = %s 
                        WHERE name = %s
                    """, (doctype_name, ft.name))
                    flansa_table_updated = True
                
                frappe.db.commit()
                
        except Exception as flansa_update_error:
            # Don't fail the main operation if Flansa Table update fails
            print(f"Warning: Could not update Flansa Table reference: {str(flansa_update_error)}", flush=True)
        
        success_message = f'Successfully registered table "{table_name}" as DocType "{doctype_name}" with {len(columns)} fields'
        if flansa_table_updated:
            success_message += f'. Also updated {len(flansa_tables)} Flansa Table reference(s) - now visible in visual builder!'
        
        return {
            'success': True,
            'message': success_message,
            'doctype_name': doctype_name,
            'fields_count': len([f for f in columns if f['column_name'] not in standard_fields]),
            'flansa_table_updated': flansa_table_updated
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'error': f"Failed to register table as DocType: {str(e)}"
        }

@frappe.whitelist()
def fix_flansa_table_references():
    """Fix Flansa Table doctype references that were cleared after redeployment"""
    try:
        # Get all Flansa Tables with missing doctype references
        flansa_tables = frappe.db.sql("""
            SELECT name, table_name, doctype_name
            FROM `tabFlansa Table`
            WHERE (doctype_name IS NULL OR doctype_name = '')
            AND table_name IS NOT NULL 
            AND table_name != ''
            ORDER BY name
        """, as_dict=True)
        
        if not flansa_tables:
            return {
                'success': True,
                'message': 'No Flansa Tables found with missing doctype references',
                'fixed_count': 0,
                'total_count': 0
            }
        
        # Get all registered DocTypes
        registered_doctypes = frappe.db.sql("""
            SELECT name FROM `tabDocType`
            WHERE custom = 1 OR module LIKE '%Flansa%'
            ORDER BY name
        """, as_dict=True)
        
        doctype_names = {dt.name for dt in registered_doctypes}
        
        # Match and fix references
        fixed_count = 0
        for ft in flansa_tables:
            table_name = ft.table_name
            flansa_table_name = ft.name
            
            # Try to determine the correct DocType name
            if table_name.startswith('tab'):
                potential_doctype = table_name[3:]  # Remove 'tab' prefix
                
                # Try exact match first
                if potential_doctype in doctype_names:
                    frappe.db.sql("""
                        UPDATE `tabFlansa Table` 
                        SET doctype_name = %s 
                        WHERE name = %s
                    """, (potential_doctype, flansa_table_name))
                    fixed_count += 1
                    continue
                
                # Try variations
                variations = [
                    potential_doctype.replace('_', ' '),  # Underscore to space
                    potential_doctype.replace(' ', '_'),  # Space to underscore
                    potential_doctype.title(),            # Title case
                    potential_doctype.replace('_', ''),   # Remove underscores
                ]
                
                for variation in variations:
                    if variation in doctype_names:
                        frappe.db.sql("""
                            UPDATE `tabFlansa Table` 
                            SET doctype_name = %s 
                            WHERE name = %s
                        """, (variation, flansa_table_name))
                        fixed_count += 1
                        break
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully fixed {fixed_count} out of {len(flansa_tables)} Flansa Table doctype references',
            'fixed_count': fixed_count,
            'total_count': len(flansa_tables),
            'remaining': len(flansa_tables) - fixed_count
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'error': f"Failed to fix Flansa Table references: {str(e)}"
        }
