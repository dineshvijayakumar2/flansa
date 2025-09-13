# S3 Update Guide for Existing AWS Deployment

## Current Status (Confirmed)
- ❌ S3 not configured
- ✅ Local storage active (1 private + 18 public files)
- ❌ No S3 attachment app installed
- ✅ Site running perfectly on AWS ECS

## Update Process (Zero Downtime)

### Step 1: Update ECS Task Definition
Run the ECS update script to add S3 environment variables:

```bash
cd /home/ubuntu/frappe-bench/claude-code/aws-docker-setup
chmod +x update_ecs_s3_simple.sh
./update_ecs_s3_simple.sh
```

This script will:
- Get current task definition
- Add S3 environment variables (bucket: flansa, region: us-east-1)
- Register new task definition revision
- Update ECS service automatically

### Step 2: Add S3 Credentials to ECS
You need to add S3 credentials via AWS Console or CLI:

**Option A: Environment Variables (Quick)**
Add to your ECS task definition:
- `S3_ACCESS_KEY_ID`: Your AWS access key
- `S3_SECRET_ACCESS_KEY`: Your AWS secret key

**Option B: SSM Parameter Store (Recommended)**
1. Store credentials in SSM:
   ```bash
   aws ssm put-parameter --name "/flansa/s3/access_key_id" --value "YOUR_KEY" --type "SecureString"
   aws ssm put-parameter --name "/flansa/s3/secret_access_key" --value "YOUR_SECRET" --type "SecureString"
   ```

2. Reference in ECS task definition:
   ```json
   {
     "name": "S3_ACCESS_KEY_ID",
     "valueFrom": "/flansa/s3/access_key_id"
   }
   ```

### Step 3: Verify S3 Configuration
After ECS deployment completes, run the checker:

```bash
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/check_s3_config.py').read())
```

### Step 4: Test S3 Integration
Run the S3 configuration fixer to test upload:

```bash
exec(open('/home/ubuntu/frappe-bench/apps/flansa/aws-fixes/fix_s3_attachment_config.py').read())
```

## Required AWS Resources

### S3 Bucket Setup
1. **Bucket Name**: `flansa`
2. **Region**: `us-east-1`
3. **Folder Structure**: `flansa-files/` (prefix)

### S3 Bucket Policy (Required)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT:user/YOUR_IAM_USER"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::flansa/flansa-files/*"
    },
    {
      "Effect": "Allow", 
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT:user/YOUR_IAM_USER"
      },
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::flansa",
      "Condition": {
        "StringLike": {
          "s3:prefix": "flansa-files/*"
        }
      }
    }
  ]
}
```

### CORS Configuration (For Direct Uploads)
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Migration of Existing Files (Optional)
If you want to move the 19 existing files to S3:

```bash
# This command will migrate existing files
bench --site mysite.local migrate-to-s3
```

## Rollback Plan
If S3 causes issues, you can quickly rollback:

1. Update ECS task definition to remove S3 environment variables
2. Deploy previous task definition revision
3. Files will automatically fallback to local storage

## Scripts Ready for Execution

1. **ECS Update**: `update_ecs_s3_simple.sh` - Ready to run
2. **Configuration Check**: `check_s3_config.py` - Working via bench console
3. **S3 Testing**: `fix_s3_attachment_config.py` - Ready for testing
4. **Live Update**: `update_s3_live.py` - Instructions only (manual steps)

## Next Action Required
Run the ECS update script when you're ready to proceed:

```bash
cd /home/ubuntu/frappe-bench/claude-code/aws-docker-setup
./update_ecs_s3_simple.sh
```

This will add S3 environment variables to your existing deployment without any downtime.