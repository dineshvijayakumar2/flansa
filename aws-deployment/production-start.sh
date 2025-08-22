#!/bin/bash
set -e

echo "🚀 Flansa Production Server (Final Version)"
echo "=========================================="

PORT=${PORT:-8000}
SITE_NAME="flansa-mvp.local"

# Work from frappe-bench directory  
cd /home/frappe/frappe-bench

# MariaDB connection details
DB_HOST=${DB_HOST:-"flansa-mvp-mysql.copguw28cxxg.us-east-1.rds.amazonaws.com"}
DB_USER=${DB_USER:-"flansa_admin"}
DB_PASS=${DB_PASS:-"FlanSa2025Prod"}

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Create site if needed
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🔧 Creating site..."
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
    bench --site $SITE_NAME install-app flansa
fi

# Start server - use the simplest working approach
echo "🚀 Starting server..."

# Option 1: Try bench serve (simple)
exec bench serve || {
    echo "Bench serve failed, trying gunicorn directly..."
    # Option 2: Use gunicorn with proper WSGI app
    cd /home/frappe/frappe-bench
    export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"
    exec env/bin/gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 frappe.app:application
}