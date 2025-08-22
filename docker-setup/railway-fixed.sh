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
export PGPASSWORD=${PGPASSWORD:-$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')}
export PGDATABASE=${POSTGRES_DB:-"railway"}
export PGUSER=${PGUSER:-"postgres"}

# Also set for Frappe's database connection
export DATABASE_URL_POSTGRES="postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$PGDATABASE"

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"
echo "📍 PGUSER: $PGUSER"
echo "📍 PGHOST: $PGHOST"
echo "📍 PGPORT: $PGPORT"

# Create logs directory
mkdir -p /home/frappe/logs

# Create site configuration first
mkdir -p "sites/$SITE_NAME"

# Create site_config.json with correct PostgreSQL credentials
cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "railway",
  "db_type": "postgres",
  "db_host": "$PGHOST",
  "db_port": $PGPORT,
  "db_user": "$PGUSER",
  "db_password": "$PGPASSWORD"
}
EOF

# Create site if needed
if [ ! -f "sites/$SITE_NAME/site_config.json.bak" ]; then
    echo "🔧 Creating site with PostgreSQL..."
    bench new-site $SITE_NAME \
        --db-type postgres \
        --db-host $PGHOST \
        --db-port $PGPORT \
        --db-root-username $PGUSER \
        --db-root-password $PGPASSWORD \
        --admin-password admin123 \
        --force
    cp "sites/$SITE_NAME/site_config.json" "sites/$SITE_NAME/site_config.json.bak"
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
# Set Python path for both bench and gunicorn
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

exec bench serve --port $PORT --host 0.0.0.0 || {
    echo "Bench serve failed, using gunicorn..."
    cd /home/frappe/frappe-bench
    exec env/bin/gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --chdir /home/frappe/frappe-bench frappe.app:application
}