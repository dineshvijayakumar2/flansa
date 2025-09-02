frappe.pages['flansa-app-builder'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'App Builder',
        single_column: true
    });
    
    // Hide the default page header to keep only our sleek banner
    $(page.wrapper).find('.page-head').hide();
    
    // Initialize App Builder
    new FlansaAppBuilder(page);
};

class FlansaAppBuilder {
    constructor(page) {
        this.page = page;
        // Get app parameter from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        this.app_id = urlParams.get('app') || null;
        this.current_app = null;
        this.current_tables = [];
        this.view_mode = 'tile'; // 'list' or 'tile' - default to tile for App Builder
        
        
        this.init();
    }
    
    init() {
        this.make_layout();
        // Set initial title after DOM is ready
        setTimeout(() => {
            this.update_banner_info();
        }, 10);
        this.load_data();
        this.load_workspace_logo();
        this.bind_events();
    }
    
    getApplicationTitle() {
        if (this.current_app?.app_title) {
            return this.current_app.app_title;
        }
        if (this.current_app?.app_name) {
            return this.current_app.app_name;
        }
        if (this.current_app?.application_title) {
            return this.current_app.application_title;
        }
        if (this.current_app?.application_name) {
            return this.current_app.application_name;
        }
        return this.current_app?.name || 'Flansa Application';
    }
    
    getApplicationDescription() {
        if (this.current_app?.application_description) {
            return this.current_app.application_description;
        }
        if (this.current_app?.description) {
            return this.current_app.description;
        }
        return 'Application builder and data management';
    }
    
    update_banner_info() {
        const title = this.current_app ? this.getApplicationTitle() : 'App Builder';
        
        // Update all title elements
        const titleElements = document.querySelectorAll('.title-text');
        const contextElements = document.querySelectorAll('.context-name');
        
        let titleUpdatedCount = 0;
        let contextUpdatedCount = 0;
        
        titleElements.forEach(element => {
            element.textContent = title;
            titleUpdatedCount++;
        });
        
        contextElements.forEach(element => {
            element.textContent = title;
            contextUpdatedCount++;
        });
        
        
    }
    
    setup_header() {
        // Header actions are now handled in the custom header HTML
        // No need for additional page buttons
    }
    
