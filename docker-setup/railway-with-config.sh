#!/bin/bash
set -e

echo "🚀 Flansa Railway - Config-First Approach"
echo "========================================"

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

# Extract credentials from DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Extracting Railway credentials from DATABASE_URL..."
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME"
else
    echo "❌ DATABASE_URL not available"
    exit 1
fi

# Test connection
echo "🧪 Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ Database connection failed"
    exit 1
fi
echo "✅ Connection successful"

# Create logs directory
mkdir -p /home/frappe/logs

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 Setting up Frappe site..."
    
    # Create sites directory structure
    mkdir -p "sites/$SITE_NAME"
    
    # CRITICAL: Create site_config.json BEFORE running bench new-site
    # This ensures Frappe uses correct credentials from the start
    echo "🔧 Creating site_config.json with Railway credentials FIRST..."
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
    
    # Also create common_site_config.json
    cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres"
}
EOF
    
    echo "✅ Config files created with correct credentials"
    
    # Now run bench new-site with --no-setup-db
    # It should read credentials from the config files we just created
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host "$DB_HOST" \
        --db-port "$DB_PORT" \
        --db-name "$DB_NAME" \
        --db-password "$DB_PASSWORD" \
        --admin-password admin123 \
        --no-setup-db \
        --force || {
            echo "❌ Site creation failed"
            
            # Debug: Check what's in frappe.conf
            echo "🔍 Debug - Checking Frappe configuration..."
            python3 -c "
import sys
sys.path.insert(0, '/home/frappe/frappe-bench/apps/frappe')
import frappe
frappe.init('$SITE_NAME')
print('frappe.conf.db_user:', getattr(frappe.conf, 'db_user', 'NOT SET'))
print('frappe.conf.db_name:', frappe.conf.db_name)
print('frappe.conf.db_password:', frappe.conf.db_password[:8] + '...')
" || echo "Could not check frappe.conf"
            
            exit 1
        }
    
    echo "✅ Site created"
    bench use $SITE_NAME
    
    # Install Flansa
    echo "🔧 Installing Flansa..."
    bench --site $SITE_NAME install-app flansa || echo "⚠️ Flansa installation had issues"
    
    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
else
    echo "✅ Using existing site"
    bench use $SITE_NAME
fi

# Ensure configs are correct for runtime
echo "🔧 Updating runtime configuration..."
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

echo "✅ Runtime configuration updated"

# Show final config
echo "🔍 Final configuration:"
cat "sites/$SITE_NAME/site_config.json"

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Start server
echo "🚀 Starting server..."
exec bench serve --port $PORT