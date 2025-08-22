#!/bin/bash

# Continue AWS Infrastructure Setup after RDS creation

set -e

# Configuration
AWS_PROFILE="flansa-personal"
AWS_REGION="us-east-1"
PROJECT_NAME="flansa"
ENVIRONMENT="mvp"

# Resource names
DB_INSTANCE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-db"
REDIS_CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}-redis"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Continuing AWS Infrastructure Setup${NC}"
echo "======================================"

# Step 1: Check RDS Status
echo -e "\n${GREEN}Step 1: Checking RDS Status${NC}"
echo "--------------------------------------"

RDS_STATUS=$(aws rds describe-db-instances \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --db-instance-identifier ${DB_INSTANCE_NAME} \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text)

if [ "$RDS_STATUS" == "available" ]; then
    echo -e "${GREEN}✅ RDS instance is available${NC}"
    
    # Get RDS endpoint
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --db-instance-identifier ${DB_INSTANCE_NAME} \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    echo -e "${GREEN}RDS Endpoint: ${RDS_ENDPOINT}${NC}"
else
    echo -e "${YELLOW}⏳ RDS is still ${RDS_STATUS}. Please wait...${NC}"
    echo "Run this script again in a few minutes."
    exit 0
fi

# Step 2: Create ElastiCache Redis
echo -e "\n${GREEN}Step 2: Creating ElastiCache Redis${NC}"
echo "--------------------------------------"

# Get security group
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --filters "Name=group-name,Values=${PROJECT_NAME}-${ENVIRONMENT}-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo "Using Security Group: ${SECURITY_GROUP_ID}"

# Check if Redis cluster exists
if ! aws elasticache describe-cache-clusters \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --cache-cluster-id ${REDIS_CLUSTER_NAME} &>/dev/null; then
    
    echo "Creating ElastiCache Redis cluster..."
    aws elasticache create-cache-cluster \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --cache-cluster-id ${REDIS_CLUSTER_NAME} \
        --cache-node-type cache.t3.micro \
        --engine redis \
        --num-cache-nodes 1 \
        --port 6379 \
        --security-group-ids ${SECURITY_GROUP_ID}
    
    echo -e "${GREEN}✅ Redis cluster creation initiated${NC}"
    echo -e "${YELLOW}⏳ Waiting for Redis cluster to be available...${NC}"
    
    # Wait for Redis
    sleep 30
    
    REDIS_STATUS=$(aws elasticache describe-cache-clusters \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --cache-cluster-id ${REDIS_CLUSTER_NAME} \
        --query 'CacheClusters[0].CacheClusterStatus' \
        --output text)
    
    echo "Redis Status: ${REDIS_STATUS}"
else
    echo -e "${GREEN}✅ Redis cluster already exists${NC}"
fi

# Get Redis endpoint if available
REDIS_STATUS=$(aws elasticache describe-cache-clusters \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --cache-cluster-id ${REDIS_CLUSTER_NAME} \
    --query 'CacheClusters[0].CacheClusterStatus' \
    --output text 2>/dev/null || echo "not-found")

if [ "$REDIS_STATUS" == "available" ]; then
    REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --cache-cluster-id ${REDIS_CLUSTER_NAME} \
        --show-cache-node-info \
        --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
        --output text)
    
    echo -e "${GREEN}Redis Endpoint: ${REDIS_ENDPOINT}${NC}"
else
    echo -e "${YELLOW}Redis is ${REDIS_STATUS}${NC}"
fi

# Step 3: Generate Configuration File
if [ -n "$RDS_ENDPOINT" ] && [ -n "$REDIS_ENDPOINT" ]; then
    echo -e "\n${GREEN}Step 3: Generating Configuration${NC}"
    echo "--------------------------------------"
    
    # Generate secure passwords
    DB_PASSWORD=$(openssl rand -base64 25 | tr -d "/@\" " | cut -c1-25)
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "/@\" " | cut -c1-16)
    
    cat > aws-config.env << EOF
# AWS Infrastructure Configuration for Flansa MVP
# Generated on $(date)

# Database Configuration
DATABASE_URL=postgresql://flansa_admin:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/flansa_production
DB_HOST=${RDS_ENDPOINT}
DB_PORT=5432
DB_NAME=flansa_production
DB_USER=flansa_admin
DB_PASSWORD=${DB_PASSWORD}

# Redis Configuration  
REDIS_URL=redis://${REDIS_ENDPOINT}:6379
REDIS_HOST=${REDIS_ENDPOINT}
REDIS_PORT=6379

# AWS Configuration
AWS_REGION=${AWS_REGION}
AWS_ACCOUNT_ID=794038225817
SECURITY_GROUP_ID=${SECURITY_GROUP_ID}

# App Configuration
ADMIN_PASSWORD=${ADMIN_PASSWORD}
FRAPPE_SITE_NAME_HEADER=flansa-mvp.awsapprunner.com
EOF
    
    echo -e "${GREEN}✅ Configuration saved to aws-config.env${NC}"
    
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 AWS Infrastructure Ready!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Resources:"
    echo "  • RDS PostgreSQL: ${RDS_ENDPOINT}"
    echo "  • ElastiCache Redis: ${REDIS_ENDPOINT}"
    echo "  • Security Group: ${SECURITY_GROUP_ID}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Save the aws-config.env file securely!${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Build Docker image: docker build -t flansa-mvp ."
    echo "  2. Push to ECR (we'll set this up next)"
    echo "  3. Create App Runner service"
else
    echo -e "\n${YELLOW}Infrastructure not fully ready yet.${NC}"
    echo "Please run this script again in a few minutes."
fi