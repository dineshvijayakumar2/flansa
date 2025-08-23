#!/bin/bash
set -e

echo "🚀 Flansa Railway - Wrapper Approach"
echo "===================================="

# Simple environment setup
echo "🔧 Setting up environment..."
source simple-env-patch.sh

PORT=${PORT:-8080}
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

# Check if DATABASE_URL is empty and build it if needed
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️ DATABASE_URL is empty, building from individual components..."
    
    if [ -n "$PGPASSWORD" ]; then
        DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/railway"
        echo "✅ Built DATABASE_URL from components"
    else
        echo "❌ ERROR: PGPASSWORD not available to build DATABASE_URL"
        echo "   Available: PGUSER=$PGUSER, PGHOST=$PGHOST, PGPORT=$PGPORT"
        exit 1
    fi
fi

echo "✅ DATABASE_URL available (length: ${#DATABASE_URL})"

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
            --db-root-username "$PGUSER" \
            --db-root-password "$PGPASSWORD_EXTRACTED" \
            --admin-password admin123 \
            --force
    fi
    
    # Set as current site
    bench use $SITE_NAME
    
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

# Always update configurations before starting
echo "🔧 Updating site configurations..."

# Update site_config.json
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

# Update common_site_config.json
cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$PGHOST",
  "db_port": $PGPORT,
  "db_user": "$PGUSER",
  "db_password": "$PGPASSWORD",
  "db_type": "postgres",
  "default_site": "$SITE_NAME"
}
EOF

echo "✅ All configurations updated"

# Debug: Show what's actually in the site config
echo "🔍 Current site_config.json contents:"
cat "sites/$SITE_NAME/site_config.json" || echo "❌ site_config.json not found"

echo "🚀 Starting server with wrapper approach..."

# Use the bench wrapper instead of direct bench serve
exec ./bench-wrapper.sh