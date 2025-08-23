#!/bin/bash
set -e

echo "🚀 Flansa Railway Production Deployment"
echo "======================================="

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

# Extract PostgreSQL credentials from DATABASE_URL (Railway provides this)
if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "✅ PostgreSQL configured:"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
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

# Check for Redis (Railway provides REDIS_URL if Redis service is added)
if [ -n "$REDIS_URL" ]; then
    # Use the full Redis URL with authentication
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1",
  "redis_socketio": "'$REDIS_BASE'/2",'
    echo "✅ Redis configured with Railway Redis service"
else
    # No Redis available - disable background jobs
    REDIS_CONFIG='"redis_cache": "",
  "redis_queue": "",
  "redis_socketio": "",'
    echo "⚠️  Redis not available - background jobs disabled"
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
    
    # Create site WITHOUT creating database (--no-setup-db)
    # Railway's database already exists, we just need tables
    echo "Creating Frappe site (using existing database)..."
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
    
    echo "✅ Site created"
    bench use $SITE_NAME
    
    # Install Flansa app
    echo "Installing Flansa application..."
    bench --site $SITE_NAME install-app flansa --force || {
        echo "⚠️  Installation had warnings, continuing..."
    }
    
    # Run migrations
    echo "Running database migrations..."
    bench --site $SITE_NAME migrate || true
    
    # Mark setup as complete
    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
    echo "✅ Setup complete"
else
    echo "✅ Using existing site"
    bench use $SITE_NAME
    
    # Always run migrations for existing sites
    echo "Running migrations..."
    bench --site $SITE_NAME migrate || true
fi

# ============================================
# 4. CONFIGURATION FILES
# ============================================
echo ""
echo "📝 Configuration Files"
echo "---------------------"

# Create site configuration with database credentials
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

# Create common site configuration
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

echo "✅ Configuration files updated"

# ============================================
# 5. FINAL PREPARATIONS
# ============================================
echo ""
echo "🔧 Final Preparations"
echo "--------------------"

# Build assets
echo "Building application assets..."
bench build --app flansa || true

# Clear cache
echo "Clearing cache..."
bench --site $SITE_NAME clear-cache || true

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# ============================================
# 6. START SERVER
# ============================================
echo ""
echo "🚀 Starting Frappe Server"
echo "------------------------"
echo "Site: $SITE_NAME"
echo "Port: $PORT"
echo ""

exec bench serve --port $PORT