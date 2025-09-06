/**
 * Flansa Role Manager - Hierarchical role management interface
 * Manages platform, workspace, application, and custom roles
 */

frappe.pages['flansa-role-manager'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Role Manager',
        single_column: true
    });
    
    new FlansaRoleManager(page);
};

class FlansaRoleManager {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        // Hide default page header
        $(page.wrapper).find('.page-head').hide();
        
        // State management
        this.current_view = 'overview'; // 'overview', 'users', 'roles', 'permissions'
        this.context = {
            scope: 'platform',
            application_id: null,
            workspace_id: null
        };
        this.user_capabilities = null;
        this.contextual_data = null;
        
        this.extract_context();
        this.init();
    }
    
    extract_context() {
        // Extract context from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        
        this.context.application_id = urlParams.get('app');
        this.context.workspace_id = urlParams.get('workspace') || urlParams.get('tenant');
        
        // Determine scope
        if (this.context.application_id) {
            this.context.scope = 'application';
        } else if (this.context.workspace_id) {
            this.context.scope = 'workspace';
        } else {
            this.context.scope = 'platform';
        }
        
        console.log('Role Manager Context:', this.context);
    }
    
    init() {
        this.load_contextual_data().then(() => {
            this.setup_ui();
            this.update_contextual_ui();
            this.bind_events();
            // Load initial view content
            this.load_view_content(this.current_view);
        });
    }
    
    async load_contextual_data() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.contextual_role_manager.get_contextual_role_data',
                args: {
                    app_id: this.context.application_id,
                    tenant_id: this.context.workspace_id
                }
            });
            
            if (response.message) {
                this.contextual_data = response.message;
                this.user_capabilities = response.message.capabilities;
                console.log('Contextual role data loaded:', this.contextual_data);
            }
        } catch (error) {
            console.error('Failed to load contextual role data:', error);
            frappe.show_alert('Failed to load role management data', 'red');
        }
    }
    
    render_breadcrumbs() {
        if (!this.contextual_data || !this.contextual_data.breadcrumbs) return;
        
        const breadcrumbsHtml = this.contextual_data.breadcrumbs.map(crumb => {
            if (crumb.current) {
                return `<span class="breadcrumb-current">
                    <i class="fa fa-${crumb.icon}"></i> ${crumb.label}
                </span>`;
            } else {
                return `<a href="${crumb.route}" class="breadcrumb-link">
                    <i class="fa fa-${crumb.icon}"></i>
                    <span>${crumb.label}</span>
                </a>
                <i class="fa fa-chevron-right breadcrumb-divider"></i>`;
            }
        }).join('');
        
        $('#dynamic-breadcrumbs').html(breadcrumbsHtml);
    }
    
    update_contextual_ui() {
        if (!this.contextual_data) return;
        
        // Update title and description
        $('#role-manager-title').text(this.contextual_data.page_title || 'Role Manager');
        
        let contextDescription = '';
        switch (this.context.scope) {
            case 'application':
                contextDescription = `Application Role Management - ${this.user_capabilities.user_role}`;
                break;
            case 'workspace':
                contextDescription = `Workspace Role Management - ${this.user_capabilities.user_role}`;
                break;
            case 'platform':
                contextDescription = `Platform Role Management - ${this.user_capabilities.user_role}`;
                break;
        }
        
        $('#context-description').text(contextDescription);
        
        // Show/hide create custom role button based on permissions
        if (this.user_capabilities.can_create_custom_roles && this.context.scope === 'application') {
            $('#create-custom-role-btn').show();
        } else {
            $('#create-custom-role-btn').hide();
        }
        
        // Render breadcrumbs
        this.render_breadcrumbs();
    }
    
    setup_ui() {
        this.$container.html(`
            <div class="flansa-role-manager">
                <!-- Sleek Header -->
                <div class="sleek-header">
                    <div class="header-backdrop"></div>
                    <div class="header-content">
                        <nav class="breadcrumb-trail" id="dynamic-breadcrumbs">
                            <!-- Breadcrumbs will be populated dynamically -->
                        </nav>
                    </div>
                    
                    <div class="app-banner">
                        <div class="banner-left">
                            <div class="app-info">
                                <div class="app-details">
                                    <h1 class="app-name" id="role-manager-title">Role Manager</h1>
                                    <div class="app-type">
                                        <div class="counter-pill">
                                            <i class="fa fa-users"></i>
                                            <span class="counter-text" id="context-description">Loading...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="banner-right">
                            <button class="sleek-btn primary" id="create-custom-role-btn">
                                <i class="fa fa-plus"></i>
                                <span>Create Custom Role</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Navigation Tabs -->
                <div class="role-nav-tabs">
                    <button class="nav-tab active" data-view="overview">
                        <i class="fa fa-dashboard"></i>
                        <span>Overview</span>
                    </button>
                    <button class="nav-tab" data-view="users">
                        <i class="fa fa-users"></i>
                        <span>User Management</span>
                    </button>
                    <button class="nav-tab" data-view="roles">
                        <i class="fa fa-shield"></i>
                        <span>Role Management</span>
                    </button>
                    <button class="nav-tab" data-view="permissions">
                        <i class="fa fa-key"></i>
                        <span>Permissions Matrix</span>
                    </button>
                </div>
                
                <!-- Content Area -->
                <div class="role-content-area">
                    <!-- Overview Tab -->
                    <div class="tab-content active" id="overview-tab">
                        <div class="overview-cards">
                            <div class="role-card">
                                <div class="card-header">
                                    <h3><i class="fa fa-globe"></i> Platform Roles</h3>
                                </div>
                                <div class="card-body">
                                    <div class="role-list" id="platform-roles-list">
                                        Loading...
                                    </div>
                                </div>
                            </div>
                            
                            <div class="role-card">
                                <div class="card-header">
                                    <h3><i class="fa fa-building"></i> Workspace Roles</h3>
                                </div>
                                <div class="card-body">
                                    <div class="role-list" id="workspace-roles-list">
                                        Loading...
                                    </div>
                                </div>
                            </div>
                            
                            <div class="role-card">
                                <div class="card-header">
                                    <h3><i class="fa fa-mobile"></i> Application Roles</h3>
                                </div>
                                <div class="card-body">
                                    <div class="role-list" id="application-roles-list">
                                        Loading...
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Current User Hierarchy -->
                        <div class="user-hierarchy-card">
                            <div class="card-header">
                                <h3><i class="fa fa-user"></i> Your Role Hierarchy</h3>
                                <span class="role-level" id="user-role-level">Level: --</span>
                            </div>
                            <div class="card-body">
                                <div class="hierarchy-tree" id="user-hierarchy-tree">
                                    Loading your role hierarchy...
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- User Management Tab -->
                    <div class="tab-content" id="users-tab">
                        <div class="user-management-tools">
                            <div class="search-bar">
                                <input type="text" id="user-search" placeholder="Search users..." class="form-control">
                            </div>
                            <button class="btn btn-primary" id="assign-role-btn">
                                <i class="fa fa-plus"></i> Assign Role
                            </button>
                        </div>
                        
                        <div class="users-table-container">
                            <table class="table users-table" id="users-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Platform Roles</th>
                                        <th>Workspace Roles</th>
                                        <th>Application Roles</th>
                                        <th>Effective Level</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="6" class="text-center">Loading users...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Role Management Tab -->
                    <div class="tab-content" id="roles-tab">
                        <div class="role-management-tools">
                            <div class="role-filters">
                                <select class="form-control" id="role-scope-filter">
                                    <option value="">All Scopes</option>
                                    <option value="platform">Platform</option>
                                    <option value="workspace">Workspace</option>
                                    <option value="application">Application</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="roles-grid" id="roles-grid">
                            Loading roles...
                        </div>
                    </div>
                    
                    <!-- Permissions Matrix Tab -->
                    <div class="tab-content" id="permissions-tab">
                        <div class="permissions-matrix-container">
                            <div class="matrix-filters">
                                <select class="form-control" id="application-filter">
                                    <option value="">All Applications</option>
                                </select>
                            </div>
                            
                            <div class="permissions-matrix" id="permissions-matrix">
                                Loading permissions matrix...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .flansa-role-manager {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                
                .sleek-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
                    border-bottom: 1px solid #e2e8f0;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    backdrop-filter: blur(8px);
                }
                
                .header-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(248, 250, 252, 0.9);
                    backdrop-filter: blur(8px);
                }
                
                .header-content {
                    position: relative;
                    z-index: 2;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 12px 24px 0;
                }
                
                .breadcrumb-trail {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    margin-bottom: 0;
                }
                
                .breadcrumb-link {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #6b7280;
                    text-decoration: none;
                    font-weight: 500;
                    transition: color 0.2s ease;
                }
                
                .breadcrumb-link:hover {
                    color: #4f46e5;
                }
                
                .breadcrumb-divider {
                    color: #9ca3af;
                }
                
                .breadcrumb-current {
                    color: #374151;
                    font-weight: 600;
                }
                
                .app-banner {
                    background: white;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px 24px;
                    position: relative;
                    z-index: 1;
                }
                
                .banner-left {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                
                .app-name {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0;
                    line-height: 1.2;
                }
                
                .counter-pill {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #f3f4f6;
                    color: #6b7280;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                    margin-top: 8px;
                }
                
                .sleek-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border: 1px solid #d1d5db;
                    background: white;
                    color: #374151;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                }
                
                .sleek-btn.primary {
                    background: #4f46e5;
                    color: white;
                    border-color: #4f46e5;
                }
                
                .sleek-btn:hover {
                    border-color: #4f46e5;
                    color: #4f46e5;
                }
                
                .sleek-btn.primary:hover {
                    background: #4338ca;
                    border-color: #4338ca;
                }
                
                .role-nav-tabs {
                    display: flex;
                    background: white;
                    border-bottom: 1px solid #e2e8f0;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 24px;
                }
                
                .nav-tab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 16px 20px;
                    background: none;
                    border: none;
                    color: #6b7280;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s ease;
                }
                
                .nav-tab:hover {
                    color: #4f46e5;
                }
                
                .nav-tab.active {
                    color: #4f46e5;
                    border-bottom-color: #4f46e5;
                }
                
                .role-content-area {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 24px;
                }
                
                .tab-content {
                    display: none;
                }
                
                .tab-content.active {
                    display: block;
                }
                
                .overview-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 20px;
                    margin-bottom: 24px;
                }
                
                .role-card, .user-hierarchy-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                
                .card-header {
                    background: #f8fafc;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .card-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #374151;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .role-level {
                    background: #e0f2fe;
                    color: #0369a1;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .card-body {
                    padding: 20px;
                }
                
                .role-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .role-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: #f8fafc;
                    border-radius: 6px;
                    font-size: 14px;
                }
                
                .role-name {
                    font-weight: 500;
                    color: #374151;
                }
                
                .role-description {
                    font-size: 12px;
                    color: #6b7280;
                }
                
                .hierarchy-tree {
                    font-family: monospace;
                    white-space: pre-wrap;
                    background: #f8fafc;
                    padding: 16px;
                    border-radius: 8px;
                    font-size: 14px;
                    line-height: 1.6;
                }
                
                .user-management-tools {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    gap: 16px;
                }
                
                .search-bar {
                    flex: 1;
                    max-width: 400px;
                }
                
                .users-table-container {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .users-table {
                    width: 100%;
                    margin: 0;
                    border-collapse: collapse;
                }
                
                .users-table th {
                    background: #f8fafc;
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .users-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f1f5f9;
                }
                
                .roles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
            </style>
        `);
    }
    
    bind_events() {
        const self = this;
        
        // Tab navigation
        $(document).on('click', '.nav-tab', function() {
            const view = $(this).data('view');
            self.switch_view(view);
        });
        
        // Create custom role button
        $(document).on('click', '#create-custom-role-btn', () => {
            this.show_create_custom_role_dialog();
        });
        
        // Assign role button
        $(document).on('click', '#assign-role-btn', () => {
            this.show_assign_role_dialog();
        });
    }
    
    switch_view(view) {
        // Update active tab
        $('.nav-tab').removeClass('active');
        $(`.nav-tab[data-view="${view}"]`).addClass('active');
        
        // Update content
        $('.tab-content').removeClass('active');
        $(`#${view}-tab`).addClass('active');
        
        // Load specific content
        this.current_view = view;
        this.load_view_content(view);
    }
    
    load_view_content(view) {
        switch(view) {
            case 'overview':
                this.load_overview_content();
                break;
            case 'users':
                this.load_users_content();
                break;
            case 'roles':
                this.load_roles_content();
                break;
            case 'permissions':
                this.load_permissions_content();
                break;
        }
    }
    
    load_user_hierarchy() {
        frappe.call({
            method: 'flansa.flansa_core.hierarchical_role_service.get_user_hierarchy',
            callback: (r) => {
                if (r.message) {
                    this.user_hierarchy = r.message;
                    this.render_user_hierarchy();
                }
            }
        });
    }
    
    render_user_hierarchy() {
        if (!this.user_hierarchy) return;
        
        const hierarchy = this.user_hierarchy;
        let tree = '';
        
        if (hierarchy.platform_roles.length > 0) {
            tree += `🌐 Platform Roles:\\n`;
            hierarchy.platform_roles.forEach(role => {
                tree += `  ├─ ${role}\\n`;
            });
        }
        
        if (hierarchy.workspace_roles.length > 0) {
            tree += `🏢 Workspace Roles:\\n`;
            hierarchy.workspace_roles.forEach(role => {
                tree += `  ├─ ${role}\\n`;
            });
        }
        
        if (Object.keys(hierarchy.application_roles).length > 0) {
            tree += `📱 Application Roles:\\n`;
            Object.entries(hierarchy.application_roles).forEach(([appId, roles]) => {
                tree += `  └─ App: ${appId}\\n`;
                roles.forEach(role => {
                    tree += `     ├─ ${role}\\n`;
                });
            });
        }
        
        if (!tree) {
            tree = 'No special roles assigned\\nDefault: App Viewer';
        }
        
        $('#user-hierarchy-tree').text(tree);
        $('#user-role-level').text(`Level: ${hierarchy.effective_level}`);
    }
    
    load_overview_content() {
        // Load platform roles
        const platformRoles = [
            { name: 'Flansa Super Admin', description: 'Full platform access', level: 100 },
            { name: 'Flansa Platform Admin', description: 'Platform administration', level: 90 }
        ];
        
        let html = '';
        platformRoles.forEach(role => {
            html += `<div class="role-item">
                <div>
                    <div class="role-name">${role.name}</div>
                    <div class="role-description">${role.description}</div>
                </div>
                <div class="role-level">L${role.level}</div>
            </div>`;
        });
        $('#platform-roles-list').html(html);
        
        // Similar for workspace and application roles
        this.load_workspace_roles_overview();
        this.load_application_roles_overview();
    }
    
    load_workspace_roles_overview() {
        const workspaceRoles = [
            { name: 'Workspace Admin', description: 'Full workspace control', level: 80 },
            { name: 'Workspace Manager', description: 'Manage users and settings', level: 70 }
        ];
        
        let html = '';
        workspaceRoles.forEach(role => {
            html += `<div class="role-item">
                <div>
                    <div class="role-name">${role.name}</div>
                    <div class="role-description">${role.description}</div>
                </div>
                <div class="role-level">L${role.level}</div>
            </div>`;
        });
        $('#workspace-roles-list').html(html);
    }
    
    load_application_roles_overview() {
        const appRoles = [
            { name: 'App Owner', description: 'Application creator', level: 60 },
            { name: 'App Admin', description: 'Application administrator', level: 50 },
            { name: 'App Developer', description: 'Can modify structure', level: 45 },
            { name: 'App Editor', description: 'Can modify data', level: 40 },
            { name: 'App User', description: 'Standard user', level: 30 },
            { name: 'App Viewer', description: 'Read-only access', level: 20 }
        ];
        
        let html = '';
        appRoles.forEach(role => {
            html += `<div class="role-item">
                <div>
                    <div class="role-name">${role.name}</div>
                    <div class="role-description">${role.description}</div>
                </div>
                <div class="role-level">L${role.level}</div>
            </div>`;
        });
        $('#application-roles-list').html(html);
    }
    
    load_users_content() {
        $('#users-table tbody').html('<tr><td colspan="6" class="text-center">Loading users...</td></tr>');
        
        // This would be implemented to load actual users with their roles
        setTimeout(() => {
            $('#users-table tbody').html(`
                <tr>
                    <td><strong>${frappe.session.user}</strong><br><small>You</small></td>
                    <td><span class="badge badge-primary">System Manager</span></td>
                    <td><span class="badge badge-success">Workspace Admin</span></td>
                    <td><span class="badge badge-info">App Owner (3)</span></td>
                    <td><span class="role-level">L100</span></td>
                    <td><button class="btn btn-sm btn-secondary">Manage</button></td>
                </tr>
            `);
        }, 1000);
    }
    
    load_roles_content() {
        $('#roles-grid').html('Loading role definitions...');
        
        // This would load all role definitions
        setTimeout(() => {
            $('#roles-grid').html(`
                <div class="alert alert-info">
                    Role management functionality will be implemented here.
                    This will include creating, editing, and managing custom roles.
                </div>
            `);
        }, 500);
    }
    
    load_permissions_content() {
        $('#permissions-matrix').html('Loading permissions matrix...');
        
        // This would load the permissions matrix
        setTimeout(() => {
            $('#permissions-matrix').html(`
                <div class="alert alert-info">
                    Permissions matrix will be displayed here showing:
                    - Core page access by role
                    - Data permissions by role
                    - Custom permissions
                </div>
            `);
        }, 500);
    }
    
    show_create_custom_role_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Custom Role',
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'role_name',
                    label: 'Role Name',
                    reqd: 1
                },
                {
                    fieldtype: 'Link',
                    fieldname: 'application',
                    label: 'Application',
                    options: 'Flansa Application',
                    reqd: 1
                },
                {
                    fieldtype: 'Text',
                    fieldname: 'description',
                    label: 'Description'
                },
                {
                    fieldtype: 'Section Break'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'permissions_html',
                    options: `<div class="custom-permissions">
                        <h4>Permissions</h4>
                        <label><input type="checkbox" name="read_data"> Read Data</label><br>
                        <label><input type="checkbox" name="create_data"> Create Data</label><br>
                        <label><input type="checkbox" name="update_data"> Update Data</label><br>
                        <label><input type="checkbox" name="delete_data"> Delete Data</label><br>
                        <label><input type="checkbox" name="view_reports"> View Reports</label><br>
                        <label><input type="checkbox" name="create_reports"> Create Reports</label><br>
                    </div>`
                }
            ],
            primary_action_label: 'Create Role',
            primary_action: (values) => {
                // Collect selected permissions
                const permissions = [];
                dialog.$wrapper.find('input[type="checkbox"]:checked').each(function() {
                    permissions.push($(this).attr('name'));
                });
                
                frappe.call({
                    method: 'flansa.flansa_core.hierarchical_role_service.create_app_custom_role',
                    args: {
                        role_name: values.role_name,
                        application_id: values.application,
                        permissions: permissions,
                        description: values.description
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert('Custom role created successfully!', 'green');
                            dialog.hide();
                            this.load_view_content(this.current_view);
                        } else {
                            frappe.show_alert('Failed to create custom role', 'red');
                        }
                    }
                });
            }
        });
        
        dialog.show();
    }
    
    show_assign_role_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Assign Role to User',
            fields: [
                {
                    fieldtype: 'Link',
                    fieldname: 'user',
                    label: 'User',
                    options: 'User',
                    reqd: 1
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'scope',
                    label: 'Scope',
                    options: 'Platform\nWorkspace\nApplication',
                    reqd: 1,
                    change: () => {
                        this.update_role_options(dialog);
                    }
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'role',
                    label: 'Role',
                    reqd: 1
                },
                {
                    fieldtype: 'Link',
                    fieldname: 'context_id',
                    label: 'Context',
                    depends_on: 'eval:doc.scope != "Platform"'
                }
            ],
            primary_action_label: 'Assign Role',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.hierarchical_role_service.assign_user_role',
                    args: values,
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert('Role assigned successfully!', 'green');
                            dialog.hide();
                            this.load_view_content(this.current_view);
                        } else {
                            frappe.show_alert('Failed to assign role', 'red');
                        }
                    }
                });
            }
        });
        
        dialog.show();
    }
    
    update_role_options(dialog) {
        const scope = dialog.get_value('scope');
        const role_field = dialog.get_field('role');
        const context_field = dialog.get_field('context_id');
        
        let options = '';
        
        switch(scope) {
            case 'Platform':
                options = 'Flansa Super Admin\nFlansa Platform Admin';
                context_field.df.hidden = 1;
                break;
            case 'Workspace':
                options = 'Workspace Admin\nWorkspace Manager';
                context_field.df.label = 'Tenant ID';
                context_field.df.options = '';
                context_field.df.hidden = 0;
                break;
            case 'Application':
                options = 'App Owner\nApp Admin\nApp Developer\nApp Editor\nApp User\nApp Viewer';
                context_field.df.label = 'Application';
                context_field.df.options = 'Flansa Application';
                context_field.df.hidden = 0;
                break;
        }
        
        role_field.df.options = options;
        role_field.refresh();
        context_field.refresh();
    }
}