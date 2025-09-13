#!/usr/bin/env python3
"""
Update Site Config for S3 Configuration
Adds missing S3 settings to site_config.json
"""
import frappe
import json
import os
from datetime import datetime

print("🔧 UPDATING SITE CONFIG FOR S3", flush=True)
frappe.msgprint("🔧 UPDATING SITE CONFIG FOR S3")
print("=" * 50, flush=True)

try:
    print("Step 1: Reading current site configuration...", flush=True)
    frappe.msgprint("Step 1: Reading current site configuration...")
    
    # Get current site config
    site_config_path = frappe.get_site_path('site_config.json')
    
    # Read existing config
    try:
        with open(site_config_path, 'r') as f:
            site_config = json.load(f)
        print(f"✅ Site config loaded from: {site_config_path}", flush=True)
        frappe.msgprint(f"✅ Site config loaded from: {site_config_path}")
    except Exception as config_error:
        site_config = {}
        print(f"⚠️  Creating new site config: {str(config_error)}", flush=True)
        frappe.msgprint(f"⚠️  Creating new site config: {str(config_error)}")
    
    print("\n📋 CURRENT S3 CONFIGURATION:", flush=True)
    print("-" * 50, flush=True)
    current_s3_settings = {
        's3_bucket': site_config.get('s3_bucket'),
        's3_region': site_config.get('s3_region'),
        's3_folder_path': site_config.get('s3_folder_path'),
        'use_s3': site_config.get('use_s3'),
        'use_s3_for_private_files': site_config.get('use_s3_for_private_files'),
        'use_s3_for_public_files': site_config.get('use_s3_for_public_files'),
        's3_access_key_id': site_config.get('s3_access_key_id'),
        's3_secret_access_key': site_config.get('s3_secret_access_key'),
        'max_file_size': site_config.get('max_file_size')
    }
    
    for key, value in current_s3_settings.items():
        if key in ['s3_secret_access_key'] and value:
            print(f"{key}: ***HIDDEN***", flush=True)
        else:
            print(f"{key}: {value}", flush=True)
    
    print("\nStep 2: Applying required S3 configuration updates...", flush=True)
    frappe.msgprint("Step 2: Applying required S3 configuration updates...")
    
    # Required S3 configuration
    required_updates = {
        "s3_bucket": "flansa",
        "s3_region": "us-east-1",
        "s3_folder_path": "flansa-files", 
        "use_s3": 1,
        "use_s3_for_private_files": True,
        "use_s3_for_public_files": True,
        "max_file_size": 52428800  # 50MB for optimal S3 performance
    }
    
    # Check for credentials from environment variables
    env_access_key = os.getenv('S3_ACCESS_KEY_ID')
    env_secret_key = os.getenv('S3_SECRET_ACCESS_KEY')
    
    if env_access_key:
        required_updates["s3_access_key_id"] = env_access_key
        
    if env_secret_key:
        required_updates["s3_secret_access_key"] = env_secret_key
    
    # Track changes
    changes_made = []
    
    # Apply updates
    for key, value in required_updates.items():
        current_value = site_config.get(key)
        if current_value != value:
            site_config[key] = value
            if key == 's3_secret_access_key':
                changes_made.append(f"{key}: ***UPDATED***")
            elif key == 'max_file_size':
                changes_made.append(f"{key}: {value / (1024*1024):.0f}MB")
            else:
                changes_made.append(f"{key}: {value}")
    
    if changes_made:
        print("Step 3: Creating backup and saving configuration...", flush=True)
        frappe.msgprint("Step 3: Creating backup and saving configuration...")
        
        # Create backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{site_config_path}.backup_{timestamp}"
        
        if os.path.exists(site_config_path):
            import shutil
            shutil.copy2(site_config_path, backup_path)
            print(f"✅ Backup created: {backup_path}", flush=True)
            frappe.msgprint(f"✅ Backup created: {backup_path}")
        
        # Write updated config
        with open(site_config_path, 'w') as f:
            json.dump(site_config, f, indent=2)
        
        print(f"\n✅ Updated site_config.json with {len(changes_made)} changes:", flush=True)
        frappe.msgprint(f"✅ Updated site_config.json with {len(changes_made)} changes:")
        
        for change in changes_made:
            print(f"  • {change}", flush=True)
            frappe.msgprint(f"  • {change}")
        
        # Clear Frappe cache
        try:
            frappe.clear_cache()
            print("\n✅ Frappe cache cleared", flush=True)
            frappe.msgprint("✅ Frappe cache cleared")
        except Exception as cache_error:
            print(f"\n⚠️  Could not clear cache: {str(cache_error)}", flush=True)
            frappe.msgprint(f"⚠️  Could not clear cache: {str(cache_error)}")
            
        print("\n🎉 SITE CONFIG UPDATED SUCCESSFULLY!", flush=True)
        frappe.msgprint("🎉 SITE CONFIG UPDATED SUCCESSFULLY!")
        
    else:
        print("ℹ️  No changes needed - configuration already up to date", flush=True)
        frappe.msgprint("ℹ️  No changes needed - configuration already up to date")
    
    # Check for missing credentials
    if not site_config.get('s3_access_key_id') and not env_access_key:
        print("\n⚠️  MISSING S3 CREDENTIALS:", flush=True)
        print("-" * 50, flush=True)
        print("S3 Access Key ID is not configured.", flush=True)
        print("Options to add credentials:", flush=True)
        print("1. Set S3_ACCESS_KEY_ID environment variable", flush=True)
        print("2. Add to ECS task definition environment variables", flush=True)
        print("3. Use IAM roles (recommended for production)", flush=True)
        frappe.msgprint("⚠️  S3 Access Key ID is missing - add via environment variables or IAM roles")
        
    if not site_config.get('s3_secret_access_key') and not env_secret_key:
        print("S3 Secret Access Key is not configured.", flush=True)
        print("Add S3_SECRET_ACCESS_KEY environment variable or use IAM roles", flush=True)
        frappe.msgprint("⚠️  S3 Secret Access Key is missing")
    
    print("\n💡 NEXT STEPS:", flush=True)
    print("-" * 50, flush=True)
    print("1. Add S3 credentials via environment variables or IAM roles", flush=True)
    print("2. Run check_s3_config_simple.py to verify configuration", flush=True)
    print("3. Test file uploads to confirm S3 integration", flush=True)
    frappe.msgprint("Next: Add S3 credentials and test configuration")
    
    # Show final configuration
    print("\n📋 FINAL S3 CONFIGURATION:", flush=True)
    print("-" * 50, flush=True)
    final_config = {
        "s3_bucket": site_config.get('s3_bucket'),
        "s3_region": site_config.get('s3_region'),
        "s3_folder_path": site_config.get('s3_folder_path'),
        "use_s3": site_config.get('use_s3'),
        "use_s3_for_private_files": site_config.get('use_s3_for_private_files'),
        "use_s3_for_public_files": site_config.get('use_s3_for_public_files'),
        "max_file_size": f"{site_config.get('max_file_size', 0) / (1024*1024):.0f}MB"
    }
    
    print(json.dumps(final_config, indent=2), flush=True)
    
except Exception as e:
    error_msg = f"❌ Error updating site config: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = f"🔍 Details: {traceback.format_exc()}"
    print(details, flush=True)

print("\n🔄 SITE CONFIG UPDATE COMPLETE", flush=True)
frappe.msgprint("🔄 SITE CONFIG UPDATE COMPLETE")