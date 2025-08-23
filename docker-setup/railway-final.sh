#!/bin/bash
set -e

echo "🚀 Flansa Railway - Final Solution"
echo "================================="

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

# Extract credentials from DATABASE_URL (Railway's actual working credentials)
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Using Railway DATABASE_URL credentials..."
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME"
    echo "   Password: ${DB_PASSWORD:0:8}..."
else
    echo "❌ DATABASE_URL not available"
    exit 1
fi

# Test connection first
echo "🧪 Testing database connection..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "❌ Database connection test failed with Railway credentials"
    echo "   This indicates a Railway configuration issue"
    exit 1
fi
echo "✅ Database connection successful"

# Create logs directory
mkdir -p /home/frappe/logs

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 Creating Frappe site with --no-setup-db (uses existing Railway database)..."
    
    # Use --no-setup-db to skip database/user creation, just create tables
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host "$DB_HOST" \
        --db-port "$DB_PORT" \
        --db-name "$DB_NAME" \
        --admin-password admin123 \
        --no-setup-db \
        --force || {
            echo "❌ Site creation failed"
            exit 1
        }
    
    echo "✅ Site created successfully"
    bench use $SITE_NAME
    
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa || {
        echo "⚠️ Flansa installation had issues, but continuing..."
    }
    
    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
    echo "✅ Setup complete"
else
    echo "✅ Using existing site"
    bench use $SITE_NAME
fi

# Create site config with Railway's actual credentials (CRITICAL for runtime)
echo "🔧 Creating site configuration with Railway credentials..."
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

# Also update common site config
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

echo "✅ Site configuration created"

# Debug: Show final config
echo "🔍 Final site_config.json:"
cat "sites/$SITE_NAME/site_config.json"

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Start server
echo "🚀 Starting Frappe server..."
exec bench serve --port $PORT