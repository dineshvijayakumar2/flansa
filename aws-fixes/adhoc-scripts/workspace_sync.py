#!/usr/bin/env python3
import frappe
import json

print("🚀 Starting simple workspace sync...", flush=True)

try:
    # Define complete workspace content
    content = [
        {
            "id": "header1", "type": "header", 
            "data": {"text": "<span class='h4'>🛡️ Flansa Platform Administration</span>", "col": 12}
        },
        {
            "id": "para1", "type": "paragraph",
            "data": {"text": "Super Admin portal for managing workspaces and platform configuration", "col": 12}
        },
        {
            "id": "spacer1", "type": "spacer", "data": {"col": 12}
        },
        {
            "id": "subheader1", "type": "header",
            "data": {"text": "<span class='h5'>Workspace Management</span>", "col": 12}
        },
        {
            "id": "link_platform_role_manager", "type": "paragraph",
            "data": {"text": "<a href='/app/flansa-role-manager'>👥 <b>Platform Role Manager</b></a> - Manage platform-wide roles and permissions", "col": 6}
        },
        {
            "id": "link_workspace", "type": "paragraph", 
            "data": {"text": "<a href='/app/flansa-workspace'>🏢 <b>Flansa Workspace</b></a> - View and manage workspace registry", "col": 6}
        },
        {
            "id": "link_workspace_builder", "type": "paragraph",
            "data": {"text": "<a href='/app/flansa-workspace-builder'>🏗️ <b>Workspace Builder</b></a> - Build and configure workspace applications", "col": 6}
        },
        {
            "id": "link_workspace_manager", "type": "paragraph",
            "data": {"text": "<a href='/app/workspace-manager'>🔄 <b>Workspace Manager</b></a> - Switch and manage workspace contexts", "col": 6}
        },
        {
            "id": "spacer2", "type": "spacer", "data": {"col": 12}
        },
        {
            "id": "subheader2", "type": "header",
            "data": {"text": "<span class='h5'>System Tools</span>", "col": 12}
        },
        {
            "id": "link_database", "type": "paragraph", 
            "data": {"text": "<a href='/app/flansa-database-viewer'>🗄️ <b>Database Viewer</b></a> - Direct database access and query tool", "col": 6}
        },
        {
            "id": "spacer3", "type": "spacer", "data": {"col": 12}
        },
        {
            "id": "info_note", "type": "paragraph",
            "data": {
                "text": "<div style='background-color: #f0f8ff; padding: 15px; border-radius: 5px; border-left: 4px solid #4169e1;'><b>ℹ️ Navigation Hierarchy:</b><br>• <b>Workspace Manager</b> → Switch between workspace contexts<br>• <b>Workspace Builder</b> → Main application building interface<br>• <b>App Dashboard</b> → Lists tables within selected app<br>• <b>Visual Builder</b> → Design and configure table fields<br>• <b>Form Builder</b> → Create custom forms for data entry<br>• <b>Report Builder</b> → Design reports and analytics<br>• <b>Dashboard Builder</b> → Create analytics dashboards<br><br><em>Workspace builders should start from the Workspace Builder page to create and manage applications.123</em></div>",
                "col": 12
            }
        }
    ]
    
    print("✅ Content defined", flush=True)
    
    # Get workspace
    workspace = frappe.get_doc("Workspace", "Flansa")
    print("✅ Workspace loaded", flush=True)
    
    # Update content
    workspace.content = json.dumps(content)
    workspace.hide_custom = 1
    print("✅ Content updated", flush=True)
    
    # Save
    workspace.save(ignore_permissions=True)
    frappe.db.commit()
    frappe.clear_cache()
    
    print("🎉 SUCCESS! Workspace updated from Python script!", flush=True)
    
except Exception as e:
    print(f"❌ Error: {str(e)}", flush=True)
    import traceback
    print(f"Details: {traceback.format_exc()}", flush=True)
