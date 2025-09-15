#!/usr/bin/env python3
"""
Debug S3 Upload Issues
This script tests why S3 uploads are not working
"""

print("🔍 DEBUGGING S3 UPLOAD ISSUES", flush=True)
print("=" * 50, flush=True)

try:
    import frappe

    print("📋 Step 1: Checking recent error logs...", flush=True)

    # Check recent error logs for S3 failures
    errors = frappe.get_all("Error Log",
                           filters={"creation": [">", "2025-09-01"]},
                           fields=["name", "error", "creation"],
                           limit=10,
                           order_by="creation desc")

    print(f"Found {len(errors)} recent errors", flush=True)
    s3_errors_found = 0
    for error in errors:
        if 's3' in error.error.lower() or 'flansa' in error.error.lower():
            s3_errors_found += 1
            print(f"S3/Flansa Error: {error.creation}", flush=True)
            print(f"Error: {error.error[:200]}...", flush=True)
            print("-" * 50, flush=True)

    if s3_errors_found == 0:
        print("✅ No S3-related errors found in logs", flush=True)

    print("\n📋 Step 2: Testing S3 connection directly...", flush=True)

    # Test S3 connection
    site_config = frappe.get_site_config()

    # Get credentials
    aws_key = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
    aws_secret = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
    bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
    region = site_config.get('s3_region', 'us-east-1')

    print(f"AWS Key: {aws_key[:10]}..." if aws_key else "AWS Key: NOT FOUND", flush=True)
    print(f"AWS Secret: {'***' if aws_secret else 'NOT FOUND'}", flush=True)
    print(f"Bucket: {bucket_name}", flush=True)
    print(f"Region: {region}", flush=True)

    import boto3
    from botocore.exceptions import ClientError

    s3_client = boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=aws_key,
        aws_secret_access_key=aws_secret
    )

    print("✅ S3 client created successfully", flush=True)

    # Test bucket access
    s3_client.head_bucket(Bucket=bucket_name)
    print("✅ S3 bucket access successful", flush=True)

    print("\n📋 Step 3: Testing S3 upload function...", flush=True)

    # Test the upload function directly
    from flansa.flansa_s3.s3_upload import upload_file_to_s3

    print("✅ S3 upload function imported successfully", flush=True)

    # Create a test file document (simulate what happens during upload)
    test_file_doc = frappe.new_doc("File")
    test_file_doc.file_name = "test_s3_upload.txt"
    test_file_doc.is_private = 0
    test_file_doc.name = "test_s3_file_001"

    test_content = b"Hello S3 Test Content"

    print("📤 Testing S3 upload with test file...", flush=True)

    s3_url = upload_file_to_s3(test_file_doc, test_content)

    if s3_url:
        print(f"✅ S3 upload test successful!", flush=True)
        print(f"✅ S3 URL: {s3_url}", flush=True)
    else:
        print("❌ S3 upload test failed - returned None", flush=True)

    print("\n📋 Step 4: Testing file content retrieval...", flush=True)

    if s3_url:
        # Test if we can retrieve the file
        try:
            response = s3_client.get_object(
                Bucket=bucket_name,
                Key=f"flansa-files/{test_file_doc.name}_{test_file_doc.file_name}"
            )
            retrieved_content = response['Body'].read()
            print(f"✅ File retrieved from S3: {retrieved_content.decode()}", flush=True)

            # Clean up test file
            s3_client.delete_object(
                Bucket=bucket_name,
                Key=f"flansa-files/{test_file_doc.name}_{test_file_doc.file_name}"
            )
            print("✅ Test file cleaned up from S3", flush=True)

        except Exception as e:
            print(f"❌ File retrieval test failed: {str(e)}", flush=True)

    print("\n🎉 S3 upload debugging completed!", flush=True)

except Exception as e:
    print(f"❌ Debug script error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Traceback: {traceback.format_exc()}", flush=True)