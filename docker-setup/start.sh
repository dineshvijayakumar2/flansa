#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa Docker Container"
echo "============================================"

# Function to wait for service
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    
    echo "⏳ Waiting for $service_name at $host:$port..."
    while ! nc -z $host $port; do
        sleep 2
        echo "   Still waiting for $service_name..."
    done
    echo "✅ $service_name is ready!"
}

# Wait for dependencies
wait_for_service $DB_HOST $DB_PORT "MariaDB"
wait_for_service $REDIS_HOST $REDIS_PORT "Redis"

# Set site name
SITE_NAME=${FRAPPE_SITE_NAME:-mysite.local}

echo "🔧 Configuring Frappe site: $SITE_NAME"

# Check if site exists and has issues
if [ -f "sites/$SITE_NAME/site_config.json" ]; then
    echo "⚠️  Site $SITE_NAME exists but may have ERPNext dependency issues"
    echo "🔄 Recreating site cleanly..."
    rm -rf "sites/$SITE_NAME"
fi

# Create fresh site without ERPNext
echo "📝 Creating new site: $SITE_NAME"
bench new-site $SITE_NAME \
    --mariadb-root-password "$DB_PASSWORD" \
    --admin-password "$ADMIN_PASSWORD" \
    --no-mariadb-socket

echo "📱 Installing Flansa app on $SITE_NAME"
bench --site $SITE_NAME install-app flansa

echo "🏠 Setting up homepage configuration"
bench --site $SITE_NAME set-config home_page "app/flansa"
bench --site $SITE_NAME set-config default_workspace "Flansa"

# Apply any pending migrations
echo "🔄 Running migrations..."
bench --site $SITE_NAME migrate

# Clear cache
echo "🧹 Clearing cache..."
bench --site $SITE_NAME clear-cache

# Build assets if needed
echo "🔨 Building assets..."
bench build --app flansa

# Start the server
echo "🌟 Starting Frappe server on port 8000"
echo "🏠 Homepage will be: http://localhost:8000/app/flansa"
echo "============================================"

# Use bench serve for development or gunicorn for production
if [ "$DEVELOPER_MODE" = "1" ]; then
    bench start
else
    bench serve --host 0.0.0.0 --port 8000
fi