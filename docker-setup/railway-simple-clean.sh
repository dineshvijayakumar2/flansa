#!/bin/bash
set -e

echo "🚀 Flansa Railway - Simple Clean Setup"
echo "======================================"

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
    # Use postgres as database name to match the user
    DB_NAME="postgres"
    
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME (using postgres to match user)"
else
    DB_USER="$PGUSER"
    DB_PASSWORD="$PGPASSWORD"
    DB_HOST="$PGHOST"
    DB_PORT="$PGPORT"
    DB_NAME="postgres"
fi

# Create logs directory
mkdir -p /home/frappe/logs

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 Creating site with postgres database..."
    
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
    bench --site $SITE_NAME install-app flansa || echo "⚠️ Flansa installation had issues"
    
    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
    echo "✅ Setup complete"
else
    echo "✅ Using existing site"
    bench use $SITE_NAME
fi

# Update site configurations
echo "🔧 Updating site configurations..."

cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "$DB_NAME",
  "db_type": "postgres",
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_password": "$DB_PASSWORD"
}
EOF

cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  "default_site": "$SITE_NAME"
}
EOF

echo "✅ Configurations updated"

# Show config for debugging
echo "🔍 Site configuration:"
cat "sites/$SITE_NAME/site_config.json"

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Start server
echo "🚀 Starting server..."
exec bench serve --port $PORT