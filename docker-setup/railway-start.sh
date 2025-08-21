#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa on Railway"
echo "======================================"
echo "🔗 Variables: DATABASE_URL and REDIS_URL should be available"
echo "🔍 Debug - DATABASE_URL length: ${#DATABASE_URL}"
echo "🔍 Debug - REDIS_URL length: ${#REDIS_URL}"

# Set environment variables for PostgreSQL usage
export FRAPPE_VERSION_CHECK_DISABLED=1
export SKIP_VERSION_CHECK=1
export FRAPPE_DB_TYPE=postgres

# Use Railway's PORT or default to 8000
PORT=${PORT:-8000}

# Set site name from Railway domain
SITE_NAME=${RAILWAY_PUBLIC_DOMAIN:-$FRAPPE_SITE_NAME}
if [ -z "$SITE_NAME" ]; then
    SITE_NAME="mysite.railway.app"
fi

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Give Railway services time to fully initialize
echo "⏳ Waiting 10 seconds for Railway services to initialize..."
sleep 10

# Parse DATABASE_URL (PostgreSQL) first if available
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Parsing PostgreSQL URL for connection check..."
    # Handle both postgres:// and postgresql:// schemes
    URL_WITHOUT_PROTOCOL=$(echo $DATABASE_URL | sed 's/postgres\(ql\)\?:\/\///')
    HOST_PORT_DB=$(echo $URL_WITHOUT_PROTOCOL | cut -d'@' -f2)
    DB_HOST=$(echo $HOST_PORT_DB | cut -d':' -f1)
    PORT_DB=$(echo $HOST_PORT_DB | cut -d':' -f2)
    DB_PORT=$(echo $PORT_DB | cut -d'/' -f1)
    
    echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
    
    # Try a few connection attempts
    ATTEMPT=0
    MAX_ATTEMPTS=10
    while ! nc -6 -z $DB_HOST $DB_PORT 2>/dev/null && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        ATTEMPT=$((ATTEMPT + 1))
        echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS - Still waiting for PostgreSQL..."
        
        # Try to resolve hostname only
        if [ $ATTEMPT -eq 5 ]; then
            echo "🔍 Testing hostname resolution..."
            nslookup $DB_HOST || echo "   DNS resolution failed"
        fi
        
        sleep 3
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "⚠️  Database connection check failed, but proceeding anyway..."
        echo "🔍 Railway internal networking might be different - letting Frappe handle connection"
    else
        echo "✅ PostgreSQL ready"
    fi
fi

# Wait for Redis if URL provided
if [ -n "$REDIS_URL" ]; then
    echo "⏳ Waiting for Redis..."
    echo "🔧 Parsing Redis URL: $REDIS_URL"
    
    # Parse redis://default:password@host:port format
    REDIS_URL_WITHOUT_PROTOCOL=$(echo $REDIS_URL | sed 's/redis:\/\///')
    REDIS_HOST=$(echo $REDIS_URL_WITHOUT_PROTOCOL | cut -d'@' -f2 | cut -d':' -f1)
    REDIS_PORT=$(echo $REDIS_URL_WITHOUT_PROTOCOL | cut -d'@' -f2 | cut -d':' -f2)
    
    echo "🔍 Redis connection details - Host: $REDIS_HOST, Port: $REDIS_PORT"
    
    # Skip Redis connection check for now - let Frappe handle it
    echo "⚠️  Skipping Redis connection check - letting Frappe handle connection"
fi

# Configure bench for Railway
echo "⚙️ Configuring bench..."

