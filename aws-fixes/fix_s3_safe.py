#!/usr/bin/env python3
"""
Safe S3 Configuration Fix
This script fixes S3 configuration using safer database operations
"""

import frappe
import json
import os

print("🔧 SAFE S3 CONFIGURATION FIX", flush=True)
print("=" * 50, flush=True)

def safe_fix_s3_configuration():
    """Safely fix S3 configuration using direct database operations"""
    try:
        print("📋 Step 1: Adding missing site_config.json settings...", flush=True)

        # Get current site config
        site_config_path = frappe.get_site_path("site_config.json")

        with open(site_config_path, 'r') as f:
            site_config = json.load(f)

        # Add missing S3 settings
        site_config.update({
            "s3_bucket_name": "flansa",
            "s3_region": "us-east-1",
            "upload_to_s3": 1,
            "s3_folder": "flansa-files"
        })

        # Write back to site_config.json
        with open(site_config_path, 'w') as f:
            json.dump(site_config, f, indent=2)

        print("✅ Updated site_config.json with missing S3 settings", flush=True)

        print("📋 Step 2: Using safe database operations for System Settings...", flush=True)

        # Use frappe.db.set_single_value for safer updates
        s3_settings = {
            "upload_to_s3": 1,
            "s3_bucket_name": "flansa",
            "s3_region": "us-east-1",
            "s3_folder_name": "flansa-files",
            "enable_s3": 1,
            "aws_key_id": site_config.get("aws_access_key_id"),
            "aws_secret": site_config.get("aws_secret_access_key"),
        }

        for field, value in s3_settings.items():
            if value:
                try:
                    frappe.db.set_single_value("System Settings", field, value)
                    print(f"   ✅ Set {field} = {value if field not in ['aws_secret'] else '***'}", flush=True)
                except Exception as e:
                    print(f"   ⚠️  Could not set {field}: {str(e)}", flush=True)

        frappe.db.commit()
        print("✅ System Settings updated safely", flush=True)

        print("📋 Step 3: Verifying S3 configuration...", flush=True)

        # Verify the settings were applied
        upload_to_s3 = frappe.db.get_single_value("System Settings", "upload_to_s3")
        s3_bucket = frappe.db.get_single_value("System Settings", "s3_bucket_name")

        print(f"   - upload_to_s3: {upload_to_s3}", flush=True)
        print(f"   - s3_bucket_name: {s3_bucket}", flush=True)

        print("📋 Step 4: Testing S3 connection...", flush=True)

        try:
            import boto3
            from botocore.exceptions import ClientError

            s3_client = boto3.client(
                's3',
                region_name='us-east-1',
                aws_access_key_id=site_config.get('aws_access_key_id'),
                aws_secret_access_key=site_config.get('aws_secret_access_key')
            )

            # Test connection
            s3_client.head_bucket(Bucket='flansa')
            print("✅ S3 connection test passed", flush=True)

        except Exception as e:
            print(f"❌ S3 connection issue: {str(e)}", flush=True)

        print("📋 Step 5: Clearing caches...", flush=True)

        frappe.clear_cache()
        print("✅ Cache cleared", flush=True)

        print("\n🎉 Safe S3 configuration fix completed!", flush=True)
        print("\n📋 Current Configuration:", flush=True)
        print(f"   - Site Config S3 Bucket: {site_config.get('s3_bucket_name')}", flush=True)
        print(f"   - Site Config Upload to S3: {site_config.get('upload_to_s3')}", flush=True)
        print(f"   - System Settings upload_to_s3: {upload_to_s3}", flush=True)
        print(f"   - System Settings s3_bucket_name: {s3_bucket}", flush=True)

        print("\n⚠️  CRITICAL: You MUST restart bench now:", flush=True)
        print("   exit  # exit the console", flush=True)
        print("   bench restart", flush=True)
        print("   (If bench restart fails, restart the container)", flush=True)

        return True

    except Exception as e:
        print(f"❌ Error in safe fix: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Run the safe fix
try:
    result = safe_fix_s3_configuration()

    if result:
        print("\n✅ Safe S3 fix completed successfully!", flush=True)
    else:
        print("\n❌ Safe S3 fix failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)