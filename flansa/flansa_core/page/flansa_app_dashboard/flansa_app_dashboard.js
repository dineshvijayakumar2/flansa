/**
 * Flansa Application Dashboard - Individual App Home Page
 * Shows overview, stats, and quick actions for a specific application
 */

frappe.pages['flansa-app-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Application Dashboard',
        single_column: true
    });
    
    // Add standardized Back button
    setTimeout(() => {
        if (window.FlansaNav && typeof window.FlansaNav.addBackButton === 'function') {
            window.FlansaNav.addBackButton(page);
        } else {
            // Fallback: Add back button directly
            page.add_button('← Back', () => {
                window.history.back();
            }, 'btn-default');
        }
    }, 100);
    
    // Initialize Application Dashboard
    new FlansaApplicationDashboard(page);
};

class FlansaApplicationDashboard {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        this.view_mode = 'tiles'; // Default view mode
        
        // Get application ID from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        this.app_id = urlParams.get('app') || null;
        
        
        if (!this.app_id) {
            this.show_error('No application specified');
            return;
        }
        
        this.setup_page();
        this.load_application_data();
        this.setup_context_menu();
    }
    
    
    setup_page() {
        // Clean setup - no buttons above banner for consistent design
        
        // Hide default page header to make banner freeze at top
        this.hide_default_page_header();
        
        // Only theme settings in menu (ellipsis)
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.addThemeMenuToPage(this.page, () => {
                this.load_application_data();
            });
        }
    }
    
    hide_default_page_header() {
        // Hide the default Frappe page header to make our banner freeze at top
        $(this.wrapper).find('.page-head').hide();
        $('body .page-head').hide();
        
        // Also add CSS to ensure it stays hidden
        if (!$('#app-dashboard-page-head-css').length) {
            $('<style id="app-dashboard-page-head-css">')
                .text('.page-head { display: none !important; }')
                .appendTo('head');
        }
    }
    
    load_application_data() {
        frappe.call({
            method: 'flansa.flansa_core.api.workspace_api.get_application_details',
            args: { app_name: this.app_id },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_dashboard(r.message);
                } else {
                    this.show_error('Failed to load application data');
                }
            },
            error: (r) => {
                this.show_error('Error loading application data');
            }
        });
    }
    
    render_dashboard(data) {
        const app = data.application;
        const tables = data.tables || [];
        
        // Store current tables for reference in action methods
        this.current_tables = tables;
        
        // Skip setting page title to avoid redundancy with banner
        // this.page.set_title(`${app.app_title} - Dashboard`);
        
        const dashboard_html = `
            <div class="application-dashboard-container">
                <!-- Compact Modern Header - Now at absolute top -->
                <div class="flansa-compact-header" style="background: var(--flansa-gradient-primary); color: var(--flansa-white); padding: 16px 20px; margin: 0 -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                    <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa fa-cube" style="font-size: 18px; opacity: 0.9;"></i>
                        <span style="font-size: 16px; font-weight: 600;">${app.app_title}</span>
                    </div>
                    <div class="header-right" style="display: flex; align-items: center; gap: 12px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2;">📱 Apps</h3>
                        <div class="context-menu-wrapper" style="position: relative;">
                            <button id="context-menu-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: background-color 0.2s;" title="More options">
                                ⋯
                            </button>
                            <div id="context-menu" style="display: none; position: absolute; top: 40px; right: 0; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 1000; border: 1px solid rgba(0,0,0,0.1);">
                                <div class="context-menu-item" data-action="theme" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-paint-brush" style="width: 16px;"></i>
                                    <span>Theme Settings</span>
                                </div>
                                <div class="context-menu-item" data-action="refresh-cache" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-refresh" style="width: 16px;"></i>
                                    <span>Clear Cache</span>
                                </div>
                                <div class="context-menu-item" data-action="export-app" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-download" style="width: 16px;"></i>
                                    <span>Export App Data</span>
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
                <div class="flansa-breadcrumb-bar" style="background: rgba(255,255,255,0.95); padding: 8px 20px; margin: 0 -20px 0 -20px; font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; gap: 8px; font-size: 14px;" id="breadcrumb-container">
                    <a href="/app/flansa-workspace" style="color: #2d3748; text-decoration: none; font-weight: 600; font-weight: 500;">🏠 Workspace</a>
                    <i class="fa fa-chevron-right" style="opacity: 0.5; margin: 0 8px;"></i>
                    <span style="color: #333; font-weight: 500;">📱 ${app.app_title}</span>
                </div>
                
                <!-- Page Header for App Dashboard -->
                <div id="page-header" style="padding: 20px 20px 10px 20px; margin: 0 -20px 16px -20px; background: white; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #333;">${app.app_title}</h2>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">${app.description || 'Application dashboard and management'}</p>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-sm btn-primary" id="quick-nav-table-builder" title="Edit Tables">
                                <i class="fa fa-table"></i> Tables
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-reports" title="View Reports">
                                <i class="fa fa-chart-bar"></i> Reports
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-relationships" title="Table Relationships">
                                <i class="fa fa-link"></i> Relationships
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-app-properties" title="App Properties">
                                <i class="fa fa-cog"></i> App Properties
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Content Area -->
                <div class="flansa-workspace-content" style="padding: var(--flansa-spacing-xl) var(--flansa-spacing-xl) 0;">
                
                    <!-- Main Content -->
                <div class="dashboard-content mt-4">
                    <div class="row">
                        <!-- Tables Section -->
                        <div class="col-md-12">
                            <div class="content-section">
                                <div class="section-header" style="border-bottom: 1px solid var(--flansa-border, var(--flansa-gray-200)); padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                                    <h4 style="margin: 0; font-weight: normal;">Tables</h4>
                                    <small style="color: var(--flansa-text-secondary, var(--flansa-gray-600));">${tables.length} table${tables.length !== 1 ? 's' : ''}</small>
                                </div>
                                
                                <!-- Consistent Toolbar -->
                                <div class="tables-toolbar" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--flansa-spacing-lg); margin-bottom: var(--flansa-spacing-xl); padding: var(--flansa-spacing-md); background: var(--flansa-surface, var(--flansa-white)); border-radius: var(--flansa-radius-lg); box-shadow: var(--flansa-shadow-sm); border: var(--flansa-border-width-sm) solid var(--flansa-border, transparent);">
                                    <div class="toolbar-left" style="display: flex; gap: var(--flansa-spacing-sm);">
                                        <button class="btn btn-flansa-primary" onclick="window.app_dashboard.show_quick_table_dialog()">
                                            <i class="fa fa-plus"></i> Create Table
                                        </button>
                                    </div>
                                    <div class="toolbar-center" style="display: flex; justify-content: center; max-width: 400px; width: 100%;">
                                        <div class="search-wrapper" style="position: relative; width: 100%;">
                                            <input type="text" class="form-control search-input" 
                                                id="table-search" placeholder="Search tables..." style="padding-left: 40px; border-radius: var(--flansa-radius-md); border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300));" />
                                            <i class="fa fa-search search-icon" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--flansa-text-secondary, var(--flansa-gray-500));"></i>
                                        </div>
                                    </div>
                                    <div class="toolbar-right" style="display: flex; gap: var(--flansa-spacing-md); align-items: center;">
                                        <div class="view-toggle" style="display: flex; border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300)); border-radius: var(--flansa-radius-md); overflow: hidden;">
                                            <button class="btn btn-default btn-sm view-btn ${this.view_mode === 'tiles' ? 'active' : ''}" onclick="window.app_dashboard.switch_view('tiles')" style="border: none; border-radius: 0; padding: 6px 12px;">
                                                <i class="fa fa-th"></i>
                                            </button>
                                            <button class="btn btn-default btn-sm view-btn ${this.view_mode === 'table' ? 'active' : ''}" onclick="window.app_dashboard.switch_view('table')" style="border: none; border-radius: 0; padding: 6px 12px;">
                                                <i class="fa fa-list"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="section-content" id="tables-container">
                                    ${this.view_mode === 'table' ? this.render_tables_table(tables) : this.render_tables_tiles(tables)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                </div>
            </div>
        `;
        
        this.$container.html(dashboard_html);
        
        // Bind tile events
        this.bind_tile_events();
        
        // Store reference for button callbacks
        window.app_dashboard = this;
    }
    
    render_tables_tiles(tables) {
        if (tables.length === 0) {
            return this.render_empty_state();
        }
        
        return `
            <div class="items-grid mt-3">
                ${tables.map(table => this.render_table_tile(table)).join('')}
            </div>
        `;
    }
    
    render_tables_table(tables) {
        if (tables.length === 0) {
            return this.render_empty_state();
        }
        
        return `
            <div class="table-responsive mt-3">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Table Name</th>
                            <th>Fields</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tables.map(table => `
                            <tr>
                                <td>
                                    <strong>${table.table_label || table.table_name}</strong>
                                    <br><small class="text-muted">${table.name}</small>
                                </td>
                                <td>${table.fields_count || 0}</td>
                                <td>
                                    ${table.status === 'Active' ? 
                                        '<span class="badge badge-success">Active</span>' : 
                                        '<span class="badge badge-warning">' + (table.status || 'Draft') + '</span>'}
                                </td>
                                <td>${this.format_date(table.creation)}</td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-primary" onclick="window.app_dashboard.edit_table('${table.name}')" title="Edit Table">
                                            <i class="fa fa-edit"></i> Edit
                                        </button>
                                        <button class="btn btn-info" onclick="window.app_dashboard.view_table_data('${table.name}')" title="View Data">
                                            <i class="fa fa-eye"></i> Data
                                        </button>
                                        <button class="btn btn-danger" onclick="window.app_dashboard.delete_table('${table.name}')" title="Delete Table">
                                            <i class="fa fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    render_table_tile(table) {
        const is_active = table.status === 'Active';
        const status_badge = this.get_status_badge(table.status);
        
        return `
            <div class="grid-item flansa-card" data-table-name="${table.name}">
                <div class="item-header">
                    <div class="item-icon">
                        <i class="fa fa-database"></i>
                    </div>
                    <div class="item-title">${table.table_label || table.table_name}</div>
                </div>
                <div class="item-meta">
                    <small>${table.fields_count || 0} fields</small>
                    <small>${this.format_date(table.creation)}</small>
                    <small class="status-badge ${status_badge.class}">${status_badge.text}</small>
                </div>
                <div class="item-description">
                    ${table.description || 'No description provided'}
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-flansa-primary" onclick="window.app_dashboard.edit_table('${table.name}')">
                        <i class="fa fa-edit"></i> Edit
                    </button>
                    ${is_active ? `
                        <button class="btn btn-sm btn-flansa-secondary" onclick="window.app_dashboard.view_table_data('${table.name}')">
                            <i class="fa fa-eye"></i> View Data
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-outline-secondary" disabled>
                            <i class="fa fa-eye"></i> View Data
                        </button>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="window.app_dashboard.delete_table('${table.name}')" title="Delete Table">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    render_create_table_tile() {
        return `
            <div class="grid-item flansa-card create-table-tile" onclick="window.app_dashboard.show_quick_table_dialog()">
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <div class="empty-state-icon">
                        <i class="fa fa-plus"></i>
                    </div>
                    <div class="empty-state-title">Create Table</div>
                    <div class="empty-state-description">Add a new table to your application</div>
                </div>
            </div>
        `;
    }
    
    render_empty_state() {
        return `
            <div class="empty-state text-center mt-5">
                <i class="fa fa-table fa-4x text-muted"></i>
                <h4 class="mt-3">No Tables Yet</h4>
                <p class="text-muted">Create your first table to get started using the button above</p>
            </div>
        `;
    }
    
    render_relationships_list(relationships) {
        if (relationships.length === 0) {
            return `
                <div class="empty-state text-center">
                    <i class="fa fa-link fa-3x text-muted"></i>
                    <h4>No Relationships</h4>
                    <p class="text-muted">Connect your tables with relationships</p>
                    <button class="btn btn-info" onclick="window.app_dashboard.view_relationships()">
                        <i class="fa fa-plus"></i> Create First Relationship
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="relationships-list">
                ${relationships.map(rel => `
                    <div class="relationship-item">
                        <div class="relationship-header">
                            <h6><i class="fa fa-link"></i> ${rel.display_name || rel.name}</h6>
                            <span class="badge badge-info">${rel.relationship_type}</span>
                        </div>
                        <div class="relationship-body">
                            <small class="text-muted">
                                ${this.get_table_display_name(rel.from_table)} 
                                <i class="fa fa-arrow-right mx-1"></i> 
                                ${this.get_table_display_name(rel.to_table)}
                            </small>
                        </div>
                    </div>
                `).join('')}
                <div class="text-center mt-2">
                    <button class="btn btn-sm btn-outline-info" onclick="window.app_dashboard.view_relationships()">
                        <i class="fa fa-eye"></i> View All (${relationships.length})
                    </button>
                </div>
            </div>
        `;
    }
    
    get_table_display_name(table_id) {
        // This should be populated during data loading
        return this.table_names_map && this.table_names_map[table_id] || table_id;
    }
    
    get_total_fields(tables) {
        return tables.reduce((total, table) => total + (table.fields_count || 0), 0);
    }
    
    get_status_badge(status) {
        const status_map = {
            'Active': { class: 'flansa-text-success', text: 'Active' },
            'Inactive': { class: 'flansa-text-secondary', text: 'Draft' },
            'Draft': { class: 'flansa-text-secondary', text: 'Draft' },
            'Archived': { class: 'flansa-text-secondary', text: 'Archived' }
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
        return date.toLocaleDateString();
    }
    
    show_error(message) {
        this.$container.html(`
            <div class="text-center" style="padding: 50px;">
                <h4><i class="fa fa-exclamation-triangle text-warning"></i> Error</h4>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="window.location.href='/app/flansa-workspace'">
                    <i class="fa fa-home"></i> Back to Home
                </button>
            </div>
        `);
    }
    
    // Action methods
    show_quick_table_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: '📋 Create New Table',
            size: 'large',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: '✨ Quick Table Creation',
                    description: 'Create a new table with just the essential information'
                },
                {
                    label: 'Display Label',
                    fieldname: 'table_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'User-friendly name for your table (e.g., "Customer Orders")',
                    placeholder: 'Enter a descriptive label...',
                    change: () => {
                        // Auto-populate table name based on label
                        const label = dialog.get_value('table_label');
                        if (label) {
                            const tableName = this.generate_table_name(label);
                            dialog.set_value('table_name', tableName);
                            
                            // Auto-suggest prefix if naming_type is 'Naming Series' and prefix is empty
                            const naming_type = dialog.get_value('naming_type');
                            const current_prefix = dialog.get_value('naming_prefix');
                            if (naming_type === 'Naming Series' && !current_prefix) {
                                const suggestedPrefix = this.generate_prefix_from_label(label);
                                dialog.set_value('naming_prefix', suggestedPrefix);
                            }
                            
                            // Update preview
                            this.update_naming_preview(dialog);
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Table Name',
                    fieldname: 'table_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Technical name (auto-generated, can be edited)',
                    placeholder: 'Auto-generated from label...'
                },
                {
                    fieldtype: 'Section Break',
                    label: '🏷️ Record Naming Configuration'
                },
                {
                    label: 'Naming Type',
                    fieldname: 'naming_type',
                    fieldtype: 'Select',
                    options: 'Naming Series\nAuto Increment\nField Based\nRandom\nPrompt',
                    default: 'Naming Series',
                    description: 'How should records in this table be numbered?',
                    change: () => {
                        this.update_naming_preview(dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Record Prefix',
                    fieldname: 'naming_prefix',
                    fieldtype: 'Data',
                    description: 'e.g., CUS for Customers, ORD for Orders',
                    placeholder: 'CUS, ORD, INV...',
                    depends_on: 'eval:doc.naming_type=="Naming Series"',
                    change: () => {
                        this.update_naming_preview(dialog);
                    }
                },
                {
                    label: 'Number of Digits',
                    fieldname: 'naming_digits',
                    fieldtype: 'Int',
                    default: 5,
                    description: 'Number of digits in counter (5 = 00001)',
                    depends_on: 'eval:doc.naming_type=="Naming Series" || doc.naming_type=="Auto Increment"',
                    change: () => {
                        this.update_naming_preview(dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Start Counter From',
                    fieldname: 'naming_start_from',
                    fieldtype: 'Int',
                    default: 1,
                    description: 'Starting number for the counter (e.g., 100 will create CUS-00100)',
                    depends_on: 'eval:doc.naming_type=="Naming Series" || doc.naming_type=="Auto Increment"',
                    change: () => {
                        this.update_naming_preview(dialog);
                    }
                },
                {
                    label: 'Field for Dynamic Prefix',
                    fieldname: 'naming_field',
                    fieldtype: 'Data',
                    description: 'Field name to use as prefix (for Field Based naming)',
                    depends_on: 'eval:doc.naming_type=="Field Based"',
                    placeholder: 'customer_name, category, etc.'
                },
                {
                    label: 'Separator',
                    fieldname: 'naming_separator',
                    fieldtype: 'Data',
                    default: '-',
                    description: 'Character between prefix and number',
                    depends_on: 'eval:doc.naming_type=="Naming Series"',
                    placeholder: '-'
                },
                {
                    label: 'Preview',
                    fieldname: 'naming_preview',
                    fieldtype: 'Data',
                    read_only: 1,
                    description: 'Example of how record IDs will look'
                },
                {
                    fieldtype: 'Section Break',
                    label: '📝 Optional Details'
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Text',
                    description: 'Optional: Brief description of what this table stores'
                }
            ],
            primary_action_label: '🚀 Create Table',
            primary_action: (values) => {
                this.create_table_quick(values, dialog);
            },
            secondary_action_label: '📋 View All Tables',
            secondary_action: () => {
                dialog.hide();
                this.open_table_builder();
            }
        });
        
        dialog.show();
        
        // Set initial defaults and update preview
        setTimeout(() => {
            // Set default prefix based on table label if available
            const label = dialog.get_value('table_label') || '';
            if (!dialog.get_value('naming_prefix') && label) {
                const defaultPrefix = this.generate_prefix_from_label(label);
                dialog.set_value('naming_prefix', defaultPrefix);
            }
            
            // Update preview
            this.update_naming_preview(dialog);
            
            // Focus on the first field
            dialog.fields_dict.table_label.set_focus();
        }, 500);
    }
    
    generate_table_name(label) {
        // Convert label to valid table name
        return label
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .toLowerCase() // Convert to lowercase
            .substring(0, 50); // Limit length
    }
    
    generate_prefix_from_label(label) {
        // Generate a 3-letter prefix from table label
        const words = label.trim().split(/\s+/);
        if (words.length === 1) {
            // Single word: take first 3 letters
            return words[0].substring(0, 3).toUpperCase();
        } else if (words.length === 2) {
            // Two words: first 2 letters of first word + first letter of second
            return (words[0].substring(0, 2) + words[1].substring(0, 1)).toUpperCase();
        } else {
            // Multiple words: first letter of first 3 words
            return words.slice(0, 3).map(word => word.substring(0, 1)).join('').toUpperCase();
        }
    }
    
    update_naming_preview(dialog) {
        // Update the naming preview based on current settings
        const naming_type = dialog.get_value('naming_type') || 'Naming Series';
        const prefix = dialog.get_value('naming_prefix') || 'REC';
        const digits = parseInt(dialog.get_value('naming_digits')) || 5;
        const start_from = parseInt(dialog.get_value('naming_start_from')) || 1;
        const separator = dialog.get_value('naming_separator') || '-';
        
        let preview = '';
        
        switch (naming_type) {
            case 'Naming Series':
                const first_number = start_from.toString().padStart(digits, '0');
                const second_number = (start_from + 1).toString().padStart(digits, '0');
                preview = `${prefix}${separator}${first_number}, ${prefix}${separator}${second_number}...`;
                break;
            case 'Auto Increment':
                const auto_first = start_from.toString().padStart(digits, '0');
                const auto_second = (start_from + 1).toString().padStart(digits, '0');
                preview = `${auto_first}, ${auto_second}...`;
                break;
            case 'Field Based':
                const field_name = dialog.get_value('naming_field') || 'field_value';
                preview = `Based on '${field_name}' (e.g., john_doe, jane_smith...)`;
                break;
            case 'Random':
                preview = 'Random IDs (e.g., a1b2c3d4, x9y8z7w6...)';
                break;
            case 'Prompt':
                preview = 'User enters ID manually (e.g., CUST-001, ORDER-042...)';
                break;
            default:
                preview = 'Preview will appear here';
        }
        
        dialog.set_value('naming_preview', preview);
    }
    
    create_table_quick(values, dialog) {
        // Show loading state
        dialog.set_primary_action('Creating...', null);
        dialog.$wrapper.find('.btn-primary').prop('disabled', true);
        
        // Create the table via API
        frappe.call({
            method: 'flansa.flansa_core.api.workspace_api.create_flansa_table',
            args: {
                app_name: this.app_id,
                table_data: {
                    table_name: values.table_name,
                    table_label: values.table_label,
                    description: values.description || '',
                    status: 'Draft',
                    // Include naming configuration from dialog
                    naming_type: values.naming_type || 'Naming Series',
                    naming_prefix: values.naming_prefix || '',
                    naming_digits: values.naming_digits || 5,
                    naming_start_from: values.naming_start_from || 1,
                    naming_field: values.naming_field || '',
                    naming_separator: values.naming_separator || '-'
                }
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `✅ Table "${values.table_label}" created successfully!`,
                        indicator: 'green'
                    });
                    
                    dialog.hide();
                    
                    // Ask user what to do next
                    frappe.confirm(
                        'Table created successfully! What would you like to do next?',
                        () => {
                            // Go to Visual Builder to add fields
                            window.location.href = `/app/flansa-visual-builder?table=${r.message.table_name}`;
                        },
                        () => {
                            // Stay on dashboard and refresh
                            this.load_application_data();
                        },
                        'Add Fields Now',
                        'Stay Here'
                    );
                } else {
                    frappe.show_alert({
                        message: `❌ ${r.message?.error || 'Failed to create table'}`,
                        indicator: 'red'
                    });
                    
                    // Reset button
                    dialog.set_primary_action('🚀 Create Table', () => {
                        this.create_table_quick(values, dialog);
                    });
                    dialog.$wrapper.find('.btn-primary').prop('disabled', false);
                }
            },
            error: () => {
                frappe.show_alert({
                    message: '❌ Error creating table. Please try again.',
                    indicator: 'red'
                });
                
                // Reset button
                dialog.set_primary_action('🚀 Create Table', () => {
                    this.create_table_quick(values, dialog);
                });
                dialog.$wrapper.find('.btn-primary').prop('disabled', false);
            }
        });
    }
    
    open_table_builder() {
        window.location.href = `/app/flansa-visual-builder?app=${this.app_id}`;
    }
    
    open_table(table_id) {
        window.location.href = `/app/flansa-visual-builder?table=${table_id}`;
    }
    
    view_relationships() {
        window.location.href = `/app/flansa-relationship-builder?app=${this.app_id}`;
    }
    
    view_data() {
        frappe.msgprint('Data viewer coming soon!');
    }
    
    export_app() {
        frappe.msgprint('Export functionality coming soon!');
    }
    
    app_settings() {
        frappe.set_route('Form', 'Flansa Application', this.app_id);
    }
    
    // Additional table action methods
    edit_table(table_name) {
        // Navigate to visual builder for this specific table
        window.location.href = `/app/flansa-visual-builder?table=${table_name}`;
    }
    
    view_table_data(table_name) {
        // Get the table's doctype name to view data
        const table = this.current_tables?.find(t => t.name === table_name);
        if (table && table.doctype_name) {
            // Navigate to Flansa Report Viewer with explicit type parameter
            frappe.set_route('flansa-report-viewer', table_name);
            // Update URL with explicit type parameter
            setTimeout(() => {
                const newUrl = window.location.pathname + '?type=table';
                window.history.replaceState({}, '', newUrl);
            }, 100);
        } else {
            frappe.show_alert('Table not activated yet. Please add fields first.', 'orange');
        }
    }
    
    delete_table(table_name) {
        // First show preview of what will be deleted
        frappe.call({
            method: 'flansa.flansa_core.api.clean_delete.get_deletion_preview',
            args: {
                resource_type: 'table',
                resource_name: table_name
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const preview = r.message.preview;
                    const items = preview.items_to_delete.join('<br>• ');
                    
                    frappe.confirm(
                        `<div style="max-width: 500px;">
                        <h4>⚠️ Clean Delete Table</h4>
                        <p>This will <strong>permanently delete</strong>:</p>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin: 10px 0; font-family: monospace; font-size: 13px;">
                        • ${items}
                        </div>
                        <p><strong style="color: #d73527;">This action cannot be undone.</strong></p>
                        <p>Are you sure you want to proceed?</p>
                        </div>`,
                        () => {
                            // Show loading message
                            frappe.show_alert('🗑️ Deleting table and connected resources...', 'blue');
                            
                            frappe.call({
                                method: 'flansa.flansa_core.api.clean_delete.clean_delete_table',
                                args: { table_name: table_name },
                                callback: (delete_r) => {
                                    if (delete_r.message && delete_r.message.success) {
                                        frappe.show_alert('✅ ' + delete_r.message.message, 'green');
                                        console.log('🗑️ Table deletion summary:', delete_r.message.summary);
                                        
                                        // Refresh the dashboard
                                        this.load_application_data();
                                        setTimeout(() => {
                                            frappe.set_route('flansa-app-dashboard', this.app_name);
                                        }, 1500);
                                    } else {
                                        frappe.show_alert('❌ Failed to delete table: ' + (delete_r.message?.error || 'Unknown error'), 'red');
                                    }
                                }
                            });
                        },
                        null, // No callback for cancel
                        'Delete Table' // Dialog title
                    );
                } else {
                    frappe.show_alert('Failed to get deletion preview', 'red');
                    console.error('Preview error:', r.message?.error);
                }
            }
        });
    }
    
    switch_view(mode) {
        this.view_mode = mode;
        this.load_application_data();
    }
    
    import_data() {
        frappe.msgprint('Import functionality coming soon!');
    }
    
    bind_tile_events() {
        const self = this;
        
        // Make tiles clickable (except when clicking buttons)
        $('.grid-item.flansa-card').on('click', function(e) {
            if (!$(e.target).closest('.item-actions').length && !$(e.target).closest('button').length) {
                const table_name = $(this).data('table-name');
                if (table_name) {
                    self.edit_table(table_name);
                }
            }
        });
        
        // Table search functionality - works for both grid and list views
        $('#table-search').on('input', function() {
            const search_term = $(this).val().toLowerCase();
            
            // Search in grid view tiles
            $('.grid-item.flansa-card').each(function() {
                const table_name = $(this).find('.item-title').text().toLowerCase();
                const table_description = $(this).find('.item-description').text().toLowerCase();
                
                if (table_name.includes(search_term) || table_description.includes(search_term)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
            
            // Search in table view rows
            $('.table tbody tr').each(function() {
                const table_name = $(this).find('td:first-child strong').text().toLowerCase();
                const table_id = $(this).find('td:first-child small').text().toLowerCase();
                
                if (table_name.includes(search_term) || table_id.includes(search_term)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });
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
        
        // Quick navigation buttons
        $(document).on('click', '#quick-nav-table-builder', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-visual-builder?app=${this.app_id}`;
        });
        
        $(document).on('click', '#quick-nav-reports', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-saved-reports?app=${this.app_id}`;
        });
        
        $(document).on('click', '#quick-nav-relationships', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-relationship-builder?app=${this.app_id}`;
        });
        
        $(document).on('click', '#quick-nav-app-properties', (e) => {
            e.preventDefault();
            frappe.set_route('Form', 'Flansa Application', this.app_id);
        });
    }
    
    handle_context_menu_action(action) {
        switch (action) {
            case 'theme':
                if (window.FlansaThemeManager) {
                    window.FlansaThemeManager.showThemeSettings(() => { if (this.apply_theme) this.apply_theme(); });
                } else {
                    frappe.show_alert('Theme manager not available', 'orange');
                }
                break;
                
            case 'refresh-cache':
                if (window.flansaBrowserCacheManager) {
                    window.flansaBrowserCacheManager.refreshAllAssets();
                    frappe.show_alert('Cache cleared successfully!', 'green');
                } else {
                    window.location.reload(true);
                }
                break;
                
            case 'export-app':
                this.export_app_data();
                break;
                
            case 'keyboard-shortcuts':
                this.show_keyboard_shortcuts();
                break;
                
            default:
                frappe.show_alert('Unknown action: ' + action, 'orange');
        }
    }
    
    export_app_data() {
        if (!this.app_data || !this.tables) {
            frappe.show_alert('No app data to export', 'orange');
            return;
        }
        
        try {
            const export_data = {
                application: {
                    name: this.app_data.name,
                    app_title: this.app_data.app_title,
                    app_name: this.app_data.app_name,
                    description: this.app_data.description
                },
                tables: this.tables.map(table => ({
                    name: table.name,
                    table_name: table.table_name,
                    table_label: table.table_label,
                    description: table.description,
                    fields_count: table.fields_count,
                    record_count: table.record_count
                })),
                exported_at: new Date().toISOString(),
                version: '1.0'
            };
            
            // Download as JSON
            const blob = new Blob([JSON.stringify(export_data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.app_data.app_name || 'app'}_export_${new Date().toISOString().split('T')[0]}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            frappe.show_alert('App data exported successfully!', 'green');
        } catch (error) {
            console.error('Export error:', error);
            frappe.show_alert('Export failed: ' + error.message, 'red');
        }
    }
    
    show_keyboard_shortcuts() {
        const shortcuts = [
            { key: 'Ctrl/Cmd + N', action: 'Create new table' },
            { key: 'Ctrl/Cmd + F', action: 'Search tables' },
            { key: 'Ctrl/Cmd + R', action: 'Refresh dashboard' },
            { key: 'T', action: 'Switch to table view' },
            { key: 'G', action: 'Switch to tile view' },
            { key: 'Esc', action: 'Close dialogs' }
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
    
}

// Apply theme on page load
$(document).ready(function() {
    if (window.page_instance && window.page_instance.apply_theme) {
        window.page_instance.apply_theme();
    }
});
