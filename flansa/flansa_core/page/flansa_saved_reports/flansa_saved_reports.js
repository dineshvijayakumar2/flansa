frappe.pages['flansa-saved-reports'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Saved Reports',
        single_column: true
    });
    
    new SavedReportsPage(page);
};

class SavedReportsPage {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        // State management
        this.reports = [];
        this.filtered_reports = [];
        this.current_page = 1;
        this.page_size = 12;
        this.total_pages = 0;
        this.view_mode = 'tile'; // 'tile' or 'list'
        
        // URL parameters
        this.extract_url_parameters();
        
        this.init();
    }
    
    extract_url_parameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.filter_table = urlParams.get('table');
        this.filter_app = urlParams.get('app');
        this.source_context = urlParams.get('source') || 'direct';
        
        console.log('Saved Reports: URL parameters:', {
            table: this.filter_table,
            app: this.filter_app,
            source: this.source_context
        });
    }
    
    init() {
        this.setup_ui();
        this.bind_events();
        this.load_initial_data();
        this.load_workspace_logo();
    }
    
    setup_ui() {
        // Clear existing content and add our custom HTML directly
        this.$container.empty();
        
        // Use inline HTML for better reliability
        this.setup_inline_html();
        this.initialize_components();
    }
    
    setup_inline_html() {
        // Inline HTML for saved reports page
        this.$container.html(`
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
                        <span class="breadcrumb-current">📊 Saved Reports</span>
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
                                <h1 class="app-name">Saved Reports</h1>
                                <div class="app-type">
                                    <div class="counter-pill">
                                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                        </svg>
                                        <span class="counter-text">Report Manager</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Action Buttons -->
                    <div class="banner-right">
                        
                        <div class="action-dropdown">
                            <button class="sleek-btn primary split-btn" id="create-new-report-btn">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                </svg>
                                <span>Create Report</span>
                                <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </button>
                            <div class="dropdown-panel" id="create-report-dropdown">
                                <a href="#" class="dropdown-option" id="create-table-report">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd" />
                                    </svg>
                                    <span>Table Report</span>
                                </a>
                                <a href="#" class="dropdown-option" id="create-chart-report">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                                    </svg>
                                    <span>Chart Report</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Context Section like Table Builder -->
            <div class="context-section">
                <div class="context-header">
                    <div class="context-left">
                        <div class="context-info">
                            <span class="context-name">Saved Reports</span>
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
                            <input type="search" class="search-box" id="report-search" 
                                   placeholder="Search reports...">
                            <select class="filter-dropdown" id="table-filter">
                                <option value="">All Tables</option>
                            </select>
                            <select class="filter-dropdown" id="type-filter">
                                <option value="">All Types</option>
                                <option value="Table">Table</option>
                                <option value="Chart">Chart</option>
                                <option value="Summary">Summary</option>
                            </select>
                            <div class="context-counter">
                                <span class="counter-text">
                                    <span id="displayed-count">0</span> 
                                    <span class="count-total">of <span id="total-count">0</span> reports</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="reports-container">
                <div class="reports-grid" id="reports-grid">
                    <div class="loading-state">
                        <div class="text-center">
                            <i class="fa fa-spinner fa-spin fa-2x"></i>
                            <p class="mt-2">Loading reports...</p>
                        </div>
                    </div>
                </div>

                <div class="empty-state" id="empty-state" style="display: none;">
                    <div class="text-center">
                        <i class="fa fa-chart-bar fa-3x text-muted"></i>
                        <h4 class="mt-3">No Reports Found</h4>
                        <p class="text-muted">Create your first report to get started</p>
                        <button class="btn btn-primary" id="create-first-report-btn">
                            <i class="fa fa-plus"></i> Create Report
                        </button>
                    </div>
                </div>
            </div>

            <div class="pagination-container" id="pagination-container" style="display: none;">
                <nav aria-label="Reports pagination">
                    <ul class="pagination justify-content-center" id="pagination">
                    </ul>
                </nav>
            </div>

            <style>
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
                    height: 40px;
                    width: auto;
                    max-width: 120px;
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

                .app-details h1.app-name {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #111827;
                    line-height: 1.2;
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

                /* Context Section matching Table Builder exactly */
                .context-section {
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    margin: 0 -24px 0 -24px;
                }

                .context-header {
                    padding: 1.5rem 2rem;
                }

                .context-left {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .context-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .context-name {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #1f2937;
                    margin: 0;
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
                    width: 200px;
                    font-size: 0.875rem;
                    transition: all 0.2s ease;
                }

                .context-controls .search-box:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }

                .context-controls .filter-dropdown {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    color: #374151;
                    font-size: 0.875rem;
                    min-width: 120px;
                    transition: all 0.2s ease;
                }

                .context-controls .filter-dropdown:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }

                .context-counter .counter-text {
                    color: #6b7280;
                    font-size: 0.875rem;
                    font-weight: 500;
                }

                .context-counter .count-total {
                    opacity: 0.7;
                    font-weight: 400;
                }
                
                .title-text {
                    font-size: 1.375rem;
                    font-weight: 700;
                    color: #111827;
                    margin: 0;
                    line-height: 1.2;
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

                .filter-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid #eee;
                }

                .reports-container {
                    min-height: 400px;
                }

                .reports-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                    padding: 20px 0;
                }

                .reports-grid.tile-view {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                    padding: 20px 0;
                }

                .reports-grid.list-view {
                    grid-template-columns: 1fr;
                    gap: 0;
                    display: block;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }

                /* Data Grid Header for List View */
                .reports-grid.list-view .data-grid-header {
                    display: grid;
                    grid-template-columns: 2fr minmax(120px, 1fr) minmax(80px, max-content) minmax(100px, max-content) minmax(100px, max-content);
                    align-items: center;
                    padding: 12px 20px;
                    gap: 16px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-bottom: 2px solid #e2e8f0;
                    font-size: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .reports-grid.list-view .data-grid-header .header-col-title {
                    justify-self: start;
                }

                .reports-grid.list-view .data-grid-header .header-col-table {
                    justify-self: start;
                }

                .reports-grid.list-view .data-grid-header .header-col-type {
                    justify-self: center;
                }

                .reports-grid.list-view .data-grid-header .header-col-date {
                    justify-self: end;
                }

                .reports-grid.list-view .data-grid-header .header-col-actions {
                    justify-self: center;
                }

                .reports-grid.list-view .report-card {
                    margin: 0;
                    border-radius: 0;
                    background: transparent;
                }

                .reports-grid.list-view .report-card .card {
                    border: none;
                    border-radius: 0;
                    box-shadow: none;
                    border-bottom: 1px solid #f1f5f9;
                    background: white;
                    transition: background-color 0.2s ease;
                }

                .reports-grid.list-view .report-card .card:hover {
                    background: #f8fafc;
                    transform: none;
                    box-shadow: none;
                    border-color: #e2e8f0;
                }

                .reports-grid.list-view .report-card:last-child .card {
                    border-bottom: none;
                }

                /* Clean data grid row layout */
                .list-view .report-card .card {
                    display: grid;
                    grid-template-columns: 2fr minmax(120px, 1fr) minmax(80px, max-content) minmax(100px, max-content) minmax(100px, max-content);
                    align-items: center;
                    padding: 16px 20px;
                    gap: 16px;
                    min-height: 60px;
                }

                .list-view .report-card .card-header,
                .list-view .report-card .card-body {
                    display: none;
                }

                .list-view .report-card .list-row-content {
                    display: contents;
                }

                /* Column styling for organized grid */
                .list-view .report-card .report-title-col {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }

                .list-view .report-card .report-title-col .report-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #1f2937;
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .list-view .report-card .report-title-col .report-description {
                    font-size: 13px;
                    color: #6b7280;
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 400px;
                }

                .list-view .report-card .report-table-col {
                    color: #4b5563;
                    font-size: 13px;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    justify-self: start;
                }

                .list-view .report-card .report-type-col {
                    text-align: center;
                    justify-self: center;
                }

                .list-view .report-card .report-type-col .report-type-badge {
                    margin: 0;
                    font-size: 11px;
                    padding: 3px 8px;
                    display: inline-block;
                    white-space: nowrap;
                }

                .list-view .report-card .report-date-col {
                    color: #6b7280;
                    font-size: 12px;
                    text-align: right;
                    justify-self: end;
                    white-space: nowrap;
                }

                .list-view .report-card .report-actions-col {
                    display: flex;
                    gap: 6px;
                    justify-content: center;
                    justify-self: center;
                }

                .list-view .report-card .report-actions-col .action-btn {
                    width: 28px;
                    height: 28px;
                    font-size: 12px;
                }

                .report-card {
                    height: 100%;
                }

                .report-card .card {
                    height: 100%;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }

                .report-card .card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    border-color: #667eea;
                }

                .card-header {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    border-bottom: 1px solid #e2e8f0;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .card-title-section {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    flex: 1;
                }

                .card-actions {
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    width: 32px;
                    height: 32px;
                    border: none;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.7);
                    color: #6b7280;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                }

                .action-btn:hover {
                    background: white;
                    color: #374151;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    transform: translateY(-1px);
                }

                .action-dropdown {
                    position: relative;
                }

                .dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    padding: 8px;
                    min-width: 160px;
                    display: none;
                    z-index: 1000;
                }

                .dropdown-option {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    text-decoration: none;
                    color: #374151;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .dropdown-option:hover {
                    background: #f3f4f6;
                    color: #111827;
                }

                .dropdown-option.text-danger {
                    color: #dc2626;
                }

                .dropdown-option.text-danger:hover {
                    background: #fef2f2;
                    color: #b91c1c;
                }

                .dropdown-divider {
                    height: 1px;
                    background: #e2e8f0;
                    margin: 4px 0;
                }

                .report-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 700;
                    color: #1f2937;
                    flex: 1;
                    line-height: 1.4;
                }

                .report-type-badge {
                    padding: 4px 12px;
                    border-radius: 16px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-left: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .report-type-badge.table {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    color: #1d4ed8;
                    border: 1px solid #93c5fd;
                }

                .report-type-badge.chart {
                    background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
                    color: #be185d;
                    border: 1px solid #f9a8d4;
                }

                .report-type-badge.summary {
                    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                    color: #047857;
                    border: 1px solid #86efac;
                }

                .card-body {
                    padding: 20px;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }

                .report-description {
                    color: #666;
                    font-size: 0.9rem;
                    margin-bottom: 15px;
                    flex: 1;
                }

                .report-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .report-meta small {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .card-footer {
                    background: white;
                    border-top: 1px solid #e0e0e0;
                    padding: 10px 15px;
                }

                .empty-state {
                    padding: 60px 20px;
                    text-align: center;
                }

                .loading-state {
                    padding: 60px 20px;
                    text-align: center;
                }

                .pagination-container {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }
            </style>
        `);
    }
    
    initialize_components() {
        // Update UI based on context
        this.setup_page_context();
        
        // Set up navigation
        this.setup_navigation();
        
        // Load data
        this.load_table_options();
        this.load_reports();
    }
    
    setup_page_context() {
        const pageTitle = document.getElementById('page-title-text');
        const pageSubtitle = document.getElementById('page-subtitle-text');
        const backBtn = document.getElementById('back-to-table-btn');
        const filterSection = document.getElementById('filter-section');
        
        if (this.filter_table) {
            // Table-specific context
            this.get_table_info().then(tableInfo => {
                const tableName = tableInfo ? (tableInfo.table_label || tableInfo.table_name) : this.filter_table;
                
                if (pageTitle) pageTitle.textContent = `Reports for ${tableName}`;
                if (pageSubtitle) pageSubtitle.textContent = `View and manage reports for ${tableName}`;
                
                // Show back button
                if (backBtn) {
                    backBtn.style.display = 'inline-block';
                    backBtn.addEventListener('click', () => {
                        frappe.set_route('flansa-record-viewer', this.filter_table);
                    });
                }
                
                // Hide table filter since we're filtering by specific table
                if (filterSection) {
                    const tableFilterGroup = filterSection.querySelector('.col-md-4:first-child');
                    if (tableFilterGroup) tableFilterGroup.style.display = 'none';
                }
                
                // Add table-specific styling
                document.body.classList.add('table-specific');
            });
        } else if (this.filter_app) {
            // App-specific context
            if (pageTitle) pageTitle.textContent = `Application Reports`;
            if (pageSubtitle) pageSubtitle.textContent = `Reports for all tables in this application`;
        }
    }
    
    setup_navigation() {
        const createBtn = document.getElementById('create-new-report-btn');
        const createFirstBtn = document.getElementById('create-first-report-btn');
        
        const createReportHandler = () => {
            // Build URL with proper encoding
            let url = '/app/flansa-report-builder?source=saved_reports';
            
            if (this.filter_table) {
                url += `&table=${encodeURIComponent(this.filter_table)}`;
            }
            
            window.location.href = url;
        };
        
        if (createBtn) createBtn.addEventListener('click', createReportHandler);
        if (createFirstBtn) createFirstBtn.addEventListener('click', createReportHandler);
    }
    
    bind_events() {
        // Filter events
        $(document).on('change', '#table-filter', () => this.apply_filters());
        $(document).on('change', '#type-filter', () => this.apply_filters());
        $(document).on('input', '#report-search', () => this.debounce_search());
        
        // Report card events
        $(document).on('click', '.view-report-btn', (e) => this.view_report(e));
        $(document).on('click', '.edit-report-btn', (e) => this.edit_report(e));
        $(document).on('click', '.view-report', (e) => this.view_report(e));
        $(document).on('click', '.edit-report', (e) => this.edit_report(e));
        $(document).on('click', '.duplicate-report', (e) => this.duplicate_report(e));
        $(document).on('click', '.delete-report', (e) => this.delete_report(e));
        
        // Pagination events
        $(document).on('click', '.page-link', (e) => this.handle_pagination(e));
        
        // View toggle events
        $(document).on('click', '.view-btn', (e) => this.switch_view(e));
    }
    
    async get_table_info() {
        if (!this.filter_table) return null;
        
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_table_info',
                args: { table_name: this.filter_table }
            });
            
            if (response.message && response.message.success) {
                return response.message.table;
            }
        } catch (error) {
            console.error('Error loading table info:', error);
        }
        return null;
    }
    
    async load_table_options() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_tables_list'
            });
            
            if (response.message && response.message.success) {
                // Create table lookup map for ID to label resolution
                this.table_lookup = {};
                response.message.tables.forEach(table => {
                    this.table_lookup[table.value] = table.label;
                });
                
                this.populate_table_filter(response.message.tables);
            }
        } catch (error) {
            console.error('Error loading tables:', error);
        }
    }

    // Helper method to get table label from ID
    get_table_label(table_id) {
        return this.table_lookup && this.table_lookup[table_id] ? this.table_lookup[table_id] : table_id;
    }
    
    populate_table_filter(tables) {
        const tableFilter = document.getElementById('table-filter');
        if (!tableFilter) return;
        
        // Clear existing options except "All Tables"
        tableFilter.innerHTML = '<option value="">All Tables</option>';
        
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.value;
            option.textContent = table.label;
            if (table.value === this.filter_table) {
                option.selected = true;
            }
            tableFilter.appendChild(option);
        });
    }
    
    async load_reports() {
        try {
            this.show_loading_state();
            
            // Always load all reports and apply filtering on frontend for consistency
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.get_user_reports',
                args: {} // No base_table filter - load all reports
            });
            
            if (response.message) {
                this.reports = response.message;
                // Apply initial filtering based on URL parameters
                this.apply_initial_filters();
            } else {
                this.reports = [];
                this.show_empty_state();
            }
        } catch (error) {
            console.error('Error loading reports:', error);
            frappe.msgprint('Error loading reports');
            this.show_empty_state();
        }
    }
    
    apply_initial_filters() {
        // Set filter values based on URL parameters before applying filters
        if (this.filter_table) {
            const tableFilter = document.getElementById('table-filter');
            if (tableFilter) {
                tableFilter.value = this.filter_table;
            }
        }
        
        // Apply the filters with the URL-based initial state
        this.apply_filters();
    }
    
    apply_filters() {
        const tableFilter = document.getElementById('table-filter')?.value || '';
        const typeFilter = document.getElementById('type-filter')?.value || '';
        const searchTerm = document.getElementById('report-search')?.value.toLowerCase() || '';
        
        this.filtered_reports = this.reports.filter(report => {
            // Table filter
            if (tableFilter && report.base_table !== tableFilter) return false;
            
            // Type filter
            if (typeFilter && report.report_type !== typeFilter) return false;
            
            // Search filter
            if (searchTerm) {
                const searchableText = [
                    report.report_title,
                    report.description,
                    report.base_table,
                    this.get_table_label(report.base_table) // Include table label in search
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) return false;
            }
            
            return true;
        });
        
        this.current_page = 1;
        
        // If tabulator is active, update its data directly
        if (this.view_mode === 'list' && this.tabulator) {
            const tableData = this.filtered_reports.map(report => ({
                id: report.name,
                report_title: report.report_title,
                description: report.description || 'No description',
                base_table: this.get_table_label(report.base_table),
                base_table_id: report.base_table, // Keep original ID for filtering
                report_type: report.report_type || 'Table',
                created_on: report.created_on,
                created_by_user: report.created_by_user,
                actions: report.name
            }));
            this.tabulator.setData(tableData);
            this.update_counters();
        } else {
            this.render_reports();
        }
    }
    
    render_reports() {
        const reportsGrid = document.getElementById('reports-grid');
        const emptyState = document.getElementById('empty-state');
        const paginationContainer = document.getElementById('pagination-container');
        
        if (!reportsGrid) return;
        
        if (this.filtered_reports.length === 0) {
            reportsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }
        
        // Show grid and apply view mode class
        reportsGrid.style.display = 'grid';
        reportsGrid.className = `reports-grid ${this.view_mode}-view`;
        if (emptyState) emptyState.style.display = 'none';
        
        // Calculate pagination
        this.total_pages = Math.ceil(this.filtered_reports.length / this.page_size);
        const start_index = (this.current_page - 1) * this.page_size;
        const end_index = start_index + this.page_size;
        const page_reports = this.filtered_reports.slice(start_index, end_index);
        
        if (this.view_mode === 'list') {
            this.render_tabulator_view(page_reports);
        } else {
            this.render_tile_view(page_reports);
        }
    }

    render_tabulator_view(reports) {
        // Now using Shadcn table instead of Tabulator
        this.render_shadcn_table(reports);
    }
    
    render_shadcn_table(reports) {
        const reportsGrid = document.getElementById('reports-grid');
        
        // Create container for the table
        reportsGrid.innerHTML = `
            <div class="shadcn-data-table">
                <div class="shadcn-table-wrapper">
                    <table class="shadcn-table">
                        <thead class="shadcn-table-header">
                            <tr class="shadcn-table-row">
                                <th class="shadcn-table-head">Report Name</th>
                                <th class="shadcn-table-head">Table</th>
                                <th class="shadcn-table-head">Type</th>
                                <th class="shadcn-table-head">Created</th>
                                <th class="shadcn-table-head text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="shadcn-table-body">
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Add the Shadcn table styles
        this.inject_shadcn_table_styles();
        
        // Populate table rows
        const tbody = document.querySelector('.shadcn-table-body');
        
        reports.forEach(report => {
            const row = document.createElement('tr');
            row.className = 'shadcn-table-row';
            row.dataset.reportId = report.name;
            
            // Report Name cell with description
            const nameCell = document.createElement('td');
            nameCell.className = 'shadcn-table-cell font-medium';
            nameCell.innerHTML = `
                <div class="flex flex-col gap-1">
                    <div class="text-sm font-semibold">${report.report_title}</div>
                    <div class="text-xs text-muted-foreground">${report.description || 'No description'}</div>
                </div>
            `;
            row.appendChild(nameCell);
            
            // Table cell
            const tableCell = document.createElement('td');
            tableCell.className = 'shadcn-table-cell';
            tableCell.textContent = this.get_table_label(report.base_table);
            row.appendChild(tableCell);
            
            // Type cell with badge
            const typeCell = document.createElement('td');
            typeCell.className = 'shadcn-table-cell';
            const reportType = report.report_type || 'Table';
            const typeColors = {
                'Table': 'bg-blue-100 text-blue-700 border-blue-200',
                'Chart': 'bg-pink-100 text-pink-700 border-pink-200',
                'Summary': 'bg-green-100 text-green-700 border-green-200'
            };
            typeCell.innerHTML = `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[reportType] || typeColors['Table']}">
                    ${reportType}
                </span>
            `;
            row.appendChild(typeCell);
            
            // Created cell
            const createdCell = document.createElement('td');
            createdCell.className = 'shadcn-table-cell';
            createdCell.textContent = frappe.datetime.str_to_user(report.created_on);
            row.appendChild(createdCell);
            
            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'shadcn-table-cell text-right';
            actionsCell.innerHTML = `
                <div class="flex gap-2 justify-end">
                    <button class="shadcn-btn-ghost view-report-btn" data-report-id="${report.name}" title="View Report">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                    <button class="shadcn-btn-ghost edit-report-btn" data-report-id="${report.name}" title="Edit Report">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                    </button>
                    <button class="shadcn-btn-ghost delete-report-btn" data-report-id="${report.name}" title="Delete Report">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            `;
            row.appendChild(actionsCell);
            
            tbody.appendChild(row);
        });
        
        // Re-bind action button events
        this.bind_table_action_events();
    }
    
    inject_shadcn_table_styles() {
        // Check if styles already exist
        if (document.getElementById('shadcn-table-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'shadcn-table-styles';
        style.textContent = `
            /* Shadcn Data Table Styles */
            .shadcn-data-table {
                width: 100%;
            }
            
            .shadcn-table-wrapper {
                overflow: hidden;
                border: 1px solid hsl(214.3 31.8% 91.4%);
                border-radius: 0.5rem;
                background: white;
                box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
            }
            
            .shadcn-table {
                width: 100%;
                caption-side: bottom;
                font-size: 0.875rem;
                border-collapse: collapse;
            }
            
            .shadcn-table-header {
                background: hsl(210 40% 98%);
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%);
            }
            
            .shadcn-table-row {
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%);
                transition: background-color 0.2s;
            }
            
            .shadcn-table-body .shadcn-table-row:hover {
                background: hsl(210 40% 98%);
            }
            
            .shadcn-table-body .shadcn-table-row:last-child {
                border-bottom: 0;
            }
            
            .shadcn-table-head {
                padding: 0.75rem 1rem;
                text-align: left;
                font-weight: 500;
                color: hsl(215.4 16.3% 46.9%);
                text-transform: uppercase;
                letter-spacing: 0.025em;
                font-size: 0.75rem;
            }
            
            .shadcn-table-cell {
                padding: 0.75rem 1rem;
                vertical-align: middle;
                color: hsl(222.2 47.4% 11.2%);
            }
            
            .shadcn-table-cell.font-medium {
                font-weight: 500;
            }
            
            .text-right {
                text-align: right;
            }
            
            .text-muted-foreground {
                color: hsl(215.4 16.3% 46.9%);
            }
            
            /* Button styles */
            .shadcn-btn-ghost {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.5rem;
                border-radius: 0.375rem;
                background: transparent;
                border: none;
                color: hsl(215.4 16.3% 46.9%);
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .shadcn-btn-ghost:hover {
                background: hsl(210 40% 96.1%);
                color: hsl(222.2 47.4% 11.2%);
            }
            
            .shadcn-btn-ghost:focus {
                outline: 2px solid transparent;
                outline-offset: 2px;
                box-shadow: 0 0 0 2px hsl(222.2 47.4% 11.2%);
            }
            
            /* Flex utilities */
            .flex {
                display: flex;
            }
            
            .flex-col {
                flex-direction: column;
            }
            
            .gap-1 {
                gap: 0.25rem;
            }
            
            .gap-2 {
                gap: 0.5rem;
            }
            
            .justify-end {
                justify-content: flex-end;
            }
            
            /* Text utilities */
            .text-sm {
                font-size: 0.875rem;
                line-height: 1.25rem;
            }
            
            .text-xs {
                font-size: 0.75rem;
                line-height: 1rem;
            }
            
            .font-semibold {
                font-weight: 600;
            }
            
            /* Badge styles for report types */
            .bg-blue-100 {
                background-color: rgb(219 234 254);
            }
            
            .text-blue-700 {
                color: rgb(29 78 216);
            }
            
            .border-blue-200 {
                border: 1px solid rgb(191 219 254);
            }
            
            .bg-pink-100 {
                background-color: rgb(252 231 243);
            }
            
            .text-pink-700 {
                color: rgb(190 24 93);
            }
            
            .border-pink-200 {
                border: 1px solid rgb(251 207 232);
            }
            
            .bg-green-100 {
                background-color: rgb(220 252 231);
            }
            
            .text-green-700 {
                color: rgb(21 128 61);
            }
            
            .border-green-200 {
                border: 1px solid rgb(187 247 208);
            }
            
            .inline-flex {
                display: inline-flex;
            }
            
            .items-center {
                align-items: center;
            }
            
            .rounded-full {
                border-radius: 9999px;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .shadcn-table {
                    font-size: 0.8125rem;
                }
                
                .shadcn-table-head,
                .shadcn-table-cell {
                    padding: 0.5rem;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    bind_table_action_events() {
        // View button
        document.querySelectorAll('.view-report-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reportId = btn.dataset.reportId;
                window.location.href = `/app/flansa-report-viewer?report=${reportId}`;
            });
        });
        
        // Edit button
        document.querySelectorAll('.edit-report-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reportId = btn.dataset.reportId;
                window.location.href = `/app/flansa-report-builder?edit=${reportId}`;
            });
        });
        
        // Delete button
        document.querySelectorAll('.delete-report-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const reportId = btn.dataset.reportId;
                const report = this.reports.find(r => r.name === reportId);
                if (report) {
                    await this.delete_report(report);
                }
            });
        });
    }
    
    render_tabulator_view_old(reports) {
        const reportsGrid = document.getElementById('reports-grid');
        
        // Create tabulator container
        reportsGrid.innerHTML = '<div id="reports-tabulator" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"></div>';
        
        // Load Tabulator and Shadcn-inspired styling
        Promise.all([
            this.load_tabulator_assets(),
            this.load_shadcn_inspired_styles()
        ]).then(() => {
            const tableData = reports.map(report => ({
                base_table: this.get_table_label(report.base_table),
                base_table_id: report.base_table, // Keep original ID for filtering
                report_type: report.report_type || 'Table',
                created_on: report.created_on,
                created_by_user: report.created_by_user,
                actions: report.name
            }));

            // Initialize Tabulator with Shadcn-inspired theme
            this.tabulator = new Tabulator("#reports-tabulator", {
                data: tableData,
                layout: "fitDataStretch",
                responsiveLayout: "collapse",
                responsiveLayoutCollapseStartOpen: false,
                pagination: true,
                paginationSize: this.page_size,
                paginationMode: "local",
                movableColumns: true,
                resizableRows: false,
                selectable: false,
                tooltips: true,
                // Shadcn-inspired styling options
                columnDefaults: {
                    headerSort: true,
                    headerTooltip: true,
                },
                columns: [
                    {
                        title: "Report Name", 
                        field: "report_title", 
                        width: 300,
                        responsive: 0,
                        formatter: (cell, formatterParams, onRendered) => {
                            const data = cell.getRow().getData();
                            return `
                                <div style="display: flex; flex-direction: column; gap: 2px;">
                                    <div style="font-weight: 600; color: #1f2937;">${data.report_title}</div>
                                    <div style="font-size: 12px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px;">${data.description}</div>
                                </div>
                            `;
                        }
                    },
                    {
                        title: "Table", 
                        field: "base_table", 
                        width: 150,
                        responsive: 1
                    },
                    {
                        title: "Type", 
                        field: "report_type", 
                        width: 100,
                        responsive: 2,
                        hozAlign: "center",
                        formatter: (cell, formatterParams, onRendered) => {
                            const type = cell.getValue().toLowerCase();
                            const colors = {
                                table: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
                                chart: { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
                                summary: { bg: '#ecfdf5', text: '#047857', border: '#86efac' }
                            };
                            const color = colors[type] || colors.table;
                            return `<span style="background: ${color.bg}; color: ${color.text}; border: 1px solid ${color.border}; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${cell.getValue()}</span>`;
                        }
                    },
                    {
                        title: "Created", 
                        field: "created_on", 
                        width: 120,
                        responsive: 3,
                        hozAlign: "right",
                        formatter: (cell, formatterParams, onRendered) => {
                            return frappe.datetime.str_to_user(cell.getValue());
                        }
                    },
                    {
                        title: "Actions", 
                        field: "actions", 
                        width: 120,
                        responsive: 0,
                        hozAlign: "center",
                        headerSort: false,
                        formatter: (cell, formatterParams, onRendered) => {
                            return `
                                <div style="display: flex; gap: 8px; justify-content: center;">
                                    <button class="tabulator-action-btn view-report-btn" data-report-id="${cell.getValue()}" title="View Report">
                                        <i class="fa fa-eye" style="font-size: 14px;"></i>
                                    </button>
                                    <button class="tabulator-action-btn edit-report-btn" data-report-id="${cell.getValue()}" title="Edit Report">
                                        <i class="fa fa-edit" style="font-size: 14px;"></i>
                                    </button>
                                </div>
                            `;
                        }
                    }
                ]
            });

            // Add event handlers for action buttons
            setTimeout(() => {
                // Bind action button events
                document.querySelectorAll('.view-report-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const reportId = e.target.closest('.view-report-btn').dataset.reportId;
                        this.view_report_by_id(reportId);
                    });
                });

                document.querySelectorAll('.edit-report-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const reportId = e.target.closest('.edit-report-btn').dataset.reportId;
                        this.edit_report_by_id(reportId);
                    });
                });

                // Add hover effects for action buttons
                document.querySelectorAll('.tabulator-action-btn').forEach(btn => {
                    btn.addEventListener('mouseenter', function() {
                        this.style.transform = 'translateY(-1px)';
                        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                    });
                    btn.addEventListener('mouseleave', function() {
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = 'none';
                    });
                });
            }, 100);
        });
    }

    render_tile_view(reports) {
        const reportsGrid = document.getElementById('reports-grid');
        reportsGrid.innerHTML = '';
        
        reports.forEach(report => {
            const card = this.create_report_card(report);
            reportsGrid.appendChild(card);
        });
        
        // Update counters (only for tile view, tabulator handles its own)
        if (this.view_mode !== 'list') {
            this.update_counters();
            this.render_pagination();
        }
    }

    async load_tabulator_assets() {
        // Check if Tabulator is already loaded
        if (window.Tabulator) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            // Load CSS first
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = 'https://unpkg.com/tabulator-tables@6.2.5/dist/css/tabulator.min.css';
            document.head.appendChild(css);

            // Load JS
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/tabulator-tables@6.2.5/dist/js/tabulator.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Tabulator'));
            document.head.appendChild(script);
        });
    }

    // Helper methods for action button handlers
    view_report_by_id(reportId) {
        const report = this.reports.find(r => r.name === reportId);
        if (report) {
            // Create a proper mock event object with preventDefault method
            const mockEvent = {
                preventDefault: () => {},
                target: { closest: () => ({ dataset: { reportId: reportId } }) },
                currentTarget: { dataset: { reportId: reportId } }
            };
            this.view_report(mockEvent);
        }
    }

    edit_report_by_id(reportId) {
        const report = this.reports.find(r => r.name === reportId);
        if (report) {
            // Create a proper mock event object with preventDefault method
            const mockEvent = {
                preventDefault: () => {},
                target: { closest: () => ({ dataset: { reportId: reportId } }) },
                currentTarget: { dataset: { reportId: reportId } }
            };
            this.edit_report(mockEvent);
        }
    }

    load_shadcn_inspired_styles() {
        // Inject Shadcn-inspired styles for modern UI components
        const shadcnStyles = `
            <style id="shadcn-inspired-styles">
                /* Shadcn-inspired Variables */
                :root {
                    --shadcn-background: 0 0% 100%;
                    --shadcn-foreground: 222.2 84% 4.9%;
                    --shadcn-primary: 221.2 83.2% 53.3%;
                    --shadcn-primary-foreground: 210 40% 98%;
                    --shadcn-secondary: 210 40% 96%;
                    --shadcn-secondary-foreground: 222.2 84% 4.9%;
                    --shadcn-muted: 210 40% 96%;
                    --shadcn-muted-foreground: 215.4 16.3% 46.9%;
                    --shadcn-border: 214.3 31.8% 91.4%;
                    --shadcn-radius: 0.5rem;
                }

                /* Apply Shadcn theme to Tabulator */
                #reports-tabulator .tabulator {
                    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: hsl(var(--shadcn-background));
                    border: 1px solid hsl(var(--shadcn-border));
                    border-radius: var(--shadcn-radius);
                }

                #reports-tabulator .tabulator-header {
                    background: hsl(var(--shadcn-muted));
                    border-bottom: 1px solid hsl(var(--shadcn-border));
                }

                #reports-tabulator .tabulator-header .tabulator-col {
                    border-right: 1px solid hsl(var(--shadcn-border));
                    background: transparent;
                }

                #reports-tabulator .tabulator-header .tabulator-col-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: hsl(var(--shadcn-foreground));
                }

                #reports-tabulator .tabulator-row {
                    background: hsl(var(--shadcn-background));
                    border-bottom: 1px solid hsl(var(--shadcn-border));
                    transition: all 0.2s ease;
                }

                #reports-tabulator .tabulator-row:hover {
                    background: hsl(var(--shadcn-muted) / 0.5);
                }

                #reports-tabulator .tabulator-row .tabulator-cell {
                    border-right: 1px solid hsl(var(--shadcn-border));
                    color: hsl(var(--shadcn-foreground));
                    font-size: 14px;
                }

                #reports-tabulator .tabulator-footer {
                    background: hsl(var(--shadcn-muted));
                    border-top: 1px solid hsl(var(--shadcn-border));
                }

                /* Enhanced Action Buttons with Shadcn styling */
                .tabulator-action-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    white-space: nowrap !important;
                    border-radius: var(--shadcn-radius) !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    transition: all 0.2s !important;
                    border: none !important;
                    cursor: pointer !important;
                    height: 32px !important;
                    width: 32px !important;
                }

                .view-report-btn {
                    background: hsl(var(--shadcn-primary)) !important;
                    color: hsl(var(--shadcn-primary-foreground)) !important;
                }

                .view-report-btn:hover {
                    background: hsl(var(--shadcn-primary) / 0.9) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 8px hsl(var(--shadcn-primary) / 0.3) !important;
                }

                .edit-report-btn {
                    background: hsl(var(--shadcn-secondary)) !important;
                    color: hsl(var(--shadcn-secondary-foreground)) !important;
                }

                .edit-report-btn:hover {
                    background: hsl(var(--shadcn-secondary) / 0.8) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: 0 4px 8px hsl(var(--shadcn-secondary) / 0.3) !important;
                }
            </style>
        `;

        // Inject styles if not already present
        if (!document.getElementById('shadcn-inspired-styles')) {
            document.head.insertAdjacentHTML('beforeend', shadcnStyles);
        }

        return Promise.resolve();
    }
    
    create_report_card(report) {
        // Create report card directly without template
        const cardElement = document.createElement('div');
        cardElement.className = 'report-card';
        cardElement.dataset.reportId = report.name;
        
        // Generate different HTML based on view mode
        if (this.view_mode === 'list') {
            // Clean data grid row structure for list view
            cardElement.innerHTML = `
                <div class="card">
                    <div class="list-row-content">
                        <div class="report-title-col">
                            <div class="report-title">${report.report_title}</div>
                            <div class="report-description">${report.description || 'No description'}</div>
                        </div>
                        <div class="report-table-col">${this.get_table_label(report.base_table)}</div>
                        <div class="report-type-col">
                            <span class="report-type-badge ${(report.report_type || 'table').toLowerCase()}">${report.report_type || 'Table'}</span>
                        </div>
                        <div class="report-date-col">${frappe.datetime.str_to_user(report.created_on)}</div>
                        <div class="report-actions-col">
                            <button class="action-btn view-report-btn" title="View Report">
                                <i class="fa fa-eye"></i>
                            </button>
                            <button class="action-btn edit-report-btn" title="Edit Report">
                                <i class="fa fa-edit"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Original card design for tile view
            cardElement.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <div class="card-title-section">
                            <h4 class="report-title">${report.report_title}</h4>
                            <span class="report-type-badge ${(report.report_type || 'table').toLowerCase()}">${report.report_type || 'Table'}</span>
                        </div>
                        <div class="card-actions">
                            <button class="action-btn view-report" title="View Report">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                            <button class="action-btn edit-report" title="Edit Report">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                                </svg>
                            </button>
                            <div class="action-dropdown">
                                <button class="action-btn dropdown-toggle" title="More Actions">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                                    </svg>
                                </button>
                                <div class="dropdown-menu">
                                    <a class="dropdown-option duplicate-report" href="#">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                                        </svg>
                                        <span>Duplicate</span>
                                    </a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-option delete-report text-danger" href="#">
                                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>Delete</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="report-description">${report.description || 'No description'}</p>
                        <div class="report-meta">
                            <small class="text-muted">
                                <i class="fa fa-table"></i> <span class="table-name">${this.get_table_label(report.base_table)}</span>
                            </small>
                            <small class="text-muted">
                                <i class="fa fa-user"></i> <span class="created-by">${report.created_by_user}</span>
                            </small>
                            <small class="text-muted">
                                <i class="fa fa-calendar"></i> <span class="created-date">${frappe.datetime.str_to_user(report.created_on)}</span>
                            </small>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="btn-group btn-group-sm w-100">
                            <button class="btn btn-primary view-report-btn">
                                <i class="fa fa-eye"></i> View
                            </button>
                            <button class="btn btn-outline-primary edit-report-btn">
                                <i class="fa fa-edit"></i> Edit
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return cardElement;
    }
    
    render_pagination() {
        const paginationContainer = document.getElementById('pagination-container');
        const pagination = document.getElementById('pagination');
        
        if (!pagination || this.total_pages <= 1) {
            if (paginationContainer) paginationContainer.style.display = 'none';
            return;
        }
        
        if (paginationContainer) paginationContainer.style.display = 'block';
        
        let html = '';
        
        // Previous button
        html += `<li class="page-item ${this.current_page === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.current_page - 1}">Previous</a>
        </li>`;
        
        // Page numbers
        for (let i = 1; i <= this.total_pages; i++) {
            if (i === 1 || i === this.total_pages || (i >= this.current_page - 2 && i <= this.current_page + 2)) {
                html += `<li class="page-item ${i === this.current_page ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
            } else if (i === this.current_page - 3 || i === this.current_page + 3) {
                html += `<li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>`;
            }
        }
        
        // Next button
        html += `<li class="page-item ${this.current_page === this.total_pages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.current_page + 1}">Next</a>
        </li>`;
        
        pagination.innerHTML = html;
    }
    
    handle_pagination(e) {
        e.preventDefault();
        const page = parseInt(e.target.dataset.page);
        
        if (page && page !== this.current_page && page >= 1 && page <= this.total_pages) {
            this.current_page = page;
            this.render_reports();
        }
    }
    
    switch_view(e) {
        const viewType = $(e.currentTarget).data('view');
        this.view_mode = viewType;
        
        // Update button states
        $('.view-btn').removeClass('active');
        $(`.view-btn[data-view="${viewType}"]`).addClass('active');
        
        // Re-render reports with new view
        this.render_reports();
        this.update_counters();
    }
    
    update_counters() {
        const displayedCount = this.filtered_reports.length;
        const totalCount = this.reports.length;
        
        $('#displayed-count').text(displayedCount);
        $('#total-count').text(totalCount);
    }
    
    view_report(e) {
        e.preventDefault();
        const reportCard = e.target.closest('.report-card');
        const reportId = reportCard?.dataset.reportId;
        
        if (reportId) {
            // Use hierarchical URL format with query parameters
            window.location.href = `/app/flansa-report-viewer?report=${encodeURIComponent(reportId)}`;
        }
    }
    
    edit_report(e) {
        e.preventDefault();
        const reportCard = e.target.closest('.report-card');
        const reportId = reportCard?.dataset.reportId;
        
        if (reportId) {
            // Build URL with proper encoding
            let url = `/app/flansa-report-builder?edit=${encodeURIComponent(reportId)}&source=saved_reports`;
            
            if (this.filter_table) {
                url += `&table=${encodeURIComponent(this.filter_table)}`;
            }
            
            window.location.href = url;
        }
    }
    
    async duplicate_report(e) {
        e.preventDefault();
        const reportCard = e.target.closest('.report-card');
        const reportId = reportCard?.dataset.reportId;
        
        if (!reportId) return;
        
        try {
            // Load the report
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { report_id: reportId }
            });
            
            if (response.message && response.message.success) {
                const report = response.message.report;
                
                // Create a copy with modified title
                const copyResponse = await frappe.call({
                    method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.save_report',
                    args: {
                        report_title: `${report.title} (Copy)`,
                        description: report.description,
                        base_table: report.base_table,
                        report_type: report.report_type,
                        report_config: report.config,
                        is_public: 0 // Copies are private by default
                    }
                });
                
                if (copyResponse.message && copyResponse.message.success) {
                    frappe.show_alert({
                        message: 'Report duplicated successfully!',
                        indicator: 'green'
                    });
                    this.load_reports(); // Reload to show the copy
                }
            }
        } catch (error) {
            console.error('Error duplicating report:', error);
            frappe.msgprint('Error duplicating report');
        }
    }
    
    async delete_report(report) {
        // Handle both event and direct report object
        let reportId, reportTitle;
        
        if (report && report.preventDefault) {
            // Old event-based call
            report.preventDefault();
            const reportCard = report.target.closest('.report-card');
            reportId = reportCard?.dataset.reportId;
            reportTitle = reportCard?.querySelector('.report-title')?.textContent;
        } else if (report && report.name) {
            // Direct report object from new table
            reportId = report.name;
            reportTitle = report.report_title;
        } else {
            return;
        }
        
        if (!reportId) return;
        
        const confirm_delete = await new Promise(resolve => {
            frappe.confirm(
                `Are you sure you want to delete the report "${reportTitle}"?`,
                () => resolve(true),
                () => resolve(false)
            );
        });
        
        if (!confirm_delete) return;
        
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.delete_report',
                args: {
                    report_id: reportId
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message,
                    indicator: 'green'
                });
                
                this.load_reports(); // Reload reports
            } else {
                frappe.msgprint(response.message?.error || 'Error deleting report');
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            frappe.msgprint('Error deleting report');
        }
    }
    
    debounce_search() {
        clearTimeout(this.search_timeout);
        this.search_timeout = setTimeout(() => {
            this.apply_filters();
        }, 300);
    }
    
    show_loading_state() {
        const reportsGrid = document.getElementById('reports-grid');
        if (reportsGrid) {
            reportsGrid.innerHTML = `
                <div class="loading-state">
                    <div class="text-center">
                        <i class="fa fa-spinner fa-spin fa-2x"></i>
                        <p class="mt-2">Loading reports...</p>
                    </div>
                </div>
            `;
        }
    }
    
    show_empty_state() {
        const reportsGrid = document.getElementById('reports-grid');
        const emptyState = document.getElementById('empty-state');
        
        if (reportsGrid) reportsGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
    }
    
    load_initial_data() {
        console.log('Saved Reports page initialized');
    }
    
    async load_workspace_logo() {
        console.log('🔍 Saved Reports: Loading workspace logo...');
        try {
            // Get workspace logo from Flansa Tenant Registry
            const result = await frappe.call({
                method: 'flansa.flansa_core.tenant_service.get_workspace_logo',
                args: {},
                freeze: false,
                quiet: false // Show errors for debugging
            });
            
            console.log('🔍 Saved Reports: API response:', result);
            
            if (result.message && result.message.logo) {
                const logoContainer = document.getElementById('workspace-logo-container');
                const logoImg = document.getElementById('workspace-logo');
                
                console.log('🔍 Saved Reports: DOM elements found:', {
                    logoContainer: !!logoContainer,
                    logoImg: !!logoImg
                });
                
                if (logoContainer && logoImg) {
                    logoImg.src = result.message.logo;
                    logoContainer.style.display = 'block';
                    console.log('✅ Saved Reports: Workspace logo loaded successfully');
                } else {
                    console.log('❌ Saved Reports: Logo DOM elements not found');
                }
            } else {
                console.log('⚠️ Saved Reports: No workspace logo in API response');
            }
        } catch (error) {
            console.log('❌ Saved Reports: Workspace logo error:', error);
        }
    }
}

// Make it globally accessible
window.SavedReportsPage = SavedReportsPage;