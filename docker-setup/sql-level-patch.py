#!/usr/bin/env python3
"""
SQL-level database connection patch
Patches Frappe's database.sql() method to force correct connection
"""
import sys
import os

print("🎯 SQL-Level Database Patch", flush=True)
print("=" * 50, flush=True)

# Set environment variables first
os.environ['PGUSER'] = 'postgres'
os.environ['DB_USER'] = 'postgres'

try:
    # Import Frappe database modules
    sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')
    
    import frappe.database.database as base_db
    import frappe.database.postgres.database as postgres_db
    
    # Store original sql method
    original_sql = base_db.Database.sql
    
    def patched_sql(self, query, values=None, *args, **kwargs):
        """Patch SQL execution to ensure correct connection"""
        print(f"🔧 SQL patch: Ensuring postgres connection", flush=True)
        
        # Force reconnection with correct credentials if needed
        if not hasattr(self, '_conn') or self._conn is None:
            print("🔧 No connection, forcing new connection with postgres user", flush=True)
            self.connect()
        
        try:
            return original_sql(self, query, values, *args, **kwargs)
        except Exception as e:
            if 'authentication failed for user "railway"' in str(e):
                print("🔧 Railway user auth failed, forcing postgres reconnection", flush=True)
                
                # Force new connection with postgres user
                self.close()
                
                # Override connection parameters
                if hasattr(self, 'db_name'):
                    print(f"🔧 Reconnecting to {self.db_name} with postgres user", flush=True)
                
                # Force correct parameters
                self.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                self.port = int(os.environ.get('PGPORT', '5432'))
                self.user = 'postgres'
                self.password = os.environ.get('PGPASSWORD', '')
                
                self.connect()
                return original_sql(self, query, values, *args, **kwargs)
            else:
                raise e
    
    # Apply patch to base Database class
    base_db.Database.sql = patched_sql
    print("✅ Database.sql() method patched", flush=True)
    
    # Also patch PostgresDatabase specifically
    original_connect = postgres_db.PostgresDatabase.connect
    
    def patched_connect(self):
        """Force postgres user in connection"""
        print("🔧 PostgresDatabase.connect() - forcing postgres user", flush=True)
        
        # Override user before connecting
        self.user = 'postgres'
        self.host = os.environ.get('PGHOST', 'postgres.railway.internal')
        self.port = int(os.environ.get('PGPORT', '5432'))
        self.password = os.environ.get('PGPASSWORD', '')
        
        return original_connect(self)
    
    postgres_db.PostgresDatabase.connect = patched_connect
    print("✅ PostgresDatabase.connect() patched", flush=True)
    
except Exception as e:
    print(f"❌ Patch failed: {e}", flush=True)
    import traceback
    print(f"🔍 Details: {traceback.format_exc()}", flush=True)

print("🚀 SQL-level patches applied", flush=True)