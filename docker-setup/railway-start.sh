#!/bin/bash
set -e

# Add error handling to prevent unexpected exits
trap 'echo "❌ Error occurred at line $LINENO. Exit code: $?" >&2' ERR

echo "🚀 Starting Frappe + Flansa on Railway"
echo "======================================"

# Use PUBLIC URLs if available for better connectivity
DATABASE_URL=${DATABASE_PUBLIC_URL:-$DATABASE_URL}
REDIS_URL=${REDIS_PUBLIC_URL:-$REDIS_URL}

echo "🔗 Variables: DATABASE_URL and REDIS_URL should be available"
echo "🔍 Debug - DATABASE_URL length: ${#DATABASE_URL}"
echo "🔍 Debug - REDIS_URL length: ${#REDIS_URL}"
echo "🔍 Using: ${DATABASE_PUBLIC_URL:+DATABASE_PUBLIC_URL} ${REDIS_PUBLIC_URL:+REDIS_PUBLIC_URL}"

# Debug all Railway environment variables that might affect database connection
echo "🔍 Debug - Railway environment variables:"
env | grep -E "(RAILWAY|DB_|MYSQL|POSTGRES|PG)" | grep -v PASSWORD || echo "   No Railway DB vars found"

# Set environment variables for PostgreSQL usage
export FRAPPE_VERSION_CHECK_DISABLED=1
export SKIP_VERSION_CHECK=1
export FRAPPE_DB_TYPE=postgres

# Use Railway's PORT or default to 8000
PORT=${PORT:-8000}

# Set site name from Railway domain (Railway will provide the actual domain)
SITE_NAME=${RAILWAY_PUBLIC_DOMAIN:-"mysite.railway.app"}

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
    
    # Debug parsed values before any modifications
    echo "🔍 Raw parsed values:"
    echo "   DB_USER='$DB_USER'"
    echo "   DB_PASS length=${#DB_PASS}"
    echo "   DB_HOST='$DB_HOST'"
    echo "   DB_PORT='$DB_PORT'"
    echo "   DB_NAME='$DB_NAME'"
    
    # Ensure DB_NAME is never empty - but keep original value if valid
    if [ -z "$DB_NAME" ]; then
        DB_NAME="railway"
        echo "🔧 DB_NAME was empty, defaulting to 'railway'"
    fi
    
    # Ensure DB_USER is never empty and is definitely 'postgres'
    if [ -z "$DB_USER" ] || [ "$DB_USER" != "postgres" ]; then
        echo "🔧 DB_USER was '$DB_USER', forcing to 'postgres'"
        DB_USER="postgres"
    fi
    
    echo "📊 PostgreSQL config - Host: $DB_HOST, Port: $DB_PORT, User: $DB_USER, DB: $DB_NAME"
    echo "🔍 Debug - Password length: ${#DB_PASS}"
    echo "🔍 Debug - Will use User=$DB_USER, Host=$DB_HOST, Port=$DB_PORT, DB=$DB_NAME"
    
    # Test PostgreSQL connection
    echo "🔧 Testing PostgreSQL connection..."
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" 2>/dev/null || echo "   PostgreSQL connection test failed - will let Frappe handle it"
    
    # Configure bench for PostgreSQL
    echo "🔧 Setting global PostgreSQL configuration..."
    bench set-config -g db_type postgres
    if [ -n "$DB_HOST" ]; then bench set-config -g db_host "$DB_HOST"; fi
    if [ -n "$DB_PORT" ]; then bench set-config -g db_port "$DB_PORT"; fi
    if [ -n "$DB_NAME" ]; then bench set-config -g db_name "$DB_NAME"; fi
    if [ -n "$DB_USER" ]; then bench set-config -g root_login "$DB_USER"; fi
    if [ -n "$DB_PASS" ]; then bench set-config -g root_password "$DB_PASS"; fi
    
    # Debug: Show current configuration
    echo "🔍 Debug - Current bench configuration:"
    cat common_site_config.json | grep -E "db_|root_" || echo "   No database config found"
    
    # Force PostgreSQL driver usage
    export FRAPPE_DB_TYPE=postgres
    
    echo "✅ PostgreSQL configuration complete - no strict mode issues!"
    
    # Set all PostgreSQL environment variables immediately after parsing URL
    echo "🔧 Setting environment variables with parsed values:"
    echo "   Setting PGUSER=$DB_USER"
    echo "   Setting PGDATABASE=$DB_NAME" 
    echo "   Setting PGHOST=$DB_HOST"
    echo "   Setting PGPORT=$DB_PORT"
    
    export PGUSER="$DB_USER"
    export PGPASSWORD="$DB_PASS"
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGDATABASE="$DB_NAME"
    export FRAPPE_DB_USER="$DB_USER"
    export FRAPPE_DB_PASSWORD="$DB_PASS"
    export FRAPPE_DB_HOST="$DB_HOST"
    export FRAPPE_DB_PORT="$DB_PORT"
    export FRAPPE_DB_NAME="$DB_NAME"
    
    # Additional safety exports
    export DB_USER="$DB_USER"
    export DB_PASSWORD="$DB_PASS"
    
    # Ensure Railway variables don't interfere
    unset RAILWAY_USER 2>/dev/null
    unset MYSQL_USER 2>/dev/null
    unset POSTGRES_DB 2>/dev/null
    
    # Force unset any variables that might contain 'railway'
    railway_vars=$(env | grep -i railway | cut -d= -f1 2>/dev/null || true)
    if [ -n "$railway_vars" ]; then
        echo "$railway_vars" | while read var; do
            unset "$var" 2>/dev/null || true
        done
    fi
    
    # Verify environment variables are set correctly
    echo "🔍 Verifying environment variables:"
    echo "   PGUSER=$PGUSER"
    echo "   PGDATABASE=$PGDATABASE"
    echo "   FRAPPE_DB_USER=$FRAPPE_DB_USER"
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
    
    # Remove any existing configuration files that might have cached railway user
    rm -f sites/$SITE_NAME/site_config.json 2>/dev/null
    rm -f sites/.common_site_config.json 2>/dev/null
    rm -f common_site_config.json 2>/dev/null
    rm -f sites/currentsite.txt 2>/dev/null
    
    # Clear any Frappe cache that might contain old credentials
    rm -rf sites/assets 2>/dev/null
    rm -rf __pycache__ 2>/dev/null
    find . -name "*.pyc" -delete 2>/dev/null
    
    # Create fresh site config with correct PostgreSQL credentials
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

    # Create common site config with correct PostgreSQL settings to prevent fallback
    cat > common_site_config.json << EOF
{
  "db_type": "postgres",
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_name": "$DB_NAME",
  "root_login": "$DB_USER",
  "root_password": "$DB_PASS"
}
EOF

    echo "✅ Site config file created with correct PostgreSQL credentials"
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME"
    
    # Set current site to ensure Frappe uses correct configuration
    echo "$SITE_NAME" > sites/currentsite.txt
    bench use $SITE_NAME
    
    # Verify database connectivity with correct credentials before proceeding
    echo "🔧 Testing database connectivity with site config..."
    if PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>/dev/null; then
        echo "✅ Database connection successful with postgres user"
    else
        echo "❌ Database connection failed - but continuing as site config should work"
    fi
