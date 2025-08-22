#!/bin/bash
set -e

echo "Starting Frappe + Flansa on ECS Fargate (Simplified)"
echo "===================================================="

# Use PORT or default to 8000
PORT=${PORT:-8000}
SITE_NAME="flansa-mvp.local"

echo "Site: $SITE_NAME"
echo "Port: $PORT"

# Skip all bench commands - directly configure files
echo "Configuring site..."

# Create site directory
mkdir -p sites/$SITE_NAME

# Create site_config.json with direct values (no parsing)
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
  "disable_website_cache": true
}
EOF

# Set current site
echo "$SITE_NAME" > sites/currentsite.txt

# Set PostgreSQL environment variables directly
export PGUSER="flansa_admin"
export PGPASSWORD="FlanSa2025Prod"
export PGHOST="flansa-mvp-db.copguw28cxxg.us-east-1.rds.amazonaws.com"
export PGPORT="5432"
export PGDATABASE="flansa_production"

echo "Testing database connection..."
psql -c "SELECT version();" || echo "Database connection test failed, continuing anyway..."

echo "Starting Gunicorn server..."
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