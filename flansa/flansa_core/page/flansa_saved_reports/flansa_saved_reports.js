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
        // Clear existing content and add our custom HTML
        this.$container.empty();
        
        // Load our custom HTML
        fetch('/assets/flansa/flansa/flansa_core/page/flansa_saved_reports/flansa_saved_reports.html')
            .then(response => response.text())
            .then(html => {
                // Extract just the body content
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const content = doc.querySelector('.layout-wrapper').innerHTML;
                this.$container.html(content);
                
                // Initialize UI components after HTML is loaded
                this.initialize_components();
            })
            .catch(error => {
                console.error('Error loading HTML:', error);
                this.setup_fallback_ui();
            });
    }
    
    setup_fallback_ui() {
        // Fallback UI if HTML loading fails
        this.$container.html(`
            <div class="saved-reports-fallback">
                <div class="alert alert-info">
                    <h4>Saved Reports</h4>
                    <p>Loading your saved reports...</p>
                </div>
                <div id="reports-content">
                    <!-- Content will be loaded here -->
                </div>
            </div>
        `);
        this.initialize_components();
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
            let route = 'flansa-unified-report-builder';
            let params = { source: 'saved_reports' };
            
            if (this.filter_table) {
                params.table = this.filter_table;
            }
            
            const queryString = new URLSearchParams(params).toString();
            frappe.set_route(route + '?' + queryString);
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
        const template = document.getElementById('report-card-template');
        if (!template) return document.createElement('div');
        
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.report-card');
        
        // Set data
        cardElement.dataset.reportId = report.name;
        
        // Fill content
        card.querySelector('.report-title').textContent = report.report_title;
        card.querySelector('.report-description').textContent = report.description || 'No description';
        card.querySelector('.table-name').textContent = report.base_table;
        card.querySelector('.created-by').textContent = report.created_by_user;
        card.querySelector('.created-date').textContent = frappe.datetime.str_to_user(report.created_on);
        
        // Set type badge
        const typeBadge = card.querySelector('.report-type-badge');
        typeBadge.textContent = report.report_type || 'Table';
        typeBadge.className = `report-type-badge ${(report.report_type || 'table').toLowerCase()}`;
        
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
            frappe.set_route('flansa-report-viewer', reportId);
        }
    }
    
    edit_report(e) {
        e.preventDefault();
        const reportCard = e.target.closest('.report-card');
        const reportId = reportCard?.dataset.reportId;
        
        if (reportId) {
            const params = new URLSearchParams({
                edit: reportId,
                source: 'saved_reports'
            });
            
            if (this.filter_table) {
                params.set('table', this.filter_table);
            }
            
            frappe.set_route('flansa-unified-report-builder?' + params.toString());
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
            await frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: 'Flansa Saved Report',
                    name: reportId
                }
            });
            
            frappe.show_alert({
                message: 'Report deleted successfully!',
                indicator: 'green'
            });
            
            this.load_reports(); // Reload reports
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