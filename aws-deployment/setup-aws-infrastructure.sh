#!/bin/bash

# AWS Infrastructure Setup Script for Flansa MVP
# This script creates all required AWS resources for deployment

set -e

# Configuration
AWS_PROFILE="flansa-personal"
AWS_REGION="us-east-1"
PROJECT_NAME="flansa"
ENVIRONMENT="mvp"

# Resource names
DB_INSTANCE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-db"
REDIS_CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}-redis"
APP_RUNNER_NAME="${PROJECT_NAME}-${ENVIRONMENT}-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AWS Infrastructure Setup for Flansa MVP${NC}"
echo "==========================================="
echo "AWS Account: 794038225817"
echo "Region: ${AWS_REGION}"
echo "Profile: ${AWS_PROFILE}"
echo ""

# Function to check if resource exists
check_resource_exists() {
    local resource_type=$1
    local resource_name=$2
    local check_command=$3
    
    echo -e "${YELLOW}Checking if ${resource_type} '${resource_name}' exists...${NC}"
    if eval "${check_command}" 2>/dev/null; then
        echo -e "${GREEN}✅ ${resource_type} '${resource_name}' already exists${NC}"
        return 0
    else
        echo -e "${YELLOW}📝 ${resource_type} '${resource_name}' does not exist, will create${NC}"
        return 1
    fi
}

# Step 1: Create VPC Security Groups
echo -e "\n${GREEN}Step 1: Setting up Security Groups${NC}"
echo "--------------------------------------"

# Check if security group exists
SG_EXISTS=$(aws ec2 describe-security-groups \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --filters "Name=group-name,Values=${PROJECT_NAME}-${ENVIRONMENT}-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "")

if [ -z "$SG_EXISTS" ] || [ "$SG_EXISTS" == "None" ]; then
    echo "Creating security group..."
    VPC_ID=$(aws ec2 describe-vpcs \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --filters "Name=is-default,Values=true" \
        --query 'Vpcs[0].VpcId' \
        --output text)
    
    SECURITY_GROUP_ID=$(aws ec2 create-security-group \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --group-name "${PROJECT_NAME}-${ENVIRONMENT}-sg" \
        --description "Security group for Flansa MVP" \
        --vpc-id ${VPC_ID} \
        --query 'GroupId' \
        --output text)
    
    # Add inbound rules (allow from anywhere for now - restrict in production)
    aws ec2 authorize-security-group-ingress \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --group-id ${SECURITY_GROUP_ID} \
        --ip-permissions IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges='[{CidrIp=0.0.0.0/0}]'
    
    aws ec2 authorize-security-group-ingress \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --group-id ${SECURITY_GROUP_ID} \
        --ip-permissions IpProtocol=tcp,FromPort=6379,ToPort=6379,IpRanges='[{CidrIp=0.0.0.0/0}]'
    
    echo -e "${GREEN}✅ Security group created: ${SECURITY_GROUP_ID}${NC}"
else
    SECURITY_GROUP_ID=$SG_EXISTS
    echo -e "${GREEN}✅ Using existing security group: ${SECURITY_GROUP_ID}${NC}"
fi

# Step 2: Create RDS PostgreSQL Database
echo -e "\n${GREEN}Step 2: Creating RDS PostgreSQL Database${NC}"
echo "--------------------------------------"

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "/@\" " | cut -c1-25)
echo -e "${YELLOW}📝 Generated secure database password${NC}"

# Check if RDS instance exists
if ! aws rds describe-db-instances \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --db-instance-identifier ${DB_INSTANCE_NAME} &>/dev/null; then
    
    echo "Creating RDS PostgreSQL instance..."
    aws rds create-db-instance \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --db-instance-identifier ${DB_INSTANCE_NAME} \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version "15.7" \
        --master-username flansa_admin \
        --master-user-password "${DB_PASSWORD}" \
        --allocated-storage 20 \
        --storage-type gp2 \
        --vpc-security-group-ids ${SECURITY_GROUP_ID} \
        --backup-retention-period 7 \
        --storage-encrypted \
        --no-publicly-accessible \
        --db-name flansa_production
    
    echo -e "${GREEN}✅ RDS instance creation initiated${NC}"
    echo -e "${YELLOW}⏳ Waiting for RDS instance to be available (this may take 5-10 minutes)...${NC}"
    
    aws rds wait db-instance-available \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --db-instance-identifier ${DB_INSTANCE_NAME}
    
    echo -e "${GREEN}✅ RDS instance is now available${NC}"
else
    echo -e "${GREEN}✅ RDS instance already exists${NC}"
fi

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --db-instance-identifier ${DB_INSTANCE_NAME} \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo -e "${GREEN}RDS Endpoint: ${RDS_ENDPOINT}${NC}"

# Step 3: Create ElastiCache Redis
echo -e "\n${GREEN}Step 3: Creating ElastiCache Redis${NC}"
echo "--------------------------------------"

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
    
    aws elasticache wait cache-cluster-available \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --cache-cluster-id ${REDIS_CLUSTER_NAME}
    
    echo -e "${GREEN}✅ Redis cluster is now available${NC}"
else
    echo -e "${GREEN}✅ Redis cluster already exists${NC}"
fi

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --cache-cluster-id ${REDIS_CLUSTER_NAME} \
    --show-cache-node-info \
    --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
    --output text)

echo -e "${GREEN}Redis Endpoint: ${REDIS_ENDPOINT}${NC}"

# Step 4: Save configuration
echo -e "\n${GREEN}Step 4: Saving Configuration${NC}"
echo "--------------------------------------"

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
ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "/@\" " | cut -c1-16)
FRAPPE_SITE_NAME_HEADER=flansa-mvp.awsapprunner.com
EOF

echo -e "${GREEN}✅ Configuration saved to aws-config.env${NC}"

# Step 5: Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 AWS Infrastructure Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Resources Created:"
echo "  • Security Group: ${SECURITY_GROUP_ID}"
echo "  • RDS PostgreSQL: ${RDS_ENDPOINT}"
echo "  • ElastiCache Redis: ${REDIS_ENDPOINT}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save the credentials from aws-config.env securely!${NC}"
echo -e "${YELLOW}    Database Password and Admin Password have been generated.${NC}"
echo ""
echo "Next Steps:"
echo "  1. Review aws-config.env for connection details"
echo "  2. Build and push Docker image to ECR"
echo "  3. Create App Runner service"
echo ""
echo -e "${GREEN}Run './deploy-to-apprunner.sh' to continue with deployment${NC}"