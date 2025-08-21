#!/bin/bash

echo "🎯 Final Docker Test - Clean Setup"
echo "=================================="

# Complete cleanup
echo "🧹 Complete cleanup..."
docker compose -f working-compose.yml down -v 2>/dev/null
docker volume prune -f
docker container prune -f

# Start fresh with a single container test
echo "🚀 Starting fresh test..."

# Remove any existing container
docker rm -f final-test 2>/dev/null

# Start MariaDB and Redis first
docker run -d --name test-mariadb-final -e MYSQL_ROOT_PASSWORD=admin123 -p 3309:3306 mariadb:10.6
docker run -d --name test-redis-final -p 6383:6379 redis:7-alpine

echo "⏳ Waiting for services to be ready..."
sleep 10

# Test Frappe setup step by step
echo "🔧 Testing Frappe setup..."
docker run --rm \
  --link test-mariadb-final:mariadb \
  --link test-redis-final:redis \
  -p 8085:8000 \
  -v /tmp/frappe-test:/home/frappe/frappe-bench \
  frappe/bench:latest \
  bash -c '
    set -e
    cd /home/frappe
    rm -rf frappe-bench
    echo "📦 Initializing bench..."
    bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench
    cd frappe-bench
    
    echo "⚙️ Configuring connections..."
    bench set-config -g db_host mariadb
    bench set-config -g redis_cache redis://redis:6379
    bench set-config -g redis_queue redis://redis:6379
    bench set-config -g redis_socketio redis://redis:6379
    
    echo "🏗️ Creating site..."
    bench new-site mysite.local --mariadb-root-password admin123 --admin-password admin123 --no-mariadb-socket
    
    echo "🌐 Testing basic site..."
    bench --site mysite.local list-apps
    
    echo "🚀 Starting basic Frappe server..."
    timeout 30 bench serve --host 0.0.0.0 --port 8000 &
    
    sleep 5
    echo "✅ Basic Frappe setup completed!"
    wait
  ' &

echo ""
echo "📍 Test running on http://localhost:8085"
echo "📍 This tests ONLY basic Frappe (no Flansa yet)"
echo "📍 Press Ctrl+C to stop when ready"

# Wait for user input
read -p "Press Enter to cleanup and continue..."

# Cleanup
docker rm -f final-test test-mariadb-final test-redis-final 2>/dev/null
rm -rf /tmp/frappe-test

echo "✅ Test completed!"