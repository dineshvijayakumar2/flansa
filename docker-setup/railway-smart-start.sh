#!/bin/bash
set -e

echo "🚀 Flansa Railway Smart Deployment"
echo "=================================="

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"

cd /home/frappe/frappe-bench

# ============================================
# 1. DATABASE CONFIGURATION
# ============================================
echo "📊 Configuring Database..."

if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "✅ Database: $DB_HOST:$DB_PORT/$DB_NAME"
else
    echo "❌ DATABASE_URL not found!"
    exit 1
fi

# ============================================
# 2. REDIS CONFIGURATION
# ============================================
echo "📊 Configuring Redis..."

if [ -n "$REDIS_URL" ]; then
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1",
  "redis_socketio": "'$REDIS_BASE'/2",'
    echo "✅ Redis configured"
else
    REDIS_CONFIG=''
    echo "⚠️  Redis not configured"
fi

# ============================================
# 3. CHECK IF SITE EXISTS
# ============================================
echo ""
echo "🔍 Checking Site Status..."

SITE_EXISTS=false
SITE_IN_DB=false

# Check if site directory exists
if [ -d "sites/$SITE_NAME" ]; then
    echo "✅ Site directory exists"
    SITE_EXISTS=true
fi

# Check if site exists in database
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
   -c "SELECT 1 FROM \"tabSite\" WHERE name='$SITE_NAME' LIMIT 1;" 2>/dev/null | grep -q 1; then
    echo "✅ Site exists in database"
    SITE_IN_DB=true
fi

# ============================================
# 4. SITE SETUP
# ============================================
echo ""
echo "🔧 Site Setup..."

if [ "$SITE_IN_DB" = true ] && [ "$SITE_EXISTS" = true ]; then
    echo "♻️  Using existing site"
    bench use $SITE_NAME
elif [ "$SITE_IN_DB" = true ] && [ "$SITE_EXISTS" = false ]; then
    echo "🔄 Recreating site directory (exists in DB)"
    mkdir -p sites/$SITE_NAME
    bench use $SITE_NAME
else
    echo "🆕 Creating new site (first deployment)"
    
    # Create new site with existing database
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
    
    bench use $SITE_NAME
    
    # Install Flansa app
    echo "Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa --force || {
        echo "⚠️  Installation warnings, continuing..."
    }
    
    SITE_IN_DB=true
fi

# ============================================
# 5. UPDATE CONFIGURATION
# ============================================
echo ""
echo "📝 Updating Configuration..."

# Site configuration
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

# Common configuration
cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  $REDIS_CONFIG
  "default_site": "$SITE_NAME",
  "serve_default_site": true,
  "developer_mode": 0,
  "disable_async": false
}
EOF

echo "✅ Configuration updated"

# ============================================
# 6. BUILD ASSETS (FIXES CSS ISSUE)
# ============================================
echo ""
echo "🎨 Building Assets..."

# Always build assets on first deployment or if missing
if [ ! -f "sites/assets/assets.json" ] || [ "$BUILD_ASSETS" = "true" ]; then
    echo "Building CSS/JS assets..."
    bench build --app frappe
    bench build --app flansa
    echo "✅ Assets built successfully"
else
    echo "⏭️  Assets already built"
fi

# ============================================
# 7. DATABASE MIGRATIONS
# ============================================
echo ""
echo "🔄 Database Migrations..."

# Run migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ] || [ "$SITE_IN_DB" = false ]; then
    echo "Running migrations..."
    bench --site $SITE_NAME migrate --skip-failing || {
        echo "⚠️  Some migrations skipped"
    }
else
    echo "⏭️  Skipping migrations"
fi

# ============================================
# 8. CLEAR CACHE
# ============================================
echo "🧹 Clearing cache..."
bench --site $SITE_NAME clear-cache || true

# ============================================
# 9. START SERVER
# ============================================
echo ""
echo "🚀 Starting Server"
echo "================="
echo "Site: $SITE_NAME"
echo "Port: $PORT"
echo "Database: $DB_NAME"
echo "Redis: $([ -n "$REDIS_URL" ] && echo "Enabled" || echo "Disabled")"
echo ""

exec bench serve --port $PORT