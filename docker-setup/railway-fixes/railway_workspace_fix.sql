-- SQL Script to Fix Flansa Workspace in Railway
-- Run these commands in Railway's flansa-database-viewer page

-- Step 1: Check current workspace
SELECT name, label, title FROM `tabWorkspace` WHERE name = 'Flansa';

-- Step 2: Delete the existing incorrect workspace
DELETE FROM `tabWorkspace` WHERE name = 'Flansa';

-- Step 3: Insert the corrected Flansa workspace with proper title and content
INSERT INTO `tabWorkspace` (
    name,
    creation,
    modified,
    modified_by,
    owner,
    docstatus,
    idx,
    label,
    title,  -- This is the fix: 'Flansa' instead of 'Flansa Administration'
    sequence_id,
    module,
    icon,
    public,
    is_hidden,
    hide_custom,
    restrict_to_domain,
    for_user,
    parent_page,
    indicator_color,
    content,
    _user_tags,
    _comments,
    _assign,
    _liked_by
) VALUES (
    'Flansa',
    NOW(),
    NOW(),
    'Administrator',
    'Administrator',
    0,
    0,
    'Flansa',
    'Flansa',  -- FIXED: Was 'Flansa Administration', now 'Flansa'
    0.000000000,
    'Flansa Core',
    'shield',
    1,
    0,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    '[{"id": "header1", "type": "header", "data": {"text": "<span class=\'h4\'>🛡️ Flansa Platform Administration</span>", "col": 12}}, {"id": "para1", "type": "paragraph", "data": {"text": "Super Admin portal for managing tenants and platform configuration", "col": 12}}, {"id": "spacer1", "type": "spacer", "data": {"col": 12}}, {"id": "subheader1", "type": "header", "data": {"text": "<span class=\'h5\'>Tenant Management</span>", "col": 12}}, {"id": "link_workspace", "type": "paragraph", "data": {"text": "<a href=\'/app/flansa-workspace\'>🏢 <b>Flansa Workspace</b></a> - Manage applications by tenant (main entry point for builders)", "col": 6}}, {"id": "link_tenant_switcher", "type": "paragraph", "data": {"text": "<a href=\'/app/tenant-switcher\'>🔄 <b>Switch Tenant</b></a> - Switch between different tenant contexts", "col": 6}}, {"id": "link_tenant_registration", "type": "paragraph", "data": {"text": "<a href=\'/app/tenant-registration\'>➕ <b>Register Tenant</b></a> - Create and configure new tenants", "col": 6}}, {"id": "spacer2", "type": "spacer", "data": {"col": 12}}, {"id": "subheader2", "type": "header", "data": {"text": "<span class=\'h5\'>System Tools</span>", "col": 12}}, {"id": "link_database", "type": "paragraph", "data": {"text": "<a href=\'/app/flansa-database-viewer\'>🗄️ <b>Database Viewer</b></a> - Direct database access and query tool", "col": 6}}, {"id": "spacer3", "type": "spacer", "data": {"col": 12}}, {"id": "info_note", "type": "paragraph", "data": {"text": "<div style=\'background-color: #f0f8ff; padding: 15px; border-radius: 5px; border-left: 4px solid #4169e1;\'><b>ℹ️ Navigation Hierarchy:</b><br>• <b>Flansa Workspace</b> → Lists apps per tenant<br>• <b>App Dashboard</b> → Lists tables within selected app<br>• <b>Visual Builder</b> → Shows fields within selected table<br><br><em>Tenant builders and end users should primarily access the Flansa Workspace page.</em></div>", "col": 12}}]',
    NULL,
    NULL,
    NULL,
    NULL
);

-- Step 4: Verify the fix
SELECT name, label, title FROM `tabWorkspace` WHERE name = 'Flansa';

-- After running these SQL commands, you need to:
-- 1. SSH into Railway container
-- 2. Run: bench --site mysite.local clear-cache
-- 3. Test that the logo now redirects to /app/flansa instead of /app/flansa-administration