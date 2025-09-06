#!/bin/bash
# Health check script for AWS ECS

PORT=${PORT:-8080}

# Check if the application is responding
curl -f http://localhost:$PORT/api/method/ping > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Health check passed"
    exit 0
else
    echo "❌ Health check failed"
    exit 1
fi