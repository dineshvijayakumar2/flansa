# AWS Fixes

This folder contains scripts and fixes that can be deployed to AWS containers.

## S3 Storage Configuration

### Prerequisites

1. **AWS S3 Bucket**: Create an S3 bucket in your AWS account
2. **IAM User**: Create an IAM user with S3 access permissions
3. **Access Keys**: Generate access keys for the IAM user

### Quick Setup for S3 Storage (Using Frappe's Built-in Support)

1. **Add S3 credentials to site_config.json**:
```json
{
  "aws_key_id": "YOUR_ACCESS_KEY",
  "aws_secret": "YOUR_SECRET_KEY",
  "s3_bucket_name": "flansa",
  "s3_region": "us-east-1",
  "s3_folder_name": "flansa-files",
  "upload_to_s3": 1
}
```

2. **Install boto3** (required for Frappe's S3 support):
```bash
bench pip install boto3
```

3. **Run configuration script**:
```bash
cd /home/frappe/frappe-bench
bench --site flansa.production console

# Then in the console, run:
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-fixes/configure_s3_storage.py').read())
```

4. **Restart services**:
```bash
sudo supervisorctl restart all
```

## Scripts

### configure_s3_storage.py
**NEW**: Configures S3 storage settings for file uploads in Frappe/Flansa.

**Purpose**: Enable S3 storage for all new file uploads instead of local storage.

**Usage in AWS container:**
```bash
# SSH into the container
aws ecs execute-command --cluster flansa-simple-cluster --task <task-id> --container flansa-app --interactive --command "/bin/bash"

# Run the S3 configuration script
cd /home/frappe/frappe-bench
bench --site flansa.production console

# Then in the console:
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-fixes/configure_s3_storage.py').read())
```

### debug_s3_issues.py
**NEW**: Diagnoses why S3 is not being used for file uploads despite configuration.

**Purpose**: Identify missing components and configuration issues preventing S3 usage.

**Usage in AWS container:**
```bash
# SSH into the container
aws ecs execute-command --cluster flansa-simple-cluster --task <task-id> --container flansa-app --interactive --command "/bin/bash"

# Run the debug script
cd /home/frappe/frappe-bench
bench --site flansa.production console

# Then in the console:
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-fixes/debug_s3_issues.py').read())
```

### recover_workspace_data.py
**NEW**: Recovers workspace data from old tenant registry table to Flansa Workspace DocType in AWS PostgreSQL.

**Purpose**: During the tenant → workspace migration, workspace data may exist in the old registry but be missing from the new Flansa Workspace table.

**Usage in AWS container:**
```bash
# SSH into the container
aws ecs execute-command --cluster flansa-simple-cluster --task <task-id> --container flansa-app --interactive --command "/bin/bash"

# Run the workspace recovery script
cd /home/frappe/frappe-bench
bench --site flansa.production console
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-fixes/recover_workspace_data.py').read())
```

### sync_db_to_json.py
Detects and syncs database schema differences to DocType JSON files.

**Usage in AWS container:**
```bash
# SSH into the container
aws ecs execute-command --cluster flansa-simple-cluster --task <task-id> --container flansa-app --interactive --command "/bin/bash"

# Run the schema sync script
cd /home/frappe/frappe-bench
bench --site flansa.production console
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-fixes/sync_db_to_json.py').read())
```

The script will:
1. Scan ALL Flansa DocTypes for schema differences
2. Show which database columns are not in the JSON files  
3. Provide commands to apply the fixes

### add_missing_fields.py
Adds missing fields (like tenant_id) to DocType JSON files.

**Usage in AWS container:**
```bash
# SSH into the container and run
cd /home/frappe/frappe-bench
bench --site flansa.production console
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-docker-setup/aws-fixes/add_missing_fields.py').read())
```

This script adds:
- `tenant_id` field to Flansa Relationship, Flansa Saved Report, and Flansa Form Config
- Other business fields like workspace, enterprise_type, etc.

**After running any fix:**
```bash
bench --site flansa.production migrate
```