# Flansa MVP - AWS Deployment Guide

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AWS App Runner│    │   Amazon RDS     │    │  ElastiCache    │
│   (Flansa App)  │────│   (PostgreSQL)   │    │    (Redis)      │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                    ┌─────────────────┐
                    │    Route 53     │
                    │  (Custom Domain)│
                    └─────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Docker** installed locally for testing
4. **GitHub repository** with Flansa code

## Step 1: Create RDS PostgreSQL Database

```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
    --db-instance-identifier flansa-prod-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username flansa_admin \
    --master-user-password YOUR_SECURE_PASSWORD \
    --allocated-storage 20 \
    --storage-type gp2 \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --db-subnet-group-name default \
    --backup-retention-period 7 \
    --storage-encrypted \
    --deletion-protection
```

**RDS Configuration:**
- **Engine**: PostgreSQL 15.4+ (Frappe compatible)
- **Instance**: db.t3.micro (cost-effective for MVP)
- **Storage**: 20GB GP2 (expandable)
- **Security**: VPC security group with port 5432 access

## Step 2: Create ElastiCache Redis

```bash
# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
    --cache-cluster-id flansa-prod-redis \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --num-cache-nodes 1 \
    --port 6379 \
    --security-group-ids sg-xxxxxxxxx
```

**Redis Configuration:**
- **Engine**: Redis 7.x
- **Instance**: cache.t3.micro
- **Nodes**: 1 (single node for MVP)
- **Port**: 6379 (standard)

## Step 3: Set Up AWS App Runner Service

### 3.1 Create apprunner.yaml

```yaml
version: 1.0
runtime: docker
build:
  commands:
    build:
      - echo "Building Flansa MVP for AWS App Runner"
run:
  runtime-version: latest
  command: ./start.sh
  network:
    port: 8000
    env: PORT
  env:
    - name: DATABASE_URL
      value: "postgresql://flansa_admin:PASSWORD@flansa-prod-db.xxxxxx.us-east-1.rds.amazonaws.com:5432/postgres"
    - name: REDIS_URL
      value: "redis://flansa-prod-redis.xxxxxx.cache.amazonaws.com:6379"
    - name: ADMIN_PASSWORD
      value: "your-secure-admin-password"
    - name: AWS_REGION
      value: "us-east-1"
```

### 3.2 Create App Runner Service

```bash
# Create App Runner service
aws apprunner create-service \
    --service-name flansa-mvp \
    --source-configuration '{
        "ImageRepository": {
            "ImageIdentifier": "public.ecr.aws/your-account/flansa:latest",
            "ImageConfiguration": {
                "Port": "8000",
                "RuntimeEnvironmentVariables": {
                    "DATABASE_URL": "postgresql://flansa_admin:PASSWORD@endpoint:5432/postgres",
                    "REDIS_URL": "redis://endpoint:6379",
                    "ADMIN_PASSWORD": "your-secure-password"
                }
            },
            "ImageRepositoryType": "ECR_PUBLIC"
        },
        "AutoDeploymentsEnabled": true
    }' \
    --instance-configuration '{
        "Cpu": "0.25 vCPU",
        "Memory": "0.5 GB"
    }'
```

## Step 4: Deploy Using GitHub Actions (Recommended)

Create `.github/workflows/aws-deploy.yml`:

```yaml
name: Deploy to AWS App Runner

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Build and push Docker image
      run: |
        cd aws-deployment
        docker build -t flansa-mvp .
        docker tag flansa-mvp:latest public.ecr.aws/your-account/flansa:latest
        docker push public.ecr.aws/your-account/flansa:latest
    
    - name: Deploy to App Runner
      run: |
        aws apprunner start-deployment --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }}
```

## Step 5: Environment Variables

Set these in AWS App Runner service configuration:

```bash
# Database
DATABASE_URL=postgresql://flansa_admin:PASSWORD@endpoint:5432/postgres
REDIS_URL=redis://endpoint:6379

# App Configuration  
ADMIN_PASSWORD=your-secure-admin-password
FRAPPE_SITE_NAME_HEADER=your-domain.awsapprunner.com
AWS_REGION=us-east-1

# Optional
DEVELOPER_MODE=0
```

## Step 6: Custom Domain (Optional)

```bash
# Associate custom domain with App Runner
aws apprunner associate-custom-domain \
    --service-arn arn:aws:apprunner:us-east-1:account:service/flansa-mvp \
    --domain-name flansa.yourdomain.com
```

## Security Configuration

### VPC Security Groups

**App Runner Security Group:**
- Outbound: HTTPS (443), HTTP (80), PostgreSQL (5432), Redis (6379)

**RDS Security Group:**
- Inbound: PostgreSQL (5432) from App Runner SG

**ElastiCache Security Group:**
- Inbound: Redis (6379) from App Runner SG

### IAM Roles

**App Runner Service Role:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "rds:DescribeDBInstances",
                "elasticache:DescribeCacheClusters"
            ],
            "Resource": "*"
        }
    ]
}
```

## Monitoring & Logging

**CloudWatch Integration:**
- App Runner automatically sends logs to CloudWatch
- Set up alarms for error rates and response times
- Monitor RDS and ElastiCache metrics

## Cost Estimation (Monthly)

| Service | Configuration | Estimated Cost |
|---------|---------------|----------------|
| App Runner | 0.25 vCPU, 0.5GB | ~$25 |
| RDS PostgreSQL | db.t3.micro | ~$15 |
| ElastiCache Redis | cache.t3.micro | ~$15 |
| **Total** | | **~$55/month** |

## Deployment Commands

```bash
# 1. Create infrastructure
./scripts/create-aws-infrastructure.sh

# 2. Build and deploy
cd aws-deployment
docker build -t flansa-mvp .
docker push public.ecr.aws/your-account/flansa:latest

# 3. Update App Runner service
aws apprunner start-deployment --service-arn YOUR_SERVICE_ARN
```

## Advantages Over Railway

✅ **No internal service discovery conflicts**  
✅ **Full control over database configuration**  
✅ **Production-grade PostgreSQL with proper versions**  
✅ **Better logging and debugging capabilities**  
✅ **Predictable costs and scaling**  
✅ **Enterprise-ready infrastructure**  

## Next Steps

1. **Create AWS resources** (RDS, ElastiCache)
2. **Build and push Docker image** to ECR
3. **Create App Runner service** with environment variables
4. **Test deployment** and verify Flansa functionality
5. **Set up monitoring** and alerting
6. **Configure custom domain** (optional)

This AWS setup provides a robust, production-ready deployment environment for Flansa MVP Phase 1.