#!/usr/bin/env python3
"""
Detailed S3 Upload Debug
This script debugs the upload_file_to_s3 function step by step
"""

print("🔍 DETAILED S3 UPLOAD DEBUG", flush=True)
print("=" * 50, flush=True)

try:
    import frappe

    print("📋 Step 1: Creating test file document...", flush=True)

    # Create a test file document
    test_file_doc = frappe.new_doc("File")
    test_file_doc.file_name = "test_debug.txt"
    test_file_doc.is_private = 0
    test_file_doc.name = "test_debug_001"

    test_content = b"Hello S3 Debug Test"

    print(f"✅ Test file doc: {test_file_doc.name}", flush=True)
    print(f"✅ File name: {test_file_doc.file_name}", flush=True)
    print(f"✅ Is private: {test_file_doc.is_private}", flush=True)

    print("\n📋 Step 2: Checking S3 configuration manually...", flush=True)

    site_config = frappe.get_site_config()

    # Check if S3 is enabled
    use_s3 = site_config.get('use_s3')
    print(f"✅ use_s3: {use_s3}", flush=True)

    if not use_s3:
        print("❌ S3 is not enabled - this is the problem!", flush=True)
        exit()

    # Get S3 credentials
    aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
    aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
    bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
    region = site_config.get('s3_region') or site_config.get('aws_s3_region_name')
    folder_path = site_config.get('s3_folder_path') or site_config.get('s3_folder') or 'flansa-files'

    print(f"✅ AWS Access Key: {aws_access_key_id[:10]}..." if aws_access_key_id else "❌ AWS Access Key: Missing", flush=True)
    print(f"✅ AWS Secret: ***" if aws_secret_access_key else "❌ AWS Secret: Missing", flush=True)
    print(f"✅ Bucket: {bucket_name}", flush=True)
    print(f"✅ Region: {region}", flush=True)
    print(f"✅ Folder: {folder_path}", flush=True)

    credentials_complete = all([aws_access_key_id, aws_secret_access_key, bucket_name, region])
    print(f"Credentials complete: {credentials_complete}", flush=True)

    if not credentials_complete:
        print("❌ S3 credentials incomplete - this is the problem!", flush=True)
        exit()

    print("\n📋 Step 3: Testing S3 client creation...", flush=True)

    import boto3
    from botocore.exceptions import ClientError

    # Create S3 client
    s3_client = boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key
    )

    print("✅ S3 client created", flush=True)

    print("\n📋 Step 4: Testing S3 upload step by step...", flush=True)

    # Create S3 key (file path)
    s3_key = f"{folder_path}/{test_file_doc.name}_{test_file_doc.file_name}"
    print(f"✅ S3 key: {s3_key}", flush=True)

    # Set content type
    content_type = 'text/plain'
    print(f"✅ Content type: {content_type}", flush=True)

    # Test the actual upload
    print("📤 Attempting S3 upload...", flush=True)

    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=test_content,
            ContentType=content_type,
            ACL='public-read'  # Since is_private=0
        )
        print("✅ S3 upload successful!", flush=True)

        # Generate S3 URL
        s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"
        print(f"✅ S3 URL: {s3_url}", flush=True)

        # Test if file exists
        try:
            s3_client.head_object(Bucket=bucket_name, Key=s3_key)
            print("✅ File exists in S3", flush=True)
        except ClientError:
            print("❌ File does not exist in S3", flush=True)

        # Clean up
        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
        print("✅ Test file cleaned up", flush=True)

    except ClientError as e:
        print(f"❌ S3 upload failed: {str(e)}", flush=True)
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        print(f"❌ Error code: {error_code}", flush=True)

    print("\n📋 Step 5: Testing the actual upload_file_to_s3 function...", flush=True)

    # Now test our function
    from flansa.flansa_s3.s3_upload import upload_file_to_s3

    # Add debugging inside the function by monkey-patching
    import flansa.flansa_s3.s3_upload as s3_module

    # Store original function
    original_upload = s3_module.upload_file_to_s3

    def debug_upload_file_to_s3(file_doc, file_content):
        print(f"🔍 DEBUG: Called with file_doc.name={file_doc.name}", flush=True)
        print(f"🔍 DEBUG: file_doc.file_name={file_doc.file_name}", flush=True)
        print(f"🔍 DEBUG: file_doc.is_private={file_doc.is_private}", flush=True)
        print(f"🔍 DEBUG: content length={len(file_content)}", flush=True)

        try:
            result = original_upload(file_doc, file_content)
            print(f"🔍 DEBUG: Function returned: {result}", flush=True)
            return result
        except Exception as e:
            print(f"🔍 DEBUG: Function threw exception: {str(e)}", flush=True)
            import traceback
            print(f"🔍 DEBUG: Traceback: {traceback.format_exc()}", flush=True)
            return None

    # Replace with debug version
    s3_module.upload_file_to_s3 = debug_upload_file_to_s3

    # Test it
    result = s3_module.upload_file_to_s3(test_file_doc, test_content)
    print(f"📤 Upload result: {result}", flush=True)

    print("\n🎉 Detailed S3 upload debugging completed!", flush=True)

except Exception as e:
    print(f"❌ Debug script error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)