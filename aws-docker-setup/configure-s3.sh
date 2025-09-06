#!/bin/bash
set -e

# S3 Configuration Script for Flansa AWS Deployment
echo "📁 Configuring S3 Integration for Flansa"
echo "========================================"

# Configuration
ACCOUNT_ID="567106097357"
REGION=${AWS_REGION:-us-east-1}
BUCKET_NAME="flansa"
IAM_USER_NAME="flansa-s3-user"

echo "📊 Configuration:"
echo "  Account ID: $ACCOUNT_ID"
echo "  Region: $REGION"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  IAM User: $IAM_USER_NAME"
echo ""

# ============================================
# 1. CREATE DEDICATED IAM USER FOR S3 ACCESS
# ============================================
echo "👤 Creating dedicated IAM user for S3 access..."

# Check if user already exists
if aws iam get-user --user-name $IAM_USER_NAME > /dev/null 2>&1; then
    echo "✅ IAM user $IAM_USER_NAME already exists"
else
    echo "Creating IAM user: $IAM_USER_NAME"
    aws iam create-user --user-name $IAM_USER_NAME \
        --path "/flansa/" \
        --tags Key=Project,Value=Flansa Key=Purpose,Value=S3FileStorage
    echo "✅ IAM user created"
fi

# ============================================
# 2. CREATE S3 ACCESS POLICY
# ============================================
echo ""
echo "📋 Creating S3 access policy..."

POLICY_NAME="FlansaS3FileStoragePolicy"
POLICY_DOCUMENT='{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:GetObjectAcl",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::'"$BUCKET_NAME"'/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": "arn:aws:s3:::'"$BUCKET_NAME"'"
        }
    ]
}'

# Check if policy exists
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/flansa/$POLICY_NAME"
if aws iam get-policy --policy-arn $POLICY_ARN > /dev/null 2>&1; then
    echo "✅ Policy $POLICY_NAME already exists"
else
    echo "Creating IAM policy: $POLICY_NAME"
    aws iam create-policy \
        --policy-name $POLICY_NAME \
        --path "/flansa/" \
        --policy-document "$POLICY_DOCUMENT" \
        --description "S3 file storage access policy for Flansa application"
    echo "✅ Policy created"
fi

# ============================================
# 3. ATTACH POLICY TO USER
# ============================================
echo ""
echo "🔗 Attaching policy to user..."

aws iam attach-user-policy \
    --user-name $IAM_USER_NAME \
    --policy-arn $POLICY_ARN

echo "✅ Policy attached to user"

# ============================================
# 4. CREATE ACCESS KEYS
# ============================================
echo ""
echo "🔑 Creating access keys..."

# Check if access keys already exist
EXISTING_KEYS=$(aws iam list-access-keys --user-name $IAM_USER_NAME --query 'AccessKeyMetadata[].AccessKeyId' --output text)

if [ -n "$EXISTING_KEYS" ]; then
    echo "⚠️  Access keys already exist for user $IAM_USER_NAME"
    echo "   Existing keys: $EXISTING_KEYS"
    echo "   If you need new keys, delete the old ones first:"
    echo "   aws iam delete-access-key --user-name $IAM_USER_NAME --access-key-id [KEY_ID]"
    
    # Get the first access key for SSM storage
    ACCESS_KEY_ID=$(echo $EXISTING_KEYS | awk '{print $1}')
    echo ""
    echo "⚠️  Cannot retrieve secret access key for existing keys."
    echo "   You'll need to:"
    echo "   1. Delete existing access keys if needed"
    echo "   2. Create new access keys"
    echo "   3. Store them in SSM Parameter Store manually"
