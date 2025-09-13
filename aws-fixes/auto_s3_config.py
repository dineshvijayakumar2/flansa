#!/usr/bin/env python3
"""
Auto S3 Configuration Script
Automatically configures S3 settings from environment variables when site starts
Run this during site startup or container initialization
"""
import frappe
import os
import json

def auto_configure_s3():
    """Auto-configure S3 settings from environment variables"""
    print("🔧 AUTO S3 CONFIGURATION", flush=True)
    print("=" * 50, flush=True)
    
    try:
        # Check if environment variables are set
        env_vars = {
            'S3_BUCKET': os.getenv('S3_BUCKET'),
            'S3_REGION': os.getenv('S3_REGION'), 
            'S3_FOLDER_PATH': os.getenv('S3_FOLDER_PATH'),
            'USE_S3': os.getenv('USE_S3'),
            'USE_S3_FOR_PRIVATE_FILES': os.getenv('USE_S3_FOR_PRIVATE_FILES'),
            'USE_S3_FOR_PUBLIC_FILES': os.getenv('USE_S3_FOR_PUBLIC_FILES'),
            'S3_ACCESS_KEY_ID': os.getenv('S3_ACCESS_KEY_ID'),
            'S3_SECRET_ACCESS_KEY': os.getenv('S3_SECRET_ACCESS_KEY'),
            'MAX_FILE_SIZE': os.getenv('MAX_FILE_SIZE')
        }
        
        # Check if any S3 environment variables are set
        s3_env_vars = {k: v for k, v in env_vars.items() if v is not None and k.startswith('S3_') or k.startswith('USE_S3')}
        
        if not s3_env_vars:
            print("⚠️  No S3 environment variables found", flush=True)
            print("   S3 configuration will use existing site_config.json settings", flush=True)
            return True
            
        print(f"✅ Found {len(s3_env_vars)} S3 environment variables", flush=True)
        
        # Get current site config
        site_config_path = frappe.get_site_path('site_config.json')
        
        # Read existing config
        try:
            with open(site_config_path, 'r') as f:
                site_config = json.load(f)
        except:
            site_config = {}
        
        # Track changes
        changes_made = []
        
        # Apply S3 settings from environment variables
        if env_vars['S3_BUCKET']:
            site_config['s3_bucket'] = env_vars['S3_BUCKET']
            changes_made.append(f"s3_bucket: {env_vars['S3_BUCKET']}")
            
        if env_vars['S3_REGION']:
            site_config['s3_region'] = env_vars['S3_REGION']
            changes_made.append(f"s3_region: {env_vars['S3_REGION']}")
            
        if env_vars['S3_FOLDER_PATH']:
            site_config['s3_folder_path'] = env_vars['S3_FOLDER_PATH']
            changes_made.append(f"s3_folder_path: {env_vars['S3_FOLDER_PATH']}")
            
        if env_vars['USE_S3']:
            site_config['use_s3'] = int(env_vars['USE_S3'])
            changes_made.append(f"use_s3: {env_vars['USE_S3']}")
            
        if env_vars['USE_S3_FOR_PRIVATE_FILES']:
            site_config['use_s3_for_private_files'] = env_vars['USE_S3_FOR_PRIVATE_FILES'].lower() in ['1', 'true', 'yes']
            changes_made.append(f"use_s3_for_private_files: {site_config['use_s3_for_private_files']}")
            
        if env_vars['USE_S3_FOR_PUBLIC_FILES']:
            site_config['use_s3_for_public_files'] = env_vars['USE_S3_FOR_PUBLIC_FILES'].lower() in ['1', 'true', 'yes']
            changes_made.append(f"use_s3_for_public_files: {site_config['use_s3_for_public_files']}")
            
        if env_vars['S3_ACCESS_KEY_ID']:
            site_config['s3_access_key_id'] = env_vars['S3_ACCESS_KEY_ID']
            changes_made.append("s3_access_key_id: ***CONFIGURED***")
            
        if env_vars['S3_SECRET_ACCESS_KEY']:
            site_config['s3_secret_access_key'] = env_vars['S3_SECRET_ACCESS_KEY']
            changes_made.append("s3_secret_access_key: ***CONFIGURED***")
            
        if env_vars['MAX_FILE_SIZE']:
            site_config['max_file_size'] = int(env_vars['MAX_FILE_SIZE'])
            changes_made.append(f"max_file_size: {int(env_vars['MAX_FILE_SIZE']) / (1024*1024):.0f}MB")
        
        if changes_made:
            # Backup existing config
            backup_path = site_config_path + '.backup'
            if os.path.exists(site_config_path):
                import shutil
                shutil.copy2(site_config_path, backup_path)
                print(f"✅ Backup created: {backup_path}", flush=True)
            
            # Write updated config
            with open(site_config_path, 'w') as f:
                json.dump(site_config, f, indent=2)
            
            print(f"✅ Updated site_config.json with {len(changes_made)} S3 settings:", flush=True)
            for change in changes_made:
                print(f"  • {change}", flush=True)
                
            # Clear Frappe cache to reload config
            try:
                frappe.clear_cache()
                print("✅ Frappe cache cleared", flush=True)
            except:
                print("⚠️  Could not clear cache - restart may be needed", flush=True)
                
        else:
            print("ℹ️  No changes needed", flush=True)
            
        return True
        
    except Exception as e:
        print(f"❌ Error in auto S3 configuration: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        return False

def main():
    """Main execution"""
    try:
        success = auto_configure_s3()
        
        if success:
            print("\n🎉 AUTO S3 CONFIGURATION COMPLETED", flush=True)
            print("=" * 50, flush=True)
            print("S3 settings have been automatically applied from environment variables", flush=True)
            print("Run check_s3_config.py to verify the configuration", flush=True)
        else:
            print("\n❌ AUTO S3 CONFIGURATION FAILED", flush=True)
            
        return success
        
    except Exception as e:
        print(f"❌ Fatal error: {str(e)}", flush=True)
        return False

if __name__ == "__main__":
    # Can be run directly or imported
    main()

# For bench console execution
def run_auto_s3_config():
    """Function to call from bench console"""
    return auto_configure_s3()