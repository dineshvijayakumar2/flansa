class UnifiedReportBuilder {
    constructor(page = null) {
        this.page = page;
        
        // Hide the default page header to keep only our sleek banner
        if (page && page.wrapper) {
            $(page.wrapper).find('.page-head').hide();
        }
        
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
        this.tabulator = null; // Modern data table instance
        this.table_lookup = {}; // For table ID to label resolution
        
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
        this.setup_context_aware_breadcrumbs();
        this.auto_select_table();
        this.bind_events();
        this.apply_theme();
        this.inject_workspace_logo_styles();
        this.load_workspace_logo();
        
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
                        <nav class="breadcrumb-trail" id="dynamic-breadcrumbs">
                            <!-- Breadcrumbs will be populated dynamically based on context -->
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
                                    <h1 class="app-name">Report Builder</h1>
                                    <div class="app-type">
                                        <div class="counter-pill">
                                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                            </svg>
                                            <span class="counter-text">Report Builder</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Action Buttons -->
                        <div class="banner-right">
                            <div class="action-dropdown">
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

    setup_context_aware_breadcrumbs() {
        console.log('Setting up context-aware breadcrumbs...');
        
        const breadcrumbContainer = document.getElementById('dynamic-breadcrumbs');
        if (!breadcrumbContainer) return;

        // Build breadcrumb path based on context
        let breadcrumbHTML = '';
        
        // Always start with workspace
        breadcrumbHTML += `
            <a href="/app/flansa-workspace" class="breadcrumb-link">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Workspace</span>
            </a>
        `;

        // Add divider
        const divider = `
            <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
        `;

        // Build context-aware saved reports link
        const savedReportsURL = this.build_saved_reports_url();
        
        breadcrumbHTML += divider;
        breadcrumbHTML += `
            <a href="${savedReportsURL}" class="breadcrumb-link">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                </svg>
                <span>Saved Reports</span>
            </a>
        `;

        // Add current page
        breadcrumbHTML += divider;
        breadcrumbHTML += `
            <span class="breadcrumb-current">📊 Report Builder</span>
        `;

        breadcrumbContainer.innerHTML = breadcrumbHTML;
        console.log('✅ Context-aware breadcrumbs setup complete');
    }

    build_saved_reports_url() {
        // Build URL with preserved context parameters
        const params = new URLSearchParams();
        
        // Preserve table context
        if (this.filter_table) {
            params.append('table', this.filter_table);
        }
        
        // Preserve app context  
        if (this.filter_app) {
            params.append('app', this.filter_app);
        }
        
        // Add source context to indicate where user came from
        params.append('source', 'report-builder');
        
        const baseURL = '/app/flansa-saved-reports';
        const paramString = params.toString();
        
        return paramString ? `${baseURL}?${paramString}` : baseURL;
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
        // Build filters from UI
        const filters = [];
        $('.filter-item').each(function() {
            const fieldSelect = $(this).find('.field-select');
            const operatorSelect = $(this).find('.operator-select');
            const valueInput = $(this).find('.filter-value');
            const valueDropdown = $(this).find('.filter-dropdown');
            
            if (fieldSelect.val()) {
                const operator = operatorSelect.val();
                let value = '';
                
                // Get value from dropdown or input
                if (valueDropdown.is(':visible')) {
                    if (valueDropdown.val() === '__choose__') {
                        return; // Skip if not selected
                    }
                    value = valueDropdown.val() || '';
                } else if (valueInput.is(':visible')) {
                    value = valueInput.val() || '';
                }
                
                // Handle empty value checks
                if (['is', 'is not'].includes(operator)) {
                    value = 'null';
                }
                
                filters.push({
                    field: fieldSelect.val(),
                    operator: operator,
                    value: value
                });
            }
        });
        
        // Build sorting from UI  
        const sort = [];
        $('.sort-item').each(function() {
            const fieldSelect = $(this).find('.sort-field-select');
            const directionSelect = $(this).find('.sort-direction-select');
            
            if (fieldSelect.val()) {
                sort.push({
                    field: fieldSelect.val(),
                    direction: directionSelect.val()
                });
            }
        });
        
        // Build grouping from UI
        const grouping = [];
        $('.group-item').each(function() {
            const fieldSelect = $(this).find('.group-field-select');
            const periodSelect = $(this).find('.group-period-select');
            const aggregateSelect = $(this).find('.group-aggregate-select');
            
            if (fieldSelect.val()) {
                const group = {
                    field: fieldSelect.val(),
                    aggregate: aggregateSelect.val()
                };
                
                // Add period if visible (for date fields)
                if (periodSelect.is(':visible')) {
                    group.period = periodSelect.val();
                }
                
                grouping.push(group);
            }
        });
        
        // Enhanced configuration builder
        const config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields.map(field => ({
                ...field,
                custom_label: field.custom_label || field.field_label
            })),
            filters: filters,
            sort: sort,
            grouping: grouping
        };
        
        console.log('Built enhanced report config:', config);
        return config;
    }

    async show_preview_dialog() {
        const title = $('#report-title-input').val() || 'Report Preview';
        
        try {
            // Execute the report to get data
            const config = this.build_report_config();
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                args: {
                    report_config: JSON.stringify(config),
                    view_options: JSON.stringify({ page_size: 100 })
                }
            });
            
            if (response.message && response.message.success) {
                this.display_full_preview_dialog(response.message, title);
            } else {
                throw new Error(response.message?.error || 'Failed to execute report');
            }
        } catch (error) {
            console.error('Error loading preview:', error);
            frappe.msgprint('Error loading preview: ' + error.message);
        }
    }
    
    display_full_preview_dialog(data, title) {
        console.log('🔍 FULL PREVIEW DATA:', data);
        console.log('🔍 IS_GROUPED:', data.is_grouped);
        console.log('🔍 HAS_GROUPS:', !!data.groups);
        console.log('🔍 GROUPS_COUNT:', data.groups ? data.groups.length : 0);
        
        let contentHtml;
        
        // Use shared renderer for consistency if available
        if (window.FlansaReportRenderer && typeof window.FlansaReportRenderer.render === 'function') {
            console.log('🔍 USING SHARED RENDERER IN DIALOG');
            try {
                contentHtml = window.FlansaReportRenderer.render(data, {
                    showActions: false,
                    fields: this.selected_fields,
                    tableClass: 'table table-striped table-hover'
                });
            } catch (error) {
                console.warn('FlansaReportRenderer failed in dialog:', error);
                contentHtml = this.build_fallback_preview(data);
            }
        } else {
            console.warn('FlansaReportRenderer not available, using fallback display');
            contentHtml = this.build_fallback_preview(data);
        }
        
        const dialog = new frappe.ui.Dialog({
            title: title,
            size: 'extra-large',
            fields: [{
                fieldtype: 'HTML',
                fieldname: 'preview_content',
                options: contentHtml
            }],
            primary_action_label: 'Save Report',
            primary_action: () => {
                this.save_report_with_context_navigation();
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    build_fallback_preview(data) {
        if (data.is_grouped && data.groups) {
            return this.build_grouped_fallback_view(data);
        } else {
            return this.build_simple_fallback_view(data);
        }
    }
    
    build_grouped_fallback_view(data) {
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
                        ${this.build_simple_fallback_view({ data: group.records || [], fields: this.selected_fields })}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    build_simple_fallback_view(data) {
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
                // Reconstruct field object with correct property names
                const fieldData = {
                    fieldname: $item.data('fieldname'),
                    fieldtype: $item.data('fieldtype'), 
                    field_label: $item.data('fieldLabel'), // jQuery converts kebab-case to camelCase
                    category: $item.data('category')
                };
                this.add_field(fieldData);
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

        // View mode toggle removed - handled in preview dialog

        // Inline label editing
        this.save_field_label();
        this.load_modern_ui_assets();
    }

    load_tables() {
        console.log('Loading available tables...', { filter_app: this.filter_app });
        
        const args = {};
        if (this.filter_app) {
            args.app_name = this.filter_app;
        }
        
        frappe.call({
            method: 'flansa.flansa_core.api.table_api.get_tables',
            args: args,
            callback: (r) => {
                if (r.message && r.message.success) {
                    const tables = r.message.tables;
                    const selector = $('#table-selector');
                    selector.empty().append('<option value="">Choose table...</option>');
                    
                    tables.forEach(table => {
                        selector.append(`<option value="${table.value}">${table.label}</option>`);
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
        // Preview removed - use the Preview button dialog instead
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
                    this.current_report_data = r.message; // Store for view switching
                    this.render_report_data(r.message, container);
                } else {
                    $(container).html('<div class="alert alert-danger">Failed to load preview</div>');
                }
            }
        });
    }

    render_report_data(report_data, container) {
        console.log('🔍 RENDERING REPORT DATA:', report_data);
        console.log('🔍 IS_GROUPED:', report_data.is_grouped);
        console.log('🔍 HAS_GROUPS:', !!report_data.groups);
        
        // Use shared FlansaReportRenderer for consistency if available
        if (window.FlansaReportRenderer && typeof window.FlansaReportRenderer.render === 'function') {
            console.log('🔍 USING FLANSA REPORT RENDERER');
            try {
                const renderedHtml = window.FlansaReportRenderer.render(report_data, {
                    showActions: false,
                    fields: this.selected_fields,
                    tableClass: 'table table-striped table-hover',
                    view_mode: this.current_view
                });
                $(container).html(renderedHtml);
                return;
            } catch (error) {
                console.warn('FlansaReportRenderer failed:', error);
                // Fall back to local rendering
            }
        }
        
        // Fallback to local rendering methods
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
        
        // Create modern preview container with Shadcn styling
        const previewHtml = `
            <div class="report-preview-container">
                <div class="preview-header">
                    <h3 class="preview-title">Report Preview</h3>
                    <div class="preview-stats">
                        <span><strong>${data.length}</strong> rows displayed</span>
                        <span><strong>${report_data.total || data.length}</strong> total records</span>
                        <span><strong>${this.selected_fields.length}</strong> columns</span>
                    </div>
                </div>
                <div id="modern-report-table" class="report-builder-tabulator"></div>
            </div>
        `;
        
        $(container).html(previewHtml);
        
        // Initialize modern Tabulator table
        this.init_modern_report_table(data, '#modern-report-table');
    }

    async init_modern_report_table(data, containerId) {
        try {
            // Ensure modern UI assets are loaded
            await this.load_modern_ui_assets();
            
            // Prepare column definitions from selected fields
            const columns = this.selected_fields.map(field => ({
                title: field.custom_label || field.field_label || field.label || field.fieldname,
                field: field.fieldname,
                headerTooltip: field.field_label || field.fieldname,
                formatter: (cell) => {
                    const value = cell.getValue();
                    return this.format_cell_value(value, field.fieldtype);
                }
            }));

            // Initialize Tabulator with modern configuration
            this.tabulator = new Tabulator(containerId, {
                data: data,
                columns: columns,
                layout: "fitDataStretch",
                responsiveLayout: "collapse",
                responsiveLayoutCollapseStartOpen: false,
                pagination: true,
                paginationSize: 25,
                paginationMode: "local",
                movableColumns: true,
                resizableRows: false,
                selectable: false,
                tooltips: true,
                height: "400px",
                // Modern Shadcn-inspired styling
                columnDefaults: {
                    headerSort: true,
                    headerTooltip: true
                }
            });

        } catch (error) {
            console.error('Error initializing modern report table:', error);
            // Fallback to basic HTML table
            this.render_fallback_table(data, containerId);
        }
    }

    format_cell_value(value, fieldtype) {
        if (!value && value !== 0) return '';
        
        // Format based on field type
        switch(fieldtype) {
            case 'Date':
                try {
                    return frappe.datetime.str_to_user(value);
                } catch {
                    return value;
                }
            case 'Datetime':
                try {
                    return frappe.datetime.str_to_user(value) + ' ' + frappe.datetime.get_time_str(value);
                } catch {
                    return value;
                }
            case 'Currency':
            case 'Float':
                return parseFloat(value).toLocaleString();
            case 'Int':
                return parseInt(value).toLocaleString();
            case 'Percent':
                return (parseFloat(value) * 100).toFixed(2) + '%';
            case 'Check':
                return value ? '✓' : '✗';
            default:
                return value;
        }
    }

    render_fallback_table(data, containerId) {
        // Fallback HTML table with improved styling
        const headers = this.selected_fields.map(field => field.custom_label || field.field_label || field.fieldname);
        const tableHtml = `
            <div class="table-responsive">
                <table class="table table-bordered table-hover">
                    <thead class="table-light">
                        <tr>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.slice(0, 25).map(row => `
                            <tr>
                                ${this.selected_fields.map(field => `
                                    <td>${this.format_cell_value(row[field.fieldname], field.fieldtype)}</td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        $(containerId).html(tableHtml);
    }

    render_gallery_view(report_data, container) {
        const data = report_data.data || [];
        if (data.length === 0) {
            $(container).html('<div class="alert alert-info">No data found</div>');
            return;
        }

        // Find gallery/image fields
        const galleryField = this.selected_fields.find(field => field.is_gallery || 
            field.fieldtype === 'Attach Image' || field.fieldtype === 'Attach');
        
        if (!galleryField) {
            $(container).html('<div class="alert alert-warning">No image fields selected for gallery view</div>');
            return;
        }

        const galleryHtml = `
            <div class="gallery-container">
                <div class="row">
                    ${data.slice(0, 12).map(row => {
                        const imageUrl = this.process_image_url(row[galleryField.fieldname]);
                        const title = row[this.selected_fields[0].fieldname] || 'Untitled';
                        
                        return `
                            <div class="col-md-3 col-sm-4 col-6 mb-4">
                                <div class="gallery-item">
                                    <div class="gallery-image-container">
                                        <img src="${imageUrl}" alt="${title}" class="gallery-image" 
                                             onerror="this.src='/assets/frappe/images/default-avatar.png'">
                                    </div>
                                    <div class="gallery-item-details">
                                        <h6>${title}</h6>
                                        ${this.selected_fields.slice(1, 3).map(field => 
                                            `<small class="text-muted">${row[field.fieldname] || ''}</small>`
                                        ).join('<br>')}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="text-muted">Showing first 12 items of ${report_data.total} total records</div>
        `;
        
        $(container).html(galleryHtml);
    }

    process_image_url(imageValue) {
        if (!imageValue) return '/assets/frappe/images/default-avatar.png';
        
        // Handle JSON strings
        if (typeof imageValue === 'string' && imageValue.startsWith('[')) {
            try {
                const parsed = JSON.parse(imageValue);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed[0].file_url || parsed[0];
                }
            } catch (e) {
                // Continue with original value
            }
        }
        
        // Handle direct URLs
        if (typeof imageValue === 'string') {
            return imageValue.startsWith('/') ? imageValue : `/files/${imageValue}`;
        }
        
        return '/assets/frappe/images/default-avatar.png';
    }

    // Modern UI Assets and Methods
    async load_modern_ui_assets() {
        // Load Tabulator and Shadcn-inspired styling for modern tables
        try {
            await Promise.all([
                this.load_tabulator_assets(),
                this.load_shadcn_inspired_styles()
            ]);
            console.log('✅ Modern UI assets loaded successfully');
        } catch (error) {
            console.error('❌ Error loading modern UI assets:', error);
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

    load_shadcn_inspired_styles() {
        // Inject Shadcn-inspired styles for modern report builder components
        const shadcnStyles = `
            <style id="shadcn-report-builder-styles">
                /* Enhanced Preview Section */
                .report-preview-container {
                    background: white;
                    border-radius: 8px;
                    padding: 1.5rem;
                    margin-top: 1rem;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }

                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .preview-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1f2937;
                    margin: 0;
                }

                .preview-stats {
                    display: flex;
                    gap: 1rem;
                    font-size: 14px;
                    color: #6b7280;
                }

                /* Modern Report Builder Tables */
                .report-builder-tabulator .tabulator {
                    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                    background: white !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
                }

                .report-builder-tabulator .tabulator-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                }

                .report-builder-tabulator .tabulator-header .tabulator-col-title {
                    font-weight: 600 !important;
                    font-size: 14px !important;
                    color: #1f2937 !important;
                }

                .report-builder-tabulator .tabulator-row:hover {
                    background: #f8fafc !important;
                }

                .report-builder-tabulator .tabulator-row .tabulator-cell {
                    border-right: 1px solid #f1f5f9 !important;
                    color: #374151 !important;
                    font-size: 14px !important;
                    padding: 12px 16px !important;
                }
            </style>
        `;

        // Inject styles if not already present
        if (!document.getElementById('shadcn-report-builder-styles')) {
            document.head.insertAdjacentHTML('beforeend', shadcnStyles);
        }

        return Promise.resolve();
    }

    // Helper method to get table label from ID (for consistency with saved reports)
    get_table_label(table_id) {
        return this.table_lookup && this.table_lookup[table_id] ? this.table_lookup[table_id] : table_id;
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
                
                /* Gallery Styles */
                .gallery-container {
                    margin-top: 1rem;
                }
                
                .gallery-item {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    overflow: hidden;
                    transition: transform 0.2s;
                }
                
                .gallery-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                }
                
                .gallery-image-container {
                    position: relative;
                    width: 100%;
                    height: 200px;
                    overflow: hidden;
                }
                
                .gallery-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .gallery-item-details {
                    padding: 1rem;
                }
                
                .gallery-item-details h6 {
                    margin: 0 0 0.5rem 0;
                    font-weight: 600;
                    color: #2d3748;
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
                    this.current_report_modified = report.modified; // Store modified timestamp
                    
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
                
                // After fields are loaded, restore filters, sorting, and grouping
                setTimeout(() => {
                    this.restore_filters_from_config(config.filters || []);
                    this.restore_sorting_from_config(config.sort || []);
                    this.restore_grouping_from_config(config.grouping || []);
                }, 500);
            }, 1000);
        }
        
        // Update title
        if (this.current_report_title) {
            $('#report-title-input').val(this.current_report_title);
        }
    }
    
    restore_filters_from_config(filters) {
        console.log('Restoring filters:', filters);
        filters.forEach(filter => {
            this.add_filter(filter);
        });
    }
    
    restore_sorting_from_config(sortConfig) {
        console.log('Restoring sorting:', sortConfig);
        sortConfig.forEach(sort => {
            this.add_sort(sort);
        });
    }
    
    restore_grouping_from_config(groupingConfig) {
        console.log('Restoring grouping:', groupingConfig);
        groupingConfig.forEach(group => {
            this.add_grouping(group);
        });
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
            report_type: 'Table',
            series: 'REP-'  // Add series field for auto-naming
        };
        
        if (this.current_report_id) {
            report_data.name = this.current_report_id;
            // Include modified timestamp to prevent conflict errors
            if (this.current_report_modified) {
                report_data.modified = this.current_report_modified;
            }
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
                    this.current_report_modified = r.message.modified; // Update modified timestamp
                    
                    // Navigate back to saved reports with context after a brief delay
                    setTimeout(() => {
                        const savedReportsURL = this.build_saved_reports_url();
                        frappe.set_route_from_url(savedReportsURL);
                    }, 1500); // Give user time to see the success message
                } else {
                    frappe.msgprint('Failed to save report');
                }
            }
        });
    }

    add_filter(existingFilter = null) {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = $('#filters-container');
        const filterDiv = $(`
            <div class="filter-item mb-2" style="display: flex; gap: 0.5rem; align-items: center;">
                <select class="form-control form-control-sm field-select" style="flex: 1;">
                    ${this.selected_fields.map(f => `<option value="${f.fieldname}" ${existingFilter && existingFilter.field === f.fieldname ? 'selected' : ''}>${f.custom_label || f.field_label}</option>`).join('')}
                </select>
                <select class="form-control form-control-sm operator-select" style="flex: 1;">
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
                <div class="filter-value-container" style="flex: 1;">
                    <input type="text" class="form-control form-control-sm filter-value" placeholder="Value" value="${existingFilter ? existingFilter.value || '' : ''}">
                    <select class="form-control form-control-sm filter-dropdown" style="display: none;"></select>
                </div>
                <button class="btn btn-sm btn-outline-danger remove-filter-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `);
        
        container.append(filterDiv);
        
        // Bind remove event
        filterDiv.find('.remove-filter-btn').on('click', function() {
            $(this).closest('.filter-item').remove();
        });
        
        // Handle field-specific value input
        const fieldSelect = filterDiv.find('.field-select');
        const operatorSelect = filterDiv.find('.operator-select');
        const valueInput = filterDiv.find('.filter-value');
        const valueDropdown = filterDiv.find('.filter-dropdown');
        
        const handleFieldChange = async () => {
            const selectedFieldname = fieldSelect.val();
            const selectedField = this.selected_fields.find(f => f.fieldname === selectedFieldname);
            
            if (selectedField && ['Select', 'Link'].includes(selectedField.fieldtype)) {
                try {
                    const options = await this.get_field_options(selectedField);
                    if (options && options.length > 0) {
                        valueDropdown.empty();
                        valueDropdown.append('<option value="__choose__">Choose...</option>');
                        valueDropdown.append('<option value="">Empty</option>');
                        options.forEach(option => {
                            valueDropdown.append(`<option value="${option.value}">${option.label}</option>`);
                        });
                        valueInput.hide();
                        valueDropdown.show();
                    } else {
                        valueInput.show();
                        valueDropdown.hide();
                    }
                } catch (error) {
                    console.warn('Could not load field options:', error);
                    valueInput.show();
                    valueDropdown.hide();
                }
            } else {
                valueInput.show();
                valueDropdown.hide();
            }
        };
        
        fieldSelect.on('change', handleFieldChange);
        handleFieldChange(); // Initialize
    }

    add_sort(existingSort = null) {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        const container = $('#sort-container');
        const sortDiv = $(`
            <div class="sort-item mb-2" style="display: flex; gap: 0.5rem; align-items: center;">
                <select class="form-control form-control-sm sort-field-select" style="flex: 2;">
                    ${this.selected_fields.map(f => `<option value="${f.fieldname}" ${existingSort && existingSort.field === f.fieldname ? 'selected' : ''}>${f.custom_label || f.field_label}</option>`).join('')}
                </select>
                <select class="form-control form-control-sm sort-direction-select" style="flex: 1;">
                    <option value="asc" ${existingSort && existingSort.direction === 'asc' ? 'selected' : ''}>Ascending</option>
                    <option value="desc" ${existingSort && existingSort.direction === 'desc' ? 'selected' : ''}>Descending</option>
                </select>
                <button class="btn btn-sm btn-outline-danger remove-sort-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `);
        
        container.append(sortDiv);
        
        // Bind remove event
        sortDiv.find('.remove-sort-btn').on('click', function() {
            $(this).closest('.sort-item').remove();
        });
    }

    add_grouping(existingGroup = null) {
        if (!this.selected_fields.length) {
            frappe.msgprint('Please select fields first');
            return;
        }
        
        // Determine which fields can be grouped
        const groupableFields = this.selected_fields.filter(f => 
            ['Data', 'Select', 'Link', 'Date', 'Datetime', 'Text', 'Small Text'].includes(f.fieldtype)
        );
        
        if (groupableFields.length === 0) {
            frappe.msgprint('No suitable fields for grouping. Select text, select, link or date fields.');
            return;
        }
        
        const container = $('#grouping-container');
        const groupDiv = $(`
            <div class="group-item mb-2" style="display: flex; gap: 0.5rem; align-items: center;">
                <select class="form-control form-control-sm group-field-select" style="flex: 2;">
                    ${groupableFields.map(f => `<option value="${f.fieldname}" ${existingGroup && existingGroup.field === f.fieldname ? 'selected' : ''}>${f.custom_label || f.field_label}</option>`).join('')}
                </select>
                <select class="form-control form-control-sm group-period-select" style="display: none; flex: 1;">
                    <option value="exact" ${existingGroup && existingGroup.period === 'exact' ? 'selected' : ''}>Exact Value</option>
                    <option value="year" ${existingGroup && existingGroup.period === 'year' ? 'selected' : ''}>By Year</option>
                    <option value="month" ${existingGroup && existingGroup.period === 'month' ? 'selected' : ''}>By Month</option>
                    <option value="week" ${existingGroup && existingGroup.period === 'week' ? 'selected' : ''}>By Week</option>
                    <option value="day" ${existingGroup && existingGroup.period === 'day' ? 'selected' : ''}>By Day</option>
                    <option value="hour" ${existingGroup && existingGroup.period === 'hour' ? 'selected' : ''}>By Hour</option>
                </select>
                <select class="form-control form-control-sm group-aggregate-select" style="flex: 1;">
                    <option value="group" ${existingGroup && existingGroup.aggregate === 'group' ? 'selected' : ''}>Group Only</option>
                    <option value="count" ${existingGroup && existingGroup.aggregate === 'count' ? 'selected' : ''}>Count Records</option>
                    <option value="sum" ${existingGroup && existingGroup.aggregate === 'sum' ? 'selected' : ''}>Sum Values</option>
                    <option value="avg" ${existingGroup && existingGroup.aggregate === 'avg' ? 'selected' : ''}>Average Values</option>
                    <option value="min" ${existingGroup && existingGroup.aggregate === 'min' ? 'selected' : ''}>Minimum Value</option>
                    <option value="max" ${existingGroup && existingGroup.aggregate === 'max' ? 'selected' : ''}>Maximum Value</option>
                </select>
                <button class="btn btn-sm btn-outline-danger remove-group-btn">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `);
        
        container.append(groupDiv);
        
        // Add event handler to show/hide time period options
        const fieldSelect = groupDiv.find('.group-field-select');
        const periodSelect = groupDiv.find('.group-period-select');
        
        const updatePeriodVisibility = () => {
            const selectedField = groupableFields.find(f => f.fieldname === fieldSelect.val());
            if (selectedField && ['Date', 'Datetime'].includes(selectedField.fieldtype)) {
                periodSelect.show();
            } else {
                periodSelect.hide();
                periodSelect.val('exact'); // Reset to default
            }
        };
        
        fieldSelect.on('change', updatePeriodVisibility);
        updatePeriodVisibility(); // Initialize on creation
        
        // Bind remove event
        groupDiv.find('.remove-group-btn').on('click', function() {
            $(this).closest('.group-item').remove();
        });
    }
    
    async get_field_options(field) {
        // Get dropdown options for Link/Select fields
        try {
            if (field.fieldtype === 'Link' && field.options) {
                const response = await frappe.call({
                    method: 'frappe.desk.search.search_link',
                    args: {
                        doctype: field.options,
                        txt: '',
                        page_length: 20
                    }
                });
                
                if (response.message) {
                    return response.message.map(item => ({
                        value: item.value,
                        label: item.description || item.value
                    }));
                }
            } else if (field.fieldtype === 'Select' && field.options) {
                return field.options.split('\n').filter(opt => opt.trim()).map(opt => ({
                    value: opt.trim(),
                    label: opt.trim()
                }));
            }
        } catch (error) {
            console.warn('Could not load field options:', error);
        }
        
        return null;
    }

    save_report_with_context_navigation() {
        const title = $('#report-title-input').val();
        if (!title) {
            frappe.msgprint('Please enter a report title');
            return;
        }
        
        const config = this.build_report_config();
        
        const report_data = {
            report_title: title,
            description: title + ' - Generated Report',
            base_table: this.current_table,
            report_type: 'table',
            report_config: JSON.stringify(config),
            is_public: 0
        };
        
        frappe.call({
            method: 'frappe.client.save',
            args: {
                doc: {
                    doctype: 'Flansa Saved Report',
                    ...report_data
                }
            },
            callback: (r) => {
                if (r.message) {
                    frappe.msgprint('Report saved successfully! Redirecting to Saved Reports...');
                    this.current_report_id = r.message.name;
                    
                    // Immediate navigation to saved reports with context
                    setTimeout(() => {
                        const savedReportsURL = this.build_saved_reports_url();
                        frappe.set_route_from_url(savedReportsURL);
                    }, 1000); // Brief delay to show success message
                } else {
                    frappe.msgprint('Failed to save report');
                }
            }
        });
    }
    
    inject_workspace_logo_styles() {
        // Add consistent logo styling
        const styleId = 'workspace-logo-styles';
        if (document.getElementById(styleId)) {
            return; // Already added
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .workspace-logo-container {
                display: none;
                margin-right: 8px;
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
        `;
        document.head.appendChild(style);
    }
    
    async load_workspace_logo() {
        console.log('🔍 Report Builder: Loading workspace logo...');
        try {
            // Get workspace logo from Flansa Tenant Registry
            const result = await frappe.call({
                method: 'flansa.flansa_core.tenant_service.get_workspace_logo',
                args: {},
                freeze: false,
                quiet: false // Show errors for debugging
            });
            
            console.log('🔍 Report Builder: API response:', result);
            
            if (result.message && result.message.logo) {
                const logoContainer = document.getElementById('workspace-logo-container');
                const logoImg = document.getElementById('workspace-logo');
                
                console.log('🔍 Report Builder: DOM elements found:', {
                    logoContainer: !!logoContainer,
                    logoImg: !!logoImg
                });
                
                if (logoContainer && logoImg) {
                    logoImg.src = result.message.logo;
                    logoContainer.style.display = 'block';
                    console.log('✅ Report Builder: Workspace logo loaded successfully');
                } else {
                    console.log('❌ Report Builder: Logo DOM elements not found');
                }
            } else {
                console.log('⚠️ Report Builder: No workspace logo in API response');
            }
        } catch (error) {
            console.log('❌ Report Builder: Workspace logo error:', error);
        }
    }
}

// Load shared FlansaReportRenderer if not already available
if (!window.FlansaReportRenderer) {
    console.log('Loading FlansaReportRenderer in report builder...');
    try {
        frappe.require('/assets/flansa/js/flansa_report_renderer.js');
        console.log('FlansaReportRenderer loaded successfully');
    } catch (error) {
        console.warn('Could not load FlansaReportRenderer:', error);
    }
}

// Initialize the Report Builder when page loads
frappe.pages['flansa-report-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Report Builder',
        single_column: true
    });
    
    // Initialize the report builder
    window.report_builder = new UnifiedReportBuilder(page);
};

frappe.pages['flansa-report-builder'].on_page_show = function(wrapper) {
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