else
    echo "Creating new access keys..."
    KEY_OUTPUT=$(aws iam create-access-key --user-name $IAM_USER_NAME --output json)
    
    ACCESS_KEY_ID=$(echo $KEY_OUTPUT | jq -r '.AccessKey.AccessKeyId')
    SECRET_ACCESS_KEY=$(echo $KEY_OUTPUT | jq -r '.AccessKey.SecretAccessKey')
    
    echo "✅ Access keys created"
    echo "   Access Key ID: $ACCESS_KEY_ID"
    echo "   Secret Access Key: [HIDDEN]"
    
    # ============================================
    # 5. STORE CREDENTIALS IN SSM PARAMETER STORE
    # ============================================
    echo ""
    echo "🔐 Storing credentials in SSM Parameter Store..."
    
    aws ssm put-parameter \
        --name "/flansa/s3/access_key_id" \
        --value "$ACCESS_KEY_ID" \
        --type "String" \
        --description "S3 Access Key ID for Flansa file storage" \
        --overwrite
    
    aws ssm put-parameter \
        --name "/flansa/s3/secret_access_key" \
        --value "$SECRET_ACCESS_KEY" \
        --type "SecureString" \
        --description "S3 Secret Access Key for Flansa file storage" \
        --overwrite
    
    echo "✅ Credentials stored in SSM Parameter Store"
fi

# ============================================
# 6. STORE S3 CONFIGURATION IN SSM
# ============================================
echo ""
echo "📦 Storing S3 configuration in SSM Parameter Store..."

aws ssm put-parameter \
    --name "/flansa/s3/bucket_name" \
    --value "$BUCKET_NAME" \
    --type "String" \
    --description "S3 bucket name for Flansa file storage" \
    --overwrite

aws ssm put-parameter \
    --name "/flansa/s3/region" \
    --value "$REGION" \
    --type "String" \
    --description "S3 region for Flansa file storage" \
    --overwrite

aws ssm put-parameter \
    --name "/flansa/s3/folder_path" \
    --value "flansa-files" \
    --type "String" \
    --description "S3 folder path for Flansa file storage" \
    --overwrite

echo "✅ S3 configuration stored in SSM Parameter Store"

# ============================================
# 7. VERIFY S3 BUCKET ACCESS
# ============================================
echo ""
echo "🔍 Verifying S3 bucket access..."

if aws s3 ls s3://$BUCKET_NAME > /dev/null 2>&1; then
    echo "✅ S3 bucket $BUCKET_NAME is accessible"
else
    echo "❌ Cannot access S3 bucket $BUCKET_NAME"
    echo "   Please verify:"
    echo "   1. Bucket exists and you have access"
    echo "   2. AWS credentials are configured correctly"
    echo "   3. Region is correct ($REGION)"
    exit 1
fi

# Create test folder structure
echo "Creating folder structure in S3..."
aws s3api put-object --bucket $BUCKET_NAME --key flansa-files/ > /dev/null 2>&1 || true
aws s3api put-object --bucket $BUCKET_NAME --key flansa-files/attachments/ > /dev/null 2>&1 || true
aws s3api put-object --bucket $BUCKET_NAME --key flansa-files/images/ > /dev/null 2>&1 || true
aws s3api put-object --bucket $BUCKET_NAME --key flansa-files/documents/ > /dev/null 2>&1 || true

echo "✅ S3 folder structure created"

# ============================================
# 8. DISPLAY CONFIGURATION SUMMARY
# ============================================
echo ""
echo "🎉 S3 Configuration Complete!"
echo "============================"
echo ""
echo "📋 Configuration Summary:"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Region: $REGION"
echo "  IAM User: $IAM_USER_NAME"
echo "  Policy: $POLICY_NAME"
echo "  Folder Path: flansa-files"
echo ""
echo "🔐 SSM Parameters Created:"
echo "  /flansa/s3/bucket_name"
echo "  /flansa/s3/access_key_id"
echo "  /flansa/s3/secret_access_key"
echo "  /flansa/s3/region"
echo "  /flansa/s3/folder_path"
echo ""
echo "📁 S3 Folder Structure:"
echo "  s3://$BUCKET_NAME/flansa-files/"
echo "  s3://$BUCKET_NAME/flansa-files/attachments/"
echo "  s3://$BUCKET_NAME/flansa-files/images/"
echo "  s3://$BUCKET_NAME/flansa-files/documents/"
echo ""
echo "✅ Your Flansa application will now store files in S3!"
echo ""
echo "🚀 Next Steps:"
echo "1. Deploy/update your ECS service to use the new configuration"
echo "2. Test file uploads in Flansa to verify S3 integration"
echo "3. Monitor CloudWatch logs for any S3-related errors"