#!/bin/bash
set -e

echo "🚀 Flansa Production Server (Load Balancer Domain)"
echo "================================================="

PORT=${PORT:-8000}
# Use a generic site name that works with any domain
SITE_NAME="flansa-mvp.local"
ALB_DOMAIN="flansa-mvp-alb-1568283482.us-east-1.elb.amazonaws.com"

cd /home/frappe/frappe-bench

# MariaDB connection details
DB_HOST=${DB_HOST:-"flansa-mvp-mysql.copguw28cxxg.us-east-1.rds.amazonaws.com"}
DB_USER=${DB_USER:-"flansa_admin"}
DB_PASS=${DB_PASS:-"FlanSa2025Prod"}

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Create site with load balancer domain if needed
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🔧 Creating site with load balancer domain..."
    bench new-site $SITE_NAME \
        --db-host $DB_HOST \
        --db-root-username $DB_USER \
        --db-root-password $DB_PASS \
        --admin-password FlanSa2025Prod \
        --force
fi

# Set as current site
echo "$SITE_NAME" > sites/currentsite.txt

# Install Flansa if not installed  
if ! bench --site $SITE_NAME list-apps | grep -q "flansa"; then
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa
fi

# Skip Guest user setup for now - will handle manually if needed
echo "🔧 Skipping Guest user setup..."

# Also create the old site name as alias if it exists
if [ -d "sites/flansa-mvp.local" ]; then
    echo "🔧 Found existing site, migrating data..."
    # This will help if there's existing data
fi

echo "🚀 Starting server..."
# Disable Redis cache to avoid connection errors
export FRAPPE_REDIS_CACHE=""
export FRAPPE_REDIS_QUEUE=""
export FRAPPE_REDIS_SOCKETIO=""

# Use bench use to set the site
bench use $SITE_NAME

# Configure site for Gunicorn
echo "Starting Gunicorn on port $PORT..."
cd /home/frappe/frappe-bench

# Set environment variables for Frappe
export FRAPPE_SITE="$SITE_NAME"
export SITES_PATH="/home/frappe/frappe-bench/sites"

# Create common_site_config.json with generic site serving all domains
cat > sites/common_site_config.json <<EOF
{
  "default_site": "$SITE_NAME",
  "db_host": "$DB_HOST",
  "db_port": 3306,
  "redis_cache": "",
  "redis_queue": "",
  "redis_socketio": "",
  "serve_default_site": true,
  "developer_mode": 0,
  "allow_tests": false
}
EOF

# Create a symbolic link so ALB domain points to the same site
if [ ! -d "sites/$ALB_DOMAIN" ]; then
    ln -sf "$SITE_NAME" "sites/$ALB_DOMAIN"
    echo "✅ Created symlink: $ALB_DOMAIN -> $SITE_NAME"
fi

echo "Site config created for: $SITE_NAME"
cat sites/common_site_config.json

export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"
exec env/bin/gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --worker-class sync frappe.app:application