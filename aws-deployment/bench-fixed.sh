#!/bin/bash
set -e

echo "🚀 Starting Frappe + Flansa with bench serve (Fixed Parameters)"
echo "=============================================================="

PORT=${PORT:-8000}
SITE_NAME="flansa-mvp.local"

# Work from frappe-bench directory
cd /home/frappe/frappe-bench

echo "📍 Working directory: $(pwd)"
echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# MariaDB connection details
DB_HOST=${DB_HOST:-"flansa-mvp-mysql.copguw28cxxg.us-east-1.rds.amazonaws.com"}
DB_USER=${DB_USER:-"flansa_admin"}
DB_PASS=${DB_PASS:-"FlanSa2025Prod"}

echo "🔧 Database: $DB_HOST"

# Wait briefly for services
sleep 10

# Test MariaDB connection
echo "🔧 Testing MariaDB connection..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "SELECT 'Connection successful' as status;" 2>/dev/null || echo "Connection test failed, continuing..."

# Create site if needed using CORRECT bench parameters
if [ ! -d "sites/$SITE_NAME" ]; then
    echo "🏗️ Creating Frappe site with bench (fixed parameters)..."
    bench new-site $SITE_NAME \
        --db-host $DB_HOST \
        --db-root-username $DB_USER \
        --db-root-password $DB_PASS \
        --admin-password FlanSa2025Prod \
        --force
    echo "✅ Site created with bench"
else
    echo "✅ Site exists: $SITE_NAME"
fi

# Set as current site
echo "$SITE_NAME" > sites/currentsite.txt
bench use $SITE_NAME

# Install Flansa if not installed
if ! bench --site $SITE_NAME list-apps | grep -q "flansa"; then
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa
    echo "✅ Flansa installed"
fi

echo "🚀 Starting production server with bench serve..."
# Use bench serve for production
exec bench serve --port $PORT --host 0.0.0.0