#!/usr/bin/env python3
"""
Debug AWS S3 Upload Integration
Check why S3 integration isn't working on AWS deployment
"""

import frappe

print("🔍 DEBUGGING AWS S3 UPLOAD INTEGRATION", flush=True)
print("=" * 50, flush=True)

def debug_aws_s3_integration():
    """Debug S3 integration status on AWS"""
    try:
        print("📋 Step 1: Checking site configuration...", flush=True)

        site_config = frappe.get_site_config()
        use_s3 = site_config.get('use_s3')
        print(f"✅ use_s3 setting: {use_s3}", flush=True)

        # Check all possible S3 config keys
        s3_configs = {
            's3_access_key_id': site_config.get('s3_access_key_id'),
            'aws_access_key_id': site_config.get('aws_access_key_id'),
            's3_secret_access_key': site_config.get('s3_secret_access_key'),
            'aws_secret_access_key': site_config.get('aws_secret_access_key'),
            's3_bucket': site_config.get('s3_bucket'),
            's3_bucket_name': site_config.get('s3_bucket_name'),
            's3_region': site_config.get('s3_region'),
            's3_folder_path': site_config.get('s3_folder_path')
        }

        for key, value in s3_configs.items():
            if value:
                if 'secret' in key or 'key' in key:
                    print(f"✅ {key}: ***{value[-4:] if len(value) > 4 else '***'}", flush=True)
                else:
                    print(f"✅ {key}: {value}", flush=True)
            else:
                print(f"❌ {key}: NOT SET", flush=True)

        if not use_s3:
            print("❌ S3 is disabled - enable with 'use_s3': 1 in site_config.json", flush=True)
            return False

        print("📋 Step 2: Checking function overrides...", flush=True)

        # Check if S3 integration was initialized
        try:
            from flansa.flansa_core.s3_integration.hooks import init_s3_integration
            print("✅ S3 integration module imported successfully", flush=True)
        except ImportError as e:
            print(f"❌ S3 integration import failed: {e}", flush=True)
            return False

        # Check file manager override
        import frappe.utils.file_manager
        save_func = frappe.utils.file_manager.save_file_on_filesystem
        print(f"📄 save_file_on_filesystem: {save_func.__name__}", flush=True)
        print(f"📄 Module: {save_func.__module__}", flush=True)

        # Check if it's our custom function
        if 'flansa' in save_func.__module__ or save_func.__name__ == 'save_file_with_s3':
            print("✅ File manager override is ACTIVE", flush=True)
        else:
            print("❌ File manager override is NOT active", flush=True)

        # Check API override
        import frappe.handler
        upload_func = frappe.handler.upload_file
        print(f"📄 upload_file: {upload_func.__name__}", flush=True)
        print(f"📄 Module: {upload_func.__module__}", flush=True)

        if 'flansa' in upload_func.__module__ or upload_func.__name__ == 'upload_file_with_s3':
            print("✅ API override is ACTIVE", flush=True)
        else:
            print("❌ API override is NOT active", flush=True)

        print("📋 Step 3: Testing S3 connection manually...", flush=True)

        try:
            import boto3
            from botocore.exceptions import ClientError

            s3_access_key = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
            s3_secret_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
            s3_bucket = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
            s3_region = site_config.get('s3_region', 'us-east-1')

            if not all([s3_access_key, s3_secret_key, s3_bucket]):
                print("❌ Missing S3 credentials", flush=True)
                return False

            s3_client = boto3.client(
                's3',
                region_name=s3_region,
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key
            )

            # Test bucket access
            s3_client.head_bucket(Bucket=s3_bucket)
            print("✅ S3 bucket connection successful", flush=True)

        except Exception as e:
            print(f"❌ S3 connection test failed: {str(e)}", flush=True)
            return False

        print("📋 Step 4: Manually initialize S3 integration...", flush=True)

        # Try to initialize S3 integration manually
        try:
            from flansa.flansa_core.s3_integration.hooks import init_s3_integration
            init_s3_integration()
            print("✅ S3 integration manually initialized", flush=True)
        except Exception as e:
            print(f"❌ Manual S3 initialization failed: {str(e)}", flush=True)
            import traceback
            print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)

        print("📋 Step 5: Checking recent uploads...", flush=True)

        # Get most recent files
        recent_files = frappe.get_all("File",
                                     fields=["name", "file_name", "file_url", "creation", "is_private"],
                                     order_by="creation desc",
                                     limit=3)

        for file_doc in recent_files:
            print(f"📄 {file_doc.file_name} ({file_doc.creation})", flush=True)
            print(f"   URL: {file_doc.file_url}", flush=True)
            is_s3 = 's3' in str(file_doc.file_url).lower()
            print(f"   Storage: {'✅ S3' if is_s3 else '❌ Local'}", flush=True)
            print(f"   Private: {file_doc.is_private}", flush=True)
            print("", flush=True)

        return True

    except Exception as e:
        print(f"❌ Debug error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False

# Execute debug
try:
    result = debug_aws_s3_integration()

    if result:
        print("🎉 Debug completed - check results above", flush=True)
    else:
        print("❌ Debug found critical issues", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)