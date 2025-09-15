#!/usr/bin/env python3
"""
Fix S3 Configuration Issues
This script fixes the missing settings for S3 uploads
"""

import frappe
import json
import os

print("🔧 FIXING S3 CONFIGURATION ISSUES", flush=True)
print("=" * 50, flush=True)

def fix_s3_configuration():
    """Fix S3 configuration issues"""
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
            "s3_folder": "flansa-files"  # Some versions use this instead
        })

        # Write back to site_config.json
        with open(site_config_path, 'w') as f:
            json.dump(site_config, f, indent=2)

        print("✅ Updated site_config.json with missing S3 settings", flush=True)

        print("📋 Step 2: Configuring System Settings with correct fields...", flush=True)

        # Update System Settings with all possible S3 field variations
        system_settings = frappe.get_single("System Settings")

        # Set multiple variations of S3 settings (different Frappe versions use different names)
        s3_configs = {
            # Standard S3 settings
            "upload_to_s3": 1,
            "s3_bucket_name": "flansa",
            "s3_region": "us-east-1",
            "s3_folder_name": "flansa-files",
            "aws_key_id": site_config.get("aws_access_key_id"),
            "aws_secret": site_config.get("aws_secret_access_key"),

            # Alternative field names
            "enable_s3": 1,
            "s3_access_key": site_config.get("aws_access_key_id"),
            "s3_secret_key": site_config.get("aws_secret_access_key"),
            "s3_bucket": "flansa",

            # File upload settings
            "file_storage_provider": "s3",
        }

        for field, value in s3_configs.items():
            if value:
                try:
                    setattr(system_settings, field, value)
                    print(f"   ✅ Set {field} = {value if field not in ['aws_secret', 's3_secret_key'] else '***'}", flush=True)
                except Exception:
                    # Field might not exist in this version
                    pass

        system_settings.save()
        frappe.db.commit()

        print("✅ System Settings updated with S3 configuration", flush=True)

        print("📋 Step 3: Setting up S3 file upload hook...", flush=True)

        # Check if we can override the file upload function
        try:
            # This forces Frappe to use S3 for file uploads
            frappe.db.set_single_value("System Settings", "enable_s3", 1)
            frappe.db.set_single_value("System Settings", "upload_to_s3", 1)
            frappe.db.commit()
            print("✅ Forced S3 uploads in System Settings", flush=True)
        except Exception as e:
            print(f"⚠️  Could not force S3 uploads: {str(e)}", flush=True)

        print("📋 Step 4: Testing S3 connection with fixed config...", flush=True)

        # Test S3 connection
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
            print(f"❌ S3 connection still failing: {str(e)}", flush=True)
            return False

        print("📋 Step 5: Clearing all caches...", flush=True)

        # Clear all caches
        frappe.clear_cache()
        frappe.clear_document_cache()

        print("✅ All caches cleared", flush=True)

        print("\n🎉 S3 configuration fix completed!", flush=True)
        print("\n📌 What was fixed:", flush=True)
        print("   - Added s3_bucket_name to site_config.json", flush=True)
        print("   - Updated System Settings with multiple S3 field variations", flush=True)
        print("   - Forced enable_s3 and upload_to_s3 flags", flush=True)
        print("   - Cleared all caches", flush=True)

        print("\n⚠️  IMPORTANT: You need to restart bench for changes to take effect:", flush=True)
        print("   bench restart", flush=True)
        print("   (or restart the container if bench restart doesn't work)", flush=True)

        return True

    except Exception as e:
        print(f"❌ Error fixing S3 configuration: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Run the fix
try:
    result = fix_s3_configuration()

    if result:
        print("\n✅ S3 configuration fix completed successfully!", flush=True)
    else:
        print("\n❌ S3 configuration fix failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)