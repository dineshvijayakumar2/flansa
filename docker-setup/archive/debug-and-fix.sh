#!/bin/bash
set -e

echo "🔍 Railway Database Debug and Fix"
echo "================================="

cd /home/frappe/frappe-bench

echo "🔍 Raw Environment Variables:"
echo "   DATABASE_URL: ${DATABASE_URL}"
echo "   PGUSER: ${PGUSER}"
echo "   PGHOST: ${PGHOST}"
echo "   PGPORT: ${PGPORT}"
echo "   PGPASSWORD: ${PGPASSWORD}"
echo "   PGDATABASE: ${PGDATABASE}"

if [ -n "$DATABASE_URL" ]; then
    echo ""
    echo "🔍 Parsing DATABASE_URL:"
    URL_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    URL_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    URL_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    URL_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    URL_DB=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   URL User: '$URL_USER'"
    echo "   URL Password: '${URL_PASSWORD:0:8}...'"
    echo "   URL Host: '$URL_HOST'"
    echo "   URL Port: '$URL_PORT'"
    echo "   URL Database: '$URL_DB'"
    
    echo ""
    echo "🔍 Variable Comparison:"
    echo "   PGUSER vs URL_USER: '$PGUSER' vs '$URL_USER'"
    if [ "$PGUSER" != "$URL_USER" ]; then
        echo "   ⚠️  USER MISMATCH! PGUSER should match URL_USER"
        echo "   🔧 SOLUTION: Set PGUSER=$URL_USER in Railway PostgreSQL service"
    fi
    
    echo ""
    echo "🧪 Testing Connections:"
    
    # Test 1: With URL credentials
    echo "Testing DATABASE_URL credentials..."
    if PGPASSWORD="$URL_PASSWORD" psql -h "$URL_HOST" -p "$URL_PORT" -U "$URL_USER" -d "$URL_DB" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ DATABASE_URL credentials work!"
        WORKING_USER="$URL_USER"
        WORKING_PASSWORD="$URL_PASSWORD"
        WORKING_DB="$URL_DB"
    else
        echo "❌ DATABASE_URL credentials failed"
    fi
    
    # Test 2: With environment variables
    echo "Testing environment variable credentials..."
    if PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "${PGDATABASE:-$URL_DB}" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Environment variable credentials work!"
        WORKING_USER="$PGUSER"
        WORKING_PASSWORD="$PGPASSWORD"
        WORKING_DB="${PGDATABASE:-$URL_DB}"
    else
        echo "❌ Environment variable credentials failed"
    fi
    
    if [ -n "$WORKING_USER" ]; then
        echo ""
        echo "🎯 SOLUTION FOUND!"
        echo "   Working User: $WORKING_USER"
        echo "   Working Database: $WORKING_DB"
        echo ""
        echo "📝 TO FIX IN RAILWAY:"
        echo "   1. Go to PostgreSQL service settings"
        echo "   2. Set PGUSER=$WORKING_USER"
        echo "   3. Make sure all variables match the working credentials"
        echo ""
        
        # Try creating site with working credentials
        SITE_NAME="flansa-production-4543.up.railway.app"
        SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"
        
        if [ ! -f "$SETUP_COMPLETE" ]; then
            echo "🔧 Attempting site creation with working credentials..."
            
            bench new-site $SITE_NAME \
                --db-type postgres \
                --db-host "$URL_HOST" \
                --db-port "$URL_PORT" \
                --db-name "$WORKING_DB" \
                --db-root-username "$WORKING_USER" \
                --db-root-password "$WORKING_PASSWORD" \
                --admin-password admin123 \
                --force && {
                    
                echo "✅ Site created successfully!"
                bench use $SITE_NAME
                
                # Create proper config with db_user
                cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "$WORKING_DB",
  "db_type": "postgres",
  "db_host": "$URL_HOST",
  "db_port": $URL_PORT,
  "db_user": "$WORKING_USER",
  "db_password": "$WORKING_PASSWORD"
}
EOF
                echo "✅ Site config created with db_user"
                
                # Install Flansa
                bench --site $SITE_NAME install-app flansa && {
                    echo "✅ Flansa installed!"
                    echo "$(date): Setup completed" > "$SETUP_COMPLETE"
                }
            }
        else
            echo "✅ Site already exists"
            bench use $SITE_NAME
        fi
        
        # Start server
        export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"
        echo "🚀 Starting server..."
        exec bench serve --port ${PORT:-8080}
        
    else
        echo ""
        echo "❌ NO WORKING CREDENTIALS FOUND"
        echo "   Check your Railway PostgreSQL service configuration"
        exit 1
    fi
    
else
    echo "❌ DATABASE_URL not set"
    exit 1
fi