frappe.pages['flansa-unified-report-builder'].on_page_load = function(wrapper) {
    frappe.unified_report_builder = new UnifiedReportBuilder(wrapper);
};

class UnifiedReportBuilder {
    constructor(wrapper) {
        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Report Builder',
            single_column: true
        });
        
        this.$container = $(this.page.body);
        this.selected_table = null;
        this.available_fields = {};
        this.selected_fields = [];
        this.filters = [];
        this.sorting = [];
        this.edit_report_id = null;
        this.source_context = null;
        this.preselected_table = null;
        
        this.parse_url_parameters();
        this.setup_single_step_layout();
        this.initialize_components();
    }
    
    parse_url_parameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.edit_report_id = urlParams.get('edit');
        this.source_context = urlParams.get('source');
        this.preselected_table = urlParams.get('table');
    }
    
    setup_single_step_layout() {
        this.$container.html(`
            <div class="single-step-builder">
                <!-- Header -->
                <div class="builder-header">
                    <div class="header-content">
                        <h2><i class="fa fa-chart-bar text-primary"></i> Report Builder</h2>
                        <p class="text-muted">Configure your report settings and preview results</p>
                    </div>
                    <div class="header-actions">
                        <button class="btn btn-secondary" id="back-btn">
                            <i class="fa fa-arrow-left"></i> Back
                        </button>
                    </div>
                </div>

                <!-- Report Title & Description -->
                <div class="report-info-section">
                    <div class="row">
                        <div class="col-md-4">
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
                        <div class="col-md-2">
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="make-public">
                                    <label class="form-check-label" for="make-public">Public</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Configuration Content -->
                <div class="builder-content">
                    <!-- Field Selection Section -->
                    <div class="config-section">
                        <h5><i class="fa fa-columns text-success"></i> Select Fields</h5>
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Available Fields</h6>
                                        <div class="fields-container" id="available-fields">
                                            <p class="text-muted">Select a table first</p>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Selected Fields <span class="badge badge-primary" id="field-count">0</span></h6>
                                        <div class="fields-container" id="selected-fields">
                                            <p class="text-muted">No fields selected</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Filters & Sorting -->
                            <div class="config-section">
                                <h5><i class="fa fa-filter text-warning"></i> 3. Filters & Sorting</h5>
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Filters</h6>
                                        <div id="filters-container">
                                            <button class="btn btn-sm btn-outline-primary" id="add-filter">
                                                <i class="fa fa-plus"></i> Add Filter
                                            </button>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Sorting</h6>
                                        <div id="sorting-container">
                                            <button class="btn btn-sm btn-outline-primary" id="add-sort">
                                                <i class="fa fa-plus"></i> Add Sort
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Report Settings -->
                            <div class="config-section">
                                <h5><i class="fa fa-cog text-info"></i> 4. Report Settings</h5>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Report Title</label>
                                            <input type="text" class="form-control" id="report-title" placeholder="Enter title">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Description</label>
                                            <input type="text" class="form-control" id="report-description" placeholder="Description">
                                        </div>
                                    </div>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="make-public">
                                    <label class="form-check-label" for="make-public">Make this report public</label>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Live Preview -->
                        <div class="col-md-6">
                            <div class="preview-section">
                                <div class="preview-header">
                                    <h5><i class="fa fa-eye text-info"></i> Live Preview</h5>
                                    <div class="preview-actions">
                                        <button class="btn btn-sm btn-outline-secondary" id="refresh-preview">
                                            <i class="fa fa-refresh"></i> Refresh
                                        </button>
                                        <button class="btn btn-sm btn-info" id="preview-dialog">
                                            <i class="fa fa-expand"></i> Full Preview
                                        </button>
                                        <button class="btn btn-sm btn-success" id="save-report">
                                            <i class="fa fa-save"></i> Save
                                        </button>
                                        <button class="btn btn-sm btn-danger" id="delete-report" style="display: none;">
                                            <i class="fa fa-trash"></i> Delete
                                        </button>
                                    </div>
                                </div>
                                <div class="preview-content" id="preview-content">
                                    <div class="preview-placeholder">
                                        <i class="fa fa-chart-bar fa-3x text-muted"></i>
                                        <p class="text-muted mt-2">Configure your report to see live preview</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .single-step-builder {
                    padding: 20px;
                }
                
                .builder-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e9ecef;
                }
                
                .builder-header h2 {
                    margin: 0;
                    font-weight: 600;
                }
                
                .config-section {
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                
                .config-section h5 {
                    margin-bottom: 15px;
                    font-weight: 600;
                }
                
                .fields-container {
                    max-height: 200px;
                    overflow-y: auto;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 10px;
                    background: white;
                }
                
                .preview-section {
                    background: #fff;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    height: calc(100vh - 200px);
                    position: sticky;
                    top: 20px;
                }
                
                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .preview-header h5 {
                    margin: 0;
                    font-weight: 600;
                }
                
                .preview-content {
                    padding: 20px;
                    height: calc(100% - 80px);
                    overflow-y: auto;
                }
                
                .preview-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 200px;
                }
                
                .field-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px;
                    margin: 4px 0;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .field-item:hover {
                    background: #e3f2fd;
                }
                
                .field-item.selected {
                    background: #bbdefb;
                    border-color: #2196f3;
                }
                
                .field-category-header {
                    font-weight: 600;
                    color: #666;
                    font-size: 0.9rem;
                    margin: 10px 0 5px 0;
                    text-transform: uppercase;
                }
                
                .filter-item, .sort-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                
                .btn-sm {
                    font-size: 0.875rem;
                }
                
                .badge {
                    font-size: 0.75rem;
                }
            </style>
        `);
    }
    
    initialize_components() {
        this.setup_navigation();
        this.setup_event_handlers();
        this.load_tables();
        
        // Load existing report if editing
        if (this.edit_report_id) {
            this.load_existing_report();
        }
    }
    
    setup_navigation() {
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.source_context === 'record_viewer' && this.preselected_table) {
                    window.location.href = `/app/flansa-record-viewer?table=${encodeURIComponent(this.preselected_table)}`;
                } else if (this.source_context === 'saved_reports' && this.preselected_table) {
                    window.location.href = `/app/flansa-saved-reports?table=${encodeURIComponent(this.preselected_table)}`;
                } else {
                    window.location.href = `/app/flansa-saved-reports`;
                }
            });
        }
    }
    
    setup_event_handlers() {
        // Table selection
        $(document).on('change', '#table-select', () => this.on_table_select());
        
        // Add filter/sort buttons
        $(document).on('click', '#add-filter', () => this.add_filter());
        $(document).on('click', '#add-sort', () => this.add_sort());
        
        // Preview and save
        $(document).on('click', '#refresh-preview', () => this.refresh_preview());
        $(document).on('click', '#preview-dialog', () => this.show_preview_dialog());
        $(document).on('click', '#save-report', () => this.save_report());
        $(document).on('click', '#delete-report', () => this.delete_report());
        
        // Auto-refresh preview when configuration changes
        $(document).on('change', '#report-title, #report-description', () => {
            if (this.selected_fields.length > 0) {
                this.refresh_preview();
            }
        });
    }
    
    async load_tables() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_tables'
            });
            
            console.log('Tables API response:', response);
            
            if (response.message && response.message.success) {
                const select = document.getElementById('table-select');
                select.innerHTML = '<option value="">Choose a table...</option>';
                
                console.log('Loading', response.message.tables.length, 'tables');
                
                response.message.tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table.value || table.name;
                    option.textContent = `${table.label || table.table_label} (${table.value || table.name})`;
                    select.appendChild(option);
                });
                
                console.log('Table select populated with', select.options.length - 1, 'tables');
                
                // Pre-select table if specified
                if (this.preselected_table) {
                    console.log('Pre-selecting table:', this.preselected_table);
                    select.value = this.preselected_table;
                    this.on_table_select();
                }
            } else {
                console.error('Tables API error:', response.message);
            }
        } catch (error) {
            console.error('Error loading tables:', error);
        }
    }
    
    async on_table_select() {
        const select = document.getElementById('table-select');
        this.selected_table = select.value;
        
        console.log('Table selected:', this.selected_table);
        
        if (!this.selected_table) {
            console.log('No table selected, clearing fields');
            this.clear_fields();
            return;
        }
        
        console.log('Loading field options for table:', this.selected_table);
        await this.load_field_options();
    }
    
    async load_field_options() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.get_report_field_options',
                args: { table_name: this.selected_table }
            });
            
            if (response.message && response.message.success) {
                this.available_fields = response.message.fields;
                this.display_available_fields();
            }
        } catch (error) {
            console.error('Error loading field options:', error);
        }
    }
    
    display_available_fields() {
        const container = document.getElementById('available-fields');
        container.innerHTML = '';
        
        // Current table fields
        if (this.available_fields.current && this.available_fields.current.length > 0) {
            const header = document.createElement('div');
            header.className = 'field-category-header';
            header.innerHTML = '<i class="fa fa-table"></i> Table Fields';
            container.appendChild(header);
            
            this.available_fields.current.forEach(field => {
                this.create_field_item(field, container);
            });
        }
        
        // System fields
        if (this.available_fields.system && this.available_fields.system.length > 0) {
            const header = document.createElement('div');
            header.className = 'field-category-header';
            header.innerHTML = '<i class="fa fa-cog"></i> System Fields';
            container.appendChild(header);
            
            this.available_fields.system.forEach(field => {
                this.create_field_item(field, container);
            });
        }
        
        // Related fields
        if (this.available_fields.related_groups && this.available_fields.related_groups.length > 0) {
            this.available_fields.related_groups.forEach(group => {
                const header = document.createElement('div');
                header.className = 'field-category-header';
                header.innerHTML = `<i class="fa fa-link"></i> ${group.link_field_label}`;
                container.appendChild(header);
                
                group.fields.forEach(field => {
                    this.create_field_item(field, container);
                });
            });
        }
    }
    
    create_field_item(field, container) {
        const item = document.createElement('div');
        item.className = 'field-item';
        item.dataset.fieldname = field.fieldname;
        item.innerHTML = `
            <span>
                <i class="fa fa-${this.get_field_icon(field.fieldtype)}"></i>
                ${field.field_label || field.fieldname}
            </span>
            <small class="text-muted">${field.fieldtype}</small>
        `;
        
        item.addEventListener('click', () => this.toggle_field(field));
        container.appendChild(item);
    }
    
    get_field_icon(fieldtype) {
        const icons = {
            'Data': 'font',
            'Text': 'align-left',
            'Int': 'hashtag',
            'Float': 'calculator',
            'Currency': 'dollar-sign',
            'Date': 'calendar',
            'Datetime': 'clock',
            'Select': 'list',
            'Link': 'link',
            'Check': 'check-square',
            'Attach': 'paperclip',
            'Attach Image': 'image'
        };
        return icons[fieldtype] || 'circle';
    }
    
    toggle_field(field) {
        const isSelected = this.selected_fields.find(f => f.fieldname === field.fieldname);
        
        if (isSelected) {
            this.selected_fields = this.selected_fields.filter(f => f.fieldname !== field.fieldname);
        } else {
            this.selected_fields.push({
                ...field,
                custom_label: field.field_label || field.fieldname
            });
        }
        
        this.update_field_display();
        this.auto_refresh_preview();
    }
    
    update_field_display() {
        // Update selected fields display
        const container = document.getElementById('selected-fields');
        const countBadge = document.getElementById('field-count');
        
        countBadge.textContent = this.selected_fields.length;
        
        if (this.selected_fields.length === 0) {
            container.innerHTML = '<p class="text-muted">No fields selected</p>';
            return;
        }
        
        container.innerHTML = '';
        this.selected_fields.forEach((field) => {
            const item = document.createElement('div');
            item.className = 'field-item selected';
            item.innerHTML = `
                <span>
                    <i class="fa fa-${this.get_field_icon(field.fieldtype)}"></i>
                    ${field.custom_label}
                </span>
                <button class="btn btn-sm btn-outline-danger" onclick="flansa_unified_report_builder.remove_field('${field.fieldname}')">
                    <i class="fa fa-times"></i>
                </button>
            `;
            container.appendChild(item);
        });
        
        // Update available fields highlighting
        document.querySelectorAll('#available-fields .field-item').forEach(item => {
            const fieldname = item.dataset.fieldname;
            const isSelected = this.selected_fields.find(f => f.fieldname === fieldname);
            item.classList.toggle('selected', !!isSelected);
        });
    }
    
    remove_field(fieldname) {
        this.selected_fields = this.selected_fields.filter(f => f.fieldname !== fieldname);
        this.update_field_display();
        this.auto_refresh_preview();
    }
    
    auto_refresh_preview() {
        if (this.selected_fields.length > 0) {
            setTimeout(() => this.refresh_preview(), 500);
        }
    }
    
    add_filter() {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = document.getElementById('filters-container');
        const filterDiv = document.createElement('div');
        filterDiv.className = 'filter-item';
        filterDiv.innerHTML = `
            <select class="form-control form-control-sm">
                ${this.selected_fields.map(f => `<option value="${f.fieldname}">${f.custom_label}</option>`).join('')}
            </select>
            <select class="form-control form-control-sm">
                <option value="=">Equals</option>
                <option value="!=">Not Equals</option>
                <option value="like">Contains</option>
                <option value=">">Greater Than</option>
                <option value="<">Less Than</option>
            </select>
            <input type="text" class="form-control form-control-sm" placeholder="Value">
            <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
                <i class="fa fa-times"></i>
            </button>
        `;
        container.appendChild(filterDiv);
    }
    
    add_sort() {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = document.getElementById('sorting-container');
        const sortDiv = document.createElement('div');
        sortDiv.className = 'sort-item';
        sortDiv.innerHTML = `
            <select class="form-control form-control-sm">
                ${this.selected_fields.map(f => `<option value="${f.fieldname}">${f.custom_label}</option>`).join('')}
            </select>
            <select class="form-control form-control-sm">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
            </select>
            <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
                <i class="fa fa-times"></i>
            </button>
        `;
        container.appendChild(sortDiv);
    }
    
    async refresh_preview() {
        if (!this.selected_table || !this.selected_fields.length) {
            document.getElementById('preview-content').innerHTML = `
                <div class="preview-placeholder">
                    <i class="fa fa-chart-bar fa-3x text-muted"></i>
                    <p class="text-muted mt-2">Select table and fields to see preview</p>
                </div>
            `;
            return;
        }
        
        try {
            document.getElementById('preview-content').innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading preview...</div>';
            
            const config = this.build_report_config();
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                args: {
                    report_config: config,
                    view_options: { page_size: 10 }
                }
            });
            
            if (response.message && response.message.success) {
                this.display_preview(response.message);
            } else {
                throw new Error(response.message?.error || 'Failed to execute report');
            }
        } catch (error) {
            console.error('Error refreshing preview:', error);
            document.getElementById('preview-content').innerHTML = `
                <div class="alert alert-danger">
                    <i class="fa fa-exclamation-triangle"></i>
                    Error: ${error.message}
                </div>
            `;
        }
    }
    
    build_report_config() {
        // Build filters
        const filters = [];
        document.querySelectorAll('.filter-item').forEach(item => {
            const selects = item.querySelectorAll('select');
            const input = item.querySelector('input');
            if (selects[0].value && input.value) {
                filters.push({
                    field: selects[0].value,
                    operator: selects[1].value,
                    value: input.value
                });
            }
        });
        
        // Build sorting
        const sort = [];
        document.querySelectorAll('.sort-item').forEach(item => {
            const selects = item.querySelectorAll('select');
            sort.push({
                field: selects[0].value,
                direction: selects[1].value
            });
        });
        
        return {
            base_table: this.selected_table,
            selected_fields: this.selected_fields,
            filters: filters,
            sort: sort
        };
    }
    
    display_preview(data) {
        if (!data.data || data.data.length === 0) {
            document.getElementById('preview-content').innerHTML = `
                <div class="alert alert-info">
                    <i class="fa fa-info-circle"></i>
                    No data found with current configuration
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="thead-light">
                        <tr>
                            ${this.selected_fields.map(field => `<th>${field.custom_label}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.data.slice(0, 5).forEach(record => {
            html += '<tr>';
            this.selected_fields.forEach(field => {
                const value = record[field.fieldname] || '';
                html += `<td>${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <p class="text-muted mt-2">
                <i class="fa fa-info-circle"></i>
                Showing first 5 of ${data.total} records
            </p>
        `;
        
        document.getElementById('preview-content').innerHTML = html;
    }
    
    async show_preview_dialog() {
        if (!this.selected_table || !this.selected_fields.length) {
            frappe.msgprint('Please select table and fields first');
            return;
        }
        
        try {
            const config = this.build_report_config();
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                args: {
                    report_config: config,
                    view_options: { page_size: 50 }
                }
            });
            
            if (response.message && response.message.success) {
                this.display_full_preview_dialog(response.message);
            } else {
                throw new Error(response.message?.error || 'Failed to execute report');
            }
        } catch (error) {
            console.error('Error loading full preview:', error);
            frappe.msgprint('Error loading preview: ' + error.message);
        }
    }
    
    display_full_preview_dialog(data) {
        const title = document.getElementById('report-title').value || 'Report Preview';
        
        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="thead-dark">
                        <tr>
                            ${this.selected_fields.map(field => `<th>${field.custom_label}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (data.data && data.data.length > 0) {
            data.data.forEach(record => {
                tableHtml += '<tr>';
                this.selected_fields.forEach(field => {
                    const value = record[field.fieldname] || '';
                    tableHtml += `<td>${value}</td>`;
                });
                tableHtml += '</tr>';
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="${this.selected_fields.length}" class="text-center text-muted">
                        No data found with current configuration
                    </td>
                </tr>
            `;
        }
        
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <p class="text-muted">
                    <i class="fa fa-info-circle"></i>
                    Showing ${data.data ? data.data.length : 0} of ${data.total || 0} records
                </p>
            </div>
        `;
        
        const dialog = new frappe.ui.Dialog({
            title: title,
            size: 'extra-large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview_content',
                    options: tableHtml
                }
            ]
        });
        
        dialog.show();
    }
    
    async save_report() {
        const title = document.getElementById('report-title').value;
        const description = document.getElementById('report-description').value;
        const isPublic = document.getElementById('make-public').checked;
        
        if (!title) {
            frappe.msgprint('Please enter a report title');
            return;
        }
        
        if (!this.selected_table || !this.selected_fields.length) {
            frappe.msgprint('Please select table and fields');
            return;
        }
        
        try {
            const config = this.build_report_config();
            const method = this.edit_report_id ? 
                'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.update_report' :
                'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.save_report';
            
            const args = {
                title: title,
                description: description,
                base_table: this.selected_table,
                config: config,
                is_public: isPublic ? 1 : 0
            };
            
            if (this.edit_report_id) {
                args.report_id = this.edit_report_id;
                args.report_title = title;
                args.report_type = 'custom';
                args.report_config = config;
            }
            
            const response = await frappe.call({ method, args });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: this.edit_report_id ? 'Report updated successfully!' : 'Report saved successfully!',
                    indicator: 'green'
                });
                
                // Navigate to report viewer
                const reportId = this.edit_report_id || response.message.report_id;
                setTimeout(() => {
                    window.location.href = `/app/flansa-report-viewer?report=${encodeURIComponent(reportId)}`;
                }, 1500);
            } else {
                frappe.msgprint(response.message?.error || 'Error saving report');
            }
        } catch (error) {
            console.error('Error saving report:', error);
            frappe.msgprint('Error saving report');
        }
    }
    
    async delete_report() {
        if (!this.edit_report_id) return;
        
        const confirm = await new Promise(resolve => {
            frappe.confirm('Are you sure you want to delete this report?', resolve);
        });
        
        if (!confirm) return;
        
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.delete_report',
                args: { report_id: this.edit_report_id }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: 'Report deleted successfully',
                    indicator: 'green'
                });
                
                setTimeout(() => {
                    window.location.href = `/app/flansa-saved-reports?table=${encodeURIComponent(this.selected_table)}`;
                }, 1500);
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            frappe.msgprint('Error deleting report');
        }
    }
    
    async load_existing_report() {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { report_id: this.edit_report_id }
            });
            
            if (response.message && response.message.success) {
                const report = response.message.report;
                
                // Set form values
                document.getElementById('report-title').value = report.title || '';
                document.getElementById('report-description').value = report.description || '';
                document.getElementById('make-public').checked = report.is_public || false;
                
                // Set table
                document.getElementById('table-select').value = report.base_table;
                this.selected_table = report.base_table;
                
                // Load fields and populate selection
                await this.load_field_options();
                
                // Set selected fields
                if (report.config && report.config.selected_fields) {
                    const allFields = [
                        ...(this.available_fields.current || []),
                        ...(this.available_fields.system || []),
                        ...(this.available_fields.related_groups || []).flatMap(group => group.fields)
                    ];
                    
                    this.selected_fields = [];
                    report.config.selected_fields.forEach(savedField => {
                        const field = allFields.find(f => f.fieldname === savedField.fieldname);
                        if (field) {
                            this.selected_fields.push({
                                ...field,
                                custom_label: savedField.custom_label || field.field_label || field.fieldname
                            });
                        }
                    });
                    
                    this.update_field_display();
                }
                
                // Show delete button
                document.getElementById('delete-report').style.display = 'inline-block';
                
                // Refresh preview
                this.refresh_preview();
            }
        } catch (error) {
            console.error('Error loading existing report:', error);
        }
    }
    
    clear_fields() {
        document.getElementById('available-fields').innerHTML = '<p class="text-muted">Select a table first</p>';
        document.getElementById('selected-fields').innerHTML = '<p class="text-muted">No fields selected</p>';
        document.getElementById('field-count').textContent = '0';
        this.selected_fields = [];
        this.available_fields = {};
    }
}

// Global reference for onclick handlers
window.flansa_unified_report_builder = null;

$(document).ready(() => {
    // Store global reference when page loads
    if (frappe.unified_report_builder) {
        window.flansa_unified_report_builder = frappe.unified_report_builder;
    }
});