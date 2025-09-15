#!/usr/bin/env python3
"""
Debug S3 Storage Issues in Frappe/Flansa
This script helps identify why S3 storage is not being used despite configuration
"""

import frappe
import json
import os

print("🔍 DEBUGGING S3 STORAGE ISSUES", flush=True)
print("=" * 50, flush=True)

def debug_s3_issues():
    """Debug why S3 is not being used for file uploads"""
    try:
        print("📋 Step 1: Checking site configuration...", flush=True)

        # Get site config
        site_config = frappe.get_site_config()

        # Check S3 credentials
        s3_keys = {
            'aws_access_key_id': site_config.get('aws_access_key_id', 'NOT SET'),
            'aws_secret_access_key': '***' if site_config.get('aws_secret_access_key') else 'NOT SET',
            's3_bucket_name': site_config.get('s3_bucket_name', 'NOT SET'),
            's3_region': site_config.get('s3_region', 'NOT SET'),
            's3_endpoint_url': site_config.get('s3_endpoint_url', 'NOT SET'),
            'use_ssl': site_config.get('use_ssl', True)
        }

        print("✅ S3 Configuration in site_config.json:", flush=True)
        for key, value in s3_keys.items():
            print(f"   - {key}: {value}", flush=True)

        print("\n📋 Step 2: Checking System Settings...", flush=True)

        # Check system settings
        system_settings = frappe.get_single("System Settings")

        s3_settings = {
            'enable_s3': system_settings.get('enable_s3'),
            'file_upload_to': system_settings.get('file_upload_to'),
            's3_bucket_name': system_settings.get('s3_bucket_name'),
            's3_region': system_settings.get('s3_region'),
            'backup_to_s3': system_settings.get('backup_to_s3')
        }

        print("✅ S3 Settings in System Settings:", flush=True)
        for key, value in s3_settings.items():
            print(f"   - {key}: {value}", flush=True)

        print("\n📋 Step 3: Checking Frappe's built-in S3 configuration...", flush=True)

        # Check if Frappe's built-in S3 is enabled
        upload_to_s3 = site_config.get('upload_to_s3') or system_settings.get('upload_to_s3')

        if upload_to_s3:
            print("✅ Frappe's built-in S3 uploads are enabled", flush=True)
        else:
            print("❌ Frappe's built-in S3 uploads are NOT enabled", flush=True)
            print("   Set upload_to_s3 = 1 in site_config.json or System Settings", flush=True)

        # Check S3 folder configuration
        s3_folder = site_config.get('s3_folder_name') or system_settings.get('s3_folder_name')
        if s3_folder:
            print(f"✅ S3 folder prefix: {s3_folder}", flush=True)
        else:
            print("⚠️  No S3 folder prefix configured (files will be in bucket root)", flush=True)

        print("\n📋 Step 4: Checking boto3 installation...", flush=True)

        # Check boto3
        try:
            import boto3
            print(f"✅ boto3 installed: {boto3.__version__}", flush=True)
        except ImportError:
            print("❌ boto3 is NOT installed!", flush=True)
            print("   Install with: bench pip install boto3", flush=True)

        print("\n📋 Step 5: Checking File Upload Handler...", flush=True)

        # Check current file upload handler
        from frappe import conf

        upload_handler = conf.get('file_upload_handler')
        if upload_handler:
            print(f"✅ Custom file upload handler: {upload_handler}", flush=True)
        else:
            print("⚠️  No custom file upload handler configured", flush=True)
            print("   Using default Frappe file handler (local storage)", flush=True)

        print("\n📋 Step 6: Checking S3 connection...", flush=True)

        if site_config.get('aws_access_key_id') and site_config.get('s3_bucket_name'):
            try:
                import boto3
                from botocore.exceptions import ClientError, NoCredentialsError

                # Create S3 client
                s3_client = boto3.client(
                    's3',
                    region_name=site_config.get('s3_region', 'us-east-1'),
                    aws_access_key_id=site_config.get('aws_access_key_id'),
                    aws_secret_access_key=site_config.get('aws_secret_access_key'),
                    endpoint_url=site_config.get('s3_endpoint_url') if site_config.get('s3_endpoint_url') else None
                )

                # Test connection
                response = s3_client.head_bucket(Bucket=site_config.get('s3_bucket_name'))
                print("✅ Successfully connected to S3 bucket", flush=True)

            except NoCredentialsError:
                print("❌ AWS credentials are invalid", flush=True)
            except ClientError as e:
                error_code = e.response['Error']['Code']
                if error_code == '404':
                    print("❌ S3 bucket does not exist", flush=True)
                elif error_code == '403':
                    print("❌ No permission to access S3 bucket", flush=True)
                else:
                    print(f"❌ S3 error: {error_code} - {str(e)}", flush=True)
            except Exception as e:
                print(f"❌ Failed to connect to S3: {str(e)}", flush=True)
        else:
            print("⚠️  Cannot test S3 connection - missing credentials", flush=True)

        print("\n📋 Step 7: Testing file upload mechanism...", flush=True)

        # Check how files are being uploaded
        from frappe.utils.file_manager import save_file_on_filesystem, save_url

        print(f"✅ File system save function: {save_file_on_filesystem.__module__}", flush=True)
        print(f"✅ URL save function: {save_url.__module__}", flush=True)

        # Check if there's an S3 override
        try:
            from frappe_s3_attachment import controller
            print("✅ S3 controller module found", flush=True)
        except ImportError:
            print("⚠️  No S3 controller module found", flush=True)

        print("\n📊 DIAGNOSIS:", flush=True)
        print("=" * 50, flush=True)

        issues = []
        recommendations = []

        # Check for Frappe's built-in S3 configuration
        if not upload_to_s3:
            issues.append("Frappe's built-in S3 uploads are not enabled")
            recommendations.append("Set upload_to_s3 = 1 in site_config.json or System Settings")

        if not site_config.get('aws_access_key_id') and not site_config.get('aws_key_id'):
            issues.append("AWS credentials not configured")
            recommendations.append("Add aws_key_id and aws_secret to site_config.json")

        if not site_config.get('s3_bucket_name') and not system_settings.get('s3_bucket_name'):
            issues.append("S3 bucket name not configured")
            recommendations.append("Set s3_bucket_name = 'flansa' in site_config.json")

        if not site_config.get('s3_region') and not system_settings.get('s3_region'):
            issues.append("S3 region not configured")
            recommendations.append("Set s3_region = 'us-east-1' in site_config.json")

        if issues:
            print("❌ Issues found:", flush=True)
            for issue in issues:
                print(f"   - {issue}", flush=True)

            print("\n💡 Recommendations:", flush=True)
            for rec in recommendations:
                print(f"   {rec}", flush=True)
        else:
            print("✅ S3 configuration appears correct", flush=True)
            print("   If files are still uploading locally, try:", flush=True)
            print("   1. Clear cache: bench clear-cache", flush=True)
            print("   2. Restart workers: sudo supervisorctl restart all", flush=True)
            print("   3. Check error logs for any S3-related errors", flush=True)

        return True

    except Exception as e:
        print(f"❌ Error during debugging: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)
        return False


# When running in bench console, frappe is already initialized
# Just run the function directly
try:
    print(f"🔧 Debugging S3 issues for site: {frappe.local.site}", flush=True)
    print("")

    # Run debug
    result = debug_s3_issues()

    if result:
        print("\n✅ Debug completed successfully", flush=True)
    else:
        print("\n❌ Debug failed", flush=True)

except Exception as e:
    print(f"❌ Script execution error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Full traceback: {traceback.format_exc()}", flush=True)