#!/usr/bin/env python3
"""
Ultimate PostgreSQL user fix - Patch at module import level
This gets applied before Frappe even loads its configuration
"""
import sys
import os

# Set environment variables that Frappe MUST use
os.environ['DB_USER'] = 'postgres'
os.environ['PGUSER'] = 'postgres'
os.environ['DATABASE_USER'] = 'postgres'
os.environ['FRAPPE_DB_USER'] = 'postgres'

print("🔧 Environment variables forced to postgres user")

# Monkey patch psycopg2 itself to always use postgres user
try:
    import psycopg2
    
    # Store original connect function
    original_connect = psycopg2.connect
    
    def forced_connect(*args, **kwargs):
        """Force postgres user in any psycopg2 connection"""
        # Always override user to postgres
        if 'user' in kwargs:
            print(f"🔧 Overriding user '{kwargs['user']}' with 'postgres'")
            kwargs['user'] = 'postgres'
        
        # Also check positional connection string
        if args and len(args) > 0 and isinstance(args[0], str):
            dsn = args[0]
            if 'user=' in dsn:
                import re
                dsn = re.sub(r'user=\w+', 'user=postgres', dsn)
                args = (dsn,) + args[1:]
                print(f"🔧 Overriding DSN user with postgres")
        
        return original_connect(*args, **kwargs)
    
    # Replace psycopg2.connect globally
    psycopg2.connect = forced_connect
    
    print("✅ psycopg2.connect patched to force postgres user")
    
except ImportError:
    print("⚠️ psycopg2 not available for patching")

print("🚀 All database user patches applied")