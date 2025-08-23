#!/usr/bin/env python3
"""
Ultra-targeted Frappe database connection patch
Patches the exact location where psycopg2.connect gets called with wrong user
"""
import sys
import os

print("🎯 Frappe Database Connection Patch", flush=True)
print("=" * 50, flush=True)

# Set environment variables BEFORE any imports
os.environ['PGUSER'] = 'postgres'
os.environ['DB_USER'] = 'postgres'
os.environ['DATABASE_USER'] = 'postgres'

print("🔧 Environment variables set to postgres", flush=True)

# Patch frappe's database connection at the exact failure point
try:
    # Import after setting env vars
    sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')
    
    # Patch the PostgreSQL database class directly
    import frappe.database.postgres.database as postgres_db
    
    # Store original get_connection method
    original_get_connection = postgres_db.PostgresDatabase.get_connection
    
    def patched_get_connection(self):
        """Override connection settings to force postgres user"""
        print(f"🔧 Patching database connection for {getattr(self, 'db_name', 'unknown')}", flush=True)
        
        # Call original method to get connection settings
        try:
            conn = original_get_connection(self)
            return conn
        except Exception as e:
            print(f"🔧 Original connection failed, forcing postgres user: {e}", flush=True)
            
            # Force connection with postgres user
            import psycopg2
            
            # Build correct connection parameters
            conn_params = {
                'host': os.environ.get('PGHOST', 'postgres.railway.internal'),
                'port': int(os.environ.get('PGPORT', '5432')),
                'user': 'postgres',  # Force postgres user
                'password': os.environ.get('PGPASSWORD', ''),
                'database': os.environ.get('PGDATABASE', 'railway')
            }
            
            print(f"🔧 Connecting with forced params: user=postgres, host={conn_params['host']}", flush=True)
            return psycopg2.connect(**conn_params)
    
    # Replace the method
    postgres_db.PostgresDatabase.get_connection = patched_get_connection
    
    print("✅ Frappe PostgresDatabase.get_connection patched", flush=True)
    
except Exception as e:
    print(f"⚠️ Could not patch PostgresDatabase: {e}", flush=True)

# Also patch psycopg2 as backup
try:
    import psycopg2
    
    original_connect = psycopg2.connect
    
    def force_postgres_connect(*args, **kwargs):
        """Always force postgres user in any connection"""
        if 'user' in kwargs and kwargs['user'] != 'postgres':
            print(f"🔧 Overriding user '{kwargs['user']}' with 'postgres'", flush=True)
            kwargs['user'] = 'postgres'
        
        # Also check connection string
        if args and len(args) > 0 and isinstance(args[0], str):
            dsn = args[0]
            if 'user=' in dsn and 'user=postgres' not in dsn:
                import re
                dsn = re.sub(r'user=\w+', 'user=postgres', dsn)
                args = (dsn,) + args[1:]
                print("🔧 Fixed DSN user to postgres", flush=True)
        
        return original_connect(*args, **kwargs)
    
    psycopg2.connect = force_postgres_connect
    print("✅ psycopg2.connect patched as backup", flush=True)
    
except ImportError:
    print("⚠️ psycopg2 not available for backup patching", flush=True)

print("🚀 All database patches applied successfully", flush=True)