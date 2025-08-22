#!/bin/bash
set -e

echo "🚀 Flansa Production Server (Railway with PGUSER fix)"
echo "======================================================"

PORT=${PORT:-8000}
# Use Railway's auto-generated domain or fallback
SITE_NAME=${RAILWAY_PUBLIC_DOMAIN:-"flansa-production-4543.up.railway.app"}

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

# Create site if needed using DATABASE_URL directly
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🔧 Creating site with Railway PostgreSQL using DATABASE_URL..."
    bench new-site $SITE_NAME \
        --db-type postgres \
        --database-url $DATABASE_URL \
        --admin-password admin123 \
        --force
fi

# Set as current site
echo "$SITE_NAME" > sites/currentsite.txt
bench use $SITE_NAME

# Force override any cached database connections
export PGUSER=postgres
export PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Install Flansa if not installed
if ! bench --site $SITE_NAME list-apps | grep -q "flansa"; then
    echo "🔧 Installing Flansa app with forced postgres user..."
    
    # Clear any cached connections
    bench --site $SITE_NAME clear-cache
    
    # Force rebuild site config
    cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "railway",
  "db_type": "postgres", 
  "db_host": "$PGHOST",
  "db_port": $PGPORT,
  "db_user": "postgres",
  "db_password": "$PGPASSWORD"
}
EOF
    
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