frappe.pages['flansa-visual-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Visual Table Builder',
        single_column: true
    });
    
    // Initialize the enhanced visual builder
    new EnhancedVisualBuilder(page);
};

class EnhancedVisualBuilder {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        this.mode = null;
        
        // Set global reference for button onclick handlers
        window.visual_builder = this;
        
        // Initialize asynchronously to handle database calls
        this.init();
    }
    
    
    async init() {
        this.mode = await this.determine_mode();
        this.setup_page();
        this.setup_context_menu();
        this.setup_breadcrumbs();
        this.load_data();
    }
    
    async determine_mode() {
        console.log('Visual Builder - Determining mode from URL parameters');
        
        // Check for URL parameters (query string: ?table=FT-0039 or ?app=APP-123)
        const urlParams = new URLSearchParams(window.location.search);
        const tableParam = urlParams.get('table');
        const appParam = urlParams.get('app');
        
        if (tableParam) {
            console.log('Found table parameter:', tableParam);
            return await this.setup_table_mode(tableParam);
        }
        
        if (appParam) {
            console.log('Found app parameter:', appParam);
            this.app_name = appParam;
            return 'application_tables';
        }
        
        // Default to showing all applications
        console.log('No parameters found, showing all applications');
        return 'all_applications';
    }
    
    async setup_table_mode(table_identifier) {
        try {
            // Try to get table by name first (handles both ID and name)
            const result = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    filters: { name: table_identifier },
                    fields: ['name', 'table_label', 'application', 'doctype_name']
                }
            });
            
            if (result.message && result.message.length > 0) {
                const table_data = result.message[0];
                this.single_table_id = table_data.name;
                this.single_table_label = table_data.table_label;
                this.app_name = table_data.application;
                console.log('Table found:', table_data);
                return 'single_table';
            }
            
            // If not found by name, try by table_name
            const name_result = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    filters: { table_name: table_identifier },
                    fields: ['name', 'table_label', 'application', 'doctype_name']
                }
            });
            
            if (name_result.message && name_result.message.length > 0) {
                const table_data = name_result.message[0];
                this.single_table_id = table_data.name;
                this.single_table_label = table_data.table_label;
                this.app_name = table_data.application;
                console.log('Table found by name:', table_data);
                return 'single_table';
            }
            
        } catch (error) {
            console.error('Error finding table:', error);
        }
        
        // Table not found
        console.log('Table not found:', table_identifier);
        return 'error';
    }
    
    setup_page() {
        // Add standardized Back button with enhanced fallback
        this.addBackButton();
        
        // Handle different modes
        if (this.mode === 'all_applications') {
            this.setup_all_applications_view();
        } else if (this.mode === 'single_table') {
            this.setup_single_table_view();
        } else if (this.mode === 'application_tables') {
            this.setup_application_view();
        } else if (this.mode === 'application') {
            this.setup_application_view();
        } else {
            this.show_error('Invalid mode or parameter');
        }
    }
    
    setup_single_table_view() {
        // Skip setting page title to avoid redundancy with banner
        // Remove all buttons above banner for clean design
        
        // Hide default page header to make banner freeze at top
        this.hide_default_page_header();
        
        // Add mode indicator using proper method
        this.add_mode_indicator();
        
        // Create main container with consistent header design
        this.$container.html(`
            <div class="visual-builder-container">
                <!-- Compact Modern Header - Now at absolute top -->
                <div class="flansa-compact-header" style="background: var(--flansa-gradient-primary); color: var(--flansa-white); padding: 16px 20px; margin: 0 -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                    <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa fa-cube" style="font-size: 18px; opacity: 0.9;"></i>
                        <span style="font-size: 16px; font-weight: 600;" id="app-name-display">Flansa Platform</span>
                    </div>
                    <div class="header-right" style="display: flex; align-items: center; gap: 12px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2;">🔧 Table Builder</h3>
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
                                <div class="context-menu-item" data-action="export-schema" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-download" style="width: 16px;"></i>
                                    <span>Export Schema</span>
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
                    <!-- Breadcrumbs will be populated here -->
                </div>
                
                <!-- Page Header for Table Name -->
                <div id="page-header" style="padding: 20px 20px 10px 20px; margin: 0 -20px 0 -20px; background: white; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #333;" id="table-name-display">Loading...</h2>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;" id="table-description-display"></p>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-sm btn-primary" id="quick-nav-reports" title="View Reports">
                                <i class="fa fa-chart-bar"></i> Reports
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-tables" title="App Dashboard - All Tables">
                                <i class="fa fa-table"></i> Tables
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-relationships" title="Table Relationships">
                                <i class="fa fa-link"></i> Relationships
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-form-builder" title="Form Builder">
                                <i class="fa fa-edit"></i> Forms
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-view-data" title="View Table Data">
                                <i class="fa fa-eye"></i> View Data
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-app-settings" title="Table Properties">
                                <i class="fa fa-cog"></i> Table Properties
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Content Area -->
                <div class="flansa-workspace-content" style="padding: var(--flansa-spacing-xl) var(--flansa-spacing-xl) 0;">
                    <!-- Stats Section -->
                    <div class="section-header" style="border-bottom: 1px solid var(--flansa-border, var(--flansa-gray-200)); padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; font-weight: normal;">Table Fields</h4>
                        <small style="color: var(--flansa-text-secondary, var(--flansa-gray-600));" id="field-count-display">Loading...</small>
                    </div>
                    
                    <!-- Search and Filters Toolbar -->
                    <div class="builder-toolbar" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--flansa-spacing-lg); margin-bottom: var(--flansa-spacing-xl); padding: var(--flansa-spacing-md); background: var(--flansa-surface, var(--flansa-white)); border-radius: var(--flansa-radius-lg); box-shadow: var(--flansa-shadow-sm); border: var(--flansa-border-width-sm) solid var(--flansa-border, transparent);">
                        <div class="toolbar-left" style="display: flex; gap: var(--flansa-spacing-sm);">
                            <button class="btn btn-flansa-primary" id="add-field-btn">
                                <i class="fa fa-plus"></i> Add Field
                            </button>
                            <button class="btn btn-flansa-secondary" id="add-gallery-btn">
                                <i class="fa fa-images"></i> Add Gallery
                            </button>
                        </div>
                        <div class="toolbar-center" style="display: flex; justify-content: center; max-width: 400px; width: 100%;">
                            <div class="search-wrapper" style="position: relative; width: 100%;">
                                <input type="text" class="form-control search-input" 
                                    id="field-search" placeholder="Search fields..." style="padding-left: 40px; border-radius: var(--flansa-radius-md); border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300));" />
                                <i class="fa fa-search search-icon" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--flansa-text-secondary, var(--flansa-gray-500));"></i>
                            </div>
                        </div>
                        <div class="toolbar-right" style="display: flex; gap: var(--flansa-spacing-md); align-items: center;">
                            <select class="form-control" id="field-type-filter" style="min-width: 120px; border-radius: var(--flansa-radius-md); border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300));">
                                <option value="">All Types</option>
                                <option value="Data">Data</option>
                                <option value="Text">Text</option>
                                <option value="Int">Number</option>
                                <option value="Currency">Currency</option>
                                <option value="Date">Date</option>
                                <option value="Select">Select</option>
                                <option value="Check">Checkbox</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="builder-content"></div>
                </div>
            </div>
        `);
    }
    
    add_mode_indicator() {
        // No need for mode indicator since we only have single table mode now
    }
    
    hide_default_page_header() {
        // Hide the default Frappe page header to make our banner freeze at top
        $(this.wrapper).find('.page-head').hide();
        $('body .page-head').hide();
        
        // Also add CSS to ensure it stays hidden
        if (!$('#visual-builder-page-head-css').length) {
            $('<style id="visual-builder-page-head-css">')
                .text('.page-head { display: none !important; }')
                .appendTo('head');
        }
    }
    
    add_navigation_buttons() {
        // Add dedicated buttons for primary actions
        if (this.app_name) {
            this.page.add_button('⚙️ App Settings', () => {
                window.location.href = `/app/flansa-app-dashboard?app=${this.app_name}`;
            }, 'btn-default');
            
            this.page.add_button('🔗 Relationships', () => {
                this.open_relationship_builder();
            }, 'btn-default');
        }
        
        this.page.add_button('👁️ View Data', () => {
            this.view_table_data();
        }, 'btn-default');
        
        this.page.add_button('📊 Reports', () => {
            this.open_report_builder();
        }, 'btn-primary');
        
        this.page.add_button('📝 Form Builder', () => {
            this.open_form_builder();
        }, 'btn-default');
        
        this.page.add_button('🏠 Workspace', () => {
            window.location.href = '/app/flansa-workspace';
        }, 'btn-default');
        
        // Add activate table button if needed
        this.add_activate_button_if_needed();
        
        // Menu items for less common actions
        this.page.add_menu_item('🔄 Go to another table', () => {
            this.show_table_selector();
        });
        
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
        
        // Field sync tools removed - no longer needed with native field management
        
        // Add theme settings to menu
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.addThemeMenuToPage(this.page);
        }
        
        // Add table-specific actions
        if (this.single_table_id) {
            this.page.add_menu_item('⚙️ DocType Settings', () => {
                this.open_doctype_settings();
            });
            
            this.page.add_menu_item('🔨 Force Generate DocType', () => {
                this.force_generate_doctype_for_table();
            });
            
            // Developer helpers (can be removed later)
            this.page.add_menu_item('--');
            this.page.add_menu_item('📋 Open Table Record', () => {
                if (this.single_table_id) {
                    window.open(`/app/flansa-table/${this.single_table_id}`, '_blank');
                    frappe.show_alert('Opening table record in new tab...', 'blue');
                } else {
                    frappe.msgprint('No table selected');
                }
            });
            
            this.page.add_menu_item('📝 Edit in Form View', () => {
                if (this.single_table_id) {
                    frappe.set_route('Form', 'Flansa Table', this.single_table_id);
                } else {
                    frappe.msgprint('No table selected');
                }
            });
            
            this.page.add_menu_item('📋 Duplicate Table', () => {
                this.duplicate_current_table();
            });
            
            // Add separator
            this.page.add_menu_item('');
            
            this.page.add_menu_item('🗑️ Delete Table', () => {
                this.delete_current_table();
            });
        }
        
        this.page.add_menu_item('📋 All Tables List', () => {
            window.location.href = '/app/List/Flansa Table';
        });
    }
    
    load_data() {
        this.$container.find('.builder-content').html('<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading...</div>');
        
        if (this.mode === 'all_applications') {
            // Already handled in setup
            return;
        }
        
        if (this.mode === 'application_tables') {
            this.load_application_tables();
            return;
        }
        
        this.load_single_table();
    }
    
    setup_application_view() {
        // Clean setup for application mode - no buttons above banner
        
        // Hide default page header to make banner freeze at top
        this.hide_default_page_header();
        
        // Create main container with consistent header design
        this.$container.html(`
            <div class="visual-builder-container">
                <!-- Compact Modern Header - Now at absolute top -->
                <div class="flansa-compact-header" style="background: var(--flansa-gradient-primary); color: var(--flansa-white); padding: 16px 20px; margin: 0 -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                    <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa fa-cube" style="font-size: 18px; opacity: 0.9;"></i>
                        <span style="font-size: 16px; font-weight: 600;" id="app-name-display">Flansa Platform</span>
                    </div>
                    <div class="header-right" style="display: flex; align-items: center; gap: 12px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2;">🔧 Table Builder</h3>
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
                                <div class="context-menu-item" data-action="export-schema" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-download" style="width: 16px;"></i>
                                    <span>Export Schema</span>
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
                    <!-- Breadcrumbs will be populated here -->
                </div>
                
                <!-- Content Area -->
                <div class="flansa-workspace-content" style="padding: var(--flansa-spacing-xl) var(--flansa-spacing-xl) 0;">
                    <div class="builder-content"></div>
                </div>
            </div>
        `);
        
        this.load_application_tables();
    }
    
    setup_all_applications_view() {
        // Clean setup for all applications mode - no buttons above banner
        
        // Hide default page header to make banner freeze at top
        this.hide_default_page_header();
        
        // Add theme manager with safety checks
        if (typeof FlansaThemeManager !== 'undefined' && window.FlansaThemeManager) {
            try {
                this.theme_manager = new FlansaThemeManager('visual-builder');
                if (this.theme_manager && typeof this.theme_manager.init === 'function') {
                    this.theme_manager.init();
                    console.log('Visual Builder: Theme manager initialized successfully');
                } else {
                    console.warn('Visual Builder: Theme manager init method not available');
                    this.theme_manager = null;
                }
            } catch (error) {
                console.warn('Visual Builder: Theme manager initialization failed:', error);
                this.theme_manager = null;
            }
        } else {
            console.log('Visual Builder: Theme manager not available, proceeding without themes');
            this.theme_manager = null;
        }
        
        // Add container
        this.$container.html(`
            <div class="visual-builder-container">
                <div class="builder-wrapper">
                    <div class="banner-section" style="background: linear-gradient(135deg, var(--flansa-primary, #7C3AED) 0%, var(--flansa-secondary, #EC4899) 100%); 
                        color: white; padding: var(--flansa-spacing-xl) var(--flansa-spacing-lg); 
                        border-radius: var(--flansa-radius-md); margin-bottom: var(--flansa-spacing-lg);
                        box-shadow: var(--flansa-shadow-lg);">
                        <h2 style="margin: 0; font-size: var(--flansa-font-2xl); font-weight: 600;">
                            <i class="fa fa-cube"></i> Visual Table Builder
                        </h2>
                        <p style="margin: var(--flansa-spacing-xs) 0 0 0; opacity: 0.95;">
                            Select an application to manage its tables
                        </p>
                    </div>
                    
                    <div class="count-section" id="count-section" style="margin-bottom: var(--flansa-spacing-lg);"></div>
                    
                    <div class="builder-content"></div>
                </div>
            </div>
        `);
        
        // Load all applications
        this.load_all_applications();
    }
    
    load_all_applications() {
        this.$container.find('.builder-content').html('<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading applications...</div>');
        
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Flansa Application',
                fields: ['name', 'app_title', 'description'],
                order_by: 'creation desc'
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    this.render_all_applications(r.message);
                } else {
                    this.$container.find('.builder-content').html(`
                        <div class="text-center" style="padding: var(--flansa-spacing-2xl);">
                            <i class="fa fa-cube" style="font-size: 48px; color: var(--flansa-text-secondary, var(--flansa-gray-400)); margin-bottom: var(--flansa-spacing-md);"></i>
                            <h3>No Applications Found</h3>
                            <p>Create an application from the Flansa Workspace to get started.</p>
                            <a href="/app/flansa-workspace" class="btn btn-primary" style="margin-top: var(--flansa-spacing-md);">
                                <i class="fa fa-home"></i> Go to Workspace
                            </a>
                        </div>
                    `);
                }
            }
        });
    }
    
    render_all_applications(applications) {
        // Update count
        this.$container.find('#count-section').html(`
            <div style="font-size: var(--flansa-font-sm); color: var(--flansa-text-secondary, var(--flansa-gray-600));">
                Total Applications: <strong>${applications.length}</strong>
            </div>
        `);
        
        // Create application tiles
        let apps_html = '<div class="row">';
        
        applications.forEach(app => {
            apps_html += `
                <div class="col-md-4 col-sm-6 mb-4">
                    <div class="app-tile" style="background: var(--flansa-surface, white); 
                        border: 1px solid var(--flansa-border, var(--flansa-gray-200)); 
                        border-radius: var(--flansa-radius-md); padding: var(--flansa-spacing-lg);
                        cursor: pointer; transition: all 0.3s ease;
                        box-shadow: var(--flansa-shadow-sm);"
                        onclick="window.location.href='/app/flansa-app-dashboard?app=${app.name}'">
                        <h4 style="margin: 0 0 var(--flansa-spacing-sm) 0; color: var(--flansa-text, var(--flansa-gray-900));">
                            <i class="fa fa-cube"></i> ${app.app_title || app.name}
                        </h4>
                        <p style="margin: 0; color: var(--flansa-text-secondary, var(--flansa-gray-600)); font-size: var(--flansa-font-sm);">
                            ${app.description || 'No description'}
                        </p>
                        <div style="margin-top: var(--flansa-spacing-md);">
                            <a href="/app/flansa-app-dashboard/${app.name}" class="btn btn-sm btn-primary">
                                <i class="fa fa-edit"></i> Manage Tables
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });
        
        apps_html += '</div>';
        
        this.$container.find('.builder-content').html(apps_html);
        
        // Add hover effect
        this.$container.find('.app-tile').hover(
            function() {
                $(this).css({
                    'transform': 'translateY(-2px)',
                    'box-shadow': 'var(--flansa-shadow-md)'
                });
            },
            function() {
                $(this).css({
                    'transform': 'translateY(0)',
                    'box-shadow': 'var(--flansa-shadow-sm)'
                });
            }
        );
    }
    
    load_single_table() {
        console.log('Loading single table mode');
        console.log('single_table_id:', this.single_table_id);
        
        if (!this.single_table_id) {
            this.show_error('No table specified. Please provide a table parameter in the URL.');
            return;
        }
        
        // Get table data
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Table',
                name: this.single_table_id
            },
            callback: (r) => {
                if (r.message) {
                    this.render_single_table(r.message);
                } else {
                    this.show_error('Table not found: ' + this.single_table_id);
                }
            },
            error: (r) => {
                console.error('Error loading table:', r);
                this.show_error('Error loading table: ' + this.single_table_id);
            }
        });
    }
    
    load_application_tables() {
        console.log('Loading application mode for:', this.app_name);
        
        if (!this.app_name) {
            this.show_error('No application specified');
            return;
        }
        
        // Get all tables for this application
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Flansa Table',
                filters: { application: this.app_name },
                fields: ['name', 'table_name', 'table_label', 'fields_count', 'status'],
                order_by: 'creation'
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    this.render_application_tables(r.message);
                } else {
                    this.show_no_tables_message();
                }
            }
        });
    }
    
    render_single_table(table_data) {
        console.log('Rendering single table:', table_data);
        
        // Update table name in banner
        $('#table-name-display').text(table_data.table_label || table_data.table_name || table_data.name);
        
        // Update table description in banner (use table description if available, otherwise leave blank)
        const description = table_data.description && table_data.description.trim() 
            ? table_data.description 
            : '';
        $('#table-description-display').text(description);
        
        // Hide description element if no description available
        if (!description) {
            $('#table-description-display').hide();
        } else {
            $('#table-description-display').show();
        }
        
        const header_html = `
            <div class="row mb-4">
                <div class="col-md-8">
                    <h3><i class="fa fa-table"></i> ${table_data.table_label || table_data.table_name || table_data.name}</h3>
                    <p class="text-muted">Table ID: ${table_data.name} | Fields: ${table_data.fields_count || 0}</p>
                </div>
                <div class="col-md-4 text-right">
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="window.visual_builder.edit_table('${table_data.name}')">
                            <i class="fa fa-edit"></i> Edit Table
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.$container.find('.builder-header').html(header_html);
        
        // Load fields for this table
        this.load_table_fields(table_data.name);
        
        // Store reference for button callbacks
        window.visual_builder = this;
    }
    
    render_application_tables(tables) {
        console.log('Rendering application tables:', tables);
        
        const header_html = `
            <div class="row mb-4">
                <div class="col-md-12">
                    <h3><i class="fa fa-th-large"></i> Application: ${this.app_name}</h3>
                    <p class="text-muted">${tables.length} tables found</p>
                </div>
            </div>
        `;
        
        this.$container.find('.builder-header').html(header_html);
        
        // Create tables grid
        let tables_html = '<div class="row">';
        
        tables.forEach(table => {
            const status_badge = table.status === 'Active' ? 
                '<span class="label label-success">Active</span>' : 
                '<span class="label label-warning">' + (table.status || 'Draft') + '</span>';
            
            tables_html += `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fa fa-table"></i> 
                                ${table.table_label || table.table_name || table.name}
                            </h5>
                            <p class="card-text">
                                <small class="text-muted">ID: ${table.name}</small><br>
                                <small class="text-muted">Fields: ${table.fields_count || 0}</small><br>
                                ${status_badge}
                            </p>
                            <div class="btn-group btn-group-sm" style="width: 100%;">
                                <button class="btn btn-primary" onclick="window.visual_builder.open_single_table('${table.name}')">
                                    <i class="fa fa-edit"></i> Edit
                                </button>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                        <i class="fa fa-ellipsis-v"></i>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-right">
                                        <li class="divider"></li>
                                        <li><a href="#" onclick="window.visual_builder.edit_table('${table.name}')"><i class="fa fa-cog"></i> Table Settings</a></li>
                                        <li><a href="#" onclick="window.visual_builder.duplicate_table('${table.name}')"><i class="fa fa-copy"></i> Duplicate Table</a></li>
                                        <li><a href="#" onclick="window.visual_builder.export_table('${table.name}')"><i class="fa fa-download"></i> Export Data</a></li>
                                        <li class="divider"></li>
                                        <li><a href="#" onclick="window.visual_builder.delete_table('${table.name}')" class="text-danger"><i class="fa fa-trash"></i> Delete Table</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        tables_html += '</div>';
        
        this.$container.find('.builder-content').html(tables_html);
        
        // Store reference for button callbacks
        window.visual_builder = this;
    }
    
    load_table_fields(table_id) {
        console.log('Loading fields for table:', table_id);
        
        // Load fields for the specific table using native API
        // Only clear cache if specifically needed (less aggressive approach)
        try {
            const doctype_name = this.get_doctype_name_for_table(table_id);
            if (doctype_name && this.force_cache_refresh) {
                console.log('Force refreshing cache for:', doctype_name);
                // Clear model cache if available
                if (frappe.model && frappe.model.clear_cache) {
                    frappe.model.clear_cache(doctype_name);
                }
                // Clear only this specific DocType's meta cache
                if (frappe.boot && frappe.boot.docs && frappe.boot.docs[doctype_name]) {
                    delete frappe.boot.docs[doctype_name];
                }
                // Reset the flag
                this.force_cache_refresh = false;
            }
        } catch (e) {
            console.warn('Could not clear cache:', e);
        }
        
        frappe.call({
            method: 'flansa.native_fields.get_table_fields_native',
            args: { table_name: table_id },
            callback: (r) => {
                console.log('Native fields response:', r);
                
                if (r.message && r.message.success) {
                    // Convert native fields to visual builder format
                    const fields = [];
                    for (let field of r.message.fields || []) {
                        // Include user-created fields (skip system fields like flansa_* unless they're important)
                        const is_system_field = field.fieldname.startsWith('flansa_') && 
                                              !['flansa_status', 'flansa_tags'].includes(field.fieldname);
                        const is_break_field = field.fieldtype === 'Column Break' || 
                                             field.fieldtype === 'Section Break' || 
                                             field.fieldtype === 'Tab Break';
                        
                        if (!is_system_field && !is_break_field) {
                            fields.push({
                                field_name: field.fieldname,
                                field_label: field.label,
                                field_type: field.fieldtype,
                                is_required: field.reqd || 0,
                                is_readonly: field.read_only || 0,
                                is_hidden: field.hidden || 0,
                                is_virtual: field.is_virtual || 0,
                                options: field.options || '',
                                fetch_from: field.fetch_from || '',
                                depends_on: field.depends_on || ''
                            });
                        }
                    }
                    this.render_table_fields(fields, table_id);
                } else {
                    this.$container.find('.builder-content').html('<p>No fields found for this table.</p>');
                }
            },
            error: (r) => {
                console.error('Error loading fields:', r);
                this.$container.find('.builder-content').html('<p class="text-danger">Error loading fields</p>');
            }
        });
    }
    
    load_table_relationships(table_id) {
        // Add debug logging
        console.log('Loading relationships for table_id:', table_id);
        
        if (!table_id) {
            console.warn('No table_id provided to load_table_relationships');
            this.render_table_relationships([], null);
            return;
        }
        
        // Load relationships for this table using regular Frappe client
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Flansa Relationship',
                filters: [
                    ['from_table', '=', table_id]
                ],
                or_filters: [
                    ['to_table', '=', table_id]
                ],
                fields: ['name', 'from_table', 'to_table', 'relationship_type']
            },
            callback: (r) => {
                if (r.message) {
                    console.log('Loaded relationships:', r.message);
                    this.render_table_relationships(r.message, table_id);
                } else {
                    console.log('No relationships found');
                    this.render_table_relationships([], table_id);
                }
            },
            error: (r) => {
                console.error('Error loading relationships:', r);
                this.render_table_relationships([], table_id);
            }
        });
    }
    
    render_table_fields(fields, table_id) {
        // Store table_name for Logic Field creation
        this.table_name = table_id;
        
        let content_html = `
            <div class="row">
                <div class="col-md-12">
                    <div class="logic-field-actions mb-3">
                        <button class="btn btn-info btn-sm" onclick="window.visual_builder.show_logic_examples()">
                            <i class="fa fa-question-circle"></i> Examples
                        </button>
                    </div>
                    <div class="fields-section">
                        <h4><i class="fa fa-list"></i> Fields (${fields.length})</h4>
        `;
        
        if (fields.length === 0) {
            content_html += '<div class="alert alert-info">No fields defined yet. Click "Add Field" to get started.</div>';
        } else {
            content_html += '<div class="table-responsive"><table class="table table-striped">';
            content_html += '<thead><tr><th>Field Name</th><th>Label</th><th>Type</th><th>Actions</th></tr></thead><tbody>';
            
            fields.forEach(field => {
                // Detect lookup fields by fetch_from property
                const is_lookup_field = field.fetch_from && field.fetch_from.trim() !== '';
                const is_virtual_field = field.is_virtual || 0;
                const display_type = is_lookup_field ? 'Lookup' : field.field_type;
                
                const field_type_badge = this.get_field_type_badge(display_type);
                const virtual_badge = is_virtual_field ? '<span class="label label-success">Virtual</span> ' : '';
                const is_special_field = is_lookup_field || field.field_type === 'Summary';
                const row_style = is_special_field ? 'style="cursor: pointer;" onclick="window.visual_builder.show_field_details(\'' + table_id + '\', \'' + field.field_name + '\')"' : '';
                const field_icon = is_lookup_field ? '<i class="fa fa-link text-info"></i> ' : 
                                 field.field_type === 'Summary' ? '<i class="fa fa-calculator text-warning"></i> ' : '';
                
                content_html += `
                    <tr ${row_style} class="${is_special_field ? 'field-clickable' : ''}">
                        <td>${field_icon}<code>${field.field_name}</code></td>
                        <td>${field.field_label || field.field_name}</td>
                        <td>${field_type_badge} ${virtual_badge}</td>
                        <td>
                            <div class="btn-group btn-group-sm">
                                ${is_special_field ? `
                                    <button class="btn btn-info" onclick="event.stopPropagation(); window.visual_builder.show_field_details('${table_id}', '${field.field_name}')" title="View Details">
                                        <i class="fa fa-eye"></i>
                                    </button>
                                ` : ''}
                                <button class="btn btn-default" onclick="event.stopPropagation(); window.visual_builder.edit_field('${table_id}', '${field.field_name}')" title="Edit">
                                    <i class="fa fa-edit"></i>
                                </button>
                                <button class="btn btn-danger" onclick="event.stopPropagation(); window.visual_builder.delete_field('${table_id}', '${field.field_name}')" title="Delete">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            content_html += '</tbody></table></div>';
        }
        
        content_html += '</div></div></div>';
        
        this.$container.find('.builder-content').html(content_html);
        
        // Add hover effect for clickable fields
        this.$container.find('.field-clickable').css({
            'transition': 'background-color 0.2s'
        }).hover(
            function() { $(this).css('background-color', 'var(--flansa-surface-hover, #f0f0f0)'); },
            function() { $(this).css('background-color', ''); }
        );
        
        // Update field count display and bind events
        this.update_field_count_display();
        this.bind_field_search_events();
    }
    
    render_table_relationships(relationships, table_id) {
        let relationships_html = `
            <h4><i class="fa fa-link"></i> Relationships (${relationships.length})</h4>
            <div class="mb-3">
                <button class="btn btn-success btn-sm" onclick="window.visual_builder.add_relationship('${table_id}')">
                    <i class="fa fa-plus"></i> Add Relationship
                </button>
            </div>
        `;
        
        if (relationships.length === 0) {
            relationships_html += '<div class="alert alert-info">No relationships defined yet.</div>';
        } else {
            relationships_html += '<div class="list-group">';
            
            relationships.forEach(rel => {
                const is_from = rel.from_table === table_id;
                const other_table = is_from ? rel.to_table : rel.from_table;
                const direction = is_from ? 'to' : 'from';
                const icon = this.get_relationship_icon(rel.relationship_type);
                
                relationships_html += `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-1">
                                    ${icon} ${rel.relationship_name || `${rel.relationship_type} Relationship`}
                                </h6>
                                <p class="mb-1 text-muted small">
                                    This table ${direction} <strong>${other_table}</strong>
                                </p>
                                ${rel.from_field || rel.link_field ? `<small><code>${rel.from_field || rel.link_field}</code> field</small>` : ''}
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-default" onclick="window.visual_builder.view_relationship_details('${rel.name}')" title="View Details">
                                    <i class="fa fa-eye"></i>
                                </button>
                                <button class="btn btn-default" onclick="window.visual_builder.edit_relationship('${rel.name}')" title="Edit">
                                    <i class="fa fa-edit"></i>
                                </button>
                                <button class="btn btn-danger" onclick="window.visual_builder.delete_relationship('${rel.name}')" title="Delete">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            relationships_html += '</div>';
        }
        
        this.$container.find('.relationships-section').html(relationships_html);
    }
    
    get_field_type_badge(field_type) {
        const type = field_type || 'Data';
        const color_map = {
            'Data': 'default',
            'Text': 'info',
            'Int': 'primary',
            'Float': 'primary',
            'Date': 'warning',
            'Select': 'success',
            'Lookup': 'info',
            'Summary': 'warning',
            'Attach': 'purple',
            'Attach Image': 'purple'
        };
        
        const color = color_map[type] || 'default';
        return `<span class="label label-${color}">${type}</span>`;
    }
    
    // Action methods
    open_single_table(table_id) {
        // Force page reload with new route to ensure proper initialization
        window.location.href = `/app/flansa-visual-builder?table=${table_id}`;
    }
    
    switch_to_application_mode() {
        // If we have an app_name from URL parameters, use it directly
        if (this.app_name) {
            window.location.href = `/app/flansa-visual-builder?app=${this.app_name}`;
            return;
        }
        
        // Otherwise, get the application from the table
        const table_id = this.single_table_id;
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Table',
                name: table_id
            },
            callback: (r) => {
                if (r.message && r.message.application) {
                    // Force full page reload to ensure proper initialization
                    window.location.href = `/app/flansa-visual-builder?app=${r.message.application}`;
                } else {
                    frappe.msgprint('No application set for this table');
                }
            }
        });
    }
    
    show_table_selector() {
        // Show dialog to select a table for single table mode
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Flansa Table',
                fields: ['name', 'table_name', 'table_label', 'application'],
                order_by: 'creation desc',
                limit: 20
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    this.show_table_selection_dialog(r.message);
                } else {
                    frappe.msgprint('No tables found');
                }
            }
        });
    }
    
    show_table_selection_dialog(tables) {
        const dialog = new frappe.ui.Dialog({
            title: 'Select Table for Single Table Mode',
            fields: [
                {
                    label: 'Select Table',
                    fieldname: 'selected_table',
                    fieldtype: 'Select',
                    options: tables.map(t => ({
                        label: `${t.table_label || t.table_name || t.name} (${t.name})`,
                        value: t.name
                    })).map(o => `${o.value}:${o.label}`).join('\n'),
                    reqd: 1
                }
            ],
            primary_action_label: 'Open Table',
            primary_action: (values) => {
                const table_id = values.selected_table.split(':')[0];
                dialog.hide();
                this.open_single_table(table_id);
            }
        });
        
        dialog.show();
        
        // Initialize live testing with enhanced features
        ;
    }
    
    show_error(message = null) {
        const error_html = `
            <div class="text-center" style="padding: 50px;">
                <h4><i class="fa fa-exclamation-triangle text-warning"></i> Error Loading Visual Builder</h4>
                <p>${message || 'Invalid or missing URL parameters'}</p>
                <div class="alert alert-info">
                    <strong>Expected formats:</strong><br>
                    • Specific table: <code>/app/flansa-visual-builder?table=FT-00019</code><br>
                    • Application tables: <code>/app/flansa-visual-builder?app=jewelry_catalog</code><br>
                    • All applications: <code>/app/flansa-visual-builder</code>
                </div>
                <button class="btn btn-primary" onclick="window.location.href='/app/List/Flansa Table'">
                    <i class="fa fa-home"></i> Back to Tables
                </button>
            </div>
        `;
        
        this.$container.find('.builder-content').html(error_html);
    }
    
    show_no_tables_message() {
        const no_tables_html = `
            <div class="text-center" style="padding: 50px;">
                <h4><i class="fa fa-table text-muted"></i> No Tables Found</h4>
                <p>No tables found for application: <strong>${this.app_name}</strong></p>
                <button class="btn btn-success" onclick="window.visual_builder.create_new_table()">
                    <i class="fa fa-plus"></i> Create First Table
                </button>
                <button class="btn btn-default ml-2" onclick="window.location.href='/app/List/Flansa Table'">
                    <i class="fa fa-home"></i> Back to Tables
                </button>
            </div>
        `;
        
        this.$container.find('.builder-content').html(no_tables_html);
    }
    
    bind_field_search_events() {
        const self = this;
        
        // Bind search input
        $('#field-search').off('input').on('input', function() {
            self.filter_fields();
        });
        
        // Bind type filter
        $('#field-type-filter').off('change').on('change', function() {
            self.filter_fields();
        });
        
        // Bind add field button
        $('#add-field-btn').off('click').on('click', function() {
            self.add_field(self.single_table_id);
        });
        
        // Bind add gallery button
        $('#add-gallery-btn').off('click').on('click', function() {
            self.add_attachment_field(self.single_table_id);
        });
    }
    
    filter_fields() {
        const searchTerm = $('#field-search').val().toLowerCase();
        const selectedType = $('#field-type-filter').val();
        
        $('.table tbody tr').each(function() {
            const $row = $(this);
            const fieldName = $row.find('td:first-child code').text().toLowerCase();
            const fieldLabel = $row.find('td:nth-child(2)').text().toLowerCase();
            const fieldType = $row.find('td:nth-child(3) .label').text();
            
            const matchesSearch = fieldName.includes(searchTerm) || fieldLabel.includes(searchTerm);
            const matchesType = !selectedType || fieldType === selectedType;
            
            if (matchesSearch && matchesType) {
                $row.show();
            } else {
                $row.hide();
            }
        });
        
        // Update field count display
        const visibleFields = $('.table tbody tr:visible').length;
        const totalFields = $('.table tbody tr').length;
        $('#field-count-display').text(`${visibleFields} of ${totalFields} field${totalFields !== 1 ? 's' : ''}`);
    }
    
    // Action methods for buttons
    add_field(table_id) {
        // Debug: Add console log to verify method is called
        console.log("add_field called with table_id:", table_id);
        console.log("this.show_field_creation_wizard exists:", typeof this.show_field_creation_wizard);
        
        // Use the new field creation wizard
        this.show_field_creation_wizard(table_id);
    }

    // Legacy add_field function (kept for reference)
    add_field_legacy(table_id) {
        const self = this;
        let field_name_manually_edited = false;
        let last_auto_generated_name = '';
        
        // Define the add field action function
        const addFieldAction = (values) => {
            // Prevent multiple clicks by disabling the button
            dialog.set_primary_action('Adding...', null);
            dialog.$wrapper.find('.btn-primary').prop('disabled', true);
            
            // Define the reset function
            const resetButton = () => {
                dialog.set_primary_action('Add Field', addFieldAction);
                dialog.$wrapper.find('.btn-primary').prop('disabled', false);
            };
            
            // Create the field via native API
            frappe.call({
                method: 'flansa.native_fields.add_basic_field_native',
                args: {
                    table_name: table_id,
                    field_config: {
                        field_name: values.field_name,
                        field_label: values.field_label,
                        field_type: values.field_type,
                        options: values.options || '',
                        required: values.reqd || 0,
                        hidden: 0,
                        read_only: values.read_only || 0
                    }
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert({
                            message: `Field "${values.field_label}" added successfully!`,
                            indicator: 'green'
                        });
                        dialog.hide();
                        // Set flag to force cache refresh since we added a field
                        self.force_cache_refresh = true;
                        self.load_table_fields(table_id);
                    } else {
                        resetButton();
                        frappe.msgprint({
                            title: 'Error',
                            indicator: 'red',
                            message: r.message?.error || 'Failed to add field'
                        });
                    }
                },
                error: () => {
                    resetButton();
                    frappe.show_alert({
                        message: 'Network error. Please try again.',
                        indicator: 'red'
                    });
                }
            });
        };

        const dialog = new frappe.ui.Dialog({
            title: 'Add New Field',
            fields: [
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display name for users',
                    change: () => {
                        // Auto-generate field name from label
                        const label = dialog.get_value('field_label');
                        
                        if (label) {
                            const normalized_name = self.normalize_field_name(label);
                            const current_field_name = dialog.get_value('field_name');
                            
                            // Check if current field_name matches our last auto-generated name
                            const should_auto_update = !field_name_manually_edited || 
                                                     current_field_name === last_auto_generated_name ||
                                                     !current_field_name;
                            
                            if (should_auto_update) {
                                dialog.set_value('field_name', normalized_name);
                                last_auto_generated_name = normalized_name;
                                field_name_manually_edited = false;
                            }
                        }
                    }
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name (lowercase, underscores only - auto-generated from label)',
                    change: () => {
                        // Only mark as manually edited if it doesn't match what we'd auto-generate
                        const current_field_name = dialog.get_value('field_name');
                        const current_label = dialog.get_value('field_label');
                        const expected_name = current_label ? self.normalize_field_name(current_label) : '';
                        
                        if (current_field_name !== expected_name && current_field_name !== last_auto_generated_name) {
                            field_name_manually_edited = true;
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Type',
                    fieldname: 'field_type',
                    fieldtype: 'Select',
                    options: 'Data\nText\nInt\nFloat\nCurrency\nDate\nDatetime\nTime\nCheck\nSelect\nLink\nText Editor\nAttach',
                    default: 'Data',
                    reqd: 1
                },
                {
                    label: 'Options',
                    fieldname: 'options',
                    fieldtype: 'Small Text',
                    description: 'For Select: Option1\\nOption2\\nOption3',
                    depends_on: 'eval:doc.field_type === "Select"'
                },
                {
                    label: 'Link Target',
                    fieldname: 'options',
                    fieldtype: 'Data',
                    description: 'DocType to link to (e.g., Customer, Item)',
                    depends_on: 'eval:doc.field_type === "Link"'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Properties'
                },
                {
                    label: 'Required',
                    fieldname: 'reqd',
                    fieldtype: 'Check',
                    default: 0
                },
                {
                    label: 'Unique',
                    fieldname: 'unique',
                    fieldtype: 'Check', 
                    default: 0
                },
                {
                    label: 'Read Only',
                    fieldname: 'read_only',
                    fieldtype: 'Check',
                    default: 0
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'In List View',
                    fieldname: 'in_list_view',
                    fieldtype: 'Check',
                    default: 0
                },
                {
                    label: 'In Standard Filter',
                    fieldname: 'in_standard_filter', 
                    fieldtype: 'Check',
                    default: 0
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Additional'
                },
                {
                    label: 'Default Value',
                    fieldname: 'default_value',
                    fieldtype: 'Data'
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Small Text'
                }
            ],
            primary_action_label: 'Add Field',
            primary_action: addFieldAction
        });
        
        dialog.show();
    }
    
    update_field_count_display() {
        // Update the field count display in the header
        setTimeout(() => {
            const fieldCount = $('.table tbody tr').length;
            $('#field-count-display').text(`${fieldCount} field${fieldCount !== 1 ? 's' : ''}`);
        }, 100);
    }
    
    normalize_field_name(label) {
        // Convert field label to valid field name (similar to app name normalization)
        if (!label) return label;
        
        // Convert to lowercase and replace spaces/special chars with underscores
        let normalized = label.toLowerCase();
        // Replace anything that's not a letter, number, or underscore with underscore
        normalized = normalized.replace(/[^a-z0-9_]/g, '_');
        // Remove multiple underscores
        normalized = normalized.replace(/_+/g, '_');
        // Remove leading/trailing underscores
        normalized = normalized.replace(/^_+|_+$/g, '');
        // Ensure it starts with a letter
        if (normalized && normalized[0] >= '0' && normalized[0] <= '9') {
            normalized = 'field_' + normalized;
        }
        
        return normalized || 'new_field';
    }
    
    add_attachment_field(table_id) {
        // Create dialog for gallery field configuration
        const dialog = new frappe.ui.Dialog({
            title: 'Add Gallery Field',
            fields: [
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    default: 'gallery_images',
                    reqd: 1,
                    description: 'Technical field name (no spaces)'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    default: 'Gallery Images',
                    reqd: 1,
                    description: 'Display label for the field'
                },
                {
                    label: 'Gallery Type',
                    fieldname: 'gallery_type',
                    fieldtype: 'Select',
                    options: 'Image Gallery\nFile Gallery\nMixed Media Gallery',
                    default: 'Image Gallery',
                    reqd: 1
                },
                {
                    label: 'Maximum Files',
                    fieldname: 'max_files',
                    fieldtype: 'Int',
                    default: 10,
                    description: 'Maximum number of files allowed (0 for unlimited)'
                },
                {
                    label: 'Allowed Extensions',
                    fieldname: 'allowed_extensions',
                    fieldtype: 'Data',
                    default: 'jpg,jpeg,png,gif,webp',
                    description: 'Comma-separated list of allowed file extensions'
                },
                {
                    label: 'Enable Drag & Drop',
                    fieldname: 'enable_drag_drop',
                    fieldtype: 'Check',
                    default: 1
                },
                {
                    label: 'Show Thumbnails',
                    fieldname: 'show_thumbnails',
                    fieldtype: 'Check',
                    default: 1
                }
            ],
            primary_action_label: 'Create Gallery Field',
            primary_action: (values) => {
                // Create the gallery field with enhanced configuration using JSON field
                const field_data = {
                    field_name: values.field_name,
                    field_label: values.field_label,
                    field_type: 'JSON',  // Using JSON field to store multiple image data
                    options: '',  // No options needed for JSON
                    description: `Multi-image Gallery Field - ${values.gallery_type} - Max ${values.max_files || 'unlimited'} files - Config: ${JSON.stringify({
                        gallery_type: values.gallery_type,
                        max_files: values.max_files,
                        allowed_extensions: values.allowed_extensions,
                        enable_drag_drop: values.enable_drag_drop,
                        show_thumbnails: values.show_thumbnails,
                        is_gallery: true,
                        field_renderer: 'gallery'
                    })}`
                };
                
                frappe.call({
                    method: 'flansa.native_fields.add_gallery_field_native',
                    args: {
                        table_name: table_id,
                        gallery_config: {
                            field_name: values.field_name,
                            field_label: values.field_label,
                            gallery_type: values.gallery_type,
                            max_files: values.max_files,
                            allowed_extensions: values.allowed_extensions,
                            enable_drag_drop: values.enable_drag_drop,
                            show_thumbnails: values.show_thumbnails,
                            required: 0,
                            hidden: 0,
                            read_only: 0
                        }
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: 'Gallery field added successfully!',
                                indicator: 'green'
                            });
                            dialog.hide();
                            // Set flag to force cache refresh since we added a field
                            this.force_cache_refresh = true;
                            this.load_table_fields(table_id);
                        } else {
                            // Handle both object and string responses
                            let error_message = 'Failed to add gallery field';
                            if (r.message) {
                                if (typeof r.message === 'string') {
                                    error_message = r.message;
                                } else if (r.message.error) {
                                    error_message = r.message.error;
                                }
                            }
                            frappe.msgprint({
                                title: 'Error',
                                indicator: 'red',
                                message: error_message
                            });
                        }
                    }
                });
            }
        });
        
        dialog.show();
    }
    
    edit_field(table_id, field_name) {
        // Get current field data using native API
        frappe.call({
            method: 'flansa.native_fields.get_table_fields_native',
            args: { table_name: table_id },
            callback: (r) => {
                if (r.message && r.message.success) {
                    // Find the field in native format
                    const native_field = r.message.fields.find(f => f.fieldname === field_name);
                    
                    if (native_field) {
                        // Convert to expected format
                        const field = {
                            field_name: native_field.fieldname,
                            field_label: native_field.label,
                            field_type: native_field.fieldtype,
                            is_required: native_field.reqd || 0,
                            is_readonly: native_field.read_only || 0,
                            options: native_field.options || '',
                            fetch_from: native_field.fetch_from || '',
                            depends_on: native_field.depends_on || ''
                        };
                        this.show_unified_field_dialog(table_id, field);
                    } else {
                        frappe.msgprint('Field not found: ' + field_name);
                    }
                } else {
                    frappe.msgprint('Error loading field data');
                }
            }
        });
    }
    
    // Show template selection dialog first
    show_field_creation_wizard(table_id) {
        console.log("show_field_creation_wizard called with table_id:", table_id);
        
        const dialog = new frappe.ui.Dialog({
            title: 'Create Field - Choose Method',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `
                        <div style="text-align: center; padding: 20px;">
                            <h4>How would you like to create your field?</h4>
                            <p class="text-muted">Choose the method that best fits your needs</p>
                        </div>
                    `
                },
                {
                    fieldtype: 'Section Break'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'options_html',
                    options: `
                        <div class="field-creation-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                            
                            <div class="creation-option" data-method="basic" style="
                                border: 2px solid #e9ecef; 
                                border-radius: 8px; 
                                padding: 20px; 
                                text-align: center; 
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">
                                <i class="fa fa-edit" style="font-size: 2em; color: #007bff; margin-bottom: 10px;"></i>
                                <h5>Basic Field</h5>
                                <p class="text-muted">Create simple data fields<br><small>Text, Numbers, Dates, etc.</small></p>
                            </div>
                            
                            <div class="creation-option" data-method="template" style="
                                border: 2px solid #e9ecef; 
                                border-radius: 8px; 
                                padding: 20px; 
                                text-align: center; 
                                cursor: pointer;
                                transition: all 0.3s ease;
                            ">
                                <i class="fa fa-magic" style="font-size: 2em; color: #28a745; margin-bottom: 10px;"></i>
                                <h5>Smart Templates</h5>
                                <p class="text-muted">Guided creation for complex fields<br><small>Lookups, Summaries, Calculations</small></p>
                            </div>
                            
                        </div>
                        
                        <style>
                        .creation-option:hover {
                            border-color: #007bff !important;
                            transform: translateY(-2px);
                            box-shadow: 0 4px 8px rgba(0,123,255,0.2);
                        }
                        </style>
                    `
                }
            ]
        });
        
        dialog.show();
        
        // Handle option selection
        const self = this;
        setTimeout(() => {
            console.log("Setting up click handlers...");
            console.log("Found .creation-option elements:", $('.creation-option').length);
            
            $('.creation-option').on('click', (e) => {
                const method = $(e.currentTarget).data('method');
                console.log("Option clicked:", method);
                dialog.hide();
                
                if (method === 'basic') {
                    console.log("Calling show_unified_field_dialog");
                    self.show_unified_field_dialog(table_id);
                } else if (method === 'template') {
                    console.log("Calling show_template_selection_dialog");
                    self.show_template_selection_dialog(table_id);
                }
            });
            
            // Also try direct binding to the dialog wrapper
            $(dialog.$wrapper).on('click', '.creation-option', (e) => {
                const method = $(e.currentTarget).data('method');
                console.log("Dialog wrapper click - Option clicked:", method);
                dialog.hide();
                
                if (method === 'basic') {
                    console.log("Dialog wrapper - Calling show_unified_field_dialog");
                    self.show_unified_field_dialog(table_id);
                } else if (method === 'template') {
                    console.log("Dialog wrapper - Calling show_template_selection_dialog");
                    self.show_template_selection_dialog(table_id);
                }
            });
        }, 100);
    }

    // Show template selection dialog
    show_template_selection_dialog(table_id) {
        const dialog = new frappe.ui.Dialog({
            title: 'Choose Field Template',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `
                        <div style="padding: 10px 0;">
                            <h5>Select a template that matches what you want to create:</h5>
                        </div>
                    `
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'templates_html',
                    options: '<div id="template-grid">Loading templates...</div>'
                }
            ]
        });
        
        dialog.show();
        
        // Load templates
        console.log("Loading logic templates...");
        frappe.call({
            method: 'flansa.logic_templates.get_logic_templates',
            callback: (r) => {
                console.log("Templates API response:", r);
                if (r.message && r.message.success) {
                    console.log("Templates loaded successfully:", Object.keys(r.message.templates));
                    this.render_template_grid(r.message.templates, table_id, dialog);
                } else {
                    console.log("Failed to load templates:", r.message);
                    $('#template-grid').html('<div class="alert alert-warning">Could not load templates</div>');
                }
            }
        });
    }

    // Render template selection grid
    render_template_grid(templates, table_id, dialog) {
        console.log("Rendering template grid with templates:", templates);
        let html = '<div class="template-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">';
        
        for (const [key, template] of Object.entries(templates)) {
            html += `
                <div class="template-card" data-template="${key}" style="
                    border: 2px solid #e9ecef;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <i class="fa ${template.icon}" style="font-size: 1.5em; color: #007bff; margin-right: 10px;"></i>
                        <h6 style="margin: 0;">${template.name}</h6>
                    </div>
                    <p class="text-muted" style="font-size: 0.9em; margin: 0;">${template.description}</p>
                    <div class="template-category" style="margin-top: 8px;">
                        <span class="label label-info" style="font-size: 0.75em;">${template.category}</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Add back button
        html += `
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-default" id="back-to-method">
                    <i class="fa fa-arrow-left"></i> Back to Method Selection
                </button>
            </div>
        `;
        
        console.log("Generated HTML length:", html.length);
        console.log("Found #template-grid elements:", $('#template-grid').length);
        console.log("Found in dialog wrapper:", $(dialog.$wrapper).find('#template-grid').length);
        
        // Update the template grid - try both global and dialog-scoped
        $('#template-grid').html(html);
        $(dialog.$wrapper).find('#template-grid').html(html);
        
        const self = this;
        
        // Handle template selection - use dialog wrapper for event delegation
        $(dialog.$wrapper).on('click', '.template-card', (e) => {
            const templateId = $(e.currentTarget).data('template');
            console.log("Template selected:", templateId);
            dialog.hide();
            self.show_template_wizard(table_id, templateId, templates[templateId]);
        });
        
        // Handle back button - use dialog wrapper for event delegation
        $(dialog.$wrapper).on('click', '#back-to-method', () => {
            console.log("Back button clicked");
            dialog.hide();
            self.show_field_creation_wizard(table_id);
        });
        
        // Add hover effects
        $('.template-card').hover(
            function() { $(this).css('border-color', '#007bff').css('transform', 'translateY(-2px)'); },
            function() { $(this).css('border-color', '#e9ecef').css('transform', 'translateY(0)'); }
        );
    }

    // Show template wizard for specific template
    show_template_wizard(table_id, template_id, template) {
        console.log("Showing template wizard for:", template_id);
        
        if (template_id === 'link') {
            this.show_link_wizard(table_id);
        } else if (template_id === 'fetch') {
            this.show_fetch_wizard(table_id);
        } else if (template_id === 'rollup') {
            this.show_rollup_wizard(table_id);
        } else if (template_id === 'formula') {
            this.show_formula_wizard(table_id);
        } else {
            // Fallback to basic dialog with template hint
            this.show_unified_field_dialog(table_id, null, template);
        }
    }

    // Link Field Wizard
    show_link_wizard(table_id) {
        console.log("Starting Link Field wizard for table:", table_id);
        
        const dialog = new frappe.ui.Dialog({
            title: 'Create Link Field',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `
                        <div style="padding: 10px 0;">
                            <h5><i class="fa fa-link"></i> Link Field</h5>
                            <p class="text-muted">Create a relationship field to connect with another table.</p>
                        </div>
                    `
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Details'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label (e.g., Customer)',
                    change: () => {
                        // Auto-generate field name from label
                        const label = dialog.get_value('field_label');
                        if (label) {
                            const normalized_name = this.normalize_field_name(label);
                            dialog.set_value('field_name', normalized_name);
                        }
                    }
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (auto-generated from label)'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Target Selection'
                },
                {
                    label: 'Link Scope',
                    fieldname: 'link_scope',
                    fieldtype: 'Select',
                    options: 'Current App\nOther Flansa Apps\nSystem Tables',
                    default: 'Current App',
                    reqd: 1,
                    change: () => this.load_target_tables(dialog, table_id)
                },
                {
                    label: 'Select App',
                    fieldname: 'target_app',
                    fieldtype: 'Select',
                    depends_on: 'eval:doc.link_scope === "Other Flansa Apps"',
                    description: 'Choose the Flansa app to select tables from',
                    change: () => this.handle_app_selection_change(dialog)
                },
                {
                    label: 'Target Table',
                    fieldname: 'target_doctype',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Table to link to'
                }
            ],
            primary_action_label: 'Create Link Field',
            primary_action: (values) => {
                this.create_link_field(table_id, values, dialog);
            }
        });
        
        dialog.show();
        
        // Load initial target tables
        this.load_target_tables(dialog, table_id);
    }
    
    load_target_tables(dialog, table_id) {
        const scope = dialog.get_value('link_scope');
        const target_table = table_id || this.current_table;
        
        console.log("Loading target tables for scope:", scope, "table:", target_table);
        console.log("Args being sent:", { table_name: target_table });
        
        frappe.call({
            method: 'flansa.logic_templates.get_link_wizard_data',
            args: { table_name: target_table },
            callback: (r) => {
                console.log("Link wizard data response:", r);
                if (r.message && r.message.success) {
                    let tables = [];
                    
                    if (scope === 'Current App') {
                        tables = r.message.current_app_tables || [];
                        this.populate_target_tables(dialog, tables);
                        
                    } else if (scope === 'Other Flansa Apps') {
                        // Handle hierarchical app selection
                        this.handle_other_apps_selection(dialog, r.message);
                        
                    } else if (scope === 'System Tables') {
                        tables = r.message.system_tables || [];
                        this.populate_target_tables(dialog, tables);
                    }
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: r.message?.error || 'Failed to load target tables'
                    });
                }
            }
        });
    }
    
    handle_other_apps_selection(dialog, response_data) {
        const available_apps = response_data.available_apps || [];
        const other_apps_grouped = response_data.other_apps_grouped || {};
        
        if (available_apps.length > 0) {
            // Store grouped data for later use
            dialog._other_apps_grouped = other_apps_grouped;
            
            // Populate app selection dropdown
            const app_options = available_apps.join('\n');
            dialog.set_df_property('target_app', 'options', app_options);
            
            // Check if an app is already selected and load its tables
            const selected_app = dialog.get_value('target_app');
            if (selected_app && other_apps_grouped[selected_app]) {
                this.populate_target_tables(dialog, other_apps_grouped[selected_app]);
            } else {
                // Clear target table dropdown until app is selected
                dialog.set_df_property('target_doctype', 'options', '');
                dialog._table_data = [];
            }
        } else {
            dialog.set_df_property('target_app', 'options', '');
            dialog.set_df_property('target_doctype', 'options', '');
            frappe.show_alert({
                message: 'No other Flansa apps found',
                indicator: 'orange'
            });
        }
    }
    
    handle_app_selection_change(dialog) {
        const selected_app = dialog.get_value('target_app');
        console.log("App selection changed to:", selected_app);
        
        if (selected_app && dialog._other_apps_grouped && dialog._other_apps_grouped[selected_app]) {
            this.populate_target_tables(dialog, dialog._other_apps_grouped[selected_app]);
        } else {
            // Clear target table dropdown
            dialog.set_df_property('target_doctype', 'options', '');
            dialog._table_data = [];
        }
    }
    
    populate_target_tables(dialog, tables) {
        console.log("Populating target tables:", tables);
        
        if (tables.length > 0) {
            // Store table data for later lookup
            dialog._table_data = tables;
            // Show only labels to user
            const options = tables.map(t => t.label).join('\n');
            dialog.set_df_property('target_doctype', 'options', options);
        } else {
            dialog.set_df_property('target_doctype', 'options', '');
            const scope = dialog.get_value('link_scope');
            const selected_app = dialog.get_value('target_app');
            const context = scope === 'Other Flansa Apps' && selected_app ? `"${selected_app}" app` : `"${scope}"`;
            
            frappe.show_alert({
                message: `No tables found in ${context}`,
                indicator: 'orange'
            });
        }
    }
    
    create_link_field(table_id, values, dialog) {
        // Get actual doctype from stored data using the label
        const target_label = values.target_doctype;
        const table_data = dialog._table_data || [];
        
        const table_info = table_data.find(t => t.label === target_label);
        if (!table_info) {
            frappe.msgprint({
                title: 'Error',
                indicator: 'red',
                message: 'Target table not found. Please reselect.'
            });
            return;
        }
        
        const actual_doctype = table_info.value;
        
        console.log("Creating link field with values:", values);
        console.log("Target table label:", target_label, "→ doctype:", actual_doctype);
        
        // Update the values with the actual doctype
        const template_data = {
            ...values,
            target_doctype: actual_doctype
        };
        
        frappe.call({
            method: 'flansa.logic_templates.create_field_from_template',
            args: {
                table_name: table_id,
                template_id: 'link',
                template_data: template_data
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `Link field "${values.field_label}" created successfully!`,
                        indicator: 'green'
                    });
                    dialog.hide();
                    this.load_table_fields(table_id);
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: r.message?.error || 'Failed to create link field'
                    });
                }
            }
        });
    }

    // Fetch Field Wizard
    show_fetch_wizard(table_id) {
        // Use unified wizard for creation mode
        this.show_unified_fetch_wizard(table_id, null);
    }
    
    load_linked_fields(dialog, table_id) {
        const source_field_label = dialog.get_value('source_link_field');
        if (!source_field_label) return;
        
        console.log("Loading linked fields for source field label:", source_field_label);
        
        // Find the fieldname from stored data using the label
        const link_fields_data = dialog._link_fields_data;
        if (!link_fields_data) {
            console.log("No link fields data stored");
            return;
        }
        
        const link_field = link_fields_data.find(f => f.label === source_field_label);
        if (!link_field) {
            console.log("Link field not found for label:", source_field_label);
            console.log("Available link fields:", link_fields_data);
            dialog.set_df_property('target_field', 'options', '');
            frappe.show_alert({
                message: 'Selected link field not found',
                indicator: 'red'
            });
            return;
        }
        
        console.log("Found link field:", link_field);
        
        // Load fields from linked table
        frappe.call({
            method: 'flansa.logic_templates.get_linked_table_fields',
            args: { linked_doctype: link_field.options },
            callback: (r) => {
                console.log("Linked table fields response:", r);
                if (r.message && r.message.success) {
                    const fields = r.message.fields;
                    if (fields && fields.length > 0) {
                        // Store target fields data for later lookup
                        dialog._target_fields_data = fields;
                        // Show only labels to user
                        const options = fields.map(f => f.label).join('\n');
                        dialog.set_df_property('target_field', 'options', options);
                        console.log("Target field options set (labels only):", options);
                    } else {
                        dialog.set_df_property('target_field', 'options', '');
                        dialog._target_fields_data = [];
                        frappe.show_alert({
                            message: 'No suitable fields found in linked table',
                            indicator: 'orange'
                        });
                    }
                } else {
                    dialog.set_df_property('target_field', 'options', '');
                    dialog._target_fields_data = [];
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: 'Failed to load fields from linked table'
                    });
                }
            }
        });
    }
    
    create_fetch_field(table_id, values, dialog) {
        // Get fieldnames from stored data using the labels
        const source_field_label = values.source_link_field;
        const target_field_label = values.target_field;
        
        // Find actual fieldnames from stored data
        const link_fields_data = dialog._link_fields_data || [];
        const target_fields_data = dialog._target_fields_data || [];
        
        const source_field_data = link_fields_data.find(f => f.label === source_field_label);
        const target_field_data = target_fields_data.find(f => f.label === target_field_label);
        
        if (!source_field_data) {
            frappe.msgprint({
                title: 'Error',
                indicator: 'red',
                message: 'Source link field not found. Please reselect.'
            });
            return;
        }
        
        if (!target_field_data) {
            frappe.msgprint({
                title: 'Error',
                indicator: 'red',
                message: 'Target field not found. Please reselect.'
            });
            return;
        }
        
        const actual_source_field = source_field_data.fieldname;
        const actual_target_field = target_field_data.fieldname;
        
        console.log("Creating fetch field with values:", values);
        console.log("Source field label:", source_field_label, "→ fieldname:", actual_source_field);
        console.log("Target field label:", target_field_label, "→ fieldname:", actual_target_field);
        
        // Update the values with the actual fieldnames
        const template_data = {
            ...values,
            source_link_field: actual_source_field,
            target_field: actual_target_field
        };
        
        frappe.call({
            method: 'flansa.logic_templates.create_field_from_template',
            args: {
                table_name: table_id,
                template_id: 'fetch',
                template_data: template_data
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `Fetch field "${values.field_label}" created successfully!`,
                        indicator: 'green'
                    });
                    dialog.hide();
                    this.load_table_fields(table_id);
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: r.message?.error || 'Failed to create fetch field'
                    });
                }
            }
        });
    }

    // Roll-up Field Wizard (TODO: Implement full wizard)
    show_rollup_wizard(table_id) {
        console.log("Rollup wizard - using fallback for now");
        frappe.msgprint("Roll-up Field wizard coming soon! Using basic field dialog for now.");
        this.show_unified_field_dialog(table_id);
    }

    // Formula Field Wizard (TODO: Implement full wizard)
    show_formula_wizard(table_id) {
        console.log("Formula wizard - using fallback for now");
        frappe.msgprint("Formula Field wizard coming soon! Using basic field dialog for now.");
        this.show_unified_field_dialog(table_id);
    }

    // Unified field dialog for add/edit with formula support
    show_unified_field_dialog(table_id, field = null, template_hint = null) {
        const is_edit_mode = !!field;
        const dialog_title = is_edit_mode ? `Edit Field: ${field.field_name}` : 'Add New Field';
        
        // Check if it's a Logic Field for editing
        let is_logic_field = false;
        let logic_field_template = null;
        
        if (is_edit_mode) {
            // Check if this field has a corresponding Logic Field record
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Flansa Logic Field',
                    filters: {
                        table_name: table_id || this.current_table,
                        field_name: field.field_name
                    },
                    fieldname: ['expression', 'result_type', 'label']
                },
                async: false,
                callback: (r) => {
                    if (r.message && r.message.expression) {
                        is_logic_field = true;
                        field.formula = r.message.expression;
                        field.expression = r.message.expression;
                        field.result_type = r.message.result_type;
                        field.logic_label = r.message.label;
                        
                        // Determine template type based on field name and expression
                        if (field.field_name.includes('logic_link_field')) {
                            logic_field_template = 'link';
                        } else if (field.field_name.includes('logic_fetch') || field.field_name.includes('logic_auto_fill') || field.expression.includes('FETCH(')) {
                            logic_field_template = 'fetch';
                        } else if (field.expression && field.expression.includes('ROLLUP')) {
                            logic_field_template = 'rollup';
                        } else if (field.expression) {
                            logic_field_template = 'formula';
                        }
                    }
                }
            });
        }
        
        // If this is a Logic Field in edit mode, show the appropriate template wizard
        if (is_edit_mode && is_logic_field && logic_field_template) {
            this.show_logic_field_edit_wizard(table_id, field, logic_field_template);
            return;
        }
        
        const dialog = new frappe.ui.Dialog({
            title: dialog_title,
            fields: [
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: is_edit_mode ? field.field_label : '',
                    description: 'Display name for users',
                    change: () => {
                        if (!is_edit_mode) {
                            // Auto-generate field name from label for new fields
                            const label = dialog.get_value('field_label');
                            if (label) {
                                const normalized_name = this.normalize_field_name(label);
                                const current_field_name = dialog.get_value('field_name');
                                if (!current_field_name || current_field_name === this.last_auto_generated_name) {
                                    dialog.set_value('field_name', normalized_name);
                                    this.last_auto_generated_name = normalized_name;
                                }
                            }
                        }
                    }
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: is_edit_mode ? field.field_name : '',
                    read_only: is_edit_mode ? 1 : 0,
                    description: is_edit_mode ? 'Field name cannot be changed after creation' : 'Internal name (lowercase, underscores only)'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Type',
                    fieldname: 'field_type',
                    fieldtype: 'Select',
                    options: 'Data\nText\nInt\nFloat\nCurrency\nDate\nDatetime\nTime\nCheck\nSelect\nLink\nText Editor\nAttach',
                    default: is_edit_mode ? field.field_type : 'Data',
                    reqd: 1
                },
                {
                    label: 'Options',
                    fieldname: 'options',
                    fieldtype: 'Small Text',
                    default: is_edit_mode ? (field.options || '') : '',
                    description: 'For Select: Option1\\nOption2\\nOption3',
                    depends_on: 'eval:doc.field_type === "Select"'
                },
                {
                    label: 'Link Target',
                    fieldname: 'options',
                    fieldtype: 'Data',
                    default: is_edit_mode ? (field.options || '') : '',
                    description: 'DocType to link to (e.g., Customer, Item)',
                    depends_on: 'eval:doc.field_type === "Link"'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Formula (Optional)'
                },
                {
                    label: 'Formula',
                    fieldname: 'formula',
                    fieldtype: 'Code',
                    default: is_edit_mode && is_logic_field ? field.formula : '',
                    description: 'Add formula to make this a calculated field (e.g., price * quantity)',
                    language: 'javascript'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Properties'
                },
                {
                    label: 'Required',
                    fieldname: 'reqd',
                    fieldtype: 'Check',
                    default: is_edit_mode ? (field.is_required || 0) : 0
                },
                {
                    label: 'Read Only',
                    fieldname: 'read_only',
                    fieldtype: 'Check',
                    default: is_edit_mode ? (field.read_only || 0) : 0,
                    description: 'Calculated fields are automatically read-only'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Hidden',
                    fieldname: 'hidden',
                    fieldtype: 'Check',
                    default: is_edit_mode ? (field.hidden || 0) : 0
                },
                {
                    label: 'In List View',
                    fieldname: 'in_list_view',
                    fieldtype: 'Check',
                    default: is_edit_mode ? (field.in_list_view || 0) : 0
                }
            ],
            primary_action_label: is_edit_mode ? 'Update Field' : 'Create Field',
            primary_action: (values) => {
                this.handle_unified_field_action(table_id, values, is_edit_mode, field);
            }
        });
        
        dialog.show();
        
        // Set up formula field visibility based on read-only
        setTimeout(() => {
            const formula_field = dialog.get_field('formula');
            const read_only_field = dialog.get_field('read_only');
            
            if (formula_field && read_only_field) {
                read_only_field.$input.on('change', () => {
                    const formula_value = dialog.get_value('formula');
                    if (formula_value && formula_value.trim()) {
                        // If there's a formula, force read_only to be true
                        dialog.set_value('read_only', 1);
                    }
                });
                
                formula_field.df.change = () => {
                    const formula_value = dialog.get_value('formula');
                    if (formula_value && formula_value.trim()) {
                        dialog.set_value('read_only', 1);
                    }
                };
            }
        }, 100);
    }

    // Handle unified field dialog action (create or update)
    handle_unified_field_action(table_id, values, is_edit_mode, existing_field) {
        const has_formula = values.formula && values.formula.trim();
        
        // Prepare field configuration
        const field_config = {
            field_name: values.field_name,
            field_label: values.field_label,
            field_type: values.field_type,
            options: values.options || '',
            required: values.reqd || 0,
            read_only: values.read_only || (has_formula ? 1 : 0), // Force read-only for calculated fields
            hidden: values.hidden || 0,
            in_list_view: values.in_list_view || 0
        };
        
        // Add formula if provided
        if (has_formula) {
            field_config.formula = values.formula;
        }
        
        if (is_edit_mode) {
            // Handle edit - check if we need to update formula
            if (has_formula) {
                // This is a calculated field - use formula editing
                frappe.call({
                    method: 'flansa.native_fields.edit_field_formula',
                    args: {
                        table_name: table_id || this.current_table,
                        field_name: values.field_name,
                        new_formula: values.formula
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: 'Formula updated successfully',
                                indicator: 'green'
                            });
                            this.load_table_data(table_id);
                        } else {
                            frappe.show_alert({
                                message: r.message?.error || 'Failed to update formula',
                                indicator: 'red'
                            });
                        }
                    }
                });
            } else {
                // Regular field update - would need a separate API for field property updates
                frappe.show_alert({
                    message: 'Field property updates not yet implemented',
                    indicator: 'orange'
                });
            }
        } else {
            // Handle create - use unified field creation
            frappe.call({
                method: 'flansa.native_fields.add_basic_field_native',
                args: {
                    table_name: table_id || this.current_table,
                    field_config: field_config
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        const message = r.message.is_calculated ? 
                            `Calculated field '${values.field_label}' created successfully` :
                            `Field '${values.field_label}' created successfully`;
                        
                        frappe.show_alert({
                            message: message,
                            indicator: 'green'
                        });
                        
                        this.load_table_data(table_id);
                    } else {
                        frappe.show_alert({
                            message: r.message?.error || 'Failed to create field',
                            indicator: 'red'
                        });
                    }
                }
            });
        }
    }

    // Lookup Field Wizard
    show_lookup_wizard(table_id) {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Lookup Field - Step by Step',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                            <h5><i class="fa fa-external-link text-info"></i> Lookup Field Wizard</h5>
                            <p class="text-muted">This will help you create a field that gets data from another table.<br>
                            <strong>Example:</strong> Get customer name when you select a customer ID.</p>
                        </div>
                    `
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Step 1: Basic Field Information'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name for your lookup field (e.g., customer_name)'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display name users will see (e.g., Customer Name)',
                    change: () => {
                        const label = dialog.get_value('field_label');
                        if (label && !dialog.get_value('field_name')) {
                            const normalized = label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
                            dialog.set_value('field_name', normalized);
                        }
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Step 2: Source Configuration'
                },
                {
                    label: 'Source Field',
                    fieldname: 'source_field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Which field in this table contains the reference?',
                    options: []  // Will be populated
                },
                {
                    label: 'Target Table',
                    fieldname: 'target_table',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Which table should we lookup data from?',
                    options: [],  // Will be populated
                    change: () => {
                        const target_table = dialog.get_value('target_table');
                        if (target_table) {
                            this.load_target_fields_for_lookup(target_table, dialog);
                        }
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Step 3: Target Field Selection'
                },
                {
                    label: 'Target Field',
                    fieldname: 'target_field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Which field from the target table do you want to display?',
                    options: []  // Will be populated
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Preview'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview_html',
                    options: '<div id="lookup-preview">Configure the fields above to see preview</div>'
                }
            ],
            primary_action_label: 'Create Lookup Field',
            primary_action: (values) => {
                this.create_lookup_field(table_id, values, dialog);
            },
            secondary_action_label: 'Back to Templates',
            secondary_action: () => {
                dialog.hide();
                this.show_template_selection_dialog(table_id);
            }
        });
        
        dialog.show();
        
        // Load wizard data
        this.load_lookup_wizard_data(table_id, dialog);
        
        // Set up preview updates
        setTimeout(() => {
            ['source_field', 'target_table', 'target_field'].forEach(fieldname => {
                const field = dialog.get_field(fieldname);
                if (field) {
                    field.$input.on('change', () => {
                        this.update_lookup_preview(dialog);
                    });
                }
            });
        }, 100);
    }

    // Load data for lookup wizard
    load_lookup_wizard_data(table_id, dialog) {
        frappe.call({
            method: 'flansa.logic_templates.get_lookup_wizard_data',
            args: { table_name: table_id },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const data = r.message;
                    
                    // Populate source fields
                    const source_field = dialog.get_field('source_field');
                    if (source_field) {
                        const source_options = data.source_fields.map(f => ({
                            label: `${f.label} (${f.fieldname})`,
                            value: f.fieldname
                        }));
                        source_field.df.options = source_options;
                        source_field.refresh();
                    }
                    
                    // Populate target tables
                    const target_table_field = dialog.get_field('target_table');
                    if (target_table_field) {
                        const table_options = data.target_tables.map(t => ({
                            label: t.label,
                            value: t.value
                        }));
                        target_table_field.df.options = table_options;
                        target_table_field.refresh();
                    }
                    
                } else {
                    frappe.show_alert({
                        message: 'Could not load lookup wizard data',
                        indicator: 'red'
                    });
                }
            }
        });
    }

    // Load target fields when target table changes
    load_target_fields_for_lookup(target_table, dialog) {
        frappe.call({
            method: 'flansa.logic_templates.get_target_table_fields',
            args: { target_doctype: target_table },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const target_field = dialog.get_field('target_field');
                    if (target_field) {
                        const field_options = r.message.fields.map(f => ({
                            label: `${f.label} (${f.fieldname})`,
                            value: f.fieldname
                        }));
                        target_field.df.options = field_options;
                        target_field.refresh();
                    }
                    
                    this.update_lookup_preview(dialog);
                }
            }
        });
    }

    // Update lookup preview
    update_lookup_preview(dialog) {
        const source_field = dialog.get_value('source_field');
        const target_table = dialog.get_value('target_table');
        const target_field = dialog.get_value('target_field');
        
        let preview_html = '<div id="lookup-preview">';
        
        if (source_field && target_table && target_field) {
            const formula = `LOOKUP(${target_table}, ${source_field}, ${target_field})`;
            
            preview_html += `
                <div style="background: #e8f5e8; border: 1px solid #d4edda; padding: 15px; border-radius: 6px;">
                    <h6><i class="fa fa-check-circle text-success"></i> Preview</h6>
                    <p><strong>Formula that will be created:</strong></p>
                    <code style="background: white; padding: 5px; border-radius: 3px;">${formula}</code>
                    <p class="text-muted" style="margin-top: 10px;">
                        <strong>How it works:</strong> When a user selects a value in "${source_field}", 
                        this field will automatically show the "${target_field}" from the "${target_table}" table.
                    </p>
                </div>
            `;
        } else {
            preview_html += `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px;">
                    <i class="fa fa-info-circle text-warning"></i> 
                    Complete all fields above to see the lookup preview
                </div>
            `;
        }
        
        preview_html += '</div>';
        $('#lookup-preview').html(preview_html);
    }

    // Create lookup field from wizard data
    create_lookup_field(table_id, values, dialog) {
        const template_data = {
            field_name: values.field_name,
            field_label: values.field_label,
            source_field: values.source_field,
            target_table: values.target_table,
            target_field: values.target_field
        };
        
        frappe.call({
            method: 'flansa.logic_templates.create_field_from_template',
            args: {
                table_name: table_id,
                template_id: 'lookup',
                template_data: template_data
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    dialog.hide();
                    frappe.show_alert({
                        message: `Lookup field "${values.field_label}" created successfully!`,
                        indicator: 'green'
                    });
                    this.load_table_data(table_id);
                } else {
                    frappe.show_alert({
                        message: r.message?.error || 'Failed to create lookup field',
                        indicator: 'red'
                    });
                }
            }
        });
    }

    // Summary Field Wizard
    show_summary_wizard(table_id) {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Summary Field - Step by Step',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                            <h5><i class="fa fa-calculator text-warning"></i> Summary Field Wizard</h5>
                            <p class="text-muted">This will help you create a field that calculates totals from child tables.<br>
                            <strong>Example:</strong> Calculate total amount from all invoice items.</p>
                        </div>
                    `
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Step 1: Basic Field Information'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name for your summary field (e.g., total_amount)'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display name users will see (e.g., Total Amount)',
                    change: () => {
                        const label = dialog.get_value('field_label');
                        if (label && !dialog.get_value('field_name')) {
                            const normalized = label.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
                            dialog.set_value('field_name', normalized);
                        }
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Step 2: Child Table & Operation'
                },
                {
                    label: 'Child Table',
                    fieldname: 'child_table',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Which child table contains the data to summarize?',
                    options: [],  // Will be populated
                    change: () => {
                        const child_table = dialog.get_value('child_table');
                        if (child_table) {
                            this.load_child_table_fields_for_summary(child_table, dialog);
                        }
                    }
                },
                {
                    label: 'Operation',
                    fieldname: 'operation_type',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'How do you want to calculate the summary?',
                    options: [
                        { label: 'Sum - Add all values', value: 'SUM' },
                        { label: 'Count - Count records', value: 'COUNT' },
                        { label: 'Average - Calculate average', value: 'AVERAGE' },
                        { label: 'Maximum - Find highest value', value: 'MAX' },
                        { label: 'Minimum - Find lowest value', value: 'MIN' }
                    ],
                    change: () => {
                        this.update_summary_preview(dialog);
                        this.filter_suitable_fields_for_operation(dialog);
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Step 3: Target Field Selection'
                },
                {
                    label: 'Target Field',
                    fieldname: 'target_field',
                    fieldtype: 'Select',
                    description: 'Which field should be used for the calculation?',
                    options: [],  // Will be populated
                    depends_on: 'eval:doc.operation_type !== "COUNT"'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Preview'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview_html',
                    options: '<div id="summary-preview">Configure the fields above to see preview</div>'
                }
            ],
            primary_action_label: 'Create Summary Field',
            primary_action: (values) => {
                this.create_summary_field(table_id, values, dialog);
            },
            secondary_action_label: 'Back to Templates',
            secondary_action: () => {
                dialog.hide();
                this.show_template_selection_dialog(table_id);
            }
        });
        
        dialog.show();
        
        // Load wizard data
        this.load_summary_wizard_data(table_id, dialog);
        
        // Set up preview updates
        setTimeout(() => {
            ['child_table', 'operation_type', 'target_field'].forEach(fieldname => {
                const field = dialog.get_field(fieldname);
                if (field) {
                    field.$input.on('change', () => {
                        this.update_summary_preview(dialog);
                    });
                }
            });
        }, 100);
    }

    // Load data for summary wizard
    load_summary_wizard_data(table_id, dialog) {
        frappe.call({
            method: 'flansa.logic_templates.get_summary_wizard_data',
            args: { table_name: table_id },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const data = r.message;
                    
                    // Populate child tables
                    const child_table_field = dialog.get_field('child_table');
                    if (child_table_field) {
                        const table_options = data.child_tables.map(t => ({
                            label: `${t.label} (${t.fieldname})`,
                            value: t.options  // Child DocType name
                        }));
                        child_table_field.df.options = table_options;
                        child_table_field.refresh();
                    }
                    
                } else {
                    frappe.show_alert({
                        message: 'Could not load summary wizard data',
                        indicator: 'red'
                    });
                }
            }
        });
    }

    // Load child table fields when child table changes
    load_child_table_fields_for_summary(child_doctype, dialog) {
        frappe.call({
            method: 'flansa.logic_templates.get_child_table_fields',
            args: { child_doctype: child_doctype },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const target_field = dialog.get_field('target_field');
                    if (target_field) {
                        this.all_child_fields = r.message.fields; // Store for filtering
                        const field_options = r.message.fields.map(f => ({
                            label: `${f.label} (${f.fieldname})`,
                            value: f.fieldname,
                            suitable_for: f.suitable_for
                        }));
                        target_field.df.options = field_options;
                        target_field.refresh();
                    }
                    
                    this.filter_suitable_fields_for_operation(dialog);
                    this.update_summary_preview(dialog);
                }
            }
        });
    }

    // Filter fields based on selected operation
    filter_suitable_fields_for_operation(dialog) {
        const operation = dialog.get_value('operation_type');
        const target_field = dialog.get_field('target_field');
        
        if (target_field && this.all_child_fields && operation) {
            // Filter fields suitable for the operation
            const suitable_fields = this.all_child_fields.filter(f => 
                f.suitable_for.includes(operation)
            );
            
            const field_options = suitable_fields.map(f => ({
                label: `${f.label} (${f.fieldname})`,
                value: f.fieldname
            }));
            
            target_field.df.options = field_options;
            target_field.refresh();
            
            // Clear selection if current value is not suitable
            const current_value = dialog.get_value('target_field');
            if (current_value && !suitable_fields.find(f => f.fieldname === current_value)) {
                dialog.set_value('target_field', '');
            }
        }
    }

    // Update summary preview
    update_summary_preview(dialog) {
        const child_table = dialog.get_value('child_table');
        const operation = dialog.get_value('operation_type');
        const target_field = dialog.get_value('target_field');
        
        let preview_html = '<div id="summary-preview">';
        
        if (child_table && operation) {
            let formula;
            if (operation === 'COUNT') {
                formula = `COUNT(${child_table})`;
            } else if (target_field) {
                formula = `${operation}(${child_table}, ${target_field})`;
            } else {
                preview_html += `
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px;">
                        <i class="fa fa-info-circle text-warning"></i> 
                        Please select a target field for the ${operation} operation
                    </div>
                `;
                preview_html += '</div>';
                $('#summary-preview').html(preview_html);
                return;
            }
            
            preview_html += `
                <div style="background: #e8f5e8; border: 1px solid #d4edda; padding: 15px; border-radius: 6px;">
                    <h6><i class="fa fa-check-circle text-success"></i> Preview</h6>
                    <p><strong>Formula that will be created:</strong></p>
                    <code style="background: white; padding: 5px; border-radius: 3px;">${formula}</code>
                    <p class="text-muted" style="margin-top: 10px;">
                        <strong>How it works:</strong> This field will automatically ${operation.toLowerCase()} 
                        ${target_field ? `the "${target_field}"` : 'records'} from the "${child_table}" child table.
                    </p>
                </div>
            `;
        } else {
            preview_html += `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px;">
                    <i class="fa fa-info-circle text-warning"></i> 
                    Complete the fields above to see the summary preview
                </div>
            `;
        }
        
        preview_html += '</div>';
        $('#summary-preview').html(preview_html);
    }

    // Create summary field from wizard data
    create_summary_field(table_id, values, dialog) {
        const template_data = {
            field_name: values.field_name,
            field_label: values.field_label,
            child_table: values.child_table,
            operation_type: values.operation_type,
            target_field: values.target_field
        };
        
        frappe.call({
            method: 'flansa.logic_templates.create_field_from_template',
            args: {
                table_name: table_id,
                template_id: 'summary',
                template_data: template_data
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    dialog.hide();
                    frappe.show_alert({
                        message: `Summary field "${values.field_label}" created successfully!`,
                        indicator: 'green'
                    });
                    this.load_table_data(table_id);
                } else {
                    frappe.show_alert({
                        message: r.message?.error || 'Failed to create summary field',
                        indicator: 'red'
                    });
                }
            }
        });
    }

    show_edit_field_dialog(table_id, field) {
        const dialog = new frappe.ui.Dialog({
            title: 'Edit Field: ' + field.field_name,
            fields: [
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    default: field.field_name,
                    read_only: 1,
                    description: 'Field name cannot be changed after creation'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    default: field.field_label,
                    reqd: 1,
                    description: 'Display label for this field'
                },
                {
                    label: 'Field Type',
                    fieldname: 'field_type',
                    fieldtype: 'Select',
                    options: 'Data\nText\nLong Text\nInt\nFloat\nCurrency\nDate\nDatetime\nTime\nSelect\nCheck\nLink\nText Editor\nCode\nJSON\nGallery',
                    default: field.field_type,
                    reqd: 1
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Required',
                    fieldname: 'is_required',
                    fieldtype: 'Check',
                    default: field.is_required || 0
                },
                {
                    label: 'Unique',
                    fieldname: 'is_unique',
                    fieldtype: 'Check',
                    default: field.is_unique || 0
                },
                {
                    label: 'Show in List',
                    fieldname: 'in_list_view',
                    fieldtype: 'Check',
                    default: field.in_list_view || 0
                },
                {
                    label: 'Show in Filter',
                    fieldname: 'in_standard_filter',
                    fieldtype: 'Check',
                    default: field.in_standard_filter || 0
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Additional Settings'
                },
                {
                    label: 'Options',
                    fieldname: 'options',
                    fieldtype: 'Small Text',
                    default: field.options,
                    description: 'For Select fields, enter options separated by line breaks'
                },
                {
                    label: 'Default Value',
                    fieldname: 'default_value',
                    fieldtype: 'Data',
                    default: field.default_value,
                    description: 'Default value for new records'
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Small Text',
                    default: field.description,
                    description: 'Help text for this field'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Lookup Field Settings',
                    collapsible: 1
                },
                {
                    label: 'Reference Link Field',
                    fieldname: 'reference_link_field',
                    fieldtype: 'Select',
                    default: field.fetch_from ? field.fetch_from.split('.')[0] : '',
                    description: 'The link field in this table that connects to the parent table',
                    change: function() {
                        // Update fetch_from when reference field changes
                        const reference_field = this.get_value();
                        const target_field = dialog.get_value('target_field');
                        if (reference_field && target_field) {
                            dialog.set_value('fetch_from', `${reference_field}.${target_field}`);
                            dialog.set_value('depends_on', reference_field);
                        }
                    }
                },
                {
                    label: 'Target Field to Fetch',
                    fieldname: 'target_field',
                    fieldtype: 'Select', 
                    default: field.fetch_from ? field.fetch_from.split('.')[1] : '',
                    description: 'The field from the parent table to fetch data from',
                    change: function() {
                        // Update fetch_from when target field changes
                        const reference_field = dialog.get_value('reference_link_field');
                        const target_field = this.get_value();
                        if (reference_field && target_field) {
                            dialog.set_value('fetch_from', `${reference_field}.${target_field}`);
                        }
                    }
                },
                {
                    label: 'Fetch From (Generated)',
                    fieldname: 'fetch_from',
                    fieldtype: 'Data',
                    default: field.fetch_from || '',
                    read_only: 1,
                    description: 'Auto-generated from selections above'
                },
                {
                    label: 'Display Depends On',
                    fieldname: 'depends_on',
                    fieldtype: 'Data',
                    default: field.depends_on || '',
                    read_only: 1,
                    description: 'Auto-set to match the reference link field'
                },
                {
                    label: 'Read Only',
                    fieldname: 'is_readonly',
                    fieldtype: 'Check',
                    default: field.is_readonly || 0,
                    description: 'Make this field read-only (recommended for lookup fields)'
                }
            ],
            primary_action_label: 'Update Field',
            primary_action: (values) => {
                // Update the field using native API
                frappe.call({
                    method: 'flansa.native_fields.update_field_native',
                    args: {
                        table_name: table_id,
                        field_name: field.field_name,
                        field_updates: values
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: '✅ Field updated successfully!',
                                indicator: 'green'
                            });
                            
                            // Show feedback if available
                            if (r.message.feedback) {
                                frappe.show_alert({
                                    message: r.message.feedback.message,
                                    indicator: r.message.feedback.indicator || 'blue'
                                });
                            }
                            
                            dialog.hide();
                            // Set flag to force cache refresh since we added a field
                            this.force_cache_refresh = true;
                            this.load_table_fields(table_id);
                        } else {
                            frappe.msgprint({
                                title: 'Update Failed',
                                message: r.message.error || 'Failed to update field',
                                indicator: 'red'
                            });
                        }
                    }
                });
            }
        });
        
        dialog.show();
        
        // Load field options after dialog is shown
        this.load_field_options_for_dialog(table_id, dialog);
    }
    
    load_field_options_for_dialog(table_id, dialog) {
        console.log('Loading field options for lookup field dialog...');
        
        // Load reference link field options (Link fields in current table)
        this.load_reference_field_options(table_id, dialog);
        
        // Set up event listener for when reference field changes
        setTimeout(() => {
            const reference_field = dialog.get_field('reference_link_field');
            if (reference_field) {
                reference_field.$input.on('change', () => {
                    const selected_reference = reference_field.get_value();
                    if (selected_reference) {
                        this.load_target_field_options(table_id, selected_reference, dialog);
                    }
                });
            }
        }, 100);
    }
    
    load_reference_field_options(table_id, dialog) {
        // Get current table's DocType name
        const current_table = this.tables_data[table_id];
        if (!current_table || !current_table.doctype_name) {
            console.log('No DocType name found for table:', table_id);
            return;
        }
        
        console.log('Loading reference fields for DocType:', current_table.doctype_name);
        
        // Fetch Link fields from current table's DocType
        frappe.call({
            method: 'frappe.desk.form.meta.get_meta',
            args: {
                doctype: current_table.doctype_name
            },
            callback: (r) => {
                if (r.message && r.message.fields) {
                    const link_fields = r.message.fields.filter(f => f.fieldtype === 'Link');
                    
                    console.log('Found link fields:', link_fields.length);
                    
                    if (link_fields.length > 0) {
                        const reference_field = dialog.get_field('reference_link_field');
                        if (reference_field) {
                            const options = link_fields.map(f => ({
                                label: `${f.label || f.fieldname} (${f.options})`,
                                value: f.fieldname
                            }));
                            
                            reference_field.df.options = options;
                            reference_field.refresh();
                            reference_field.set_description(`Select from ${link_fields.length} available link fields`);
                        }
                    } else {
                        const reference_field = dialog.get_field('reference_link_field');
                        if (reference_field) {
                            reference_field.set_description('No link fields found in this table');
                        }
                    }
                } else {
                    console.log('Failed to load DocType meta:', r);
                }
            }
        });
    }
    
    load_target_field_options(table_id, reference_fieldname, dialog) {
        // Get the parent DocType from the reference field's options
        const current_table = this.tables_data[table_id];
        if (!current_table || !current_table.doctype_name) {
            return;
        }
        
        console.log('Loading target fields for reference field:', reference_fieldname);
        
        // First, get the Link field's target DocType
        frappe.call({
            method: 'frappe.desk.form.meta.get_meta',
            args: {
                doctype: current_table.doctype_name
            },
            callback: (r) => {
                if (r.message && r.message.fields) {
                    const link_field = r.message.fields.find(f => f.fieldname === reference_fieldname && f.fieldtype === 'Link');
                    
                    if (link_field && link_field.options) {
                        const parent_doctype = link_field.options;
                        console.log('Loading fields from parent DocType:', parent_doctype);
                        
                        // Now get fields from the parent DocType
                        frappe.call({
                            method: 'frappe.desk.form.meta.get_meta',
                            args: {
                                doctype: parent_doctype
                            },
                            callback: (parent_r) => {
                                if (parent_r.message && parent_r.message.fields) {
                                    const parent_fields = parent_r.message.fields.filter(f => 
                                        !['Section Break', 'Column Break', 'Tab Break', 'HTML'].includes(f.fieldtype)
                                    );
                                    
                                    console.log('Found parent fields:', parent_fields.length);
                                    
                                    if (parent_fields.length > 0) {
                                        const target_field = dialog.get_field('target_field');
                                        if (target_field) {
                                            const options = parent_fields.map(f => ({
                                                label: `${f.label || f.fieldname} (${f.fieldtype})`,
                                                value: f.fieldname
                                            }));
                                            
                                            target_field.df.options = options;
                                            target_field.refresh();
                                            target_field.set_description(`Select from ${parent_fields.length} fields in ${parent_doctype}`);
                                        }
                                    }
                                } else {
                                    console.log('Failed to load parent DocType meta:', parent_r);
                                }
                            }
                        });
                    } else {
                        console.log('Link field not found or has no options:', reference_fieldname);
                    }
                }
            }
        });
    }
    
    delete_field(table_id, field_name) {
        frappe.confirm('Delete field: ' + field_name + '?', () => {
            frappe.call({
                method: 'flansa.native_fields.delete_field_native',
                args: {
                    table_name: table_id,
                    field_name: field_name
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert({
                            message: '✅ ' + r.message.message,
                            indicator: 'green'
                        });
                        if (r.message.details) {
                            console.log('Field operation details:', r.message.details);
                        }
                        // Set flag to force cache refresh since we modified fields
                        this.force_cache_refresh = true;
                        this.load_table_fields(table_id);
                    } else {
                        frappe.msgprint({
                            title: 'Operation Failed',
                            message: r.message.error || 'Failed to delete field',
                            indicator: 'red'
                        });
                    }
                }
            });
        });
    }
    
    show_field_details(table_id, field_name) {
        // Fetch field details using native field management API
        frappe.call({
            method: 'flansa.native_fields.get_table_fields_native',
            args: {
                table_name: table_id
            },
            callback: (r) => {
                if (r.message && r.message.success && r.message.fields) {
                    const field = r.message.fields.find(f => f.fieldname === field_name);
                    if (field) {
                        // Convert native field format to expected format
                        const converted_field = {
                            field_name: field.fieldname,
                            field_label: field.label,
                            field_type: field.fieldtype,
                            options: field.options,
                            is_required: field.reqd,
                            is_readonly: field.read_only,
                            hidden: field.hidden,
                            description: field.description
                        };
                        this.display_field_details_dialog(converted_field, table_id);
                    } else {
                        frappe.show_alert('Field not found', 'red');
                    }
                } else {
                    frappe.show_alert('Failed to fetch field details', 'red');
                }
            }
        });
    }
    
    display_field_details_dialog(field, table_id) {
        const is_lookup = field.field_type === 'Lookup' || (field.fetch_from && field.fetch_from.trim() !== '');
        const is_summary = field.field_type === 'Summary';
        
        let details_html = `
            <div class="field-details-container">
                <div class="field-details-header" style="margin-bottom: 20px; padding: 15px; background: var(--flansa-surface, #f8f9fa); border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0;">
                        ${is_lookup ? '<i class="fa fa-link text-info"></i>' : 
                          is_summary ? '<i class="fa fa-calculator text-warning"></i>' : 
                          is_link ? '<i class="fa fa-external-link text-primary"></i>' : 
                          '<i class="fa fa-columns"></i>'} 
                        ${field.field_label || field.field_name}
                    </h4>
                    <div class="field-meta" style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <span class="badge badge-secondary">Name: ${field.field_name}</span>
                        <span class="badge badge-info">Type: ${field.field_type}</span>
                        ${field.is_required ? '<span class="badge badge-danger">Required</span>' : ''}
                        ${field.is_unique ? '<span class="badge badge-warning">Unique</span>' : ''}
                        ${field.in_list_view ? '<span class="badge badge-success">In List</span>' : ''}
                    </div>
                </div>
                
                <div class="field-details-body">
        `;
        
        if (is_link) {
            details_html += `
                <div class="detail-section">
                    <h5><i class="fa fa-link"></i> Link Details</h5>
                    <table class="table table-sm">
                        <tr>
                            <td><strong>Linked Table:</strong></td>
                            <td>${field.options || 'Not specified'}</td>
                        </tr>
                        <tr>
                            <td><strong>Description:</strong></td>
                            <td>${field.description || 'Creates a reference to another table'}</td>
                        </tr>
                    </table>
                </div>
            `;
        }
        
        if (is_lookup) {
            details_html += `
                <div class="detail-section">
                    <h5><i class="fa fa-search"></i> Lookup Configuration</h5>
                    <table class="table table-sm">
                        <tr>
                            <td><strong>Source Field:</strong></td>
                            <td>${field.lookup_source_field || 'Not configured'}</td>
                        </tr>
                        <tr>
                            <td><strong>Target Field:</strong></td>
                            <td>${field.lookup_target_field || 'Not configured'}</td>
                        </tr>
                        <tr>
                            <td><strong>Related Table:</strong></td>
                            <td>${field.lookup_table || field.options || 'Not configured'}</td>
                        </tr>
                        <tr>
                            <td><strong>Description:</strong></td>
                            <td>This field fetches data from a related table based on a relationship</td>
                        </tr>
                    </table>
                </div>
            `;
        }
        
        if (is_summary) {
            details_html += `
                <div class="detail-section">
                    <h5><i class="fa fa-calculator"></i> Summary Configuration</h5>
                    <table class="table table-sm">
                        <tr>
                            <td><strong>Aggregation Type:</strong></td>
                            <td>${field.summary_type || 'Count'}</td>
                        </tr>
                        <tr>
                            <td><strong>Source Table:</strong></td>
                            <td>${field.summary_table || 'Not configured'}</td>
                        </tr>
                        <tr>
                            <td><strong>Aggregated Field:</strong></td>
                            <td>${field.summary_field || 'All records'}</td>
                        </tr>
                        <tr>
                            <td><strong>Filter Conditions:</strong></td>
                            <td>${field.summary_filter || 'None'}</td>
                        </tr>
                        <tr>
                            <td><strong>Description:</strong></td>
                            <td>This field calculates aggregate values from related records</td>
                        </tr>
                    </table>
                </div>
            `;
        }
        
        // Add general field properties
        details_html += `
                <div class="detail-section">
                    <h5><i class="fa fa-cog"></i> Field Properties</h5>
                    <table class="table table-sm">
                        ${field.default_value ? `
                        <tr>
                            <td><strong>Default Value:</strong></td>
                            <td>${field.default_value}</td>
                        </tr>
                        ` : ''}
                        ${field.description ? `
                        <tr>
                            <td><strong>Description:</strong></td>
                            <td>${field.description}</td>
                        </tr>
                        ` : ''}
                        ${field.options && !is_link ? `
                        <tr>
                            <td><strong>Options:</strong></td>
                            <td><pre style="margin: 0; background: #f5f5f5; padding: 5px; border-radius: 4px;">${field.options}</pre></td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td><strong>Created:</strong></td>
                            <td>${field.creation ? new Date(field.creation).toLocaleDateString() : 'Unknown'}</td>
                        </tr>
                        <tr>
                            <td><strong>Last Modified:</strong></td>
                            <td>${field.modified ? new Date(field.modified).toLocaleDateString() : 'Unknown'}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;
        
        const dialog = new frappe.ui.Dialog({
            title: `📋 Field Details: ${field.field_label || field.field_name}`,
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'details_html',
                    options: details_html
                }
            ],
            primary_action_label: 'Edit Field',
            primary_action: () => {
                dialog.hide();
                this.edit_field(table_id, field.field_name);
            },
            secondary_action_label: 'Close'
        });
        
        dialog.show();
        
        // Add custom styling
        dialog.$wrapper.find('.field-details-container').css({
            'max-height': '60vh',
            'overflow-y': 'auto'
        });
        
        dialog.$wrapper.find('.detail-section').css({
            'margin-bottom': '20px',
            'padding': '15px',
            'background': 'var(--flansa-surface, white)',
            'border': '1px solid var(--flansa-border, #e0e0e0)',
            'border-radius': '8px'
        });
        
        dialog.$wrapper.find('.detail-section h5').css({
            'margin-top': '0',
            'margin-bottom': '15px',
            'color': 'var(--flansa-primary, #4a5568)',
            'font-size': '14px',
            'font-weight': '600'
        });
    }
    
    add_relationship(table_id) {
        // Create dialog for relationship creation
        const dialog = new frappe.ui.Dialog({
            title: 'Create Relationship',
            fields: [
                {
                    label: 'Relationship Name',
                    fieldname: 'relationship_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'e.g., "Products belong to Category"'
                },
                {
                    label: 'Relationship Type',
                    fieldname: 'relationship_type',
                    fieldtype: 'Select',
                    options: 'One to One\nOne to Many\nMany to Many',
                    reqd: 1,
                    default: 'One to Many'
                },
                {
                    fieldtype: 'Section Break'
                },
                {
                    label: 'From Table',
                    fieldname: 'from_table',
                    fieldtype: 'Link',
                    options: 'Flansa Table',
                    default: table_id,
                    read_only: 1
                },
                {
                    label: 'To Table',
                    fieldname: 'to_table',
                    fieldtype: 'Link',
                    options: 'Flansa Table',
                    reqd: 1,
                    get_query: function() {
                        return {
                            filters: {
                                name: ['!=', table_id]
                            }
                        };
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Configuration'
                },
                {
                    label: 'Link Field Name (in From Table)',
                    fieldname: 'from_field',
                    fieldtype: 'Data',
                    description: 'Field name to create in the source table',
                    depends_on: "eval:doc.relationship_type !== 'Many to Many'"
                },
                {
                    label: 'Link Field Name (in To Table)',
                    fieldname: 'to_field',
                    fieldtype: 'Data',
                    description: 'Field name to create in the target table',
                    depends_on: "eval:doc.relationship_type === 'One to One'"
                }
            ],
            primary_action_label: 'Create',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.api.relationship_management.create_relationship',
                    args: {
                        relationship_data: values
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: 'Relationship created successfully!',
                                indicator: 'green'
                            });
                            dialog.hide();
                            // Reload relationships
                            this.load_table_relationships(table_id);
                        } else {
                            frappe.msgprint({
                                title: 'Error',
                                indicator: 'red',
                                message: r.message.error || 'Failed to create relationship'
                            });
                        }
                    }
                });
            }
        });
        
        dialog.show();
    }
    
    edit_relationship(relationship_id) {
        frappe.set_route('Form', 'Flansa Relationship', relationship_id);
    }
    
    // Removed - relationships are managed from the relationship builder page
    /*create_relationship_from_table(table_id) {
        // Navigate directly to relationship builder with this table pre-selected
        const app_name = this.app_name;
        window.location.href = `/app/flansa-relationship-builder?app=${app_name}&from_table=${table_id}`;
    }*/
    
    edit_table(table_id) {
        window.location.href = `/app/Form/Flansa Table/${table_id}`;
    }
    
    create_new_table() {
        // Show quick table creation dialog for better UX
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
                    label: '📝 Optional Details'
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Text',
                    description: 'Optional: Brief description of what this table stores'
                }
            ],
            primary_action_label: '🚀 Create & Add Fields',
            primary_action: (values) => {
                this.create_table_and_start_editing(values, dialog);
            },
            secondary_action_label: '📝 Advanced Form',
            secondary_action: () => {
                dialog.hide();
                frappe.new_doc('Flansa Table', { application: this.app_name });
            }
        });
        
        dialog.show();
        
        // Focus on the first field
        setTimeout(() => {
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
    
    create_table_and_start_editing(values, dialog) {
        // Show loading state
        dialog.set_primary_action('Creating...', null);
        dialog.$wrapper.find('.btn-primary').prop('disabled', true);
        
        const app_name = this.app_name;
        
        // Create the table via API
        frappe.call({
            method: 'flansa.flansa_core.api.workspace_api.create_flansa_table',
            args: {
                app_name: app_name,
                table_data: {
                    table_name: values.table_name,
                    table_label: values.table_label,
                    description: values.description || '',
                    status: 'Draft'
                }
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `✅ Table "${values.table_label}" created successfully!`,
                        indicator: 'green'
                    });
                    
                    dialog.hide();
                    
                    // Immediately switch to single table mode for field editing
                    setTimeout(() => {
                        window.location.href = `/app/flansa-visual-builder?table=${r.message.table_name}`;
                    }, 500);
                } else {
                    frappe.show_alert({
                        message: `❌ ${r.message?.error || 'Failed to create table'}`,
                        indicator: 'red'
                    });
                    
                    // Reset button
                    dialog.set_primary_action('🚀 Create & Add Fields', () => {
                        this.create_table_and_start_editing(values, dialog);
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
                dialog.set_primary_action('🚀 Create & Add Fields', () => {
                    this.create_table_and_start_editing(values, dialog);
                });
                dialog.$wrapper.find('.btn-primary').prop('disabled', false);
            }
        });
    }
    
    view_table_data() {
        // Try to determine the table ID from various sources
        let table_id = this.single_table_id;
        
        // Debug logging
        console.log('view_table_data - single_table_id:', this.single_table_id);
        console.log('view_table_data - resolved table_id:', table_id);
        
        if (!table_id) {
            frappe.msgprint('No table selected or available');
            return;
        }
        
        // Get table info to find the DocType name
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Table',
                name: table_id
            },
            callback: (r) => {
                if (r.message && r.message.doctype_name) {
                    const doctype_name = r.message.doctype_name;
                    
                    // Check if DocType exists using proper API
                    frappe.call({
                        method: 'frappe.client.get_list',
                        args: {
                            doctype: 'DocType',
                            filters: { name: doctype_name }
                        },
                        callback: function(check_result) {
                            const exists = check_result.message && check_result.message.length > 0;
                        if (exists) {
                            // Open the Flansa Report Viewer for this table with explicit type parameter
                            window.open(`/app/flansa-report-viewer/${table_id}?type=table`, '_blank');
                        } else {
                            frappe.msgprint({
                                title: 'DocType Not Found',
                                message: `The DocType "${doctype_name}" doesn't exist yet. Please add fields to this table first to generate the DocType.`,
                                indicator: 'orange'
                            });
                        }
                        }
                    });
                } else {
                    // Offer to generate DocType automatically
                    frappe.confirm(
                        'This table doesn\'t have a generated DocType yet. Would you like to generate it now?',
                        () => {
                            // Generate DocType automatically
                            frappe.call({
                                method: 'flansa.flansa_core.doctype.flansa_table.flansa_table.generate_doctype_now',
                                args: { table_name: window.current_table_name },
                                callback: (r) => {
                                    if (r.message && r.message.success) {
                                        frappe.show_alert('✅ DocType generated successfully!', 'green');
                                        // Retry the original action after a short delay
                                        setTimeout(() => {
                                            window.location.reload();
                                        }, 1000);
                                    } else {
                                        frappe.show_alert('❌ Failed to generate DocType: ' + (r.message?.error || 'Unknown error'), 'red');
                                    }
                                }
                            });
                        },
                        () => {
                            frappe.msgprint({
                                title: 'DocType Required',
                                message: 'You can also go to the Table form and use "Force Generate DocType" to create it manually.',
                                indicator: 'blue'
                            });
                        },
                        'Generate DocType',
                        'Cancel'
                    );
                }
            }
        });
    }
    
    open_doctype_settings() {
        if (!this.single_table_id) {
            frappe.msgprint('No table selected');
            return;
        }
        
        // Get table info to find the DocType name
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Table',
                name: this.single_table_id
            },
            callback: (r) => {
                if (r.message && r.message.doctype_name) {
                    const doctype_name = r.message.doctype_name;
                    
                    // Check if DocType exists using proper API
                    frappe.call({
                        method: 'frappe.client.get_list',
                        args: {
                            doctype: 'DocType',
                            filters: { name: doctype_name }
                        },
                        callback: function(check_result) {
                            const exists = check_result.message && check_result.message.length > 0;
                        if (exists) {
                            // Open the DocType form for settings
                            frappe.set_route('Form', 'DocType', doctype_name);
                        } else {
                            frappe.msgprint({
                                title: 'DocType Not Found',
                                message: `The DocType "${doctype_name}" doesn't exist yet. Please add fields to this table first to generate the DocType.`,
                                indicator: 'orange'
                            });
                        }
                        }
                    });
                } else {
                    // Offer to generate DocType automatically
                    frappe.confirm(
                        'This table doesn\'t have a generated DocType yet. Would you like to generate it now?',
                        () => {
                            // Generate DocType automatically
                            frappe.call({
                                method: 'flansa.flansa_core.doctype.flansa_table.flansa_table.generate_doctype_now',
                                args: { table_name: window.current_table_name },
                                callback: (r) => {
                                    if (r.message && r.message.success) {
                                        frappe.show_alert('✅ DocType generated successfully!', 'green');
                                        // Retry the original action after a short delay
                                        setTimeout(() => {
                                            window.location.reload();
                                        }, 1000);
                                    } else {
                                        frappe.show_alert('❌ Failed to generate DocType: ' + (r.message?.error || 'Unknown error'), 'red');
                                    }
                                }
                            });
                        },
                        () => {
                            frappe.msgprint({
                                title: 'DocType Required',
                                message: 'You can also go to the Table form and use "Force Generate DocType" to create it manually.',
                                indicator: 'blue'
                            });
                        },
                        'Generate DocType',
                        'Cancel'
                    );
                }
            }
        });
    }
    
    open_report_builder() {
        // Try to determine the table ID from various sources
        let table_id = this.single_table_id;
        
        if (!table_id) {
            frappe.msgprint('No table selected or available');
            return;
        }
        
        // Open Report Builder page with current table pre-selected
        // Use URL hash parameters for proper navigation
        window.location.href = `/app/flansa-report-builder?table=${table_id}`;
        frappe.show_alert(`Opening Report Builder for ${table_id}...`, 'blue');
    }
    
    open_form_builder() {
        // Try to determine the table ID from various sources
        let table_id = this.single_table_id;
        
        if (!table_id) {
            frappe.msgprint('No table selected or available');
            return;
        }
        
        // Open Form Builder page with current table pre-selected
        window.location.href = `/app/flansa-form-builder?table=${table_id}`;
        frappe.show_alert(`Opening Form Builder for ${table_id}...`, 'blue');
    }
    
    open_app_dashboard() {
        if (!this.app_name) {
            frappe.msgprint('No application context available');
            return;
        }
        
        // Navigate to App Dashboard with the current application
        window.location.href = `/app/flansa-app-dashboard?app=${this.app_name}`;
        frappe.show_alert(`Opening App Dashboard for ${this.app_name}...`, 'blue');
    }
    
    delete_current_table() {
        if (!this.single_table_id) {
            frappe.msgprint('No table selected for deletion');
            return;
        }
        
        // Use the new safe deletion method
        frappe.db.get_doc('Flansa Table', this.single_table_id).then(doc => {
            frappe.call({
                method: 'delete_with_doctype',
                doc: doc,
                callback: (r) => {
                    if (r.message && r.message.success) {
                        if (r.message.confirmation_required) {
                            // Show detailed confirmation dialog
                            frappe.confirm(
                                r.message.message,
                                () => {
                                    // User confirmed, proceed with deletion
                                    frappe.call({
                                        method: 'frappe.client.delete',
                                        args: {
                                            doctype: 'Flansa Table',
                                            name: this.single_table_id
                                        },
                                        callback: (delete_result) => {
                                            if (delete_result.message) {
                                                frappe.show_alert('✅ Table and DocType deleted successfully', 'green');
                                                // Redirect to app dashboard
                                                setTimeout(() => {
                                                    if (this.single_app_name) {
                                                        frappe.set_route('flansa-app-dashboard', this.single_app_name);
                                                    } else {
                                                        // Fallback to app list if no app name available
                                                        frappe.set_route('flansa-workspace');
                                                    }
                                                }, 1500);
                                            }
                                        }
                                    });
                                },
                                () => {
                                    // User cancelled deletion
                                    frappe.show_alert('Deletion cancelled', 'blue');
                                },
                                'Delete Everything',
                                'Cancel'
                            );
                        } else {
                            // No confirmation required, proceed directly
                            frappe.call({
                                method: 'frappe.client.delete',
                                args: {
                                    doctype: 'Flansa Table',
                                    name: this.single_table_id
                                },
                                callback: (delete_result) => {
                                    frappe.show_alert('✅ Table deleted successfully', 'green');
                                    setTimeout(() => {
                                        if (this.single_app_name) {
                                            frappe.set_route('flansa-app-dashboard', this.single_app_name);
                                        } else {
                                            // Fallback to app list if no app name available
                                            frappe.set_route('flansa-workspace');
                                        }
                                    }, 1500);
                                }
                            });
                        }
                    } else {
                        frappe.msgprint('Error checking deletion requirements');
                    }
                }
            });
        }).catch(err => {
            frappe.msgprint('Error loading table: ' + err.message);
        });
    }
    
    duplicate_current_table() {
        if (!this.single_table_id) {
            frappe.msgprint('No table selected for duplication');
            return;
        }
        
        // Get current table info
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Table',
                name: this.single_table_id
            },
            callback: (r) => {
                if (r.message) {
                    const sourceTable = r.message;
                    this.show_duplicate_dialog(sourceTable);
                } else {
                    frappe.msgprint('Could not load table information');
                }
            }
        });
    }
    
    show_duplicate_dialog(sourceTable) {
        const dialog = new frappe.ui.Dialog({
            title: `📋 Duplicate "${sourceTable.table_label}"`,
            size: 'large',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: '✨ Duplicate Table Settings',
                    description: 'Create a copy of this table with all fields and structure'
                },
                {
                    label: 'New Table Label',
                    fieldname: 'new_table_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: `${sourceTable.table_label} (Copy)`,
                    description: 'Display name for the duplicated table',
                    change: () => {
                        // Auto-populate table name based on label
                        const label = dialog.get_value('new_table_label');
                        if (label) {
                            const tableName = this.generate_table_name(label);
                            dialog.set_value('new_table_name', tableName);
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'New Table Name',
                    fieldname: 'new_table_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Technical name (auto-generated, can be edited)'
                },
                {
                    fieldtype: 'Section Break',
                    label: '📋 What to Copy'
                },
                {
                    label: 'Copy Fields',
                    fieldname: 'copy_fields',
                    fieldtype: 'Check',
                    default: 1,
                    description: 'Copy all field definitions from the source table'
                },
                {
                    label: 'Copy Data',
                    fieldname: 'copy_data',
                    fieldtype: 'Check',
                    default: 0,
                    description: 'Copy existing data records (if any)'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'New Description',
                    fieldname: 'new_description',
                    fieldtype: 'Text',
                    default: `Copy of ${sourceTable.table_label}`,
                    description: 'Optional description for the new table'
                }
            ],
            primary_action_label: '📋 Duplicate Table',
            primary_action: (values) => {
                this.perform_table_duplication(sourceTable, values, dialog);
            }
        });
        
        dialog.show();
        
        // Auto-populate the table name
        setTimeout(() => {
            const label = dialog.get_value('new_table_label');
            if (label) {
                const tableName = this.generate_table_name(label);
                dialog.set_value('new_table_name', tableName);
            }
        }, 100);
    }
    
    perform_table_duplication(sourceTable, values, dialog) {
        // Show loading state
        dialog.set_primary_action('Duplicating...', null);
        dialog.$wrapper.find('.btn-primary').prop('disabled', true);
        
        const app_name = this.app_name || sourceTable.application;
        
        // First create the new table
        frappe.call({
            method: 'flansa.flansa_core.api.workspace_api.create_flansa_table',
            args: {
                app_name: app_name,
                table_data: {
                    table_name: values.new_table_name,
                    table_label: values.new_table_label,
                    description: values.new_description || '',
                    status: 'Draft'
                }
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const newTableId = r.message.table_name;
                    
                    if (values.copy_fields) {
                        // Copy fields if requested
                        this.copy_table_fields(sourceTable.name, newTableId, values.copy_data, dialog);
                    } else {
                        // Just show success and navigate
                        this.handle_duplication_success(newTableId, values.new_table_label, dialog);
                    }
                } else {
                    frappe.show_alert({
                        message: `❌ ${r.message?.error || 'Failed to create duplicate table'}`,
                        indicator: 'red'
                    });
                    
                    // Reset button
                    dialog.set_primary_action('📋 Duplicate Table', () => {
                        this.perform_table_duplication(sourceTable, values, dialog);
                    });
                    dialog.$wrapper.find('.btn-primary').prop('disabled', false);
                }
            }
        });
    }
    
    copy_table_fields(sourceTableId, targetTableId, copyData, dialog) {
        // Get source table fields
        frappe.call({
            method: 'flansa.flansa_core.api.field_management.get_table_fields',
            args: {
                table_name: sourceTableId
            },
            callback: (r) => {
                if (r.message && r.message.success && r.message.fields) {
                    // Copy fields to new table
                    frappe.call({
                        method: 'flansa.flansa_core.api.field_management.save_table_fields_seamless',
                        args: {
                            table_name: targetTableId,
                            fields_data: r.message.fields
                        },
                        callback: (result) => {
                            if (result.message && result.message.success) {
                                this.handle_duplication_success(targetTableId, dialog.get_value('new_table_label'), dialog);
                            } else {
                                frappe.show_alert({
                                    message: '⚠️ Table created but failed to copy fields',
                                    indicator: 'orange'
                                });
                                dialog.hide();
                            }
                        }
                    });
                } else {
                    frappe.show_alert({
                        message: '⚠️ Table created but no fields found to copy',
                        indicator: 'orange'
                    });
                    this.handle_duplication_success(targetTableId, dialog.get_value('new_table_label'), dialog);
                }
            }
        });
    }
    
    handle_duplication_success(newTableId, newTableLabel, dialog) {
        frappe.show_alert({
            message: `✅ Table "${newTableLabel}" duplicated successfully!`,
            indicator: 'green'
        });
        
        dialog.hide();
        
        // Ask user what to do next
        frappe.confirm(
            'Table duplicated successfully! Would you like to open the new table for editing?',
            () => {
                // Navigate to the new table
                const app_name = this.app_name;
                setTimeout(() => {
                    window.location.href = `/app/flansa-visual-builder?table=${newTableId}`;
                }, 500);
            },
            () => {
                // Stay on current table
                frappe.show_alert('You can find the duplicated table in the application dashboard');
            },
            'Edit New Table',
            'Stay Here'
        );
    }
    
    perform_table_deletion(table_id, table_label) {
        frappe.call({
            method: 'frappe.client.delete',
            args: {
                doctype: 'Flansa Table',
                name: table_id
            },
            callback: (r) => {
                frappe.show_alert({
                    message: `✅ Table "${table_label}" deleted successfully`,
                    indicator: 'green'
                });
                
                // Navigate back to application view
                if (this.app_name) {
                    setTimeout(() => {
                        window.location.href = `/app/flansa-visual-builder?app=${this.app_name}`;
                    }, 1000);
                } else {
                    // Fallback to workspace
                    setTimeout(() => {
                        window.location.href = '/app/flansa-workspace';
                    }, 1000);
                }
            },
            error: () => {
                frappe.show_alert({
                    message: `❌ Failed to delete table "${table_label}"`,
                    indicator: 'red'
                });
            }
        });
    }
    
    get_relationship_icon(type) {
        const icons = {
            'One to One': '<i class="fa fa-exchange text-info"></i>',
            'One to Many': '<i class="fa fa-sitemap text-success"></i>',
            'Many to Many': '<i class="fa fa-random text-warning"></i>'
        };
        return icons[type] || '<i class="fa fa-link"></i>';
    }
    
    view_relationship_details(relationship_name) {
        frappe.call({
            method: 'flansa.flansa_core.api.relationship_management.get_relationship_details',
            args: { relationship_name: relationship_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const rel = r.message.relationship;
                    frappe.msgprint({
                        title: 'Relationship Details',
                        message: `
                            <h5>${rel.relationship_name}</h5>
                            <table class="table table-sm">
                                <tr><td><strong>Type:</strong></td><td>${rel.relationship_type}</td></tr>
                                <tr><td><strong>From Table:</strong></td><td>${rel.from_table.label}</td></tr>
                                <tr><td><strong>To Table:</strong></td><td>${rel.to_table.label}</td></tr>
                                <tr><td><strong>From Field:</strong></td><td>${rel.from_field || 'Auto-generated'}</td></tr>
                                ${rel.to_field ? `<tr><td><strong>To Field:</strong></td><td>${rel.to_field}</td></tr>` : ''}
                                <tr><td><strong>Status:</strong></td><td>${rel.status}</td></tr>
                            </table>
                        `,
                        indicator: 'blue'
                    });
                }
            }
        });
    }
    
    delete_relationship(relationship_name) {
        frappe.confirm('Are you sure you want to delete this relationship?', () => {
            frappe.call({
                method: 'flansa.flansa_core.api.relationship_management.delete_relationship',
                args: { relationship_name: relationship_name },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert({
                            message: 'Relationship deleted successfully',
                            indicator: 'green'
                        });
                        // Reload the current view
                        this.load_data();
                    }
                }
            });
        });
    }
    
    // Additional dropdown menu actions
    duplicate_table(table_id) {
        frappe.msgprint('Duplicate table functionality coming soon!');
    }
    
    export_table(table_id) {
        frappe.msgprint('Export table functionality coming soon!');
    }
    
    delete_table(table_id) {
        frappe.confirm('Are you sure you want to delete this table? This will also delete all its fields and relationships.', () => {
            frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: 'Flansa Table',
                    name: table_id
                },
                callback: (r) => {
                    frappe.show_alert({
                        message: 'Table deleted successfully',
                        indicator: 'green'
                    });
                    // Redirect to app dashboard
                    setTimeout(() => {
                        if (this.single_app_name) {
                            frappe.set_route('flansa-app-dashboard', this.single_app_name);
                        } else {
                            // Fallback to app list if no app name available
                            frappe.set_route('flansa-workspace');
                        }
                    }, 1000);
                }
            });
        });
    }
    
    get_doctype_name_for_table(table_id) {
        // Get DocType name for a table to enable cache clearing
        // This is a simple lookup - in production should cache this info
        let doctype_name = null;
        frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Flansa Table',
                filters: { name: table_id },
                fieldname: 'doctype_name'
            },
            async: false,
            callback: (r) => {
                if (r.message) {
                    doctype_name = r.message.doctype_name;
                }
            }
        });
        return doctype_name;
    }
    
    show_all_relationships() {
        // Show all relationships for this application
        frappe.set_route('List', 'Flansa Relationship', { 'from_table': ['like', '%'] });
    }
    
    open_relationship_builder() {
        if (this.mode === 'application_wide') {
            // Application mode - open relationship builder for the app
            window.location.href = `/app/flansa-relationship-builder?app=${this.app_name}`;
        } else if (this.mode === 'single_table') {
            // Single table mode - need to get the application ID first
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Flansa Table',
                    name: this.single_table_id,
                    fields: ['application']
                },
                callback: (r) => {
                    if (r.message && r.message.application) {
                        window.location.href = `/app/flansa-relationship-builder?app=${r.message.application}`;
                    } else {
                        frappe.msgprint('Could not determine application for this table');
                    }
                }
            });
        }
    }
    
    add_activate_button_if_needed() {
        if (!this.single_table_id) return;
        
        // Check if table needs activation
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Table',
                name: this.single_table_id,
                fields: ['status']
            },
            callback: (r) => {
                if (r.message && r.message.status !== 'Active') {
                    // Add activate button
                    this.page.add_button('⚡ Activate Table', () => {
                        this.activate_current_table();
                    }, 'fa fa-check text-success');
                }
            }
        });
    }
    
    activate_current_table() {
        if (!this.single_table_id) {
            frappe.msgprint('No table selected');
            return;
        }
        
        frappe.call({
            method: 'flansa.flansa_core.api.table_management.activate_table',
            args: { table_name: this.single_table_id },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: '✅ Table activated successfully!',
                        indicator: 'green'
                    });
                    
                    // Refresh the page to update buttons
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                } else {
                    frappe.msgprint({
                        title: 'Activation Failed',
                        message: r.message?.error || 'Failed to activate table',
                        indicator: 'red'
                    });
                }
            }
        });
    }
    
    force_generate_doctype_for_table() {
        if (!this.single_table_id) {
            frappe.msgprint('No table selected');
            return;
        }
        
        frappe.confirm(
            'This will force generate/regenerate the DocType for this table (works even without fields). Continue?',
            () => {
                console.log('Force generating for table:', this.single_table_id);
                
                if (!this.single_table_id) {
                    frappe.msgprint('No table ID found. Please select a table first.');
                    return;
                }
                
                frappe.show_alert('🔄 Generating DocType...', 'blue');
                
                // Get the table document and call regenerate_doctype directly
                frappe.db.get_doc('Flansa Table', this.single_table_id).then(doc => {
                    frappe.call({
                        method: 'regenerate_doctype',
                        doc: doc,
                        callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: '✅ ' + r.message.message,
                                indicator: 'green'
                            });
                            
                            // Refresh the page after a short delay
                            setTimeout(() => {
                                location.reload();
                            }, 1500);
                        } else {
                            frappe.msgprint({
                                title: 'DocType Generation Failed',
                                message: r.message?.message || 'Failed to generate DocType',
                                indicator: 'red'
                            });
                        }
                    },
                    error: (r) => {
                        frappe.msgprint({
                            title: 'Error',
                            message: 'Failed to generate DocType. Please try again.',
                            indicator: 'red'
                        });
                    }
                });
                }).catch(err => {
                    frappe.msgprint('Error loading table document: ' + err.message);
                });
            }
        );
    }

    show_application_dashboard() {
        // Show application dashboard with stats and overview
        frappe.call({
            method: 'flansa.flansa_platform.api.workspace_api.get_application_details',
            args: { app_name: this.app_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const app = r.message.application;
                    const tables = r.message.tables || [];
                    const relationships = r.message.relationships || [];
                    
                    const dashboard_html = `
                        <div class="row">
                            <div class="col-md-12">
                                <h3><i class="fa fa-dashboard"></i> ${app.app_title} Dashboard</h3>
                                <p class="text-muted">${app.description || 'No description provided'}</p>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="alert alert-info text-center">
                                    <h4>${tables.length}</h4>
                                    <p>Tables</p>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="alert alert-success text-center">
                                    <h4>${relationships.length}</h4>
                                    <p>Relationships</p>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="alert alert-warning text-center">
                                    <h4>${app.status || 'Active'}</h4>
                                    <p>Status</p>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <h4>Quick Actions</h4>
                                <div class="btn-group-vertical" style="width: 100%;">
                                    <button class="btn btn-primary" onclick="window.visual_builder.create_new_table()">
                                        <i class="fa fa-plus"></i> Add New Table
                                    </button>
                                    <button class="btn btn-info" onclick="window.visual_builder.show_all_relationships()">
                                        <i class="fa fa-link"></i> View All Relationships
                                    </button>
                                    <button class="btn btn-default" onclick="frappe.set_route('Form', 'Flansa Application', '${this.app_name}')">
                                        <i class="fa fa-cog"></i> Application Settings
                                    </button>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h4>Recent Tables</h4>
                                <div class="list-group">
                                    ${tables.slice(0, 5).map(table => `
                                        <a href="#" class="list-group-item" onclick="window.visual_builder.open_single_table('${table.name}')">
                                            <strong>${table.table_label || table.name}</strong>
                                            <small class="text-muted">${table.fields_count || 0} fields</small>
                                        </a>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                    
                    this.$container.find('.builder-content').html(dashboard_html);
                } else {
                    frappe.msgprint('Failed to load application dashboard');
                }
            }
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
        $(document).on('click', '#quick-nav-reports', (e) => {
            e.preventDefault();
            this.open_report_builder();
        });
        
        $(document).on('click', '#quick-nav-tables', (e) => {
            e.preventDefault();
            this.open_app_dashboard();
        });
        
        $(document).on('click', '#quick-nav-relationships', (e) => {
            e.preventDefault();
            this.open_relationship_builder();
        });
        
        $(document).on('click', '#quick-nav-form-builder', (e) => {
            e.preventDefault();
            this.open_form_builder();
        });
        
        $(document).on('click', '#quick-nav-view-data', (e) => {
            e.preventDefault();
            this.view_table_data();
        });
        
        $(document).on('click', '#quick-nav-app-settings', (e) => {
            e.preventDefault();
            if (this.single_table_id) {
                frappe.set_route('Form', 'Flansa Table', this.single_table_id);
            } else {
                frappe.show_alert('Table information not available', 'orange');
            }
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
                
            case 'export-schema':
                this.export_table_schema();
                break;
                
            case 'keyboard-shortcuts':
                this.show_keyboard_shortcuts();
                break;
                
            default:
                frappe.show_alert('Unknown action: ' + action, 'orange');
        }
    }
    
    export_table_schema() {
        if (!this.single_table_id) {
            frappe.show_alert('No table loaded to export', 'orange');
            return;
        }
        
        try {
            // Get current fields data
            const fields = this.current_fields || [];
            
            const schema = {
                table_id: this.single_table_id,
                table_name: this.single_table_label || this.single_table_id,
                application: this.app_name,
                fields: fields.map(field => ({
                    name: field.field_name,
                    label: field.field_label,
                    type: field.field_type,
                    required: field.is_required,
                    options: field.options,
                    default: field.default_value
                })),
                exported_at: new Date().toISOString()
            };
            
            // Download as JSON
            const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.single_table_label || this.single_table_id}_schema.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            frappe.show_alert('Table schema exported successfully!', 'green');
        } catch (error) {
            console.error('Export error:', error);
            frappe.show_alert('Export failed: ' + error.message, 'red');
        }
    }
    
    show_keyboard_shortcuts() {
        const shortcuts = [
            { key: 'Ctrl/Cmd + S', action: 'Save field changes' },
            { key: 'Ctrl/Cmd + N', action: 'Add new field' },
            { key: 'Del', action: 'Delete selected field' },
            { key: 'Esc', action: 'Close dialogs' },
            { key: 'F5', action: 'Refresh table data' }
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
    
    setup_breadcrumbs() {
        if (this.mode === 'single_table' && this.single_table_id) {
            this.render_breadcrumbs();
            this.update_app_name_indicator();
        }
    }
    
    render_breadcrumbs() {
        const breadcrumbs = [];
        
        // Home breadcrumb
        breadcrumbs.push({ text: "🏠 Workspace", url: "/app/flansa-workspace" });
        
        // App breadcrumb if available
        if (this.app_name) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Flansa Application',
                    filters: { name: this.app_name },
                    fieldname: ['app_title']
                },
                callback: (r) => {
                    const app_title = r.message?.app_title || this.app_name;
                    breadcrumbs.push({ text: `📱 ${app_title}`, url: `/app/flansa-app-dashboard/${this.app_name}` });
                    this.update_breadcrumb_html(breadcrumbs);
                }
            });
        } else {
            this.update_breadcrumb_html(breadcrumbs);
        }
    }
    
    update_breadcrumb_html(breadcrumbs) {
        const breadcrumbHtml = breadcrumbs.map((crumb, index) => {
            const separator = index > 0 ? '<i class="fa fa-chevron-right" style="opacity: 0.5; margin: 0 8px;"></i>' : '';
            return `${separator}<a href="${crumb.url}" style="color: #2d3748; text-decoration: none; font-weight: 600; font-weight: 500;">${crumb.text}</a>`;
        }).join('');
        
        $('#breadcrumb-container').html(breadcrumbHtml);
    }
    
    update_app_name_indicator() {
        if (this.app_name) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Flansa Application',
                    filters: { name: this.app_name },
                    fieldname: ['app_title']
                },
                callback: (r) => {
                    const app_title = r.message?.app_title || this.app_name;
                    // Update the left side of banner with app name
                    $('#app-name-display').text(app_title);
                }
            });
        } else {
            // Reset to Flansa Platform if no app context
            $('#app-name-display').text('Flansa Platform');
        }
    }

    addBackButton() {
        // Try multiple times to ensure the button is added
        let attempts = 0;
        const maxAttempts = 5;
        
        const tryAddButton = () => {
            attempts++;
            
            if (window.FlansaNav && typeof window.FlansaNav.addBackButton === 'function') {
                console.log('Visual Builder: Adding Back button via FlansaNav service');
                window.FlansaNav.addBackButton(this.page);
                return;
            }
            
            if (this.page && typeof this.page.add_button === 'function') {
                console.log('Visual Builder: Adding Back button directly');
                this.page.add_button('← Back', () => {
                    window.history.back();
                }, 'btn-default');
                return;
            }
            
            if (attempts < maxAttempts) {
                console.log(`Visual Builder: Retry adding Back button (attempt ${attempts})`);
                setTimeout(tryAddButton, 200);
            } else {
                console.warn('Visual Builder: Failed to add Back button after', maxAttempts, 'attempts');
            }
        };
        
        tryAddButton();
    }

    // ====== FLANSALOGIC INTEGRATION ======
    
    add_logic_field_button() {
        /**Add Logic Field button to Visual Builder*/
        
        const logic_btn = $(`
            <button class="btn btn-success btn-sm me-2 logic-field-btn">
                <i class="fa fa-calculator"></i> Add Logic Field
            </button>
        `);
        
        // Find existing buttons and add Logic button
        const button_container = this.page.main.find('.btn-group, .table-actions, .field-actions').first();
        if (button_container.length) {
            button_container.append(logic_btn);
        } else {
            // Create button section if it doesn't exist
            const actions_section = $(`
                <div class="field-actions mb-3">
                    <div class="btn-group" role="group"></div>
                </div>
            `);
            actions_section.find('.btn-group').append(logic_btn);
            this.page.main.find('.page-content').prepend(actions_section);
        }
        
        // Add click handler
        logic_btn.on('click', () => {
            this.show_unified_field_dialog(this.current_table);
        });
        
        console.log('✅ Added Logic Field button to Visual Builder');
    }
    
    show_logic_field_dialog() {
        /**Show dialog to create Logic Field*/
        
        const dialog = new frappe.ui.Dialog({
            title: 'Create Logic Field',
            fields: [
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Unique name for the Logic Field (no spaces)'
                },
                {
                    label: 'Field Label',
                    fieldname: 'label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for the field',
                    change: () => {
                        const label = dialog.get_value('label');
                        const current_field_name = dialog.get_value('field_name');
                        
                        // Auto-generate field name if field_name is empty or matches previous auto-generation
                        if (label && (!current_field_name || current_field_name === this.last_auto_field_name)) {
                            const auto_name = label.toLowerCase()
                                .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
                                .replace(/\s+/g, '_') // Replace spaces with underscores
                                .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
                                .substring(0, 50); // Limit length
                            
                            dialog.set_value('field_name', auto_name);
                            this.last_auto_field_name = auto_name;
                        }
                    }},
                {
                    label: 'Logic Expression',
                    fieldname: 'expression',
                    fieldtype: 'Code',
                    reqd: 1,
                    description: 'FlansaLogic expression (e.g., price * quantity, SUM(10,20,30))'
                },
                {
                    label: 'Result Type',
                    fieldname: 'result_type',
                    fieldtype: 'Select',
                    options: 'Data\nFloat\nInt\nCurrency\nPercent',
                    default: 'Float',
                    reqd: 1
                }
            ],
            primary_action_label: 'Create Logic Field',
            primary_action: (values) => {
                this.create_logic_field(values);
                dialog.hide();
            },
            secondary_action_label: 'Test Expression',
            secondary_action: () => {
                const values = dialog.get_values();
                this.test_logic_expression(values);
            }
        });
        
        dialog.show();
    }
    
    async test_logic_expression(values) {
        /**Test Logic expression before creating field*/
        
        try {
            // Debug: Log the values being passed
            console.log('test_logic_expression called with values:', values);
            
            if (!values.expression) {
                frappe.show_alert('Please enter an expression to test', 'red');
                return;
            }
            
            frappe.show_alert('Testing Logic expression...', 'blue');
            
            // Debug: Log what we're sending to the API
            const apiArgs = {
                expression: values.expression,
                sample_data: '{"price": 100, "quantity": 2}'
            };
            console.log('Sending to API:', apiArgs);
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.test_logic_field',
                args: apiArgs
            });
            
            if (response.message && response.message.success) {
                const result = response.message.result;
                frappe.msgprint({
                    title: 'Logic Test Result',
                    message: `
                        <div class="logic-test-result">
                            <h5>Expression: <code>${values.expression}</code></h5>
                            <h4>Result: <span class="text-success">${result}</span></h4>
                            <p class="text-muted">✅ Logic expression is valid!</p>
                        </div>
                    `,
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: 'Logic Test Failed',
                    message: `❌ Error: ${response.message ? response.message.error : 'Unknown error'}`,
                    indicator: 'red'
                });
            }
            
        } catch (error) {
            console.error('Logic test error:', error);
            frappe.show_alert('Logic test failed', 'red');
        }
    }
    
    async create_logic_field(values) {
        /**Create the Logic Field*/
        
        try {
            frappe.show_alert('Creating Logic Field...', 'blue');
            
            // Use the table_name from current context
            const table_name = this.table_name || this.current_table;
            
            if (!table_name) {
                frappe.show_alert('❌ No table selected', 'red');
                return;
            }
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.add_logic_field_to_table',
                args: {
                    table_name: table_name,
                    field_config: {
                        field_name: values.field_name,
                        label: values.label,
                        expression: values.expression,
                        result_type: values.result_type
                    }
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert('✅ Logic Field created successfully!', 'green');
                
                frappe.msgprint({
                    title: 'Logic Field Created',
                    message: `
                        <div class="logic-field-success">
                            <h5>Logic Field: <strong>${values.label}</strong></h5>
                            <p>Field Name: <code>${values.field_name}</code></p>
                            <p>Expression: <code>${values.expression}</code></p>
                            <p>Result Type: ${values.result_type}</p>
                            <p class="text-success">✅ Logic Field is now active!</p>
                        </div>
                    `,
                    indicator: 'green'
                });
                
                // Refresh current view
                if (typeof this.refresh_data === 'function') {
                    this.refresh_data();
                }
                
            } else {
                frappe.show_alert('❌ Failed to create Logic Field', 'red');
                console.error('Logic Field creation failed:', response);
                console.error('Response message:', response.message);
                
                // Show detailed error to user
                const error_message = response.message && response.message.error 
                    ? response.message.error 
                    : JSON.stringify(response.message || response);
                
                frappe.msgprint({
                    title: 'Logic Field Creation Error',
                    message: `<div class="text-danger">Error: ${error_message}</div>`,
                    indicator: 'red'
                });
            }
            
        } catch (error) {
            console.error('Logic Field creation error:', error);
            frappe.show_alert('Logic Field creation failed', 'red');
        }
    }
    
    show_logic_field_edit_wizard(table_id, field, template_type) {
        const self = this;
        
        // Based on template type, show the appropriate edit wizard
        switch (template_type) {
            case 'link':
                this.show_link_edit_wizard(table_id, field);
                break;
            case 'fetch':
                this.show_fetch_edit_wizard(table_id, field);
                break;
            case 'rollup':
                this.show_rollup_edit_wizard(table_id, field);
                break;
            case 'formula':
                this.show_formula_edit_wizard(table_id, field);
                break;
            default:
                // Fallback to standard dialog
                this.show_standard_field_dialog(table_id, field);
        }
    }
    
    show_link_edit_wizard(table_id, field) {
        const dialog = new frappe.ui.Dialog({
            title: `Edit Link Field: ${field.field_label}`,
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `<h5><i class="fa fa-link"></i> Edit Link Field</h5>
                             <p class="text-muted">Update the settings for this Link field that connects to another table.</p>`
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Information'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.field_label,
                    description: 'Display name for users'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.field_name,
                    read_only: 1,
                    description: 'Internal field name (cannot be changed)'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Target Selection'
                },
                {
                    label: 'Link Scope',
                    fieldname: 'link_scope',
                    fieldtype: 'Select',
                    options: 'Current App\nOther Flansa Apps\nSystem Tables',
                    default: 'Current App',
                    reqd: 1,
                    change: () => this.load_target_tables(dialog, table_id)
                },
                {
                    label: 'Select App',
                    fieldname: 'target_app',
                    fieldtype: 'Select',
                    depends_on: 'eval:doc.link_scope === "Other Flansa Apps"',
                    description: 'Choose the Flansa app to select tables from',
                    change: () => this.handle_app_selection_change(dialog)
                },
                {
                    label: 'Target Table',
                    fieldname: 'target_doctype',
                    fieldtype: 'Select',
                    reqd: 1,
                    default: field.options || '',
                    description: 'Table to link to'
                }
            ],
            primary_action_label: 'Update Link Field',
            primary_action: (values) => {
                this.update_link_field(table_id, values, dialog, field);
            }
        });
        
        dialog.show();
        
        // Load initial target tables and try to detect current selection
        this.load_target_tables(dialog, table_id);
        
        // Set the current target if it exists
        if (field.options) {
            setTimeout(() => {
                dialog.set_value('target_doctype', field.options);
            }, 500);
        }
    }
    
    update_link_field(table_id, values, dialog, existing_field) {
        console.log("Updating link field with:", {
            field_name: existing_field.field_name,
            field_label: values.field_label,
            target_doctype: values.target_doctype
        });
        
        // Update the Logic Field document
        frappe.call({
            method: 'flansa.flansa_core.api.table_api.update_logic_field',
            args: {
                table_name: table_id,
                field_name: existing_field.field_name,
                field_label: values.field_label,
                options: values.target_doctype,
                template_type: 'link'
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `Link field "${values.field_label}" updated successfully!`,
                        indicator: 'green'
                    });
                    dialog.hide();
                    // Refresh the table to show updated field
                    this.load_table_data();
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: r.message?.message || 'Failed to update link field'
                    });
                }
            }
        });
    }
    
    show_fetch_edit_wizard(table_id, field) {
        // Use unified wizard for edit mode
        this.show_unified_fetch_wizard(table_id, field);
    }
    
    show_unified_fetch_wizard(table_id, field = null) {
        const is_edit_mode = field !== null;
        const dialog_title = is_edit_mode ? `Edit Fetch Field: ${field.field_label}` : 'Create Fetch Field';
        
        console.log(is_edit_mode ? "Starting Fetch Field edit wizard" : "Starting Fetch Field wizard for table:", table_id);
        
        const dialog = new frappe.ui.Dialog({
            title: dialog_title,
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `
                        <div style="padding: 10px 0;">
                            <h5><i class="fa fa-magic"></i> ${is_edit_mode ? 'Edit Fetch Field' : 'Fetch Field'}</h5>
                            <p class="text-muted">Fetch data from linked records (e.g., Customer Name from Customer).</p>
                        </div>
                    `
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Details'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: is_edit_mode ? field.field_label : '',
                    description: 'Display label (e.g., Customer Name)',
                    change: () => {
                        if (!is_edit_mode) {
                            // Auto-generate field name from label for new fields
                            const label = dialog.get_value('field_label');
                            if (label) {
                                const normalized_name = this.normalize_field_name(label);
                                const current_field_name = dialog.get_value('field_name');
                                if (!current_field_name || current_field_name === this.last_auto_generated_name) {
                                    dialog.set_value('field_name', normalized_name);
                                    this.last_auto_generated_name = normalized_name;
                                }
                            }
                        }
                    }
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: is_edit_mode ? field.field_name : '',
                    read_only: is_edit_mode ? 1 : 0,
                    description: is_edit_mode ? 'Internal field name (cannot be changed)' : 'Internal field name (auto-generated from label)'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Source Configuration'
                },
                {
                    label: 'Source Link Field',
                    fieldname: 'source_link_field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Choose the link field to get data from',
                    change: () => this.load_linked_fields(dialog, table_id)
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Target Field',
                    fieldname: 'target_field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Field to auto-fill from linked table'
                }
            ],
            primary_action_label: is_edit_mode ? 'Update Fetch Field' : 'Create Fetch Field',
            primary_action: (values) => {
                if (is_edit_mode) {
                    this.update_fetch_field(table_id, values, dialog, field);
                } else {
                    this.create_fetch_field(table_id, values, dialog);
                }
            }
        });
        
        dialog.show();
        
        // Load fetch data
        this.load_fetch_data_for_unified_wizard(dialog, table_id, field);
    }
    
    load_fetch_data_for_unified_wizard(dialog, table_id, existing_field = null) {
        const target_table = table_id || this.current_table;
        console.log("Loading fetch data for unified wizard, table:", target_table);
        
        frappe.call({
            method: 'flansa.logic_templates.get_fetch_wizard_data',
            args: { table_name: target_table },
            callback: (r) => {
                console.log("Fetch wizard data response:", r);
                if (r.message && r.message.success) {
                    const link_fields = r.message.link_fields;
                    if (link_fields && link_fields.length > 0) {
                        // Store link fields data for later lookup
                        dialog._link_fields_data = link_fields;
                        // Show only labels to user
                        const options = link_fields.map(f => f.label).join('\n');
                        dialog.set_df_property('source_link_field', 'options', options);
                        
                        // If editing, pre-populate values from existing field
                        if (existing_field && existing_field.calculation_method) {
                            this.pre_populate_fetch_values(dialog, existing_field, link_fields);
                        }
                    } else {
                        frappe.msgprint({
                            title: 'No Link Fields Found',
                            indicator: 'orange',
                            message: 'This table has no Link fields. Please create a Link field first before creating Fetch fields.'
                        });
                        dialog.hide();
                    }
                } else {
                    frappe.msgprint({
                        title: 'Error Loading Data',
                        indicator: 'red',
                        message: 'Could not load link fields. Please try again.'
                    });
                }
            }
        });
    }
    
    pre_populate_fetch_values(dialog, field, link_fields) {
        try {
            // Debug: Log the field object to understand its structure
            console.log("Pre-populate field object:", field);
            
            // Parse the calculation_method to extract source and target fields
            // Expected format: "FETCH(source_field, target_field)"
            // Try multiple possible property names for the formula
            const calc_method = field.calculation_method || field.formula || field.expression || '';
            console.log("Calculation method found:", calc_method);
            
            const match = calc_method.match(/FETCH\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/i);
            
            if (match) {
                const source_fieldname = match[1].trim();
                const target_fieldname = match[2].trim();
                
                // Find the corresponding link field
                const source_link_field = link_fields.find(f => f.fieldname === source_fieldname);
                if (source_link_field) {
                    dialog.set_value('source_link_field', source_link_field.label);
                    
                    // Delay loading target fields to allow dialog to settle
                    setTimeout(() => {
                        this.load_linked_fields(dialog, this.current_table);
                        
                        // After a short delay, try to set the target field
                        setTimeout(() => {
                            const target_fields_data = dialog._target_fields_data || [];
                            const target_field_data = target_fields_data.find(f => f.fieldname === target_fieldname);
                            if (target_field_data) {
                                dialog.set_value('target_field', target_field_data.label);
                            }
                        }, 1000); // Wait for linked fields to load
                    }, 500);
                }
            }
        } catch (error) {
            console.warn("Could not pre-populate fetch values:", error);
        }
    }
    
    update_fetch_field(table_id, values, dialog, existing_field) {
        // Get fieldnames from stored data using the labels
        const source_field_label = values.source_link_field;
        const target_field_label = values.target_field;
        
        // Find actual fieldnames from stored data
        const link_fields_data = dialog._link_fields_data || [];
        const target_fields_data = dialog._target_fields_data || [];
        
        const source_field_data = link_fields_data.find(f => f.label === source_field_label);
        const target_field_data = target_fields_data.find(f => f.label === target_field_label);
        
        if (!source_field_data) {
            frappe.msgprint({
                title: 'Error',
                indicator: 'red',
                message: 'Source link field not found. Please reselect.'
            });
            return;
        }
        
        if (!target_field_data) {
            frappe.msgprint({
                title: 'Error',
                indicator: 'red',
                message: 'Target field not found. Please reselect.'
            });
            return;
        }
        
        // Create FETCH expression
        const expression = `FETCH(${source_field_data.fieldname}, ${target_field_data.fieldname})`;
        
        console.log("Updating fetch field with:", {
            field_name: existing_field.field_name,
            field_label: values.field_label,
            expression: expression
        });
        
        // Update the Logic Field document
        frappe.call({
            method: 'flansa.flansa_core.api.table_api.update_logic_field',
            args: {
                table_name: table_id,
                field_name: existing_field.field_name,
                field_label: values.field_label,
                calculation_method: expression,
                template_type: 'fetch'
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `Fetch field "${values.field_label}" updated successfully!`,
                        indicator: 'green'
                    });
                    dialog.hide();
                    // Refresh the table to show updated field
                    this.load_table_data();
                } else {
                    frappe.msgprint({
                        title: 'Error',
                        indicator: 'red',
                        message: r.message?.message || 'Failed to update fetch field'
                    });
                }
            }
        });
    }
    
    show_formula_edit_wizard(table_id, field) {
        const dialog = new frappe.ui.Dialog({
            title: `Edit Formula Field: ${field.field_label}`,
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `<h5><i class="fa fa-calculator"></i> Edit Formula Field</h5>
                             <p class="text-muted">Update the formula for this calculated field.</p>`
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Information'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.field_label,
                    description: 'Display name for users'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.field_name,
                    read_only: 1,
                    description: 'Internal field name (cannot be changed)'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Formula Configuration'
                },
                {
                    label: 'Formula',
                    fieldname: 'formula',
                    fieldtype: 'Code',
                    reqd: 1,
                    default: field.formula || '',
                    description: 'Enter the calculation formula',
                    language: 'javascript'
                }
            ],
            primary_action_label: 'Update Formula Field',
            primary_action: (values) => {
                this.update_formula_field(table_id, values, dialog, field);
            }
        });
        
        dialog.show();
    }
    
    show_rollup_edit_wizard(table_id, field) {
        const dialog = new frappe.ui.Dialog({
            title: `Edit Roll-up Field: ${field.field_label}`,
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `<h5><i class="fa fa-sum"></i> Edit Roll-up Field</h5>
                             <p class="text-muted">Update the settings for this Roll-up field that aggregates data from related records.</p>`
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Information'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.field_label,
                    description: 'Display name for users'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.field_name,
                    read_only: 1,
                    description: 'Internal field name (cannot be changed)'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Aggregation Configuration'
                },
                {
                    label: 'Source Table',
                    fieldname: 'source_table',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Table to aggregate data from'
                },
                {
                    label: 'Aggregation Type',
                    fieldname: 'aggregation_type',
                    fieldtype: 'Select',
                    options: 'Sum\nCount\nAverage\nMax\nMin',
                    reqd: 1,
                    description: 'Type of aggregation to perform'
                },
                {
                    label: 'Source Field',
                    fieldname: 'source_field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Field to aggregate'
                }
            ],
            primary_action_label: 'Update Roll-up Field',
            primary_action: (values) => {
                this.update_rollup_field(table_id, values, dialog, field);
            }
        });
        
        dialog.show();
        
        // Parse current rollup formula and populate fields
        this.parse_rollup_formula_for_edit(dialog, field);
    }
    
    show_standard_field_dialog(table_id, field) {
        // Fallback to the original unified dialog for non-logic fields
        this.show_unified_field_dialog(table_id, field);
    }
    
    show_logic_examples() {
        /**Show Logic Field examples dialog*/
        
        const examples_html = `
            <div class="logic-examples">
                <h5>Basic Calculations:</h5>
                <ul>
                    <li><code>price * quantity</code> - Multiply two fields</li>
                    <li><code>(sales - cost) / sales * 100</code> - Profit margin percentage</li>
                    <li><code>amount + (amount * 0.15)</code> - Add 15% tax</li>
                </ul>
                
                <h5>Functions:</h5>
                <ul>
                    <li><code>SUM(10, 20, 30, 40)</code> - Sum of values</li>
                    <li><code>MAX(price, cost, tax)</code> - Maximum value</li>
                    <li><code>MIN(price, cost, tax)</code> - Minimum value</li>
                    <li><code>ROUND(amount * 1.15, 2)</code> - Round to 2 decimals</li>
                </ul>
                
                <h5>Conditions:</h5>
                <ul>
                    <li><code>IF(status == "Active", 1, 0)</code> - Status check</li>
                    <li><code>IF(amount > 1000, amount * 0.1, 0)</code> - Discount logic</li>
                    <li><code>IF(priority == "High", "🔴", "🟢")</code> - Priority indicator</li>
                </ul>
                
                <h5>Text Functions:</h5>
                <ul>
                    <li><code>UPPER(status)</code> - Convert to uppercase</li>
                    <li><code>CONCAT(first_name, " ", last_name)</code> - Join text</li>
                    <li><code>LEN(description)</code> - Text length</li>
                </ul>
                
                <h5>Date Functions:</h5>
                <ul>
                    <li><code>TODAY()</code> - Current date</li>
                    <li><code>DATEDIFF(due_date, TODAY())</code> - Days until due</li>
                </ul>
            </div>
        `;
        
        frappe.msgprint({
            title: 'FlansaLogic Examples',
            message: examples_html,
            wide: true
        });
    }
}

// Apply theme on page load
$(document).ready(function() {
    if (window.page_instance && window.page_instance.apply_theme) {
        window.page_instance.apply_theme();
    }
});
