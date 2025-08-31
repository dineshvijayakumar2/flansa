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
        this.view_mode = 'tile'; // 'list' or 'tile' - default to tile
        
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
            <div class="flansa-workspace">
                <!-- Ultra-modern sleek header - Exactly match Table Builder -->
                <div class="sleek-header">
                    <div class="header-backdrop"></div>
                    <div class="header-content">
                        <!-- Breadcrumb Trail -->
                        <nav class="breadcrumb-trail">
                            <span class="breadcrumb-current">🏠 Workspace</span>
                        </nav>
                    </div>
                    
                    <!-- Application Banner below breadcrumbs -->
                    <div class="app-banner">
                        <div class="banner-left">
                            <!-- Optional Workspace Logo -->
                            <div class="workspace-logo-container" id="workspace-logo-container" style="margin-right: 8px;">
                                <img src="" alt="Workspace Logo" class="workspace-logo" id="workspace-logo" style="display: none;" />
                                <div class="logo-placeholder" id="logo-placeholder" style="display: block;">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#667eea" stroke-width="2" fill="#f7fafc"/>
                                        <path d="M8 12h8M8 8h8M8 16h5" stroke="#667eea" stroke-width="1.5" stroke-linecap="round"/>
                                    </svg>
                                </div>
                            </div>
                            <!-- App Info Section -->
                            <div class="app-info">
                                <div class="app-details">
                                    <h1 class="app-name title-text" id="workspace-title">Flansa Platform</h1>
                                    <div class="app-type">
                                        <div class="counter-pill">
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                            </svg>
                                            <span class="counter-text">Applications</span>
                                        </div>
                                        <div class="tenant-badge" id="current-tenant-badge">
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                                            </svg>
                                            <span id="tenant-name-display">Loading...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Action Buttons -->
                        <div class="banner-right">
                            <div class="action-dropdown">
                                <button class="sleek-btn primary split-btn" id="context-menu">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Add Application</span>
                                    <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                                <div class="dropdown-panel" id="context-dropdown">
                                    <div class="dropdown-item" data-action="create-app">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Add Application</span>
                                    </div>
                                    <div class="dropdown-separator"></div>
                                    <div class="dropdown-item" data-action="tenant-switcher">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                        </svg>
                                        <span>Switch Workspace</span>
                                    </div>
                                    <div class="dropdown-item" data-action="refresh-cache">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Refresh Cache</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Context Header - Match Table Builder exactly -->
                <div class="context-header">
                    <div class="context-container">
                        <div class="context-info">
                            <span class="context-label">WORKSPACE:</span>
                            <span class="context-name" id="workspace-context-name">Loading...</span>
                        </div>
                        
                        <div class="context-controls">
                            <div class="view-toggle">
                                <button class="view-btn active" data-view="tile" title="Tile View">
                                    <i class="fa fa-th"></i>
                                </button>
                                <button class="view-btn" data-view="list" title="List View">
                                    <i class="fa fa-list"></i>
                                </button>
                            </div>
                            <input type="search" class="search-box" id="app-search" 
                                   placeholder="Search applications...">
                            <div class="context-counter">
                                <span class="counter-text">
                                    <span id="displayed-count">0</span> 
                                    <span class="count-total">of <span id="total-count">0</span> applications</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="main-content">
                    <div class="applications-container" id="applications-container">
                            <!-- Loading State -->
                            <div class="loading-placeholder" id="loading-state">
                                <i class="fa fa-spinner fa-spin"></i>
                                <p>Loading applications...</p>
                            </div>
                            
                            <!-- Applications Grid -->
                            <div class="applications-grid view-tile" id="applications-grid" style="display: none;">
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
            </div>
            
            <style>
                /* Ultra-Modern Sleek Header - Match App Builder and Table Builder */
                .sleek-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
                    border-bottom: 1px solid #e2e8f0;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }

                .header-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(248, 250, 252, 0.9);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
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

                /* App Banner */
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
                
                .workspace-logo-container {
                    display: flex;
                    align-items: center;
                }
                
                .workspace-logo {
                    height: 40px;
                    width: auto;
                    max-width: 100px;
                    object-fit: contain;
                    border-radius: 8px;
                }

                .app-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .app-details {
                    min-width: 0;
                }

                .app-name {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0;
                    line-height: 1.2;
                }

                .app-type {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-top: 8px;
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
                }

                .tenant-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #e0f2fe;
                    color: #0369a1;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .banner-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
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

                .dropdown-arrow {
                    transition: transform 0.2s ease;
                }

                .sleek-btn.active .dropdown-arrow {
                    transform: rotate(180deg);
                }

                /* Main Content Area */
                .main-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 24px;
                    width: 100%;
                }

                /* Container for consistent width */
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 24px;
                    width: 100%;
                }

                /* Context Header - Match Table Builder exactly */
                .context-header {
                    background: #ffffff;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                    padding: 0.875rem 0;
                    position: sticky;
                    top: 60px; /* Below global nav if present */
                    z-index: 99;
                    backdrop-filter: blur(10px);
                    background: rgba(255, 255, 255, 0.98);
                }
                
                .context-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 2rem;
                }
                
                .context-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .context-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .context-name {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #374151;
                    background: rgba(79, 70, 229, 0.1);
                    padding: 0.25rem 0.625rem;
                    border-radius: 6px;
                    border: 1px solid rgba(79, 70, 229, 0.2);
                }
                
                .context-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .context-controls .view-toggle {
                    display: flex;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 2px;
                }
                
                .context-controls .view-btn {
                    padding: 0.375rem 0.625rem;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                    font-size: 0.8125rem;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                
                .context-controls .view-btn.active {
                    background: #ffffff;
                    color: #4f46e5;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .context-controls .view-btn:hover:not(.active) {
                    background: rgba(255, 255, 255, 0.7);
                    color: #374151;
                }
                
                .context-controls .search-box {
                    padding: 0.375rem 0.75rem;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-size: 0.8125rem;
                    color: #374151;
                    background: #ffffff;
                    min-width: 200px;
                    transition: all 0.2s ease;
                }
                
                .context-controls .search-box:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }
                
                .context-counter {
                    padding: 0.375rem 0.75rem;
                    background: rgba(79, 70, 229, 0.08);
                    border: 1px solid rgba(79, 70, 229, 0.15);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                }
                
                .context-counter .counter-text {
                    color: #374151;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    white-space: nowrap;
                }
                
                .context-counter .count-total {
                    color: #6b7280;
                    font-weight: 400;
                }


                /* Dropdown Panel */
                .dropdown-panel {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    border: 1px solid #e2e8f0;
                    min-width: 200px;
                    z-index: 1000;
                    display: none;
                }

                .dropdown-panel.show {
                    display: block;
                }

                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    color: #374151;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 14px;
                    font-weight: 500;
                }

                .dropdown-item:first-child {
                    border-radius: 8px 8px 0 0;
                }

                .dropdown-item:last-child {
                    border-radius: 0 0 8px 8px;
                }

                .dropdown-item:hover {
                    background: #f8fafc;
                    color: #4f46e5;
                }

                .dropdown-separator {
                    height: 1px;
                    background: #e5e7eb;
                    margin: 4px 0;
                }

                /* Applications Container */
                .applications-container.tile-view .applications-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 24px;
                    padding: 20px 0;
                }

                .applications-container.list-view .applications-grid {
                    display: block;
                    padding: 20px 0;
                    width: 100%;
                }

                /* Enterprise Data Grid for List View */
                .enterprise-data-grid {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    border: 1px solid #e2e8f0;
                    width: 100%;
                    min-width: 800px;
                }

                .data-grid-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    font-size: 14px;
                }

                .data-grid-header {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    border-bottom: 2px solid #e2e8f0;
                }

                .data-grid-header th {
                    padding: 16px 20px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    font-size: 13px;
                    letter-spacing: 0.025em;
                    text-transform: uppercase;
                    border-right: 1px solid #e5e7eb;
                    position: relative;
                    user-select: none;
                }
                
                /* Column widths for applications table */
                .data-grid-header th:nth-child(1) { width: 25%; } /* Application Name */
                .data-grid-header th:nth-child(2) { width: 20%; } /* System Name */
                .data-grid-header th:nth-child(3) { width: 30%; } /* Description */
                .data-grid-header th:nth-child(4) { width: 10%; } /* Tables */
                .data-grid-header th:nth-child(5) { width: 15%; } /* Actions - expanded for buttons */

                .data-grid-header th:last-child {
                    border-right: none;
                }

                .sortable-header {
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }

                .sortable-header:hover {
                    background-color: rgba(79, 70, 229, 0.05);
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .sort-icon {
                    color: #9ca3af;
                    font-size: 12px;
                    transition: color 0.2s ease;
                }

                .sortable-header:hover .sort-icon {
                    color: #6b7280;
                }

                .data-grid-body tr {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s ease;
                }

                .data-grid-body tr:hover {
                    background-color: #f8fafc;
                }

                .data-grid-body tr:last-child {
                    border-bottom: none;
                }

                .data-grid-body td {
                    padding: 16px 20px;
                    color: #374151;
                    border-right: 1px solid #f1f5f9;
                    vertical-align: middle;
                }
                
                /* Corresponding body cell widths */
                .data-grid-body td:nth-child(1) { width: 25%; } /* Application Name */
                .data-grid-body td:nth-child(2) { width: 20%; } /* System Name */
                .data-grid-body td:nth-child(3) { width: 30%; } /* Description */
                .data-grid-body td:nth-child(4) { width: 10%; } /* Tables */
                .data-grid-body td:nth-child(5) { width: 15%; } /* Actions - expanded for buttons */
                
                /* Ensure table stretches to full container width */
                .applications-container, .section-wrapper {
                    width: 100%;
                    max-width: none;
                }

                /* Enterprise data grid full width */
                .enterprise-data-grid {
                    width: 100%;
                    max-width: none;
                    min-width: unset;
                }

                .data-grid-table {
                    width: 100%;
                    max-width: none;
                }

                .data-grid-body td:last-child {
                    border-right: none;
                }

                .cell-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .app-title {
                    font-weight: 600;
                    color: #1f2937;
                }

                .app-name-code {
                    background: #f3f4f6;
                    color: #4b5563;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 12px;
                    font-weight: 500;
                }

                .app-description {
                    color: #6b7280;
                    font-size: 13px;
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .tables-count {
                    color: #6b7280;
                    font-size: 13px;
                    font-weight: 500;
                }

                .action-buttons {
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    padding: 6px 8px;
                    background: #f8fafc;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #6b7280;
                    font-size: 12px;
                }

                .action-btn:hover {
                    background: #4f46e5;
                    border-color: #4f46e5;
                    color: white;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
                }

                .action-btn.delete-btn:hover {
                    background: #ef4444;
                    border-color: #ef4444;
                }

                /* App Tiles for Tile View - Match App Builder Style */
                .app-tile {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }

                .app-tile:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    border-color: #667eea;
                }

                .tile-header {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    color: #1f2937;
                    padding: 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    min-height: 80px;
                }

                .tile-label {
                    font-size: 18px;
                    font-weight: 700;
                    line-height: 1.2;
                    margin-bottom: 8px;
                    color: #1f2937;
                }

                .tile-field-name {
                    margin-top: 4px;
                }

                .tile-actions {
                    display: flex;
                    gap: 8px;
                    flex-shrink: 0;
                }
                
                .tile-action-btn {
                    width: 32px;
                    height: 32px;
                    border: 1px solid #d1d5db;
                    background: white;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #6b7280;
                }
                
                .tile-action-btn:hover {
                    border-color: #667eea;
                    background: #667eea;
                    color: white;
                    transform: translateY(-1px);
                }


                .tile-body {
                    padding: 20px;
                }

                .tile-description {
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 16px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .tile-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #6b7280;
                    font-size: 13px;
                    font-weight: 500;
                }

                .meta-item svg {
                    opacity: 0.7;
                }

                .status-badge {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .status-badge.flansa-text-success {
                    background: #d1fae5;
                    color: #065f46;
                }

                .status-badge.flansa-text-secondary {
                    background: #f3f4f6;
                    color: #6b7280;
                }

                .status-badge.flansa-text-warning {
                    background: #fef3c7;
                    color: #92400e;
                }

                /* Empty States */
                .loading-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    color: #6b7280;
                }

                .loading-placeholder i {
                    font-size: 32px;
                    margin-bottom: 16px;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 20px;
                    text-align: center;
                    color: #6b7280;
                }

                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                    opacity: 0.6;
                }

                .empty-state-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 8px;
                }

                .empty-state-description {
                    font-size: 14px;
                    margin-bottom: 24px;
                    max-width: 400px;
                }

                /* Responsive Design */
                @media (max-width: 1024px) {
                    .header-content {
                        flex-wrap: wrap;
                        gap: 16px;
                    }

                    .context-controls {
                        order: 3;
                        width: 100%;
                        justify-content: space-between;
                        flex-wrap: wrap;
                        gap: 12px;
                    }

                    .search-box {
                        width: 240px;
                    }
                }

                @media (max-width: 768px) {
                    .sleek-header {
                        margin: 0 -15px 20px -15px;
                    }

                    .breadcrumb-section {
                        padding: 12px 20px 0;
                    }

                    .header-content {
                        padding: 16px 20px 20px;
                    }

                    .main-content {
                        padding: 0 20px;
                    }

                    .applications-container.tile-view .applications-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }

                    .search-box {
                        width: 200px;
                    }

                    .context-counter {
                        display: none;
                    }
                }
            </style>
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
            callback: (response) => {
                $('#loading-state').hide();
                
                if (response.message) {
                    self.applications = response.message || [];
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
            error: (error) => {
                $('#loading-state').hide();
                $('#empty-state').show();
                frappe.msgprint({
                    title: 'Error',
                    indicator: 'red',
                    message: 'Failed to load applications. Please try again.'
                });
                console.error('Application loading error:', error);
            }
        });
    }
    
    render_applications() {
        const grid = $('#applications-grid');
        const emptyState = $('#no-results-state');
        
        const apps_to_render = this.filtered_apps;
        
        if (apps_to_render.length === 0) {
            grid.hide();
            emptyState.show();
            // Update counters even when no results to show "0 of X applications"
            this.update_counters(0, this.applications.length);
            return;
        }
        
        emptyState.hide();
        grid.show();
        
        if (this.view_mode === 'list') {
            this.render_list_view(apps_to_render);
        } else {
            this.render_tile_view(apps_to_render);
        }
        
        // Update counters - show displayed count vs total applications count
        this.update_counters(apps_to_render.length, this.applications.length);
        
        // Bind card events
        this.bind_card_events();
    }
    
    render_list_view(apps) {
        const grid = $('#applications-grid');
        
        // Create enterprise data grid similar to App Builder
        grid.html(`
            <div class="enterprise-data-grid">
                <table class="data-grid-table">
                    <thead class="data-grid-header">
                        <tr>
                            <th class="sortable-header" data-column="title">
                                <div class="header-content">
                                    <span class="header-text">Application Name</span>
                                    <i class="fa fa-sort sort-icon" data-sort="none"></i>
                                </div>
                            </th>
                            <th class="sortable-header" data-column="name">
                                <div class="header-content">
                                    <span class="header-text">System Name</span>
                                    <i class="fa fa-sort sort-icon" data-sort="none"></i>
                                </div>
                            </th>
                            <th class="sortable-header" data-column="description">
                                <div class="header-content">
                                    <span class="header-text">Description</span>
                                    <i class="fa fa-sort sort-icon" data-sort="none"></i>
                                </div>
                            </th>
                            <th class="sortable-header" data-column="tables">
                                <div class="header-content">
                                    <span class="header-text">Tables</span>
                                    <i class="fa fa-sort sort-icon" data-sort="none"></i>
                                </div>
                            </th>
                            <th class="actions-header">
                                <div class="header-content">
                                    <span class="header-text">Actions</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="data-grid-body">
                        ${this.render_app_rows(apps)}
                    </tbody>
                </table>
            </div>
        `);
        
        // Setup sorting functionality
        this.setup_app_sorting();
    }
    
    render_app_rows(apps) {
        return apps.map(app => {
            const appName = app.name;
            const appTitle = app.app_title || appName;
            const description = app.description || 'No description provided';
            const tableCount = app.table_count || 0;
            
            return `
                <tr class="data-grid-row clickable" data-app-name="${appName}" onclick="window.location.href='/app/flansa-app-builder?app=${appName}'">
                    <td class="app-title-cell">
                        <div class="cell-content">
                            <span class="app-title">${appTitle}</span>
                        </div>
                    </td>
                    <td class="app-name-cell">
                        <div class="cell-content">
                            <code class="app-name-code">${appName}</code>
                        </div>
                    </td>
                    <td class="app-description-cell">
                        <div class="cell-content">
                            <span class="app-description">${description}</span>
                        </div>
                    </td>
                    <td class="app-tables-cell">
                        <div class="cell-content">
                            <span class="tables-count">${tableCount} tables</span>
                        </div>
                    </td>
                    <td class="app-actions-cell">
                        <div class="cell-content action-buttons">
                            <button class="action-btn edit-btn" onclick="event.stopPropagation(); window.flansa_workspace.edit_application('${appName}')" title="Edit Application">
                                <i class="fa fa-edit"></i>
                            </button>
                            <button class="action-btn open-btn" onclick="event.stopPropagation(); window.location.href='/app/flansa-app-builder?app=${appName}'" title="Open Application">
                                <i class="fa fa-arrow-right"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="event.stopPropagation(); window.flansa_workspace.delete_application('${appName}')" title="Delete Application">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    render_tile_view(apps) {
        const grid = $('#applications-grid');
        
        let html = '';
        
        apps.forEach(app => {
            html += `
                <div class="app-tile clickable" data-app-name="${app.name}" onclick="window.location.href='/app/flansa-app-builder?app=${app.name}'">
                    <div class="tile-header">
                        <div>
                            <div class="tile-label">${app.app_title || app.name}</div>
                            <div class="tile-field-name">
                                <code style="font-size: 0.75rem; color: #6b7280; background: rgba(107, 114, 128, 0.1); padding: 2px 6px; border-radius: 4px;">${app.name}</code>
                            </div>
                        </div>
                        <div class="tile-actions">
                            <button class="tile-action-btn" onclick="event.stopPropagation(); window.flansa_workspace.edit_application('${app.name}')" title="Edit Application">
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="tile-body">
                        <div class="tile-description">${app.description || 'No description provided'}</div>
                        <div class="tile-meta">
                            <div class="meta-item">
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                                </svg>
                                <span>${app.table_count || 0} tables</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        grid.html(html);
    }
    
    setup_app_sorting() {
        // Sorting functionality for table view
        $('.sortable-header').on('click', (e) => {
            const column = $(e.currentTarget).data('column');
            const sortIcon = $(e.currentTarget).find('.sort-icon');
            const currentSort = sortIcon.data('sort') || 'none';
            
            // Reset all other sort icons
            $('.sort-icon').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort').data('sort', 'none');
            
            // Toggle current column sort
            let newSort = 'asc';
            if (currentSort === 'asc') newSort = 'desc';
            else if (currentSort === 'desc') newSort = 'none';
            
            if (newSort === 'none') {
                sortIcon.removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
                // Reset to original order
                this.render_applications();
            } else {
                sortIcon.removeClass('fa-sort fa-sort-up fa-sort-down').addClass(newSort === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
                // Sort the applications
                this.sort_applications(column, newSort);
            }
            
            sortIcon.data('sort', newSort);
        });
    }
    
    sort_applications(column, direction) {
        const sortedApps = [...this.filtered_apps].sort((a, b) => {
            let aVal = '', bVal = '';
            
            switch(column) {
                case 'title':
                    aVal = a.app_title || a.name || '';
                    bVal = b.app_title || b.name || '';
                    break;
                case 'name':
                    aVal = a.name || '';
                    bVal = b.name || '';
                    break;
                case 'description':
                    aVal = a.description || '';
                    bVal = b.description || '';
                    break;
                case 'status':
                    aVal = a.status || '';
                    bVal = b.status || '';
                    break;
                case 'tables':
                    aVal = a.table_count || 0;
                    bVal = b.table_count || 0;
                    break;
            }
            
            if (typeof aVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            } else {
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
        });
        
        // Render sorted applications
        if (this.view_mode === 'list') {
            this.render_list_view(sortedApps);
        } else {
            this.render_tile_view(sortedApps);
        }
    }
    
    update_counters(displayed, total) {
        $('#displayed-count').text(displayed);
        $('#total-count').text(total);
    }
    
    bind_card_events() {
        const self = this;
        
        // Handle new unified action buttons
        $('.app-action-btn, .tile-action-btn, .action-btn').on('click', function(e) {
            e.stopPropagation();
            const action = $(this).data('action');
            const app_name = $(this).data('app');
            
            switch(action) {
                case 'edit':
                    window.location.href = `/app/flansa-app-builder?app_name=${app_name}`;
                    break;
                case 'open':
                    self.open_application(app_name);
                    break;
                case 'delete':
                    self.delete_application(app_name);
                    break;
            }
        });
        
        // Legacy button support (fallback)
        $('.open-app-btn').on('click', function() {
            const app_name = $(this).data('app');
            self.open_application(app_name);
        });
        
        $('.edit-app-btn').on('click', function() {
            const app_name = $(this).data('app');
            window.location.href = `/app/flansa-app-builder?app_name=${app_name}`;
        });
        
        $('.delete-app-btn').on('click', function(e) {
            e.stopPropagation();
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
    
    edit_application(app_name) {
        const app = this.applications.find(a => a.name === app_name);
        if (!app) {
            frappe.msgprint('Application not found');
            return;
        }
        
        const dialog = new frappe.ui.Dialog({
            title: 'Edit Application',
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'app_title',
                    label: 'Application Title',
                    reqd: 1,
                    default: app.app_title || app.name
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'app_name',
                    label: 'Application Name',
                    reqd: 1,
                    read_only: 1,
                    default: app.name,
                    description: 'System name cannot be changed'
                },
                {
                    fieldtype: 'Small Text',
                    fieldname: 'description',
                    label: 'Description',
                    default: app.description || ''
                }
            ],
            primary_action_label: 'Update Application',
            primary_action: (values) => {
                // Use set_value for updating specific fields
                frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'Flansa Application',
                        name: app_name,
                        fieldname: {
                            app_title: values.app_title,
                            description: values.description
                        }
                    },
                    callback: (r) => {
                        if (r.message) {
                            frappe.show_alert('Application updated successfully');
                            dialog.hide();
                            // Reload applications to show updated data
                            this.load_applications();
                        } else {
                            frappe.msgprint('Failed to update application');
                        }
                    }
                });
            }
        });
        
        dialog.show();
    }
    
    update_stats() {
        // Update the application count
        const count = this.applications.length;
        $('#total-apps-count').text(count);
        $('#apps-plural').text(count === 1 ? '' : 's');
    }
    
    filter_applications() {
        const search_term = $('#app-search').val().toLowerCase();
        
        this.filtered_apps = this.applications.filter(app => {
            // Search filter
            const search_match = !search_term || 
                (app.app_title || app.name).toLowerCase().includes(search_term) ||
                (app.description || '').toLowerCase().includes(search_term);
            
            return search_match;
        });
        
        this.render_applications();
    }
    
    toggle_view(view) {
        this.view_mode = view;
        
        if (view === 'tile') {
            $('#applications-grid').removeClass('view-list').addClass('view-tile');
        } else {
            $('#applications-grid').removeClass('view-tile').addClass('view-list');
        }
        
        // Re-render applications with new view
        this.render_applications();
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
        const self = this;
        
        // Main button click - directly create new application
        $(document).on('click', '#context-menu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // If clicking on the main button area (not dropdown arrow), create app
            if (!$(e.target).hasClass('dropdown-arrow')) {
                self.create_new_application();
            } else {
                // Toggle dropdown menu
                const menu = $('#context-dropdown');
                menu.toggleClass('show');
            }
        });
        
        // Close dropdown when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#context-menu, #context-dropdown').length) {
                $('#context-dropdown').removeClass('show');
            }
        });
        
        // Dropdown menu item actions
        $(document).on('click', '.dropdown-item', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const action = $(e.currentTarget).data('action');
            this.handle_context_menu_action(action);
            $('#context-dropdown').removeClass('show');
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
                
                // Update workspace context in section controls
                const workspaceContextName = document.getElementById('workspace-context-name');
                if (workspaceContextName) {
                    workspaceContextName.textContent = tenantInfo.tenant_name || 'Unknown';
                }
                
                // Add click handler to show tenant details
                tenantBadge.style.cursor = 'pointer';
                tenantBadge.title = `Tenant: ${tenantInfo.tenant_name}\nID: ${tenantInfo.tenant_id}\nApps: ${tenantInfo.stats?.apps || 0} | Tables: ${tenantInfo.stats?.tables || 0}`;
                
                // Optional: Add click to show tenant switcher
                tenantBadge.onclick = () => {
                    frappe.set_route('tenant-switcher');
                };
                
                // Load tenant logo if available
                if (tenantInfo.logo_url) {
                    const logoContainer = document.getElementById('workspace-logo-container');
                    const logoImg = document.getElementById('workspace-logo');
                    const logoPlaceholder = document.getElementById('logo-placeholder');
                    if (logoContainer && logoImg) {
                        logoImg.src = tenantInfo.logo_url;
                        logoImg.alt = `${tenantInfo.tenant_name} Logo`;
                        logoImg.style.display = 'block';
                        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
                    }
                }
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
            await frappe.call({
                method: 'flansa.flansa_core.tenant_service.get_workspace_logo',
                callback: (r) => {
                    if (r.message && r.message.logo) {
                        const logoContainer = document.getElementById('workspace-logo-container');
                        const logoImg = document.getElementById('workspace-logo');
                        const logoPlaceholder = document.getElementById('logo-placeholder');
                        
                        if (logoContainer && logoImg) {
                            logoImg.src = r.message.logo;
                            logoImg.alt = `${r.message.workspace_name || 'Workspace'} Logo`;
                            logoImg.style.display = 'block';
                            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
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
