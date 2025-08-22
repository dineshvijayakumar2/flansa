#!/usr/bin/env python3
"""
Runtime database patch that works after Frappe is loaded
Runs after bench starts but patches connections on-the-fly
"""
import os
import sys

def patch_database_connections():
    """Patch database connections at runtime"""
    print("🎯 Runtime Database Connection Patch", flush=True)
    print("=" * 50, flush=True)
    
    try:
        # Only import after Frappe environment is ready
        import frappe
        
        # Patch the site configuration loading
        original_get_site_config = frappe.get_site_config
        
        def patched_get_site_config(site_name=None):
            """Override site config to force postgres user"""
            config = original_get_site_config(site_name)
            
            if config and isinstance(config, dict):
                print(f"🔧 Overriding site config db_user to postgres", flush=True)
                config['db_user'] = 'postgres'
                config['db_host'] = os.environ.get('PGHOST', 'postgres.railway.internal')
                config['db_port'] = int(os.environ.get('PGPORT', '5432'))
                config['db_password'] = os.environ.get('PGPASSWORD', '')
                config['db_name'] = 'railway'
                config['db_type'] = 'postgres'
            
            return config
        
        frappe.get_site_config = patched_get_site_config
        print("✅ frappe.get_site_config patched", flush=True)
        
        return True
        
    except Exception as e:
        print(f"⚠️ Runtime patch not ready yet: {e}", flush=True)
        return False

if __name__ == "__main__":
    patch_database_connections()