#!/bin/bash
set -e

echo "🚀 Railway Runtime Setup (Memory Efficient)"
echo "==========================================="

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"

cd /home/frappe/frappe-bench

# Parse DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "✅ Database configured"
fi

# First-time bench initialization (if needed)
if [ ! -f "sites/apps.txt" ]; then
    echo "🔧 First-time bench setup..."
    
    # Initialize bench structure
    bench init --skip-redis-config-generation --no-backups --no-auto-update --frappe-path apps/frappe .
    
    # Setup apps
    echo "frappe" > sites/apps.txt
    echo "flansa" >> sites/apps.txt
    
    echo "✅ Bench initialized"
fi

# Create site directory
mkdir -p sites/$SITE_NAME

# Configure database
cat > sites/$SITE_NAME/site_config.json <<EOF
{
  "db_name": "$DB_NAME",
  "db_type": "postgres",
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD"
}
EOF

# Common config
REDIS_CONFIG=""
if [ -n "$REDIS_URL" ]; then
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0", "redis_queue": "'$REDIS_BASE'/1", "redis_socketio": "'$REDIS_BASE'/2",'
fi

cat > sites/common_site_config.json <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  $REDIS_CONFIG
  "default_site": "$SITE_NAME",
  "serve_default_site": true,
  "developer_mode": 0
}
EOF

# Check if site exists in DB
SITE_EXISTS=false
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
   -c "SELECT 1 FROM \"tabSite\" WHERE name='$SITE_NAME' LIMIT 1;" 2>/dev/null | grep -q 1; then
    SITE_EXISTS=true
    echo "✅ Site exists in database"
fi

# Create site if needed
if [ "$SITE_EXISTS" = false ]; then
    echo "Creating site..."
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host "$DB_HOST" \
        --db-port "$DB_PORT" \
        --db-name "$DB_NAME" \
        --db-root-username "$DB_USER" \
        --db-root-password "$DB_PASSWORD" \
        --db-password "$DB_PASSWORD" \
        --admin-password "${ADMIN_PASSWORD:-admin123}" \
        --no-setup-db \
        --force
    
    # Install Flansa
    bench --site $SITE_NAME install-app flansa --force || true
fi

bench use $SITE_NAME

# Build assets ONLY if needed (memory intensive)
if [ "$BUILD_ASSETS" = "true" ] || [ ! -d "sites/assets" ]; then
    echo "🎨 Building assets (this may take time)..."
    
    # Build in stages to avoid memory spike
    echo "Building Frappe assets..."
    NODE_OPTIONS="--max-old-space-size=512" bench build --app frappe || {
        echo "⚠️  Frappe assets failed, trying minimal build..."
        NODE_OPTIONS="--max-old-space-size=256" bench build --app frappe --production || true
    }
    
    echo "Building Flansa assets..."
    NODE_OPTIONS="--max-old-space-size=512" bench build --app flansa || {
        echo "⚠️  Flansa assets failed, trying minimal build..."
        NODE_OPTIONS="--max-old-space-size=256" bench build --app flansa --production || true
    }
    
    echo "✅ Assets built"
else
    echo "⏭️  Skipping asset build"
fi

# Migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running migrations..."
    bench --site $SITE_NAME migrate --skip-failing || true
fi

# Clear cache
bench --site $SITE_NAME clear-cache || true

echo "🚀 Starting server on port $PORT"
exec gunicorn \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --worker-class sync \
    --timeout 120 \
    --preload \
    frappe.app:application