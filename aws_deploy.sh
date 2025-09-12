#!/bin/bash
# AWS ECS Deployment Script for Flansa
# Run this inside the container after git pull

echo "🚀 Starting Flansa AWS Deployment..."

# Navigate to app directory
cd /home/frappe/frappe-bench/apps/flansa || exit 1

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Clean Python cache
echo "🧹 Cleaning Python cache..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true

# Clear Frappe cache
echo "🗑️ Clearing Frappe cache..."
cd /home/frappe/frappe-bench
bench --site all clear-cache
bench --site all clear-website-cache

# Run migrations if needed
echo "🔄 Running migrations..."
bench --site all migrate

# Build assets
echo "📦 Building assets..."
bench build --app flansa

# Restart processes
echo "♻️ Restarting processes..."

# Try different restart methods based on what's available
if command -v supervisorctl &> /dev/null; then
    echo "Using supervisorctl..."
    supervisorctl restart all
elif command -v systemctl &> /dev/null; then
    echo "Using systemctl..."
    systemctl restart frappe-bench-web
    systemctl restart frappe-bench-workers
elif command -v pm2 &> /dev/null; then
    echo "Using pm2..."
    pm2 restart all
else
    echo "Using bench restart..."
    bench restart
    
    # If bench restart doesn't work, try HUP signal
    if [ $? -ne 0 ]; then
        echo "Sending HUP signal to gunicorn..."
        pkill -HUP gunicorn
    fi
fi

echo "✅ Deployment complete!"
echo ""
echo "🔍 Checking process status..."
ps aux | grep -E "gunicorn|frappe" | grep -v grep

# Test if site is responding
echo ""
echo "🌐 Testing site response..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8000/api/method/ping || echo "⚠️  Site may still be starting up..."

echo ""
echo "📝 Deployment completed at $(date)"