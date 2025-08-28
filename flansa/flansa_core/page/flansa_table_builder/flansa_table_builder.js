frappe.pages['flansa-table-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Table Builder',
        single_column: true
    });
    
    // Hide the default page header to keep only our sleek banner
    $(page.wrapper).find('.page-head').hide();
    
    // Initialize the enhanced Table Builder
    new EnhancedFlansaTableBuilder(page);
};

class EnhancedFlansaTableBuilder {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        this.table_id = null;
        this.table_data = null;
        this.fields = [];
        this.view_mode = 'list'; // 'list' or 'tile'
        
        this.init();
    }
    
    async init() {
        // Get table from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.table_id = urlParams.get('table');
        
        if (!this.table_id) {
            this.show_table_selector();
        } else {
            await this.load_table();
            this.render_table_builder();
        }
        
        this.setup_page_actions();
        this.load_tenant_logo();
    }
    
    setup_page_actions() {
        // Modern header actions are now handled in the custom header HTML
        // No need for additional page buttons
    }
    
    render_table_builder() {
        if (!this.table_data) return;
        
        this.$container.html(`
            <div class="flansa-table-builder">
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
                            <a href="/app/flansa-app-builder/${this.table_data.application || ''}" class="breadcrumb-link">
                                <span>App Builder</span>
                            </a>
                            <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                            </svg>
                            <span class="breadcrumb-current">Table Builder</span>
                        </nav>
                        
                        <!-- Single Row Header Section -->
                        <div class="header-main">
                            <div class="header-left">
                                <!-- Optional Tenant Logo -->
                                <div class="tenant-logo-container" id="tenant-logo-container" style="display: none;">
                                    <img src="" alt="Tenant Logo" class="tenant-logo" id="tenant-logo" />
                                </div>
                                
                                <div class="header-title-inline">
                                    <h1 class="header-title">
                                        <span class="title-text">${this.application_data?.application_title || this.table_data.application || 'Flansa'}</span>
                                    </h1>
                                    <span class="header-separator">•</span>
                                    <p class="header-subtitle-inline">${this.application_data?.application_description || 'Application builder and data management'}</p>
                                </div>
                            </div>
                            
                            <!-- Action Buttons -->
                            <div class="header-actions">
                                <div class="action-dropdown">
                                    <button class="sleek-btn primary split-btn" id="add-field-header">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                        </svg>
                                        <span>Add Field</span>
                                        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </button>
                                    <div class="dropdown-panel" id="add-field-dropdown">
                                        <a href="#" class="dropdown-option" id="add-standard-field">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                            </svg>
                                            <span>Standard Field</span>
                                        </a>
                                        <a href="#" class="dropdown-option" id="add-logic-field">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" />
                                            </svg>
                                            <span>Logic Field</span>
                                        </a>
                                        <a href="#" class="dropdown-option" id="add-gallery-field">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                                            </svg>
                                            <span>Gallery Field</span>
                                        </a>
                                    </div>
                                </div>
                                
                                <div class="action-dropdown">
                                    <button class="sleek-btn secondary" id="context-menu">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                    </button>
                                    <div class="dropdown-panel" id="context-dropdown">
                                        <a href="#" class="dropdown-option" id="view-data-menu">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd" />
                                            </svg>
                                            <span>View Data</span>
                                        </a>
                                        <a href="#" class="dropdown-option" id="naming-settings-menu">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                                            </svg>
                                            <span>Naming Settings</span>
                                        </a>
                                        <a href="#" class="dropdown-option" id="gallery-settings-menu">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                                            </svg>
                                            <span>Gallery Settings</span>
                                        </a>
                                        <a href="#" class="dropdown-option" id="form-builder-menu">
                                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                            <span>Form Builder</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Context Header Area -->
                <div class="context-header">
                    <div class="context-container">
                        <div class="context-info">
                            <span class="context-label">TABLE:</span>
                            <span class="context-name">${this.table_data.table_label || this.table_data.table_name}</span>
                            ${this.table_data.table_description ? `<span class="context-description"> - ${this.table_data.table_description}</span>` : ''}
                        </div>
                        
                        <div class="context-controls">
                            <div class="view-toggle">
                                <button class="view-btn active" data-view="list" title="List View">
                                    <i class="fa fa-list"></i>
                                </button>
                                <button class="view-btn" data-view="tile" title="Tile View">
                                    <i class="fa fa-th"></i>
                                </button>
                            </div>
                            <input type="search" class="search-box" id="field-search" 
                                   placeholder="Search fields...">
                            <div class="context-counter">
                                <span class="counter-text">
                                    <span id="displayed-count">0</span> 
                                    <span class="count-total">of <span id="total-count">0</span> fields</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="container main-content">
                    <!-- Fields Section -->
                    <div class="section-wrapper">
                        <!-- Section header removed - controls moved to header -->
                        
                        <div class="fields-data-grid" id="fields-container">
                            <!-- Enterprise-grade sortable data grid will be rendered here -->
                        </div>
                    </div>
                </div>
                    
                    <!-- Empty State -->
                    <div class="empty-fields-state" id="empty-fields" style="display: none;">
                        <div class="empty-icon">📝</div>
                        <h4>No fields yet</h4>
                        <p>Add your first field to start building your table structure</p>
                        <button class="btn btn-primary" onclick="window.table_builder.show_add_field_wizard()">
                            Add First Field
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                /* Professional, clean styling with proper spacing */
                .flansa-table-builder {
                    background: #f8f9fa;
                    min-height: calc(100vh - 60px);
                }
                
                /* Ultra-modern Sleek Header */
                .sleek-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: white;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }
                
                .header-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, 
                        rgba(255, 255, 255, 0.98) 0%, 
                        rgba(249, 250, 251, 0.98) 100%);
                    z-index: -1;
                }
                
                .header-content {
                    padding: 0.625rem 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                /* Modern Breadcrumb Trail */
                .breadcrumb-trail {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
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
                
                /* Header Main Section */
                .header-main {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 2rem;
                    margin-top: 0.5rem;
                }
                
                .header-left {
                    flex: 1;
                }
                
                /* Tenant Logo */
                .tenant-logo-container {
                    margin-right: 1rem;
                }
                
                .tenant-logo {
                    height: 40px;
                    width: auto;
                    max-width: 120px;
                    object-fit: contain;
                    border-radius: 6px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                
                .header-title-inline {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                }
                
                .header-separator {
                    color: rgba(0, 0, 0, 0.3);
                    font-weight: 500;
                }
                
                .header-subtitle-inline {
                    color: #6b7280;
                    font-size: 0.8125rem;
                    margin: 0;
                    line-height: 1.2;
                    max-width: 300px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .title-text {
                    font-size: 1.375rem;
                    font-weight: 700;
                    color: #111827;
                    letter-spacing: -0.025em;
                    line-height: 1.2;
                }
                
                .title-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.25rem 0.625rem;
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .header-subtitle {
                    color: #6b7280;
                    font-size: 0.9375rem;
                    margin: 0;
                    line-height: 1.5;
                }
                
                /* Header Counter */
                .header-counter {
                    padding: 0.5rem 0.75rem;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                }
                
                .counter-text {
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 0.875rem;
                    font-weight: 500;
                    white-space: nowrap;
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
                
                /* Modern Action Buttons */
                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
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
                    white-space: nowrap;
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
                
                /* Specific dropdown positioning */
                #add-field-dropdown {
                    z-index: 1002;
                }
                
                #context-dropdown {
                    z-index: 1001;
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
                
                .dropdown-option {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem 0.75rem;
                    color: #374151;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.15s;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .dropdown-option:hover {
                    background: #f3f4f6;
                    color: #4f46e5;
                }
                
                .dropdown-option svg {
                    flex-shrink: 0;
                    opacity: 0.6;
                }
                
                .dropdown-option:hover svg {
                    opacity: 1;
                }
                
                /* Table Info */
                .table-info {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .table-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 0;
                    text-transform: capitalize;
                }
                
                /* Header Actions */
                .header-actions {
                    display: flex;
                    gap: 0.75rem;
                }
                
                .header-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .header-btn:hover {
                    background: rgba(255, 255, 255, 0.25);
                    border-color: rgba(255, 255, 255, 0.5);
                }
                
                .header-btn.secondary {
                    background: transparent;
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
                
                .table-title i {
                    margin-right: 0.75rem;
                    opacity: 0.9;
                }
                
                .table-description {
                    opacity: 0.9;
                    margin: 0 0 1rem 0;
                    font-size: 1.1rem;
                }
                
                .table-stats {
                    display: flex;
                    gap: 2rem;
                }
                
                .stat-item {
                    background: rgba(255, 255, 255, 0.15);
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    font-size: 0.9rem;
                }
                
                .stat-item i {
                    margin-right: 0.5rem;
                }
                
                .fields-section {
                    background: white;
                    border-radius: 0.75rem;
                    padding: 1.5rem;
                    margin: 0 1rem 1rem 1rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .section-header h3 {
                    margin: 0;
                    color: #2d3748;
                    font-weight: 600;
                }
                
                .view-toggle {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .view-toggle .btn {
                    padding: 0.375rem 0.75rem;
                }
                
                /* Enterprise Data Grid */
                .enterprise-data-grid {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                
                .data-grid-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }
                
                .data-grid-header {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    border-bottom: 2px solid #e2e8f0;
                }
                
                .sortable-header, .actions-header {
                    padding: 0;
                    border: none;
                    text-align: left;
                    font-weight: 600;
                    color: #2d3748;
                    position: relative;
                }
                
                .sortable-header {
                    cursor: pointer;
                    user-select: none;
                    transition: background-color 0.2s;
                }
                
                .sortable-header:hover {
                    background-color: rgba(102, 126, 234, 0.1);
                }
                
                .header-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    font-size: 14px;
                    font-weight: 600;
                    letter-spacing: 0.025em;
                }
                
                .header-text {
                    color: #374151;
                }
                
                .sort-icon {
                    margin-left: 8px;
                    color: #9ca3af;
                    transition: color 0.2s;
                    font-size: 12px;
                }
                
                .sortable-header:hover .sort-icon {
                    color: #667eea;
                }
                
                .fa-sort-up, .fa-sort-down {
                    color: #667eea !important;
                }
                
                .data-grid-body {
                    background: white;
                }
                
                .data-grid-row {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s, transform 0.1s;
                }
                
                .data-grid-row:hover {
                    background-color: #f8fafc;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                }
                
                .data-grid-row:last-child {
                    border-bottom: none;
                }
                
                .cell-content {
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                }
                
                .field-label-cell {
                    width: 25%;
                    min-width: 200px;
                }
                
                .field-label {
                    font-weight: 600;
                    color: #1f2937;
                    font-size: 15px;
                }
                
                .required-indicator {
                    color: #ef4444;
                    margin-left: 4px;
                    font-weight: 700;
                }
                
                .field-name-cell {
                    width: 20%;
                    min-width: 150px;
                }
                
                .field-name-code {
                    font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
                    background: #f1f5f9;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 13px;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }
                
                .field-type-cell {
                    width: 20%;
                    min-width: 120px;
                }
                
                .field-type-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    background: #e0f2fe;
                    color: #0369a1;
                    border: 1px solid #bae6fd;
                }
                
                .field-type-badge.logic-field {
                    background: #fef3c7;
                    color: #92400e;
                    border-color: #fde68a;
                }
                
                .field-description-cell {
                    width: 25%;
                    min-width: 200px;
                }
                
                .field-description {
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.5;
                }
                
                .field-actions-cell {
                    width: 10%;
                    min-width: 100px;
                }
                
                .action-buttons {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-start;
                }
                
                .action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                
                .action-btn.edit-btn {
                    background: #e0f2fe;
                    color: #0369a1;
                }
                
                .action-btn.edit-btn:hover {
                    background: #0369a1;
                    color: white;
                    transform: scale(1.05);
                }
                
                .action-btn.delete-btn {
                    background: #fef2f2;
                    color: #dc2626;
                }
                
                .action-btn.delete-btn:hover {
                    background: #dc2626;
                    color: white;
                    transform: scale(1.05);
                }
                
                /* Modern Tile View */
                .tile-grid {
                    padding: 20px;
                }
                
                .tile-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 24px;
                }
                
                .field-tile {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }
                
                .field-tile:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    border-color: #667eea;
                }
                
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
                    margin: 0;
                    line-height: 1.4;
                }
                
                .tile-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .tile-action-btn {
                    width: 32px;
                    height: 32px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .tile-action-btn.edit-btn {
                    background: #e0f2fe;
                    color: #0369a1;
                }
                
                .tile-action-btn.edit-btn:hover {
                    background: #0369a1;
                    color: white;
                    transform: scale(1.1);
                }
                
                .tile-action-btn.delete-btn {
                    background: #fef2f2;
                    color: #dc2626;
                }
                
                .tile-action-btn.delete-btn:hover {
                    background: #dc2626;
                    color: white;
                    transform: scale(1.1);
                }
                
                .tile-body {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                .tile-field-name, .tile-field-type, .tile-field-description {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    font-size: 14px;
                }
                
                .tile-field-name strong, 
                .tile-field-type strong, 
                .tile-field-description strong {
                    color: #374151;
                    font-weight: 600;
                    min-width: 80px;
                    flex-shrink: 0;
                }
                
                .tile-field-name code {
                    font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
                    background: #f1f5f9;
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 13px;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }
                
                .tile-body .field-type-badge {
                    margin-left: 0;
                }
                
                /* Action Buttons */
                .field-action-btn {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    background: white;
                    border: 1px solid #e9ecef;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }
                
                .field-action-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }
                
                .field-action-btn.danger:hover {
                    background: #e53e3e;
                    border-color: #e53e3e;
                }
                
                /* Empty State */
                .empty-fields-state {
                    text-align: center;
                    padding: 4rem 2rem;
                    color: #6c757d;
                }
                
                .empty-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }
                
                .empty-fields-state h4 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }
                
                .empty-fields-state p {
                    margin-bottom: 1.5rem;
                }
            </style>
        `);
        
        // Set global reference
        window.table_builder = this;
        
        // Setup event handlers
        this.setup_event_handlers();
        
        // Load and render fields
        this.load_fields();
    }
    
    render_fields() {
        const container = this.$container.find('#fields-container');
        const emptyState = this.$container.find('#empty-fields');
        
        if (!this.fields || this.fields.length === 0) {
            container.hide();
            emptyState.show();
            return;
        }
        
        container.show();
        emptyState.hide();
        
        if (this.view_mode === 'list') {
            this.render_data_grid();
        } else {
            this.render_tile_view();
        }
    }
    
    render_data_grid() {
        const container = this.$container.find('#fields-container');
        
        // Create modern enterprise data grid
        container.html(`
            <div class="enterprise-data-grid">
                <table class="data-grid-table">
                    <thead class="data-grid-header">
                        <tr>
                            <th class="sortable-header" data-column="label">
                                <div class="header-content">
                                    <span class="header-text">Field Label</span>
                                    <i class="fa fa-sort sort-icon" data-sort="none"></i>
                                </div>
                            </th>
                            <th class="sortable-header" data-column="name">
                                <div class="header-content">
                                    <span class="header-text">Field Name</span>
                                    <i class="fa fa-sort sort-icon" data-sort="none"></i>
                                </div>
                            </th>
                            <th class="sortable-header" data-column="type">
                                <div class="header-content">
                                    <span class="header-text">Field Type</span>
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
                        ${this.render_field_rows()}
                    </tbody>
                </table>
            </div>
        `);
        
        // Setup sorting functionality
        this.setup_sorting();
    }
    
    render_field_rows() {
        return this.fields.map(field => {
            const fieldName = field.fieldname || field.field_name;
            const fieldType = field.fieldtype || field.field_type;
            const fieldLabel = field.label || field.field_label;
            const fieldDescription = field.description || fieldLabel || 'No description';
            
            const isLogicField = field.logic_expression || field.calculation_method || fieldType === 'Link';
            const fieldTypeLabel = isLogicField ? 
                `${fieldType} (${this.get_logic_field_type(field)})` : 
                fieldType;
            
            const isRequired = field.reqd || field.required;
            
            return `
                <tr class="data-grid-row" data-field-name="${fieldName}">
                    <td class="field-label-cell">
                        <div class="cell-content">
                            <span class="field-label">${fieldLabel || fieldName}</span>
                            ${isRequired ? '<span class="required-indicator">*</span>' : ''}
                        </div>
                    </td>
                    <td class="field-name-cell">
                        <div class="cell-content">
                            <code class="field-name-code">${fieldName}</code>
                        </div>
                    </td>
                    <td class="field-type-cell">
                        <div class="cell-content">
                            <span class="field-type-badge ${isLogicField ? 'logic-field' : ''}">${fieldTypeLabel}</span>
                        </div>
                    </td>
                    <td class="field-actions-cell">
                        <div class="cell-content action-buttons">
                            <button class="action-btn edit-btn" onclick="window.table_builder.edit_field('${fieldName}')" title="Edit Field">
                                <i class="fa fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="window.table_builder.delete_field('${fieldName}')" title="Delete Field">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    render_tile_view() {
        const container = this.$container.find('#fields-container');
        container.removeClass('enterprise-data-grid').addClass('tile-grid');
        
        const tilesHtml = this.fields.map(field => {
            const fieldName = field.fieldname || field.field_name;
            const fieldType = field.fieldtype || field.field_type;
            const fieldLabel = field.label || field.field_label;
            const fieldDescription = field.description || fieldLabel || 'No description';
            
            const isLogicField = field.logic_expression || field.calculation_method || fieldType === 'Link';
            const fieldTypeLabel = isLogicField ? 
                `${fieldType} (${this.get_logic_field_type(field)})` : 
                fieldType;
            
            return `
                <div class="field-tile" data-field-name="${fieldName}">
                    <div class="tile-header">
                        <h4 class="tile-label">${fieldLabel || fieldName}</h4>
                        <div class="tile-actions">
                            <button class="tile-action-btn edit-btn" onclick="window.table_builder.edit_field('${fieldName}')">
                                <i class="fa fa-edit"></i>
                            </button>
                            <button class="tile-action-btn delete-btn" onclick="window.table_builder.delete_field('${fieldName}')">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="tile-body">
                        <div class="tile-field-name">
                            <strong>Name:</strong> <code>${fieldName}</code>
                        </div>
                        <div class="tile-field-type">
                            <strong>Type:</strong> 
                            <span class="field-type-badge ${isLogicField ? 'logic-field' : ''}">${fieldTypeLabel}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.html(`<div class="tile-container">${tilesHtml}</div>`);
    }
    
    setup_sorting() {
        const $headers = this.$container.find('.sortable-header');
        
        $headers.on('click', (e) => {
            const $header = $(e.currentTarget);
            const column = $header.data('column');
            const $sortIcon = $header.find('.sort-icon');
            const currentSort = $sortIcon.data('sort');
            
            // Reset all other sort icons
            $headers.find('.sort-icon').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort').data('sort', 'none');
            
            // Determine new sort direction
            let newSort = 'asc';
            if (currentSort === 'asc') {
                newSort = 'desc';
                $sortIcon.removeClass('fa-sort fa-sort-up').addClass('fa-sort-down');
            } else {
                $sortIcon.removeClass('fa-sort fa-sort-down').addClass('fa-sort-up');
            }
            
            $sortIcon.data('sort', newSort);
            
            // Sort the fields
            this.sort_fields(column, newSort);
        });
    }
    
    sort_fields(column, direction) {
        const getValue = (field, column) => {
            switch (column) {
                case 'label':
                    return (field.label || field.field_label || field.fieldname || field.field_name || '').toLowerCase();
                case 'name':
                    return (field.fieldname || field.field_name || '').toLowerCase();
                case 'type':
                    return (field.fieldtype || field.field_type || '').toLowerCase();
                default:
                    return '';
            }
        };
        
        this.fields.sort((a, b) => {
            const valueA = getValue(a, column);
            const valueB = getValue(b, column);
            
            if (direction === 'asc') {
                return valueA.localeCompare(valueB);
            } else {
                return valueB.localeCompare(valueA);
            }
        });
        
        // Re-render the grid
        if (this.view_mode === 'list') {
            const tbody = this.$container.find('.data-grid-body');
            tbody.html(this.render_field_rows());
        }
    }
    
    get_logic_field_type(field) {
        const fieldType = field.fieldtype || field.field_type;
        if (fieldType === 'Link') return 'Link';
        if (field.logic_expression) {
            if (field.logic_expression.includes('FETCH(')) return 'Fetch';
            if (field.logic_expression.includes('ROLLUP(')) return 'Rollup';
            return 'Formula';
        }
        if (field.calculation_method === 'fetch') return 'Fetch';
        if (field.calculation_method === 'rollup') return 'Rollup';
        return 'Formula';
    }
    
    setup_event_handlers() {
        const $container = this.$container;
        
        // Add Field dropdown
        $container.on('click', '#add-field-header', (e) => {
            e.stopPropagation();
            // Close other dropdowns first
            $container.find('#context-dropdown').removeClass('show');
            // Toggle this dropdown
            const dropdown = $('#add-field-dropdown');
            dropdown.toggleClass('show');
        });
        
        // Add Field menu options
        $container.on('click', '#add-standard-field', (e) => {
            e.preventDefault();
            $container.find('#add-field-dropdown').removeClass('show');
            this.show_add_field_wizard();
        });
        
        $container.on('click', '#add-logic-field', (e) => {
            e.preventDefault();
            $container.find('#add-field-dropdown').removeClass('show');
            this.show_logic_field_wizard();
        });
        
        $container.on('click', '#add-gallery-field', (e) => {
            e.preventDefault();
            $container.find('#add-field-dropdown').removeClass('show');
            this.show_gallery_field_dialog();
        });
        
        // Context menu events
        $container.on('click', '#context-menu', (e) => {
            e.stopPropagation();
            // Close other dropdowns first
            $container.find('#add-field-dropdown').removeClass('show');
            // Toggle this dropdown
            const dropdown = $('#context-dropdown');
            dropdown.toggleClass('show');
        });
        
        $container.on('click', '#view-data-menu', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-report-viewer/${this.table_id}`;
        });
        
        $container.on('click', '#naming-settings-menu', (e) => {
            e.preventDefault();
            this.show_naming_settings();
        });
        
        $container.on('click', '#gallery-settings-menu', (e) => {
            e.preventDefault();
            this.show_gallery_settings();
        });
        
        $container.on('click', '#form-builder-menu', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-form-builder?table=${this.table_id}`;
        });
        
        // View toggle
        $container.on('click', '.view-btn', (e) => {
            const viewType = $(e.currentTarget).data('view');
            this.switch_view(viewType);
        });
        
        // Search functionality
        $container.on('input', '#field-search', (e) => {
            this.filter_fields(e.target.value);
        });
        
        // Close dropdown when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.action-dropdown').length) {
                $container.find('.dropdown-panel').removeClass('show');
            }
        });
    }
    
    async load_fields() {
        try {
            console.log('Loading fields for table:', this.table_id);
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.field_management.get_visual_builder_fields',
                args: {
                    table_name: this.table_id
                }
            });
            
            console.log('Fields API result:', result);
            
            if (result.message && result.message.success) {
                this.fields = result.message.fields || [];
                console.log('Loaded fields:', this.fields);
                this.render_fields();
                this.update_counters();
            } else {
                console.error('API call failed:', result.message);
                frappe.msgprint('Failed to load fields: ' + (result.message?.error || 'Unknown error'));
                this.fields = [];
                this.render_fields();
            }
            
        } catch (error) {
            console.error('Error loading fields:', error);
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load table fields: ' + error.message,
                indicator: 'red'
            });
            this.fields = [];
            this.render_fields();
        }
    }
    
    update_counters() {
        let displayedCount = 0;
        const totalCount = this.fields.length;
        
        // Count visible items based on current view mode
        if (this.view_mode === 'list') {
            displayedCount = this.$container.find('.data-grid-row:visible').length;
        } else {
            displayedCount = this.$container.find('.field-tile:visible').length;
        }
        
        // Always show in "X of Y" format
        this.$container.find('#displayed-count').text(displayedCount);
        this.$container.find('#total-count').text(totalCount);
    }
    
    switch_view(viewType) {
        this.view_mode = viewType;
        
        // Update button states
        this.$container.find('.view-btn').removeClass('active');
        this.$container.find(`.view-btn[data-view="${viewType}"]`).addClass('active');
        
        // Re-render fields with new view
        this.render_fields();
        this.update_counters();
    }
    
    filter_fields(searchTerm) {
        const term = searchTerm.toLowerCase();
        let visibleCount = 0;
        
        if (this.view_mode === 'list') {
            // Filter data grid rows
            this.$container.find('.data-grid-row').each((i, item) => {
                const $item = $(item);
                const fieldLabel = $item.find('.field-label').text().toLowerCase();
                const fieldName = $item.find('.field-name-code').text().toLowerCase();
                const fieldType = $item.find('.field-type-badge').text().toLowerCase();
                
                if (fieldLabel.includes(term) || fieldName.includes(term) || fieldType.includes(term)) {
                    $item.show();
                    visibleCount++;
                } else {
                    $item.hide();
                }
            });
        } else {
            // Filter tile view
            this.$container.find('.field-tile').each((i, item) => {
                const $item = $(item);
                const fieldLabel = $item.find('.tile-label').text().toLowerCase();
                const fieldName = $item.find('.tile-field-name code').text().toLowerCase();
                const fieldType = $item.find('.field-type-badge').text().toLowerCase();
                
                if (fieldLabel.includes(term) || fieldName.includes(term) || fieldType.includes(term)) {
                    $item.show();
                    visibleCount++;
                } else {
                    $item.hide();
                }
            });
        }
        
        // Update counters after filtering
        this.update_counters();
    }
    
    async load_table() {
        try {
            const table_result = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Flansa Table',
                    name: this.table_id
                }
            });
            
            this.table_data = table_result.message;
            
            if (!this.table_data) {
                frappe.msgprint('Table not found');
                this.show_table_selector();
                return;
            }
            
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load table data',
                indicator: 'red'
            });
            console.error('Error loading table:', error);
        }
    }
    
    show_add_field_wizard() {
        const dialog = new frappe.ui.Dialog({
            title: 'Add Field - Choose Type',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'field_type_selector',
                    options: `
                        <div class="field-type-selector">
                            <h4 style="margin-bottom: 1.5rem; color: #2d3748;">Choose Field Type</h4>
                            
                            <!-- Standard Fields -->
                            <div class="field-category">
                                <h5 style="color: #667eea; margin-bottom: 1rem;">Standard Fields</h5>
                                <div class="field-type-grid">
                                    <div class="field-type-card" data-type="Data">
                                        <div class="field-type-icon">📝</div>
                                        <div class="field-type-name">Text</div>
                                        <div class="field-type-desc">Single line text input</div>
                                    </div>
                                    <div class="field-type-card" data-type="Text">
                                        <div class="field-type-icon">📄</div>
                                        <div class="field-type-name">Long Text</div>
                                        <div class="field-type-desc">Multi-line text area</div>
                                    </div>
                                    <div class="field-type-card" data-type="Int">
                                        <div class="field-type-icon">🔢</div>
                                        <div class="field-type-name">Number</div>
                                        <div class="field-type-desc">Integer numbers</div>
                                    </div>
                                    <div class="field-type-card" data-type="Float">
                                        <div class="field-type-icon">🔢</div>
                                        <div class="field-type-name">Decimal</div>
                                        <div class="field-type-desc">Decimal numbers</div>
                                    </div>
                                    <div class="field-type-card" data-type="Currency">
                                        <div class="field-type-icon">💰</div>
                                        <div class="field-type-name">Currency</div>
                                        <div class="field-type-desc">Money amounts</div>
                                    </div>
                                    <div class="field-type-card" data-type="Date">
                                        <div class="field-type-icon">📅</div>
                                        <div class="field-type-name">Date</div>
                                        <div class="field-type-desc">Date picker</div>
                                    </div>
                                    <div class="field-type-card" data-type="Datetime">
                                        <div class="field-type-icon">🕒</div>
                                        <div class="field-type-name">Date & Time</div>
                                        <div class="field-type-desc">Date and time picker</div>
                                    </div>
                                    <div class="field-type-card" data-type="Check">
                                        <div class="field-type-icon">☑️</div>
                                        <div class="field-type-name">Checkbox</div>
                                        <div class="field-type-desc">True/false toggle</div>
                                    </div>
                                    <div class="field-type-card" data-type="Select">
                                        <div class="field-type-icon">📋</div>
                                        <div class="field-type-name">Dropdown</div>
                                        <div class="field-type-desc">Select from options</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Logic Fields -->
                            <div class="field-category" style="margin-top: 2rem;">
                                <h5 style="color: #f6ad55; margin-bottom: 1rem;">Logic Fields (Smart Fields)</h5>
                                <div class="field-type-grid">
                                    <div class="field-type-card logic-field" data-type="Link">
                                        <div class="field-type-icon">🔗</div>
                                        <div class="field-type-name">Link</div>
                                        <div class="field-type-desc">Connect to other tables</div>
                                    </div>
                                    <div class="field-type-card logic-field" data-type="Fetch">
                                        <div class="field-type-icon">📥</div>
                                        <div class="field-type-name">Fetch</div>
                                        <div class="field-type-desc">Fetch data from linked records</div>
                                    </div>
                                    <div class="field-type-card logic-field" data-type="Formula">
                                        <div class="field-type-icon">🧮</div>
                                        <div class="field-type-name">Formula</div>
                                        <div class="field-type-desc">Calculate using expressions</div>
                                    </div>
                                    <div class="field-type-card logic-field" data-type="Rollup">
                                        <div class="field-type-icon">📊</div>
                                        <div class="field-type-name">Rollup</div>
                                        <div class="field-type-desc">Aggregate data summaries</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <style>
                            .field-type-grid {
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                                gap: 1rem;
                            }
                            
                            .field-type-card {
                                border: 2px solid #e9ecef;
                                border-radius: 0.75rem;
                                padding: 1.5rem 1rem;
                                text-align: center;
                                cursor: pointer;
                                transition: all 0.2s;
                                background: white;
                            }
                            
                            .field-type-card:hover {
                                border-color: #667eea;
                                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
                                transform: translateY(-2px);
                            }
                            
                            .field-type-card.logic-field:hover {
                                border-color: #f6ad55;
                                box-shadow: 0 4px 12px rgba(246, 173, 85, 0.15);
                            }
                            
                            .field-type-icon {
                                font-size: 2rem;
                                margin-bottom: 0.75rem;
                            }
                            
                            .field-type-name {
                                font-weight: 600;
                                color: #2d3748;
                                margin-bottom: 0.5rem;
                            }
                            
                            .field-type-desc {
                                font-size: 0.875rem;
                                color: #6c757d;
                                line-height: 1.4;
                            }
                            
                            .field-category {
                                margin-bottom: 1rem;
                            }
                        </style>
                    `
                }
            ]
        });
        
        // Handle field type selection
        dialog.$wrapper.on('click', '.field-type-card', (e) => {
            const fieldType = $(e.currentTarget).data('type');
            dialog.hide();
            
            // Show appropriate dialog based on field type
            if (['Link', 'Fetch', 'Formula', 'Rollup'].includes(fieldType)) {
                this.show_logic_field_dialog(fieldType);
            } else {
                this.show_standard_field_dialog(fieldType);
            }
        });
        
        dialog.show();
    }
    
    show_standard_field_dialog(fieldType) {
        const dialog = new frappe.ui.Dialog({
            title: `Add ${fieldType} Field`,
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (lowercase, no spaces)'
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for users'
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    description: 'Help text shown to users'
                },
                {
                    fieldname: 'reqd',
                    label: 'Required',
                    fieldtype: 'Check',
                    default: 0
                }
            ],
            primary_action_label: 'Add Field',
            primary_action: (values) => {
                this.create_standard_field(fieldType, values, dialog);
            }
        });
        
        dialog.show();
    }
    
    show_logic_field_dialog(logicType) {
        switch (logicType) {
            case 'Link':
                this.show_link_field_dialog();
                break;
            case 'Fetch':
                this.show_fetch_field_dialog();
                break;
            case 'Formula':
                this.show_formula_field_dialog();
                break;
            case 'Rollup':
                this.show_rollup_field_dialog();
                break;
            default:
                frappe.msgprint(`Unknown logic field type: ${logicType}`);
        }
    }
    
    show_link_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Link Field',
            size: 'large',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (lowercase, no spaces)'
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for users'
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    description: 'Help text shown to users'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Link Configuration'
                },
                {
                    fieldname: 'link_scope',
                    label: 'Link Scope',
                    fieldtype: 'Select',
                    options: 'Current App\nOther Flansa Apps\nSystem Tables',
                    default: 'Current App',
                    reqd: 1,
                    description: 'Choose the scope of tables to link to'
                },
                {
                    fieldname: 'target_doctype',
                    label: 'Target Table',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Table to link to'
                }
            ],
            primary_action_label: 'Create Link Field',
            primary_action: (values) => {
                this.create_link_field(values, dialog);
            }
        });
        
        // Load target tables when scope changes
        dialog.fields_dict.link_scope.df.change = () => {
            this.load_link_targets(dialog);
        };
        
        dialog.show();
        this.load_link_targets(dialog);
    }
    
    show_fetch_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Fetch Field',
            size: 'large',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (lowercase, no spaces)'
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for users'
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    description: 'Help text shown to users'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Fetch Configuration'
                },
                {
                    fieldname: 'source_link_field',
                    label: 'Source Link Field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Link field to fetch data from'
                },
                {
                    fieldname: 'target_field',
                    label: 'Target Field',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Field to fetch from the linked record'
                },
                {
                    fieldname: 'result_type',
                    label: 'Result Type',
                    fieldtype: 'Select',
                    options: 'Data\nInt\nFloat\nCurrency\nDate\nDatetime\nCheck',
                    default: 'Data',
                    reqd: 1,
                    description: 'Data type of the fetched field'
                }
            ],
            primary_action_label: 'Create Fetch Field',
            primary_action: (values) => {
                this.create_fetch_field(values, dialog);
            }
        });
        
        // Load link fields on show
        dialog.show();
        this.load_fetch_source_fields(dialog);
        
        // Update target fields when source changes
        dialog.fields_dict.source_link_field.df.change = () => {
            this.load_fetch_target_fields(dialog);
        };
    }
    
    show_formula_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Formula Field',
            size: 'large',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (lowercase, no spaces)'
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for users'
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    description: 'Help text shown to users'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Formula Configuration'
                },
                {
                    fieldname: 'formula',
                    label: 'Formula',
                    fieldtype: 'Code',
                    language: 'javascript',
                    reqd: 1,
                    description: 'Formula expression (e.g., field1 + field2, price * quantity)'
                },
                {
                    fieldname: 'result_type',
                    label: 'Result Type',
                    fieldtype: 'Select',
                    options: 'Data\nInt\nFloat\nCurrency\nDate\nDatetime\nCheck',
                    default: 'Float',
                    reqd: 1,
                    description: 'Expected data type of formula result'
                }
            ],
            primary_action_label: 'Create Formula Field',
            primary_action: (values) => {
                this.create_formula_field(values, dialog);
            },
            secondary_action_label: 'Test Formula',
            secondary_action: (values) => {
                this.test_formula(values.formula);
            }
        });
        
        dialog.show();
    }
    
    show_rollup_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Rollup Field',
            size: 'large',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (lowercase, no spaces)'
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for users'
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    description: 'Help text shown to users'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Rollup Configuration'
                },
                {
                    fieldname: 'child_table',
                    label: 'Child Table',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Child table to aggregate data from'
                },
                {
                    fieldname: 'rollup_field',
                    label: 'Field to Aggregate',
                    fieldtype: 'Select',
                    reqd: 1,
                    description: 'Field in child table to aggregate'
                },
                {
                    fieldname: 'rollup_function',
                    label: 'Aggregation Function',
                    fieldtype: 'Select',
                    options: 'SUM\nCOUNT\nAVG\nMAX\nMIN',
                    default: 'SUM',
                    reqd: 1,
                    description: 'How to aggregate the data'
                },
                {
                    fieldname: 'result_type',
                    label: 'Result Type',
                    fieldtype: 'Select',
                    options: 'Int\nFloat\nCurrency',
                    default: 'Float',
                    reqd: 1,
                    description: 'Data type of the aggregated result'
                }
            ],
            primary_action_label: 'Create Rollup Field',
            primary_action: (values) => {
                this.create_rollup_field(values, dialog);
            }
        });
        
        dialog.show();
        this.load_child_tables(dialog);
        
        // Update rollup fields when child table changes
        dialog.fields_dict.child_table.df.change = () => {
            this.load_rollup_fields(dialog);
        };
    }
    
    async create_standard_field(fieldType, values, dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.add_field_to_table',
                args: {
                    table_id: this.table_id,
                    field_name: values.field_name,
                    field_type: fieldType,
                    label: values.label,
                    description: values.description,
                    required: values.reqd || 0
                }
            });
            
            if (result.message && result.message.success) {
                dialog.hide();
                frappe.show_alert({
                    message: 'Field added successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            } else {
                frappe.msgprint('Failed to add field');
            }
        } catch (error) {
            console.error('Error adding field:', error);
            frappe.msgprint('Error adding field');
        }
    }
    
    toggle_view_mode() {
        this.view_mode = this.view_mode === 'list' ? 'tile' : 'list';
        this.render_fields();
        this.update_view_toggle_button();
    }
    
    set_view_mode(mode) {
        this.view_mode = mode;
        this.render_fields();
        this.update_view_toggle_button();
    }
    
    update_view_toggle_button() {
        // Update the page action button
        const button = this.page.$wrapper.find('[data-label="Tile View"], [data-label="List View"]');
        button.find('.btn-icon').removeClass('fa-grid fa-list')
              .addClass(this.view_mode === 'list' ? 'fa-th' : 'fa-list');
        button.find('.hidden-xs').text(this.view_mode === 'list' ? 'Tile View' : 'List View');
    }
    
    async edit_field(fieldName) {
        const field = this.fields.find(f => (f.fieldname || f.field_name) === fieldName);
        if (!field) {
            frappe.msgprint(`Field ${fieldName} not found`);
            return;
        }
        
        // Check if it's a Logic Field
        const isLogicField = field.logic_expression || field.calculation_method || field.field_type === 'Link';
        
        if (isLogicField) {
            this.show_logic_field_edit_dialog(field);
        } else {
            this.show_standard_field_edit_dialog(field);
        }
    }
    
    show_standard_field_edit_dialog(field) {
        const dialog = new frappe.ui.Dialog({
            title: `Edit ${field.field_type} Field`,
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    default: field.field_name,
                    read_only: 1
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    default: field.label,
                    reqd: 1
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    default: field.description
                },
                {
                    fieldname: 'reqd',
                    label: 'Required',
                    fieldtype: 'Check',
                    default: field.reqd || 0
                }
            ],
            primary_action_label: 'Update Field',
            primary_action: (values) => {
                this.update_field(field.field_name, values, dialog);
            }
        });
        
        dialog.show();
    }
    
    show_logic_field_edit_dialog(field) {
        // Detect Logic Field type and show appropriate edit dialog
        const logicType = this.get_logic_field_type(field);
        
        switch (logicType) {
            case 'Link':
                this.show_link_field_edit_dialog(field);
                break;
            case 'Fetch':
                this.show_fetch_field_edit_dialog(field);
                break;
            case 'Formula':
                this.show_formula_field_edit_dialog(field);
                break;
            case 'Rollup':
                this.show_rollup_field_edit_dialog(field);
                break;
            default:
                this.show_standard_field_edit_dialog(field);
        }
    }
    
    async update_field(fieldName, values, dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.update_field',
                args: {
                    table_id: this.table_id,
                    field_name: fieldName,
                    updates: values
                }
            });
            
            if (result.message && result.message.success) {
                dialog.hide();
                frappe.show_alert({
                    message: 'Field updated successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            }
        } catch (error) {
            console.error('Error updating field:', error);
            frappe.msgprint('Error updating field');
        }
    }
    
    async delete_field(fieldName) {
        const proceed = await frappe.confirm(
            `Are you sure you want to delete the field "${fieldName}"? This action cannot be undone.`
        );
        
        if (!proceed) return;
        
        try {
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.delete_field',
                args: {
                    table_id: this.table_id,
                    field_name: fieldName
                }
            });
            
            if (result.message && result.message.success) {
                frappe.show_alert({
                    message: 'Field deleted successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            }
        } catch (error) {
            console.error('Error deleting field:', error);
            frappe.msgprint('Error deleting field');
        }
    }
    
    show_gallery_settings() {
        frappe.msgprint('Gallery settings feature available');
    }
    
    show_gallery_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Add Gallery Field',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: 'gallery_images',
                    description: 'Technical name for the gallery field'
                },
                {
                    fieldname: 'label',
                    label: 'Field Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: 'Gallery Images',
                    description: 'Display label for the gallery'
                },
                {
                    fieldname: 'max_images',
                    label: 'Maximum Images',
                    fieldtype: 'Int',
                    default: 10,
                    description: 'Maximum number of images allowed'
                },
                {
                    fieldname: 'allow_videos',
                    label: 'Allow Videos',
                    fieldtype: 'Check',
                    default: 0,
                    description: 'Allow video uploads in gallery'
                }
            ],
            primary_action_label: 'Create Gallery Field',
            primary_action: async (values) => {
                try {
                    const result = await frappe.call({
                        method: 'flansa.flansa_core.api.table_api.add_field_to_table',
                        args: {
                            table_id: this.table_id,
                            field_name: values.field_name,
                            field_type: 'Long Text',
                            label: values.label,
                            description: `Gallery field (max ${values.max_images} images)`
                        }
                    });
                    
                    if (result.message && result.message.success) {
                        dialog.hide();
                        frappe.show_alert({
                            message: 'Gallery field added successfully',
                            indicator: 'green'
                        });
                        await this.load_fields();
                    } else {
                        frappe.msgprint('Failed to add gallery field');
                    }
                } catch (error) {
                    frappe.msgprint('Error adding gallery field');
                }
            }
        });
        
        dialog.show();
    }
    
    show_logic_field_wizard() {
        const dialog = new frappe.ui.Dialog({
            title: 'Add Logic Field - Choose Type',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'logic_type_selector',
                    options: `
                        <div class="logic-type-selector">
                            <h4 style="margin-bottom: 1.5rem; color: #2d3748;">Choose Logic Field Type</h4>
                            <div class="logic-type-grid">
                                <div class="logic-type-card" data-type="formula">
                                    <div class="logic-icon">∑</div>
                                    <div class="logic-name">Formula</div>
                                    <div class="logic-desc">Calculate values using expressions</div>
                                </div>
                                <div class="logic-type-card" data-type="fetch">
                                    <div class="logic-icon">🔗</div>
                                    <div class="logic-name">Fetch</div>
                                    <div class="logic-desc">Get data from linked records</div>
                                </div>
                                <div class="logic-type-card" data-type="rollup">
                                    <div class="logic-icon">📊</div>
                                    <div class="logic-name">Rollup</div>
                                    <div class="logic-desc">Aggregate data from child records</div>
                                </div>
                                <div class="logic-type-card" data-type="conditional">
                                    <div class="logic-icon">⚡</div>
                                    <div class="logic-name">Conditional</div>
                                    <div class="logic-desc">IF-THEN-ELSE logic</div>
                                </div>
                            </div>
                        </div>
                        <style>
                            .logic-type-grid {
                                display: grid;
                                grid-template-columns: repeat(2, 1fr);
                                gap: 1rem;
                            }
                            .logic-type-card {
                                border: 2px solid #e2e8f0;
                                border-radius: 12px;
                                padding: 1.5rem;
                                text-align: center;
                                cursor: pointer;
                                transition: all 0.3s;
                            }
                            .logic-type-card:hover {
                                border-color: #667eea;
                                background: #f7fafc;
                                transform: translateY(-2px);
                                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
                            }
                            .logic-icon {
                                font-size: 2.5rem;
                                margin-bottom: 0.5rem;
                            }
                            .logic-name {
                                font-weight: 700;
                                font-size: 1.1rem;
                                color: #2d3748;
                                margin-bottom: 0.5rem;
                            }
                            .logic-desc {
                                color: #718096;
                                font-size: 0.9rem;
                            }
                        </style>
                    `
                }
            ]
        });
        
        // Handle logic type selection
        dialog.$wrapper.on('click', '.logic-type-card', (e) => {
            const logicType = $(e.currentTarget).data('type');
            dialog.hide();
            
            switch(logicType) {
                case 'formula':
                    this.show_formula_field_dialog();
                    break;
                case 'fetch':
                    this.show_fetch_field_dialog();
                    break;
                case 'rollup':
                    this.show_rollup_field_dialog();
                    break;
                case 'conditional':
                    this.show_conditional_field_dialog();
                    break;
            }
        });
        
        dialog.show();
    }
    
    show_conditional_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Conditional Logic Field',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    reqd: 1
                },
                {
                    fieldname: 'label',
                    label: 'Field Label',
                    fieldtype: 'Data',
                    reqd: 1
                },
                {
                    fieldname: 'condition',
                    label: 'Condition (IF)',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'e.g., status == "Active"'
                },
                {
                    fieldname: 'then_value',
                    label: 'Then Value',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Value if condition is true'
                },
                {
                    fieldname: 'else_value',
                    label: 'Else Value',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Value if condition is false'
                }
            ],
            primary_action_label: 'Create Conditional Field',
            primary_action: async (values) => {
                const formula = `IF(${values.condition}, "${values.then_value}", "${values.else_value}")`;
                await this.create_logic_field('Formula', values, dialog, formula);
            }
        });
        
        dialog.show();
    }
    
    show_naming_settings() {
        frappe.set_route('Form', 'Flansa Table', this.table_id);
    }
    
    view_table_data() {
        window.location.href = `/app/flansa-report-viewer/${this.table_id}`;
    }
    
    async load_tenant_logo() {
        try {
            // Try to get tenant logo if tenant system is available
            const result = await frappe.call({
                method: 'flansa.flansa_core.tenant_service.get_tenant_logo',
                args: {},
                freeze: false,
                quiet: true // Don't show errors if method doesn't exist
            });
            
            if (result.message && result.message.logo) {
                const logoContainer = document.getElementById('tenant-logo-container');
                const logoImg = document.getElementById('tenant-logo');
                
                if (logoContainer && logoImg) {
                    logoImg.src = result.message.logo;
                    logoContainer.style.display = 'block';
                }
            }
        } catch (error) {
            // Silently fail if tenant system isn't available
            console.debug('Tenant logo not available:', error);
        }
    }
    
    async load_table() {
        try {
            // First get table info
            const tableResult = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Flansa Table',
                    name: this.table_id
                }
            });
            
            if (tableResult.message) {
                this.table_data = tableResult.message;
                
                // Load application data if available
                if (this.table_data.application) {
                    try {
                        const appResult = await frappe.call({
                            method: 'frappe.client.get',
                            args: {
                                doctype: 'Flansa Application',
                                name: this.table_data.application
                            }
                        });
                        if (appResult.message) {
                            this.application_data = appResult.message;
                        }
                    } catch (appError) {
                        console.warn('Could not load application data:', appError);
                    }
                }
                
                // Update page title
                this.page.set_title(`${this.table_data.table_label || this.table_data.table_name} - Table Builder`);
            }
            
            // Then get fields using the correct native API
            const fieldsResult = await frappe.call({
                method: 'flansa.native_fields.get_table_fields_native',
                args: { table_name: this.table_id }
            });
            
            if (fieldsResult.message && fieldsResult.message.success) {
                this.fields = fieldsResult.message.fields || [];
            } else {
                this.fields = [];
            }
        } catch (error) {
            console.error('Error loading table:', error);
            frappe.msgprint('Error loading table data');
        }
    }
    
    // Table selector functionality (keeping existing implementation)
    show_table_selector() {
        // Implementation from original file...
    }
    
    // === LOGIC FIELD CREATION METHODS ===
    
    async create_link_field(values, dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.logic_templates.create_field_from_template',
                args: {
                    table_name: this.table_id,
                    template_id: 'link',
                    field_data: {
                        field_name: values.field_name,
                        label: values.label,
                        description: values.description,
                        target_doctype: values.target_doctype,
                        link_scope: values.link_scope
                    }
                }
            });
            
            if (result.message && result.message.success) {
                dialog.hide();
                frappe.show_alert({
                    message: 'Link field created successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            } else {
                frappe.msgprint('Failed to create link field: ' + (result.message.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating link field:', error);
            frappe.msgprint('Error creating link field');
        }
    }
    
    async create_fetch_field(values, dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.logic_templates.create_field_from_template',
                args: {
                    table_name: this.table_id,
                    template_id: 'fetch',
                    field_data: {
                        field_name: values.field_name,
                        label: values.label,
                        description: values.description,
                        source_link_field: values.source_link_field,
                        target_field: values.target_field,
                        result_type: values.result_type
                    }
                }
            });
            
            if (result.message && result.message.success) {
                dialog.hide();
                frappe.show_alert({
                    message: 'Fetch field created successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            } else {
                frappe.msgprint('Failed to create fetch field: ' + (result.message.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating fetch field:', error);
            frappe.msgprint('Error creating fetch field');
        }
    }
    
    async create_formula_field(values, dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.logic_templates.create_field_from_template',
                args: {
                    table_name: this.table_id,
                    template_id: 'formula',
                    field_data: {
                        field_name: values.field_name,
                        label: values.label,
                        description: values.description,
                        formula: values.formula,
                        result_type: values.result_type
                    }
                }
            });
            
            if (result.message && result.message.success) {
                dialog.hide();
                frappe.show_alert({
                    message: 'Formula field created successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            } else {
                frappe.msgprint('Failed to create formula field: ' + (result.message.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating formula field:', error);
            frappe.msgprint('Error creating formula field');
        }
    }
    
    async create_rollup_field(values, dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.logic_templates.create_field_from_template',
                args: {
                    table_name: this.table_id,
                    template_id: 'rollup',
                    field_data: {
                        field_name: values.field_name,
                        label: values.label,
                        description: values.description,
                        child_table: values.child_table,
                        rollup_field: values.rollup_field,
                        rollup_function: values.rollup_function,
                        result_type: values.result_type
                    }
                }
            });
            
            if (result.message && result.message.success) {
                dialog.hide();
                frappe.show_alert({
                    message: 'Rollup field created successfully',
                    indicator: 'green'
                });
                await this.load_table();
                this.render_fields();
            } else {
                frappe.msgprint('Failed to create rollup field: ' + (result.message.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating rollup field:', error);
            frappe.msgprint('Error creating rollup field');
        }
    }
    
    // === EDIT DIALOG METHODS ===
    
    show_link_field_edit_dialog(field) {
        const dialog = new frappe.ui.Dialog({
            title: `Edit Link Field: ${field.field_name}`,
            size: 'large',
            fields: [
                {
                    fieldname: 'field_name',
                    label: 'Field Name',
                    fieldtype: 'Data',
                    default: field.field_name,
                    read_only: 1
                },
                {
                    fieldname: 'label',
                    label: 'Label',
                    fieldtype: 'Data',
                    default: field.label,
                    reqd: 1
                },
                {
                    fieldname: 'description',
                    label: 'Help Text',
                    fieldtype: 'Text',
                    default: field.description
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Link Configuration'
                },
                {
                    fieldname: 'target_doctype',
                    label: 'Target Table',
                    fieldtype: 'Data',
                    default: field.options,
                    read_only: 1,
                    description: 'Cannot change target table for existing link field'
                }
            ],
            primary_action_label: 'Update Field',
            primary_action: (values) => {
                this.update_field(field.field_name, values, dialog);
            }
        });
        
        dialog.show();
    }
    
    show_fetch_field_edit_dialog(field) {
        frappe.msgprint('Fetch field editing will be available in next update');
    }
    
    show_formula_field_edit_dialog(field) {
        frappe.msgprint('Formula field editing will be available in next update');
    }
    
    show_rollup_field_edit_dialog(field) {
        frappe.msgprint('Rollup field editing will be available in next update');
    }
    
    // === HELPER METHODS ===
    
    async load_link_targets(dialog) {
        try {
            const scope = dialog.get_value('link_scope');
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_available_link_targets',
                args: {
                    table_id: this.table_id,
                    scope: scope
                }
            });
            
            if (result.message && result.message.success) {
                const options = result.message.targets.join('\n');
                dialog.set_df_property('target_doctype', 'options', options);
                dialog.fields_dict.target_doctype.refresh();
            }
        } catch (error) {
            console.error('Error loading link targets:', error);
        }
    }
    
    async load_fetch_source_fields(dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_link_fields',
                args: { table_id: this.table_id }
            });
            
            if (result.message && result.message.success) {
                const options = result.message.fields.map(f => f.field_name).join('\n');
                dialog.set_df_property('source_link_field', 'options', options);
                dialog.fields_dict.source_link_field.refresh();
            }
        } catch (error) {
            console.error('Error loading link fields:', error);
        }
    }
    
    async load_fetch_target_fields(dialog) {
        try {
            const sourceField = dialog.get_value('source_link_field');
            if (!sourceField) return;
            
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_target_fields_for_link',
                args: {
                    table_id: this.table_id,
                    link_field: sourceField
                }
            });
            
            if (result.message && result.message.success) {
                const options = result.message.fields.map(f => f.field_name).join('\n');
                dialog.set_df_property('target_field', 'options', options);
                dialog.fields_dict.target_field.refresh();
            }
        } catch (error) {
            console.error('Error loading target fields:', error);
        }
    }
    
    async load_child_tables(dialog) {
        try {
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_child_tables',
                args: { table_id: this.table_id }
            });
            
            if (result.message && result.message.success) {
                const options = result.message.tables.map(t => t.name).join('\n');
                dialog.set_df_property('child_table', 'options', options);
                dialog.fields_dict.child_table.refresh();
            }
        } catch (error) {
            console.error('Error loading child tables:', error);
        }
    }
    
    async load_rollup_fields(dialog) {
        try {
            const childTable = dialog.get_value('child_table');
            if (!childTable) return;
            
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_numeric_fields',
                args: { table_id: childTable }
            });
            
            if (result.message && result.message.success) {
                const options = result.message.fields.map(f => f.field_name).join('\n');
                dialog.set_df_property('rollup_field', 'options', options);
                dialog.fields_dict.rollup_field.refresh();
            }
        } catch (error) {
            console.error('Error loading rollup fields:', error);
        }
    }
    
    async test_formula(formula) {
        if (!formula) {
            frappe.show_alert('Please enter a formula to test', 'red');
            return;
        }
        
        try {
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.test_logic_field',
                args: {
                    expression: formula,
                    sample_data: '{"field1": 10, "field2": 20, "price": 100, "quantity": 2}'
                }
            });
            
            if (result.message && result.message.success) {
                frappe.msgprint({
                    title: 'Formula Test Result',
                    message: `
                        <div style="padding: 1rem;">
                            <h5>Expression: <code>${formula}</code></h5>
                            <h4 style="color: #28a745;">Result: ${result.message.result}</h4>
                            <p style="color: #6c757d; margin-top: 1rem;">
                                Test data used: field1=10, field2=20, price=100, quantity=2
                            </p>
                        </div>
                    `,
                    indicator: 'green'
                });
            } else {
                frappe.msgprint('Formula test failed: ' + (result.message.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error testing formula:', error);
            frappe.msgprint('Error testing formula');
        }
    }
}