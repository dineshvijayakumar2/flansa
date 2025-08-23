#!/usr/bin/env python3
"""
Bench startup connection patch
Final fallback that runs right before bench serve starts
"""
import sys
import os

print("🎯 Bench Startup Connection Patch", flush=True)
print("=" * 50, flush=True)

# Ensure environment is set
os.environ['PGUSER'] = 'postgres'
os.environ['DB_USER'] = 'postgres'

try:
    # Add frappe to path
    sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')
    
    # Import frappe
    import frappe
    
    # Patch frappe.init() to override site config after loading
    original_init = frappe.init
    
    def patched_init(site=None, *args, **kwargs):
        """Override site config after frappe.init()"""
        result = original_init(site, *args, **kwargs)
        
        if frappe.conf:
            print("🔧 Overriding frappe.conf database settings", flush=True)
            frappe.conf.db_user = 'postgres'
            frappe.conf.db_host = os.environ.get('PGHOST', 'postgres.railway.internal')
            frappe.conf.db_port = int(os.environ.get('PGPORT', '5432'))
            frappe.conf.db_password = os.environ.get('PGPASSWORD', '')
            frappe.conf.db_name = 'railway'
            print("✅ frappe.conf overridden with postgres user", flush=True)
        
        return result
    
    frappe.init = patched_init
    print("✅ frappe.init() patched", flush=True)
    
    # Also patch get_db_connection directly
    if hasattr(frappe, 'get_db'):
        original_get_db = frappe.get_db
        
        def patched_get_db():
            """Override database connection"""
            db = original_get_db()
            if hasattr(db, 'user') and db.user != 'postgres':
                print(f"🔧 Overriding db.user from '{db.user}' to 'postgres'", flush=True)
                db.user = 'postgres'
                db.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                db.port = int(os.environ.get('PGPORT', '5432'))
                db.password = os.environ.get('PGPASSWORD', '')
            return db
        
        frappe.get_db = patched_get_db
        print("✅ frappe.get_db() patched", flush=True)
    
except Exception as e:
    print(f"❌ Startup patch failed: {e}", flush=True)
    import traceback
    print(f"🔍 Details: {traceback.format_exc()}", flush=True)

print("🚀 Bench startup patches applied", flush=True)