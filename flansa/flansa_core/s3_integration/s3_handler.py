#!/usr/bin/env python3
"""
S3 Handler for Dynamic URL Generation
Handles S3 file serving with on-demand presigned URL generation
"""

import frappe
import boto3
from botocore.exceptions import ClientError
from urllib.parse import urlparse

def get_s3_client():
    """Get configured S3 client"""
    site_config = frappe.get_site_config()

    aws_access_key_id = site_config.get('s3_access_key_id') or site_config.get('aws_access_key_id')
    aws_secret_access_key = site_config.get('s3_secret_access_key') or site_config.get('aws_secret_access_key')
    region = site_config.get('s3_region', 'us-east-1')

    return boto3.client(
        's3',
        region_name=region,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key
    )

@frappe.whitelist(allow_guest=True)
def get_s3_signed_url(file_url_or_key):
    """
    Generate a fresh presigned URL for S3 file access

    Args:
        file_url_or_key: Either S3 object key or full S3 URL

    Returns:
        Fresh presigned URL with appropriate expiry
    """
    try:
        site_config = frappe.get_site_config()
        bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')

        # Extract S3 key from URL if needed
        if file_url_or_key.startswith('https://'):
            # Parse S3 URL to get the key
            parsed = urlparse(file_url_or_key)
            # Remove bucket name and leading slash
            s3_key = parsed.path.lstrip('/')
            if '/' in s3_key:
                # Remove bucket name if it's in the path
                parts = s3_key.split('/', 1)
                if parts[0] == bucket_name:
                    s3_key = parts[1]
        elif file_url_or_key.startswith('s3://'):
            # Handle s3:// protocol
            s3_key = file_url_or_key.replace(f's3://{bucket_name}/', '')
        else:
            # Assume it's already the key
            s3_key = file_url_or_key

        # Get S3 client
        s3_client = get_s3_client()

        # Determine expiry based on file type and user
        is_logged_in = frappe.session.user != 'Guest'

        # Longer expiry for logged-in users
        if is_logged_in:
            expiry_seconds = 86400  # 24 hours
        else:
            expiry_seconds = 3600   # 1 hour

        # Generate presigned URL
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket_name,
                'Key': s3_key
            },
            ExpiresIn=expiry_seconds
        )

        return presigned_url

    except ClientError as e:
        frappe.log_error(f"S3 presigned URL generation failed: {str(e)}", "S3 Handler")
        return None
    except Exception as e:
        frappe.log_error(f"Unexpected error in S3 URL generation: {str(e)}", "S3 Handler")
        return None

def get_s3_object_key(file_url):
    """
    Extract S3 object key from various URL formats

    Returns the S3 object key without bucket name or protocol
    """
    if not file_url:
        return None

    # If it's already just a key
    if not file_url.startswith(('http', 's3://', '/')):
        return file_url

    # Parse different URL formats
    if file_url.startswith('https://'):
        parsed = urlparse(file_url)
        # Get path without leading slash
        path = parsed.path.lstrip('/')

        # Remove bucket name if present
        site_config = frappe.get_site_config()
        bucket_name = site_config.get('s3_bucket') or site_config.get('s3_bucket_name')

        if path.startswith(f'{bucket_name}/'):
            return path[len(bucket_name)+1:]

        # Check if it's in the format: bucket.s3.amazonaws.com/key
        if bucket_name in parsed.netloc:
            return path

        return path

    elif file_url.startswith('s3://'):
        # Remove s3:// protocol and bucket name
        parts = file_url[5:].split('/', 1)
        return parts[1] if len(parts) > 1 else parts[0]

    return file_url

@frappe.whitelist()
def get_download_url(file_name):
    """
    Get a download URL for a file (works for both local and S3 files)
    """
    # Get the file document
    file_doc = frappe.get_doc("File", {"file_name": file_name})

    if not file_doc:
        return None

    # Check if it's an S3 file
    if file_doc.file_url and ('s3' in file_doc.file_url or 'amazonaws' in file_doc.file_url):
        # Generate fresh presigned URL
        return get_s3_signed_url(file_doc.file_url)
    else:
        # Return local file URL
        return file_doc.file_url