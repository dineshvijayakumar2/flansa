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
            <div class="page-header-reports">
                <div class="header-content">
                    <h2 class="page-title-reports">
                        <i class="fa fa-chart-line" style="color: #007bff;"></i>
                        <span id="page-title-text">Saved Reports</span>
                    </h2>
                    <p class="page-subtitle-reports" id="page-subtitle-text">Manage and view your saved reports</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary btn-sm" id="back-to-table-btn" style="display: none;">
                        <i class="fa fa-arrow-left"></i> Back to Table
                    </button>
                    <button class="btn btn-primary btn-sm" id="create-new-report-btn">
                        <i class="fa fa-plus"></i> Create New Report
                    </button>
                </div>
            </div>

            <div class="filter-section" id="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Filter by Table</label>
                            <select class="form-control" id="table-filter">
                                <option value="">All Tables</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Report Type</label>
                            <select class="form-control" id="type-filter">
                                <option value="">All Types</option>
                                <option value="Table">Table Reports</option>
                                <option value="Chart">Chart Reports</option>
                                <option value="Summary">Summary Reports</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Search</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="search-input" placeholder="Search reports...">
                                <div class="input-group-append">
                                    <button class="btn btn-outline-secondary" id="search-btn">
                                        <i class="fa fa-search"></i>
                                    </button>
                                </div>
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
                .page-header-reports {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 0;
                    border-bottom: 1px solid #eee;
                    margin-bottom: 20px;
                }

                .header-content h2.page-title-reports {
                    margin: 0;
                    font-size: 1.8rem;
                    font-weight: 600;
                    color: #333;
                }

                .page-subtitle-reports {
                    margin: 5px 0 0 0;
                    color: #666;
                    font-size: 0.9rem;
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

                .report-card {
                    height: 100%;
                }

                .report-card .card {
                    height: 100%;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .report-card .card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    border-color: #007bff;
                }

                .card-header {
                    background: #f8f9fa;
                    border-bottom: 1px solid #e0e0e0;
                    padding: 15px;
                }

                .card-title {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0;
                }

                .report-title {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #333;
                    flex: 1;
                }

                .report-type-badge {
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    margin-left: 10px;
                }

                .report-type-badge.table {
                    background: #e7f3ff;
                    color: #0066cc;
                }

                .card-body {
                    padding: 15px;
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
        $(document).on('input', '#search-input', () => this.debounce_search());
        $(document).on('click', '#search-btn', () => this.apply_filters());
        
        // Report card events
        $(document).on('click', '.view-report-btn', (e) => this.view_report(e));
        $(document).on('click', '.edit-report-btn', (e) => this.edit_report(e));
        $(document).on('click', '.view-report', (e) => this.view_report(e));
        $(document).on('click', '.edit-report', (e) => this.edit_report(e));
        $(document).on('click', '.duplicate-report', (e) => this.duplicate_report(e));
        $(document).on('click', '.delete-report', (e) => this.delete_report(e));
        
        // Pagination events
        $(document).on('click', '.page-link', (e) => this.handle_pagination(e));
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
                this.populate_table_filter(response.message.tables);
            }
        } catch (error) {
            console.error('Error loading tables:', error);
        }
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
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.get_user_reports',
                args: { base_table: this.filter_table }
            });
            
            if (response.message) {
                this.reports = response.message;
                this.apply_filters();
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
    
    apply_filters() {
        const tableFilter = document.getElementById('table-filter')?.value || '';
        const typeFilter = document.getElementById('type-filter')?.value || '';
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        
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
                    report.base_table
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) return false;
            }
            
            return true;
        });
        
        this.current_page = 1;
        this.render_reports();
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
        
        // Show grid
        reportsGrid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        
        // Calculate pagination
        this.total_pages = Math.ceil(this.filtered_reports.length / this.page_size);
        const start_index = (this.current_page - 1) * this.page_size;
        const end_index = start_index + this.page_size;
        const page_reports = this.filtered_reports.slice(start_index, end_index);
        
        // Render report cards
        reportsGrid.innerHTML = '';
        page_reports.forEach(report => {
            const card = this.create_report_card(report);
            reportsGrid.appendChild(card);
        });
        
        // Render pagination
        this.render_pagination();
    }
    
    create_report_card(report) {
        // Create report card directly without template
        const cardElement = document.createElement('div');
        cardElement.className = 'report-card';
        cardElement.dataset.reportId = report.name;
        
        // Create card HTML directly
        cardElement.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <h6 class="report-title">${report.report_title}</h6>
                        <span class="report-type-badge ${(report.report_type || 'table').toLowerCase()}">${report.report_type || 'Table'}</span>
                    </div>
                    <div class="card-actions">
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-toggle="dropdown">
                                <i class="fa fa-ellipsis-v"></i>
                            </button>
                            <div class="dropdown-menu dropdown-menu-right">
                                <a class="dropdown-item view-report" href="#">
                                    <i class="fa fa-eye"></i> View Report
                                </a>
                                <a class="dropdown-item edit-report" href="#">
                                    <i class="fa fa-edit"></i> Edit Report
                                </a>
                                <a class="dropdown-item duplicate-report" href="#">
                                    <i class="fa fa-copy"></i> Duplicate
                                </a>
                                <div class="dropdown-divider"></div>
                                <a class="dropdown-item text-danger delete-report" href="#">
                                    <i class="fa fa-trash"></i> Delete
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <p class="report-description">${report.description || 'No description'}</p>
                    <div class="report-meta">
                        <small class="text-muted">
                            <i class="fa fa-table"></i> <span class="table-name">${report.base_table}</span>
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
    
    async delete_report(e) {
        e.preventDefault();
        const reportCard = e.target.closest('.report-card');
        const reportId = reportCard?.dataset.reportId;
        const reportTitle = reportCard?.querySelector('.report-title')?.textContent;
        
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
}

// Make it globally accessible
window.SavedReportsPage = SavedReportsPage;