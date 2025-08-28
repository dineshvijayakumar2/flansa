class UnifiedReportBuilder {
    constructor(page = null) {
        this.page = page;
        this.current_table = null;
        this.available_fields = {};
        this.selected_fields = [];
        this.filters = [];
        this.sort_config = [];
        this.grouping_config = [];
        this.current_report_data = null;
        this.current_page = 1;
        this.page_size = 20;
        this.current_view = 'table';
        this.preselected_table = null;
        this.current_report_id = null;
        this.current_report_title = null;
        this.modal_dialog = null;
        this.filter_table = null;
        
        this.extract_url_parameters();
        this.init();
    }

    extract_url_parameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.filter_table = urlParams.get('table');
        this.filter_app = urlParams.get('app');
        
        // Check for edit mode
        const editParam = urlParams.get('edit');
        if (editParam) {
            this.current_report_id = editParam;
        }
        
        console.log('Unified Report Builder: URL parameters:', {
            filter_table: this.filter_table,
            filter_app: this.filter_app,
            edit_report_id: this.current_report_id
        });
    }

    init() {
        console.log('Unified Report Builder: Initializing...');
        this.setup_improved_layout();
        this.auto_select_table();
        this.bind_events();
        this.apply_theme();
        
        if (this.current_report_id) {
            this.load_existing_report();
        }
    }

    setup_improved_layout() {
        console.log('Setting up improved single-step layout...');
        
        // Modern single-page UI setup
        const content = $(`
            <div class="flansa-unified-report-builder">
                <!-- Ultra-modern sleek header -->
                <div class="sleek-header">
                    <div class="header-backdrop"></div>
                    <div class="header-content">
                        <!-- Breadcrumb Trail -->
                        <nav class="breadcrumb-trail">
                            <a href="/app/flansa-workspace" class="breadcrumb-link">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 10h-1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-6H1a1 1 0 01-.707-1.707l7-7z" clip-rule="evenodd" />
                                </svg>
                                Workspace
                            </a>
                            <svg width="8" height="8" viewBox="0 0 20 20" fill="currentColor" class="breadcrumb-separator">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                            </svg>
                            <a href="/app/flansa-unified-report-builder" class="breadcrumb-link current">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                </svg>
                                Report Builder
                            </a>
                        </nav>
                        
                        <!-- Header Main Section -->
                        <div class="header-main">
                            <div class="header-left">
                                <div class="header-title-inline">
                                    <h1 class="header-title">
                                        <span class="title-text" id="app-name-display">Unified Report Builder</span>
                                    </h1>
                                    <span class="header-separator">•</span>
                                    <p class="header-subtitle-inline">Building custom reports for your data</p>
                                </div>
                            </div>
                            
                            <!-- Action Buttons -->
                            <div class="header-actions">
                                <button class="sleek-btn" id="preview-report-btn" style="display: none;">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                                    </svg>
                                    Preview
                                </button>
                                <button class="sleek-btn primary" id="save-report-btn" style="display: none;">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586l-1.293-1.293z"/>
                                        <path d="M5 3a2 2 0 00-2 2v1a1 1 0 002 0V5a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 102 0V5a2 2 0 00-2-2H5zM5 15a2 2 0 01-2-2v-1a1 1 0 012 0v1a1 1 0 001 1h8a1 1 0 001-1v-1a1 1 0 112 0v1a2 2 0 01-2 2H5z"/>
                                    </svg>
                                    Save Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Content Area with Single-Page Layout -->
                <div class="container main-content">
                    <!-- Report Configuration Section -->
                    <div class="section-card" id="report-config-section">
                        <div class="section-header">
                            <h4><i class="fa fa-cog"></i> Report Configuration</h4>
                            <small>Configure your report in one place</small>
                        </div>
                        <div class="section-body">
                            <div class="row">
                                <!-- Left Column: Table & Fields -->
                                <div class="col-md-6">
                                    <!-- Table Selection -->
                                    <div class="config-group">
                                        <label class="config-label">Select Table</label>
                                        <select class="form-control" id="table-selector">
                                            <option value="">Choose table...</option>
                                        </select>
                                    </div>
                                    
                                    <!-- Field Selection -->
                                    <div class="config-group" id="fields-config" style="display: none;">
                                        <label class="config-label">Report Fields</label>
                                        <div class="fields-container">
                                            <div class="field-categories">
                                                <!-- Fields will be populated here -->
                                                <div id="available-fields-list"></div>
                                            </div>
                                            <div class="selected-fields-container">
                                                <h6>Selected Fields:</h6>
                                                <div id="selected-fields-list"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Right Column: Filters & Sort -->
                                <div class="col-md-6">
                                    <!-- Report Details -->
                                    <div class="config-group" id="report-details" style="display: none;">
                                        <label class="config-label">Report Title</label>
                                        <input type="text" class="form-control" id="report-title-input" placeholder="Enter report title...">
                                    </div>
                                    
                                    <!-- Filters -->
                                    <div class="config-group" id="filters-config" style="display: none;">
                                        <label class="config-label">Filters</label>
                                        <button class="btn btn-sm btn-outline-primary" id="add-filter-btn">
                                            <i class="fa fa-plus"></i> Add Filter
                                        </button>
                                        <div id="filters-container"></div>
                                    </div>
                                    
                                    <!-- Sort Configuration -->
                                    <div class="config-group" id="sort-config" style="display: none;">
                                        <label class="config-label">Sort Order</label>
                                        <button class="btn btn-sm btn-outline-primary" id="add-sort-btn">
                                            <i class="fa fa-plus"></i> Add Sort
                                        </button>
                                        <div id="sort-container"></div>
                                    </div>
                                    
                                    <!-- Grouping Configuration -->
                                    <div class="config-group" id="grouping-config" style="display: none;">
                                        <label class="config-label">Grouping</label>
                                        <button class="btn btn-sm btn-outline-primary" id="add-grouping-btn">
                                            <i class="fa fa-plus"></i> Add Grouping
                                        </button>
                                        <div id="grouping-container"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Report Preview Section -->
                    <div class="section-card" id="report-preview-section" style="display: none;">
                        <div class="section-header">
                            <h4><i class="fa fa-eye"></i> Report Preview</h4>
                            <div class="view-controls">
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline-secondary view-mode-btn active" data-view="table">
                                        <i class="fa fa-table"></i> Table
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary view-mode-btn" data-view="gallery">
                                        <i class="fa fa-th"></i> Gallery
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="section-body">
                            <div id="report-preview-container"></div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        if (this.page) {
            this.page.main.html(content);
        } else {
            $('body').html(content);
        }
        
        // Add improved styles
        this.add_unified_styles();
        
        console.log('✅ Improved layout setup complete');
    }

    auto_select_table() {
        console.log('Auto-selecting table based on context...');
        
        // Context-driven table selection
        if (this.filter_table) {
            console.log(`Auto-selecting table: ${this.filter_table}`);
            setTimeout(() => {
                $('#table-selector').val(this.filter_table).trigger('change');
            }, 500);
        }
    }

    save_field_label() {
        // Inline label editing functionality
        console.log('Implementing inline field label editing...');
        
        $(document).on('dblclick', '.field-label', function() {
            const $label = $(this);
            const currentText = $label.text();
            const $input = $(`<input type="text" class="form-control form-control-sm" value="${currentText}">`);
            
            $label.replaceWith($input);
            $input.focus().select();
            
            $input.on('blur keypress', function(e) {
                if (e.type === 'blur' || e.which === 13) {
                    const newText = $input.val() || currentText;
                    const $newLabel = $(`<span class="field-label">${newText}</span>`);
                    $input.replaceWith($newLabel);
                    
                    // Update the field configuration
                    const fieldname = $newLabel.closest('.selected-field-item').data('fieldname');
                    const field = window.report_builder.selected_fields.find(f => f.fieldname === fieldname);
                    if (field) {
                        field.custom_label = newText;
                    }
                }
            });
        });
    }

    build_report_config() {
        // Enhanced configuration builder
        const config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields.map(field => ({
                ...field,
                custom_label: field.custom_label || field.field_label
            })),
            filters: this.filters,
            sort: this.sort_config,
            grouping: this.grouping_config
        };
        
        console.log('Built enhanced report config:', config);
        return config;
    }

    show_preview_dialog() {
        // Full preview in dialog
        const dialog = new frappe.ui.Dialog({
            title: 'Report Preview',
            size: 'extra-large',
            fields: [{
                fieldtype: 'HTML',
                options: '<div id="preview-dialog-content">Loading preview...</div>'
            }],
            primary_action_label: 'Save Report',
            primary_action: () => {
                this.save_report_from_dialog();
            }
        });
        
        dialog.show();
        
        // Generate preview
        const config = this.build_report_config();
        this.execute_report_preview(config, '#preview-dialog-content');
    }

    bind_events() {
        console.log('Binding events for unified interface...');
        
        // Table selection
        $('#table-selector').on('change', (e) => {
            const table_name = e.target.value;
            if (table_name) {
                this.select_table(table_name);
            }
        });

        // Field selection events with improved UX
        $(document).on('click', '.field-item', (e) => {
            const $item = $(e.currentTarget);
            const fieldname = $item.data('fieldname');
            
            if ($item.hasClass('selected')) {
                this.remove_field(fieldname);
                $item.removeClass('selected');
            } else {
                this.add_field($item.data());
                $item.addClass('selected');
            }
            
            this.update_preview();
        });

        // Preview button
        $('#preview-report-btn').on('click', () => {
            this.show_preview_dialog();
        });

        // Save button
        $('#save-report-btn').on('click', () => {
            this.save_report();
        });

        // Filter and sort buttons
        $('#add-filter-btn').on('click', () => this.add_filter());
        $('#add-sort-btn').on('click', () => this.add_sort());
        $('#add-grouping-btn').on('click', () => this.add_grouping());

        // View mode toggle
        $('.view-mode-btn').on('click', (e) => {
            const view = $(e.currentTarget).data('view');
            this.switch_view_mode(view);
        });

        // Inline label editing
        this.save_field_label();
    }

    load_tables() {
        console.log('Loading available tables...');
        
        frappe.call({
            method: 'flansa.flansa_core.api.table_api.get_tables',
            callback: (r) => {
                if (r.message && r.message.success) {
                    const tables = r.message.tables;
                    const selector = $('#table-selector');
                    selector.empty().append('<option value="">Choose table...</option>');
                    
                    tables.forEach(table => {
                        selector.append(`<option value="${table.name}">${table.table_label}</option>`);
                    });
                    
                    // Auto-select if there's a filter
                    if (this.filter_table) {
                        selector.val(this.filter_table);
                        this.select_table(this.filter_table);
                    }
                } else {
                    frappe.msgprint('Failed to load tables');
                }
            }
        });
    }

    select_table(table_name) {
        console.log(`Selecting table: ${table_name}`);
        this.current_table = table_name;
        
        // Show configuration sections
        $('#fields-config, #report-details, #filters-config, #sort-config, #grouping-config').show();
        
        // Load fields for this table
        this.load_table_fields(table_name);
    }

    load_table_fields(table_name) {
        frappe.call({
            method: 'flansa.flansa_core.api.report_builder_api.get_report_field_options',
            args: { table_name: table_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.available_fields = r.message.fields;
                    this.render_available_fields();
                } else {
                    frappe.msgprint('Failed to load table fields');
                }
            }
        });
    }

    render_available_fields() {
        const container = $('#available-fields-list');
        container.empty();
        
        ['current', 'system', 'related'].forEach(category => {
            const fields = this.available_fields[category] || [];
            if (fields.length === 0) return;
            
            const categoryHtml = `
                <div class="field-category">
                    <h6>${category.charAt(0).toUpperCase() + category.slice(1)} Fields (${fields.length})</h6>
                    <div class="field-list">
                        ${fields.map(field => `
                            <div class="field-item" data-fieldname="${field.fieldname}" data-fieldtype="${field.fieldtype}" data-field-label="${field.field_label}" data-category="${field.category}">
                                <span class="field-name">${field.field_label}</span>
                                <span class="field-type-badge">${field.fieldtype}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            container.append(categoryHtml);
        });
    }

    add_field(field_data) {
        // Check if field already selected
        if (this.selected_fields.find(f => f.fieldname === field_data.fieldname)) {
            return;
        }
        
        this.selected_fields.push(field_data);
        this.render_selected_fields();
        this.show_action_buttons();
    }

    remove_field(fieldname) {
        this.selected_fields = this.selected_fields.filter(f => f.fieldname !== fieldname);
        this.render_selected_fields();
        
        if (this.selected_fields.length === 0) {
            this.hide_action_buttons();
        }
    }

    render_selected_fields() {
        const container = $('#selected-fields-list');
        container.empty();
        
        this.selected_fields.forEach(field => {
            const fieldHtml = `
                <div class="selected-field-item" data-fieldname="${field.fieldname}">
                    <span class="field-label">${field.custom_label || field.field_label}</span>
                    <button class="btn btn-sm btn-link remove-field-btn" data-fieldname="${field.fieldname}">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            `;
            container.append(fieldHtml);
        });
        
        // Bind remove events
        $('.remove-field-btn').on('click', (e) => {
            const fieldname = $(e.currentTarget).data('fieldname');
            this.remove_field(fieldname);
            $(`.field-item[data-fieldname="${fieldname}"]`).removeClass('selected');
        });
    }

    show_action_buttons() {
        $('#preview-report-btn, #save-report-btn').show();
    }

    hide_action_buttons() {
        $('#preview-report-btn, #save-report-btn').hide();
    }

    update_preview() {
        if (this.selected_fields.length > 0) {
            // Show preview section
            $('#report-preview-section').show();
            this.execute_report_preview(this.build_report_config(), '#report-preview-container');
        } else {
            $('#report-preview-section').hide();
        }
    }

    execute_report_preview(config, container) {
        $(container).html('<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading preview...</div>');
        
        frappe.call({
            method: 'flansa.flansa_core.api.report_builder_api.execute_report',
            args: {
                report_config: JSON.stringify(config),
                view_options: JSON.stringify({ page_size: 10 })
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_report_data(r.message, container);
                } else {
                    $(container).html('<div class="alert alert-danger">Failed to load preview</div>');
                }
            }
        });
    }

    render_report_data(report_data, container) {
        if (this.current_view === 'table') {
            this.render_table_view(report_data, container);
        } else {
            this.render_gallery_view(report_data, container);
        }
    }

    render_table_view(report_data, container) {
        const data = report_data.data || [];
        if (data.length === 0) {
            $(container).html('<div class="alert alert-info">No data found</div>');
            return;
        }
        
        const headers = this.selected_fields.map(field => field.custom_label || field.field_label);
        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-bordered table-hover">
                    <thead class="table-light">
                        <tr>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 10).map(row => `
                            <tr>
                                ${this.selected_fields.map(field => `
                                    <td>${row[field.fieldname] || ''}</td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="text-muted">Showing first 10 rows of ${report_data.total} total records</div>
        `;
        
        $(container).html(tableHtml);
    }

    switch_view_mode(view) {
        this.current_view = view;
        $('.view-mode-btn').removeClass('active');
        $(`.view-mode-btn[data-view="${view}"]`).addClass('active');
        
        // Re-render current preview
        if (this.current_report_data) {
            this.render_report_data(this.current_report_data, '#report-preview-container');
        }
    }

    add_unified_styles() {
        const style = `
            <style>
                .flansa-unified-report-builder {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .sleek-header {
                    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }
                
                .header-content {
                    padding: 1rem 2rem;
                }
                
                .breadcrumb-trail {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .breadcrumb-link {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    color: rgba(0, 0, 0, 0.6);
                    text-decoration: none;
                    font-size: 0.875rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                
                .breadcrumb-link:hover {
                    background: rgba(0, 0, 0, 0.04);
                    color: rgba(0, 0, 0, 0.8);
                    text-decoration: none;
                }
                
                .header-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .header-title-inline {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .header-title {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                }
                
                .title-text {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                .header-separator {
                    color: rgba(0, 0, 0, 0.3);
                }
                
                .header-subtitle-inline {
                    color: #6b7280;
                    font-size: 0.875rem;
                    margin: 0;
                }
                
                .sleek-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.8);
                    color: rgba(0, 0, 0, 0.8);
                    font-size: 0.875rem;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                
                .sleek-btn:hover {
                    background: rgba(255, 255, 255, 0.95);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                
                .sleek-btn.primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-color: rgba(102, 126, 234, 0.3);
                }
                
                .main-content {
                    padding: 2rem;
                }
                
                .section-card {
                    background: white;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    border: 1px solid rgba(0, 0, 0, 0.06);
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .section-body {
                    padding: 1.5rem;
                }
                
                .config-group {
                    margin-bottom: 1.5rem;
                }
                
                .config-label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    color: #374151;
                }
                
                .fields-container {
                    display: flex;
                    gap: 1rem;
                    max-height: 300px;
                }
                
                .field-categories {
                    flex: 1;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow-y: auto;
                }
                
                .field-category {
                    border-bottom: 1px solid #e9ecef;
                }
                
                .field-category h6 {
                    background: #f8f9fa;
                    padding: 0.75rem;
                    margin: 0;
                    font-weight: 600;
                }
                
                .field-list {
                    padding: 0.5rem 0;
                }
                
                .field-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0.75rem;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .field-item:hover {
                    background: #f8f9fa;
                }
                
                .field-item.selected {
                    background: #e3f2fd;
                    color: #1976d2;
                }
                
                .field-type-badge {
                    font-size: 0.75rem;
                    padding: 2px 6px;
                    background: #e9ecef;
                    border-radius: 4px;
                    color: #6c757d;
                }
                
                .selected-fields-container {
                    flex: 1;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 1rem;
                    background: #f8f9fa;
                    overflow-y: auto;
                }
                
                .selected-field-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0.75rem;
                    background: white;
                    border-radius: 6px;
                    margin-bottom: 0.5rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                
                .field-label {
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                
                .field-label:hover {
                    background: #f0f0f0;
                }
                
                .view-controls {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .view-mode-btn.active {
                    background: #007bff;
                    color: white;
                    border-color: #007bff;
                }
            </style>
        `;
        
        $('head').append(style);
    }

    apply_theme() {
        console.log('Applying modern theme...');
        // Theme application logic here
    }

    load_existing_report() {
        if (!this.current_report_id) return;
        
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Flansa Saved Report',
                name: this.current_report_id
            },
            callback: (r) => {
                if (r.message) {
                    const report = r.message;
                    this.current_report_title = report.report_title;
                    
                    // Load the report configuration
                    if (report.report_config) {
                        const config = JSON.parse(report.report_config);
                        this.load_report_from_config(config);
                    }
                }
            }
        });
    }

    load_report_from_config(config) {
        // Load table
        if (config.base_table) {
            $('#table-selector').val(config.base_table);
            this.select_table(config.base_table);
        }
        
        // Load selected fields
        if (config.selected_fields) {
            setTimeout(() => {
                this.selected_fields = config.selected_fields;
                this.render_selected_fields();
                this.show_action_buttons();
            }, 1000);
        }
        
        // Load filters, sort, and grouping
        this.filters = config.filters || [];
        this.sort_config = config.sort || [];
        this.grouping_config = config.grouping || [];
        
        // Update title
        if (this.current_report_title) {
            $('#report-title-input').val(this.current_report_title);
        }
    }

    save_report() {
        const title = $('#report-title-input').val();
        if (!title) {
            frappe.msgprint('Please enter a report title');
            return;
        }
        
        const config = this.build_report_config();
        
        const report_data = {
            doctype: 'Flansa Saved Report',
            report_title: title,
            base_table: this.current_table,
            report_config: JSON.stringify(config),
            report_type: 'Table'
        };
        
        if (this.current_report_id) {
            report_data.name = this.current_report_id;
        }
        
        frappe.call({
            method: 'frappe.client.save',
            args: {
                doc: report_data
            },
            callback: (r) => {
                if (r.message) {
                    frappe.msgprint('Report saved successfully');
                    this.current_report_id = r.message.name;
                } else {
                    frappe.msgprint('Failed to save report');
                }
            }
        });
    }

    add_filter() {
        // Filter addition logic
        console.log('Adding filter...');
    }

    add_sort() {
        // Sort addition logic
        console.log('Adding sort...');
    }

    add_grouping() {
        // Grouping addition logic
        console.log('Adding grouping...');
    }
}

// Initialize the Unified Report Builder when page loads
frappe.pages['flansa-unified-report-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Unified Report Builder',
        single_column: true
    });
    
    // Initialize the unified report builder
    window.report_builder = new UnifiedReportBuilder(page);
    
    // Load tables after initialization
    setTimeout(() => {
        window.report_builder.load_tables();
    }, 500);
};

frappe.pages['flansa-unified-report-builder'].on_page_show = function(wrapper) {
    console.log('Unified Report Builder page shown');
    
    if (window.report_builder) {
        // Handle URL parameters on page show
        const urlParams = new URLSearchParams(window.location.search);
        const edit_report_id = urlParams.get('edit');
        
        if (edit_report_id && edit_report_id !== window.report_builder.current_report_id) {
            window.report_builder.current_report_id = edit_report_id;
            window.report_builder.load_existing_report();
        }
    }
};