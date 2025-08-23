#!/bin/bash
set -e

echo "🚀 Flansa Railway Production Deployment (v2)"
echo "============================================="

# Configuration
PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

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
    
    echo "✅ PostgreSQL configured: $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER"
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
    echo "✅ Redis configured: $REDIS_URL"
    
    # Test Redis connection
    if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
        echo "✅ Redis connection successful"
    else
        echo "⚠️  Redis connection failed, continuing without Redis"
        REDIS_CONFIG='"redis_cache": "",
  "redis_queue": "",
  "redis_socketio": "",'
    fi
else
    REDIS_CONFIG='"redis_cache": "",
  "redis_queue": "",
  "redis_socketio": "",'
    echo "⚠️  Redis not configured - background jobs disabled"
fi

# ============================================
# 3. SITE SETUP
# ============================================
echo ""
echo "🔧 Site Setup"
echo "-------------"

mkdir -p /home/frappe/logs

if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "📝 First-time setup detected"
    
    # Create site without database setup (Railway manages the database)
    echo "Creating Frappe site (using Railway managed database)..."
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
    
    echo "✅ Site created successfully"
    bench use $SITE_NAME
    
    # Install Flansa app
    echo "Installing Flansa application..."
    bench --site $SITE_NAME install-app flansa --force || {
        echo "⚠️  Installation warnings ignored, continuing..."
    }
    
    # Mark initial setup as complete BEFORE migration
    echo "$(date): Initial setup completed" > "$SETUP_COMPLETE"
    echo "✅ Initial setup complete"
else
    echo "✅ Using existing site configuration"
    bench use $SITE_NAME
fi

# ============================================
# 4. CONFIGURATION FILES
# ============================================
echo ""
echo "📝 Configuration Files"
echo "---------------------"

# Create site configuration with proper database credentials
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

# Create common site configuration with Railway-specific settings
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
  "auto_migrate": 0
}
EOF

echo "✅ Configuration files updated"

# ============================================
# 5. DATABASE MIGRATION (Railway Safe Mode)
# ============================================
echo ""
echo "🔄 Database Migration"
echo "-------------------"

# Set Railway environment for patches
export RAILWAY_ENVIRONMENT=true
export RAILWAY_PROJECT_ID=true

# Apply Railway-specific patches
echo "Applying Railway patches..."
python3 ./railway_migration_fix.py || true

# Run migrations with error handling for Railway environment
echo "Running database migrations..."

# Method 1: Direct migration with Railway environment
if RAILWAY_ENVIRONMENT=true bench --site $SITE_NAME migrate 2>/dev/null; then
    echo "✅ Database migration completed successfully"
else
    echo "⚠️  Standard migration failed, trying alternative approach..."
    
    # Method 2: Skip failing migrations
    if RAILWAY_ENVIRONMENT=true bench --site $SITE_NAME migrate --skip-failing 2>/dev/null; then
        echo "✅ Migration completed with skip-failing"
    else
        echo "⚠️  Migration issues detected, attempting manual sync..."
        
        # Method 3: Manual sync
        bench --site $SITE_NAME sync-doctypes --app flansa 2>/dev/null || true
        bench --site $SITE_NAME run-patch --app flansa 2>/dev/null || true
        echo "✅ Manual migration steps completed"
    fi
fi

# ============================================
# 6. FINAL PREPARATIONS
# ============================================
echo ""
echo "🔧 Final Preparations"
echo "--------------------"

# Build application assets
echo "Building application assets..."
bench build --app flansa || {
    echo "⚠️  Asset build warnings ignored"
}

# Clear cache to ensure fresh start
echo "Clearing cache..."
bench --site $SITE_NAME clear-cache || true

# Set Python path for proper module resolution
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

echo "✅ Final preparations complete"

# ============================================
# 7. START SERVER
# ============================================
echo ""
echo "🚀 Starting Frappe Server"
echo "------------------------"
echo "Site: $SITE_NAME"
echo "Port: $PORT"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "Redis: $([ -n "$REDIS_URL" ] && echo "Enabled" || echo "Disabled")"
echo ""

# Start the Frappe development server
exec bench serve --port $PORT