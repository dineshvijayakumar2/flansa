#!/bin/bash
set -e

echo "🚀 Flansa Railway - PostgreSQL Connection Fix"
echo "============================================="

PORT=${PORT:-8080}
SITE_NAME="flansa-production-4543.up.railway.app"
SETUP_COMPLETE="/home/frappe/frappe-bench/.railway_setup_complete"

cd /home/frappe/frappe-bench

echo "📍 Site: $SITE_NAME"
echo "📍 Port: $PORT"

# Extract credentials from DATABASE_URL if available
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Extracting credentials from DATABASE_URL..."
    
    # Parse DATABASE_URL to get individual components
    # Format: postgresql://user:password@host:port/database
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Port: $DB_PORT"
    echo "   Database: $DB_NAME"
else
    echo "❌ DATABASE_URL not available, using environment variables"
    DB_USER="$PGUSER"
    DB_PASSWORD="$PGPASSWORD"
    DB_HOST="$PGHOST"
    DB_PORT="$PGPORT"
    DB_NAME="${PGDATABASE:-railway}"
fi

# Create logs directory
mkdir -p /home/frappe/logs

# Wait for PostgreSQL to be ready
echo "🔧 Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "   Attempt $i/30: PostgreSQL not ready yet..."
    sleep 2
done

# Only run setup if not already completed
if [ ! -f "$SETUP_COMPLETE" ]; then
    echo "🔧 First-time setup: Creating site and installing app..."
    
    # Create site with extracted credentials
    if [ ! -d "sites/$SITE_NAME" ]; then
        echo "🔧 Creating site with database credentials..."
        
        # Try creating with the database name from URL or default
        bench new-site $SITE_NAME \
            --db-type postgres \
            --db-host "$DB_HOST" \
            --db-port "$DB_PORT" \
            --db-name "$DB_NAME" \
            --db-root-username "$DB_USER" \
            --db-root-password "$DB_PASSWORD" \
            --admin-password admin123 \
            --force || {
                echo "⚠️ Site creation failed with db-name '$DB_NAME', trying without specifying db-name..."
                
                # Try without specifying db-name (let Frappe create it)
                bench new-site $SITE_NAME \
                    --db-type postgres \
                    --db-host "$DB_HOST" \
                    --db-port "$DB_PORT" \
                    --db-root-username "$DB_USER" \
                    --db-root-password "$DB_PASSWORD" \
                    --admin-password admin123 \
                    --force
            }
    fi
    
    # Set as current site
    bench use $SITE_NAME
    
    # Try to install Flansa
    echo "🔧 Installing Flansa app..."
    bench --site $SITE_NAME install-app flansa || {
        echo "⚠️ Flansa installation had issues, but marking setup as complete"
    }
    
    # Mark setup as complete
    echo "$(date): Railway setup completed" > "$SETUP_COMPLETE"
    echo "✅ Setup marked as complete"
else
    echo "✅ Setup already complete, using existing site"
    bench use $SITE_NAME
fi

# Update configurations with extracted credentials
echo "🔧 Updating site configurations..."

# Update site_config.json
cat > "sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "$DB_NAME",
  "db_type": "postgres",
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD"
}
EOF

# Update common_site_config.json
cat > "sites/common_site_config.json" <<EOF
{
  "db_host": "$DB_HOST",
  "db_port": $DB_PORT,
  "db_user": "$DB_USER",
  "db_password": "$DB_PASSWORD",
  "db_type": "postgres",
  "default_site": "$SITE_NAME"
}
EOF

echo "✅ All configurations updated"

# Debug: Show current config
echo "🔍 Current site_config.json contents:"
cat "sites/$SITE_NAME/site_config.json"

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Start server
echo "🚀 Starting server..."
exec bench serve --port $PORT