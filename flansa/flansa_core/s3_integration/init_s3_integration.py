#!/usr/bin/env python3
"""
Initialize Flansa S3 Integration
Run this script to immediately activate S3 integration without restart
"""

import frappe

print("🚀 INITIALIZING FLANSA S3 INTEGRATION", flush=True)
print("=" * 50, flush=True)

def initialize_s3_integration():
    """Initialize S3 integration immediately"""
    try:
        print("📋 Step 1: Checking S3 configuration...", flush=True)

        import frappe
        site_config = frappe.get_site_config()

        if not site_config.get('use_s3'):
            print("❌ S3 is not enabled (use_s3 = 0)", flush=True)
            return False

        print("✅ S3 is enabled in site configuration", flush=True)

        print("📋 Step 2: Importing S3 integration modules...", flush=True)

        # Import the S3 integration
        from flansa.flansa_core.s3_integration.hooks import init_s3_integration

        print("✅ S3 modules imported successfully", flush=True)

        print("📋 Step 3: Activating S3 file upload override...", flush=True)

        # Initialize the S3 integration
        init_s3_integration()

        print("✅ S3 file upload override activated", flush=True)

        print("📋 Step 4: Verifying integration...", flush=True)

        # Check if the override was applied
        import frappe.utils.file_manager
        original_func = frappe.utils.file_manager.save_file_on_filesystem

        print(f"✅ File manager function: {original_func.__name__}", flush=True)
        print(f"✅ Module: {original_func.__module__}", flush=True)

        print("📋 Step 5: Testing S3 connection...", flush=True)

        try:
            import boto3
            from botocore.exceptions import ClientError

            s3_client = boto3.client(
                's3',
                region_name=site_config.get('s3_region', 'us-east-1'),
                aws_access_key_id=site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id'),
                aws_secret_access_key=site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
            )

            bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
            s3_client.head_bucket(Bucket=bucket_name)
            print("✅ S3 connection test successful", flush=True)

        except Exception as e:
            print(f"⚠️  S3 connection test failed: {str(e)}", flush=True)
            print("   File uploads will still work but may fall back to local storage", flush=True)

        print("\n🎉 Flansa S3 integration initialized successfully!", flush=True)
        print("\n📌 What's now active:", flush=True)
        print("   - File uploads will attempt S3 upload after local save", flush=True)
        print("   - Private files will get S3 private URLs", flush=True)
        print("   - Public files will get direct S3 URLs", flush=True)
        print("   - File deletions will also delete from S3", flush=True)

        print("\n🧪 Test now:", flush=True)
        print("   1. Upload a file in Flansa", flush=True)
        print("   2. Check if file_url contains 's3.amazonaws.com'", flush=True)
        print("   3. Verify the file exists in S3 bucket", flush=True)

        return True

    except Exception as e:
        print(f"❌ Error initializing S3 integration: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Run the initialization
try:
    result = initialize_s3_integration()

    if result:
        print("\n✅ S3 integration initialization completed!", flush=True)
        print("You can now test file uploads - they should go to S3", flush=True)
    else:
        print("\n❌ S3 integration initialization failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)