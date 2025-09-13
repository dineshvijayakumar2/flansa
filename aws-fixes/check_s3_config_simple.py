#!/usr/bin/env python3
"""
Simple S3 Configuration Checker - Error-Free Version
"""
import frappe
import os

print("🔍 CHECKING AWS S3 CONFIGURATION FOR ATTACHMENTS", flush=True)
frappe.msgprint("🔍 CHECKING AWS S3 CONFIGURATION FOR ATTACHMENTS")
print("=" * 60, flush=True)

try:
    # Get site config
    site_config = frappe.get_site_config()
    
    # Check for S3 private settings
    s3_private_bucket = site_config.get('s3_private_bucket')
    s3_public_bucket = site_config.get('s3_public_bucket')
    s3_bucket = site_config.get('s3_bucket')
    s3_access_key_id = site_config.get('s3_access_key_id')
    s3_secret_access_key = site_config.get('s3_secret_access_key')
    s3_region = site_config.get('s3_region')
    s3_endpoint_url = site_config.get('s3_endpoint_url')
    s3_folder_path = site_config.get('s3_folder_path')
    
    # Check for S3 file backup settings
    enable_private_s3_backup = site_config.get('enable_private_s3_backup')
    enable_public_s3_backup = site_config.get('enable_public_s3_backup')
    
    # Check for attachment storage settings
    use_s3_for_private_files = site_config.get('use_s3_for_private_files')
    use_s3_for_public_files = site_config.get('use_s3_for_public_files')
    use_s3 = site_config.get('use_s3')
    
    print("\n📦 S3 BUCKET CONFIGURATION:", flush=True)
    print("-" * 50, flush=True)
    print(f"S3 Bucket: {s3_bucket or '(not configured)'}", flush=True)
    print(f"Private Bucket: {s3_private_bucket or '(not configured)'}", flush=True)
    print(f"Public Bucket: {s3_public_bucket or '(not configured)'}", flush=True)
    print(f"Region: {s3_region or '(not configured)'}", flush=True)
    print(f"Folder Path: {s3_folder_path or '(not configured)'}", flush=True)
    print(f"Endpoint URL: {s3_endpoint_url or '(default AWS)'}", flush=True)
    
    print("\n🔑 S3 CREDENTIALS:", flush=True)
    print("-" * 50, flush=True)
    if s3_access_key_id:
        key_display = '*' * 10 + s3_access_key_id[-4:] if len(s3_access_key_id) > 4 else '****'
        print(f"Access Key ID: {key_display}", flush=True)
    else:
        print(f"Access Key ID: (not configured)", flush=True)
    
    if s3_secret_access_key:
        print(f"Secret Access Key: {'*' * 20} (configured)", flush=True)
    else:
        print(f"Secret Access Key: (not configured)", flush=True)
    
    print("\n📁 FILE STORAGE SETTINGS:", flush=True)
    print("-" * 50, flush=True)
    print(f"Use S3: {use_s3 or False}", flush=True)
    print(f"Use S3 for Private Files: {use_s3_for_private_files or False}", flush=True)
    print(f"Use S3 for Public Files: {use_s3_for_public_files or False}", flush=True)
    print(f"Enable Private S3 Backup: {enable_private_s3_backup or False}", flush=True)
    print(f"Enable Public S3 Backup: {enable_public_s3_backup or False}", flush=True)
    
    # Check file upload settings
    print("\n📤 FILE UPLOAD SETTINGS:", flush=True)
    print("-" * 50, flush=True)
    max_file_size = site_config.get('max_file_size', 10485760)  # Default 10MB
    print(f"Max File Size: {max_file_size / (1024*1024):.2f} MB", flush=True)
    
    # S3 file size recommendations
    any_s3_bucket = s3_private_bucket or s3_public_bucket or s3_bucket
    if any_s3_bucket:
        print("\n💡 S3 FILE SIZE RECOMMENDATIONS:", flush=True)
        print("-" * 50, flush=True)
        print("For S3 storage, consider these best practices:", flush=True)
        print("• Standard uploads: 50MB max (good performance)", flush=True)
        print("• Large files: 100MB max (may require multipart upload)", flush=True)
        print("• Multipart threshold: 5GB (AWS limit for single PUT)", flush=True)
        if max_file_size < 52428800:  # 50MB
            print("✅ Current setting is optimal for S3", flush=True)
        elif max_file_size < 104857600:  # 100MB
            print("⚠️  Consider enabling multipart uploads for better performance", flush=True)
        else:
            print("🔧 Recommend: Enable multipart uploads for files > 50MB", flush=True)
    else:
        print("\n💡 RECOMMENDED S3 FILE SIZE SETTINGS:", flush=True)
        print("-" * 50, flush=True)
        print("When enabling S3, update site_config.json:", flush=True)
        print('{"max_file_size": 52428800}  # 50MB for optimal S3 performance', flush=True)
    
    # Check current file storage location  
    private_files_path = frappe.get_site_path('private', 'files')
    public_files_path = frappe.get_site_path('public', 'files')
    
    print("\n📂 LOCAL FILE PATHS:", flush=True)
    print("-" * 50, flush=True)
    print(f"Private Files: {private_files_path}", flush=True)
    print(f"Public Files: {public_files_path}", flush=True)
    
    # Count local files safely
    private_count = 0
    public_count = 0
    
    try:
        if os.path.exists(private_files_path):
            private_items = os.listdir(private_files_path)
            for item in private_items:
                item_path = os.path.join(private_files_path, item)
                if os.path.isfile(item_path):
                    private_count += 1
        print(f"Private Files Count: {private_count}", flush=True)
    except Exception as e:
        print(f"Private Files Count: Error - {str(e)}", flush=True)
    
    try:
        if os.path.exists(public_files_path):
            public_items = os.listdir(public_files_path)
            for item in public_items:
                item_path = os.path.join(public_files_path, item)
                if os.path.isfile(item_path):
                    public_count += 1
        print(f"Public Files Count: {public_count}", flush=True)
    except Exception as e:
        print(f"Public Files Count: Error - {str(e)}", flush=True)
    
    # Check if S3 is enabled
    if any_s3_bucket:
        print("\n✅ S3 BUCKETS ARE CONFIGURED", flush=True)
        frappe.msgprint("✅ S3 BUCKETS ARE CONFIGURED")
        
        if use_s3_for_private_files or use_s3_for_public_files or use_s3:
            print("✅ S3 IS ACTIVELY USED FOR FILE STORAGE", flush=True)
            frappe.msgprint("✅ S3 IS ACTIVELY USED FOR FILE STORAGE")
        else:
            print("⚠️  S3 buckets configured but not enabled for file storage", flush=True)
            print("   To enable, set 'use_s3_for_private_files' or 'use_s3_for_public_files' to true", flush=True)
            frappe.msgprint("⚠️  S3 buckets configured but not enabled for file storage")
    else:
        print("\n❌ S3 IS NOT CONFIGURED", flush=True)
        print("   File attachments will be stored locally on the server", flush=True)
        frappe.msgprint("❌ S3 IS NOT CONFIGURED - File attachments stored locally")
    
    # Check for S3 file backup app
    try:
        if frappe.db.exists("Module Def", {"app_name": "frappe_s3_attachment"}):
            print("\n🔌 S3 ATTACHMENT APP:", flush=True)
            print("✅ frappe_s3_attachment app is installed", flush=True)
            frappe.msgprint("✅ frappe_s3_attachment app is installed")
        else:
            print("\n🔌 S3 ATTACHMENT APP:", flush=True)
            print("❌ frappe_s3_attachment app is NOT installed", flush=True)
            frappe.msgprint("❌ frappe_s3_attachment app is NOT installed")
    except:
        print("\n🔌 S3 ATTACHMENT APP:", flush=True)
        print("❓ Unable to check app status", flush=True)
    
    print("\n💡 RECOMMENDATION:", flush=True)
    print("-" * 50, flush=True)
    if not any_s3_bucket:
        print("To enable S3 for attachments in AWS ECS:", flush=True)
        print("1. Add S3 configuration to site_config.json", flush=True)
        print("2. Set 'use_s3_for_private_files': true", flush=True)
        print("3. Set 'use_s3_for_public_files': true", flush=True)
        print("4. Configure S3 bucket permissions and CORS", flush=True)
        frappe.msgprint("Recommendation: Configure S3 buckets and enable file storage")
    
except Exception as e:
    error_msg = f"❌ Error: {str(e)}"
    print(error_msg, flush=True)
    frappe.msgprint(error_msg)
    
    import traceback
    details = f"🔍 Details: {traceback.format_exc()}"
    print(details, flush=True)

print("\n🔄 S3 CONFIGURATION CHECK COMPLETE", flush=True)
frappe.msgprint("🔄 S3 CONFIGURATION CHECK COMPLETE")