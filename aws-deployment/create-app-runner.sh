#!/bin/bash

# Create AWS App Runner Service for Flansa MVP

set -e

# Configuration
AWS_PROFILE="flansa-personal"
AWS_REGION="us-east-1"
SERVICE_NAME="flansa-mvp"
ECR_REPOSITORY="flansa-mvp"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Creating AWS App Runner Service for Flansa MVP${NC}"
echo "=================================================="

# Load configuration
if [ -f "aws-config.env" ]; then
    source aws-config.env
    echo -e "${GREEN}✅ Configuration loaded from aws-config.env${NC}"
else
    echo -e "${RED}❌ aws-config.env not found. Run infrastructure setup first.${NC}"
    exit 1
fi

# Step 1: Create ECR Repository
echo -e "\n${GREEN}Step 1: Creating ECR Repository${NC}"
echo "--------------------------------------"

# Check if ECR repository exists
if aws ecr describe-repositories \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --repository-names ${ECR_REPOSITORY} &>/dev/null; then
    echo -e "${GREEN}✅ ECR repository already exists${NC}"
else
    echo "Creating ECR repository..."
    aws ecr create-repository \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --repository-name ${ECR_REPOSITORY} \
        --image-scanning-configuration scanOnPush=true
    echo -e "${GREEN}✅ ECR repository created${NC}"
fi

# Get ECR repository URI
ECR_URI=$(aws ecr describe-repositories \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --repository-names ${ECR_REPOSITORY} \
    --query 'repositories[0].repositoryUri' \
    --output text)

echo -e "${GREEN}ECR Repository: ${ECR_URI}${NC}"

# Step 2: Get ECR login and push image
echo -e "\n${GREEN}Step 2: Pushing Docker Image to ECR${NC}"
echo "--------------------------------------"

# Get ECR login token
echo "Getting ECR login token..."
aws ecr get-login-password \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI%/*}

# Tag and push image
echo "Tagging and pushing image..."
docker tag flansa-mvp:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

echo -e "${GREEN}✅ Image pushed to ECR${NC}"

# Step 3: Create IAM Role for App Runner
echo -e "\n${GREEN}Step 3: Creating IAM Role for App Runner${NC}"
echo "--------------------------------------"

ROLE_NAME="flansa-app-runner-role"

# Check if role exists
if aws iam get-role \
    --profile ${AWS_PROFILE} \
    --role-name ${ROLE_NAME} &>/dev/null; then
    echo -e "${GREEN}✅ IAM role already exists${NC}"
else
    echo "Creating IAM role..."
    
    # Create trust policy
    cat > app-runner-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "apprunner.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

    aws iam create-role \
        --profile ${AWS_PROFILE} \
        --role-name ${ROLE_NAME} \
        --assume-role-policy-document file://app-runner-trust-policy.json

    # Attach ECR access policy
    aws iam attach-role-policy \
        --profile ${AWS_PROFILE} \
        --role-name ${ROLE_NAME} \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

    echo -e "${GREEN}✅ IAM role created${NC}"
fi

# Get role ARN
ROLE_ARN=$(aws iam get-role \
    --profile ${AWS_PROFILE} \
    --role-name ${ROLE_NAME} \
    --query 'Role.Arn' \
    --output text)

echo -e "${GREEN}Role ARN: ${ROLE_ARN}${NC}"

# Step 4: Create App Runner Service
echo -e "\n${GREEN}Step 4: Creating App Runner Service${NC}"
echo "--------------------------------------"

# Check if service exists
if aws apprunner describe-service \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --service-arn "arn:aws:apprunner:${AWS_REGION}:${AWS_ACCOUNT_ID}:service/${SERVICE_NAME}" &>/dev/null; then
    echo -e "${GREEN}✅ App Runner service already exists${NC}"
else
    echo "Creating App Runner service..."
    
    # Create service configuration
    cat > apprunner-service-config.json << EOF
{
    "ServiceName": "${SERVICE_NAME}",
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": "${ECR_URI}:latest",
            "ImageConfiguration": {
                "Port": "8000",
                "RuntimeEnvironmentVariables": {
                    "DATABASE_URL": "${DATABASE_URL}",
                    "REDIS_URL": "${REDIS_URL}",
                    "ADMIN_PASSWORD": "${ADMIN_PASSWORD}",
                    "AWS_REGION": "${AWS_REGION}",
                    "FRAPPE_SITE_NAME_HEADER": "TBD"
                }
            },
            "ImageRepositoryType": "ECR"
        },
        "AutoDeploymentsEnabled": false
    },
    "InstanceConfiguration": {
        "Cpu": "0.25 vCPU",
        "Memory": "0.5 GB"
    }
}
EOF

    # Create the service
    SERVICE_ARN=$(aws apprunner create-service \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --cli-input-json file://apprunner-service-config.json \
        --query 'Service.ServiceArn' \
        --output text)

    echo -e "${GREEN}✅ App Runner service created${NC}"
    echo -e "${GREEN}Service ARN: ${SERVICE_ARN}${NC}"

    # Wait for service to be running
    echo -e "${YELLOW}⏳ Waiting for service to be running...${NC}"
    aws apprunner wait service-running \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --service-arn ${SERVICE_ARN}

    echo -e "${GREEN}✅ Service is now running${NC}"
fi

# Step 5: Get service URL
echo -e "\n${GREEN}Step 5: Getting Service Information${NC}"
echo "--------------------------------------"

# Get service details
SERVICE_INFO=$(aws apprunner describe-service \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --service-arn "arn:aws:apprunner:${AWS_REGION}:${AWS_ACCOUNT_ID}:service/${SERVICE_NAME}" \
    --query 'Service.[ServiceUrl,Status]' \
    --output text)

SERVICE_URL=$(echo $SERVICE_INFO | cut -d' ' -f1)
SERVICE_STATUS=$(echo $SERVICE_INFO | cut -d' ' -f2)

echo -e "${GREEN}Service URL: https://${SERVICE_URL}${NC}"
echo -e "${GREEN}Service Status: ${SERVICE_STATUS}${NC}"

# Clean up temporary files
rm -f app-runner-trust-policy.json apprunner-service-config.json

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Flansa MVP Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🔗 Access your Flansa MVP at: https://${SERVICE_URL}"
echo "📝 Login: Administrator / ${ADMIN_PASSWORD}"
echo ""
echo "📊 Resources Created:"
echo "  • ECR Repository: ${ECR_URI}"
echo "  • App Runner Service: ${SERVICE_NAME}"
echo "  • RDS PostgreSQL: ${DB_HOST}"
echo "  • ElastiCache Redis: ${REDIS_HOST}"
echo ""
echo -e "${YELLOW}💡 Next Steps:${NC}"
echo "  1. Access the application and test functionality"
echo "  2. Set up custom domain (optional)"
echo "  3. Configure monitoring and alerting"
echo "  4. Set up CI/CD pipeline for updates"
echo ""
echo -e "${GREEN}Deployment successful! 🚀${NC}"