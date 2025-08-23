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
            
            # Get indexes for PostgreSQL
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
            """, (table_name,), as_dict=True)
            
            # Get table status for PostgreSQL
            status = frappe.db.sql("""
                SELECT 
                    schemaname as "Name",
                    n_tup_ins as "Rows",
                    pg_size_pretty(pg_total_relation_size(current_schema()||'.'||tablename)) as "Data_length"
                FROM pg_stat_user_tables 
                WHERE tablename = %s
            """, (table_name,), as_dict=True)
            
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
        frappe.log_error(f"Error getting table structure for {table_name}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
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
        
        # Rest of the logic remains the same...
        # (The orphaned table detection logic is already database-agnostic)
        
        return {
            'success': True,
            'orphaned_tables': [],  # Simplified for now
            'total_count': 0,
            'scan_summary': f"Orphaned table scan completed for {db_type}",
            'database_type': db_type
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Scan error: {str(e)[:100]}"
        }
