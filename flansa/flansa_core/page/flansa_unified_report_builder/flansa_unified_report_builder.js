frappe.pages['flansa-unified-report-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Unified Report Builder',
        single_column: true
    });
    
    new UnifiedReportBuilder(page);
};

class UnifiedReportBuilder {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        // State management
        this.current_step = 1;
        this.selected_table = null;
        this.available_fields = [];
        this.selected_fields = [];
        this.filters = [];
        this.sorts = [];
        this.report_data = null;
        
        // URL parameters
        this.extract_url_parameters();
        
        this.init();
    }
    
    extract_url_parameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.preselected_table = urlParams.get('table');
        this.edit_report_id = urlParams.get('edit');
        this.source_context = urlParams.get('source') || 'direct';
        
        console.log('Unified Builder: URL parameters:', {
            table: this.preselected_table,
            edit: this.edit_report_id,
            source: this.source_context
        });
    }
    
    init() {
        this.setup_ui();
        this.bind_events();
        this.load_initial_data();
        
        // If editing existing report, load it
        if (this.edit_report_id) {
            this.load_existing_report();
        }
    }
    
    setup_ui() {
        // Clear existing content and add our custom HTML directly
        this.$container.empty();
        
        // Use inline HTML for better reliability
        this.setup_inline_html();
        this.initialize_components();
    }
    
    setup_inline_html() {
        // Inline HTML for unified report builder
        this.$container.html(`
            <div class="page-header-unified">
                <div class="header-content">
                    <h2 class="page-title-unified">
                        <i class="fa fa-chart-bar" style="color: #007bff;"></i>
                        <span>Report Builder</span>
                    </h2>
                    <p class="page-subtitle-unified">Create, edit and preview reports</p>
                </div>
                <div class="header-actions">
                    <button class="btn btn-secondary btn-sm" id="back-btn">
                        <i class="fa fa-arrow-left"></i> Back
                    </button>
                    <button class="btn btn-success btn-sm" id="save-report-btn" style="display: none;">
                        <i class="fa fa-save"></i> Save Report
                    </button>
                </div>
            </div>

            <div class="unified-builder-content">
                <div class="step-navigation">
                    <div class="step active" data-step="1">
                        <div class="step-number">1</div>
                        <div class="step-label">Table Selection</div>
                    </div>
                    <div class="step" data-step="2">
                        <div class="step-number">2</div>
                        <div class="step-label">Field Selection</div>
                    </div>
                    <div class="step" data-step="3">
                        <div class="step-number">3</div>
                        <div class="step-label">Filters & Sorting</div>
                    </div>
                    <div class="step" data-step="4">
                        <div class="step-number">4</div>
                        <div class="step-label">Preview & Save</div>
                    </div>
                </div>

                <div class="step-content">
                    <div class="step-panel active" data-step="1">
                        <div class="step-title">Select Table</div>
                        <div class="table-selector">
                            <div class="form-group">
                                <label>Choose a table for your report:</label>
                                <select class="form-control" id="table-select">
                                    <option value="">Loading tables...</option>
                                </select>
                            </div>
                            <div class="table-info" id="table-info" style="display: none;">
                                <h6>Table Information</h6>
                                <div id="table-details"></div>
                            </div>
                        </div>
                    </div>

                    <div class="step-panel" data-step="2">
                        <div class="step-title">Select Fields</div>
                        <div class="field-selector">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Available Fields</h6>
                                    <div class="available-fields-list" id="available-fields">
                                        <p class="text-muted">Select a table first</p>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <h6>Selected Fields</h6>
                                    <div class="selected-fields-list" id="selected-fields">
                                        <p class="text-muted">No fields selected</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="step-panel" data-step="3">
                        <div class="step-title">Configure Filters & Sorting</div>
                        <div class="filters-sorting">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Filters</h6>
                                    <div id="filters-container">
                                        <button class="btn btn-sm btn-outline-primary" id="add-filter-btn">
                                            <i class="fa fa-plus"></i> Add Filter
                                        </button>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <h6>Sorting</h6>
                                    <div id="sorting-container">
                                        <button class="btn btn-sm btn-outline-primary" id="add-sort-btn">
                                            <i class="fa fa-plus"></i> Add Sort
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="step-panel" data-step="4">
                        <div class="step-title">Preview & Save Report</div>
                        <div class="preview-save">
                            <div class="report-settings mb-4">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Report Title</label>
                                            <input type="text" class="form-control" id="report-title" placeholder="Enter report title">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Description</label>
                                            <input type="text" class="form-control" id="report-description" placeholder="Brief description">
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="checkbox-inline">
                                        <input type="checkbox" id="make-public"> Make this report public
                                    </label>
                                </div>
                            </div>

                            <div class="preview-area">
                                <div class="preview-header">
                                    <h6>Report Preview</h6>
                                    <button class="btn btn-sm btn-outline-secondary" id="refresh-preview">
                                        <i class="fa fa-refresh"></i> Refresh
                                    </button>
                                </div>
                                <div class="preview-content" id="preview-content">
                                    <p class="text-muted">Configure your report and click refresh to see preview</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="step-navigation-buttons">
                    <button class="btn btn-secondary" id="prev-step" style="display: none;">
                        <i class="fa fa-arrow-left"></i> Previous
                    </button>
                    <button class="btn btn-primary" id="next-step">
                        Next <i class="fa fa-arrow-right"></i>
                    </button>
                    <button class="btn btn-success" id="save-final-report" style="display: none;">
                        <i class="fa fa-save"></i> Save Report
                    </button>
                </div>
            </div>
            
            <style>
                .page-header-unified {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 0;
                    border-bottom: 1px solid #eee;
                    margin-bottom: 30px;
                }
                .header-content h2.page-title-unified {
                    margin: 0;
                    font-size: 1.8rem;
                    font-weight: 600;
                    color: #333;
                }
                .page-subtitle-unified {
                    margin: 5px 0 0 0;
                    color: #666;
                    font-size: 0.9rem;
                }
                .step-navigation {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 30px;
                    position: relative;
                }
                .step-navigation::before {
                    content: '';
                    position: absolute;
                    top: 20px;
                    left: 25%;
                    right: 25%;
                    height: 2px;
                    background: #eee;
                    z-index: 1;
                }
                .step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    z-index: 2;
                    cursor: pointer;
                    margin: 0 20px;
                }
                .step-number {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #eee;
                    color: #999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    margin-bottom: 8px;
                    transition: all 0.3s ease;
                }
                .step.active .step-number {
                    background: #007bff;
                    color: white;
                }
                .step.completed .step-number {
                    background: #28a745;
                    color: white;
                }
                .step-label {
                    font-size: 0.85rem;
                    color: #666;
                    text-align: center;
                }
                .step.active .step-label {
                    color: #007bff;
                    font-weight: 600;
                }
                .step-content {
                    min-height: 400px;
                    margin-bottom: 30px;
                }
                .step-panel {
                    display: none;
                }
                .step-panel.active {
                    display: block;
                }
                .step-title {
                    font-size: 1.4rem;
                    font-weight: 600;
                    margin-bottom: 20px;
                    color: #333;
                }
                .table-selector, .field-selector, .filters-sorting, .preview-save {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #eee;
                }
                .available-fields-list, .selected-fields-list {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    min-height: 300px;
                    padding: 10px;
                    background: white;
                }
                .field-item {
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: #f8f9fa;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .field-item:hover {
                    background: #e9ecef;
                    border-color: #007bff;
                }
                .field-item.selected {
                    background: #e7f3ff;
                    border-color: #007bff;
                    color: #007bff;
                }
                .preview-area {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: white;
                }
                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                    background: #f8f9fa;
                }
                .preview-content {
                    padding: 15px;
                    min-height: 200px;
                }
                .step-navigation-buttons {
                    display: flex;
                    justify-content: space-between;
                    padding: 20px 0;
                    border-top: 1px solid #eee;
                }
                .table-info {
                    background: white;
                    padding: 15px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                    margin-top: 15px;
                }
                .filter-item, .sort-item {
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 10px;
                }
                .filter-item .row, .sort-item .row {
                    align-items: center;
                }
            </style>
        `);
    }
    
    initialize_components() {
        // Set up back button based on source context
        this.setup_back_navigation();
        
        // Load table dropdown
        this.load_tables();
        
        // If table is preselected, set it
        if (this.preselected_table) {
            setTimeout(() => {
                const tableSelect = document.getElementById('table-select');
                if (tableSelect) {
                    tableSelect.value = this.preselected_table;
                    this.on_table_select();
                }
            }, 1000);
        }
    }
    
    setup_back_navigation() {
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.source_context === 'record_viewer' && this.preselected_table) {
                    // Go back to record viewer
                    frappe.set_route('flansa-record-viewer', this.preselected_table);
                } else if (this.source_context === 'saved_reports' && this.preselected_table) {
                    // Go back to saved reports for this table
                    frappe.set_route('flansa-saved-reports', { table: this.preselected_table });
                } else {
                    // Go to general saved reports or dashboard
                    frappe.set_route('flansa-saved-reports');
                }
            });
        }
    }
    
    bind_events() {
        // Step navigation
        $(document).on('click', '#next-step', () => this.next_step());
        $(document).on('click', '#prev-step', () => this.prev_step());
        $(document).on('click', '#save-final-report', () => this.save_report());
        $(document).on('click', '#refresh-preview', () => this.refresh_preview());
        
        // Table selection
        $(document).on('change', '#table-select', () => this.on_table_select());
        
        // Field selection
        $(document).on('click', '.field-item.available', (e) => this.select_field(e));
        $(document).on('click', '.field-item.selected', (e) => this.deselect_field(e));
        
        // Filter and sort
        $(document).on('click', '#add-filter-btn', () => this.add_filter());
        $(document).on('click', '#add-sort-btn', () => this.add_sort());
        $(document).on('click', '.remove-filter', (e) => this.remove_filter(e));
        $(document).on('click', '.remove-sort', (e) => this.remove_sort(e));
        
        // Step navigation clicks
        $(document).on('click', '.step', (e) => {
            const step = parseInt($(e.currentTarget).data('step'));
            if (step <= this.current_step || this.can_navigate_to_step(step)) {
                this.go_to_step(step);
            }
        });
    }
    
    async load_tables() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_tables_list'
            });
            
            if (response.message && response.message.success) {
                this.populate_table_dropdown(response.message.tables);
            }
        } catch (error) {
            console.error('Error loading tables:', error);
            frappe.msgprint('Error loading tables');
        }
    }
    
    populate_table_dropdown(tables) {
        const tableSelect = document.getElementById('table-select');
        if (!tableSelect) return;
        
        tableSelect.innerHTML = '<option value="">Select a table...</option>';
        
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.value;
            option.textContent = table.label;
            tableSelect.appendChild(option);
        });
    }
    
    async on_table_select() {
        const tableSelect = document.getElementById('table-select');
        if (!tableSelect) return;
        
        this.selected_table = tableSelect.value;
        
        if (this.selected_table) {
            await this.load_table_info();
            await this.load_table_fields();
            this.update_step_navigation();
        }
    }
    
    async load_table_info() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_table_info',
                args: { table_name: this.selected_table }
            });
            
            if (response.message && response.message.success) {
                this.display_table_info(response.message.table);
            }
        } catch (error) {
            console.error('Error loading table info:', error);
        }
    }
    
    display_table_info(table) {
        const tableInfo = document.getElementById('table-info');
        const tableDetails = document.getElementById('table-details');
        
        if (tableInfo && tableDetails) {
            tableDetails.innerHTML = `
                <p><strong>Table:</strong> ${table.table_label || table.table_name}</p>
                <p><strong>Description:</strong> ${table.description || 'No description'}</p>
                <p><strong>Status:</strong> <span class="badge badge-${table.status === 'Active' ? 'success' : 'secondary'}">${table.status}</span></p>
            `;
            tableInfo.style.display = 'block';
        }
    }
    
    async load_table_fields() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_table_fields',
                args: { table_name: this.selected_table }
            });
            
            if (response.message && response.message.success) {
                this.available_fields = response.message.fields;
                this.display_available_fields();
            }
        } catch (error) {
            console.error('Error loading table fields:', error);
        }
    }
    
    display_available_fields() {
        const container = document.getElementById('available-fields');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.available_fields.forEach(field => {
            const fieldItem = document.createElement('div');
            fieldItem.className = 'field-item available';
            fieldItem.dataset.fieldname = field.fieldname;
            fieldItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${field.label || field.fieldname}</strong>
                        <div style="font-size: 0.8em; color: #666;">${field.fieldtype}</div>
                    </div>
                    <i class="fa fa-plus" style="color: #28a745;"></i>
                </div>
            `;
            container.appendChild(fieldItem);
        });
    }
    
    select_field(e) {
        const fieldItem = e.currentTarget;
        const fieldname = fieldItem.dataset.fieldname;
        const field = this.available_fields.find(f => f.fieldname === fieldname);
        
        if (field && !this.selected_fields.find(f => f.fieldname === fieldname)) {
            this.selected_fields.push(field);
            this.update_field_displays();
        }
    }
    
    deselect_field(e) {
        const fieldItem = e.currentTarget;
        const fieldname = fieldItem.dataset.fieldname;
        
        this.selected_fields = this.selected_fields.filter(f => f.fieldname !== fieldname);
        this.update_field_displays();
    }
    
    update_field_displays() {
        // Update selected fields display
        const selectedContainer = document.getElementById('selected-fields');
        if (selectedContainer) {
            if (this.selected_fields.length === 0) {
                selectedContainer.innerHTML = '<p class="text-muted">No fields selected</p>';
            } else {
                selectedContainer.innerHTML = '';
                this.selected_fields.forEach(field => {
                    const fieldItem = document.createElement('div');
                    fieldItem.className = 'field-item selected';
                    fieldItem.dataset.fieldname = field.fieldname;
                    fieldItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${field.label || field.fieldname}</strong>
                                <div style="font-size: 0.8em; color: #666;">${field.fieldtype}</div>
                            </div>
                            <i class="fa fa-times" style="color: #dc3545;"></i>
                        </div>
                    `;
                    selectedContainer.appendChild(fieldItem);
                });
            }
        }
        
        this.update_step_navigation();
    }
    
    next_step() {
        if (this.can_proceed_to_next_step()) {
            this.current_step++;
            this.update_step_display();
            this.update_step_navigation();
        }
    }
    
    prev_step() {
        if (this.current_step > 1) {
            this.current_step--;
            this.update_step_display();
            this.update_step_navigation();
        }
    }
    
    go_to_step(step) {
        this.current_step = step;
        this.update_step_display();
        this.update_step_navigation();
    }
    
    can_proceed_to_next_step() {
        switch (this.current_step) {
            case 1:
                return this.selected_table !== null;
            case 2:
                return this.selected_fields.length > 0;
            case 3:
                return true; // Filters and sorting are optional
            case 4:
                return false; // Last step
            default:
                return false;
        }
    }
    
    can_navigate_to_step(step) {
        switch (step) {
            case 1:
                return true;
            case 2:
                return this.selected_table !== null;
            case 3:
                return this.selected_table !== null && this.selected_fields.length > 0;
            case 4:
                return this.selected_table !== null && this.selected_fields.length > 0;
            default:
                return false;
        }
    }
    
    update_step_display() {
        // Update step navigation
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 === this.current_step) {
                step.classList.add('active');
            } else if (index + 1 < this.current_step) {
                step.classList.add('completed');
            }
        });
        
        // Update step panels
        document.querySelectorAll('.step-panel').forEach((panel, index) => {
            panel.classList.remove('active');
            if (index + 1 === this.current_step) {
                panel.classList.add('active');
            }
        });
    }
    
    update_step_navigation() {
        const prevBtn = document.getElementById('prev-step');
        const nextBtn = document.getElementById('next-step');
        const saveBtn = document.getElementById('save-final-report');
        
        if (prevBtn) {
            prevBtn.style.display = this.current_step > 1 ? 'inline-block' : 'none';
        }
        
        if (nextBtn) {
            if (this.current_step === 4) {
                nextBtn.style.display = 'none';
            } else {
                nextBtn.style.display = 'inline-block';
                nextBtn.disabled = !this.can_proceed_to_next_step();
            }
        }
        
        if (saveBtn) {
            saveBtn.style.display = this.current_step === 4 ? 'inline-block' : 'none';
        }
    }
    
    add_filter() {
        const container = document.getElementById('filters-container');
        if (!container) return;
        
        const filterIndex = this.filters.length;
        const filterHtml = `
            <div class="filter-item" data-index="${filterIndex}">
                <div class="row">
                    <div class="col-md-3">
                        <select class="form-control filter-field">
                            <option value="">Select field...</option>
                            ${this.selected_fields.map(f => `<option value="${f.fieldname}">${f.label || f.fieldname}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <select class="form-control filter-operator">
                            <option value="=">=</option>
                            <option value="!=">!=</option>
                            <option value="like">Contains</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <input type="text" class="form-control filter-value" placeholder="Value">
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-sm btn-danger remove-filter">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const addBtn = container.querySelector('#add-filter-btn');
        addBtn.insertAdjacentHTML('beforebegin', filterHtml);
        
        this.filters.push({ field: '', operator: '=', value: '' });
    }
    
    remove_filter(e) {
        const filterItem = e.target.closest('.filter-item');
        const index = parseInt(filterItem.dataset.index);
        
        filterItem.remove();
        this.filters.splice(index, 1);
    }
    
    add_sort() {
        const container = document.getElementById('sorting-container');
        if (!container) return;
        
        const sortIndex = this.sorts.length;
        const sortHtml = `
            <div class="sort-item" data-index="${sortIndex}">
                <div class="row">
                    <div class="col-md-5">
                        <select class="form-control sort-field">
                            <option value="">Select field...</option>
                            ${this.selected_fields.map(f => `<option value="${f.fieldname}">${f.label || f.fieldname}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-4">
                        <select class="form-control sort-direction">
                            <option value="asc">Ascending</option>
                            <option value="desc">Descending</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <button class="btn btn-sm btn-danger remove-sort">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const addBtn = container.querySelector('#add-sort-btn');
        addBtn.insertAdjacentHTML('beforebegin', sortHtml);
        
        this.sorts.push({ field: '', direction: 'asc' });
    }
    
    remove_sort(e) {
        const sortItem = e.target.closest('.sort-item');
        const index = parseInt(sortItem.dataset.index);
        
        sortItem.remove();
        this.sorts.splice(index, 1);
    }
    
    async refresh_preview() {
        if (!this.selected_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first');
            return;
        }
        
        try {
            // Collect current configuration
            const config = this.get_current_config();
            
            // Generate preview
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_records',
                args: {
                    table_name: this.selected_table,
                    fields: this.selected_fields.map(f => f.fieldname),
                    filters: config.filters,
                    sort: config.sorts[0], // Take first sort
                    page: 1,
                    page_size: 10
                }
            });
            
            if (response.message && response.message.success) {
                this.display_preview(response.message);
            }
        } catch (error) {
            console.error('Error generating preview:', error);
            frappe.msgprint('Error generating preview');
        }
    }
    
    display_preview(data) {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent) return;
        
        if (!data.records || data.records.length === 0) {
            previewContent.innerHTML = '<p class="text-muted">No data found</p>';
            return;
        }
        
        // Create table
        let html = '<div class="table-responsive"><table class="table table-bordered table-striped"><thead><tr>';
        
        this.selected_fields.forEach(field => {
            html += `<th>${field.label || field.fieldname}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        data.records.forEach(record => {
            html += '<tr>';
            this.selected_fields.forEach(field => {
                const value = record[field.fieldname] || '';
                html += `<td>${this.format_field_value(value, field.fieldtype)}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        html += `<p class="text-muted mt-2">Showing ${data.records.length} of ${data.total} records</p>`;
        
        previewContent.innerHTML = html;
    }
    
    format_field_value(value, fieldtype) {
        if (value === null || value === undefined) return '';
        
        switch (fieldtype) {
            case 'Date':
                return frappe.datetime.str_to_user(value);
            case 'Datetime':
                return frappe.datetime.str_to_user(value);
            case 'Currency':
                return frappe.format(value, { fieldtype: 'Currency' });
            case 'Float':
                return frappe.format(value, { fieldtype: 'Float' });
            case 'Int':
                return frappe.format(value, { fieldtype: 'Int' });
            default:
                return String(value);
        }
    }
    
    get_current_config() {
        // Collect filters
        const filters = [];
        document.querySelectorAll('.filter-item').forEach(item => {
            const field = item.querySelector('.filter-field').value;
            const operator = item.querySelector('.filter-operator').value;
            const value = item.querySelector('.filter-value').value;
            
            if (field && value) {
                filters.push({ field, operator, value });
            }
        });
        
        // Collect sorts
        const sorts = [];
        document.querySelectorAll('.sort-item').forEach(item => {
            const field = item.querySelector('.sort-field').value;
            const direction = item.querySelector('.sort-direction').value;
            
            if (field) {
                sorts.push({ field, order: direction });
            }
        });
        
        return {
            selected_fields: this.selected_fields.map(f => f.fieldname),
            filters: filters,
            sorts: sorts
        };
    }
    
    async save_report() {
        const title = document.getElementById('report-title').value;
        const description = document.getElementById('report-description').value;
        const isPublic = document.getElementById('make-public').checked;
        
        if (!title) {
            frappe.msgprint('Please enter a report title');
            return;
        }
        
        const config = this.get_current_config();
        
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.save_report',
                args: {
                    report_title: title,
                    description: description,
                    base_table: this.selected_table,
                    report_type: 'Table',
                    report_config: config,
                    is_public: isPublic ? 1 : 0
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: 'Report saved successfully!',
                    indicator: 'green'
                });
                
                // Navigate back to saved reports
                setTimeout(() => {
                    frappe.set_route('flansa-saved-reports', { table: this.selected_table });
                }, 1500);
            } else {
                frappe.msgprint(response.message.error || 'Error saving report');
            }
        } catch (error) {
            console.error('Error saving report:', error);
            frappe.msgprint('Error saving report');
        }
    }
    
    async load_existing_report() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { report_id: this.edit_report_id }
            });
            
            if (response.message && response.message.success) {
                this.populate_from_saved_report(response.message.report);
            }
        } catch (error) {
            console.error('Error loading existing report:', error);
        }
    }
    
    populate_from_saved_report(report) {
        // Set basic info
        document.getElementById('report-title').value = report.title || '';
        document.getElementById('report-description').value = report.description || '';
        document.getElementById('make-public').checked = report.is_public || false;
        
        // Set table and load fields
        this.selected_table = report.base_table;
        const tableSelect = document.getElementById('table-select');
        if (tableSelect) {
            tableSelect.value = this.selected_table;
            this.on_table_select();
        }
        
        // Apply saved configuration after fields load
        setTimeout(() => {
            if (report.config && report.config.selected_fields) {
                this.selected_fields = this.available_fields.filter(f => 
                    report.config.selected_fields.includes(f.fieldname)
                );
                this.update_field_displays();
            }
        }, 1000);
    }
    
    load_initial_data() {
        // Any initial data loading can go here
        console.log('Unified Report Builder initialized');
    }
}

// Make it globally accessible
window.UnifiedReportBuilder = UnifiedReportBuilder;