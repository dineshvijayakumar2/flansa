#!/bin/bash
set -e

# AWS ECR Deployment Script for Flansa
echo "🚀 Deploying Flansa to AWS ECR"
echo "==============================="

# Configuration
REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=${AWS_ACCOUNT_ID}
REPOSITORY_NAME="flansa-app"
IMAGE_TAG=${IMAGE_TAG:-latest}

if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ AWS_ACCOUNT_ID environment variable is required"
    exit 1
fi

ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPOSITORY_NAME"

echo "📊 Configuration:"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  Repository: $REPOSITORY_NAME"
echo "  Tag: $IMAGE_TAG"
echo "  ECR URI: $ECR_URI"
echo ""

# ============================================
# 1. LOGIN TO ECR
# ============================================
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

# ============================================
# 2. CREATE ECR REPOSITORY IF NOT EXISTS
# ============================================
echo "📦 Checking/Creating ECR Repository..."
if ! aws ecr describe-repositories --repository-names $REPOSITORY_NAME --region $REGION > /dev/null 2>&1; then
    echo "Creating ECR repository: $REPOSITORY_NAME"
    aws ecr create-repository \
        --repository-name $REPOSITORY_NAME \
        --region $REGION \
        --image-scanning-configuration scanOnPush=true \
        --image-tag-mutability MUTABLE
    
    # Set lifecycle policy to manage old images
    aws ecr put-lifecycle-policy \
        --repository-name $REPOSITORY_NAME \
        --region $REGION \
        --lifecycle-policy-text '{
            "rules": [
                {
                    "rulePriority": 1,
                    "description": "Keep last 10 images",
                    "selection": {
                        "tagStatus": "any",
                        "countType": "imageCountMoreThan",
                        "countNumber": 10
                    },
                    "action": {
                        "type": "expire"
                    }
                }
            ]
        }'
else
    echo "✅ Repository already exists"
fi

# ============================================
# 3. BUILD DOCKER IMAGE
# ============================================
echo ""
echo "🔨 Building Docker Image..."
docker build -f Dockerfile.aws -t $REPOSITORY_NAME:$IMAGE_TAG .

# ============================================
# 4. TAG AND PUSH IMAGE
# ============================================
echo ""
echo "📤 Tagging and Pushing Image..."
docker tag $REPOSITORY_NAME:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
docker push $ECR_URI:$IMAGE_TAG

# Also push as 'latest'
if [ "$IMAGE_TAG" != "latest" ]; then
    docker tag $REPOSITORY_NAME:$IMAGE_TAG $ECR_URI:latest
    docker push $ECR_URI:latest
fi

# ============================================
# 5. UPDATE TASK DEFINITION
# ============================================
echo ""
echo "📋 Updating Task Definition..."

# Replace placeholders in task definition
sed -e "s/{ACCOUNT_ID}/$ACCOUNT_ID/g" \
    -e "s/{REGION}/$REGION/g" \
    task-definition.json > task-definition-deployed.json

echo "✅ Task definition updated: task-definition-deployed.json"

# ============================================
# 6. DISPLAY NEXT STEPS
# ============================================
echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "📝 Next Steps:"
echo "1. Create RDS PostgreSQL database"
echo "2. Create ElastiCache Redis (optional)"
echo "3. Store secrets in SSM Parameter Store:"
echo "   aws ssm put-parameter --name /flansa/rds/endpoint --value 'YOUR_RDS_ENDPOINT' --type String"
echo "   aws ssm put-parameter --name /flansa/rds/username --value 'YOUR_DB_USER' --type String"
echo "   aws ssm put-parameter --name /flansa/rds/password --value 'YOUR_DB_PASSWORD' --type SecureString"
echo "   aws ssm put-parameter --name /flansa/rds/dbname --value 'flansa_db' --type String"
echo "   aws ssm put-parameter --name /flansa/admin/password --value 'YOUR_ADMIN_PASSWORD' --type SecureString"
echo ""
echo "4. Deploy ECS service:"
echo "   aws ecs create-service --cluster flansa-cluster --service-name flansa-service --task-definition flansa-app --desired-count 1"
echo ""
echo "🔗 ECR Image URI: $ECR_URI:$IMAGE_TAG"
echo "📋 Task Definition: task-definition-deployed.json"