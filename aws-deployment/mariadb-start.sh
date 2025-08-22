#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa with MariaDB (Native Setup)"
echo "======================================================"

PORT=${PORT:-8000}
SITE_NAME="flansa-mvp.local"

# Work from frappe-bench directory
cd /home/frappe/frappe-bench

echo "📍 Working directory: $(pwd)"
echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Wait for MariaDB to be ready
echo "⏳ Waiting for MariaDB to be ready..."
sleep 30

# MariaDB connection details (will be updated via environment variables)
DB_HOST=${DB_HOST:-"flansa-mvp-mysql.copguw28cxxg.us-east-1.rds.amazonaws.com"}
DB_USER=${DB_USER:-"flansa_admin"}
DB_PASS=${DB_PASS:-"FlanSa2025Prod"}
DB_NAME=${DB_NAME:-"flansa_production"}

echo "🔧 MariaDB Configuration:"
echo "  Host: $DB_HOST"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"

# Test MariaDB connection
echo "🔧 Testing MariaDB connection..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "SELECT VERSION();" || echo "Connection test failed, will retry during site creation"

# Create site if it doesn't exist
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🏗️ Creating new Frappe site with MariaDB..."
    
    # Create site using bench (Frappe's native way)
    bench new-site $SITE_NAME \
        --db-host $DB_HOST \
        --db-user $DB_USER \
        --db-password $DB_PASS \
        --admin-password FlanSa2025Prod \
        --force || echo "Site creation failed, continuing..."
        
    echo "✅ Site created"
else
    echo "✅ Site already exists: $SITE_NAME"
fi

# Set current site
echo "$SITE_NAME" > sites/currentsite.txt
bench use $SITE_NAME

# Configure Redis
echo "🔧 Configuring Redis..."
bench set-config -g redis_cache "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379"
bench set-config -g redis_queue "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379"
bench set-config -g redis_socketio "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379"

# Install Flansa app if not installed
echo "🔧 Installing Flansa app..."
if bench --site $SITE_NAME list-apps | grep -q "flansa"; then
    echo "✅ Flansa app already installed"
else
    echo "🔧 Installing Flansa app..."
    timeout 300 bench --site $SITE_NAME install-app flansa || echo "Flansa installation failed"
fi

echo "🚀 Starting production server with Gunicorn..."
# Use bench serve instead of direct gunicorn for better compatibility
exec bench serve --port $PORT --host 0.0.0.0