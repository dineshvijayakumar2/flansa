#!/bin/bash
set -e

echo "🚀 Flansa Production Server (Railway with PGUSER fix)"
echo "======================================================"

PORT=${PORT:-8000}
SITE_NAME="flansa-mvp.local"

cd /home/frappe/frappe-bench

# Use Railway's DATABASE_URL (standard approach)
# Railway automatically provides: PGUSER, POSTGRES_DB, DATABASE_URL
export DB_URL=${DATABASE_URL}
export PGHOST=${PGHOST:-$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')}
export PGPORT=${PGPORT:-$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')}
export PGDATABASE=${POSTGRES_DB:-"railway"}
export PGUSER=${PGUSER:-"postgres"}

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"
echo "📍 PGUSER: $PGUSER"
echo "📍 PGHOST: $PGHOST"
echo "📍 PGPORT: $PGPORT"

# Create logs directory
mkdir -p /home/frappe/logs

# Create site if needed
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🔧 Creating site with PostgreSQL..."
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host $PGHOST \
        --db-port $PGPORT \
        --admin-password admin123 \
        --force
fi

# Set as current site
echo "$SITE_NAME" > sites/currentsite.txt
bench use $SITE_NAME

# Install Flansa if not installed
if ! bench --site $SITE_NAME list-apps | grep -q "flansa"; then
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa
fi

echo "🚀 Starting server..."
exec bench serve --port $PORT --host 0.0.0.0 || {
    echo "Bench serve failed, using gunicorn..."
    export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"
    exec env/bin/gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 frappe.app:application
}