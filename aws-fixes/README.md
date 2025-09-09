# AWS Fixes

This folder contains scripts and fixes that can be deployed to AWS containers.

## Scripts

### sync_db_to_json.py
Detects and syncs database schema differences to DocType JSON files.

**Usage in AWS container:**
```bash
# SSH into the container
aws ecs execute-command --cluster flansa-simple-cluster --task <task-id> --container flansa-app --interactive --command "/bin/bash"

# Run the script
cd /home/frappe/frappe-bench
bench --site flansa.production console
exec(open('/home/frappe/frappe-bench/apps/flansa/aws-docker-setup/aws-fixes/sync_db_to_json.py').read())
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