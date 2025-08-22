#!/bin/bash
set -e

echo "🔧 Fixing Guest User Issue"
echo "=========================="

SITE_NAME="flansa-mvp-alb-1568283482.us-east-1.elb.amazonaws.com"

cd /home/frappe/frappe-bench

# Create Guest user if not exists
bench --site $SITE_NAME console <<EOF
import frappe
frappe.init(site="$SITE_NAME")
frappe.connect()

# Check if Guest user exists
if not frappe.db.exists("User", "Guest"):
    print("Creating Guest user...")
    guest = frappe.new_doc("User")
    guest.email = "guest@example.com"
    guest.first_name = "Guest"
    guest.enabled = 1
    guest.user_type = "Website User"
    guest.flags.ignore_permissions = True
    guest.flags.ignore_password_policy = True
    guest.insert()
    frappe.db.commit()
    print("✅ Guest user created")
else:
    print("✅ Guest user already exists")
    # Ensure Guest user is enabled
    frappe.db.set_value("User", "Guest", "enabled", 1)
    frappe.db.commit()

# Set Guest as default user for unauthenticated access
frappe.db.set_single_value("Website Settings", "default_guest_user", "Guest")
frappe.db.commit()
print("✅ Guest user configured as default")

frappe.destroy()
EOF

echo "✅ Guest user issue fixed!"