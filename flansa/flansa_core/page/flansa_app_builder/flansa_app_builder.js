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
        this.app_id = frappe.get_route()[1] || null;
        this.current_app = null;
        this.current_tables = [];
        
        this.init();
    }
    
    init() {
        this.make_layout();
        this.load_data();
        this.bind_events();
    }
    
    setup_header() {
        // Header actions are now handled in the custom header HTML
        // No need for additional page buttons
    }
    
    make_layout() {
        this.page.$app_builder = $(`
            <div class="flansa-app-builder">
                <!-- Functional frozen header -->
                <div class="app-header">
                    <div class="container">
                        <!-- Breadcrumb -->
                        <div class="breadcrumb-section">
                            <a href="/app/flansa-workspace" class="breadcrumb-item">🏠 Workspace</a>
                            <span class="breadcrumb-separator">›</span>
                            <span class="breadcrumb-current">App Builder</span>
                        </div>
                        
                        <!-- Main Header Row -->
                        <div class="header-row">
                            <div class="app-info">
                                <div class="app-info-inline">
                                    <h1 class="app-title">Loading...</h1>
                                    <span class="app-separator">•</span>
                                    <span class="app-status-inline"></span>
                                </div>
                            </div>
                            
                            <!-- Action Buttons -->
                            <div class="header-actions">
                                <button class="header-btn" id="create-table-header">
                                    <i class="fa fa-plus"></i> New Table
                                </button>
                                <div class="dropdown">
                                    <button class="header-btn secondary dropdown-toggle" id="context-menu">
                                        <i class="fa fa-ellipsis-v"></i>
                                    </button>
                                    <div class="dropdown-menu" id="context-dropdown">
                                        <a href="#" class="dropdown-item" id="app-settings-menu">
                                            <i class="fa fa-cog"></i> App Settings
                                        </a>
                                        <a href="#" class="dropdown-item" id="import-data-menu">
                                            <i class="fa fa-upload"></i> Import Data
                                        </a>
                                        <a href="#" class="dropdown-item" id="relationships-menu">
                                            <i class="fa fa-link"></i> Relationships
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
                            <span class="context-label">APP:</span>
                            <span class="context-name">${this.current_app ? (this.current_app.title || this.current_app.name) : 'Loading...'}</span>
                        </div>
                        
                        <div class="context-controls">
                            <div class="view-toggle">
                                <button class="view-btn active" data-view="grid" title="Grid View">
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
                        
                        <div class="tables-container grid-view" id="tables-container">
                            <!-- Tables will be loaded here -->
                        </div>
                    </div>
                    
                    <!-- No Data State -->
                    <div class="empty-state" id="empty-state" style="display: none;">
                        <div class="empty-icon">📊</div>
                        <h3>No tables yet</h3>
                        <p>Create your first table to start building your application</p>
                        <button class="btn btn-primary" id="empty-create-table">
                            Create First Table
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
                
                /* Frozen functional header */
                .app-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 1rem 0;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                
                .app-header .container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                /* Breadcrumb */
                .breadcrumb-section {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                }
                
                .breadcrumb-item {
                    color: rgba(255,255,255,0.8);
                    text-decoration: none;
                    transition: color 0.2s;
                }
                
                .breadcrumb-item:hover {
                    color: white;
                }
                
                .breadcrumb-separator {
                    opacity: 0.6;
                }
                
                .breadcrumb-current {
                    color: white;
                    font-weight: 500;
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
                .tables-container.grid-view {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1rem;
                }
                
                .tables-container.list-view {
                    display: block;
                }
                
                /* Grid View Cards */
                .tables-container.grid-view .table-card {
                    background: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    border-radius: 0.5rem;
                    padding: 1.25rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .tables-container.grid-view .table-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
                    transform: translateY(-2px);
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
                    this.load_tables_data();
                } else {
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
                fields: ['name', 'table_name', 'table_label', 'description']
            },
            callback: (r) => {
                if (r.message) {
                    this.current_tables = r.message;
                    this.render_app_data();
                } else {
                    this.current_tables = [];
                    this.render_app_data();
                }
            }
        });
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
            if (newView !== this.currentView) {
                this.switchView(newView);
            }
        });
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update button states
        this.page.$app_builder.find('.view-btn').removeClass('active');
        this.page.$app_builder.find(`.view-btn[data-view="${view}"]`).addClass('active');
        
        // Update container class
        const container = this.page.$app_builder.find('#tables-container');
        container.removeClass('grid-view list-view').addClass(`${view}-view`);
        
        // Re-render tables with current data
        const currentTables = this.getCurrentDisplayedTables();
        this.render_tables(currentTables);
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
        container.empty();
        
        tables.forEach(table => {
            let card;
            
            if (this.currentView === 'list') {
                // List view layout
                card = $(`
                    <div class="table-card" data-table-id="${table.name}">
                        <div class="table-info">
                            <div class="table-name">${table.table_label || table.table_name}</div>
                            <div class="table-description">${table.description || 'No description'}</div>
                        </div>
                        <div class="table-actions">
                            <button class="table-action-btn" data-action="edit" data-table="${table.name}">
                                <i class="fa fa-edit"></i> Edit
                            </button>
                            <button class="table-action-btn" data-action="view" data-table="${table.name}">
                                <i class="fa fa-table"></i> View
                            </button>
                            <button class="table-action-btn" data-action="form" data-table="${table.name}">
                                <i class="fa fa-form"></i> Form
                            </button>
                        </div>
                    </div>
                `);
            } else {
                // Grid view layout (default)
                card = $(`
                    <div class="table-card" data-table-id="${table.name}">
                        <div class="table-name">${table.table_label || table.table_name}</div>
                        <div class="table-description">${table.description || 'No description'}</div>
                        <div class="table-meta">
                            <span><i class="fa fa-columns"></i> ${table.fields_count || 0} fields</span>
                            <span><i class="fa fa-database"></i> ${table.record_count || 0} records</span>
                        </div>
                        <div class="table-actions">
                            <button class="table-action-btn" data-action="edit" data-table="${table.name}">
                                Edit Structure
                            </button>
                            <button class="table-action-btn" data-action="view" data-table="${table.name}">
                                View Data
                            </button>
                            <button class="table-action-btn" data-action="form" data-table="${table.name}">
                                Form Builder
                            </button>
                        </div>
                    </div>
                `);
            }
            
            container.append(card);
        });
    }
    
    bind_events() {
        const $builder = this.page.$app_builder;
        
        // Header action buttons
        $builder.on('click', '#create-table-header', () => {
            this.show_table_creation_dialog();
        });
        
        $builder.on('click', '#context-menu', (e) => {
            e.stopPropagation();
            const dropdown = $builder.find('#context-dropdown');
            dropdown.toggleClass('show');
        });
        
        // Close dropdown when clicking outside
        $(document).on('click', () => {
            $builder.find('#context-dropdown').removeClass('show');
        });
        
        // Context menu actions
        $builder.on('click', '#app-settings-menu', (e) => {
            e.preventDefault();
            frappe.set_route('Form', 'Flansa Application', this.app_id);
        });
        
        $builder.on('click', '#import-data-menu', (e) => {
            e.preventDefault();
            this.show_import_dialog();
        });
        
        $builder.on('click', '#relationships-menu', (e) => {
            e.preventDefault();
            window.location.href = `/app/flansa-relationship-builder/${this.app_id}`;
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
        
        // Table actions
        $builder.on('click', '.table-action-btn', (e) => {
            e.stopPropagation();
            const action = $(e.target).data('action');
            const tableId = $(e.target).data('table');
            
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
            }
        });
        
        // Table card click
        $builder.on('click', '.table-card', (e) => {
            if (!$(e.target).hasClass('table-action-btn')) {
                const tableId = $(e.currentTarget).data('table-id');
                window.location.href = `/app/flansa-table-builder?table=${tableId}`;
            }
        });
        
        // Search
        $builder.on('input', '#table-search', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            $builder.find('.table-card').each((i, card) => {
                const tableName = $(card).find('.table-name').text().toLowerCase();
                const description = $(card).find('.table-description').text().toLowerCase();
                
                if (tableName.includes(searchTerm) || description.includes(searchTerm)) {
                    $(card).show();
                } else {
                    $(card).hide();
                }
            });
        });
    }
    
    show_table_creation_dialog() {
        // Use the existing create table dialog functionality
        this.create_table_dialog();
    }
    
    show_import_dialog() {
        frappe.msgprint({
            title: 'Import Data',
            message: 'Import feature coming soon. You can create tables and add data manually for now.',
            indicator: 'blue'
        });
    }
    
    create_table_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create New Table',
            size: 'large',
            fields: [
                {
                    fieldname: 'table_label',
                    label: 'Display Label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'User-friendly name (e.g., Customer Orders)'
                },
                {
                    fieldname: 'table_name',
                    label: 'Table Name',
                    fieldtype: 'Data',
                    reqd: 1,
                    read_only: 1,
                    description: 'Auto-generated from display label (e.g., customer_orders)'
                },
                {
                    fieldname: 'description',
                    label: 'Description',
                    fieldtype: 'Text',
                    description: 'Brief description of the table purpose'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Auto-Naming Settings'
                },
                {
                    fieldname: 'naming_type',
                    label: 'Naming Type',
                    fieldtype: 'Select',
                    options: 'Auto Number\nPrefix + Auto Number\nField Based\nManual',
                    default: 'Auto Number',
                    description: 'How records will be named automatically'
                },
                {
                    fieldname: 'naming_prefix',
                    label: 'Prefix',
                    fieldtype: 'Data',
                    depends_on: 'eval:doc.naming_type === "Prefix + Auto Number"',
                    description: 'Prefix for auto-generated names (e.g., "ORD" for ORD-001)'
                },
                {
                    fieldname: 'naming_digits',
                    label: 'Number of Digits',
                    fieldtype: 'Int',
                    default: 5,
                    depends_on: 'eval:["Auto Number", "Prefix + Auto Number"].includes(doc.naming_type)',
                    description: 'Number of digits for auto numbering (e.g., 5 for 00001)'
                },
                {
                    fieldname: 'naming_start_from',
                    label: 'Start From',
                    fieldtype: 'Int',
                    default: 1,
                    depends_on: 'eval:["Auto Number", "Prefix + Auto Number"].includes(doc.naming_type)',
                    description: 'Starting number for auto numbering'
                },
                {
                    fieldname: 'naming_field',
                    label: 'Field for Naming',
                    fieldtype: 'Data',
                    depends_on: 'eval:doc.naming_type === "Field Based"',
                    description: 'Field name to use for record names (will be created as a field)'
                }
            ],
            primary_action_label: 'Create Table',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.api.table_management.create_flansa_table',
                    args: {
                        app_id: this.app_id,
                        table_name: values.table_name,
                        table_label: values.table_label,
                        description: values.description,
                        naming_type: values.naming_type,
                        naming_prefix: values.naming_prefix,
                        naming_digits: values.naming_digits,
                        naming_start_from: values.naming_start_from,
                        naming_field: values.naming_field
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
            if (values.naming_type === 'Prefix + Auto Number' && !values.naming_prefix) {
                frappe.msgprint('Prefix is required for Prefix + Auto Number naming type');
                return;
            }
            
            if (values.naming_type === 'Field Based' && !values.naming_field) {
                frappe.msgprint('Field name is required for Field Based naming type');
                return;
            }
            
            // Call original action
            originalAction.call(dialog, values);
        };
        
        dialog.show();
        
        // Setup event handlers after dialog is shown - use onshow callback
        dialog.onshow = function() {
            // Auto-populate table name from label with validation
            dialog.fields_dict.table_label.$input.on('input', function() {
                const label = $(this).val();
                if (label) {
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
                    
                    dialog.set_value('table_name', tableName);
                } else {
                    dialog.set_value('table_name', '');
                }
            });
            
            // Add validation for table name
            dialog.fields_dict.table_name.$input.on('input', function() {
                const tableName = $(this).val();
                const $wrapper = dialog.fields_dict.table_name.$wrapper;
                
                // Clear previous validation messages
                $wrapper.find('.validation-message').remove();
                
                if (tableName) {
                    let isValid = true;
                    let message = '';
                    
                    // Validate format
                    if (!tableName.match(/^[a-z][a-z0-9_]*$/)) {
                        isValid = false;
                        message = 'Table name must start with a letter and contain only lowercase letters, numbers, and underscores';
                    } else if (tableName.length > 61) {
                        isValid = false;
                        message = 'Table name must be 61 characters or less';
                    } else if (tableName.endsWith('_')) {
                        isValid = false;
                        message = 'Table name cannot end with underscore';
                    } else if (tableName.includes('__')) {
                        isValid = false;
                        message = 'Table name cannot contain consecutive underscores';
                    }
                    
                    // Show validation message
                    if (!isValid) {
                        $wrapper.append(`<div class="validation-message text-danger small mt-1">${message}</div>`);
                        dialog.get_primary_btn().prop('disabled', true);
                    } else {
                        dialog.get_primary_btn().prop('disabled', false);
                    }
                }
            });
        };
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
        
        dialog.show();
    }
    
    app_settings() {
        frappe.set_route('Form', 'Flansa Application', this.app_id);
    }
}