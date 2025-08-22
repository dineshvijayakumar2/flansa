#!/bin/bash
# Bench wrapper that ensures correct database connection
set -e

echo "🎯 Bench Wrapper - Database Connection Override"
echo "=============================================="

# Force all database environment variables
export PGUSER="postgres"
export DB_USER="postgres"
export DATABASE_USER="postgres"
export FRAPPE_DB_USER="postgres"

# Get connection details from Railway
export PGHOST="${PGHOST:-postgres.railway.internal}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-railway}"

echo "🔧 Database connection forced to:"
echo "   User: postgres"
echo "   Host: $PGHOST"
echo "   Port: $PGPORT"
echo "   Database: $PGDATABASE"

# Create a custom bench command that overrides config
SITE_NAME="flansa-production-4543.up.railway.app"

# Force correct site config before every bench operation
update_site_config() {
    if [ -d "/home/frappe/frappe-bench/sites/$SITE_NAME" ]; then
        echo "🔧 Updating site config before bench operation..."
        cat > "/home/frappe/frappe-bench/sites/$SITE_NAME/site_config.json" <<EOF
{
  "db_name": "railway",
  "db_type": "postgres",
  "db_host": "$PGHOST",
  "db_port": $PGPORT,
  "db_user": "postgres",
  "db_password": "$PGPASSWORD"
}
EOF
        echo "✅ Site config updated"
    fi
}

# Update site config
update_site_config

# Also create/update common config
cat > "/home/frappe/frappe-bench/sites/common_site_config.json" <<EOF
{
  "db_host": "$PGHOST",
  "db_port": $PGPORT,
  "db_user": "postgres",
  "db_password": "$PGPASSWORD",
  "db_type": "postgres",
  "default_site": "$SITE_NAME"
}
EOF

echo "✅ Common site config updated"

# Change to frappe-bench directory
cd /home/frappe/frappe-bench

# Set Python path
export PYTHONPATH="/home/frappe/frappe-bench/apps/frappe:/home/frappe/frappe-bench/apps/flansa:$PYTHONPATH"

# Run the actual bench command with all overrides
echo "🚀 Starting bench serve with postgres user override..."

# Execute bench serve with proper environment
exec env \
    PGUSER="postgres" \
    DB_USER="postgres" \
    DATABASE_USER="postgres" \
    FRAPPE_DB_USER="postgres" \
    bench serve --port "${PORT:-8080}"