# Extract database credentials from DATABASE_URL (PostgreSQL)
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Parsing PostgreSQL URL: $DATABASE_URL"
    
    # Parse postgresql://user:pass@host:port/dbname format using sed
    # Extract username - everything between :// and first :
    DB_USER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
    
    # Extract password - everything between first : after username and @
    DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    
    # Extract host - everything between @ and first :
    DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
    
    # Extract port - everything between last : and /
    DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    
    # Extract database name - everything after last /
    DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^/?]*\).*|\1|p')
    
    echo "📊 PostgreSQL config - Host: $DB_HOST, Port: $DB_PORT, User: $DB_USER, DB: $DB_NAME"
    echo "🔍 Debug - Password length: ${#DB_PASS}"
    echo "🔍 Debug - Expected: User=postgres, Host=postgres.railway.internal, Port=5432, DB=railway"
    
    # Test PostgreSQL connection
    echo "🔧 Testing PostgreSQL connection..."
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" 2>/dev/null || echo "   PostgreSQL connection test failed - will let Frappe handle it"
    
    # Configure bench for PostgreSQL
    echo "🔧 Setting global PostgreSQL configuration..."
    bench set-config -g db_type postgres
    bench set-config -g db_host $DB_HOST
    bench set-config -g db_port $DB_PORT
    bench set-config -g db_name $DB_NAME
    bench set-config -g root_login $DB_USER
    bench set-config -g root_password $DB_PASS
    
    # Force PostgreSQL driver usage
    export FRAPPE_DB_TYPE=postgres
    
    echo "✅ PostgreSQL configuration complete - no strict mode issues!"
fi

# Configure Redis
if [ -n "$REDIS_URL" ]; then
    echo "🔧 Configuring Redis..."
    bench set-config -g redis_cache $REDIS_URL
    bench set-config -g redis_queue $REDIS_URL  
    bench set-config -g redis_socketio $REDIS_URL
fi

# Remove existing site if it has wrong configuration
if [ -d "sites/$SITE_NAME" ]; then
    echo "🧹 Removing existing site with incorrect configuration..."
    rm -rf "sites/$SITE_NAME"
fi

# Create fresh site with correct Railway configuration
echo "🏗️ Creating fresh site: $SITE_NAME"

# Create site with Railway PostgreSQL database  
echo "🔧 Creating site with Railway PostgreSQL database..."
bench new-site $SITE_NAME \
    --db-type postgres \
    --db-name $DB_NAME \
    --db-root-password $DB_PASS \
    --admin-password ${ADMIN_PASSWORD:-admin123} \
    --force

# Update site config to use Railway PostgreSQL credentials
echo "🔧 Updating site config for Railway PostgreSQL..."

bench --site $SITE_NAME set-config db_type postgres
bench --site $SITE_NAME set-config db_name $DB_NAME
bench --site $SITE_NAME set-config db_host $DB_HOST  
bench --site $SITE_NAME set-config db_port $DB_PORT
bench --site $SITE_NAME set-config db_user $DB_USER
bench --site $SITE_NAME set-config db_password $DB_PASS

# Force update the site config file directly to ensure correct values
echo "🔧 Force updating site config file..."
python3 -c "
import json
import os

site_config_path = 'sites/$SITE_NAME/site_config.json'
with open(site_config_path, 'r') as f:
    config = json.load(f)

# Force correct PostgreSQL settings
config['db_type'] = 'postgres'
config['db_name'] = '$DB_NAME'
config['db_host'] = '$DB_HOST'
config['db_port'] = $DB_PORT
config['db_user'] = '$DB_USER'
config['db_password'] = '$DB_PASS'

with open(site_config_path, 'w') as f:
    json.dump(config, f, indent=2)

print('✅ Site config file updated with correct PostgreSQL credentials')
print(f'   User: {config[\"db_user\"]}')
print(f'   Host: {config[\"db_host\"]}')
print(f'   Database: {config[\"db_name\"]}')
"

# Add PostgreSQL connection parameters
echo "🔧 Adding PostgreSQL compatibility parameters..."
bench --site $SITE_NAME set-config db_socket ""

# Install Flansa app separately
echo "📱 Installing Flansa app..."
bench --site $SITE_NAME install-app flansa

echo "🏠 Setting homepage configuration"
bench --site $SITE_NAME set-config home_page "app/flansa"
bench --site $SITE_NAME set-config default_workspace "Flansa"

# Build assets
echo "🔨 Building assets..."
bench build --app flansa

# Start server
echo "🌟 Starting Frappe server on port $PORT"
echo "🔗 Access at: https://$SITE_NAME/app/flansa"

# Use Railway's PORT
bench serve --host 0.0.0.0 --port $PORT