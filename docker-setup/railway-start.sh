#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa on Railway"
echo "======================================"

# Use Railway's PORT or default to 8000
PORT=${PORT:-8000}

# Set site name from Railway domain
SITE_NAME=${RAILWAY_PUBLIC_DOMAIN:-$FRAPPE_SITE_NAME}
if [ -z "$SITE_NAME" ]; then
    SITE_NAME="mysite.railway.app"
fi

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Wait for database if URL provided
if [ -n "$DATABASE_URL" ]; then
    echo "⏳ Waiting for database..."
    # Extract host and port from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | cut -d'@' -f2 | cut -d':' -f1)
    DB_PORT=$(echo $DATABASE_URL | cut -d':' -f4 | cut -d'/' -f1)
    
    while ! nc -z $DB_HOST $DB_PORT 2>/dev/null; do
        echo "   Waiting for database at $DB_HOST:$DB_PORT..."
        sleep 2
    done
    echo "✅ Database ready"
fi

# Wait for Redis if URL provided
if [ -n "$REDIS_URL" ]; then
    echo "⏳ Waiting for Redis..."
    REDIS_HOST=$(echo $REDIS_URL | cut -d'@' -f2 | cut -d':' -f1)
    REDIS_PORT=$(echo $REDIS_URL | cut -d':' -f3 | cut -d'/' -f1)
    
    while ! nc -z $REDIS_HOST $REDIS_PORT 2>/dev/null; do
        echo "   Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
        sleep 2
    done
    echo "✅ Redis ready"
fi

# Configure bench for Railway
echo "⚙️ Configuring bench..."

# Use Railway database URL if available
if [ -n "$DATABASE_URL" ]; then
    bench set-config -g db_host $DB_HOST
    bench set-config -g db_port $DB_PORT
else
    bench set-config -g db_host ${DB_HOST:-mysql}
fi

# Use Railway Redis URL if available  
if [ -n "$REDIS_URL" ]; then
    bench set-config -g redis_cache $REDIS_URL
    bench set-config -g redis_queue $REDIS_URL
    bench set-config -g redis_socketio $REDIS_URL
else
    bench set-config -g redis_cache redis://${REDIS_HOST:-redis}:${REDIS_PORT:-6379}
    bench set-config -g redis_queue redis://${REDIS_HOST:-redis}:${REDIS_PORT:-6379}
    bench set-config -g redis_socketio redis://${REDIS_HOST:-redis}:${REDIS_PORT:-6379}
fi

# Create site if it doesn't exist
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🏗️ Creating site: $SITE_NAME"
    
    bench new-site $SITE_NAME \
        --mariadb-root-password ${DB_PASSWORD:-admin123} \
        --admin-password ${ADMIN_PASSWORD:-admin123} \
        --no-mariadb-socket \
        --install-app flansa
    
    echo "🏠 Setting homepage configuration"
    bench --site $SITE_NAME set-config home_page "app/flansa"
    bench --site $SITE_NAME set-config default_workspace "Flansa"
else
    echo "✅ Site exists, running migrations..."
    bench --site $SITE_NAME migrate
fi

# Build assets
echo "🔨 Building assets..."
bench build --app flansa

# Start server
echo "🌟 Starting Frappe server on port $PORT"
echo "🔗 Access at: https://$SITE_NAME/app/flansa"

# Use Railway's PORT
bench serve --host 0.0.0.0 --port $PORT