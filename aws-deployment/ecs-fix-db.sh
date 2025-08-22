#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa on ECS (Database Fix)"
echo "================================================="

PORT=${PORT:-8000}
SITE_NAME="flansa-mvp.local"

# Set PostgreSQL environment variables
export PGUSER="flansa_admin"
export PGPASSWORD="FlanSa2025Prod"
export PGHOST="flansa-mvp-db.copguw28cxxg.us-east-1.rds.amazonaws.com"
export PGPORT="5432"

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"
echo "📍 Host: $PGHOST"

# Create the flansa_admin database if it doesn't exist
echo "🔧 Creating database 'flansa_admin' if needed..."
export PGDATABASE="postgres"  # Connect to default postgres database first
psql -tc "SELECT 1 FROM pg_database WHERE datname = 'flansa_admin'" | grep -q 1 || psql -c "CREATE DATABASE flansa_admin" || echo "Database creation failed, continuing..."

# Also ensure flansa_production exists
echo "🔧 Creating database 'flansa_production' if needed..."
psql -tc "SELECT 1 FROM pg_database WHERE datname = 'flansa_production'" | grep -q 1 || psql -c "CREATE DATABASE flansa_production" || echo "Database creation failed, continuing..."

# Now set the correct database
export PGDATABASE="flansa_production"

echo "📊 Available databases:"
psql -c "\l" || echo "Could not list databases"

# Create site directory
mkdir -p sites/$SITE_NAME

# Create site_config.json - use flansa_production as the main database
cat > sites/$SITE_NAME/site_config.json << 'EOF'
{
  "db_type": "postgres",
  "db_host": "flansa-mvp-db.copguw28cxxg.us-east-1.rds.amazonaws.com",
  "db_port": 5432,
  "db_name": "flansa_production",
  "db_user": "flansa_admin",
  "db_password": "FlanSa2025Prod",
  "redis_cache": "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379",
  "redis_queue": "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379",
  "redis_socketio": "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379"
}
EOF

# Create common_site_config.json
cat > sites/common_site_config.json << 'EOF'
{
  "db_type": "postgres",
  "redis_cache": "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379",
  "redis_queue": "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379",
  "redis_socketio": "redis://flansa-mvp-redis.iugqi6.0001.use1.cache.amazonaws.com:6379",
  "skip_setup_wizard": true,
  "disable_website_cache": true,
  "db_host": "flansa-mvp-db.copguw28cxxg.us-east-1.rds.amazonaws.com",
  "db_port": 5432,
  "db_user": "flansa_admin",
  "db_password": "FlanSa2025Prod",
  "db_name": "flansa_production"
}
EOF

# Set current site
echo "$SITE_NAME" > sites/currentsite.txt

echo "✅ Configuration complete"
echo "🚀 Starting Gunicorn server..."

cd /home/frappe/frappe-bench
exec gunicorn \
  --bind 0.0.0.0:$PORT \
  --workers 2 \
  --timeout 120 \
  --worker-class sync \
  --worker-tmp-dir /dev/shm \
  --access-logfile - \
  --error-logfile - \
  --log-level info \
  frappe.app:application