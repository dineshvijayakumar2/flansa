# Flansa AWS ECS/ECR Deployment Guide

Complete AWS deployment solution for Flansa application using ECS Fargate, RDS PostgreSQL, and ElastiCache Redis.

## 🏗️ Architecture

```
Internet → ALB → ECS Fargate → RDS PostgreSQL
                      ↓
                ElastiCache Redis
```

**AWS Services Used:**
- **ECS Fargate**: Container orchestration (serverless containers)
- **RDS PostgreSQL**: Managed database (recommended over MariaDB for AWS)
- **ElastiCache Redis**: Managed caching layer
- **Application Load Balancer**: Traffic distribution and health checks
- **ECR**: Container image registry
- **SSM Parameter Store**: Secure secret management
- **CloudWatch**: Logging and monitoring

## 🚀 Quick Deployment

### Prerequisites
- AWS CLI configured with appropriate permissions
- Docker installed locally
- AWS account with ECS, RDS, ECR permissions

### Step 1: Configure S3 Integration
```bash
# Configure S3 bucket and IAM permissions
./configure-s3.sh
```

### Step 2: Deploy Infrastructure
```bash
# Deploy complete infrastructure using CloudFormation
aws cloudformation create-stack \
  --stack-name flansa-infrastructure \
  --template-body file://infrastructure.yaml \
  --parameters ParameterKey=DBPassword,ParameterValue=YourSecureDBPassword \
               ParameterKey=AdminPassword,ParameterValue=YourSecureAdminPassword \
               ParameterKey=ECRImageURI,ParameterValue=567106097357.dkr.ecr.us-east-1.amazonaws.com/flansa-app:latest \
               ParameterKey=S3BucketName,ParameterValue=flansa \
  --capabilities CAPABILITY_NAMED_IAM
```

### Step 3: Build and Push to ECR
```bash
# Set your AWS account ID and region
export AWS_ACCOUNT_ID=567106097357
export AWS_REGION=us-east-1

# Build and push Docker image
./deploy-to-ecr.sh
```

### Step 4: Update and Deploy Service
```bash
# Update ECS service with new task definition
aws ecs update-service \
  --cluster flansa-cluster \
  --service flansa-service \
  --task-definition flansa-app
```

## 📁 File Overview

| File | Purpose |
|------|---------|
| `Dockerfile.aws` | AWS-optimized Dockerfile with PostgreSQL client and health checks |
| `aws-start.sh` | Startup script with RDS/ElastiCache/S3 configuration |
| `health-check.sh` | ECS health check endpoint |
| `task-definition.json` | ECS Fargate task definition template |
| `infrastructure.yaml` | Complete CloudFormation infrastructure with S3 integration |
| `deploy-to-ecr.sh` | Automated ECR build and deployment script |
| `configure-s3.sh` | S3 bucket setup and IAM configuration script |

## 🔧 Configuration

### Environment Variables (Set in Task Definition)
```bash
# Application Settings
PORT=8080
SITE_NAME=flansa.local
BUILD_ASSETS=true
GUNICORN_WORKERS=2

# Database (auto-configured from RDS)
RDS_ENDPOINT=auto-populated
RDS_USERNAME=frappe
RDS_PASSWORD=from-ssm-parameter
RDS_DB_NAME=flansa_db

# Redis (auto-configured from ElastiCache)
REDIS_ENDPOINT=auto-populated
REDIS_PORT=6379

# S3 File Storage (auto-configured)
S3_BUCKET_NAME=flansa
AWS_S3_REGION=us-east-1
S3_FOLDER_PATH=flansa-files
```

### SSM Parameters (Secure Secrets)
Parameters are automatically created by CloudFormation and configure-s3.sh:
- `/flansa/rds/password` - Database password
- `/flansa/admin/password` - Flansa admin password
- `/flansa/s3/bucket_name` - S3 bucket name
- `/flansa/s3/access_key_id` - S3 access key ID
- `/flansa/s3/secret_access_key` - S3 secret access key
- `/flansa/s3/region` - S3 region
- `/flansa/s3/folder_path` - S3 folder path

## 🔍 Monitoring and Health Checks

