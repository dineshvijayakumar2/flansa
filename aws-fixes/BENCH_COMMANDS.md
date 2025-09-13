# S3 Configuration - Bench Commands

## Quick Commands for S3 Setup

### 1. Check Current S3 Configuration
```bash
cd /home/ubuntu/frappe-bench
bench --site mysite.local console
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/check_s3_config_simple.py').read())
```

**Alternative (original version - may have minor errors):**
```bash
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/check_s3_config.py').read())
```

### 2. Auto-Configure S3 from Environment Variables
```bash
cd /home/ubuntu/frappe-bench  
bench --site mysite.local console
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/auto_s3_config_simple.py').read())
```

**Alternative (original with function-based approach):**
```bash
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/auto_s3_config.py').read())
```

### 3. Test S3 Integration and Upload
```bash
cd /home/ubuntu/frappe-bench
bench --site mysite.local console  
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/fix_s3_attachment_config.py').read())
```

## AWS ECS Deployment Scripts

### Update ECS with S3 Environment Variables
Located in `/home/ubuntu/frappe-bench/claude-code/aws-docker-setup/`:

```bash
cd /home/ubuntu/frappe-bench/claude-code/aws-docker-setup
chmod +x update_ecs_s3_simple.sh
./update_ecs_s3_simple.sh
```

### Site Configuration Template
- **File**: `aws_site_config_s3.json`
- **Contains**: S3 bucket settings, optimal file size (50MB)
- **Credentials**: Should come from environment variables

## Auto-Configuration on Restart

The site now automatically applies S3 settings from environment variables when it starts up:

- **Hook**: `boot_session = "flansa.boot.auto_configure_s3_on_boot"`
- **Function**: Reads ECS environment variables and updates site_config.json
- **Safe**: Won't fail startup if S3 config fails

## Environment Variables Expected

When ECS restarts, these environment variables will be automatically applied:

```bash
S3_BUCKET=flansa
S3_REGION=us-east-1  
S3_FOLDER_PATH=flansa-files
USE_S3=1
USE_S3_FOR_PRIVATE_FILES=1
USE_S3_FOR_PUBLIC_FILES=1
MAX_FILE_SIZE=52428800
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

## File Locations

### Development Scripts (In App)
- `/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/`
  - `check_s3_config.py` - Configuration checker
  - `auto_s3_config.py` - Auto-configuration script  
  - `fix_s3_attachment_config.py` - S3 integration tester

### Deployment Scripts (External)
- `/home/ubuntu/frappe-bench/claude-code/aws-docker-setup/`
  - `update_ecs_s3_simple.sh` - ECS task definition updater
  - `aws_site_config_s3.json` - Site configuration template
  - `update_s3_live.py` - Manual update instructions

## Testing the Auto-Configuration

After the next site restart, S3 will be automatically configured if environment variables are present. You can test this by:

1. Setting environment variables in ECS
2. Restarting the service  
3. Running the check command to verify configuration

## Rollback

If S3 causes issues:
1. Remove S3 environment variables from ECS
2. Restart service  
3. Files automatically fall back to local storage