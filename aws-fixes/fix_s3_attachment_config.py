#!/usr/bin/env python3
"""
Fix S3 attachment configuration for Frappe/ERPNext
This script should be run inside the Docker container or via bench console
"""
import frappe
import json

print("🔧 FIXING S3 ATTACHMENT CONFIGURATION", flush=True)
print("=" * 60, flush=True)

# Get current site config
site_config = frappe.get_site_config()

print("\n📋 CURRENT CONFIGURATION:", flush=True)
print("-" * 50, flush=True)
for key in ['s3_bucket', 's3_folder_path', 'use_s3', 's3_access_key_id', 
            's3_secret_access_key', 's3_region', 'use_s3_for_private_files',
            'use_s3_for_public_files']:
    value = site_config.get(key)
    if key in ['s3_secret_access_key'] and value:
        print(f"{key}: ***HIDDEN***", flush=True)
    else:
        print(f"{key}: {value}", flush=True)

print("\n🔧 REQUIRED CONFIGURATION UPDATES:", flush=True)
print("-" * 50, flush=True)

# Configuration that needs to be added/updated
required_config = {
    "s3_bucket": "flansa",
    "s3_region": "us-east-1",  # Update this to your actual region
    "s3_folder_path": "flansa-files",
    "use_s3": 1,
    "use_s3_for_private_files": True,
    "use_s3_for_public_files": True,
    # These should come from environment variables or SSM
    # "s3_access_key_id": "YOUR_ACCESS_KEY",
    # "s3_secret_access_key": "YOUR_SECRET_KEY",
}

print("\nTo properly configure S3 for attachments, add these to site_config.json:", flush=True)
print(json.dumps(required_config, indent=2), flush=True)

print("\n📝 CONFIGURATION INSTRUCTIONS:", flush=True)
print("-" * 50, flush=True)
print("""
1. SSH into your AWS ECS instance or container:
   aws ecs execute-command --cluster your-cluster --task your-task-id \\
       --container frappe-worker --interactive --command "/bin/bash"

2. Edit the site configuration:
   cd /home/frappe/frappe-bench/sites/flansa.local
   vi site_config.json

3. Add/update these settings:
   {
     "s3_bucket": "flansa",
     "s3_region": "us-east-1",
     "s3_folder_path": "flansa-files",
     "use_s3": 1,
     "use_s3_for_private_files": true,
     "use_s3_for_public_files": true,
     "s3_access_key_id": "YOUR_ACCESS_KEY_FROM_SSM",
     "s3_secret_access_key": "YOUR_SECRET_KEY_FROM_SSM"
   }

4. Or use environment variables in your ECS task definition:
   S3_BUCKET=flansa
   S3_REGION=us-east-1
   S3_FOLDER_PATH=flansa-files
   USE_S3=1
   USE_S3_FOR_PRIVATE_FILES=1
   USE_S3_FOR_PUBLIC_FILES=1
   S3_ACCESS_KEY_ID=(from SSM parameter store)
   S3_SECRET_ACCESS_KEY=(from SSM parameter store)

5. Restart your ECS service:
   aws ecs update-service --cluster your-cluster --service your-service --force-new-deployment
""", flush=True)

print("\n🔍 TESTING S3 ATTACHMENT UPLOAD:", flush=True)
print("-" * 50, flush=True)

# Test if we can upload to S3
try:
    # Check if boto3 is available
    import boto3
    
    # Get S3 configuration
    s3_bucket = site_config.get('s3_bucket', 'flansa')
    s3_region = site_config.get('s3_region', 'us-east-1')
    s3_folder = site_config.get('s3_folder_path', 'flansa-files')
    
    print(f"Testing S3 access to bucket: {s3_bucket}", flush=True)
    
    # Try to list objects in the bucket
    if site_config.get('s3_access_key_id') and site_config.get('s3_secret_access_key'):
        s3 = boto3.client('s3',
            region_name=s3_region,
            aws_access_key_id=site_config.get('s3_access_key_id'),
            aws_secret_access_key=site_config.get('s3_secret_access_key')
        )
        
        try:
            response = s3.list_objects_v2(
                Bucket=s3_bucket,
                Prefix=s3_folder,
                MaxKeys=1
            )
            print("✅ S3 connection successful!", flush=True)
            
            # Test upload
            test_key = f"{s3_folder}/test-upload.txt"
            s3.put_object(
                Bucket=s3_bucket,
                Key=test_key,
                Body=b"Test upload from Frappe",
                ContentType="text/plain"
            )
            print(f"✅ Test file uploaded to s3://{s3_bucket}/{test_key}", flush=True)
            
            # Clean up test file
            s3.delete_object(Bucket=s3_bucket, Key=test_key)
            print("✅ Test file cleaned up", flush=True)
            
        except Exception as e:
            print(f"❌ S3 access error: {str(e)}", flush=True)
    else:
        print("⚠️  S3 credentials not configured in site_config.json", flush=True)
        print("   Files will be stored locally until S3 credentials are added", flush=True)
        
except ImportError:
    print("⚠️  boto3 not installed - cannot test S3 connection", flush=True)
    print("   Install with: pip install boto3", flush=True)
except Exception as e:
    print(f"❌ Error testing S3: {str(e)}", flush=True)

print("\n💡 ADDITIONAL NOTES:", flush=True)
print("-" * 50, flush=True)
print("""
1. For production, use IAM roles instead of access keys:
   - Create an IAM role with S3 permissions
   - Attach the role to your ECS task definition
   - Remove s3_access_key_id and s3_secret_access_key from config

2. S3 bucket CORS configuration (if needed for direct uploads):
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
       "AllowedOrigins": ["https://your-domain.com"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]

3. To migrate existing files to S3:
   bench --site flansa.local migrate-to-s3

4. Monitor S3 usage:
   - Check CloudWatch for S3 metrics
   - Set up billing alerts for S3 storage/transfer costs
""", flush=True)