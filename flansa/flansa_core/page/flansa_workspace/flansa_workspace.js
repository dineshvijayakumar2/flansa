/**
 * Flansa Workspace - Applications Management Interface
 * Main entry point for the no-code platform showing only applications
 */

frappe.pages['flansa-workspace'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Flansa Applications',
        single_column: true
    });
    
    // Initialize Flansa applications workspace
    new FlansaApplicationsWorkspace(page);
};

class FlansaApplicationsWorkspace {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        this.applications = [];
        this.filtered_apps = [];
        
        this.setup_page_header();
        this.setup_layout();
        this.setup_context_menu();
        this.bind_events();
        this.load_tenant_info();
        this.load_applications();
        
        // Store reference for theme functions
        window.flansa_workspace = this;
    }
    
    setup_page_header() {
        // Clean setup - no buttons above banner for consistent design
        
        // Hide default page header to make banner freeze at top
        this.hide_default_page_header();
        
        // Cache management buttons
        this.page.add_menu_item('🚀 Force Reload (Clear All)', () => {
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.forceReloadWithNuclearOption();
            } else {
                window.location.reload(true);
            }
        });
        
        this.page.add_menu_item('🔄 Refresh Assets Only', () => {
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.refreshAllAssets();
                frappe.show_alert('Assets refreshed!', 'green');
            } else {
                frappe.show_alert('Cache manager not available', 'orange');
            }
        });
        
        this.page.add_menu_item('🔍 Check Cache Issues', () => {
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.checkForCacheIssues();
            }
        });
        
        // Field sync tools removed - no longer needed with native field management
        
        // Only theme settings in menu (ellipsis)
        this.page.add_menu_item('🎨 Theme Settings', () => {
            this.show_theme_settings();
        });
    }
    
    hide_default_page_header() {
        // Hide the default Frappe page header to make our banner freeze at top
        $(this.wrapper).find('.page-head').hide();
        $('body .page-head').hide();
        
        // Also add CSS to ensure it stays hidden
        if (!$('#workspace-page-head-css').length) {
            $('<style id="workspace-page-head-css">')
                .text('.page-head { display: none !important; }')
                .appendTo('head');
        }
    }
    
    setup_layout() {
        const html = `
            <div class="flansa-applications-workspace">
                <!-- Compact Modern Header -->
                <div class="flansa-compact-header" style="background: var(--flansa-gradient-primary); color: var(--flansa-white); padding: 16px 20px; margin: 0 -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                    <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                        <!-- Optional Workspace Logo -->
                        <div class="workspace-logo-container" id="workspace-logo-container" style="display: none; margin-right: 8px;">
                            <img src="" alt="Workspace Logo" class="workspace-logo" id="workspace-logo" style="height: 32px; width: auto; max-width: 100px; object-fit: contain; border-radius: 4px;" />
                        </div>
                        <i class="fa fa-cubes" style="font-size: 18px; opacity: 0.9;"></i>
                        <span style="font-size: 16px; font-weight: 600;" id="workspace-title">Flansa Platform</span>
                        <div class="tenant-info-badge" style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 4px;" id="current-tenant-badge">
                            <i class="fa fa-user" style="font-size: 10px;"></i>
                            <span id="tenant-name-display">Loading...</span>
                        </div>
                    </div>
                    <div class="header-right" style="display: flex; align-items: center; gap: 12px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2;">Flansa Workspace</h3>
                        <div class="context-menu-wrapper" style="position: relative;">
                            <button id="context-menu-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: background-color 0.2s;" title="More options">
                                ⋯
                            </button>
                            <div id="context-menu" style="display: none; position: absolute; top: 40px; right: 0; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 1000; border: 1px solid rgba(0,0,0,0.1);">
                                <div class="context-menu-item" data-action="tenant-switcher" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-users" style="width: 16px;"></i>
                                    <span>Switch Tenant</span>
                                </div>
                                <div class="context-menu-item" data-action="register-tenant" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-plus-circle" style="width: 16px;"></i>
                                    <span>Register New Tenant</span>
                                </div>
                                <div class="context-menu-item" data-action="theme" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-paint-brush" style="width: 16px;"></i>
                                    <span>Theme Settings</span>
                                </div>
                                <div class="context-menu-item" data-action="refresh-cache" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-refresh" style="width: 16px;"></i>
                                    <span>Clear Cache</span>
                                </div>
                                <div class="context-menu-item" data-action="backup-apps" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-download" style="width: 16px;"></i>
                                    <span>Backup All Apps</span>
                                </div>
                                <div class="context-menu-item" data-action="keyboard-shortcuts" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-keyboard-o" style="width: 16px;"></i>
                                    <span>Keyboard Shortcuts</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Modern Breadcrumb Navigation -->
                <div class="flansa-breadcrumb-bar" style="background: rgba(255,255,255,0.95); padding: 8px 20px; margin: 0 -20px 16px -20px; font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; gap: 8px; font-size: 14px;" id="breadcrumb-container">
                    <a href="/app/flansa-workspace" style="color: #2d3748; text-decoration: none; font-weight: 600; font-weight: 500;">🏠 Workspace</a>
                </div>
                
                <!-- Content Area -->
                <div class="flansa-workspace-content">
                    <!-- Stats Section -->
                    <div class="section-header" style="border-bottom: 1px solid var(--flansa-border, var(--flansa-gray-200)); padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; font-weight: normal;">Applications</h4>
                        <small style="color: var(--flansa-text-secondary, var(--flansa-gray-600));"><span id="total-apps-count">-</span> application<span id="apps-plural">s</span></small>
                    </div>
                    
                    <!-- Toolbar -->
                    <div class="applications-toolbar">
                        <div class="toolbar-left">
                            <div class="flansa-quick-actions">
                                <button class="btn btn-flansa-primary" id="create-new-app">
                                    <i class="fa fa-plus"></i> New Application
                                </button>
                                <button class="btn btn-flansa-secondary" id="refresh-apps">
                                    <i class="fa fa-refresh"></i> Refresh
                                </button>
                            </div>
                        </div>
                        <div class="toolbar-center">
                            <div class="search-wrapper">
                                <input type="text" class="form-control search-input" 
                                    id="app-search" placeholder="Search applications..." />
                                <i class="fa fa-search search-icon"></i>
                            </div>
                        </div>
                        <div class="toolbar-right">
                            <select class="form-control filter-select" id="app-status-filter">
                                <option value="all">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Draft">Draft</option>
                                <option value="Archived">Archived</option>
                            </select>
                            <div class="view-toggle" style="display: flex; border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300)); border-radius: var(--flansa-radius-md); overflow: hidden;">
                                <button class="btn btn-default btn-sm view-btn active" data-view="grid" style="border: none; border-radius: 0; padding: 6px 12px;">
                                    <i class="fa fa-th"></i>
                                </button>
                                <button class="btn btn-default btn-sm view-btn" data-view="list" style="border: none; border-radius: 0; padding: 6px 12px;">
                                    <i class="fa fa-list"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Applications Container -->
                    <div class="applications-container">
                        <!-- Loading State -->
                        <div class="loading-placeholder" id="loading-state">
                            <i class="fa fa-spinner fa-spin"></i>
                            <p>Loading applications...</p>
                        </div>
                        
                        <!-- Applications Grid -->
                        <div class="applications-grid view-grid" id="applications-grid" style="display: none;">
                            <!-- Application cards will be rendered here -->
                        </div>
                        
                        <!-- Empty State -->
                        <div class="empty-state" id="empty-state" style="display: none;">
                            <div class="empty-state-icon">
                                <i class="fa fa-cubes"></i>
                            </div>
                            <div class="empty-state-title">No Applications Yet</div>
                            <div class="empty-state-description">Create your first application to start building powerful solutions</div>
                            <button class="btn btn-flansa-primary mt-3" id="create-first-app">
                                <i class="fa fa-plus"></i> Create Your First Application
                            </button>
                        </div>
                        
                        <!-- No Results State -->
                        <div class="empty-state" id="no-results-state" style="display: none;">
                            <div class="empty-state-icon">
                                <i class="fa fa-search"></i>
                            </div>
                            <div class="empty-state-title">No applications found</div>
                            <div class="empty-state-description">Try adjusting your search or filters</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.$container.html(html);
    }
    
    bind_events() {
        const self = this;
        
        // Header action buttons
        $('#create-new-app').on('click', function() {
            self.create_new_application();
        });
        
        $('#refresh-apps').on('click', function() {
            self.load_applications();
        });
        
        // Search functionality
        $('#app-search').on('input', function() {
            self.filter_applications();
        });
        
        // Status filter
        $('#app-status-filter').on('change', function() {
            self.filter_applications();
        });
        
        // View toggle
        $('.view-btn').on('click', function() {
            $('.view-btn').removeClass('active');
            $(this).addClass('active');
            const view = $(this).data('view');
            self.toggle_view(view);
        });
        
        // Create first app button
        $('#create-first-app').on('click', function() {
            self.create_new_application();
        });
    }
    
    load_applications() {
        const self = this;
        
        // Show loading state
        $('#loading-state').show();
        $('#applications-grid').hide();
        $('#empty-state').hide();
        $('#no-results-state').hide();
        
        frappe.call({
            method: 'flansa.flansa_core.api.workspace_api.get_user_applications',
            callback: (r) => {
                $('#loading-state').hide();
                
                if (r.message) {
                    self.applications = r.message || [];
                    self.filtered_apps = [...self.applications];
                    
                    // Update application count
                    self.update_stats();
                    
                    // Update banner info and load workspace logo
                    self.update_banner_info();
                    
                    if (self.applications.length > 0) {
                        self.render_applications();
                        $('#applications-grid').show();
                    } else {
                        $('#empty-state').show();
                    }
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: 'Failed to load applications'
                    });
                    $('#empty-state').show();
                }
            },
            error: (r) => {
                $('#loading-state').hide();
                $('#empty-state').show();
                frappe.msgprint({
                    title: 'Error',
                    indicator: 'red',
                    message: 'Failed to load applications. Please try again.'
                });
            }
        });
    }
    
    render_applications() {
        const apps_to_render = this.filtered_apps;
        
        if (apps_to_render.length === 0) {
            $('#applications-grid').hide();
            $('#no-results-state').show();
            return;
        }
        
        $('#no-results-state').hide();
        $('#applications-grid').show();
        
        let html = '';
        
        apps_to_render.forEach(app => {
            const status_badge = this.get_status_badge(app.status);
            
            html += `
                <div class="grid-item flansa-card" data-app-name="${app.name}">
                    <div class="item-header">
                        <div class="item-icon">
                            <i class="fa fa-cube"></i>
                        </div>
                        <div class="item-title">${app.app_title || app.name}</div>
                    </div>
                    <div class="item-meta">
                        <small>${app.table_count || 0} tables</small>
                        <small>${this.format_date(app.creation)}</small>
                        <small class="status-badge ${status_badge.class}">${status_badge.text}</small>
                    </div>
                    <div class="item-description">
                        ${app.description || 'No description provided'}
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-sm btn-flansa-primary open-app-btn" data-app="${app.name}">
                            <i class="fa fa-external-link"></i> Open
                        </button>
                        <button class="btn btn-sm btn-flansa-secondary edit-app-btn" data-app="${app.name}">
                            <i class="fa fa-cog"></i> Settings
                        </button>
                        <button class="btn btn-sm btn-danger delete-app-btn" data-app="${app.name}" title="Delete Application">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        $('#applications-grid').html(html);
        
        // Bind card events
        this.bind_card_events();
    }
    
    bind_card_events() {
        const self = this;
        
        // Open application - Navigate to application builder
        $('.open-app-btn').on('click', function() {
            const app_name = $(this).data('app');
            self.open_application(app_name);
        });
        
        // Edit application - go to App Dashboard
        $('.edit-app-btn').on('click', function() {
            const app_name = $(this).data('app');
            // Navigate to app dashboard which has settings and management options
            window.location.href = `/app/flansa-app-builder/${app_name}`;
        });
        
        // Delete application
        $('.delete-app-btn').on('click', function(e) {
            e.stopPropagation(); // Prevent opening the app
            const app_name = $(this).data('app');
            self.delete_application(app_name);
        });
        
        
        // Click on card to open (avoid buttons)
        $('.grid-item').on('click', function(e) {
            if (!$(e.target).closest('.item-actions').length && !$(e.target).closest('button').length) {
                const app_name = $(this).data('app-name');
                self.open_application(app_name);
            }
        });
    }
    
    open_application(app_name) {
        // Navigate to application dashboard page
        // This shows the application home with stats and overview
        window.location.href = `/app/flansa-app-builder/${app_name}`;
    }
    
    create_new_application() {
        const self = this;
        let app_name_manually_edited = false;
        let last_auto_generated_name = '';
        
        const dialog = new frappe.ui.Dialog({
            title: 'Create New Application',
            fields: [
                {
                    label: 'Display Title',
                    fieldname: 'app_title',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Title shown to users',
                    change: () => {
                        // Auto-generate normalized application name from title
                        const title = dialog.get_value('app_title');
                        
                        if (title) {
                            const normalized_name = self.normalize_app_name(title);
                            const current_app_name = dialog.get_value('app_name');
                            
                            // Check if current app_name matches our last auto-generated name
                            // If so, user hasn't manually edited it, so we can update
                            const should_auto_update = !app_name_manually_edited || 
                                                     current_app_name === last_auto_generated_name ||
                                                     !current_app_name;
                            
                            if (should_auto_update) {
                                dialog.set_value('app_name', normalized_name);
                                last_auto_generated_name = normalized_name;
                                app_name_manually_edited = false; // Reset flag since we're auto-updating
                            }
                        }
                    }
                },
                {
                    label: 'Application Name',
                    fieldname: 'app_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name (lowercase, underscores only - auto-generated from title)',
                    change: () => {
                        // Only mark as manually edited if it doesn't match what we'd auto-generate
                        const current_app_name = dialog.get_value('app_name');
                        const current_title = dialog.get_value('app_title');
                        const expected_name = current_title ? self.normalize_app_name(current_title) : '';
                        
                        // If user typed something different from what we'd auto-generate, mark as manual
                        if (current_app_name !== expected_name && current_app_name !== last_auto_generated_name) {
                            app_name_manually_edited = true;
                        }
                    }
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Text',
                    description: 'Brief description of what this application does'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Status',
                    fieldname: 'status',
                    fieldtype: 'Select',
                    options: 'Active\nInactive\nArchived\nMaintenance',
                    default: 'Active'
                },
                {
                    label: 'Create Sample Tables',
                    fieldname: 'create_samples',
                    fieldtype: 'Check',
                    default: 0,
                    description: 'Create sample tables to get started quickly'
                }
            ],
            primary_action_label: 'Create Application',
            primary_action: (values) => {
                // Remove non-DocType fields
                const doc_values = {...values};
                delete doc_values.create_samples;  // Remove non-DocType field
                
                frappe.call({
                    method: 'frappe.client.insert',
                    args: {
                        doc: {
                            doctype: 'Flansa Application',
                            ...doc_values
                        }
                    },
                    callback: (r) => {
                        if (r.message) {
                            frappe.show_alert({
                                message: `Application "${values.app_title}" created successfully!`,
                                indicator: 'green'
                            });
                            dialog.hide();
                            
                            // Reload applications
                            self.load_applications();
                            
                            // Ask if user wants to open the application
                            frappe.confirm(
                                'Would you like to open the application builder now?',
                                () => {
                                    self.open_application(r.message.name);
                                }
                            );
                        }
                    },
                    error: (r) => {
                        frappe.msgprint({
                            title: 'Error',
                            indicator: 'red',
                            message: r.message || 'Failed to create application'
                        });
                    }
                });
            }
        });
        
        dialog.show();
    }
    
    normalize_app_name(name) {
        // Convert application name to valid format (matches server-side logic)
        if (!name) return name;
        
        // Convert to lowercase and replace spaces/special chars with underscores
        let normalized = name.toLowerCase();
        // Replace anything that's not a letter, number, or underscore with underscore
        normalized = normalized.replace(/[^a-z0-9_]/g, '_');
        // Remove multiple underscores
        normalized = normalized.replace(/_+/g, '_');
        // Remove leading/trailing underscores
        normalized = normalized.replace(/^_+|_+$/g, '');
        // Ensure it starts with a letter
        if (normalized && normalized[0] >= '0' && normalized[0] <= '9') {
            normalized = 'app_' + normalized;
        }
        
        return normalized || 'my_app';
    }
    
    generate_app_id(title) {
        // Convert title to valid application ID (legacy method - use normalize_app_name instead)
        return this.normalize_app_name(title);
    }
    
    delete_application(app_name) {
        // First show preview of what will be deleted
        frappe.call({
            method: 'flansa.flansa_core.api.clean_delete.get_deletion_preview',
            args: {
                resource_type: 'app',
                resource_name: app_name
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const preview = r.message.preview;
                    const items = preview.items_to_delete.join('<br>• ');
                    
                    frappe.confirm(
                        `<div style="max-width: 600px;">
                        <h4>⚠️ Clean Delete Application</h4>
                        <p>This will <strong>permanently delete</strong>:</p>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 12px 0; font-family: monospace; font-size: 13px; border-left: 4px solid #dc3545;">
                        • ${items}
                        </div>
                        <p><strong style="color: #d73527;">⚠️ This action cannot be undone and will remove ALL data, tables, forms, reports, and relationships!</strong></p>
                        <p>Are you sure you want to proceed?</p>
                        </div>`,
                        () => {
                            // Show loading message
                            frappe.show_alert('🗑️ Deleting application and all connected resources...', 'blue');
                            
                            frappe.call({
                                method: 'flansa.flansa_core.api.clean_delete.clean_delete_app',
                                args: { app_name: app_name },
                                callback: (delete_r) => {
                                    if (delete_r.message && delete_r.message.success) {
                                        frappe.show_alert('✅ ' + delete_r.message.message, 'green');
                                        console.log('🗑️ App deletion summary:', delete_r.message.summary);
                                        console.log('🗑️ Deletion log:', delete_r.message.deletion_log);
                                        
                                        // Refresh the applications list
                                        setTimeout(() => {
                                            this.load_applications();
                                        }, 2000);
                                    } else {
                                        frappe.show_alert('❌ Failed to delete application: ' + (delete_r.message?.error || 'Unknown error'), 'red');
                                    }
                                }
                            });
                        },
                        null, // No callback for cancel
                        'Delete Application' // Dialog title
                    );
                } else {
                    frappe.show_alert('Failed to get deletion preview', 'red');
                    console.error('Preview error:', r.message?.error);
                }
            }
        });
    }
    
    update_stats() {
        // Update the application count
        const count = this.applications.length;
        $('#total-apps-count').text(count);
        $('#apps-plural').text(count === 1 ? '' : 's');
    }
    
    filter_applications() {
        const search_term = $('#app-search').val().toLowerCase();
        const status_filter = $('#app-status-filter').val();
        
        this.filtered_apps = this.applications.filter(app => {
            // Search filter
            const search_match = !search_term || 
                (app.app_title || app.name).toLowerCase().includes(search_term) ||
                (app.description || '').toLowerCase().includes(search_term);
            
            // Status filter
            const status_match = status_filter === 'all' || app.status === status_filter;
            
            return search_match && status_match;
        });
        
        this.render_applications();
    }
    
    toggle_view(view) {
        if (view === 'grid') {
            $('#applications-grid').removeClass('view-list').addClass('view-grid');
        } else {
            $('#applications-grid').removeClass('view-grid').addClass('view-list');
        }
    }
    
    get_status_badge(status) {
        const status_map = {
            'Active': { class: 'flansa-text-success', text: 'Active' },
            'Inactive': { class: 'flansa-text-secondary', text: 'Draft' },
            'Draft': { class: 'flansa-text-secondary', text: 'Draft' },
            'Archived': { class: 'flansa-text-secondary', text: 'Archived' },
            'Maintenance': { class: 'flansa-text-warning', text: 'Maintenance' }
        };
        return status_map[status] || status_map['Draft'];
    }
    
    format_date(date_string) {
        if (!date_string) return 'N/A';
        const date = new Date(date_string);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return `${Math.floor(days / 365)} years ago`;
    }
    
    show_theme_settings() {
        // Use global FlansaThemeManager
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.showThemeSettings(() => {
                // Theme applied globally, no need for local refresh
            });
            return;
        }
        // Fallback to old implementation if ThemeManager not available
        const self = this;
        
        const dialog = new frappe.ui.Dialog({
            title: '🎨 Theme Customization',
            size: 'large',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: '🌈 Color Scheme Options'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'theme_info',
                    options: `
                        <div class="alert alert-info">
                            <strong>Customize Your Workspace:</strong> Choose from pre-defined color schemes or create your own custom theme for the Flansa Platform.
                        </div>
                    `
                },
                {
                    label: 'Primary Color Scheme',
                    fieldname: 'primary_scheme',
                    fieldtype: 'Select',
                    options: [
                        'Default Blue',
                        'Ocean Green',
                        'Sunset Orange',
                        'Royal Purple',
                        'Cherry Red',
                        'Forest Green',
                        'Midnight Dark',
                        'Custom'
                    ].join('\n'),
                    default: 'Default Blue',
                    reqd: 1,
                    change: function() {
                        self.preview_color_scheme(this.get_value(), dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Theme Preview',
                    fieldname: 'theme_preview',
                    fieldtype: 'HTML',
                    options: '<div id="theme-preview-area">Select a color scheme to preview</div>'
                },
                {
                    fieldtype: 'Section Break',
                    label: '🎨 Custom Colors',
                    depends_on: 'eval:doc.primary_scheme == "Custom"'
                },
                {
                    label: 'Primary Color',
                    fieldname: 'custom_primary',
                    fieldtype: 'Color',
                    depends_on: 'eval:doc.primary_scheme == "Custom"',
                    change: function() {
                        self.preview_custom_colors(dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Secondary Color',
                    fieldname: 'custom_secondary',
                    fieldtype: 'Color',
                    depends_on: 'eval:doc.primary_scheme == "Custom"',
                    change: function() {
                        self.preview_custom_colors(dialog);
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: '⚡ Actions'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'theme_actions',
                    options: `
                        <div class="theme-actions" style="text-align: center; padding: 20px;">
                            <button class="btn btn-secondary" id="reset-theme-btn">🔄 Reset to Default</button>
                            <button class="btn btn-warning" id="export-theme-btn" style="margin-left: 10px;">📤 Export Theme</button>
                            <button class="btn btn-info" id="import-theme-btn" style="margin-left: 10px;">📥 Import Theme</button>
                        </div>
                    `
                }
            ],
            primary_action_label: '✅ Apply Theme',
            primary_action: (values) => {
                self.apply_theme_settings(values);
                dialog.hide();
            }
        });
        
        // Bind theme action buttons
        dialog.$wrapper.find('#reset-theme-btn').on('click', () => {
            self.reset_theme();
            frappe.show_alert('Theme reset to default', 'blue');
        });
        
        dialog.$wrapper.find('#export-theme-btn').on('click', () => {
            self.export_theme();
        });
        
        dialog.$wrapper.find('#import-theme-btn').on('click', () => {
            self.import_theme();
        });
        
        dialog.show();
        
        // Set current theme as default
        const currentScheme = localStorage.getItem('flansa_user_scheme') || 'Default Blue';
        dialog.set_value('primary_scheme', currentScheme);
    }
    
    preview_color_scheme(scheme, dialog) {
        const schemes = {
            'Default Blue': {
                primary: '#667eea',
                secondary: '#764ba2',
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            'Ocean Green': {
                primary: '#2196F3',
                secondary: '#21CBF3', 
                gradient: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)'
            },
            'Sunset Orange': {
                primary: '#f093fb',
                secondary: '#f5576c',
                gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            },
            'Royal Purple': {
                primary: '#4facfe',
                secondary: '#00f2fe',
                gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
            },
            'Cherry Red': {
                primary: '#fa709a',
                secondary: '#fee140',
                gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            },
            'Forest Green': {
                primary: '#a8edea',
                secondary: '#fed6e3',
                gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
            },
            'Midnight Dark': {
                primary: '#2c3e50',
                secondary: '#3498db',
                gradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)'
            }
        };
        
        if (schemes[scheme]) {
            const preview = `
                <div class="theme-preview" style="padding: 20px; background: ${schemes[scheme].gradient}; border-radius: 12px; color: white; text-align: center; margin: 10px 0;">
                    <h4 style="margin: 0; color: white;">🎨 ${scheme}</h4>
                    <p style="margin: 10px 0; opacity: 0.9;">Preview of your selected theme</p>
                    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                        <div style="width: 30px; height: 30px; background: ${schemes[scheme].primary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                        <div style="width: 30px; height: 30px; background: ${schemes[scheme].secondary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                    </div>
                </div>
            `;
            dialog.fields_dict.theme_preview.$wrapper.html(preview);
        }
    }
    
    preview_custom_colors(dialog) {
        const primary = dialog.get_value('custom_primary');
        const secondary = dialog.get_value('custom_secondary');
        
        if (primary && secondary) {
            const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
            const preview = `
                <div class="theme-preview" style="padding: 20px; background: ${gradient}; border-radius: 12px; color: white; text-align: center; margin: 10px 0;">
                    <h4 style="margin: 0; color: white;">🎨 Custom Theme</h4>
                    <p style="margin: 10px 0; opacity: 0.9;">Preview of your custom colors</p>
                    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                        <div style="width: 30px; height: 30px; background: ${primary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                        <div style="width: 30px; height: 30px; background: ${secondary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                    </div>
                </div>
            `;
            dialog.fields_dict.theme_preview.$wrapper.html(preview);
        }
    }
    
    apply_theme_settings(values) {
        // Store theme preference
        localStorage.setItem('flansa_user_scheme', values.primary_scheme);
        
        if (values.primary_scheme === 'Custom') {
            localStorage.setItem('flansa_custom_primary', values.custom_primary);
            localStorage.setItem('flansa_custom_secondary', values.custom_secondary);
        }
        
        // Apply the theme
        this.apply_color_scheme(values.primary_scheme, values.custom_primary, values.custom_secondary);
        
        frappe.show_alert(`Theme "${values.primary_scheme}" applied successfully! 🎨`, 'green');
    }
    
    apply_color_scheme(scheme, custom_primary, custom_secondary) {
        const schemes = {
            'Default Blue': ['#667eea', '#764ba2'],
            'Ocean Green': ['#2196F3', '#21CBF3'],
            'Sunset Orange': ['#f093fb', '#f5576c'],
            'Royal Purple': ['#4facfe', '#00f2fe'],
            'Cherry Red': ['#fa709a', '#fee140'],
            'Forest Green': ['#a8edea', '#fed6e3'],
            'Midnight Dark': ['#2c3e50', '#3498db']
        };
        
        let colors;
        if (scheme === 'Custom') {
            colors = [custom_primary, custom_secondary];
        } else {
            colors = schemes[scheme];
        }
        
        if (colors) {
            const [primary, secondary] = colors;
            const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
            
            // Apply CSS custom properties
            document.documentElement.style.setProperty('--flansa-primary', primary);
            document.documentElement.style.setProperty('--flansa-secondary', secondary);
            document.documentElement.style.setProperty('--flansa-gradient-primary', gradient);
            
            // Set appropriate text colors based on theme darkness
            if (scheme === 'Midnight Dark') {
                document.documentElement.style.setProperty('--flansa-text-primary', '#ffffff');
                document.documentElement.style.setProperty('--flansa-text-secondary', 'rgba(255, 255, 255, 0.8)');
                document.documentElement.style.setProperty('--flansa-surface', '#1a202c');
                document.documentElement.style.setProperty('--flansa-background', '#0f141a');
                document.body.classList.add('flansa-theme-dark');
            } else {
                // Light themes
                document.documentElement.style.setProperty('--flansa-text-primary', '#2d3748');
                document.documentElement.style.setProperty('--flansa-text-secondary', '#718096');
                document.documentElement.style.setProperty('--flansa-surface', '#ffffff');
                document.documentElement.style.setProperty('--flansa-background', '#f7fafc');
                document.body.classList.remove('flansa-theme-dark');
            }
            
            // Trigger a refresh of the current page to show changes
            setTimeout(() => {
                this.load_applications();
            }, 200);
        }
    }
    
    reset_theme() {
        localStorage.removeItem('flansa_user_scheme');
        localStorage.removeItem('flansa_custom_primary');
        localStorage.removeItem('flansa_custom_secondary');
        
        // Reset to default colors
        document.documentElement.style.removeProperty('--flansa-primary');
        document.documentElement.style.removeProperty('--flansa-secondary');
        document.documentElement.style.removeProperty('--flansa-gradient-primary');
        
        setTimeout(() => {
            this.load_applications();
        }, 200);
    }
    
    export_theme() {
        const themeData = {
            scheme: localStorage.getItem('flansa_user_scheme') || 'Default Blue',
            custom_primary: localStorage.getItem('flansa_custom_primary'),
            custom_secondary: localStorage.getItem('flansa_custom_secondary'),
            exported_at: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(themeData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flansa-theme-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        frappe.show_alert('Theme exported successfully! 📤', 'blue');
    }
    
    import_theme() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const themeData = JSON.parse(e.target.result);
                        
                        // Apply imported theme
                        localStorage.setItem('flansa_user_scheme', themeData.scheme);
                        if (themeData.custom_primary) {
                            localStorage.setItem('flansa_custom_primary', themeData.custom_primary);
                        }
                        if (themeData.custom_secondary) {
                            localStorage.setItem('flansa_custom_secondary', themeData.custom_secondary);
                        }
                        
                        this.apply_color_scheme(themeData.scheme, themeData.custom_primary, themeData.custom_secondary);
                        frappe.show_alert('Theme imported and applied successfully! 📥', 'green');
                        
                    } catch (error) {
                        frappe.show_alert('Invalid theme file format! ❌', 'red');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    setup_context_menu() {
        // Context menu functionality
        $(document).on('click', '#context-menu-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = $('#context-menu');
            menu.toggle();
        });
        
        // Close context menu when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#context-menu-btn, #context-menu').length) {
                $('#context-menu').hide();
            }
        });
        
        // Context menu item actions
        $(document).on('click', '.context-menu-item', (e) => {
            e.preventDefault();
            const action = $(e.currentTarget).data('action');
            this.handle_context_menu_action(action);
            $('#context-menu').hide();
        });
    }
    
    handle_context_menu_action(action) {
        switch (action) {
            case 'tenant-switcher':
                frappe.set_route('tenant-switcher');
                break;
                
            case 'register-tenant':
                frappe.set_route('tenant-registration');
                break;
                
            case 'theme':
                this.show_theme_settings();
                break;
                
            case 'refresh-cache':
                if (window.flansaBrowserCacheManager) {
                    window.flansaBrowserCacheManager.refreshAllAssets();
                    frappe.show_alert('Cache cleared successfully!', 'green');
                } else {
                    window.location.reload(true);
                }
                break;
                
            case 'backup-apps':
                this.backup_all_applications();
                break;
                
            case 'keyboard-shortcuts':
                this.show_keyboard_shortcuts();
                break;
                
            default:
                frappe.show_alert('Unknown action: ' + action, 'orange');
        }
    }
    
    backup_all_applications() {
        if (!this.applications || this.applications.length === 0) {
            frappe.show_alert('No applications to backup', 'orange');
            return;
        }
        
        try {
            const backup_data = {
                applications: this.applications.map(app => ({
                    name: app.name,
                    app_title: app.app_title,
                    app_name: app.app_name,
                    description: app.description,
                    created_on: app.creation
                })),
                backup_date: new Date().toISOString(),
                version: '1.0'
            };
            
            // Download as JSON
            const blob = new Blob([JSON.stringify(backup_data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `flansa_apps_backup_${new Date().toISOString().split('T')[0]}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            frappe.show_alert('Applications backup downloaded successfully!', 'green');
        } catch (error) {
            console.error('Backup error:', error);
            frappe.show_alert('Backup failed: ' + error.message, 'red');
        }
    }
    
    show_keyboard_shortcuts() {
        const shortcuts = [
            { key: 'Ctrl/Cmd + N', action: 'Create new application' },
            { key: 'Ctrl/Cmd + F', action: 'Search applications' },
            { key: 'Ctrl/Cmd + R', action: 'Refresh workspace' },
            { key: 'Esc', action: 'Close dialogs' },
            { key: '/', action: 'Focus search' }
        ];
        
        let content = '<div style="font-family: monospace; line-height: 1.6;">';
        content += '<h4 style="margin-bottom: 15px;">⌨️ Keyboard Shortcuts</h4>';
        shortcuts.forEach(shortcut => {
            content += `<div style="margin-bottom: 8px;"><strong>${shortcut.key}</strong> - ${shortcut.action}</div>`;
        });
        content += '</div>';
        
        frappe.msgprint({
            title: 'Keyboard Shortcuts',
            message: content,
            indicator: 'blue'
        });
    }
    
    async load_tenant_info() {
        try {
            const response = await this.call_tenant_api('get_current_tenant_info');
            const tenantInfo = response;
            
            // Update tenant display in header
            const tenantDisplay = document.getElementById('tenant-name-display');
            const tenantBadge = document.getElementById('current-tenant-badge');
            
            if (tenantDisplay && tenantInfo) {
                tenantDisplay.textContent = tenantInfo.tenant_name || 'Unknown';
                
                // Add click handler to show tenant details
                tenantBadge.style.cursor = 'pointer';
                tenantBadge.title = `Tenant: ${tenantInfo.tenant_name}\nID: ${tenantInfo.tenant_id}\nApps: ${tenantInfo.stats?.apps || 0} | Tables: ${tenantInfo.stats?.tables || 0}`;
                
                // Optional: Add click to show tenant switcher
                tenantBadge.onclick = () => {
                    frappe.set_route('tenant-switcher');
                };
            }
            
        } catch (error) {
            console.warn('Could not load tenant info:', error);
            // Set fallback display
            const tenantDisplay = document.getElementById('tenant-name-display');
            if (tenantDisplay) {
                tenantDisplay.textContent = 'Default';
            }
        }
    }
    
    async call_tenant_api(method, args = {}) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `flansa.flansa_core.page.tenant_switcher.tenant_switcher.${method}`,
                args: args,
                callback: (response) => {
                    if (response && response.message !== undefined) {
                        resolve(response.message);
                    } else {
                        reject(new Error('No response data from tenant API'));
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
    
    async load_workspace_logo() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.tenant_service.get_workspace_logo',
                callback: (r) => {
                    if (r.message && r.message.logo) {
                        const logoContainer = document.getElementById('workspace-logo-container');
                        const logoImg = document.getElementById('workspace-logo');
                        
                        if (logoContainer && logoImg) {
                            logoImg.src = r.message.logo;
                            logoImg.alt = `${r.message.workspace_name || 'Workspace'} Logo`;
                            logoContainer.style.display = 'block';
                        }
                    }
                }
            });
        } catch (error) {
            console.log('No workspace logo configured:', error);
        }
    }
    
    update_banner_info() {
        // Update workspace title if needed
        const workspaceTitle = document.getElementById('workspace-title');
        if (workspaceTitle && this.tenant_info?.tenant_name) {
            workspaceTitle.textContent = this.tenant_info.tenant_name;
        }
        
        // Load workspace logo
        this.load_workspace_logo();
    }
}

// Initialize theme on page load
$(document).ready(function() {
    const savedScheme = localStorage.getItem('flansa_user_scheme');
    if (savedScheme) {
        const customPrimary = localStorage.getItem('flansa_custom_primary');
        const customSecondary = localStorage.getItem('flansa_custom_secondary');
        
        // Apply saved theme
        if (window.flansa_workspace) {
            window.flansa_workspace.apply_color_scheme(savedScheme, customPrimary, customSecondary);
        }
    }
});
