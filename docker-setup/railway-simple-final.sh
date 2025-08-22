#!/bin/bash
set -e

echo "🚀 Flansa Railway - Simple Final Approach"
echo "=========================================="

PORT=${PORT:-8000}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Debug Railway environment variables
echo "🔍 Debug - Environment Variables:"
echo "   DATABASE_URL length: ${#DATABASE_URL}"
echo "   PGUSER: $PGUSER"  
echo "   PGHOST: $PGHOST"
echo "   PGPORT: $PGPORT"

# Check if DATABASE_URL is empty
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is empty!"
    echo "   Railway should provide this automatically."
    echo "   Check your PostgreSQL service is running and linked."
    exit 1
fi

# Create logs directory once
mkdir -p /home/frappe/logs

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 First-time setup: Creating site and installing app..."
    
    # Create site with DATABASE_URL
    if [ ! -d "sites/$SITE_NAME" ]; then
        echo "🔧 Creating site with parsed DATABASE_URL components..."
        
        # Extract components from DATABASE_URL
        PGPASSWORD_EXTRACTED=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        
        bench new-site $SITE_NAME \
            --db-type postgres \
            --db-host "$PGHOST" \
            --db-port "$PGPORT" \
            --db-name "railway" \
            --db-root-username "postgres" \
            --db-root-password "$PGPASSWORD_EXTRACTED" \
            --admin-password admin123 \
            --force
    fi
    
    # Set as current site
    bench use $SITE_NAME
    
    # Force correct PostgreSQL config in site
    cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "railway",
  "db_type": "postgres",
  "db_host": "$PGHOST",
  "db_port": $PGPORT,
  "db_user": "postgres",
  "db_password": "$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')"
}
EOF
    
    # Try to install Flansa - if it fails, mark as complete anyway
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa || {
        echo "⚠️ Flansa installation had issues, but marking setup as complete"
        echo "Site created successfully, can install app manually later"
    }
    
    # Mark setup as complete to prevent recreation
    echo "$(date): Railway setup completed" > "$SETUP_COMPLETE"
    echo "✅ Setup marked as complete - will not recreate site on restart"
else
    echo "✅ Setup already complete, using existing site"
    bench use $SITE_NAME
fi

echo "🚀 Starting server with memory optimization..."
# Set Python path early
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Start with simple bench serve
exec bench serve --port $PORT --host 0.0.0.0