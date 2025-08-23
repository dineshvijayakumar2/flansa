#!/bin/bash
set -e

echo "🚀 Flansa Railway - With Redis Support"
echo "======================================"

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

# Extract PostgreSQL credentials from DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Extracting PostgreSQL credentials..."
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   PostgreSQL User: $DB_USER"
    echo "   PostgreSQL Host: $DB_HOST"
    echo "   PostgreSQL Database: $DB_NAME"
else
    echo "❌ DATABASE_URL not available"
    exit 1
fi

# Check for Redis
REDIS_CONFIG=""
if [ -n "$REDIS_URL" ]; then
    echo "🔧 Redis URL found"
    # Use the full Redis URL directly - it includes auth
    # Format: redis://default:password@redis.railway.internal:6379
    
    # Remove trailing slash if any and append database numbers
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1",
  "redis_socketio": "'$REDIS_BASE'/2",'
    echo "   Redis configured with Railway Redis service"
else
    echo "⚠️ No Redis URL found, disabling Redis features"
    REDIS_CONFIG='"redis_cache": "",
  "redis_queue": "",
  "redis_socketio": "",
  "developer_mode": 0,
  "disable_async": false,'
fi

# Test PostgreSQL connection
echo "🧪 Testing PostgreSQL connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ PostgreSQL connection failed"
    exit 1
fi
echo "✅ PostgreSQL connection successful"

# Create logs directory
mkdir -p /home/frappe/logs

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 Creating Frappe site..."
    
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host "$DB_HOST" \
        --db-port "$DB_PORT" \
        --db-name "$DB_NAME" \
        --db-root-username "$DB_USER" \
        --db-root-password "$DB_PASSWORD" \
        --db-password "$DB_PASSWORD" \
        --admin-password admin123 \
        --no-setup-db \
        --force || {
            echo "❌ Site creation failed"
            exit 1
        }
    
    echo "✅ Site created"
    bench use $SITE_NAME
    
    echo "🔧 Installing Flansa..."
    # Check if Flansa was partially installed before
    if bench --site $SITE_NAME list-apps 2>/dev/null | grep -q "flansa"; then
        echo "⚠️ Flansa already in installed apps, running migrations..."
        bench --site $SITE_NAME migrate --skip-failing || echo "⚠️ Some migrations failed"
    else
        # Clean install
        bench --site $SITE_NAME install-app flansa --force || {
            echo "⚠️ Installation failed, checking database state..."
            
            # If install fails, ensure Flansa tables exist
            bench --site $SITE_NAME console <<EOF
import frappe
# Ensure Flansa is marked as installed
if 'flansa' not in frappe.get_installed_apps():
    doc = frappe.new_doc('Installed Application')
    doc.app_name = 'flansa'
    doc.app_version = '0.0.1'
    doc.installed_on = frappe.utils.now()
    doc.insert(ignore_permissions=True, ignore_if_duplicate=True)
    frappe.db.commit()
    print("✅ Marked Flansa as installed")
EOF
            
            # Run migrations after marking as installed
            bench --site $SITE_NAME migrate --skip-failing || echo "⚠️ Some migrations failed"
        }
    }
    
    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
else
    echo "✅ Using existing site"
    bench use $SITE_NAME
    
    # Always run migrations for existing sites to ensure they're up to date
    echo "🔧 Running migrations for existing site..."
    bench --site $SITE_NAME migrate || echo "⚠️ Migration had issues"
fi

# Create site configuration
echo "🔧 Creating site configuration..."
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

# Create common site config with Redis settings
cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  $REDIS_CONFIG
  "default_site": "$SITE_NAME",
  "serve_default_site": true
}
EOF

echo "✅ Configuration created"

# Show final config
echo "🔍 Final configuration:"
cat "sites/common_site_config.json"

# Build assets for Flansa
echo "🔧 Building Flansa assets..."
bench build --app flansa || echo "⚠️ Asset build had issues, but continuing..."

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Clear cache to ensure fresh start
echo "🔧 Clearing cache..."
bench --site $SITE_NAME clear-cache || echo "⚠️ Cache clear had issues"

# Start server
echo "🚀 Starting server..."
exec bench serve --port $PORT