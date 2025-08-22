#!/usr/bin/env python3
"""
Patch Frappe's database configuration at import time
Ensures correct password is always used
"""
import os
import sys

# Get correct credentials from environment
DB_USER = os.environ.get('DB_USER', os.environ.get('PGUSER', 'railway'))
DB_PASSWORD = os.environ.get('DB_PASSWORD', os.environ.get('PGPASSWORD', ''))
DB_HOST = os.environ.get('DB_HOST', os.environ.get('PGHOST', 'postgres.railway.internal'))
DB_PORT = int(os.environ.get('DB_PORT', os.environ.get('PGPORT', '5432')))
DB_NAME = os.environ.get('DB_NAME', os.environ.get('PGDATABASE', 'railway'))

print(f"🔧 Patching Frappe DB with user: {DB_USER}, host: {DB_HOST}", flush=True)

# Add Frappe to path
sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')

try:
    # Import and patch frappe's get_site_config
    import frappe
    
    original_get_site_config = frappe.get_site_config
    
    def patched_get_site_config(*args, **kwargs):
        """Always return correct database credentials"""
        config = original_get_site_config(*args, **kwargs)
        
        # Force correct credentials
        if config:
            config['db_user'] = DB_USER
            config['db_password'] = DB_PASSWORD
            config['db_host'] = DB_HOST
            config['db_port'] = DB_PORT
            config['db_name'] = DB_NAME
            config['db_type'] = 'postgres'
            print(f"✅ Patched site config with correct credentials", flush=True)
        
        return config
    
    frappe.get_site_config = patched_get_site_config
    print("✅ Frappe get_site_config patched", flush=True)
    
    # Also patch conf module if it exists
    if hasattr(frappe, 'conf'):
        frappe.conf.db_user = DB_USER
        frappe.conf.db_password = DB_PASSWORD
        frappe.conf.db_host = DB_HOST
        frappe.conf.db_port = DB_PORT
        frappe.conf.db_name = DB_NAME
        print("✅ Frappe conf patched", flush=True)
        
except Exception as e:
    print(f"⚠️ Could not patch Frappe: {e}", flush=True)

print("🚀 Database patches applied", flush=True)