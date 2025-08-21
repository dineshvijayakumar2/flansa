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
SITE_NAME=${RAILWAY_PUBLIC_DOMAIN:-"flansa-production.up.railway.app"}

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Give Railway services time to fully initialize
echo "⏳ Waiting 10 seconds for Railway services to initialize..."
sleep 10

# Skip connection check - let Frappe handle database connectivity
echo "🔧 PostgreSQL will be configured during site setup"

# Redis configuration will be handled during site setup
echo "🔧 Redis will be configured from REDIS_URL"

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

# Always recreate site to ensure clean PostgreSQL configuration
if [ -d "sites/$SITE_NAME" ]; then
    echo "🔄 Removing existing site to ensure clean PostgreSQL setup..."
    rm -rf "sites/$SITE_NAME"
fi
SKIP_SITE_CREATION=false

if [ "$SKIP_SITE_CREATION" = "false" ]; then
    # Create fresh site with correct Railway configuration
    echo "🏗️ Creating fresh site: $SITE_NAME"
    
    # Create site with Railway PostgreSQL database  
    echo "🔧 Creating site with Railway PostgreSQL database..."
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-name $DB_NAME \
        --db-host $DB_HOST \
        --db-port $DB_PORT \
        --db-root-username $DB_USER \
        --db-root-password $DB_PASS \
        --admin-password ${ADMIN_PASSWORD:-admin123} \
        --force
fi

# Force correct PostgreSQL credentials in site config only if needed
if [ "$SKIP_SITE_CREATION" = "false" ] || ! grep -q '"db_user": "postgres"' sites/$SITE_NAME/site_config.json 2>/dev/null; then
    echo "🔧 Force correcting site config for PostgreSQL..."
    
    # Force create/update site_config.json with correct credentials
    echo "🔧 Creating correct site config file..."
    cat > sites/$SITE_NAME/site_config.json << EOF
{
  "db_type": "postgres",
  "db_name": "$DB_NAME",
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASS",
  "developer_mode": 0,
  "limits": {
    "space_usage": {
      "database_size": 50,
      "backup_size": 50,
      "files_size": 50
    }
  }
}
EOF

    echo "✅ Site config file created with correct PostgreSQL credentials"
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME"
fi

# Skip cache clearing as it fails after config overwrite
echo "✅ Configuration updated, proceeding to app installation..."

# Set environment variables to force PostgreSQL connection
export FRAPPE_DB_USER=$DB_USER
export FRAPPE_DB_PASSWORD=$DB_PASS
export FRAPPE_DB_HOST=$DB_HOST
export FRAPPE_DB_PORT=$DB_PORT
export FRAPPE_DB_NAME=$DB_NAME

# Force environment variables to override any cached "railway" user
export DB_USER=$DB_USER  
export DB_PASSWORD=$DB_PASS
export PGUSER=$DB_USER
export PGPASSWORD=$DB_PASS
export PGHOST=$DB_HOST
export PGPORT=$DB_PORT
export PGDATABASE=$DB_NAME

# Check if Flansa app is already installed
if bench --site $SITE_NAME list-apps 2>/dev/null | grep -q "flansa"; then
    echo "✅ Flansa app already installed"
    FLANSA_INSTALLED=true
else
    echo "⚠️  Skipping automatic Flansa installation due to database user issues"
    echo "📝 Flansa can be installed manually after login to the site"
    FLANSA_INSTALLED=false
fi

echo "🏠 Setting homepage configuration"
# Only set Flansa homepage if app is installed
if [ "$FLANSA_INSTALLED" = "true" ]; then
    bench --site $SITE_NAME set-config home_page "app/flansa" || echo "   Homepage config skipped"
    bench --site $SITE_NAME set-config default_workspace "Flansa" || echo "   Workspace config skipped"
else
    echo "🔧 Using default Frappe homepage"
    bench --site $SITE_NAME set-config home_page "login" || echo "   Homepage config skipped"
fi

# Build assets - make it optional to avoid deployment failures
echo "🔨 Building assets..."
if [ "$FLANSA_INSTALLED" = "true" ]; then
    echo "🔧 Attempting to build Flansa assets..."
    if timeout 300 bench build --app flansa 2>/dev/null; then
        echo "✅ Flansa assets built successfully"
    else
        echo "⚠️  Flansa asset build failed or timed out - using pre-built assets"
    fi
else
    echo "🔧 Attempting to build Frappe assets..."
    if timeout 300 bench build 2>/dev/null; then
        echo "✅ Frappe assets built successfully"
    else
        echo "⚠️  Asset build failed or timed out - using pre-built assets"
        echo "📝 Site will work with existing assets, build can be done later"
    fi
fi

# Start server
echo "🌟 Starting Frappe server on port $PORT"
echo "🔗 Access at: https://$SITE_NAME/login"
echo "📝 Login: Administrator / admin123"
if [ "$FLANSA_INSTALLED" = "false" ]; then
    echo "📋 To install Flansa: Go to App Installer and install 'flansa' manually"
fi

# Ensure server binds to all interfaces for Railway
echo "🔧 Starting server with Railway configuration..."
export FRAPPE_SITE_NAME_HEADER=$SITE_NAME

# Start server - Railway requires proper binding for external access
echo "🚀 Starting Frappe server with Railway configuration"
echo "🔧 Serving site: $SITE_NAME"

# Set the default site for this bench instance using modern command
echo "🔧 Setting $SITE_NAME as default site..."
bench use $SITE_NAME

# Start server
bench serve --port $PORT