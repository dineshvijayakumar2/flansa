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
    # Use frappe.msgprint instead of print for bench console compatibility
    frappe.msgprint("🔧 AUTO S3 CONFIGURATION")
    frappe.msgprint("=" * 50)
    print("🔧 AUTO S3 CONFIGURATION", flush=True)
    print("=" * 50, flush=True)
    
    try:
        print("Step 1: Reading environment variables...", flush=True)
        frappe.msgprint("Step 1: Reading environment variables...")
        
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
        
        print(f"Environment variables found: {len([v for v in env_vars.values() if v])}", flush=True)
        frappe.msgprint(f"Environment variables found: {len([v for v in env_vars.values() if v])}")
        
        # Check if any S3 environment variables are set  
        s3_env_vars = {k: v for k, v in env_vars.items() if v is not None and (k.startswith('S3_') or k.startswith('USE_S3'))}
        
        if not s3_env_vars:
            message = "⚠️  No S3 environment variables found - using existing site_config.json settings"
            print(message, flush=True)
            frappe.msgprint(message)
            return {"success": True, "message": "No S3 environment variables found"}
            
        message = f"✅ Found {len(s3_env_vars)} S3 environment variables"
        print(message, flush=True)
        frappe.msgprint(message)
        
        print("Step 2: Reading current site configuration...", flush=True)
        frappe.msgprint("Step 2: Reading current site configuration...")
        
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
            print("Step 3: Applying configuration changes...", flush=True)
            frappe.msgprint("Step 3: Applying configuration changes...")
            
            # Backup existing config
            backup_path = site_config_path + '.backup'
            if os.path.exists(site_config_path):
                import shutil
                shutil.copy2(site_config_path, backup_path)
                message = f"✅ Backup created: {backup_path}"
                print(message, flush=True)
                frappe.msgprint(message)
            
            # Write updated config
            with open(site_config_path, 'w') as f:
                json.dump(site_config, f, indent=2)
            
            message = f"✅ Updated site_config.json with {len(changes_made)} S3 settings:"
            print(message, flush=True)
            frappe.msgprint(message)
            
            for change in changes_made:
                print(f"  • {change}", flush=True)
                frappe.msgprint(f"  • {change}")
                
            # Clear Frappe cache to reload config
            try:
                frappe.clear_cache()
                message = "✅ Frappe cache cleared"
                print(message, flush=True)
                frappe.msgprint(message)
            except Exception as cache_error:
                message = f"⚠️  Could not clear cache: {str(cache_error)}"
                print(message, flush=True)
                frappe.msgprint(message)
                
        else:
            message = "ℹ️  No changes needed - environment variables not set"
            print(message, flush=True)
            frappe.msgprint(message)
            
        return {"success": True, "changes": len(changes_made), "details": changes_made}
        
    except Exception as e:
        error_msg = f"❌ Error in auto S3 configuration: {str(e)}"
        print(error_msg, flush=True)
        frappe.msgprint(error_msg)
        
        import traceback
        details = f"🔍 Details: {traceback.format_exc()}"
        print(details, flush=True)
        frappe.msgprint(details)
        
        return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

def main():
    """Main execution"""
    try:
        result = auto_configure_s3()
        
        if result.get("success"):
            final_msg = "\n🎉 AUTO S3 CONFIGURATION COMPLETED"
            print(final_msg, flush=True)
            frappe.msgprint(final_msg)
            
            print("=" * 50, flush=True)
            print("S3 settings have been automatically applied from environment variables", flush=True)
            print("Run check_s3_config.py to verify the configuration", flush=True)
            
            frappe.msgprint("Run check_s3_config.py to verify the configuration")
        else:
            error_msg = "\n❌ AUTO S3 CONFIGURATION FAILED"
            print(error_msg, flush=True)
            frappe.msgprint(error_msg)
            
        return result
        
    except Exception as e:
        error_msg = f"❌ Fatal error: {str(e)}"
        print(error_msg, flush=True)
        frappe.msgprint(error_msg)
        return {"success": False, "fatal_error": str(e)}

# For bench console execution
def run_auto_s3_config():
    """Function to call from bench console"""
    result = auto_configure_s3()
    print(f"\n📋 RESULT: {result}", flush=True)
    frappe.msgprint(f"📋 RESULT: {result}")
    return result

if __name__ == "__main__":
    # Can be run directly or imported
    main()

# Execute the function when script is run via exec()
try:
    print("🚀 STARTING AUTO S3 CONFIGURATION...", flush=True)
    frappe.msgprint("🚀 STARTING AUTO S3 CONFIGURATION...")
    
    result = main()
    
    print(f"\n🔄 EXECUTION COMPLETE", flush=True) 
    print(f"Result: {result}", flush=True)
    frappe.msgprint(f"🔄 EXECUTION COMPLETE - Result: {result}")
    
    # Show final status
    if result and result.get("success"):
        if result.get("changes", 0) > 0:
            print(f"\n✅ SUCCESS: Applied {result.get('changes')} S3 configuration changes", flush=True)
            frappe.msgprint(f"✅ SUCCESS: Applied {result.get('changes')} S3 configuration changes") 
        else:
            print("\n✅ SUCCESS: No changes needed (no environment variables set)", flush=True)
            frappe.msgprint("✅ SUCCESS: No changes needed (no environment variables set)")
    else:
        print(f"\n❌ FAILED: {result.get('error', 'Unknown error')}", flush=True)
        frappe.msgprint(f"❌ FAILED: {result.get('error', 'Unknown error')}")
        
except Exception as script_error:
    error_msg = f"❌ SCRIPT EXECUTION ERROR: {str(script_error)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    traceback_msg = f"🔍 Traceback: {traceback.format_exc()}"
    print(traceback_msg, flush=True)