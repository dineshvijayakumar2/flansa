#!/usr/bin/env python3
"""
Fix Frappe's bug where it uses db_name as the user instead of db_user
Frappe incorrectly assumes user == db_name for PostgreSQL
"""
import os
import sys

print("🎯 Fixing Frappe's db_name/db_user bug", flush=True)

# Add Frappe to path
sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')

try:
    import frappe
    
    # Patch the connect function
    original_connect = frappe.connect
    
    def patched_connect(site=None, db_name=None, set_admin_as_user=True):
        """Patched connect that ensures db_user is used instead of db_name"""
        # Call original to set up config
        if site:
            frappe.init(site)
        
        # Fix the config to ensure db_user is set correctly
        if hasattr(frappe.local, 'conf'):
            # Get the correct user from environment or config
            correct_user = os.environ.get('DB_USER') or os.environ.get('PGUSER', 'postgres')
            
            # Ensure db_user is set in config
            if not hasattr(frappe.local.conf, 'db_user') or frappe.local.conf.db_user != correct_user:
                print(f"🔧 Setting frappe.local.conf.db_user to '{correct_user}'", flush=True)
                frappe.local.conf.db_user = correct_user
        
        # Now call the original connect with fixed config
        from frappe.database import get_db
        
        frappe.local.db = get_db(
            socket=frappe.local.conf.db_socket,
            host=frappe.local.conf.db_host,
            port=frappe.local.conf.db_port,
            user=frappe.local.conf.db_user,  # Use db_user, not db_name!
            password=frappe.local.conf.db_password,
            cur_db_name=frappe.local.conf.db_name or db_name,
        )
        frappe.local.db.connect()
        
        if set_admin_as_user:
            frappe.set_user("Administrator")
        
        return frappe.local.db
    
    # Replace the connect function
    frappe.connect = patched_connect
    print("✅ Frappe.connect patched to use db_user instead of db_name", flush=True)
    
except Exception as e:
    print(f"⚠️ Could not patch Frappe connect: {e}", flush=True)

print("🚀 Frappe user bug fix applied", flush=True)