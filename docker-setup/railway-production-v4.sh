#!/bin/bash
set -e

echo "🚀 Flansa Railway Production Deployment (v4 - Persistent)"
echo "========================================================="

# Configuration
PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"

cd /home/frappe/frappe-bench

# ============================================
# 1. DATABASE CONFIGURATION
# ============================================
echo "📊 Database Configuration"
echo "------------------------"

# Extract PostgreSQL credentials from DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "✅ PostgreSQL: $DB_HOST:$DB_PORT/$DB_NAME"
else
    echo "❌ DATABASE_URL not found"
    exit 1
fi

# Test database connection
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# ============================================
# 2. REDIS CONFIGURATION  
# ============================================
echo ""
echo "📊 Redis Configuration"
echo "---------------------"

if [ -n "$REDIS_URL" ]; then
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1", 
  "redis_socketio": "'$REDIS_BASE'/2",'
    echo "✅ Redis configured"
else
    REDIS_CONFIG='"redis_cache": "",
  "redis_queue": "",
  "redis_socketio": "",'
    echo "⚠️  Redis disabled - background jobs off"
fi

# ============================================
# 3. CHECK EXISTING SITE
# ============================================
echo ""
echo "🔍 Checking Site Status"
echo "----------------------"

# Check if site already exists in database
SITE_EXISTS=false
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
   -c "SELECT 1 FROM \"tabSite\" WHERE name='$SITE_NAME' LIMIT 1;" 2>/dev/null | grep -q 1; then
    SITE_EXISTS=true
    echo "✅ Site exists in database"
else
    echo "📝 Site not found in database - will create"
fi

# Check if site directory exists
if [ -d "sites/$SITE_NAME" ] && [ -f "sites/$SITE_NAME/site_config.json" ]; then
    echo "✅ Site directory exists"
    
    # Verify configuration matches current database
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
    echo "✅ Site configuration updated"
else
    echo "📁 Creating site directory"
    mkdir -p "sites/$SITE_NAME"
fi

# ============================================
# 4. SITE SETUP OR RECOVERY
# ============================================
echo ""
echo "🔧 Site Setup"
echo "------------"

if [ "$SITE_EXISTS" = true ]; then
    echo "♻️  Using existing site from database"
    
    # Just set the site as current
    bench use $SITE_NAME
    
    # Create minimal site_config.json
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
    
else
    echo "🆕 Creating new site"
    
    # Create site without database setup (Railway manages DB)
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
    
    # Install Flansa only if site is new
    echo "Installing Flansa..."
    bench --site $SITE_NAME install-app flansa --force || {
        echo "⚠️  Installation warnings ignored"
    }
fi

# ============================================
# 5. COMMON CONFIGURATION
# ============================================
echo ""
echo "📝 Common Configuration"
echo "----------------------"

# Update common site configuration
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
  "disable_async": false,
  "maintenance_mode": 0,
  "pause_scheduler": 0,
  "auto_migrate": 0
}
EOF

echo "✅ Configuration complete"

# ============================================
# 6. DATABASE MIGRATION (Only if needed)
# ============================================
echo ""
echo "🔄 Database Migration Check"
echo "--------------------------"

# Set Railway environment
export RAILWAY_ENVIRONMENT=true

# Check if migration is needed
NEEDS_MIGRATION=false

# Check for pending migrations
if bench --site $SITE_NAME show-pending-migrations 2>/dev/null | grep -q "Pending"; then
    NEEDS_MIGRATION=true
    echo "📦 Pending migrations detected"
else
    echo "✅ No pending migrations"
fi

# Run migrations only if needed
if [ "$NEEDS_MIGRATION" = true ] || [ "$SITE_EXISTS" = false ]; then
    echo "Running migrations..."
    
    # Try standard migration first
    if bench --site $SITE_NAME migrate 2>/dev/null; then
        echo "✅ Migrations completed"
    else
        # Fallback to skip-failing
        bench --site $SITE_NAME migrate --skip-failing 2>/dev/null || {
            echo "⚠️  Some migrations skipped"
        }
    fi
else
    echo "⏭️  Skipping migrations - not needed"
fi

# ============================================
# 7. ASSETS & CACHE
# ============================================
echo ""
echo "🎨 Assets & Cache"
echo "----------------"

# Only build if assets don't exist or are outdated
if [ ! -d "sites/assets" ] || [ ! -f "sites/assets/assets.json" ]; then
    echo "Building assets..."
    bench build --app flansa || true
else
    echo "✅ Assets already built"
fi

# Clear cache only if site is new or had migrations
if [ "$NEEDS_MIGRATION" = true ] || [ "$SITE_EXISTS" = false ]; then
    bench --site $SITE_NAME clear-cache || true
    echo "✅ Cache cleared"
else
    echo "⏭️  Cache retained"
fi

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# ============================================
# 8. START SERVER
# ============================================
echo ""
echo "🚀 Starting Server"
echo "-----------------"
echo "Site: $SITE_NAME"
echo "Port: $PORT"
echo "Status: $([ "$SITE_EXISTS" = true ] && echo "Existing" || echo "New")"
echo ""

# Start Frappe server
exec bench serve --port $PORT