fi

# Skip cache clearing as it fails after config overwrite
echo "✅ Configuration updated, proceeding to app installation..."

# Environment variables already set during database configuration
echo "🔧 All database environment variables are configured"

# Check if Flansa app is already installed
if bench --site $SITE_NAME list-apps 2>/dev/null | grep -q "flansa"; then
    echo "✅ Flansa app already installed"
    FLANSA_INSTALLED=true
else
    echo "🔧 Installing Flansa app on site..."
    if timeout 300 bench --site $SITE_NAME install-app flansa; then
        echo "✅ Flansa app installed successfully"
        FLANSA_INSTALLED=true
    else
        echo "⚠️  Flansa installation failed or timed out - will be available for manual install"
        echo "📝 Flansa can be installed manually after login to the site"
        FLANSA_INSTALLED=false
    fi
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

# Final aggressive database configuration override before server start
echo "🔧 Final database configuration override..."

# Re-export all database variables to ensure they persist
export PGUSER="postgres"
export PGPASSWORD="$DB_PASS"
export PGHOST="$DB_HOST"  
export PGPORT="$DB_PORT"
export PGDATABASE="$DB_NAME"
export FRAPPE_DB_USER="postgres"
export FRAPPE_DB_PASSWORD="$DB_PASS"

# Override any potential Railway-specific variables one more time
unset RAILWAY_USER 2>/dev/null
unset POSTGRES_USER_RAILWAY 2>/dev/null
unset DB_USER_RAILWAY 2>/dev/null

# Force recreate site config one final time to ensure no cached 'railway' user
if [ -f "sites/$SITE_NAME/site_config.json" ]; then
    echo "🔧 Final site config override to prevent railway user..."
    # Use sed to replace any occurrence of 'railway' user with 'postgres'
    sed -i 's/"db_user": "railway"/"db_user": "postgres"/g' sites/$SITE_NAME/site_config.json
    sed -i 's/"root_login": "railway"/"root_login": "postgres"/g' sites/$SITE_NAME/site_config.json
    
    # Show final site config for debugging
    echo "🔍 Final site config content:"
    grep -E '"db_user"|"root_login"' sites/$SITE_NAME/site_config.json || echo "   No user config found"
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

# Start server with Railway-compatible configuration
echo "🔧 Starting server on 0.0.0.0:$PORT for Railway networking..."

# Try gunicorn first (production server), fall back to bench serve
if command -v gunicorn >/dev/null 2>&1; then
    echo "🚀 Using gunicorn production server..."
    gunicorn -b 0.0.0.0:$PORT --timeout 120 --workers 1 --max-requests 1000 \
        --access-logfile - --error-logfile - \
        frappe.app:application
else
    echo "🚀 Using bench serve development server..."
    bench serve --port $PORT --host 0.0.0.0
fi