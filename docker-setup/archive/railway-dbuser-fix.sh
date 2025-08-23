#!/bin/bash
set -e

echo "🚀 Flansa Railway - DB User Fix"
echo "================================"

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

# Extract credentials from DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Extracting credentials from DATABASE_URL..."
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME"
else
    DB_USER="$PGUSER"
    DB_PASSWORD="$PGPASSWORD"
    DB_HOST="$PGHOST"
    DB_PORT="$PGPORT"
    DB_NAME="${PGDATABASE:-railway}"
fi

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 Creating site..."
    
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host "$DB_HOST" \
        --db-port "$DB_PORT" \
        --db-name "$DB_NAME" \
        --db-root-username "$DB_USER" \
        --db-root-password "$DB_PASSWORD" \
        --admin-password admin123 \
        --force
    
    bench use $SITE_NAME
    
    echo "🔧 Installing Flansa..."
    bench --site $SITE_NAME install-app flansa || true
    
    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
fi

# THIS IS THE KEY FIX: Ensure db_user is in site_config.json
echo "🔧 Fixing site_config.json with db_user..."
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

echo "✅ site_config.json updated with db_user: $DB_USER"

# Also update common_site_config.json
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

echo "✅ common_site_config.json updated"

# Show the config for debugging
echo "🔍 Final site_config.json:"
cat "sites/$SITE_NAME/site_config.json"

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Start server
echo "🚀 Starting server..."
exec bench serve --port $PORT