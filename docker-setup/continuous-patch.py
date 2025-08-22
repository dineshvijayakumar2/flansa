#!/usr/bin/env python3
"""
Continuous database user patch
Runs in background to continuously monitor and fix database connections
"""
import sys
import os
import time
import threading

def continuous_db_patch():
    """Continuously monitor and patch database connections"""
    print("🎯 Starting continuous database patch monitor", flush=True)
    
    while True:
        try:
            # Import frappe after it's available
            sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')
            import frappe
            
            # Check and patch current database connection
            if hasattr(frappe, 'local') and hasattr(frappe.local, 'db') and frappe.local.db:
                if hasattr(frappe.local.db, 'user') and frappe.local.db.user != 'postgres':
                    print(f"🔧 Continuous patch: Fixing db user '{frappe.local.db.user}' -> 'postgres'", flush=True)
                    frappe.local.db.user = 'postgres'
                    frappe.local.db.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                    frappe.local.db.port = int(os.environ.get('PGPORT', '5432'))
                    frappe.local.db.password = os.environ.get('PGPASSWORD', '')
                    
                    # Force reconnection
                    try:
                        if hasattr(frappe.local.db, '_conn') and frappe.local.db._conn:
                            frappe.local.db.close()
                            frappe.local.db.connect()
                            print("✅ Forced reconnection successful", flush=True)
                    except Exception as e:
                        print(f"⚠️ Reconnection failed: {e}", flush=True)
            
            # Check global db instance too
            if hasattr(frappe, 'db') and frappe.db:
                if hasattr(frappe.db, 'user') and frappe.db.user != 'postgres':
                    print(f"🔧 Continuous patch: Fixing global db user '{frappe.db.user}' -> 'postgres'", flush=True)
                    frappe.db.user = 'postgres'
                    frappe.db.host = os.environ.get('PGHOST', 'postgres.railway.internal')
                    frappe.db.port = int(os.environ.get('PGPORT', '5432'))
                    frappe.db.password = os.environ.get('PGPASSWORD', '')
            
        except ImportError:
            # Frappe not ready yet
            pass
        except Exception as e:
            print(f"⚠️ Continuous patch error: {e}", flush=True)
        
        # Check every 5 seconds
        time.sleep(5)

def start_continuous_patch():
    """Start continuous patching in background thread"""
    patch_thread = threading.Thread(target=continuous_db_patch, daemon=True)
    patch_thread.start()
    print("✅ Continuous database patch started in background", flush=True)

if __name__ == "__main__":
    continuous_db_patch()