#!/bin/bash
# Ultra-simple Railway startup - assumes site exists
set -e

echo "🚀 Railway Simple Start"
echo "======================"

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"

cd /home/frappe/frappe-bench

# Parse database URL
if [ -n "$DATABASE_URL" ]; then
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
fi

# Quick config update
mkdir -p sites/$SITE_NAME
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

# Redis config if available
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
  "serve_default_site": true
}
EOF

bench use $SITE_NAME

# Only migrate if requested
[ "$RUN_MIGRATIONS" = "true" ] && bench --site $SITE_NAME migrate --skip-failing || echo "⏭️ Skipping migrations"

# Clear cache for code changes
bench --site $SITE_NAME clear-cache || true

echo "🚀 Starting server on port $PORT"
exec bench serve --port $PORT