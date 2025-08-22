#!/bin/bash
set -e

echo "🚀 Flansa Railway - Runtime Authentication Fix"
echo "=============================================="

# Skip psycopg2 interception for now (file not copied to container)

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Extract credentials from DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Extracting credentials from DATABASE_URL..."
    
    # Parse DATABASE_URL to get individual components
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   Password length: ${#DB_PASSWORD}"
else
    echo "❌ DATABASE_URL not available, using environment variables"
    DB_USER="$PGUSER"
    DB_PASSWORD="$PGPASSWORD"
    DB_HOST="$PGHOST"
    DB_PORT="$PGPORT"
    DB_NAME="${PGDATABASE:-railway}"
fi

# Create logs directory
mkdir -p /home/frappe/logs

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 First-time setup: Creating site and installing app..."
    
    # Create site with extracted credentials
    if [ ! -d "sites/$SITE_NAME" ]; then
        echo "🔧 Creating site with database credentials..."
        
        bench new-site $SITE_NAME \
            --db-type postgres \
            --db-host "$DB_HOST" \
            --db-port "$DB_PORT" \
            --db-name "$DB_NAME" \
            --db-root-username "$DB_USER" \
            --db-root-password "$DB_PASSWORD" \
            --admin-password admin123 \
            --force
    fi
    
    # Set as current site
    bench use $SITE_NAME
    
    # Install Flansa
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa || echo "⚠️ Flansa installation had issues"
    
    # Mark setup as complete
    echo "$(date): Railway setup completed" > "$SETUP_COMPLETE"
    echo "✅ Setup marked as complete"
else
    echo "✅ Setup already complete, using existing site"
    bench use $SITE_NAME
fi

# CRITICAL: Update ALL configuration files before starting server
echo "🔧 Updating ALL site configurations for runtime..."

# 1. Update site_config.json - CRITICAL: db_user must be set!
cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "$DB_NAME",
  "db_type": "postgres",
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD"
}
EOF
echo "✅ Updated site_config.json"

# 2. Update common_site_config.json
cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,  
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  "default_site": "$SITE_NAME",
  "serve_default_site": true
}
EOF
echo "✅ Updated common_site_config.json"

# 3. Set environment variables that Frappe might read
export DB_HOST="$DB_HOST"
export DB_PORT="$DB_PORT"
export DB_USER="$DB_USER"
export DB_PASSWORD="$DB_PASSWORD"
export DB_NAME="$DB_NAME"

# Also set with FRAPPE_ prefix
export FRAPPE_DB_HOST="$DB_HOST"
export FRAPPE_DB_PORT="$DB_PORT"
export FRAPPE_DB_USER="$DB_USER"
export FRAPPE_DB_PASSWORD="$DB_PASSWORD"
export FRAPPE_DB_NAME="$DB_NAME"

# And PostgreSQL standard variables
export PGHOST="$DB_HOST"
export PGPORT="$DB_PORT"
export PGUSER="$DB_USER"
export PGPASSWORD="$DB_PASSWORD"
export PGDATABASE="$DB_NAME"

echo "✅ Set all environment variables"

# 4. Create a .env file that bench might read
cat > ".env" <<EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
FRAPPE_DB_HOST=$DB_HOST
FRAPPE_DB_PORT=$DB_PORT
FRAPPE_DB_USER=$DB_USER
FRAPPE_DB_PASSWORD=$DB_PASSWORD
FRAPPE_DB_NAME=$DB_NAME
EOF
echo "✅ Created .env file"

# Debug: Show current config
echo "🔍 Current site_config.json contents:"
cat "sites/$SITE_NAME/site_config.json"

echo "🔍 Current common_site_config.json contents:"
cat "sites/common_site_config.json"

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Apply Python patches before starting
echo "🔧 Applying Frappe database patch..."
python3 patch-frappe-db.py

echo "🔧 Fixing Frappe's db_name/db_user bug..."
python3 fix-frappe-user-bug.py

# Start server with all environment variables
echo "🚀 Starting server with correct runtime credentials..."
exec env \
    DB_HOST="$DB_HOST" \
    DB_PORT="$DB_PORT" \
    DB_USER="$DB_USER" \
    DB_PASSWORD="$DB_PASSWORD" \
    DB_NAME="$DB_NAME" \
    FRAPPE_DB_HOST="$DB_HOST" \
    FRAPPE_DB_PORT="$DB_PORT" \
    FRAPPE_DB_USER="$DB_USER" \
    FRAPPE_DB_PASSWORD="$DB_PASSWORD" \
    FRAPPE_DB_NAME="$DB_NAME" \
    PGHOST="$DB_HOST" \
    PGPORT="$DB_PORT" \
    PGUSER="$DB_USER" \
    PGPASSWORD="$DB_PASSWORD" \
    PGDATABASE="$DB_NAME" \
    bench serve --port $PORT