    make_layout() {
        this.page.$app_builder = $(`
            <div class="flansa-app-builder">
                <!-- Ultra-modern sleek header -->
                <div class="sleek-header">
                    <div class="header-backdrop"></div>
                    <div class="header-content">
                        <!-- Breadcrumb Trail -->
                        <nav class="breadcrumb-trail">
                            <a href="/app/flansa-workspace" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                                <span>Workspace</span>
                            </a>
                            <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                            </svg>
                            <span class="breadcrumb-current">🏗️ App Builder</span>
                        </nav>
                    </div>
                    
                    <!-- Application Banner below breadcrumbs -->
                    <div class="app-banner">
                        <div class="banner-left">
                            <!-- Optional Workspace Logo -->
                            <div class="workspace-logo-container" id="workspace-logo-container" style="display: none; margin-right: 8px;">
                                <img src="" alt="Workspace Logo" class="workspace-logo" id="workspace-logo" />
                            </div>
                            <!-- App Info Section -->
                            <div class="app-info">
                                <div class="app-details">
                                    <h1 class="app-name title-text">App Builder</h1>
                                    <div class="app-type">
                                        <div class="counter-pill">
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                            </svg>
                                            <span class="counter-text">App Builder</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Action Buttons -->
                        <div class="banner-right">
                            <div class="action-dropdown">
                                <button class="sleek-btn primary split-btn" id="create-table-header">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Add Table</span>
                                    <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                                <div class="dropdown-panel" id="table-options-dropdown">
                                    <a href="#" class="dropdown-option" id="create-blank-table">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Blank Table</span>
                                    </a>
                                    <a href="#" class="dropdown-option" id="import-table">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Import Data</span>
                                    </a>
                                </div>
                            </div>
                            
                            <!-- Context Menu -->
                            <div class="action-dropdown">
                                <button class="sleek-btn secondary" id="context-menu">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                </button>
                                <div class="dropdown-panel" id="context-dropdown">
                                    <a href="#" class="dropdown-option" id="app-settings-menu">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                                        </svg>
                                        <span>App Settings</span>
                                    </a>
                                    <a href="#" class="dropdown-option" id="relationships-menu">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Relationships</span>
                                    </a>
                                    <div style="border-top: 1px solid #e5e7eb; margin: 0.5rem 0;"></div>
                                    <a href="#" class="dropdown-option delete-app-menu" id="delete-app-menu">
                                        <i class="fa fa-trash" style="color: #dc3545;"></i>
                                        <span style="color: #dc3545;">Delete Application</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Context Header Area -->
                <div class="context-header">
                    <div class="context-container">
                        <div class="context-info">
                            <span class="context-label">APP:</span>
                            <span class="context-name">${this.current_app ? (this.current_app.title || this.current_app.name) : 'App Builder'}</span>
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
                            <input type="search" class="search-box" id="table-search" 
                                   placeholder="Search tables...">
                            <div class="context-counter">
                                <span class="counter-text">
                                    <span id="displayed-count">0</span> 
                                    <span class="count-total">of <span id="total-count">0</span> tables</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="container main-content">
                    <!-- Tables Section -->
                    <div class="section-wrapper">
                        <!-- Section header removed - controls moved to header -->
                        
                        <div class="tables-container tile-view" id="tables-container">
                            <!-- Tables will be loaded here -->
                        </div>
                    </div>
                    
                    <!-- No Data State -->
                    <div class="empty-state" id="empty-state" style="display: none;">
                        <div class="empty-icon">📊</div>
                        <h3>No tables yet</h3>
                        <p>Create your first table to start building your application</p>
                        <button class="btn btn-primary" id="empty-create-table">
                            Create Table
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                /* Professional, clean styling with proper spacing */
                .flansa-app-builder {
                    background: #f8f9fa;
                    min-height: calc(100vh - 60px);
                }
                
                /* Ultra-modern sleek header */
                .sleek-header {
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                    padding: 16px 24px;
                    transition: all 0.3s ease;
                }
                
                .header-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
                    opacity: 0.4;
                    z-index: -1;
                }
                
                .header-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    position: relative;
                    z-index: 2;
                }
                
                /* Breadcrumb Trail */
                .breadcrumb-trail {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.25rem;
                    font-size: 13px;
                }
                
                .breadcrumb-link {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    color: #6b7280;
                    text-decoration: none;
                    transition: color 0.2s;
                    font-weight: 500;
                }
                
                .breadcrumb-link:hover {
                    color: #4f46e5;
                }
                
                .breadcrumb-link svg {
                    opacity: 0.7;
                }
                
                .breadcrumb-divider {
                    color: #d1d5db;
                    flex-shrink: 0;
                }
                
                .breadcrumb-current {
                    color: #111827;
                    font-weight: 600;
                }
                
                /* Application Banner */
                .app-banner {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                }

                .banner-left {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .workspace-logo-container {
                    display: none;
                }

                .workspace-logo {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    object-fit: contain;
                    background: white;
                    padding: 2px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }

                .app-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .app-details {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .counter-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(102, 126, 234, 0.1);
                    color: #667eea;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    border: 1px solid rgba(102, 126, 234, 0.2);
                }

                .counter-pill svg {
                    opacity: 0.8;
                }

                .counter-pill .counter-text {
                    color: #667eea;
                    font-weight: 600;
                }

                .app-type {
                    margin-top: 2px;
                    margin-bottom: 16px;
                }

                .banner-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .title-text {
                    font-size: 1.375rem;
                    font-weight: 700;
                    color: #111827;
                    margin: 0;
                    line-height: 1.2;
                }
                
                /* Header Row */
                .header-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                /* App Info */
                .app-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                /* Workspace Logo */
                .workspace-logo-container {
                    margin-right: 0.5rem;
                }
                
                .workspace-logo {
                    height: 36px;
                    width: auto;
                    max-width: 100px;
                    object-fit: contain;
                    border-radius: 6px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                
                .app-info-inline {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .app-title {
                    font-size: 1.375rem;
                    font-weight: 700;
                    margin: 0;
                    text-transform: capitalize;
                }
                
                .app-separator {
                    color: rgba(0, 0, 0, 0.3);
                    font-weight: 500;
                }
                
                .app-status-inline {
                    font-size: 0.8125rem;
                    color: #6b7280;
                    text-transform: capitalize;
                }
                
                .app-status {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 0.25rem 0.75rem;
                    border-radius: 1rem;
                    font-size: 0.75rem;
                    text-transform: capitalize;
                }
                
                /* Header Counter */
                .header-counter {
                    margin-right: 1rem;
                    padding: 0.375rem 0.625rem;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    backdrop-filter: blur(8px);
                }
                
                .counter-text {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    line-height: 1.2;
                }
                
                .count-total {
                    color: rgba(255, 255, 255, 0.75);
                    font-weight: 400;
                }
                
                
                /* Context Header Area */
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
                    color: #475569;
                    background: rgba(248, 250, 252, 0.8);
                }
                
                .context-controls .search-box {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    color: #374151;
                    font-size: 0.875rem;
                    width: 240px;
                    transition: all 0.2s ease;
                }
                
                .context-controls .search-box::placeholder {
                    color: #9ca3af;
                }
                
                .context-controls .search-box:focus {
                    outline: none;
                    background: #ffffff;
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
                
                /* Header Actions */
                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .header-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1.25rem;
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    border-radius: 0.75rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                .header-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                    border-color: rgba(255, 255, 255, 0.4);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }
                
                .header-btn.secondary {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .header-btn.secondary:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.3);
                }
                
                /* Dropdown */
                .dropdown {
                    position: relative;
                }
                
                .dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 180px;
                    display: none;
                    z-index: 1000;
                    margin-top: 0.25rem;
                }
                
                .dropdown-menu.show {
                    display: block;
                }
                
                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    color: #4a5568;
                    text-decoration: none;
                    font-size: 0.875rem;
                    transition: background-color 0.2s;
                }
                
                .dropdown-item:hover {
                    background: #f7fafc;
                    color: #2d3748;
                }
                
                .dropdown-item i {
                    width: 16px;
                }
                
                /* Main Content */
                .main-content {
                    padding: 0 1rem 2rem;
                }
                
                /* Quick Actions */
                .quick-actions {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                
                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.5rem;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .action-btn:hover {
                    border-color: #667eea;
                    box-shadow: 0 4px 8px rgba(102, 126, 234, 0.1);
                    transform: translateY(-2px);
                }
                
                .action-btn.primary {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }
                
                .action-btn.primary:hover {
                    background: #5a67d8;
                }
                
                /* Section */
                .section-wrapper {
                    background: white;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                
                .section-meta {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .section-controls {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .item-count {
                    background: #e2e8f0;
                    color: #4a5568;
                    padding: 0.25rem 0.75rem;
                    border-radius: 1rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .count-total {
                    opacity: 0.7;
                    font-weight: 400;
                }
                
                /* View Toggle */
                .view-toggle {
                    display: flex;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.375rem;
                    overflow: hidden;
                }
                
                .view-btn {
                    padding: 0.5rem;
                    background: white;
                    border: none;
                    color: #6c757d;
                    cursor: pointer;
                    transition: all 0.2s;
                    min-width: 36px;
                }
                
                .view-btn:hover {
                    background: #f8f9fa;
                    color: #495057;
                }
                
                .view-btn.active {
                    background: #667eea;
                    color: white;
                }
                
                .view-btn + .view-btn {
                    border-left: 1px solid #e0e0e0;
                }
                
                .view-btn.active + .view-btn {
                    border-left-color: #667eea;
                }
                
                .section-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0;
                    color: #2d3748;
                }
                
                .search-box {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.5rem;
                    width: 250px;
                    font-size: 0.9rem;
                }
                
                .search-box:focus {
                    outline: none;
                    border-color: #667eea;
                }
                
                /* Tables Container */
                .tables-container.tile-view {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 24px;
                }
                
                .tables-container.list-view {
                    display: block;
                }
                
                /* Modern Tile View Cards - Match Table Builder Style */
                .tables-container.tile-view .table-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }
                
                .tables-container.tile-view .table-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    border-color: #667eea;
                }
                
                /* Tile Header - Match Table Builder */
                .tile-header {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    padding: 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                
                .tile-label {
                    font-size: 18px;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 4px 0;
                    line-height: 1.4;
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
                
                .tile-action-btn.delete-btn {
                    color: #dc3545;
                    border-color: rgba(220, 53, 69, 0.2);
                }
                
                .tile-action-btn.delete-btn:hover {
                    border-color: #dc3545;
                    background: #dc3545;
                    color: white;
                }
                
                /* Tile Body */
                .tile-body {
                    padding: 20px;
                }
                
                .tile-description {
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 16px;
                    min-height: 42px;
                }
                
                .tile-meta {
                    display: flex;
                    gap: 16px;
                    align-items: center;
                }
                
                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    color: #6b7280;
                    font-weight: 500;
                }
                
                .meta-item svg {
                    opacity: 0.7;
                }
                
                /* List View Cards */
                .tables-container.list-view .table-card {
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .tables-container.list-view .table-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
                }
                
                .tables-container.list-view .table-card .table-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex: 1;
                }
                
                .tables-container.list-view .table-card .table-name {
                    margin-bottom: 0;
                    min-width: 200px;
                }
                
                .tables-container.list-view .table-card .table-description {
                    color: #6c757d;
                    font-size: 0.875rem;
                    flex: 1;
                }
                
                .tables-container.list-view .table-card .table-actions {
                    margin: 0;
                    padding: 0;
                    border: none;
                }
                
                .table-name {
                    font-weight: 600;
                    font-size: 1.1rem;
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }
                
                .table-meta {
                    display: flex;
                    gap: 1rem;
                    color: #6c757d;
                    font-size: 0.875rem;
                    margin-top: 0.75rem;
                }
                
                .table-actions {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid #e0e0e0;
                }
                
                .table-action-btn {
                    flex: 1;
                    padding: 0.5rem;
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }
                
                .table-action-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }
                
                /* Enterprise Data Grid for List View */
                .enterprise-data-grid {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    border: 1px solid #e2e8f0;
                }

                .data-grid-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }

                .data-grid-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
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

                .data-grid-body td:last-child {
                    border-right: none;
                }

                .cell-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .table-label {
                    font-weight: 600;
                    color: #1f2937;
                }

                .table-name-code {
                    background: #f3f4f6;
                    color: #4b5563;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 12px;
                    font-weight: 500;
                }

                .table-description {
                    color: #6b7280;
                    font-size: 13px;
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .fields-count {
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

                .action-btn i {
                    font-size: 12px;
                }
                
                /* Empty State */
                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                    background: white;
                    border-radius: 0.75rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .empty-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                
                .empty-state h3 {
                    font-size: 1.5rem;
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }
                
                .empty-state p {
                    color: #6c757d;
                    margin-bottom: 1.5rem;
                }
                
                /* Sleek Button Styles */
                .sleek-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    text-decoration: none;
                }
                
                .sleek-btn.primary {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                    box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3);
                }
                
                .sleek-btn.primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                }
                
                .sleek-btn.split-btn {
                    padding-right: 2.5rem;
                    position: relative;
                }
                
                .sleek-btn.split-btn .dropdown-arrow {
                    position: absolute;
                    right: 0.75rem;
                    opacity: 0.8;
                }
                
                .sleek-btn.secondary {
                    background: white;
                    color: #6b7280;
                    border: 1px solid #e5e7eb;
                    padding: 0.5rem;
                    min-width: 36px;
                    justify-content: center;
                }
                
                .sleek-btn.secondary:hover {
                    background: #f9fafb;
                    color: #4f46e5;
                    border-color: #4f46e5;
                }
                
                .sleek-btn svg {
                    flex-shrink: 0;
                }
                
                /* Modern Dropdown */
                .action-dropdown {
                    position: relative;
                }
                
                .dropdown-panel {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    background: white;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    border-radius: 12px;
                    padding: 0.5rem;
                    min-width: 200px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                    display: none;
                    z-index: 1000;
                }
                
                .dropdown-option {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    color: #374151;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.15s ease;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .dropdown-option:hover {
                    background: #f3f4f6;
                    color: #1f2937;
                }
                
                .dropdown-option svg {
                    opacity: 0.7;
                    flex-shrink: 0;
                }
                
                .dropdown-panel.show {
                    display: block;
                    animation: dropdownFade 0.2s ease;
                }
                
                @keyframes dropdownFade {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>
        `).appendTo(this.page.main);
    }
    
