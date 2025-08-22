#!/bin/bash
# Simple environment setup for Railway
# Uses Railway-provided environment variables

echo "🎯 Simple Environment Database Patch"
echo "===================================="

# Use Railway's environment variables - don't override them
echo "🔧 Using Railway environment variables:"
echo "   PGUSER: $PGUSER"
echo "   PGHOST: $PGHOST"
echo "   PGPORT: $PGPORT"

# Only set if not already set by Railway
if [ -z "$DB_USER" ]; then
    export DB_USER="$PGUSER"
fi
if [ -z "$DATABASE_USER" ]; then
    export DATABASE_USER="$PGUSER"
fi
if [ -z "$FRAPPE_DB_USER" ]; then
    export FRAPPE_DB_USER="$PGUSER"
fi

echo "✅ Database user environment variables aligned with Railway settings"

# Force update ANY existing site configs that might have wrong user
SITE_DIR="/home/frappe/frappe-bench/sites"
if [ -d "$SITE_DIR" ]; then
    echo "🔧 Scanning for existing site configs to fix..."
    
    find "$SITE_DIR" -name "site_config.json" -type f | while read config_file; do
        if [ -f "$config_file" ]; then
            echo "🔧 Fixing $config_file to use Railway user: $PGUSER"
            # Use sed to replace any db_user with Railway's PGUSER
            sed -i "s/\"db_user\": \"[^\"]*\"/\"db_user\": \"$PGUSER\"/g" "$config_file"
            echo "✅ Fixed $config_file"
        fi
    done
    
    # Also fix common_site_config.json
    if [ -f "$SITE_DIR/common_site_config.json" ]; then
        echo "🔧 Fixing common_site_config.json"
        sed -i "s/\"db_user\": \"[^\"]*\"/\"db_user\": \"$PGUSER\"/g" "$SITE_DIR/common_site_config.json"
        echo "✅ Fixed common_site_config.json"
    fi
fi

echo "🚀 Simple environment patch completed"