#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa"
echo "==========================="

# Wait for MariaDB
echo "⏳ Waiting for MariaDB..."
while ! nc -z $DB_HOST 3306; do
    sleep 1
done
echo "✅ MariaDB ready"

# Wait for Redis
echo "⏳ Waiting for Redis..."
while ! nc -z $REDIS_HOST 6379; do
    sleep 1
done
echo "✅ Redis ready"

# Configure bench
bench set-config -g db_host $DB_HOST
bench set-config -g redis_cache redis://$REDIS_HOST:6379
bench set-config -g redis_queue redis://$REDIS_HOST:6379
bench set-config -g redis_socketio redis://$REDIS_HOST:6379

# Create new site if needed
if [ ! -d "sites/$FRAPPE_SITE_NAME" ]; then
    echo "📝 Creating site $FRAPPE_SITE_NAME..."
    bench new-site $FRAPPE_SITE_NAME \
        --db-root-password $ADMIN_PASSWORD \
        --admin-password $ADMIN_PASSWORD \
        --no-mariadb-socket \
        --mariadb-root-password $ADMIN_PASSWORD
    
    # Install Flansa
    echo "📦 Installing Flansa app..."
    bench --site $FRAPPE_SITE_NAME install-app flansa
    
    # Configure homepage
    bench --site $FRAPPE_SITE_NAME set-config home_page "app/flansa"
    bench --site $FRAPPE_SITE_NAME set-config default_workspace "Flansa"
fi

# Use the site
bench use $FRAPPE_SITE_NAME

# Run migrations
echo "🔄 Running migrations..."
bench --site $FRAPPE_SITE_NAME migrate

# Build assets
echo "🔨 Building assets..."
bench build

# Start server
echo "🌟 Starting server on port 8000..."
echo "📍 Access at: http://localhost:8000"
bench serve --host 0.0.0.0 --port 8000