    load_data() {
        // Setup header first (this should work now that page is ready)
        this.setup_header();
        
        
        if (!this.app_id) {
            // Show app selector if no app selected
            this.show_app_selector();
            return;
        }
        
        // Load application data using existing APIs
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Application',
                name: this.app_id
            },
            callback: (r) => {
                if (r.message) {
                    this.current_app = r.message;
                    this.update_banner_info(); // Update banner with loaded app data
                    this.load_tables_data();
                } else {
                    console.error('❌ Failed to load application data:', r);
                    frappe.msgprint('Failed to load application data');
                }
            }
        });
    }
    
    load_tables_data() {
        // Load tables for this application
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Flansa Table',
                filters: {
                    application: this.app_id
                },
                fields: ['name', 'table_name', 'table_label', 'description', 'doctype_name']
            },
            callback: (r) => {
                if (r.message) {
                    this.current_tables = r.message;
                    this.fetch_dynamic_counts();
                } else {
                    this.current_tables = [];
                    this.render_app_data();
                }
            }
        });
    }
    
    async fetch_dynamic_counts() {
        // Fetch both record counts and field counts for each table dynamically
        if (!this.current_tables || this.current_tables.length === 0) {
            this.render_app_data();
            return;
        }
        
        try {
            // Create promises for all count requests
            const countPromises = this.current_tables.map(async (table) => {
                if (table.doctype_name) {
                    try {
                        // Get record count
                        const recordCountResult = await frappe.call({
                            method: 'frappe.client.get_count',
                            args: {
                                doctype: table.doctype_name
                            }
                        });
                        table.record_count = recordCountResult.message || 0;

                        // Get actual field count from DocType meta
                        const metaResult = await frappe.call({
                            method: 'frappe.client.get',
                            args: {
                                doctype: 'DocType',
                                name: table.doctype_name
                            }
                        });
                        
                        if (metaResult.message && metaResult.message.fields) {
                            // Count only user-created fields (exclude standard/system/flansa fields)
                            const userFields = metaResult.message.fields.filter(field => {
                                // Standard system fields to exclude
                                const systemFields = [
                                    'name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus',
                                    'parent', 'parentfield', 'parenttype', 'idx', '_user_tags', '_comments',
                                    '_assign', '_liked_by', 'title', 'naming_series'
                                ];
                                
                                // Flansa-specific system fields to exclude
                                const flansaFields = [
                                    'tenant', 'application', 'application_id', 'table_id', 'tenant_id'
                                ];
                                
                                // Exclude system fields, flansa fields, and fields marked as standard
                                return !systemFields.includes(field.fieldname) && 
                                       !flansaFields.includes(field.fieldname) && 
                                       !field.is_standard;
                            });
                            
                            table.fields_count = userFields.length;
                        } else {
                            // Fallback to the stored value or 0
                            table.fields_count = table.fields_count || 0;
                        }
                        
                    } catch (error) {
                        console.warn(`Failed to get counts for ${table.doctype_name}:`, error);
                        table.record_count = 0;
                        table.fields_count = table.fields_count || 0;
                    }
                } else {
                    table.record_count = 0;
                    table.fields_count = 0;
                }
            });
            
            // Wait for all count requests to complete
            await Promise.all(countPromises);
            
        } catch (error) {
            console.warn('Error fetching counts:', error);
            // Set default counts
            this.current_tables.forEach(table => {
                if (table.record_count === undefined) {
                    table.record_count = 0;
                }
                if (table.fields_count === undefined) {
                    table.fields_count = 0;
                }
            });
        }
        
        // Now render with complete data
        this.render_app_data();
    }
    
    render_app_data() {
        if (!this.current_app) return;
        
        // Update header
        this.page.$app_builder.find('.app-title').text(this.current_app.app_name || this.current_app.name);
        this.page.$app_builder.find('.app-status').text(this.current_app.status || 'Active');
        
        // Update counts
        this.updateCounts();
        
        // Render tables
        this.render_tables(this.current_tables);
        
        // Setup search functionality
        this.setupSearch();
    }
    
    updateCounts(filteredTables = null) {
        const displayed = filteredTables ? filteredTables.length : this.current_tables.length;
        const total = this.current_tables.length;
        
        // Always show in "X of Y" format
        this.page.$app_builder.find('#displayed-count').text(displayed);
        this.page.$app_builder.find('#total-count').text(total);
        
        // Always show the count total
        const countTotal = this.page.$app_builder.find('.count-total');
        countTotal.show();
    }
    
    setupSearch() {
        const searchBox = this.page.$app_builder.find('#table-search');
        
        searchBox.on('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.filterTables(query);
        });
        
        // Setup view toggle
        this.setupViewToggle();
    }
    
    setupViewToggle() {
        this.currentView = 'grid'; // Default view
        
        this.page.$app_builder.find('.view-btn').on('click', (e) => {
            const newView = $(e.currentTarget).data('view');
            if (newView !== this.view_mode) {
                this.toggle_view_mode(newView);
            }
        });
    }
    
    toggle_view_mode(view) {
        this.view_mode = view;
        this.update_view_toggle_button();
        this.render_tables(this.current_tables);
    }
    
    update_view_toggle_button() {
        // Update button states
        this.page.$app_builder.find('.view-btn').removeClass('active');
        this.page.$app_builder.find(`.view-btn[data-view="${this.view_mode}"]`).addClass('active');
        
        // Update container class
        const container = this.page.$app_builder.find('#tables-container');
        container.removeClass('tile-view list-view').addClass(`${this.view_mode}-view`);
    }
    
    setup_table_sorting() {
        // Sorting functionality for table view
        this.page.$app_builder.find('.sortable-header').on('click', (e) => {
            const column = $(e.currentTarget).data('column');
            const sortIcon = $(e.currentTarget).find('.sort-icon');
            const currentSort = sortIcon.data('sort') || 'none';
            
            // Reset all other sort icons
            this.page.$app_builder.find('.sort-icon').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort').data('sort', 'none');
            
            // Toggle current column sort
            let newSort = 'asc';
            if (currentSort === 'asc') newSort = 'desc';
            else if (currentSort === 'desc') newSort = 'none';
            
            if (newSort === 'none') {
                sortIcon.removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
                // Reset to original order
                this.render_tables(this.current_tables);
            } else {
                sortIcon.removeClass('fa-sort fa-sort-up fa-sort-down').addClass(newSort === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
                // Sort the tables
                this.sort_tables(column, newSort);
            }
            
            sortIcon.data('sort', newSort);
        });
    }
    
    sort_tables(column, direction) {
        const sortedTables = [...this.current_tables].sort((a, b) => {
            let aVal = '', bVal = '';
            
            switch(column) {
                case 'label':
                    aVal = a.table_label || a.table_name || '';
                    bVal = b.table_label || b.table_name || '';
                    break;
                case 'name':
                    aVal = a.name || '';
                    bVal = b.name || '';
                    break;
                case 'description':
                    aVal = a.description || '';
                    bVal = b.description || '';
                    break;
                case 'fields':
                    aVal = a.fields_count || 0;
                    bVal = b.fields_count || 0;
                    break;
            }
            
            if (typeof aVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            } else {
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
        });
        
        this.render_tables(sortedTables);
    }
    
    getCurrentDisplayedTables() {
        // Get currently filtered tables based on search
        const searchQuery = this.page.$app_builder.find('#table-search').val().toLowerCase();
        if (!searchQuery) {
            return this.current_tables;
        }
        
        return this.current_tables.filter(table => 
            (table.table_name && table.table_name.toLowerCase().includes(searchQuery)) ||
            (table.table_label && table.table_label.toLowerCase().includes(searchQuery)) ||
            (table.description && table.description.toLowerCase().includes(searchQuery))
        );
    }
    
    filterTables(query) {
        if (!query) {
            // Show all tables
            this.render_tables(this.current_tables);
            this.updateCounts();
        } else {
            // Filter tables
            const filtered = this.current_tables.filter(table => 
                (table.table_name && table.table_name.toLowerCase().includes(query)) ||
                (table.table_label && table.table_label.toLowerCase().includes(query)) ||
                (table.description && table.description.toLowerCase().includes(query))
            );
            
            this.render_tables(filtered);
            this.updateCounts(filtered);
        }
    }
    
    render_tables(tables) {
        const container = this.page.$app_builder.find('#tables-container');
        const emptyState = this.page.$app_builder.find('#empty-state');
        
        if (!tables || tables.length === 0) {
            container.hide();
            emptyState.show();
            return;
        }
        
        container.show();
        emptyState.hide();
        
        if (this.view_mode === 'list') {
            this.render_list_view(tables);
        } else {
            this.render_tile_view(tables);
        }
    }
    
    render_list_view(tables) {
        const container = this.page.$app_builder.find('#tables-container');
        
        // Create enterprise data grid similar to Table Builder
        container.html(`
            <div class="enterprise-data-grid">
                <table class="data-grid-table">
                    <thead class="data-grid-header">
                        <tr>
                            <th class="sortable-header" data-column="label">
                                <div class="header-content">
                                    <span class="header-text">Table Name</span>
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
                            <th class="sortable-header" data-column="fields">
                                <div class="header-content">
                                    <span class="header-text">Fields</span>
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
                        ${this.render_table_rows(tables)}
                    </tbody>
                </table>
            </div>
        `);
        
        // Setup sorting functionality
        this.setup_table_sorting();
    }
    
    render_table_rows(tables) {
        return tables.map(table => {
            const tableName = table.table_name || table.name;
            const tableLabel = table.table_label || tableName;
            const description = table.description || 'No description provided';
            const fieldsCount = table.fields_count || 0;
            
            return `
                <tr class="data-grid-row" data-table-name="${table.name}">
                    <td class="table-label-cell">
                        <div class="cell-content">
                            <span class="table-label">${tableLabel}</span>
                        </div>
                    </td>
                    <td class="table-name-cell">
                        <div class="cell-content">
                            <code class="table-name-code">${table.name}</code>
                        </div>
                    </td>
                    <td class="table-description-cell">
                        <div class="cell-content">
                            <span class="table-description">${description}</span>
                        </div>
                    </td>
                    <td class="table-fields-cell">
                        <div class="cell-content">
                            <span class="fields-count">${fieldsCount} fields</span>
                        </div>
                    </td>
                    <td class="table-actions-cell">
                        <div class="cell-content action-buttons">
                            <button class="action-btn edit-btn tile-action-btn" data-action="edit" data-table="${table.name}" title="Edit Structure">
                                <i class="fa fa-edit"></i>
                            </button>
                            <button class="action-btn view-btn tile-action-btn" data-action="view" data-table="${table.name}" title="View Records">
                                <i class="fa fa-table"></i>
                            </button>
                            <button class="action-btn form-btn tile-action-btn" data-action="form" data-table="${table.name}" title="Form Builder">
                                <i class="fa fa-wpforms"></i>
                            </button>
                            <button class="action-btn delete-btn tile-action-btn" data-action="delete" data-table="${table.name}" title="Delete Table">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    render_tile_view(tables) {
        const container = this.page.$app_builder.find('#tables-container');
        container.empty();
        
        tables.forEach(table => {
            // Tile/Grid view layout (default)
            const card = $(`
                    <div class="table-card" data-table-id="${table.name}">
                        <div class="tile-header">
                            <div>
                                <div class="tile-label">${table.table_label || table.table_name}</div>
                                <div class="tile-field-name">
                                    <code style="font-size: 0.75rem; color: #6b7280; background: rgba(107, 114, 128, 0.1); padding: 2px 6px; border-radius: 4px;">${table.name}</code>
                                </div>
                            </div>
                            <div class="tile-actions">
                                <button class="tile-action-btn" data-action="edit" data-table="${table.name}" title="Edit Structure">
                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                                <button class="tile-action-btn" data-action="view" data-table="${table.name}" title="View Data">
                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                                <button class="tile-action-btn" data-action="form" data-table="${table.name}" title="Form Builder">
                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2v8h12V6H4z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                                <button class="tile-action-btn delete-btn" data-action="delete" data-table="${table.name}" title="Delete Table">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="tile-body">
                            <div class="tile-description">${table.description || 'No description provided'}</div>
                            <div class="tile-meta">
                                <div class="meta-item">
                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                                    </svg>
                                    <span>${table.fields_count || 0} fields</span>
                                </div>
                                <div class="meta-item">
                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                                    </svg>
                                    <span>${table.record_count || 0} records</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
            
            container.append(card);
        });
    }
    
    bind_events() {
        const $builder = this.page.$app_builder;
        
        // Header action buttons - New dropdown structure
        $builder.on('click', '#create-table-header', (e) => {
            e.stopPropagation();
            const dropdown = $builder.find('#table-options-dropdown');
            dropdown.toggleClass('show');
        });
        
        $builder.on('click', '#context-menu', (e) => {
            e.stopPropagation();
            const dropdown = $builder.find('#context-dropdown');
            dropdown.toggleClass('show');
        });
        
        // Close dropdown when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.action-dropdown').length) {
                $builder.find('.dropdown-panel').removeClass('show');
            }
        });
        
        // Table creation options
        $builder.on('click', '#create-blank-table', (e) => {
            e.preventDefault();
            try {
                this.show_table_creation_dialog();
            } catch (error) {
                console.error('❌ Error opening table creation dialog:', error);
                frappe.show_alert({
                    message: 'Error opening table creation dialog: ' + error.message,
                    indicator: 'red'
                });
            }
        });
        
        $builder.on('click', '#import-table', (e) => {
            e.preventDefault();
            this.show_import_dialog();
        });
        
        // Context menu actions
        $builder.on('click', '#app-settings-menu', (e) => {
            e.preventDefault();
            frappe.set_route('Form', 'Flansa Application', this.app_id);
        });
        
        
        $builder.on('click', '#relationships-menu', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-relationship-builder/${this.app_id}`;
        });
        
        
        // Multiple ways to handle delete app menu click
        $builder.on('click', '#delete-app-menu', (e) => {
            e.preventDefault();
            console.log('🗑️ Delete app menu clicked via ID selector, app_id:', this.app_id);
            
            if (!this.app_id) {
                frappe.show_alert('❌ No application selected', 'red');
                return;
            }
            
            this.delete_application(this.app_id);
        });
        
        // Alternative handler using class selector
        $builder.on('click', '.delete-app-menu', (e) => {
            e.preventDefault();
            console.log('🗑️ Delete app menu clicked via class selector, app_id:', this.app_id);
            
            if (!this.app_id) {
                frappe.show_alert('❌ No application selected', 'red');
                return;
            }
            
            this.delete_application(this.app_id);
        });
        
        // Debug: Log all clicks on dropdown options
        $builder.on('click', '.dropdown-option', (e) => {
            console.log('🔍 Dropdown option clicked:', e.target.id, e.target.className);
        });
        
        // Debug: Log context dropdown button clicks
        $builder.on('click', '#context-menu-btn', (e) => {
            console.log('🔍 Context menu button clicked');
        });
        
        // Empty state create button
        $builder.on('click', '#empty-create-table', () => {
            this.create_table_dialog();
        });
        
        $builder.on('click', '#import-data-btn', () => {
            frappe.msgprint('Import feature coming soon');
        });
        
        $builder.on('click', '#relationships-btn', () => {
            window.location.href = `/app/flansa-relationship-builder?app=${this.app_id}`;
        });
        
        $builder.on('click', '#reports-btn', () => {
            window.location.href = `/app/flansa-report-builder?app=${this.app_id}`;
        });
        
        // Table actions (support both old and new tile styling)
        $builder.on('click', '.table-action-btn, .tile-action-btn', (e) => {
            e.stopPropagation();
            const action = $(e.target).closest('button').data('action');
            const tableId = $(e.target).closest('button').data('table');
            
            switch(action) {
                case 'edit':
                    window.location.href = `/app/flansa-table-builder?table=${tableId}`;
                    break;
                case 'view':
                    window.location.href = `/app/flansa-report-viewer/${tableId}`;
                    break;
                case 'form':
                    window.location.href = `/app/flansa-form-builder?table=${tableId}`;
                    break;
                case 'delete':
                    this.delete_table(tableId);
                    break;
            }
        });
        
        // Table card click
        $builder.on('click', '.table-card', (e) => {
            if (!$(e.target).hasClass('table-action-btn')) {
                const tableId = $(e.currentTarget).data('table-id');
                window.location.href = `/app/flansa-table-builder?table=${tableId}`;
            }
        });
        
        // Search is handled by setupSearch() method - removed duplicate handler
    }
    
    show_table_creation_dialog() {
        try {
            // First try a simple test dialog
            if (window.location.search.includes('debug=simple')) {
                console.log('🧪 Creating simple test dialog...');
                const testDialog = new frappe.ui.Dialog({
                    title: 'Test Dialog',
                    fields: [
                        {
                            fieldname: 'test_field',
                            fieldtype: 'Data',
                            label: 'Test Field'
                        }
                    ]
                });
                testDialog.show();
                return;
            }
            
            // Use the existing create table dialog functionality
            this.create_table_dialog();
        } catch (error) {
            console.error('❌ Error in show_table_creation_dialog:', error);
            throw error;
        }
    }
    
    show_import_dialog() {
        frappe.msgprint({
            title: 'Import Data',
            message: 'Import feature coming soon. You can create tables and add data manually for now.',
            indicator: 'blue'
        });
    }
    
    create_table_dialog() {
        try {
            
            // Auto-populate table name from display label
            const generateTableName = (label) => {
                if (!label) return '';
                
                // Convert to lowercase, replace spaces with underscores, remove special characters
                let tableName = label.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                    .trim()
                    .replace(/\s+/g, '_'); // Replace spaces with underscores
                
                // Ensure it starts with a letter
                if (tableName && !tableName.match(/^[a-z]/)) {
                    tableName = 't_' + tableName;
                }
                
                // Truncate if too long (Frappe DocType names should be <= 61 characters)
                if (tableName.length > 61) {
                    tableName = tableName.substring(0, 61);
                }
                
                return tableName;
            };
            
            const dialog = new frappe.ui.Dialog({
            title: 'Add Table',
            size: 'large',
            fields: [
                {
                    fieldname: 'table_label',
                    label: 'Display Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'User-friendly name (e.g., Customer Orders)',
                    change: function() {
                        const labelValue = this.get_value();
                        
                        if (labelValue) {
                            const tableName = generateTableName(labelValue);
                            dialog.set_value('table_name', tableName);
                        }
                    }
                },
                {
                    fieldname: 'table_name',
                    label: 'Table Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Auto-generated from display label (e.g., customer_orders)',
                    read_only: 1
                },
                {
                    fieldname: 'description',
                    label: 'Description',
                    fieldtype: 'Text',
                    description: 'Brief description of the table purpose'
                },
            ],
            primary_action_label: 'Create Table',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.api.table_management.create_flansa_table',
                    args: {
                        app_id: this.app_id,
                        table_name: values.table_name,
                        table_label: values.table_label,
                        description: values.description
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            dialog.hide();
                            frappe.show_alert({
                                message: 'Table created successfully',
                                indicator: 'green'
                            });
                            
                            // Navigate to table builder
                            setTimeout(() => {
                                window.location.href = `/app/flansa-table-builder?table=${r.message.table_name}`;
                            }, 1000);
                        }
                    }
                });
            }
        });
        
        // Validate required fields before submit
        const originalAction = dialog.primary_action;
        dialog.primary_action = function(values) {
            // Additional validation
            if (!values.table_label || !values.table_label.trim()) {
                frappe.msgprint('Display Label is required');
                return;
            }
            
            if (!values.table_name || !values.table_name.trim()) {
                frappe.msgprint('Table Name is required');
                return;
            }
            
            // Validate table name format one more time
            if (!values.table_name.match(/^[a-z][a-z0-9_]*$/)) {
                frappe.msgprint('Invalid table name format');
                return;
            }
            
            // Check for naming configuration completeness
            if (values.naming_type === 'Naming Series' && !values.naming_prefix) {
                frappe.msgprint('Prefix is required for Naming Series naming type');
                return;
            }
            
            if (values.naming_type === 'Field Based' && !values.naming_field) {
                frappe.msgprint('Field name is required for Field Based naming type');
                return;
            }
            
            // Call original action
            originalAction.call(dialog, values);
        };
        
        // Show the dialog
        dialog.show();
        
        } catch (error) {
            frappe.show_alert({
                message: 'Error creating table dialog: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    show_app_selector() {
        // Show application selector if no app is selected
        frappe.call({
            method: 'flansa.flansa_core.api.app_management.get_user_applications',
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    // Navigate to first app
                    window.location.href = `/app/flansa-app-builder/${r.message[0].name}`;
                } else {
                    this.show_create_first_app();
                }
            }
        });
    }
    
    show_create_first_app() {
        this.page.$app_builder.find('.app-title').text('Welcome to Flansa');
        this.page.$app_builder.find('.app-description').text('Create your first application to get started');
        this.page.$app_builder.find('#empty-state').show();
    }
    
    create_new_app() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create New Application',
            fields: [
                {
                    fieldname: 'app_name',
                    label: 'Application Name',
                    fieldtype: 'Data',
                    reqd: 1
                },
                {
                    fieldname: 'description',
                    label: 'Description',
                    fieldtype: 'Text'
                }
            ],
            primary_action_label: 'Create',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.api.app_management.create_application',
                    args: values,
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            dialog.hide();
                            window.location.href = `/app/flansa-app-builder/${r.message.app_id}`;
                        }
                    }
                });
            }
        });
        
        // Show the dialog
        try {
            dialog.show();
        } catch (showError) {
            console.error('❌ Error in dialog.show():', showError);
            // Try manual modal showing
            dialog.$wrapper.modal('show');
        }
    }
    
    app_settings() {
        frappe.set_route('Form', 'Flansa Application', this.app_id);
    }
    
    async load_workspace_logo() {
        try {
            // Try to get workspace logo if workspace system is available
            const result = await frappe.call({
                method: 'flansa.flansa_core.tenant_service.get_workspace_logo',
                args: {},
                freeze: false,
                quiet: true // Don't show errors if method doesn't exist
            });
            
            if (result.message && result.message.logo) {
                const logoContainer = document.getElementById('workspace-logo-container');
                const logoImg = document.getElementById('workspace-logo');
                
                if (logoContainer && logoImg) {
                    logoImg.src = result.message.logo;
                    logoContainer.style.display = 'block';
                }
            }
        } catch (error) {
            // Silently fail if workspace system isn't available
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
                        `<div style="max-width: 600px;">
                        <h4>⚠️ Clean Delete Table</h4>
                        <p>This will <strong>permanently delete</strong>:</p>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 12px 0; font-family: monospace; font-size: 13px; border-left: 4px solid #dc3545;">
                        • ${items}
                        </div>
                        <p><strong style="color: #d73527;">⚠️ This action cannot be undone and will remove ALL data, fields, forms, reports, and relationships!</strong></p>
                        <p>Are you sure you want to permanently delete this table and all its associated data?</p>
                        </div>`,
                        () => {
                            // User confirmed - proceed with deletion
                            frappe.call({
                                method: 'flansa.flansa_core.api.clean_delete.clean_delete_table',
                                args: {
                                    table_name: table_name
                                },
                                callback: (delete_r) => {
                                    if (delete_r.message && delete_r.message.success) {
                                        frappe.show_alert('✅ Table deleted successfully', 'green');
                                        // Reload the tables
                                        this.load_tables_data();
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
                                        
                                        // Navigate back to workspace after successful deletion
                                        setTimeout(() => {
                                            window.location.href = '/app/flansa-workspace';
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
}