#!/usr/bin/env python3
import frappe
import json

def setup_hierarchical_role_system():
    """Setup the hierarchical role system DocTypes and roles"""
    print("🎯 SETTING UP HIERARCHICAL ROLE SYSTEM", flush=True)
    print("=" * 60, flush=True)

    try:
        # 1. Create Flansa Workspace User DocType
        print("Step 1: Creating Flansa Workspace User DocType...", flush=True)
        if not frappe.db.exists("DocType", "Flansa Workspace User"):
            workspace_user = frappe.get_doc({
                "doctype": "DocType",
                "name": "Flansa Workspace User",
                "module": "Flansa Core",
                "custom": 0,
                "is_virtual": 0,
                "issingle": 0,
                "istable": 0,
                "editable_grid": 1,
                "track_changes": 1,
                "fields": [
                    {
                        "fieldname": "user",
                        "label": "User",
                        "fieldtype": "Link",
                        "options": "User",
                        "reqd": 1,
                        "in_list_view": 1
                    },
                    {
                        "fieldname": "workspace_role",
                        "label": "Workspace Role",
                        "fieldtype": "Select",
                        "options": "Workspace Admin\nWorkspace Manager",
                        "reqd": 1,
                        "in_list_view": 1
                    },
                    {
                        "fieldname": "tenant_id",
                        "label": "Tenant ID",
                        "fieldtype": "Data",
                        "reqd": 1,
                        "in_standard_filter": 1
                    },
                    {
                        "fieldname": "assigned_by",
                        "label": "Assigned By",
                        "fieldtype": "Link",
                        "options": "User",
                        "read_only": 1
                    },
                    {
                        "fieldname": "assigned_on",
                        "label": "Assigned On",
                        "fieldtype": "Datetime",
                        "read_only": 1,
                        "default": "Now"
                    }
                ],
                "permissions": [
                    {
                        "role": "System Manager",
                        "read": 1,
                        "write": 1,
                        "create": 1,
                        "delete": 1
                    }
                ]
            })
            workspace_user.insert()
            print("✅ Flansa Workspace User DocType created", flush=True)
        else:
            print("⚠️ Flansa Workspace User DocType already exists", flush=True)
        
        # 2. Create Flansa Custom Role DocType
        print("Step 2: Creating Flansa Custom Role DocType...", flush=True)
        if not frappe.db.exists("DocType", "Flansa Custom Role"):
            custom_role = frappe.get_doc({
                "doctype": "DocType",
                "name": "Flansa Custom Role",
                "module": "Flansa Core",
                "custom": 0,
                "is_virtual": 0,
                "issingle": 0,
                "istable": 0,
                "editable_grid": 0,
                "track_changes": 1,
                "fields": [
                    {
                        "fieldname": "role_name",
                        "label": "Role Name",
                        "fieldtype": "Data",
                        "reqd": 1,
                        "in_list_view": 1,
                        "unique": 1
                    },
                    {
                        "fieldname": "application_id",
                        "label": "Application",
                        "fieldtype": "Link",
                        "options": "Flansa Application",
                        "reqd": 1,
                        "in_list_view": 1
                    },
                    {
                        "fieldname": "description",
                        "label": "Description",
                        "fieldtype": "Text"
                    },
                    {
                        "fieldname": "permissions",
                        "label": "Permissions (JSON)",
                        "fieldtype": "Code",
                        "options": "JSON",
                        "reqd": 1
                    },
                    {
                        "fieldname": "created_by",
                        "label": "Created By",
                        "fieldtype": "Link",
                        "options": "User",
                        "read_only": 1
                    },
                    {
                        "fieldname": "is_active",
                        "label": "Is Active",
                        "fieldtype": "Check",
                        "default": 1
                    }
                ],
                "permissions": [
                    {
                        "role": "System Manager",
                        "read": 1,
                        "write": 1,
                        "create": 1,
                        "delete": 1
                    }
                ]
            })
            custom_role.insert()
            print("✅ Flansa Custom Role DocType created", flush=True)
        else:
            print("⚠️ Flansa Custom Role DocType already exists", flush=True)
        
        # 3. Create platform-level roles in Frappe
        print("Step 3: Creating platform-level roles...", flush=True)
        platform_roles = [
            "Flansa Super Admin",
            "Flansa Platform Admin"
        ]
        
        for role_name in platform_roles:
            if not frappe.db.exists("Role", role_name):
                role = frappe.get_doc({
                    "doctype": "Role",
                    "role_name": role_name,
                    "desk_access": 1
                })
                role.insert()
                print(f"✅ Created role: {role_name}", flush=True)
            else:
                print(f"⚠️ Role already exists: {role_name}", flush=True)
        
        frappe.db.commit()
        print("🎉 Hierarchical role system setup completed successfully!", flush=True)
        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}", flush=True)
        import traceback
        print(f"🔍 Details: {traceback.format_exc()}", flush=True)
        frappe.db.rollback()
        return False