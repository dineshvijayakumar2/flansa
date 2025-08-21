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

# Parse MySQL URL first if available
if [ -n "$MYSQL_URL" ]; then
    echo "🔧 Parsing MySQL URL for connection check..."
    URL_WITHOUT_PROTOCOL=$(echo $MYSQL_URL | sed 's/mysql:\/\///')
    HOST_PORT_DB=$(echo $URL_WITHOUT_PROTOCOL | cut -d'@' -f2)
    DB_HOST=$(echo $HOST_PORT_DB | cut -d':' -f1)
    PORT_DB=$(echo $HOST_PORT_DB | cut -d':' -f2)
    DB_PORT=$(echo $PORT_DB | cut -d'/' -f1)
    
    echo "⏳ Waiting for database at $DB_HOST:$DB_PORT..."
    while ! nc -z $DB_HOST $DB_PORT 2>/dev/null; do
        echo "   Still waiting for database..."
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

# Extract database credentials from MYSQL_URL
if [ -n "$MYSQL_URL" ]; then
    echo "🔧 Parsing MySQL URL: $MYSQL_URL"
    
    # Parse mysql://user:pass@host:port/dbname format
    # Remove mysql:// prefix
    URL_WITHOUT_PROTOCOL=$(echo $MYSQL_URL | sed 's/mysql:\/\///')
    
    # Extract user:pass@host:port/dbname
    USER_PASS=$(echo $URL_WITHOUT_PROTOCOL | cut -d'@' -f1)
    DB_USER=$(echo $USER_PASS | cut -d':' -f1)
    DB_PASS=$(echo $USER_PASS | cut -d':' -f2)
    
    # Extract host:port/dbname  
    HOST_PORT_DB=$(echo $URL_WITHOUT_PROTOCOL | cut -d'@' -f2)
    DB_HOST=$(echo $HOST_PORT_DB | cut -d':' -f1)
    PORT_DB=$(echo $HOST_PORT_DB | cut -d':' -f2)
    DB_PORT=$(echo $PORT_DB | cut -d'/' -f1)
    DB_NAME=$(echo $PORT_DB | cut -d'/' -f2)
    
    echo "📊 Database config - Host: $DB_HOST, Port: $DB_PORT, User: $DB_USER, DB: $DB_NAME"
    
    bench set-config -g db_host $DB_HOST
    bench set-config -g db_port $DB_PORT
    bench set-config -g db_name $DB_NAME
    bench set-config -g db_user $DB_USER
    bench set-config -g db_password $DB_PASS
fi

# Configure Redis
if [ -n "$REDIS_URL" ]; then
    echo "🔧 Configuring Redis..."
    bench set-config -g redis_cache $REDIS_URL
    bench set-config -g redis_queue $REDIS_URL  
    bench set-config -g redis_socketio $REDIS_URL
fi

# Create site if it doesn't exist
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🏗️ Creating site: $SITE_NAME"
    
    bench new-site $SITE_NAME \
        --db-host $DB_HOST \
        --db-port $DB_PORT \
        --db-name $DB_NAME \
        --db-user $DB_USER \
        --db-password $DB_PASS \
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