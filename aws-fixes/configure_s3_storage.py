#!/usr/bin/env python3
"""
S3 Storage Configuration Script for Frappe/Flansa
This script configures Frappe's built-in S3 storage for file uploads in AWS deployment

S3 Bucket Details:
- Bucket Name: flansa
- Region: us-east-1
- Folder Structure: flansa-files/ (prefix)
"""

import frappe
import json

print("🔍 S3 STORAGE CONFIGURATION SCRIPT", flush=True)
print("=" * 50, flush=True)

def configure_s3_storage():
    """Configure S3 storage settings for the site"""
    try:
        print("📋 Step 1: Checking current site configuration...", flush=True)

        # Get current site config
        site_config = frappe.get_site_config()

        # Default S3 settings for Flansa
        DEFAULT_BUCKET = "flansa"
        DEFAULT_REGION = "us-east-1"
        DEFAULT_FOLDER = "flansa-files"

        # Check if S3 credentials exist
        has_credentials = all([
            site_config.get('aws_access_key_id') or site_config.get('aws_key_id'),
            site_config.get('aws_secret_access_key') or site_config.get('aws_secret')
        ])

        if has_credentials:
            print("✅ AWS credentials found in site config", flush=True)
            # Use provided values or defaults
            bucket_name = site_config.get('s3_bucket_name', DEFAULT_BUCKET)
            region = site_config.get('s3_region', DEFAULT_REGION)
            print(f"   - Bucket: {bucket_name}", flush=True)
            print(f"   - Region: {region}", flush=True)
            print(f"   - Folder: {DEFAULT_FOLDER}", flush=True)
        else:
            print("❌ AWS credentials missing in site config", flush=True)
            print("   Please add the following to site_config.json:", flush=True)
            print("   - aws_access_key_id or aws_key_id", flush=True)
            print("   - aws_secret_access_key or aws_secret", flush=True)
            return False

        print("📋 Step 2: Configuring Frappe's built-in S3 support...", flush=True)

        # Get AWS credentials (support both naming conventions)
        aws_key = site_config.get('aws_access_key_id') or site_config.get('aws_key_id')
        aws_secret = site_config.get('aws_secret_access_key') or site_config.get('aws_secret')

        # Configure Frappe's built-in S3 settings
        s3_settings = {
            "upload_to_s3": 1,  # Enable S3 uploads
            "s3_bucket_name": bucket_name,
            "s3_region": region,
            "s3_folder_name": DEFAULT_FOLDER,  # Use flansa-files as prefix
            "aws_key_id": aws_key,
            "aws_secret": aws_secret,
            # Optional: Set CDN URL if using CloudFront or direct S3 URL
            "s3_cdn_url": f"https://{bucket_name}.s3.{region}.amazonaws.com/{DEFAULT_FOLDER}"
        }

        # Update System Settings
        for key, value in s3_settings.items():
            if value:
                frappe.db.set_value("System Settings", None, key, value)

        frappe.db.commit()
        print("✅ Frappe's built-in S3 support enabled", flush=True)

        print("📋 Step 3: Installing required Python packages...", flush=True)

        # Check if boto3 is installed (required for Frappe's S3 support)
        try:
            import boto3
            print("✅ boto3 package already installed", flush=True)
        except ImportError:
            print("⚠️  boto3 not installed. Please install it using:", flush=True)
            print("   bench pip install boto3", flush=True)
            return False

        print("📋 Step 4: Testing S3 connection...", flush=True)

        # Test S3 connection
        try:
            import boto3
            from botocore.exceptions import ClientError

            s3_client = boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=aws_key,
                aws_secret_access_key=aws_secret
            )

            # Try to list objects in the bucket (just to test connection)
            response = s3_client.list_objects_v2(
                Bucket=bucket_name,
                Prefix=DEFAULT_FOLDER + '/',
                MaxKeys=1
            )

            print("✅ Successfully connected to S3 bucket", flush=True)

        except ClientError as e:
            error_code = e.response['Error']['Code']
            print(f"❌ S3 connection failed: {error_code}", flush=True)
            print(f"   Error details: {str(e)}", flush=True)
            return False
        except Exception as e:
            print(f"❌ Unexpected error testing S3: {str(e)}", flush=True)
            return False

        print("📋 Step 5: Clearing cache...", flush=True)
        frappe.clear_cache()
        print("✅ Cache cleared", flush=True)

        print("\n🎉 S3 storage configuration completed successfully!", flush=True)
        print("\n📌 Configuration Summary:", flush=True)
        print(f"   - Bucket: {bucket_name}", flush=True)
        print(f"   - Region: {region}", flush=True)
        print(f"   - Folder: {DEFAULT_FOLDER}/", flush=True)
        print(f"   - S3 URL: https://{bucket_name}.s3.{region}.amazonaws.com/{DEFAULT_FOLDER}/", flush=True)

        print("\n📌 Important Notes:", flush=True)
        print("1. New file uploads will now go to S3", flush=True)
        print("2. Files will be stored under flansa-files/ prefix", flush=True)
        print("3. Existing local files will remain local", flush=True)
        print("4. Private files marked with is_private=1 will use S3 private URLs", flush=True)
        print("5. Restart supervisor services for changes to take effect:", flush=True)
        print("   sudo supervisorctl restart all", flush=True)

        return True

    except Exception as e:
        print(f"❌ Error during configuration: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False


def check_s3_storage_status():
    """Check current S3 storage status"""
    try:
        print("\n📊 CURRENT S3 STORAGE STATUS", flush=True)
        print("=" * 50, flush=True)

        # Check System Settings
        system_settings = frappe.get_doc("System Settings")

        print(f"S3 Enabled: {system_settings.get('enable_s3', False)}", flush=True)
        print(f"File Upload To: {system_settings.get('file_upload_to', 'Local')}", flush=True)
        print(f"S3 Bucket: {system_settings.get('s3_bucket_name', 'Not set')}", flush=True)
        print(f"S3 Region: {system_settings.get('s3_region', 'Not set')}", flush=True)
        print(f"Backup to S3: {system_settings.get('backup_to_s3', False)}", flush=True)

        # Check if frappe-s3-attachment app is installed
        installed_apps = frappe.get_installed_apps()
        has_s3_app = 'frappe_s3_attachment' in installed_apps or 's3_attachment' in installed_apps

        if has_s3_app:
            print("\n✅ frappe-s3-attachment app is installed", flush=True)
        else:
            print("\n⚠️  frappe-s3-attachment app is NOT installed", flush=True)
            print("   Consider installing it for better S3 integration:", flush=True)
            print("   bench get-app https://github.com/zerodha/frappe-attachments-s3", flush=True)
            print("   bench --site your-site install-app frappe_s3_attachment", flush=True)

        return True

    except Exception as e:
        print(f"❌ Error checking status: {str(e)}", flush=True)
        return False


# When running in bench console, frappe is already initialized
# Just run the functions directly
try:
    print(f"🔧 Configuring S3 storage for site: {frappe.local.site}", flush=True)
    print("")

    # Check current status first
    check_s3_storage_status()

    print("\n🚀 Starting S3 configuration...\n", flush=True)

    # Run configuration
    result = configure_s3_storage()

    if result:
        print("\n✅ S3 storage configuration completed successfully!", flush=True)
        print("Please restart services: sudo supervisorctl restart all", flush=True)
    else:
        print("\n❌ S3 storage configuration failed. Please check the errors above.", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)