#!/usr/bin/env python3
"""
Post-startup database connection patch
Runs after Frappe server starts to patch active connections
"""
import sys
import os
import time

def apply_post_startup_patch():
    """Apply patches after Frappe is fully loaded"""
    print("🎯 Post-Startup Database Patch", flush=True)
    print("=" * 50, flush=True)
    
    # Wait a moment for Frappe to fully initialize
    time.sleep(2)
    
    try:
        # Now Frappe should be available
        import frappe
        
        # Patch frappe.db when it gets created
        if hasattr(frappe.local, 'db') and frappe.local.db:
            print("🔧 Patching existing frappe.local.db connection", flush=True)
            if hasattr(frappe.local.db, 'user'):
                old_user = frappe.local.db.user
                frappe.local.db.user = 'postgres'
                frappe.local.db.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                frappe.local.db.port = int(os.environ.get('PGPORT', '5432'))
                frappe.local.db.password = os.environ.get('PGPASSWORD', '')
                print(f"✅ Changed db user from '{old_user}' to 'postgres'", flush=True)
        
        # Patch the database creation function
        original_get_db = frappe.get_db
        
        def patched_get_db(*args, **kwargs):
            """Force postgres user in get_db"""
            db = original_get_db(*args, **kwargs)
            if hasattr(db, 'user') and db.user != 'postgres':
                print(f"🔧 Runtime: Changing db user from '{db.user}' to 'postgres'", flush=True)
                db.user = 'postgres'
                db.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                db.port = int(os.environ.get('PGPORT', '5432'))
                db.password = os.environ.get('PGPASSWORD', '')
                # Force reconnection if needed
                if hasattr(db, '_conn') and db._conn:
                    try:
                        db.close()
                        db.connect()
                        print("✅ Forced reconnection with postgres user", flush=True)
                    except:
                        pass
            return db
        
        frappe.get_db = patched_get_db
        print("✅ frappe.get_db() patched for runtime", flush=True)
        
        # Also patch any existing database instances
        if hasattr(frappe, 'db') and frappe.db:
            if hasattr(frappe.db, 'user') and frappe.db.user != 'postgres':
                print(f"🔧 Patching frappe.db user from '{frappe.db.user}' to 'postgres'", flush=True)
                frappe.db.user = 'postgres'
                frappe.db.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                frappe.db.port = int(os.environ.get('PGPORT', '5432'))
                frappe.db.password = os.environ.get('PGPASSWORD', '')
        
        return True
        
    except Exception as e:
        print(f"⚠️ Post-startup patch failed: {e}", flush=True)
        return False

if __name__ == "__main__":
    apply_post_startup_patch()