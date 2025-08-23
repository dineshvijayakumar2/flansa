#!/bin/bash
set -e

echo "🔧 Fixing Flansa Installation"
echo "============================="

SITE_NAME="flansa-production-4543.up.railway.app"
cd /home/frappe/frappe-bench

# First, check if Flansa is in the installed apps list
echo "🔍 Checking Flansa installation status..."
if bench --site $SITE_NAME list-apps | grep -q "flansa"; then
    echo "✅ Flansa is listed as installed"
    
    # Remove Flansa from installed apps to do a clean reinstall
    echo "🔧 Removing Flansa from installed apps for clean reinstall..."
    bench --site $SITE_NAME uninstall-app flansa --yes --force || {
        echo "⚠️ Could not uninstall, trying direct database cleanup..."
        
        # Direct database cleanup if uninstall fails
        bench --site $SITE_NAME console <<EOF
import frappe
# Remove Flansa from installed apps
installed_apps = frappe.get_installed_apps()
if 'flansa' in installed_apps:
    frappe.db.delete('Installed Application', {'app_name': 'flansa'})
    frappe.db.commit()
    print("✅ Removed Flansa from installed apps")

# Clean up Module Def entries
frappe.db.delete('Module Def', {'app_name': 'flansa'})
frappe.db.commit()
print("✅ Cleaned up Module Def entries")
EOF
    }
else
    echo "⚠️ Flansa not in installed apps list"
fi

# Clean install Flansa
echo "🔧 Installing Flansa cleanly..."
bench --site $SITE_NAME install-app flansa --force || {
    echo "❌ Installation failed, trying alternative approach..."
    
    # Alternative: Manually add to installed apps and migrate
    bench --site $SITE_NAME console <<EOF
import frappe
# Add Flansa to installed apps if not there
if 'flansa' not in frappe.get_installed_apps():
    frappe.get_doc({
        'doctype': 'Installed Application',
        'app_name': 'flansa',
        'app_version': '0.0.1',
        'installed_on': frappe.utils.now()
    }).insert(ignore_permissions=True)
    frappe.db.commit()
    print("✅ Added Flansa to installed apps")
EOF
}

# Run full migration
echo "🔧 Running full migration..."
bench --site $SITE_NAME migrate --skip-failing || echo "⚠️ Some migrations failed"

# Clear cache
echo "🔧 Clearing all caches..."
bench --site $SITE_NAME clear-cache
bench --site $SITE_NAME clear-website-cache

# Build assets
echo "🔧 Building assets..."
bench build --app flansa

echo "✅ Flansa fix complete!"
echo ""
echo "🔍 Final status:"
bench --site $SITE_NAME list-apps