### ECS Health Checks
- **Endpoint**: `http://localhost:8080/api/method/ping`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Start Period**: 180 seconds (allows for app initialization)

### ALB Health Checks
- **Path**: `/api/method/ping`
- **Healthy Threshold**: 2 consecutive checks
- **Unhealthy Threshold**: 5 consecutive failures

### CloudWatch Logs
All application logs are automatically sent to:
- **Log Group**: `/ecs/flansa-app`
- **Retention**: 7 days (configurable)

## 🗄️ PostgreSQL vs MariaDB for AWS

**Why PostgreSQL is recommended for AWS:**

✅ **Advantages:**
- Better AWS RDS integration and features
- Superior JSON/JSONB support for complex data
- Advanced indexing and query optimization
- Better concurrent connection handling
- More robust data constraints and ACID compliance
- Excellent read replica and scaling options

✅ **Frappe Support:**
- Officially supported since Frappe v13+
- Production-ready with proper field mappings
- Your current Railway setup already uses PostgreSQL
- All migrations and features work correctly

## 🔒 Security Best Practices

**Implemented Security Features:**
- VPC with private subnets for database and cache
- Security groups with minimal required access
- RDS encryption at rest enabled
- Secrets stored in SSM Parameter Store (encrypted)
- ECS tasks run with least-privilege IAM roles
- Application Load Balancer in public subnets only

**Recommended Additional Security:**
- Enable AWS WAF on the ALB
- Configure SSL/TLS certificate with ACM
- Enable VPC Flow Logs
- Set up AWS Config for compliance monitoring
- Enable GuardDuty for threat detection

## 📊 Scaling and Performance

### Horizontal Scaling
```bash
# Scale ECS service to handle more traffic
aws ecs update-service \
  --cluster flansa-cluster \
  --service flansa-service \
  --desired-count 3
```

### Database Scaling
- **Read Replicas**: Add read replicas for read-heavy workloads
- **Connection Pooling**: Use RDS Proxy for connection management
- **Instance Scaling**: Upgrade RDS instance class as needed

### Container Optimization
- **Resource Allocation**: 1 vCPU, 2GB RAM (adjustable)
- **Gunicorn Workers**: 2 workers (1 per CPU core)
- **Health Check Tuning**: Optimized for fast startup and reliability

## 🚨 Troubleshooting

### Common Issues

**1. ECS Task Fails to Start**
```bash
# Check ECS service events
aws ecs describe-services --cluster flansa-cluster --services flansa-service

# Check task logs
aws logs get-log-events --log-group-name /ecs/flansa-app --log-stream-name STREAM_NAME
```

**2. Database Connection Issues**
- Verify RDS security group allows ECS access
- Check SSM parameters are correctly set
- Ensure RDS is in available state

**3. Load Balancer Health Check Failures**
- Check application is starting on port 8080
- Verify `/api/method/ping` endpoint is responding
- Increase health check timeout if needed

### Useful Commands
```bash
# Check ECS service status
aws ecs describe-services --cluster flansa-cluster --services flansa-service

# View recent logs
aws logs tail /ecs/flansa-app --follow

# Force new deployment
aws ecs update-service --cluster flansa-cluster --service flansa-service --force-new-deployment

# Check RDS status
aws rds describe-db-instances --db-instance-identifier flansa-postgresql
```

## 💰 Cost Optimization

**Estimated Monthly Costs (us-east-1):**
- ECS Fargate (1 task): ~$15
- RDS PostgreSQL (db.t3.micro): ~$15
- ElastiCache Redis (cache.t3.micro): ~$12
- S3 Storage (10GB): ~$0.30
- ALB: ~$18
- Data Transfer: ~$5
- **Total**: ~$65/month for small production workload

**Cost Saving Tips:**
- Use Spot pricing for non-critical environments
- Schedule ECS tasks to scale down during low traffic
- Use RDS reserved instances for predictable workloads
- Enable detailed billing to track usage patterns

## 📚 Additional Resources

- [ECS Fargate Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [RDS PostgreSQL Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Frappe Production Setup](https://frappeframework.com/docs/user/en/installation)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

**Need Help?** Check the CloudFormation stack events and ECS service events for detailed error messages during deployment.