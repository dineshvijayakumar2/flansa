#!/bin/bash
# Simple S3 ECS Update Script - Add S3 Environment Variables to Existing Deployment

set -e

echo "🔧 SIMPLE S3 ECS UPDATE"
echo "======================"

# Configuration - UPDATE THESE VALUES
ECS_CLUSTER="flansa-cluster"
ECS_SERVICE="flansa-service" 
TASK_FAMILY="flansa-task"
REGION="us-east-1"

echo "📊 Configuration:"
echo "  ECS Cluster: $ECS_CLUSTER"
echo "  ECS Service: $ECS_SERVICE"
echo "  Task Family: $TASK_FAMILY"
echo "  Region: $REGION"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Get current task definition
echo ""
echo "📋 Getting current task definition..."
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $TASK_FAMILY \
    --region $REGION \
    --query 'taskDefinition')

if [ $? -ne 0 ]; then
    echo "❌ Failed to get current task definition"
    echo "💡 Make sure the task family name '$TASK_FAMILY' is correct"
    exit 1
fi

echo "✅ Retrieved current task definition"

# Create new task definition with S3 environment variables
echo ""
echo "🔧 Adding S3 environment variables..."

# Add S3 environment variables to the existing task definition
NEW_TASK_DEF=$(echo $CURRENT_TASK_DEF | jq '
    # Remove fields that cannot be used in registration
    del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
    
    # Add S3 environment variables
    .containerDefinitions[0].environment += [
        {"name": "S3_BUCKET", "value": "flansa"},
        {"name": "S3_REGION", "value": "us-east-1"},
        {"name": "S3_FOLDER_PATH", "value": "flansa-files"},
        {"name": "USE_S3", "value": "1"},
        {"name": "USE_S3_FOR_PRIVATE_FILES", "value": "1"},
        {"name": "USE_S3_FOR_PUBLIC_FILES", "value": "1"},
        {"name": "MAX_FILE_SIZE", "value": "52428800"}
    ] |
    
    # Remove duplicate environment variables (keep last occurrence)
    .containerDefinitions[0].environment = (
        .containerDefinitions[0].environment | 
        group_by(.name) | 
        map(last)
    )
')

# Register new task definition
echo ""
echo "📝 Registering new task definition..."
NEW_REVISION=$(aws ecs register-task-definition \
    --region $REGION \
    --cli-input-json "$NEW_TASK_DEF" \
    --query 'taskDefinition.revision' \
    --output text)

if [ $? -ne 0 ]; then
    echo "❌ Failed to register new task definition"
    exit 1
fi

echo "✅ New task definition registered: $TASK_FAMILY:$NEW_REVISION"

# Update ECS service
echo ""
echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition "$TASK_FAMILY:$NEW_REVISION" \
    --region $REGION > /dev/null

if [ $? -ne 0 ]; then
    echo "❌ Failed to update ECS service"
    exit 1
fi

echo "✅ ECS service updated successfully"

echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "========================"
echo "1. Add S3 credentials to your ECS task definition:"
echo "   - S3_ACCESS_KEY_ID (from SSM or environment)"
echo "   - S3_SECRET_ACCESS_KEY (from SSM or environment)"
echo ""
echo "2. The service will automatically deploy the new task definition"
echo ""
echo "3. Monitor the deployment:"
echo "   aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE"
echo ""
echo "4. Verify S3 integration once deployed using check_s3_config.py"
echo ""
echo "🎉 S3 environment variables added to ECS task definition!"