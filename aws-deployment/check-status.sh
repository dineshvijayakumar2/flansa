#!/bin/bash

# Quick AWS Infrastructure Status Checker

AWS_PROFILE="flansa-personal"
AWS_REGION="us-east-1"

echo "🔍 AWS Infrastructure Status Check"
echo "=================================="

# Check RDS
RDS_STATUS=$(aws rds describe-db-instances \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --db-instance-identifier flansa-mvp-db \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text 2>/dev/null || echo "not-found")

echo "📊 RDS PostgreSQL: $RDS_STATUS"
if [ "$RDS_STATUS" == "available" ]; then
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --db-instance-identifier flansa-mvp-db \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    echo "   Endpoint: $RDS_ENDPOINT"
fi

# Check Redis
REDIS_STATUS=$(aws elasticache describe-cache-clusters \
    --profile ${AWS_PROFILE} \
    --region ${AWS_REGION} \
    --cache-cluster-id flansa-mvp-redis \
    --query 'CacheClusters[0].CacheClusterStatus' \
    --output text 2>/dev/null || echo "not-found")

echo "🔴 ElastiCache Redis: $REDIS_STATUS"
if [ "$REDIS_STATUS" == "available" ]; then
    REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
        --profile ${AWS_PROFILE} \
        --region ${AWS_REGION} \
        --cache-cluster-id flansa-mvp-redis \
        --show-cache-node-info \
        --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
        --output text)
    echo "   Endpoint: $REDIS_ENDPOINT"
fi

echo ""
if [ "$RDS_STATUS" == "available" ] && [ "$REDIS_STATUS" == "available" ]; then
    echo "✅ Infrastructure is ready! Run './continue-setup.sh' to generate config."
else
    echo "⏳ Infrastructure still setting up. Check again in a few minutes."
fi