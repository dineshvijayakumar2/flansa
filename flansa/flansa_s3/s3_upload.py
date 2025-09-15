#!/usr/bin/env python3
"""
Flansa S3 Upload Integration
Custom S3 file upload functionality for Frappe
"""

import os
import frappe
import boto3
from botocore.exceptions import ClientError
from frappe.utils.file_manager import save_file_on_filesystem, get_content_hash
from frappe import _

def upload_file_to_s3(file_doc, file_content):
    """
    Upload file to S3 and update the file document

    Args:
        file_doc: Frappe File document
        file_content: File content (bytes)

    Returns:
        str: S3 URL of uploaded file or None if failed
    """
    try:
        # Get S3 configuration from site config
        site_config = frappe.get_site_config()

        # Check if S3 is enabled
        if not site_config.get('use_s3'):
            return None

        # Get S3 credentials
        aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
        aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
        bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')
        region = site_config.get('s3_region') or site_config.get('aws_s3_region_name')
        folder_path = site_config.get('s3_folder_path') or site_config.get('s3_folder') or 'flansa-files'

        if not all([aws_access_key_id, aws_secret_access_key, bucket_name, region]):
            frappe.log_error("S3 credentials incomplete", "Flansa S3 Upload")
            return None

        # Create S3 client
        s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key
        )

        # Create S3 key (file path)
        s3_key = f"{folder_path}/{file_doc.name}_{file_doc.file_name}"

        # Set content type based on file extension
        content_type = get_content_type(file_doc.file_name)

        # Upload to S3 (without ACL since bucket doesn't support it)
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_content,
            ContentType=content_type
            # Note: ACL removed because bucket has ACLs disabled
        )

        # Generate S3 URL
        # Since bucket has ACLs disabled, all files are private by default
        # Always use presigned URLs for security
        if file_doc.is_private:
            # For private files, generate a presigned URL that expires in 1 hour
            s3_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': s3_key},
                ExpiresIn=3600  # 1 hour
            )
        else:
            # For "public" files, generate a longer-lived presigned URL (24 hours)
            # since we can't make them truly public due to ACL restrictions
            s3_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': s3_key},
                ExpiresIn=86400  # 24 hours
            )

        frappe.logger().info(f"File uploaded to S3: {s3_url}")
        return s3_url

    except ClientError as e:
        error_msg = f"S3 upload failed: {str(e)}"
        frappe.log_error(error_msg, "Flansa S3 Upload")
        frappe.logger().error(error_msg)
        return None

    except Exception as e:
        error_msg = f"Unexpected error in S3 upload: {str(e)}"
        frappe.log_error(error_msg, "Flansa S3 Upload")
        frappe.logger().error(error_msg)
        return None


def get_content_type(filename):
    """Get content type based on file extension"""
    import mimetypes
    content_type, _ = mimetypes.guess_type(filename)
    return content_type or 'application/octet-stream'


def delete_file_from_s3(file_url):
    """
    Delete file from S3

    Args:
        file_url: S3 URL of the file to delete
    """
    try:
        site_config = frappe.get_site_config()

        if not site_config.get('use_s3') or not file_url:
            return

        # Extract S3 key from URL
        if 's3.amazonaws.com' not in file_url and 's3.' not in file_url:
            return

        # Parse S3 URL to get bucket and key
        parts = file_url.replace('https://', '').split('/')
        bucket_name = parts[0].split('.')[0]  # Extract bucket from subdomain
        s3_key = '/'.join(parts[1:])  # Rest is the key

        # Get S3 credentials
        aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
        aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
        region = site_config.get('s3_region') or site_config.get('aws_s3_region_name')

        if not all([aws_access_key_id, aws_secret_access_key, region]):
            return

        # Create S3 client
        s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key
        )

        # Delete from S3
        s3_client.delete_object(Bucket=bucket_name, Key=s3_key)
        frappe.logger().info(f"File deleted from S3: {file_url}")

    except Exception as e:
        error_msg = f"Error deleting file from S3: {str(e)}"
        frappe.log_error(error_msg, "Flansa S3 Delete")
        frappe.logger().error(error_msg)


def get_s3_file_content(file_url):
    """
    Get file content from S3

    Args:
        file_url: S3 URL of the file

    Returns:
        bytes: File content or None if failed
    """
    try:
        site_config = frappe.get_site_config()

        if not site_config.get('use_s3') or not file_url:
            return None

        if 's3.amazonaws.com' not in file_url and 's3.' not in file_url:
            return None

        # Parse S3 URL
        parts = file_url.replace('https://', '').split('/')
        bucket_name = parts[0].split('.')[0]
        s3_key = '/'.join(parts[1:])

        # Get S3 credentials
        aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
        aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
        region = site_config.get('s3_region') or site_config.get('aws_s3_region_name')

        if not all([aws_access_key_id, aws_secret_access_key, region]):
            return None

        # Create S3 client
        s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key
        )

        # Get file content
        response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
        return response['Body'].read()

    except Exception as e:
        error_msg = f"Error getting file from S3: {str(e)}"
        frappe.log_error(error_msg, "Flansa S3 Get")
        frappe.logger().error(error_msg)
        return None