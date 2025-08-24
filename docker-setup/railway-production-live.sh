#!/bin/bash
set -e

echo "🚀 Flansa Railway Live Deployment (Code Updates Only)"
echo "===================================================="

# Configuration
PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"

cd /home/frappe/frappe-bench

# ============================================
# 1. QUICK DATABASE CHECK
# ============================================
echo "📊 Quick Database Check"

if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "✅ Database configured"
else
    echo "❌ DATABASE_URL not found"
    exit 1
fi

# ============================================
# 2. USE EXISTING SITE
# ============================================
echo "♻️  Using existing site: $SITE_NAME"

# Just update configuration
mkdir -p "sites/$SITE_NAME"
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

# Common config with Redis
if [ -n "$REDIS_URL" ]; then
    REDIS_BASE=$(echo $REDIS_URL | sed 's/\/$//')
    REDIS_CONFIG='"redis_cache": "'$REDIS_BASE'/0",
  "redis_queue": "'$REDIS_BASE'/1",
  "redis_socketio": "'$REDIS_BASE'/2",'
else
    REDIS_CONFIG=''
fi

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
  "developer_mode": 0
}
EOF

bench use $SITE_NAME

# ============================================
# 3. QUICK MIGRATION CHECK
# ============================================
echo "🔄 Quick Migration Check"

# Only run if explicitly requested via environment variable
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running migrations (requested)..."
    bench --site $SITE_NAME migrate --skip-failing || true
else
    echo "⏭️  Skipping migrations (set RUN_MIGRATIONS=true to run)"
fi

# ============================================
# 4. RESTART AND SERVE
# ============================================
echo "🔄 Applying code changes"

# Clear Python cache to ensure new code is loaded
find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true

# Clear web cache
bench --site $SITE_NAME clear-cache || true

echo ""
echo "🚀 Starting Server"
echo "=================="
echo "Site: $SITE_NAME"
echo "Port: $PORT"
echo ""

# Start server
exec bench serve --port $PORT