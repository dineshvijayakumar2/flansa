#!/usr/bin/env python3
"""
Database connection patch for Railway deployment
Forces PostgreSQL connection to use correct user
"""

import frappe
import os

def patch_db_connection():
    """Force correct PostgreSQL connection parameters"""
    
    # Override frappe.conf with correct database settings
    frappe.conf.db_host = os.getenv('PGHOST', 'postgres.railway.internal')
    frappe.conf.db_port = int(os.getenv('PGPORT', '5432'))
    frappe.conf.db_name = 'railway'
    frappe.conf.db_user = 'postgres'  # Force postgres user
    frappe.conf.db_password = os.getenv('PGPASSWORD')
    frappe.conf.db_type = 'postgres'
    
    print(f"🔧 Database connection patched: {frappe.conf.db_user}@{frappe.conf.db_host}")

# Monkey patch the database connection function
def patched_get_connection(self):
    """Patched get_connection that forces correct user"""
    import psycopg2
    
    # Force correct connection settings
    conn_settings = {
        'host': os.getenv('PGHOST', 'postgres.railway.internal'),
        'port': int(os.getenv('PGPORT', '5432')),
        'user': 'postgres',  # Always use postgres
        'password': os.getenv('PGPASSWORD'),
        'dbname': 'railway'
    }
    
    print(f"🔧 Connecting with: user={conn_settings['user']}, host={conn_settings['host']}")
    return psycopg2.connect(**conn_settings)

# Apply the patch
if __name__ == "__main__":
    try:
        # Patch frappe's PostgreSQL database class
        from frappe.database.postgres.database import PostgresDatabase
        PostgresDatabase.get_connection = patched_get_connection
        print("✅ Database connection monkey-patched successfully")
    except Exception as e:
        print(f"⚠️ Monkey patch failed: {e}")