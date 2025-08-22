#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa on AWS App Runner"
echo "=============================================="

# AWS App Runner provides these environment variables:
# - DATABASE_URL (RDS PostgreSQL connection string)
# - REDIS_URL (ElastiCache Redis connection string)
# - PORT (App Runner port binding)

# Use AWS provided PORT or default to 8000
PORT=${PORT:-8000}

# Set site name from AWS domain (App Runner will provide the actual domain)
SITE_NAME=${AWS_APPRUNNER_DOMAIN:-"flansa-mvp.aws-app.com"}

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"
echo "📍 Region: $AWS_REGION"

# Set environment variables for PostgreSQL usage
export FRAPPE_VERSION_CHECK_DISABLED=1
export SKIP_VERSION_CHECK=1
export FRAPPE_DB_TYPE=postgres

echo "⚙️ Configuring bench for AWS..."

# Parse AWS RDS PostgreSQL connection string
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Parsing AWS RDS PostgreSQL URL..."
    
    # Extract credentials from postgresql://user:pass@host:port/dbname
    DB_USER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^/?]*\).*|\1|p')
    
    echo "📊 AWS RDS Config:"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   User: $DB_USER"
    echo "   Database: $DB_NAME"
    
    # Test AWS RDS connection
    echo "🔧 Testing AWS RDS connection..."
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" || echo "   RDS connection test failed - will let Frappe handle it"
    
    # Configure bench for PostgreSQL
    echo "🔧 Configuring bench for AWS RDS..."
    bench set-config -g db_type postgres
    bench set-config -g db_host "$DB_HOST"
    bench set-config -g db_port "$DB_PORT"
    bench set-config -g db_name "$DB_NAME"
    bench set-config -g root_login "$DB_USER"
    bench set-config -g root_password "$DB_PASS"
    
    # Set PostgreSQL environment variables
    export PGUSER="$DB_USER"
    export PGPASSWORD="$DB_PASS"
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGDATABASE="$DB_NAME"
    
    echo "✅ AWS RDS PostgreSQL configured successfully"
else
    echo "❌ DATABASE_URL not provided by AWS"
    exit 1
fi

# Configure AWS ElastiCache Redis
if [ -n "$REDIS_URL" ]; then
    echo "🔧 Configuring AWS ElastiCache Redis..."
    bench set-config -g redis_cache $REDIS_URL
    bench set-config -g redis_queue $REDIS_URL
    bench set-config -g redis_socketio $REDIS_URL
    echo "✅ AWS ElastiCache Redis configured"
else
    echo "⚠️ REDIS_URL not provided - using default Redis config"
fi

# Create site if it doesn't exist
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🏗️ Creating new site: $SITE_NAME"
    
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-name $DB_NAME \
        --db-host $DB_HOST \
        --db-port $DB_PORT \
        --db-root-username $DB_USER \
        --db-root-password $DB_PASS \
        --admin-password ${ADMIN_PASSWORD:-admin123} \
        --force
        
    echo "✅ Site created successfully"
else
    echo "✅ Site already exists: $SITE_NAME"
fi

# Set current site
echo "$SITE_NAME" > sites/currentsite.txt
bench use $SITE_NAME

# Install Flansa app
echo "🔧 Installing Flansa app..."
if bench --site $SITE_NAME list-apps 2>/dev/null | grep -q "flansa"; then
    echo "✅ Flansa app already installed"
    FLANSA_INSTALLED=true
else
    if timeout 300 bench --site $SITE_NAME install-app flansa; then
        echo "✅ Flansa app installed successfully"
        FLANSA_INSTALLED=true
    else
        echo "⚠️ Flansa installation failed or timed out"
        echo "📝 Flansa can be installed manually after deployment"
        FLANSA_INSTALLED=false
    fi
fi

# Set homepage configuration
echo "🏠 Setting homepage configuration..."
if [ "$FLANSA_INSTALLED" = "true" ]; then
    bench --site $SITE_NAME set-config home_page "app/flansa"
    bench --site $SITE_NAME set-config default_workspace "Flansa"
    echo "✅ Flansa homepage configured"
else
    bench --site $SITE_NAME set-config home_page "login"
    echo "🔧 Using default Frappe homepage"
fi

# Build assets
echo "🔨 Building production assets..."
if [ "$FLANSA_INSTALLED" = "true" ]; then
    if timeout 600 bench build --app flansa; then
        echo "✅ Flansa assets built successfully"
    else
        echo "⚠️ Flansa asset build timed out - using pre-built assets"
    fi
else
    if timeout 600 bench build; then
        echo "✅ Frappe assets built successfully"
    else
        echo "⚠️ Asset build timed out - using pre-built assets"
    fi
fi

# Start production server
echo "🌟 Starting production server on port $PORT"
echo "🔗 Access at: https://$SITE_NAME"
echo "📝 Login: Administrator / ${ADMIN_PASSWORD:-admin123}"

if [ "$FLANSA_INSTALLED" = "false" ]; then
    echo "📋 To install Flansa: Go to App Installer and install 'flansa' manually"
fi

# Set environment for production
export FRAPPE_SITE_NAME_HEADER=$SITE_NAME

# Start gunicorn production server
echo "🚀 Starting gunicorn production server..."
exec gunicorn -b 0.0.0.0:$PORT \
    --timeout 120 \
    --workers 2 \
    --max-requests 1000 \
    --access-logfile - \
    --error-logfile - \
    frappe.app:application