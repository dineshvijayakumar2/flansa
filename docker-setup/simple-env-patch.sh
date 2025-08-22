#!/bin/bash
# Simple environment-based database user override
# Works without Python imports or complex patching

echo "🎯 Simple Environment Database Patch"
echo "===================================="

# Set ALL possible environment variables that could affect database connection
export PGUSER="postgres"
export DB_USER="postgres" 
export DATABASE_USER="postgres"
export FRAPPE_DB_USER="postgres"
export POSTGRES_USER="postgres"

# Also set these in the shell environment permanently
echo 'export PGUSER="postgres"' >> ~/.bashrc
echo 'export DB_USER="postgres"' >> ~/.bashrc
echo 'export DATABASE_USER="postgres"' >> ~/.bashrc

echo "✅ All database user environment variables set to postgres"

# Force update ANY existing site configs that might have wrong user
SITE_DIR="/home/frappe/frappe-bench/sites"
if [ -d "$SITE_DIR" ]; then
    echo "🔧 Scanning for existing site configs to fix..."
    
    find "$SITE_DIR" -name "site_config.json" -type f | while read config_file; do
        if [ -f "$config_file" ]; then
            echo "🔧 Fixing $config_file"
            # Use sed to replace any db_user that's not postgres
            sed -i 's/"db_user": "[^"]*"/"db_user": "postgres"/g' "$config_file"
            echo "✅ Fixed $config_file"
        fi
    done
    
    # Also fix common_site_config.json
    if [ -f "$SITE_DIR/common_site_config.json" ]; then
        echo "🔧 Fixing common_site_config.json"
        sed -i 's/"db_user": "[^"]*"/"db_user": "postgres"/g' "$SITE_DIR/common_site_config.json"
        echo "✅ Fixed common_site_config.json"
    fi
fi

echo "🚀 Simple environment patch completed"