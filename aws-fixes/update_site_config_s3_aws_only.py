#!/usr/bin/env python3
"""
AWS-Only Site Config Updater for S3 Configuration
Only applies S3 settings when running in AWS environment (ECS)
Detects AWS environment and skips for local development
"""
import frappe
import json
import os
from datetime import datetime

def is_aws_environment():
    """Detect if running in AWS environment"""
    # Check for AWS ECS metadata endpoint
    ecs_metadata_v4 = os.getenv('ECS_CONTAINER_METADATA_URI_V4')
    ecs_metadata_v3 = os.getenv('ECS_CONTAINER_METADATA_URI')
    
    # Check for AWS instance metadata
    aws_region = os.getenv('AWS_REGION') or os.getenv('AWS_DEFAULT_REGION')
    
    # Check for ECS task ARN
    ecs_task_arn = os.getenv('ECS_TASK_ARN')
    
    # Check for specific ECS environment indicators
    aws_execution_env = os.getenv('AWS_EXECUTION_ENV')
    
    return any([
        ecs_metadata_v4,
        ecs_metadata_v3, 
        ecs_task_arn,
        aws_execution_env == 'AWS_ECS_FARGATE',
        aws_execution_env == 'AWS_ECS_EC2'
    ])

print("🔧 AWS-ONLY SITE CONFIG UPDATER FOR S3", flush=True)
frappe.msgprint("🔧 AWS-ONLY SITE CONFIG UPDATER FOR S3")
print("=" * 50, flush=True)

try:
    print("Step 1: Detecting environment...", flush=True)
    frappe.msgprint("Step 1: Detecting environment...")
    
    # Check if running in AWS
    if not is_aws_environment():
        print("🏠 Local development environment detected", flush=True)
        print("❌ S3 configuration SKIPPED for local development", flush=True)
        print("   This script only runs in AWS ECS environment", flush=True)
        frappe.msgprint("❌ S3 configuration SKIPPED - Local development environment")
        frappe.msgprint("This script only applies S3 settings in AWS ECS")
        
        print("\n💡 FOR LOCAL DEVELOPMENT:", flush=True)
        print("-" * 50, flush=True)
        print("• Files are stored locally (as intended)", flush=True)
        print("• S3 configuration is not needed", flush=True)
        print("• Use the auto_s3_config scripts for AWS deployment", flush=True)
        
        print("\n🔄 AWS-ONLY CONFIG UPDATE COMPLETE", flush=True)
        frappe.msgprint("🔄 AWS-ONLY CONFIG UPDATE COMPLETE - No changes made")
        
        # Exit the script for local environment
    else:
        print("✅ AWS environment detected - proceeding with S3 configuration", flush=True)
        frappe.msgprint("✅ AWS environment detected - proceeding with S3 configuration")
        
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
        
        # Required S3 configuration for AWS
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
            print("Step 3: Creating backup and saving AWS configuration...", flush=True)
            frappe.msgprint("Step 3: Creating backup and saving AWS configuration...")
            
            # Create backup
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{site_config_path}.backup_aws_{timestamp}"
            
            if os.path.exists(site_config_path):
                import shutil
                shutil.copy2(site_config_path, backup_path)
                print(f"✅ Backup created: {backup_path}", flush=True)
                frappe.msgprint(f"✅ Backup created: {backup_path}")
            
            # Write updated config
            with open(site_config_path, 'w') as f:
                json.dump(site_config, f, indent=2)
            
            print(f"\n✅ Updated AWS site_config.json with {len(changes_made)} changes:", flush=True)
            frappe.msgprint(f"✅ Updated AWS site_config.json with {len(changes_made)} changes:")
            
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
                
            print("\n🎉 AWS S3 CONFIGURATION UPDATED SUCCESSFULLY!", flush=True)
            frappe.msgprint("🎉 AWS S3 CONFIGURATION UPDATED SUCCESSFULLY!")
            
        else:
            print("ℹ️  No changes needed - AWS configuration already up to date", flush=True)
            frappe.msgprint("ℹ️  No changes needed - AWS configuration already up to date")
        
        # Check for missing credentials
        if not site_config.get('s3_access_key_id') and not env_access_key:
            print("\n⚠️  MISSING S3 CREDENTIALS:", flush=True)
            print("S3 Access Key ID is not configured.", flush=True)
            print("Add via ECS environment variables or IAM roles", flush=True)
            frappe.msgprint("⚠️  S3 Access Key ID missing - add via ECS environment or IAM roles")
            
        if not site_config.get('s3_secret_access_key') and not env_secret_key:
            print("S3 Secret Access Key is not configured.", flush=True)
            frappe.msgprint("⚠️  S3 Secret Access Key missing")
        
        print("\n💡 NEXT STEPS:", flush=True)
        print("1. Add S3 credentials via ECS environment variables or IAM roles", flush=True)
        print("2. Run check_s3_config_simple.py to verify configuration", flush=True)
        frappe.msgprint("Next: Add S3 credentials and test configuration")
        
except Exception as e:
    error_msg = f"❌ Error updating AWS site config: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = f"🔍 Details: {traceback.format_exc()}"
    print(details, flush=True)

print("\n🔄 AWS-ONLY SITE CONFIG UPDATE COMPLETE", flush=True)
frappe.msgprint("🔄 AWS-ONLY SITE CONFIG UPDATE COMPLETE")