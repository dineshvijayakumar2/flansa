// Load shared FlansaReportRenderer if not already available
if (!window.FlansaReportRenderer) {
    console.log('Loading FlansaReportRenderer in report builder...');
    // Use synchronous loading to ensure availability
    try {
        frappe.require('/assets/flansa/js/flansa_report_renderer.js');
        console.log('FlansaReportRenderer loaded successfully');
    } catch (error) {
        console.warn('Could not load FlansaReportRenderer:', error);
    }
}

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
        this.grouping = [];
        this.sorting = [];
        this.edit_report_id = null;
        this.source_context = null;
        this.preselected_table = null;
        
        this.parse_url_parameters();
        this.setup_improved_layout();
        this.initialize_components();
    }
    
    parse_url_parameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.edit_report_id = urlParams.get('edit');
        this.source_context = urlParams.get('source');
        this.preselected_table = urlParams.get('table');
        
        // If no preselected table, try to get from route
        if (!this.preselected_table) {
            const route = frappe.get_route();
            if (route.length > 1 && route[1] !== 'new') {
                this.preselected_table = route[1];
            }
        }
    }
    
    setup_improved_layout() {
        this.$container.html(`
            <div class="improved-report-builder">
                <!-- Header with Title/Description -->
                <div class="builder-header">
                    <div class="row">
                        <div class="col-md-6">
                            <h3><i class="fa fa-chart-bar text-primary"></i> Report Builder</h3>
                        </div>
                        <div class="col-md-6 text-right">
                            <button class="btn btn-secondary" id="back-btn">
                                <i class="fa fa-arrow-left"></i> Back
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Report Info Section -->
                <div class="report-info-card">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group">
                                <label><strong>Report Title</strong></label>
                                <input type="text" class="form-control" id="report-title" placeholder="Enter report title">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label><strong>Description</strong></label>
                                <input type="text" class="form-control" id="report-description" placeholder="Brief description of this report">
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="form-group">
                                <label><strong>Visibility</strong></label>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="make-public">
                                    <label class="form-check-label" for="make-public">Public Report</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Field Selection Section -->
                <div class="section-card">
                    <h5><i class="fa fa-columns text-success"></i> Select Fields</h5>
                    <div class="row">
                        <div class="col-md-4">
                            <h6>Available Fields</h6>
                            <div class="fields-container" id="available-fields">
                                <p class="text-muted">Loading fields...</p>
                            </div>
                        </div>
                        <div class="col-md-8">
                            <h6>Selected Fields <span class="badge badge-primary" id="field-count">0</span></h6>
                            <div class="fields-container" id="selected-fields">
                                <p class="text-muted">No fields selected. Click on available fields to add them.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Filters & Sorting Section -->
                <div class="section-card">
                    <h5><i class="fa fa-filter text-warning"></i> Filters, Grouping & Sorting</h5>
                    <div class="row">
                        <div class="col-md-4">
                            <h6>Filters</h6>
                            <div id="filters-container">
                                <button class="btn btn-sm btn-outline-primary" id="add-filter">
                                    <i class="fa fa-plus"></i> Add Filter
                                </button>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <h6>Group By</h6>
                            <div id="grouping-container">
                                <button class="btn btn-sm btn-outline-primary" id="add-group">
                                    <i class="fa fa-plus"></i> Add Grouping
                                </button>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <h6>Sort By</h6>
                            <div id="sorting-container">
                                <button class="btn btn-sm btn-outline-primary" id="add-sort">
                                    <i class="fa fa-plus"></i> Add Sort
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Actions Section -->
                <div class="actions-card">
                    <div class="text-center">
                        <button class="btn btn-info btn-lg" id="preview-dialog">
                            <i class="fa fa-eye"></i> Preview Report
                        </button>
                        <button class="btn btn-success btn-lg" id="save-report">
                            <i class="fa fa-save"></i> Save Report
                        </button>
                        <button class="btn btn-danger" id="delete-report" style="display: none;">
                            <i class="fa fa-trash"></i> Delete Report
                        </button>
                    </div>
                </div>
            </div>

            <style>
                .improved-report-builder {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                .builder-header {
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e9ecef;
                }
                
                .builder-header h3 {
                    margin: 0;
                    font-weight: 600;
                }
                
                .report-info-card {
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 25px;
                }
                
                .section-card {
                    background: white;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .section-card h5 {
                    margin-bottom: 20px;
                    font-weight: 600;
                    color: #495057;
                }
                
                .fields-container {
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 15px;
                    background: #fafafa;
                }
                
                .field-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    margin: 5px 0;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .field-item:hover {
                    background: #e3f2fd;
                    border-color: #2196f3;
                    transform: translateY(-1px);
                }
                
                .field-item.selected {
                    background: #bbdefb;
                    border-color: #2196f3;
                    font-weight: 500;
                }
                
                .field-item-selected {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    margin: 5px 0;
                    background: #e8f5e8;
                    border: 1px solid #4caf50;
                    border-radius: 4px;
                }
                
                .field-label-editable {
                    background: transparent;
                    border: none;
                    font-weight: 500;
                    color: #2e7d32;
                    cursor: pointer;
                }
                
                .field-label-editable:focus {
                    background: white;
                    border: 1px solid #4caf50;
                    border-radius: 3px;
                    padding: 2px 5px;
                }
                
                .field-category-header {
                    font-weight: 600;
                    color: #666;
                    font-size: 0.9rem;
                    margin: 15px 0 8px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .filter-item, .group-item, .sort-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px;
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    margin-bottom: 10px;
                }
                
                .filter-value-container {
                    position: relative;
                    min-width: 150px;
                }
                
                .filter-value-container .filter-value,
                .filter-value-container .filter-dropdown {
                    width: 100%;
                }
                
                .actions-card {
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    padding: 30px;
                    text-align: center;
                }
                
                .btn-lg {
                    padding: 12px 30px;
                    margin: 0 10px;
                    font-size: 1.1rem;
                }
                
                .badge {
                    font-size: 0.8rem;
                }
                
                .form-group label {
                    font-weight: 500;
                    color: #495057;
                }
            </style>
        `);
    }
    
    initialize_components() {
        this.setup_navigation();
        this.setup_event_handlers();
        this.auto_select_table();
        
        // Load existing report if editing
        if (this.edit_report_id) {
            this.load_existing_report();
        }
    }
    
    auto_select_table() {
        // If we have a preselected table, use it directly
        if (this.preselected_table) {
            this.selected_table = this.preselected_table;
            console.log('Auto-selected table:', this.selected_table);
            this.load_field_options();
        } else {
            // Try to get table from URL or context
            console.warn('No table context provided');
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
        // Add filter/group/sort buttons
        $(document).on('click', '#add-filter', () => this.add_filter());
        $(document).on('click', '#add-group', () => this.add_group());
        $(document).on('click', '#add-sort', () => this.add_sort());
        
        // Preview and save
        $(document).on('click', '#preview-dialog', () => this.show_preview_dialog());
        $(document).on('click', '#save-report', () => this.save_report());
        $(document).on('click', '#delete-report', () => this.delete_report());
        
        // Field label editing
        $(document).on('blur', '.field-label-editable', (e) => this.save_field_label(e));
        $(document).on('keypress', '.field-label-editable', (e) => {
            if (e.which === 13) { // Enter key
                $(e.target).blur();
            }
        });
    }
    
    async load_field_options() {
        try {
            console.log('Loading field options for table:', this.selected_table);
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.get_report_field_options',
                args: { table_name: this.selected_table }
            });
            
            if (response.message && response.message.success) {
                this.available_fields = response.message.fields;
                this.display_available_fields();
            } else {
                console.error('Failed to load field options:', response.message);
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
    }
    
    update_field_display() {
        const container = document.getElementById('selected-fields');
        const countBadge = document.getElementById('field-count');
        
        countBadge.textContent = this.selected_fields.length;
        
        if (this.selected_fields.length === 0) {
            container.innerHTML = '<p class="text-muted">No fields selected. Click on available fields to add them.</p>';
            return;
        }
        
        container.innerHTML = '';
        this.selected_fields.forEach((field) => {
            const item = document.createElement('div');
            item.className = 'field-item-selected';
            item.innerHTML = `
                <span>
                    <i class="fa fa-${this.get_field_icon(field.fieldtype)}"></i>
                    <input type="text" class="field-label-editable" 
                           value="${field.custom_label}" 
                           data-fieldname="${field.fieldname}"
                           title="Click to edit label">
                </span>
                <button class="btn btn-sm btn-outline-danger" onclick="window.flansa_unified_report_builder.remove_field('${field.fieldname}')">
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
    
    save_field_label(event) {
        const input = event.target;
        const fieldname = input.dataset.fieldname;
        const newLabel = input.value.trim();
        
        if (newLabel) {
            const field = this.selected_fields.find(f => f.fieldname === fieldname);
            if (field) {
                field.custom_label = newLabel;
            }
        }
    }
    
    remove_field(fieldname) {
        this.selected_fields = this.selected_fields.filter(f => f.fieldname !== fieldname);
        this.update_field_display();
    }
    
    async get_field_options(field) {
        /**
         * Get dropdown options for Select and Link fields
         */
        try {
            if (field.fieldtype === 'Select' && field.options) {
                // Parse Select field options
                const options = field.options.split('\n').filter(opt => opt.trim()).map(opt => ({
                    value: opt.trim(),
                    label: opt.trim()
                }));
                return options;
            } else if (field.fieldtype === 'Link' && field.options) {
                // Fetch Link field options from the linked DocType
                const response = await frappe.call({
                    method: 'frappe.desk.search.search_link',
                    args: {
                        doctype: field.options,
                        txt: '',
                        page_length: 20
                    }
                });
                
                if (response.message && response.message.length > 0) {
                    return response.message.map(item => ({
                        value: item.value,
                        label: item.label || item.value
                    }));
                }
            }
            return [];
        } catch (error) {
            console.error('Error fetching field options:', error);
            return [];
        }
    }
    
    add_filter(existingFilter = null) {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = document.getElementById('filters-container');
        const filterDiv = document.createElement('div');
        filterDiv.className = 'filter-item';
        filterDiv.innerHTML = `
            <select class="form-control form-control-sm field-select">
                ${this.selected_fields.map(f => `<option value="${f.fieldname}" ${existingFilter && existingFilter.field === f.fieldname ? 'selected' : ''}>${f.custom_label}</option>`).join('')}
            </select>
            <select class="form-control form-control-sm operator-select">
                <option value="=" ${existingFilter && existingFilter.operator === '=' ? 'selected' : ''}>Equals</option>
                <option value="!=" ${existingFilter && existingFilter.operator === '!=' ? 'selected' : ''}>Not Equals</option>
                <option value="like" ${existingFilter && existingFilter.operator === 'like' ? 'selected' : ''}>Contains</option>
                <option value="not like" ${existingFilter && existingFilter.operator === 'not like' ? 'selected' : ''}>Does Not Contain</option>
                <option value=">" ${existingFilter && existingFilter.operator === '>' ? 'selected' : ''}>Greater Than</option>
                <option value="<" ${existingFilter && existingFilter.operator === '<' ? 'selected' : ''}>Less Than</option>
                <option value=">=" ${existingFilter && existingFilter.operator === '>=' ? 'selected' : ''}>Greater or Equal</option>
                <option value="<=" ${existingFilter && existingFilter.operator === '<=' ? 'selected' : ''}>Less or Equal</option>
                <option value="is" ${existingFilter && existingFilter.operator === 'is' ? 'selected' : ''}>Is Empty</option>
                <option value="is not" ${existingFilter && existingFilter.operator === 'is not' ? 'selected' : ''}>Is Not Empty</option>
            </select>
            <div class="filter-value-container">
                <input type="text" class="form-control form-control-sm filter-value" placeholder="Value" value="${existingFilter ? existingFilter.value || '' : ''}">
                <select class="form-control form-control-sm filter-dropdown" style="display: none;"></select>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
                <i class="fa fa-times"></i>
            </button>
        `;
        container.appendChild(filterDiv);
        
        // Get references to elements
        const fieldSelect = filterDiv.querySelector('.field-select');
        const operatorSelect = filterDiv.querySelector('.operator-select');
        const valueInput = filterDiv.querySelector('.filter-value');
        const valueDropdown = filterDiv.querySelector('.filter-dropdown');
        
        // Handle field change to load dropdown options
        const handleFieldChange = async () => {
            const selectedFieldname = fieldSelect.value;
            const selectedField = this.selected_fields.find(f => f.fieldname === selectedFieldname);
            
            if (selectedField && ['Select', 'Link'].includes(selectedField.fieldtype)) {
                try {
                    const options = await this.get_field_options(selectedField);
                    if (options && options.length > 0) {
                        // Build dropdown options with explicit empty value option
                        let dropdownHTML = '<option value="__choose__">Choose...</option>';
                        dropdownHTML += '<option value="" style="font-style: italic; color: #666;">(Empty/Blank)</option>';
                        dropdownHTML += options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
                        
                        valueDropdown.innerHTML = dropdownHTML;
                        valueDropdown.style.display = 'block';
                        valueInput.style.display = 'none';
                        
                        // Set existing value if provided
                        if (existingFilter) {
                            if (existingFilter.value === '') {
                                // Explicitly select the empty option
                                valueDropdown.value = '';
                            } else if (existingFilter.value) {
                                valueDropdown.value = existingFilter.value;
                            } else {
                                valueDropdown.value = '__choose__';
                            }
                        } else {
                            valueDropdown.value = '__choose__';
                        }
                    } else {
                        valueDropdown.style.display = 'none';
                        valueInput.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Error loading field options:', error);
                    valueDropdown.style.display = 'none';
                    valueInput.style.display = 'block';
                }
            } else {
                valueDropdown.style.display = 'none';
                valueInput.style.display = 'block';
            }
        };
        
        // Handle operator change for empty value checks
        const handleOperatorChange = () => {
            const isEmptyCheck = ['is', 'is not'].includes(operatorSelect.value);
            const valueContainer = filterDiv.querySelector('.filter-value-container');
            valueContainer.style.display = isEmptyCheck ? 'none' : 'block';
            if (isEmptyCheck) {
                valueInput.value = '';
                valueDropdown.value = '';
            }
        };
        
        // Add event listeners
        fieldSelect.addEventListener('change', handleFieldChange);
        operatorSelect.addEventListener('change', handleOperatorChange);
        
        // Initial setup
        handleFieldChange();
        handleOperatorChange();
    }
    
    add_group(existingGroup = null) {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = document.getElementById('grouping-container');
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-item';
        
        // Determine which fields can be grouped (usually non-numeric fields are good for grouping)
        const groupableFields = this.selected_fields.filter(f => 
            ['Data', 'Select', 'Link', 'Date', 'Datetime'].includes(f.fieldtype)
        );
        
        if (groupableFields.length === 0) {
            frappe.msgprint('No suitable fields for grouping. Select text, select, link or date fields.');
            return;
        }
        
        groupDiv.innerHTML = `
            <select class="form-control form-control-sm group-field-select">
                ${groupableFields.map(f => `<option value="${f.fieldname}" ${existingGroup && existingGroup.field === f.fieldname ? 'selected' : ''}>${f.custom_label}</option>`).join('')}
            </select>
            <select class="form-control form-control-sm group-period-select" style="display: none;">
                <option value="exact" ${existingGroup && existingGroup.period === 'exact' ? 'selected' : ''}>Exact Value</option>
                <option value="year" ${existingGroup && existingGroup.period === 'year' ? 'selected' : ''}>By Year</option>
                <option value="month" ${existingGroup && existingGroup.period === 'month' ? 'selected' : ''}>By Month</option>
                <option value="week" ${existingGroup && existingGroup.period === 'week' ? 'selected' : ''}>By Week</option>
                <option value="day" ${existingGroup && existingGroup.period === 'day' ? 'selected' : ''}>By Day</option>
                <option value="hour" ${existingGroup && existingGroup.period === 'hour' ? 'selected' : ''}>By Hour</option>
            </select>
            <select class="form-control form-control-sm group-aggregate-select">
                <option value="group" ${existingGroup && existingGroup.aggregate === 'group' ? 'selected' : ''}>Group Only</option>
                <option value="count" ${existingGroup && existingGroup.aggregate === 'count' ? 'selected' : ''}>Count Records</option>
                <option value="sum" ${existingGroup && existingGroup.aggregate === 'sum' ? 'selected' : ''}>Sum Values</option>
                <option value="avg" ${existingGroup && existingGroup.aggregate === 'avg' ? 'selected' : ''}>Average Values</option>
                <option value="min" ${existingGroup && existingGroup.aggregate === 'min' ? 'selected' : ''}>Minimum Value</option>
                <option value="max" ${existingGroup && existingGroup.aggregate === 'max' ? 'selected' : ''}>Maximum Value</option>
            </select>
            <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
                <i class="fa fa-times"></i>
            </button>
        `;
        
        // Add event handler to show/hide time period options
        const fieldSelect = groupDiv.querySelector('.group-field-select');
        const periodSelect = groupDiv.querySelector('.group-period-select');
        
        const updatePeriodVisibility = () => {
            const selectedField = groupableFields.find(f => f.fieldname === fieldSelect.value);
            if (selectedField && ['Date', 'Datetime'].includes(selectedField.fieldtype)) {
                periodSelect.style.display = 'block';
            } else {
                periodSelect.style.display = 'none';
                periodSelect.value = 'exact'; // Reset to default
            }
        };
        
        fieldSelect.addEventListener('change', updatePeriodVisibility);
        updatePeriodVisibility(); // Initialize on creation
        container.appendChild(groupDiv);
    }
    
    add_sort(existingSort = null) {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = document.getElementById('sorting-container');
        const sortDiv = document.createElement('div');
        sortDiv.className = 'sort-item';
        sortDiv.innerHTML = `
            <select class="form-control form-control-sm sort-field-select">
                ${this.selected_fields.map(f => `<option value="${f.fieldname}" ${existingSort && existingSort.field === f.fieldname ? 'selected' : ''}>${f.custom_label}</option>`).join('')}
            </select>
            <select class="form-control form-control-sm sort-direction-select">
                <option value="asc" ${existingSort && existingSort.direction === 'asc' ? 'selected' : ''}>Ascending</option>
                <option value="desc" ${existingSort && existingSort.direction === 'desc' ? 'selected' : ''}>Descending</option>
            </select>
            <button class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
                <i class="fa fa-times"></i>
            </button>
        `;
        container.appendChild(sortDiv);
    }
    
    build_report_config() {
        // Build filters
        const filters = [];
        document.querySelectorAll('.filter-item').forEach(item => {
            const fieldSelect = item.querySelector('.field-select');
            const operatorSelect = item.querySelector('.operator-select');
            const valueInput = item.querySelector('.filter-value');
            const valueDropdown = item.querySelector('.filter-dropdown');
            
            if (fieldSelect && fieldSelect.value) {
                const operator = operatorSelect.value;
                let value = '';
                
                // Get value from dropdown or input
                if (valueDropdown && valueDropdown.style.display !== 'none') {
                    // Check if dropdown is visible and get its value
                    if (valueDropdown.value === '__choose__') {
                        // User hasn't selected anything, skip this filter
                        return;
                    }
                    value = valueDropdown.value || '';  // Allow empty value
                } else if (valueInput && valueInput.style.display !== 'none') {
                    value = valueInput.value || '';  // Allow empty value
                }
                
                // Handle empty value checks
                if (['is', 'is not'].includes(operator)) {
                    value = ''; // Empty value for these operators
                }
                
                // Always add filter if operator is selected (even with empty value for '=' or '!=' operators)
                if (operator) {
                    filters.push({
                        field: fieldSelect.value,
                        operator: operator,
                        value: value
                    });
                }
            }
        });
        
        // Build sorting
        const sort = [];
        document.querySelectorAll('.sort-item').forEach(item => {
            const fieldSelect = item.querySelector('.sort-field-select');
            const directionSelect = item.querySelector('.sort-direction-select');
            if (fieldSelect && fieldSelect.value) {
                sort.push({
                    field: fieldSelect.value,
                    direction: directionSelect.value
                });
            }
        });
        
        // Build grouping
        const grouping = [];
        document.querySelectorAll('.group-item').forEach(item => {
            const fieldSelect = item.querySelector('.group-field-select');
            const aggregateSelect = item.querySelector('.group-aggregate-select');
            const periodSelect = item.querySelector('.group-period-select');
            
            if (fieldSelect && fieldSelect.value) {
                const groupConfig = {
                    field: fieldSelect.value,
                    aggregate: aggregateSelect ? aggregateSelect.value : 'group'
                };
                
                // Include period if it's visible (for Date/Datetime fields)
                if (periodSelect && periodSelect.style.display !== 'none') {
                    groupConfig.period = periodSelect.value;
                }
                
                grouping.push(groupConfig);
            }
        });
        
        return {
            base_table: this.selected_table,
            selected_fields: this.selected_fields,
            filters: filters,
            grouping: grouping,
            sort: sort
        };
    }
    
    async show_preview_dialog() {
        if (!this.selected_table || !this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        try {
            const config = this.build_report_config();
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                args: {
                    report_config: config,
                    view_options: { page_size: 100 }
                }
            });
            
            if (response.message && response.message.success) {
                this.display_full_preview_dialog(response.message);
            } else {
                throw new Error(response.message?.error || 'Failed to execute report');
            }
        } catch (error) {
            console.error('Error loading preview:', error);
            frappe.msgprint('Error loading preview: ' + error.message);
        }
    }
    
    display_full_preview_dialog(data) {
        const title = document.getElementById('report-title').value || 'Report Preview';
        
        let contentHtml;
        
        // Use shared renderer for consistency if available
        if (window.FlansaReportRenderer && typeof window.FlansaReportRenderer.render === 'function') {
            contentHtml = window.FlansaReportRenderer.render(data, {
                showActions: false,
                fields: this.selected_fields,
                tableClass: 'table table-striped table-hover'
            });
        } else {
            // Fallback to legacy display methods
            console.warn('FlansaReportRenderer not available, using fallback display');
            
            if (data.is_grouped && data.groups) {
                contentHtml = this.build_grouped_view(data);
            } else {
                contentHtml = this.build_table_view(data);
            }
        }
        
        const dialog = new frappe.ui.Dialog({
            title: title,
            size: 'extra-large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview_content',
                    options: contentHtml
                }
            ]
        });
        
        dialog.show();
    }
    
    /**
     * Fallback method for grouped view when shared renderer not available
     */
    build_grouped_view(data) {
        if (!data.groups || !Array.isArray(data.groups)) {
            return '<p>No grouped data available</p>';
        }
        
        let html = '<div class="grouped-report-fallback">';
        
        data.groups.forEach((group) => {
            const groupLabel = group.group_label || '(Empty)';
            const count = group.count || 0;
            const aggregate = group.aggregate ? ` • ${group.aggregate_type}: ${parseFloat(group.aggregate).toFixed(2)}` : '';
            
            html += `
                <div class="group-section" style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <div class="group-header" style="background: #f8f9fa; padding: 15px; border-radius: 8px 8px 0 0;">
                        <strong>${groupLabel}</strong> 
                        <span style="color: #666;">(${count} records${aggregate})</span>
                    </div>
                    <div class="group-content" style="padding: 10px;">
                        ${this.build_table_view({ data: group.records || [], fields: this.selected_fields })}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    /**
     * Fallback method for table view when shared renderer not available
     */
    build_table_view(data) {
        if (!data.data || !Array.isArray(data.data)) {
            return '<p>No data available</p>';
        }
        
        const fields = data.fields || this.selected_fields || [];
        
        if (fields.length === 0) {
            return '<p>No fields configured</p>';
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="thead-light">
                        <tr>
                            ${fields.map(field => {
                                const label = field.custom_label || field.field_label || field.label || field.fieldname;
                                return `<th>${label}</th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.data.forEach(record => {
            html += '<tr>';
            fields.forEach(field => {
                const value = record[field.fieldname] || '';
                const formattedValue = this.format_fallback_value(value, field.fieldtype);
                html += `<td>${formattedValue}</td>`;
            });
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }
    
    /**
     * Simple value formatting for fallback display
     */
    format_fallback_value(value, fieldtype) {
        if (!value && value !== 0) return '';
        
        switch (fieldtype) {
            case 'Currency':
                return parseFloat(value).toFixed(2);
            case 'Date':
                return new Date(value).toLocaleDateString();
            case 'Datetime':
                return new Date(value).toLocaleString();
            case 'Check':
                return value ? '✓' : '✗';
            default:
                return String(value).length > 50 ? String(value).substring(0, 47) + '...' : String(value);
        }
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
            frappe.msgprint('Please select fields');
            return;
        }
        
        try {
            const config = this.build_report_config();
            const method = this.edit_report_id ? 
                'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.update_report' :
                'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.save_report';
            
            const args = {
                report_title: title,
                description: description,
                base_table: this.selected_table,
                report_type: 'Table',
                report_config: config,
                is_public: isPublic ? 1 : 0
            };
            
            if (this.edit_report_id) {
                args.report_id = this.edit_report_id;
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
                
                // Restore filters if they exist
                if (report.config && report.config.filters) {
                    report.config.filters.forEach(filter => {
                        this.add_filter(filter);
                    });
                }
                
                // Restore grouping if it exists
                if (report.config && report.config.grouping) {
                    report.config.grouping.forEach(group => {
                        this.add_group(group);
                    });
                }
                
                // Restore sorting if it exists
                if (report.config && report.config.sort) {
                    report.config.sort.forEach(sort => {
                        this.add_sort(sort);
                    });
                }
                
                // Show delete button
                document.getElementById('delete-report').style.display = 'inline-block';
            }
        } catch (error) {
            console.error('Error loading existing report:', error);
        }
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