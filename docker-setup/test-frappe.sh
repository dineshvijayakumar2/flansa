#!/bin/bash

echo "🧪 Testing Simple Frappe Setup"
echo "==============================="

# Clean up any existing containers
docker rm -f test-frappe test-db test-redis 2>/dev/null

# Start MariaDB
echo "📍 Starting MariaDB..."
docker run -d --name test-db \
  -e MYSQL_ROOT_PASSWORD=admin123 \
  -e MYSQL_DATABASE=frappe \
  -p 3308:3306 \
  mariadb:10.6

# Start Redis
echo "📍 Starting Redis..."
docker run -d --name test-redis \
  -p 6382:6379 \
  redis:7-alpine

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

# Test basic Frappe container
echo "📍 Testing Frappe container..."
docker run --rm \
  --link test-db:mariadb \
  --link test-redis:redis \
  -p 8082:8000 \
  frappe/bench:latest \
  bash -c "
    cd /home/frappe/frappe-bench &&
    bench set-config -g db_host mariadb &&
    bench set-config -g redis_cache redis://redis:6379 &&
    bench new-site test.local --mariadb-root-password admin123 --admin-password admin123 --no-mariadb-socket &&
    bench --site test.local list-apps &&
    echo '✅ Basic Frappe setup works!' &&
    bench serve --host 0.0.0.0 --port 8000 &
    sleep 10 &&
    curl -f http://localhost:8000 && echo '✅ Server responding!'
  "

echo "🎯 Test completed. Check if basic Frappe works before adding Flansa."