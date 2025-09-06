#!/bin/bash
set -e

echo "🚀 Flansa AWS ECS Deployment"
echo "============================"

PORT=${PORT:-8080}
SITE_NAME=${SITE_NAME:-"flansa.local"}

cd /home/frappe/frappe-bench

# ============================================
# 1. AWS RDS CONFIGURATION
# ============================================
echo "📊 Configuring AWS RDS Database..."

if [ -n "$RDS_ENDPOINT" ] && [ -n "$RDS_PASSWORD" ]; then
    DB_HOST="$RDS_ENDPOINT"
    DB_PORT="${RDS_PORT:-5432}"
    DB_USER="${RDS_USERNAME:-frappe}"
    DB_PASSWORD="$RDS_PASSWORD"
    DB_NAME="${RDS_DB_NAME:-flansa_db}"
    echo "✅ Database: $DB_HOST:$DB_PORT/$DB_NAME"
elif [ -n "$DATABASE_URL" ]; then
    # Parse DATABASE_URL format (postgresql://user:pass@host:port/dbname)
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "✅ Database from URL: $DB_HOST:$DB_PORT/$DB_NAME"
else
    echo "❌ RDS_ENDPOINT or DATABASE_URL not found!"
    exit 1
fi

# ============================================
# 2. AWS ELASTICACHE REDIS CONFIGURATION
# ============================================
echo "📊 Configuring AWS ElastiCache Redis..."

if [ -n "$REDIS_ENDPOINT" ]; then
    REDIS_HOST="$REDIS_ENDPOINT"
    REDIS_PORT="${REDIS_PORT:-6379}"
    REDIS_BASE="redis://$REDIS_HOST:$REDIS_PORT"
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1",
  "redis_socketio": "'$REDIS_BASE'/2",'
    echo "✅ Redis: $REDIS_HOST:$REDIS_PORT"
elif [ -n "$REDIS_URL" ]; then
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1",
  "redis_socketio": "'$REDIS_BASE'/2",'
    echo "✅ Redis from URL configured"
else
    REDIS_CONFIG=''
    echo "⚠️  Redis not configured (optional)"
fi

# ============================================
# 2.1. AWS S3 CONFIGURATION FOR FILE STORAGE
# ============================================
echo "📁 Configuring AWS S3 File Storage..."

if [ -n "$S3_BUCKET_NAME" ]; then
    S3_CONFIG='"s3_bucket": "'$S3_BUCKET_NAME'",
  "aws_access_key_id": "'${AWS_ACCESS_KEY_ID:-}'",
  "aws_secret_access_key": "'${AWS_SECRET_ACCESS_KEY:-}'",
  "aws_s3_region_name": "'${AWS_S3_REGION:-us-east-1}'",
  "s3_folder_path": "'${S3_FOLDER_PATH:-flansa-files}'",
  "use_s3": 1,'
    echo "✅ S3 Bucket: $S3_BUCKET_NAME in ${AWS_S3_REGION:-us-east-1}"
    echo "✅ S3 Folder: ${S3_FOLDER_PATH:-flansa-files}"
else
    S3_CONFIG=''
    echo "⚠️  S3 not configured - files will be stored locally"
fi

# ============================================
# 3. CHECK SITE STATUS
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

# Test database connection and check for existing site
echo "Testing database connection..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
   -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
    
    # Check if site exists in database
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
       -c "SELECT 1 FROM information_schema.tables WHERE table_name='tabSite' LIMIT 1;" 2>/dev/null | grep -q 1; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
           -c "SELECT 1 FROM \"tabSite\" WHERE name='$SITE_NAME' LIMIT 1;" 2>/dev/null | grep -q 1; then
            echo "✅ Site exists in database"
            SITE_IN_DB=true
        fi
    fi
else
    echo "❌ Database connection failed!"
    exit 1
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
    
    # Create new site with existing AWS RDS database
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

# Common configuration with AWS-specific settings including S3
cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  $REDIS_CONFIG
  $S3_CONFIG
  "default_site": "$SITE_NAME",
  "serve_default_site": true,
  "developer_mode": 0,
  "disable_async": false,
  "log_level": "INFO",
  "enable_scheduler": true,
  "socketio_port": 9000
}
EOF

echo "✅ AWS configuration updated"

# ============================================
# 6. BUILD ASSETS
# ============================================
echo ""
echo "🎨 Building Assets..."

# Build assets for production
if [ ! -f "sites/assets/assets.json" ] || [ "$BUILD_ASSETS" = "true" ]; then
    echo "Building CSS/JS assets for production..."
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

# Always run migrations in AWS ECS
echo "Running migrations..."
bench --site $SITE_NAME migrate --skip-failing || {
    echo "⚠️  Some migrations skipped"
}

# ============================================
# 8. CLEAR CACHE
# ============================================
echo "🧹 Clearing cache..."
bench --site $SITE_NAME clear-cache || true

# ============================================
# 9. START SERVER FOR ALB HEALTH CHECKS
# ============================================
echo ""
echo "🚀 Starting Server for AWS ECS"
echo "=============================="
echo "Site: $SITE_NAME"
echo "Port: $PORT"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "Redis: $([ -n "$REDIS_ENDPOINT" ] && echo "$REDIS_HOST:$REDIS_PORT" || echo "Not configured")"
echo "Health Check: http://localhost:$PORT/api/method/ping"
echo ""

# Start Gunicorn for production
exec gunicorn \
    --bind 0.0.0.0:$PORT \
    --workers ${GUNICORN_WORKERS:-2} \
    --worker-class sync \
    --timeout ${GUNICORN_TIMEOUT:-120} \
    --keepalive 2 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --log-level info \
    --access-logfile - \
    --error-logfile - \
    frappe.app:application