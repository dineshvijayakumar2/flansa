#!/bin/bash

echo "🧪 Testing Docker Setup for Frappe + Flansa"
echo "============================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking Prerequisites..."
if command_exists docker; then
    echo "✅ Docker found: $(docker --version)"
else
    echo "❌ Docker not found"
    exit 1
fi

if command_exists docker-compose; then
    echo "✅ Docker Compose found: $(docker-compose --version)"
else
    echo "❌ Docker Compose not found"
    exit 1
fi

# Check Docker daemon
echo "🔍 Checking Docker daemon..."
if docker ps >/dev/null 2>&1; then
    echo "✅ Docker daemon running"
else
    echo "❌ Docker daemon not accessible"
    exit 1
fi

# Check available images
echo "🐳 Available Docker images:"
docker images | grep -E "(frappe|flansa)" || echo "No Frappe/Flansa images found"

# Check if build is needed
if docker images | grep -q "frappe-flansa"; then
    echo "✅ Frappe-Flansa image found"
    IMAGE_STATUS="ready"
else
    echo "⏳ Frappe-Flansa image not found - build needed"
    IMAGE_STATUS="build_needed"
fi

# Test docker-compose validation
echo "📝 Validating docker-compose.yml..."
if docker-compose config >/dev/null 2>&1; then
    echo "✅ docker-compose.yml is valid"
else
    echo "❌ docker-compose.yml validation failed"
    docker-compose config
    exit 1
fi

# Check environment file
if [ -f ".env" ]; then
    echo "✅ .env file found"
else
    echo "⚠️  .env file not found - using defaults"
fi

# Network test
echo "🌐 Testing network connectivity..."
if curl -s --connect-timeout 5 https://github.com >/dev/null; then
    echo "✅ Internet connectivity available"
else
    echo "⚠️  Limited internet connectivity"
fi

# Disk space check
echo "💾 Checking disk space..."
AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -gt 5 ]; then
    echo "✅ Sufficient disk space: ${AVAILABLE_SPACE}G available"
else
    echo "⚠️  Low disk space: ${AVAILABLE_SPACE}G available (recommend 5G+)"
fi

# Port availability check
echo "🔌 Checking port availability..."
for port in 8000 3306 6379; do
    if lsof -i :$port >/dev/null 2>&1; then
        echo "⚠️  Port $port is in use"
    else
        echo "✅ Port $port is available"
    fi
done

echo ""
echo "📊 Test Summary:"
echo "=================="
if [ "$IMAGE_STATUS" = "ready" ]; then
    echo "🚀 Ready to run: docker-compose up"
else
    echo "🔨 Next step: docker-compose build"
fi

echo ""
echo "🎯 Quick Commands:"
echo "==================="
echo "Build:  docker-compose build"
echo "Start:  docker-compose up -d"
echo "Logs:   docker-compose logs -f"
echo "Stop:   docker-compose down"
echo "Clean:  docker-compose down -v"
echo ""
echo "Homepage: http://localhost:8000/app/flansa"
echo "Login:    Administrator / admin123"
echo ""
echo "🎉 Docker setup test completed!"