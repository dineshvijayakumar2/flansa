#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa on Railway"
echo "======================================"
echo "🔗 Variables: MYSQL_URL and REDIS_URL should be available"
echo "🔍 Debug - MYSQL_URL length: ${#MYSQL_URL}"
echo "🔍 Debug - REDIS_URL length: ${#REDIS_URL}"

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

# Parse MySQL URL first if available
if [ -n "$MYSQL_URL" ]; then
    echo "🔧 Parsing MySQL URL for connection check..."
    URL_WITHOUT_PROTOCOL=$(echo $MYSQL_URL | sed 's/mysql:\/\///')
    HOST_PORT_DB=$(echo $URL_WITHOUT_PROTOCOL | cut -d'@' -f2)
    DB_HOST=$(echo $HOST_PORT_DB | cut -d':' -f1)
    PORT_DB=$(echo $HOST_PORT_DB | cut -d':' -f2)
    DB_PORT=$(echo $PORT_DB | cut -d'/' -f1)
    
    echo "⏳ Waiting for database at $DB_HOST:$DB_PORT..."
    
    # Try a few connection attempts with more verbose output
    ATTEMPT=0
    MAX_ATTEMPTS=10
    while ! nc -6 -z $DB_HOST $DB_PORT 2>/dev/null && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        ATTEMPT=$((ATTEMPT + 1))
        echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS - Still waiting for database..."
        
        # Try to resolve hostname and test connectivity
        if [ $ATTEMPT -eq 5 ]; then
            echo "🔍 Testing hostname resolution..."
            nslookup $DB_HOST || echo "   DNS resolution failed"
            echo "🔍 Testing ping connectivity..."
            ping -c 1 -W 3 $DB_HOST || echo "   Ping failed"
            echo "🔍 Testing with telnet-like approach..."
            timeout 3 bash -c "</dev/tcp/$DB_HOST/$DB_PORT" || echo "   TCP connection failed"
        fi
        
        sleep 3
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "⚠️  Database connection check failed, but proceeding anyway..."
        echo "🔍 Railway internal networking might be different - letting Frappe handle connection"
    else
        echo "✅ Database ready"
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
    
    # Configure bench with database settings
    bench set-config -g db_host $DB_HOST
    bench set-config -g db_port $DB_PORT
    bench set-config -g db_name $DB_NAME
    bench set-config -g root_login $DB_USER
    bench set-config -g root_password $DB_PASS
    
    # Configure MySQL to work with Frappe (disable strict mode)
    echo "🔧 Configuring MySQL settings for Frappe compatibility..."
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "
        SET GLOBAL sql_mode = 'ALLOW_INVALID_DATES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
        SET SESSION sql_mode = 'ALLOW_INVALID_DATES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
    " 2>/dev/null || echo "   MySQL configuration may need manual adjustment"
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
    
    # Create site with minimal parameters first
    echo "🔧 Creating site with basic parameters..."
    bench new-site $SITE_NAME \
        --db-root-password $DB_PASS \
        --admin-password ${ADMIN_PASSWORD:-admin123}
    
    # Update site config to use Railway database credentials
    echo "🔧 Updating site config for Railway database..."
    bench --site $SITE_NAME set-config db_name $DB_NAME
    bench --site $SITE_NAME set-config db_host $DB_HOST  
    bench --site $SITE_NAME set-config db_port $DB_PORT
    bench --site $SITE_NAME set-config db_user $DB_USER
    bench --site $SITE_NAME set-config db_password $DB_PASS
    
    # Install Flansa app separately
    echo "📱 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa
    
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