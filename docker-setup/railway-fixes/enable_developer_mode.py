#!/usr/bin/env python3
"""
Enable Developer Mode on Railway Site
"""

import frappe
import os
import json

print("🛠️  ENABLING DEVELOPER MODE ON RAILWAY", flush=True)
print("=" * 50, flush=True)

try:
    print("🔍 Step 1: Checking current developer mode status...", flush=True)
    
    # Check current site config
    site_config_path = f"/home/frappe/frappe-bench/sites/{frappe.local.site}/site_config.json"
    
    if os.path.exists(site_config_path):
        with open(site_config_path, 'r') as f:
            config = json.load(f)
        
        current_dev_mode = config.get('developer_mode', 0)
        print(f"Current developer_mode: {current_dev_mode}", flush=True)
    else:
        print("❌ site_config.json not found", flush=True)
        config = {}
    
    print("🔍 Step 2: Enabling developer mode...", flush=True)
    
    # Enable developer mode
    config['developer_mode'] = 1
    
    # Write back to site_config.json
    with open(site_config_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print("✅ Developer mode enabled in site_config.json", flush=True)
    
    print("🔍 Step 3: Updating Frappe configuration...", flush=True)
    
    # Also set via frappe.conf
    frappe.conf.developer_mode = 1
    
    print("✅ Developer mode set in frappe.conf", flush=True)
    
    print("🔍 Step 4: Clearing cache to apply changes...", flush=True)
    
    # Clear cache
    frappe.clear_cache()
    
    print("✅ Cache cleared", flush=True)
    
    print("🔍 Step 5: Verifying developer mode is active...", flush=True)
    
    # Check if developer mode is now active
    dev_mode_active = frappe.conf.get('developer_mode', 0)
    print(f"Developer mode status: {dev_mode_active}", flush=True)
    
    if dev_mode_active:
        print("✅ Developer mode successfully enabled!", flush=True)
        
        print("\n📋 Developer mode benefits:", flush=True)
        print("   - JavaScript/CSS changes load without build", flush=True)
        print("   - DocType changes apply immediately", flush=True)
        print("   - Better error messages and debugging", flush=True)
        print("   - Frappe navigation bar visible", flush=True)
        
        print("\n⚠️  Important notes:", flush=True)
        print("   - Performance may be slower in dev mode", flush=True)
        print("   - Use only for development/testing", flush=True)
        print("   - Restart bench process to fully apply", flush=True)
        
    else:
        print("❌ Developer mode activation failed", flush=True)
        
        print("\n🔧 Manual steps to try:", flush=True)
        print("1. Add to site_config.json: {'developer_mode': 1}", flush=True)
        print("2. Run: bench --site mysite.local set-config developer_mode 1", flush=True)
        print("3. Restart the bench process", flush=True)
    
    print(f"\n🎉 Developer mode setup completed!", flush=True)
    
except Exception as e:
    print(f"❌ Error enabling developer mode: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Details: {traceback.format_exc()}", flush=True)