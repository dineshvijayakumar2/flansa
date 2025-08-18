class FlansaReportBuilder {
    constructor(page = null) {
        this.page = page;
        this.current_table = null;
        this.available_fields = {};
        this.selected_fields = [];
        this.filters = [];
        this.sort_config = [];
        this.current_report_data = null;
        this.current_page = 1;
        this.page_size = 20;
        this.current_view = 'table';
        this.is_localized = false; // Track if this is a localized instance
        this.preselected_table = null;
        this.current_report_id = null; // For editing existing reports
        this.current_report_title = null; // For editing existing reports
        this.modal_dialog = null; // Store reference to current modal
        this.filter_table = null; // For filtering reports by specific table
        
        this.extract_url_parameters();
        this.init();
    }

    extract_url_parameters() {
        // Check URL for table or app parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.filter_table = urlParams.get('table');
        this.filter_app = urlParams.get('app');
        
        // Also check for edit mode
        const editParam = urlParams.get('edit');
        if (editParam) {
            this.current_report_id = editParam;
        }
        
        console.log('Report Builder: URL parameters:', {
            filter_table: this.filter_table,
            filter_app: this.filter_app,
            edit_report_id: this.current_report_id
        });
    }

    init() {
        console.log('Report Builder: Initializing...');
        this.setup_page();
        this.setup_navigation();
        this.bind_events();
        this.setup_context_menu();
        this.apply_theme();
        
        // Load reports based on filter context
        if (this.filter_app) {
            this.load_saved_reports_for_app(this.filter_app);
        } else {
            this.load_saved_reports(this.filter_table);
        }
        
        this.load_tables();
        console.log('Report Builder: Initialization complete');
    }

    setup_page() {
        console.log('Report Builder: Setting up page...');
        // Set up the page layout and initial state
        this.setup_breadcrumbs();
        
        // Update page context based on filter
        if (this.filter_app) {
            const pageTitle = $('.page-title');
            const pageSubtitle = $('.page-subtitle');
            pageTitle.find('span').text(`Report Builder - Application Reports`);
            pageSubtitle.text(`Create reports for all tables in this application`);
            
            // Update banner title and subtitle for app-specific context
            if ($('#banner-title').length) {
                $('#banner-title').text(`Application Reports`);
            }
            // Subtitle removed for compact design
            // if ($('#banner-subtitle').length) {
            //     $('#banner-subtitle').text(`All reports for tables in this application`);
            // }
            
            // Hide filter toggle buttons for app view
            $('#filter-toggle-group').hide();
        } else if (this.filter_table) {
            // Fetch table label first, then update UI
            frappe.db.get_value('Flansa Table', this.filter_table, 'table_label').then(r => {
                const table_label = (r && r.message && r.message.table_label) ? r.message.table_label : this.filter_table;
                
                const pageTitle = $('.page-title');
                const pageSubtitle = $('.page-subtitle');
                pageTitle.find('span').text(`Report Builder - ${table_label}`);
                pageSubtitle.text(`Create reports for ${table_label}`);
                
                // Update banner title and subtitle for table-specific context
                if ($('#banner-title').length) {
                    $('#banner-title').text(`Reports for ${table_label}`);
                }
                // Subtitle removed for compact design
                // if ($('#banner-subtitle').length) {
                //     $('#banner-subtitle').text(`Build custom reports for ${this.filter_table} table`);
                // }
                
                // Show filter toggle buttons and set table name with label
                $('#filter-toggle-group').show();
                $('#filter-table-name').text(table_label);
                // Default to showing table-specific reports
                $('#show-table-reports-btn').addClass('btn-primary').removeClass('btn-default');
            }).catch(error => {
                console.log('Could not fetch table label, using internal name:', error);
                const pageTitle = $('.page-title');
                const pageSubtitle = $('.page-subtitle');
                pageTitle.find('span').text(`Report Builder - ${this.filter_table}`);
                pageSubtitle.text(`Create reports for table: ${this.filter_table}`);
                
                // Update banner title and subtitle for table-specific context
                if ($('#banner-title').length) {
                    $('#banner-title').text(`Reports for ${this.filter_table}`);
                }
                // Subtitle removed for compact design
                // if ($('#banner-subtitle').length) {
                //     $('#banner-subtitle').text(`Build custom reports for ${this.filter_table} table`);
                // }
                
                // Show filter toggle buttons and set table name with fallback ID
                $('#filter-toggle-group').show();
                $('#filter-table-name').text(this.filter_table);
                // Default to showing table-specific reports
                $('#show-table-reports-btn').addClass('btn-primary').removeClass('btn-default');
            });
        } else {
            // Hide filter toggle buttons when no filter
            $('#filter-toggle-group').hide();
        }
        
        // Check if page content exists
        const content = $('.flansa-report-builder-page');
        console.log('Report Builder: Page content found:', content.length > 0);
        
        // Show loading state
        this.show_loading("Loading available tables...");
    }

    bind_events() {
        // Navigation
        $('#back-to-workspace-btn').on('click', () => {
            window.location.href = '/app/flansa-workspace';
        });

        // Table selection
        $('#table-selector').on('change', (e) => {
            const table_name = e.target.value;
            if (table_name) {
                this.select_table(table_name);
            }
        });

        // Field selection events
        $(document).on('click', '.field-item', (e) => {
            const field_item = $(e.currentTarget);
            field_item.toggleClass('selected');
            this.update_transfer_buttons();
        });

        // Transfer buttons
        $('#add-field-btn').on('click', () => this.add_selected_fields());
        $('#add-all-btn').on('click', () => this.add_all_fields());
        $('#remove-field-btn').on('click', () => this.remove_selected_fields());
        $('#remove-all-btn').on('click', () => this.remove_all_fields());

        // Filter and sort
        $('#add-filter-btn').on('click', () => this.add_filter());
        $('#add-sort-btn').on('click', () => this.add_sort());

        // Report execution
        $('#run-report-btn').on('click', () => this.run_report());
        $('#edit-report-btn').on('click', () => this.edit_report());
        $('#save-report-btn').on('click', () => this.save_report());
        $('#back-to-builder-btn').on('click', () => this.back_to_table_builder());

        // View mode switching
        $('.view-mode-btn').on('click', (e) => {
            const view = $(e.currentTarget).data('view');
            this.switch_view(view);
        });

        // Search functionality
        $('#report-search').on('input', frappe.utils.debounce(() => {
            this.perform_search();
        }, 300));

        $('#clear-search-btn').on('click', () => {
            $('#report-search').val('');
            this.perform_search();
        });

        // Field search
        $('#field-search').on('input', frappe.utils.debounce(() => {
            this.filter_available_fields();
        }, 300));

        // Selected field item interactions
        $(document).on('click', '.selected-field-item', (e) => {
            const field_item = $(e.currentTarget);
            field_item.toggleClass('selected');
            this.update_transfer_buttons();
        });

        // Field reordering buttons
        $(document).on('click', '.move-up', (e) => {
            e.stopPropagation();
            const index = parseInt($(e.currentTarget).closest('.selected-field-item').data('index'));
            this.move_selected_field(index, -1);
        });

        $(document).on('click', '.move-down', (e) => {
            e.stopPropagation();
            const index = parseInt($(e.currentTarget).closest('.selected-field-item').data('index'));
            this.move_selected_field(index, 1);
        });

        $(document).on('click', '.remove-field', (e) => {
            e.stopPropagation();
            const index = parseInt($(e.currentTarget).closest('.selected-field-item').data('index'));
            this.remove_field_by_index(index);
        });

        // Column label editing
        $(document).on('click', '.edit-label', (e) => {
            e.stopPropagation();
            const index = parseInt($(e.currentTarget).closest('.selected-field-item').data('index'));
            this.edit_field_label(index);
        });

        // Saved reports events
        $('#create-new-report-btn').on('click', () => this.create_new_report());
        $('#refresh-reports-btn').on('click', () => {
            // Refresh maintaining current filter context
            if (this.filter_app) {
                this.load_saved_reports_for_app(this.filter_app);
            } else if (this.filter_table) {
                this.load_saved_reports(this.filter_table);
            } else {
                this.load_saved_reports();
            }
        });
        
        $(document).on('click', '.report-item', (e) => {
            const report_id = $(e.currentTarget).data('report-id');
            // Navigate to dedicated report viewer
            window.location.href = `/app/flansa-report-viewer/${report_id}`;
        });
        
        $(document).on('click', '.report-action-btn', (e) => {
            e.stopPropagation();
            const action = $(e.currentTarget).data('action');
            const report_id = $(e.currentTarget).closest('.report-item').data('report-id');
            this.handle_report_action(action, report_id);
        });
        
        // Filter toggle buttons
        $('#show-all-reports-btn').on('click', () => {
            this.toggle_filter_display(false);
        });
        
        $('#show-table-reports-btn').on('click', () => {
            this.toggle_filter_display(true);
        });
    }

    show_loading(message = "Loading...") {
        // Could show a loading overlay or spinner
        console.log(message);
    }

    hide_loading() {
        // Hide loading state
    }

    async load_tables() {
        console.log('Report Builder: Loading tables...');
        try {
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    fields: ['name', 'table_label', 'table_name', 'status'],
                    filters: {status: 'Active'},
                    order_by: 'table_label'
                }
            });

            console.log('Report Builder: Tables loaded:', response.message?.length || 0);
            if (response.message) {
                this.populate_table_selector(response.message);
            }
        } catch (error) {
            console.error('Report Builder: Error loading tables:', error);
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load tables: ' + error.message,
                indicator: 'red'
            });
        }
        
        this.hide_loading();
    }

    populate_table_selector(tables) {
        const selector = $('#table-selector');
        selector.empty().append('<option value="">-- Select a Table --</option>');
        
        tables.forEach(table => {
            selector.append(`<option value="${table.name}">${table.table_label || table.table_name}</option>`);
        });
    }

    async select_table(table_name, reset_state = true) {
        this.current_table = table_name;
        this.show_loading("Loading table fields...");

        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.get_report_field_options',
                args: { table_name: table_name }
            });

            if (response.message && response.message.success) {
                this.available_fields = response.message.fields;
                this.display_table_info(response.message.table, response.message.capabilities);
                this.populate_available_fields();
                this.show_field_selection();
                
                // Only reset state if explicitly requested (default true for backward compatibility)
                if (reset_state) {
                    this.reset_report_state();
                }
            } else {
                throw new Error(response.message.error || 'Failed to load fields');
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load table fields: ' + error.message,
                indicator: 'red'
            });
        }

        this.hide_loading();
    }

    display_table_info(table, capabilities) {
        $('#selected-table-name').text(table.label);
        $('#selected-table-details').text(
            `Table: ${table.name} | DocType: ${table.doctype} | ` +
            `Fields Available: ${capabilities.total_fields}` +
            (capabilities.has_gallery ? ' | Gallery View Available' : '')
        );
        $('#table-info').show();

        // Show/hide gallery view button based on capabilities
        if (capabilities.has_gallery) {
            $('#gallery-view-btn').show();
        } else {
            $('#gallery-view-btn').hide();
        }
    }

    populate_available_fields() {
        // Populate current table fields
        const current_container = $('#current-fields');
        current_container.empty();
        
        this.available_fields.current.forEach(field => {
            const field_item = this.create_field_item(field);
            current_container.append(field_item);
        });
        
        $('#current-fields-count').text(this.available_fields.current.length);

        // Populate system fields
        const system_container = $('#system-fields');
        system_container.empty();
        
        if (this.available_fields.system && this.available_fields.system.length > 0) {
            this.available_fields.system.forEach(field => {
                const field_item = this.create_field_item(field);
                system_container.append(field_item);
            });
        } else {
            system_container.html('<div class="text-muted" style="padding: 15px;">No system fields available</div>');
        }
        
        $('#system-fields-count').text(this.available_fields.system ? this.available_fields.system.length : 0);

        // Populate related fields (grouped by link field)
        const related_container = $('#related-fields');
        related_container.empty();
        
        if (this.available_fields.related_groups && this.available_fields.related_groups.length > 0) {
            this.available_fields.related_groups.forEach(group => {
                // Create group header
                const group_header = $(`
                    <div class="related-field-group" style="margin-bottom: 10px;">
                        <div class="group-header" style="background: #f0f8ff; padding: 8px 12px; font-weight: 600; color: #0066cc; border-radius: 4px; margin-bottom: 5px;">
                            <i class="fa fa-link"></i> ${group.link_field_label} → ${group.target_table_label}
                        </div>
                        <div class="group-fields"></div>
                    </div>
                `);
                
                const group_fields_container = group_header.find('.group-fields');
                group.fields.forEach(field => {
                    const field_item = this.create_field_item(field);
                    group_fields_container.append(field_item);
                });
                
                related_container.append(group_header);
            });
        } else {
            related_container.html('<div class="text-muted" style="padding: 15px;">No related fields available<br><small>Add Link fields to access related table data</small></div>');
        }
        
        const total_related = this.available_fields.related ? this.available_fields.related.length : 0;
        $('#related-fields-count').text(total_related);
    }

    create_field_item(field) {
        const icon = this.get_field_icon(field.fieldtype);
        const gallery_badge = field.is_gallery ? '<span class="label label-info">Gallery</span>' : '';
        const logic_badge = field.is_logic_field ? `<span class="label label-success">${field.logic_type}</span>` : '';
        const system_badge = field.is_system_field ? '<span class="label label-warning">System</span>' : '';
        const is_selected = this.is_field_selected(field.fieldname);
        
        const category_info = field.category === 'related' ? 
            `<small class="text-info"><i class="fa fa-link"></i> ${field.table_label}</small>` :
            field.category === 'system' ? 
            `<small class="text-warning"><i class="fa fa-cog"></i> System</small>` : '';
        
        const field_item = $(`
            <div class="field-item ${is_selected ? 'selected' : ''}" 
                 data-fieldname="${field.fieldname}" 
                 data-category="${field.category}"
                 style="cursor: pointer; user-select: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px;">
                    <div style="flex: 1;">
                        <i class="${icon}" style="margin-right: 6px; color: #666;"></i>
                        <strong>${field.label}</strong>
                        <small class="text-muted">(${field.fieldtype})</small>
                        ${gallery_badge}
                        ${logic_badge}
                        ${system_badge}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${category_info}
                        ${is_selected ? '<i class="fa fa-check-circle text-primary"></i>' : ''}
                    </div>
                </div>
            </div>
        `);
        
        // Add click handler for single selection
        field_item.on('click', (e) => {
            e.preventDefault();
            this.toggle_field_selection(field_item, field);
        });
        
        return field_item;
    }

    get_field_icon(fieldtype) {
        const icons = {
            'Data': 'fa fa-font',
            'Text': 'fa fa-align-left',
            'Int': 'fa fa-hashtag',
            'Float': 'fa fa-calculator',
            'Currency': 'fa fa-money',
            'Date': 'fa fa-calendar',
            'Datetime': 'fa fa-clock-o',
            'Select': 'fa fa-list',
            'Link': 'fa fa-link',
            'Check': 'fa fa-check-square-o',
            'Attach': 'fa fa-paperclip',
            'Attach Image': 'fa fa-image'
        };
        return icons[fieldtype] || 'fa fa-circle-o';
    }

    show_field_selection() {
        // Don't show these on main page anymore - using modal instead
        // $('#field-selection-section').show();
        // $('#filters-section').show();
        // $('#sort-section').show();
        // $('#run-report-btn').show();
    }

    reset_report_state() {
        this.selected_fields = [];
        this.filters = [];
        this.sort_config = [];
        this.update_selected_fields_display();
        this.hide_report_results();
    }

    update_transfer_buttons() {
        const selected_available = $('.field-item.selected').length > 0;
        const selected_chosen = $('.selected-field-item.selected').length > 0;
        
        $('#add-field-btn').prop('disabled', !selected_available);
        $('#remove-field-btn').prop('disabled', !selected_chosen);
    }

    add_selected_fields() {
        $('.field-item.selected').each((i, elem) => {
            const fieldname = $(elem).data('fieldname');
            const category = $(elem).data('category');
            
            const field = this.find_field_by_name(fieldname, category);
            if (field && !this.is_field_selected(fieldname)) {
                this.selected_fields.push(field);
            }
            
            $(elem).removeClass('selected');
        });
        
        this.update_selected_fields_display();
        this.update_transfer_buttons();
    }

    add_all_fields() {
        // Add all visible (non-filtered) fields
        $('.field-item').each((i, elem) => {
            const fieldname = $(elem).data('fieldname');
            const category = $(elem).data('category');
            
            const field = this.find_field_by_name(fieldname, category);
            if (field && !this.is_field_selected(fieldname)) {
                this.selected_fields.push(field);
            }
        });
        
        this.update_selected_fields_display();
    }

    remove_selected_fields() {
        $('.selected-field-item.selected').each((i, elem) => {
            const fieldname = $(elem).data('fieldname');
            this.selected_fields = this.selected_fields.filter(f => f.fieldname !== fieldname);
            $(elem).remove();
        });
        
        this.update_selected_fields_display();
        this.update_transfer_buttons();
    }

    remove_all_fields() {
        this.selected_fields = [];
        this.update_selected_fields_display();
    }

    find_field_by_name(fieldname, category) {
        let fields_list = [];
        
        if (category === 'current') {
            fields_list = this.available_fields.current || [];
        } else if (category === 'system') {
            fields_list = this.available_fields.system || [];
        } else if (category === 'related') {
            fields_list = this.available_fields.related || [];
        } else if (category === 'parent') {
            // Backward compatibility
            fields_list = this.available_fields.parent || [];
        }
        
        return fields_list.find(f => f.fieldname === fieldname);
    }

    toggle_field_selection(field_item, field) {
        const is_currently_selected = field_item.hasClass('selected');
        
        if (is_currently_selected) {
            // Deselect field
            field_item.removeClass('selected');
            field_item.find('.fa-check-circle').remove();
            
            // Remove from selected fields
            this.selected_fields = this.selected_fields.filter(f => f.fieldname !== field.fieldname);
        } else {
            // Clear other selections for single selection mode
            $('.field-item.selected').each((_, elem) => {
                $(elem).removeClass('selected');
                $(elem).find('.fa-check-circle').remove();
            });
            
            // Select this field
            field_item.addClass('selected');
            if (!field_item.find('.fa-check-circle').length) {
                field_item.find('.fa').after('<i class="fa fa-check-circle text-primary" style="margin-left: 6px;"></i>');
            }
            
            // Add to selected fields (replace current selection)
            this.selected_fields = [field];
        }
        
        this.update_selected_fields_display();
        this.update_button_states();
    }

    is_field_selected(fieldname) {
        return this.selected_fields.some(f => f.fieldname === fieldname);
    }

    move_selected_field(index, direction) {
        const new_index = index + direction;
        if (new_index >= 0 && new_index < this.selected_fields.length) {
            [this.selected_fields[index], this.selected_fields[new_index]] = 
                [this.selected_fields[new_index], this.selected_fields[index]];
            this.update_selected_fields_display();
        }
    }

    remove_field_by_index(index) {
        if (index >= 0 && index < this.selected_fields.length) {
            this.selected_fields.splice(index, 1);
            this.update_selected_fields_display();
        }
    }

    edit_field_label(index) {
        if (index < 0 || index >= this.selected_fields.length) return;
        
        const field = this.selected_fields[index];
        const current_label = field.custom_label || field.label;
        
        let d = new frappe.ui.Dialog({
            title: `Edit Column Name - ${field.label}`,
            fields: [
                {
                    fieldname: 'original_label',
                    fieldtype: 'Data',
                    label: 'Original Label',
                    read_only: 1,
                    default: field.label
                },
                {
                    fieldname: 'custom_label',
                    fieldtype: 'Data',
                    label: 'Custom Column Name',
                    default: current_label,
                    reqd: 1,
                    description: 'This name will appear as the column header in reports'
                }
            ],
            primary_action_label: 'Update',
            primary_action: (values) => {
                if (values.custom_label.trim()) {
                    // Update the field's custom label
                    this.selected_fields[index].custom_label = values.custom_label.trim();
                    this.update_selected_fields_display();
                    frappe.show_alert(`Column name updated to "${values.custom_label}"`, 'green');
                }
                d.hide();
            },
            secondary_action_label: 'Reset to Original',
            secondary_action: () => {
                // Remove custom label to revert to original
                delete this.selected_fields[index].custom_label;
                this.update_selected_fields_display();
                frappe.show_alert('Column name reset to original', 'blue');
                d.hide();
            }
        });
        
        d.show();
    }

    update_selected_fields_display() {
        const container = $('#selected-fields');
        container.empty();
        
        if (this.selected_fields.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 40px;">
                    <i class="fa fa-columns text-muted" style="font-size: 48px; opacity: 0.3;"></i>
                    <p class="text-muted">No fields selected yet</p>
                    <small class="text-muted">Select fields from the left panel to build your report</small>
                </div>
            `);
        } else {
            this.selected_fields.forEach((field, index) => {
                const field_item = this.create_selected_field_item(field, index);
                container.append(field_item);
            });
        }
        
        $('#selected-fields-count').text(this.selected_fields.length);
        
        // Enable/disable run report button
        $('#run-report-btn').prop('disabled', this.selected_fields.length === 0);
        
        // Show/hide save button
        if (this.selected_fields.length > 0) {
            $('#save-report-btn').show();
        } else {
            $('#save-report-btn').hide();
        }
    }

    create_selected_field_item(field, index) {
        const icon = this.get_field_icon(field.fieldtype);
        const category_badge = field.category === 'parent' ? 
            `<span class="label label-info">${field.table_label}</span>` : '';
        
        // Use custom label if available, otherwise use original label
        const display_label = field.custom_label || field.label;
        
        return $(`
            <div class="selected-field-item" data-fieldname="${field.fieldname}" data-index="${index}">
                <div style="flex: 1; cursor: pointer;" class="field-info">
                    <i class="${icon}"></i>
                    <strong class="field-label">${display_label}</strong>
                    <small class="text-muted">(${field.fieldtype})</small>
                    ${category_badge}
                    ${field.custom_label ? '<small class="text-info">Custom</small>' : ''}
                </div>
                <div>
                    <button class="btn btn-xs btn-default edit-label" title="Edit Column Name">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-default move-up" ${index === 0 ? 'disabled' : ''}>
                        <i class="fa fa-chevron-up"></i>
                    </button>
                    <button class="btn btn-xs btn-default move-down" ${index === this.selected_fields.length - 1 ? 'disabled' : ''}>
                        <i class="fa fa-chevron-down"></i>
                    </button>
                    <button class="btn btn-xs btn-danger remove-field">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `);
    }

    filter_available_fields() {
        const search_term = $('#field-search').val().toLowerCase();
        
        $('.field-item').each(function() {
            const field_text = $(this).text().toLowerCase();
            if (field_text.includes(search_term)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    add_filter() {
        if (!this.current_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first.');
            return;
        }

        // Show filter dialog
        this.show_filter_dialog();
    }

    add_sort() {
        if (!this.current_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first.');
            return;
        }

        // Show sort dialog
        this.show_sort_dialog();
    }

    async run_report() {
        if (this.selected_fields.length === 0) {
            frappe.msgprint('Please select at least one field to display in the report.');
            return;
        }

        const report_config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields,
            filters: this.filters,
            sort: this.sort_config
        };

        const view_options = {
            page: this.current_page || 1,
            page_size: this.page_size,
            view_type: this.current_view,
            search: $('#report-search').val() || ''
        };

        this.show_report_loading();

        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                args: {
                    report_config: report_config,
                    view_options: view_options
                }
            });

            if (response.message && response.message.success) {
                this.current_report_data = response.message;
                this.display_report_results();
            } else {
                throw new Error(response.message.error || 'Failed to execute report');
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to execute report: ' + error.message,
                indicator: 'red'
            });
            this.hide_report_loading();
        }
    }

    show_report_loading() {
        $('#report-loading').show();
        $('#table-view, #gallery-view, #no-results').hide();
        this.show_report_results();
    }

    hide_report_loading() {
        $('#report-loading').hide();
    }

    show_report_results() {
        // Hide main page content and show results in full page
        $('.flansa-report-builder-page > .page-head').hide();
        $('.flansa-report-builder-page > .section-card').hide();
        $('#report-builder-container').hide();
        
        $('#report-results-container').show().css({
            'position': 'fixed',
            'top': '0',
            'left': '0',
            'right': '0',
            'bottom': '0',
            'z-index': '1000',
            'background': 'var(--flansa-background, #f8f9fa)',
            'padding': '20px',
            'overflow': 'auto'
        });
    }

    hide_report_results() {
        // Restore normal layout
        $('.flansa-report-builder-page > .page-head').show();
        $('.flansa-report-builder-page > .section-card').show();
        
        $('#report-results-container').hide().css({
            'position': '',
            'top': '',
            'left': '',
            'right': '',
            'bottom': '',
            'z-index': '',
            'background': '',
            'padding': '',
            'overflow': ''
        });
        // Don't show report-builder-container anymore - using modal
        // $('#report-builder-container').show();
    }

    display_report_results() {
        this.hide_report_loading();
        
        if (!this.current_report_data.data || this.current_report_data.data.length === 0) {
            this.show_no_results();
            return;
        }

        // Update record count info
        $('#record-count-info').text(
            `Showing ${this.current_report_data.data.length} of ${this.current_report_data.total} records`
        );

        // Show save button after running report (if not already saved)
        if (!this.current_report_id) {
            $('#save-report-btn').show().text('Save Report');
        } else {
            $('#save-report-btn').show().text('Update Report');
        }

        // Display based on current view
        if (this.current_view === 'table') {
            this.display_table_view();
        } else {
            this.display_gallery_view();
        }

        // Setup pagination
        this.setup_pagination();
    }

    display_table_view() {
        const table = $('#report-table');
        const thead = table.find('thead');
        const tbody = table.find('tbody');
        
        // Clear existing content
        thead.empty();
        tbody.empty();
        
        // Create header
        const header_row = $('<tr></tr>');
        this.selected_fields.forEach(field => {
            const display_label = field.custom_label || field.label;
            header_row.append(`<th>${display_label}</th>`);
        });
        thead.append(header_row);
        
        // Create rows
        this.current_report_data.data.forEach(record => {
            const row = $('<tr></tr>');
            this.selected_fields.forEach(field => {
                const value = record[field.fieldname] || '';
                const formatted_value = this.format_field_value(value, field.fieldtype);
                row.append(`<td>${formatted_value}</td>`);
            });
            tbody.append(row);
        });
        
        $('#table-view').show();
        $('#gallery-view').hide();
    }

    display_gallery_view() {
        console.log('display_gallery_view called');
        const container = $('#gallery-container');
        container.empty();
        
        // Check for gallery capability
        const gallery_fields = this.selected_fields.filter(f => f.is_gallery || 
            ['Attach Image', 'Attach'].includes(f.fieldtype) || 
            f.fieldname.toLowerCase().includes('image'));
        
        console.log('Selected fields:', this.selected_fields);
        console.log('Gallery fields found:', gallery_fields);
        console.log('Current report data:', this.current_report_data);
        
        if (gallery_fields.length === 0) {
            console.log('No gallery fields found, showing empty state');
            container.html(`
                <div class="gallery-empty-state">
                    <i class="fa fa-images text-muted"></i>
                    <h4>No Image Fields Selected</h4>
                    <p class="text-muted">To use gallery view, please select at least one image field (Attach Image or Attach fields)</p>
                    <button class="btn btn-primary btn-sm" onclick="$('.view-mode-btn[data-view=\"table\"]').click()">
                        <i class="fa fa-table"></i> Switch to Table View
                    </button>
                </div>
            `);
            $('#gallery-view').show();
            $('#table-view').hide();
            return;
        }
        
        // Use the first image field as primary gallery field
        const primary_gallery_field = gallery_fields[0];
        
        // Create gallery header with controls - place at top of results container
        const gallery_header = $(`
            <div class="gallery-header" style="margin-bottom: 20px; padding: 15px 0; border-bottom: 1px solid #eee;">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center" style="gap: 15px;">
                        <button class="btn btn-default btn-sm" id="back-to-reports-btn">
                            <i class="fa fa-arrow-left"></i> Back to Reports
                        </button>
                        <div class="gallery-stats">
                            <h4 style="margin: 0; color: var(--flansa-primary, #007bff);">
                                <i class="fa fa-th"></i> Gallery View
                                <span class="badge badge-primary ml-2">${this.current_report_data.data.length} records</span>
                            </h4>
                            <small class="text-muted">Primary Image: ${primary_gallery_field.label}</small>
                        </div>
                    </div>
                    <div class="gallery-controls d-flex align-items-center" style="gap: 15px;">
                        <label class="mb-0" style="font-size: 13px; color: #666;">Card Size:</label>
                        <select class="form-control gallery-size-control" style="width: 130px; height: 32px;">
                            <option value="small">Small (5-6 per line)</option>
                            <option value="medium" selected>Medium (4-5 per line)</option>
                            <option value="large">Large (3-4 per line)</option>
                        </select>
                        <span class="gallery-scroll-hint" style="color: #999; font-size: 12px;">
                            <i class="fa fa-arrows-h"></i> Scroll horizontally
                        </span>
                    </div>
                </div>
            </div>
        `);
        
        // Insert header at the top of the section body, before any existing content
        $('#report-results-container .section-body').prepend(gallery_header);
        
        // Create gallery grid
        const gallery_grid = $('<div class="gallery-grid" data-size="medium"></div>');
        
        this.current_report_data.data.forEach((record, index) => {
            console.log(`Creating gallery item ${index} for record:`, record.name, 'Image field value:', record[primary_gallery_field.fieldname]);
            const gallery_item = this.create_enhanced_gallery_item(record, primary_gallery_field, gallery_fields, index);
            gallery_grid.append(gallery_item);
        });
        
        // Create a full-width wrapper for the gallery
        const gallery_wrapper = $('<div class="gallery-wrapper" style="width: 100%; padding: 20px;"></div>');
        gallery_wrapper.append(gallery_grid);
        container.append(gallery_wrapper);
        
        // Bind gallery controls
        $('#report-results-container').find('.gallery-size-control').on('change', (e) => {
            const size = e.target.value;
            gallery_grid.attr('data-size', size);
        });
        
        $('#gallery-view').show();
        $('#table-view').hide();
    }

    create_gallery_item(record, gallery_field) {
        const raw_image_value = record[gallery_field.fieldname];
        const image_url = this.get_full_image_url(raw_image_value);
        const title = record.title || record.name || 'Untitled';
        
        // Get other field values to display
        const other_fields = this.selected_fields.filter(f => 
            f.fieldname !== gallery_field.fieldname && f.fieldname !== 'name'
        ).slice(0, 3); // Show max 3 additional fields
        
        let fields_html = '';
        other_fields.forEach(field => {
            const value = record[field.fieldname];
            if (value) {
                fields_html += `<div class="field-row"><strong>${field.label}:</strong> <span>${this.format_field_value(value, field.fieldtype)}</span></div>`;
            }
        });
        
        return $(`
            <div class="gallery-item" data-record-name="${record.name}">
                <div class="gallery-image-container">
                    <img src="${image_url}" alt="${title}" class="gallery-image" onerror="this.src='/assets/frappe/images/default-avatar.png'">
                    <div class="gallery-overlay">
                        <button class="btn btn-sm btn-primary view-details-btn">
                            <i class="fa fa-eye"></i> View Details
                        </button>
                    </div>
                </div>
                <div class="gallery-content">
                    <h5 class="gallery-title">${title}</h5>
                    <div class="gallery-fields">
                        ${fields_html}
                    </div>
                </div>
            </div>
        `).find('.view-details-btn').on('click', (e) => {
            e.stopPropagation();
            this.show_record_details(record);
        }).end().on('click', () => {
            this.show_record_details(record);
        });
    }

    format_field_value(value, fieldtype) {
        if (!value) return '';
        
        switch (fieldtype) {
            case 'Currency':
                return frappe.format(value, {fieldtype: 'Currency'});
            case 'Date':
                return frappe.format(value, {fieldtype: 'Date'});
            case 'Datetime':
                return frappe.format(value, {fieldtype: 'Datetime'});
            case 'Check':
                return value ? '<i class="fa fa-check text-success"></i>' : '<i class="fa fa-times text-muted"></i>';
            default:
                return value;
        }
    }

    setup_pagination() {
        const pagination = $('#report-pagination');
        pagination.empty();
        
        const total_pages = this.current_report_data.total_pages;
        const current_page = this.current_report_data.page;
        
        if (total_pages <= 1) {
            pagination.hide();
            return;
        }
        
        pagination.show();
        
        // Previous button
        if (current_page > 1) {
            pagination.append(`<li><a href="#" data-page="${current_page - 1}">Previous</a></li>`);
        }
        
        // Page numbers
        const start_page = Math.max(1, current_page - 2);
        const end_page = Math.min(total_pages, current_page + 2);
        
        for (let page = start_page; page <= end_page; page++) {
            const active_class = page === current_page ? 'active' : '';
            pagination.append(`<li class="${active_class}"><a href="#" data-page="${page}">${page}</a></li>`);
        }
        
        // Next button
        if (current_page < total_pages) {
            pagination.append(`<li><a href="#" data-page="${current_page + 1}">Next</a></li>`);
        }
        
        // Bind pagination events
        pagination.find('a').on('click', (e) => {
            e.preventDefault();
            const page = $(e.target).data('page');
            if (page !== current_page) {
                this.go_to_page(page);
            }
        });
    }

    async go_to_page(page) {
        this.current_page = page;
        
        // Update view options with new page
        const report_config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields,
            filters: this.filters,
            sort: this.sort_config
        };

        const view_options = {
            page: page,
            page_size: this.page_size,
            view_type: this.current_view,
            search: $('#report-search').val() || ''
        };

        this.show_report_loading();

        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                args: {
                    report_config: report_config,
                    view_options: view_options
                }
            });

            if (response.message && response.message.success) {
                this.current_report_data = response.message;
                this.display_report_results();
            } else {
                throw new Error(response.message.error || 'Failed to execute report');
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load page: ' + error.message,
                indicator: 'red'
            });
            this.hide_report_loading();
        }
    }

    switch_view(view) {
        this.current_view = view;
        
        // Update button states
        $('.view-mode-btn').removeClass('active');
        $(`.view-mode-btn[data-view="${view}"]`).addClass('active');
        
        // Show appropriate view
        if (this.current_report_data) {
            this.display_report_results();
        }
    }

    show_no_results() {
        $('#no-results').show();
        $('#table-view, #gallery-view').hide();
    }

    edit_report() {
        this.hide_report_results();
    }

    show_record_details(record) {
        // Create a dialog showing all field values for this record
        let fields_html = '';
        
        this.selected_fields.forEach(field => {
            const value = record[field.fieldname];
            const formatted_value = this.format_field_value(value, field.fieldtype);
            
            fields_html += `
                <div class="row" style="margin-bottom: 10px;">
                    <div class="col-md-4"><strong>${field.label}:</strong></div>
                    <div class="col-md-8">${formatted_value || '<em>No value</em>'}</div>
                </div>
            `;
        });
        
        let d = new frappe.ui.Dialog({
            title: `Record Details: ${record.name}`,
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'record_details',
                    options: `
                        <div class="record-details">
                            ${fields_html}
                        </div>
                        <style>
                            .record-details {
                                max-height: 400px;
                                overflow-y: auto;
                                padding: 15px;
                            }
                            .record-details .row {
                                border-bottom: 1px solid #eee;
                                padding: 8px 0;
                            }
                            .record-details .row:last-child {
                                border-bottom: none;
                            }
                        </style>
                    `
                }
            ],
            primary_action_label: 'Close',
            primary_action: () => {
                d.hide();
            }
        });
        
        d.show();
    }

    async perform_search() {
        // Re-run the report with search parameters
        if (this.current_report_data) {
            await this.run_report();
        }
    }

    save_report() {
        if (!this.current_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first.');
            return;
        }

        // If this is an existing report, update it instead of creating new
        if (this.current_report_id) {
            this.update_existing_report_direct();
            return;
        }

        // Get table info for title suggestion
        const table_doc = this.current_table;
        
        let d = new frappe.ui.Dialog({
            title: 'Save Report',
            fields: [
                {
                    fieldname: 'report_title',
                    fieldtype: 'Data',
                    label: 'Report Title',
                    reqd: 1,
                    default: `${table_doc} Report`,
                    description: 'Give your report a descriptive name'
                },
                {
                    fieldname: 'description',
                    fieldtype: 'Small Text',
                    label: 'Description',
                    description: 'Optional description of what this report shows'
                },
                {
                    fieldname: 'report_type',
                    fieldtype: 'Select',
                    label: 'Report Type',
                    options: 'Table\nGallery',
                    default: this.current_view === 'gallery' ? 'Gallery' : 'Table',
                    reqd: 1
                },
                {
                    fieldname: 'is_public',
                    fieldtype: 'Check',
                    label: 'Make this report public',
                    description: 'Allow other users to view and use this report'
                }
            ],
            primary_action_label: 'Save Report',
            primary_action: async (values) => {
                await this.perform_save_report(values);
                d.hide();
            }
        });

        d.show();
    }

    has_unsaved_changes() {
        // Check if we're editing an existing report and there are changes
        if (!this.current_report_id || !this.original_report_config) {
            return false;
        }
        
        const current_config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields,
            filters: this.filters,
            sort: this.sort_config
        };
        
        return JSON.stringify(current_config) !== JSON.stringify(this.original_report_config);
    }
    
    async confirm_unsaved_changes() {
        return new Promise((resolve) => {
            frappe.confirm(
                'You have unsaved changes. Do you want to continue without saving?',
                () => resolve(true),   // Continue without saving
                () => resolve(false)   // Stay in edit mode
            );
        });
    }
    
    async create_temporary_report() {
        try {
            // Create a temporary report for viewing
            const temp_title = `Temp Report - ${this.current_table} - ${new Date().toLocaleTimeString()}`;
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.save_report',
                args: {
                    report_title: temp_title,
                    description: 'Temporary report for preview',
                    base_table: this.current_table,
                    report_type: 'Table',
                    report_config: {
                        base_table: this.current_table,
                        selected_fields: this.selected_fields,
                        filters: this.filters,
                        sort: this.sort_config
                    },
                    view_options: {
                        view_type: this.current_view,
                        page_size: this.page_size
                    },
                    is_public: 0
                }
            });
            
            if (response.message && response.message.success) {
                // Redirect to view the temporary report
                window.location.href = `/app/flansa-report-viewer/${response.message.report_id}?temp=1`;
            } else {
                frappe.msgprint('Failed to create temporary report');
            }
        } catch (error) {
            frappe.msgprint('Error creating temporary report: ' + error.message);
        }
    }

    async update_existing_report_direct() {
        const report_config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields,
            filters: this.filters,
            sort: this.sort_config
        };
        
        const view_options = {
            view_type: this.current_view,
            page_size: this.page_size
        };

        try {
            const response = await frappe.call({
                method: 'frappe.client.set_value',
                args: {
                    doctype: 'Flansa Saved Report',
                    name: this.current_report_id,
                    fieldname: {
                        'report_config': JSON.stringify(report_config),
                        'view_options': JSON.stringify(view_options)
                    }
                }
            });

            if (!response.exc) {
                frappe.show_alert({
                    message: `Report "${this.current_report_title}" updated successfully!`,
                    indicator: 'green'
                });
                
                // Refresh saved reports list
                const filter_table = this.is_localized ? this.preselected_table : null;
                await this.load_saved_reports(filter_table);
            } else {
                frappe.msgprint('Failed to update report');
            }
        } catch (error) {
            frappe.msgprint('Error updating report: ' + error.message);
        }
    }

    async perform_save_report(values) {
        // Validate filters before saving
        for (let i = 0; i < this.filters.length; i++) {
            const filter = this.filters[i];
            if (!filter.value || (typeof filter.value === 'string' && filter.value.trim() === '')) {
                frappe.msgprint({
                    title: 'Validation Error',
                    message: `Filter ${i + 1} has no value. Please provide a value or remove the filter.`,
                    indicator: 'red'
                });
                return;
            }
        }
        
        try {
            const report_config = {
                base_table: this.current_table,
                selected_fields: this.selected_fields,
                filters: this.filters,
                sort: this.sort_config
            };

            const view_options = {
                view_type: this.current_view,
                page_size: this.page_size
            };

            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.save_report',
                args: {
                    report_title: values.report_title,
                    description: values.description || '',
                    base_table: this.current_table,
                    report_type: values.report_type,
                    report_config: report_config,
                    view_options: view_options,
                    is_public: values.is_public ? 1 : 0
                }
            });

            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: `Report "${values.report_title}" saved successfully!`,
                    indicator: 'green'
                });
                
                // Set current report ID for future updates and run the report
                this.current_report_id = response.message.report_id;
                this.current_report_title = values.report_title;
                
                // Show save button in results view
                $('#save-report-btn').show().text('Update Report');
                
                // Redirect to view the saved report
                setTimeout(() => {
                    window.location.href = `/app/flansa-report-viewer/${response.message.report_id}`;
                }, 500);
            } else {
                frappe.msgprint({
                    title: 'Save Failed',
                    message: response.message.error || 'Failed to save report',
                    indicator: 'red'
                });
            }
        } catch (error) {
            console.error('Error saving report:', error);
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to save report: ' + error.message,
                indicator: 'red'
            });
        }
    }

    show_filter_dialog() {
        let filter_fields = [...this.selected_fields];
        
        let d = new frappe.ui.Dialog({
            title: 'Add Filter',
            fields: [
                {
                    fieldname: 'field',
                    fieldtype: 'Select',
                    label: 'Field',
                    options: filter_fields.map(f => ({ value: f.fieldname, label: f.label })),
                    reqd: 1
                },
                {
                    fieldname: 'operator',
                    fieldtype: 'Select',
                    label: 'Operator',
                    options: [
                        { value: '=', label: 'Equals' },
                        { value: '!=', label: 'Not Equals' },
                        { value: '>', label: 'Greater Than' },
                        { value: '>=', label: 'Greater Than or Equal' },
                        { value: '<', label: 'Less Than' },
                        { value: '<=', label: 'Less Than or Equal' },
                        { value: 'like', label: 'Contains' },
                        { value: 'not like', label: 'Does Not Contain' },
                        { value: 'in', label: 'In List' },
                        { value: 'between', label: 'Between' },
                        { value: 'is', label: 'Is Empty/Null' },
                        { value: 'is not', label: 'Is Not Empty/Null' }
                    ],
                    reqd: 1,
                    default: '=',
                    change: function() {
                        const operator = this.get_value();
                        const value_field = this.layout.get_field('value');
                        
                        // Hide value field for operators that don't need a value
                        if (operator === 'is' || operator === 'is not') {
                            value_field.df.reqd = 0;
                            value_field.df.hidden = 1;
                            value_field.set_value('');
                        } else {
                            value_field.df.reqd = 1;
                            value_field.df.hidden = 0;
                        }
                        value_field.refresh();
                    }
                },
                {
                    fieldname: 'value',
                    fieldtype: 'Data',
                    label: 'Value',
                    reqd: 1
                }
            ],
            primary_action_label: 'Add Filter',
            primary_action: (values) => {
                // Validate that value is provided for operators that need it
                if (!['is', 'is not'].includes(values.operator) && !values.value) {
                    frappe.msgprint('Please provide a value for this operator');
                    return;
                }
                this.add_filter_item(values);
                d.hide();
            }
        });

        d.show();
    }

    add_filter_item(filter_config) {
        // Find the field config
        const field = this.selected_fields.find(f => f.fieldname === filter_config.field);
        if (!field) return;

        // Add to filters array
        this.filters.push({
            field: filter_config.field,
            field_label: field.label,
            operator: filter_config.operator,
            value: filter_config.value,
            fieldtype: field.fieldtype
        });

        this.update_filters_display();
        
        // Update modal display if modal is open
        if (this.updating_modal && this.modal_dialog) {
            this.update_modal_filters_display();
            this.updating_modal = false;
        }
    }

    update_filters_display() {
        const container = $('#filters-container');
        
        if (this.filters.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 30px;">
                    <i class="fa fa-filter text-muted" style="font-size: 36px; opacity: 0.3;"></i>
                    <p class="text-muted">No filters added</p>
                    <small class="text-muted">Click "Add Filter" to filter your report data</small>
                </div>
            `);
        } else {
            container.empty();
            this.filters.forEach((filter, index) => {
                const filter_item = this.create_filter_item(filter, index);
                container.append(filter_item);
            });
        }
    }

    create_filter_item(filter, index) {
        const operator_labels = {
            '=': 'Equals',
            '!=': 'Not Equals', 
            '>': 'Greater Than',
            '>=': 'Greater Than or Equal',
            '<': 'Less Than',
            '<=': 'Less Than or Equal',
            'like': 'Contains',
            'not like': 'Does Not Contain',
            'in': 'In List',
            'between': 'Between'
        };

        return $(`
            <div class="filter-item" data-index="${index}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${filter.field_label}</strong>
                        <span class="text-muted">${operator_labels[filter.operator] || filter.operator}</span>
                        <code>${filter.value}</code>
                    </div>
                    <button class="btn btn-xs btn-danger remove-filter-btn">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `).find('.remove-filter-btn').on('click', () => {
            this.remove_filter(index);
        }).end();
    }

    remove_filter(index) {
        this.filters.splice(index, 1);
        this.update_filters_display();
    }

    show_sort_dialog() {
        let sort_fields = [...this.selected_fields];
        
        let d = new frappe.ui.Dialog({
            title: 'Add Sort',
            fields: [
                {
                    fieldname: 'field',
                    fieldtype: 'Select',
                    label: 'Field',
                    options: sort_fields.map(f => ({ value: f.fieldname, label: f.label })),
                    reqd: 1
                },
                {
                    fieldname: 'direction',
                    fieldtype: 'Select',
                    label: 'Sort Direction',
                    options: [
                        { value: 'asc', label: 'Ascending (A-Z, 1-9)' },
                        { value: 'desc', label: 'Descending (Z-A, 9-1)' }
                    ],
                    reqd: 1,
                    default: 'asc'
                }
            ],
            primary_action_label: 'Add Sort',
            primary_action: (values) => {
                this.add_sort_item(values);
                d.hide();
            }
        });

        d.show();
    }

    add_sort_item(sort_config) {
        // Find the field config
        const field = this.selected_fields.find(f => f.fieldname === sort_config.field);
        if (!field) return;

        // Remove existing sort for same field
        this.sort_config = this.sort_config.filter(s => s.field !== sort_config.field);

        // Add new sort
        this.sort_config.push({
            field: sort_config.field,
            field_label: field.label,
            direction: sort_config.direction
        });

        this.update_sort_display();
        
        // Update modal display if modal is open
        if (this.updating_modal && this.modal_dialog) {
            this.update_modal_sort_display();
            this.updating_modal = false;
        }
    }

    update_sort_display() {
        const container = $('#sort-container');
        
        if (this.sort_config.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 30px;">
                    <i class="fa fa-sort text-muted" style="font-size: 36px; opacity: 0.3;"></i>
                    <p class="text-muted">Default sort: Newest First</p>
                    <small class="text-muted">Click "Add Sort" to customize sort order</small>
                </div>
            `);
        } else {
            container.empty();
            this.sort_config.forEach((sort, index) => {
                const sort_item = this.create_sort_item(sort, index);
                container.append(sort_item);
            });
        }
    }

    create_sort_item(sort, index) {
        const direction_label = sort.direction === 'asc' ? 'Ascending' : 'Descending';
        const direction_icon = sort.direction === 'asc' ? 'fa-sort-amount-asc' : 'fa-sort-amount-desc';

        return $(`
            <div class="sort-item" data-index="${index}">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <i class="fa ${direction_icon}"></i>
                        <strong>${sort.field_label}</strong>
                        <span class="text-muted">${direction_label}</span>
                    </div>
                    <div>
                        <button class="btn btn-xs btn-default move-sort-up" ${index === 0 ? 'disabled' : ''}>
                            <i class="fa fa-chevron-up"></i>
                        </button>
                        <button class="btn btn-xs btn-default move-sort-down" ${index === this.sort_config.length - 1 ? 'disabled' : ''}>
                            <i class="fa fa-chevron-down"></i>
                        </button>
                        <button class="btn btn-xs btn-danger remove-sort-btn">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).find('.remove-sort-btn').on('click', () => {
            this.remove_sort(index);
        }).end().find('.move-sort-up').on('click', () => {
            this.move_sort(index, -1);
        }).end().find('.move-sort-down').on('click', () => {
            this.move_sort(index, 1);
        }).end();
    }

    remove_sort(index) {
        this.sort_config.splice(index, 1);
        this.update_sort_display();
    }

    move_sort(index, direction) {
        const new_index = index + direction;
        if (new_index >= 0 && new_index < this.sort_config.length) {
            [this.sort_config[index], this.sort_config[new_index]] = [this.sort_config[new_index], this.sort_config[index]];
            this.update_sort_display();
        }
    }

    create_enhanced_gallery_item(record, primary_gallery_field, all_gallery_fields, index) {
        console.log('Creating gallery item for record:', record.name, 'with', all_gallery_fields.length, 'gallery fields');
        
        // Collect all valid image URLs from all gallery fields
        const image_urls = [];
        const image_field_info = [];
        
        all_gallery_fields.forEach(field => {
            const raw_image_value = record[field.fieldname];
            console.log(`Gallery field ${field.fieldname} raw value:`, raw_image_value, 'type:', typeof raw_image_value);
            
            // Extract all image URLs from this field (handles both single and multiple images)
            const field_image_urls = this.extract_all_image_urls(raw_image_value);
            console.log(`Field ${field.fieldname} extracted ${field_image_urls.length} images:`, field_image_urls);
            
            // Add each image URL to our collection
            field_image_urls.forEach((url, index) => {
                if (url && url !== '/assets/frappe/images/default-avatar.png') {
                    image_urls.push(url);
                    image_field_info.push({
                        url: url,
                        field_name: field.fieldname,
                        field_label: field.label,
                        image_index: index, // Track which image in the field this is
                        raw_value: raw_image_value
                    });
                }
            });
        });
        
        // If no valid images, use default avatar
        if (image_urls.length === 0) {
            image_urls.push('/assets/frappe/images/default-avatar.png');
            image_field_info.push({
                url: '/assets/frappe/images/default-avatar.png',
                field_name: 'default',
                field_label: 'No Image',
                raw_value: null
            });
        }
        
        const title_field = this.selected_fields.find(f => 
            f.fieldname === 'title' || 
            f.fieldname === 'name' || 
            f.fieldtype === 'Data' && !f.is_gallery
        );
        const title = title_field ? record[title_field.fieldname] : record.name || 'Untitled';
        
        // Get non-image fields to display as metadata
        const metadata_fields = this.selected_fields.filter(f => 
            !f.is_gallery && 
            !['Attach Image', 'Attach'].includes(f.fieldtype) && 
            f.fieldname !== 'name'
        ).slice(0, 3); // Show max 3 metadata fields
        
        let metadata_html = '';
        metadata_fields.forEach(field => {
            const value = record[field.fieldname];
            if (value) {
                const display_label = field.custom_label || field.label;
                metadata_html += `
                    <div class="gallery-meta-item">
                        <span class="meta-label">${display_label}:</span>
                        <span class="meta-value">${this.format_field_value(value, field.fieldtype)}</span>
                    </div>
                `;
            }
        });
        
        // Create navigation arrows (only show if multiple images)
        const navigation_controls = image_urls.length > 1 ? `
            <div class="gallery-navigation">
                <button class="gallery-nav-btn gallery-prev-btn" title="Previous Image">
                    <i class="fa fa-chevron-left"></i>
                </button>
                <button class="gallery-nav-btn gallery-next-btn" title="Next Image">
                    <i class="fa fa-chevron-right"></i>
                </button>
            </div>
        ` : '';
        
        // Image counter/indicator
        const image_indicator = image_urls.length > 1 ? 
            `<div class="gallery-image-indicator">
                <span class="current-image">1</span> / <span class="total-images">${image_urls.length}</span>
            </div>` : '';
        
        const gallery_card = $(`
            <div class="gallery-card" data-record-name="${record.name}" data-index="${index}" data-current-image="0">
                <div class="gallery-image-wrapper">
                    <img src="${image_urls[0]}" alt="${title}" class="gallery-card-image" 
                         onerror="this.src='/assets/frappe/images/default-avatar.png'">
                    ${navigation_controls}
                    ${image_indicator}
                    <div class="gallery-overlay-actions">
                        <button class="btn btn-sm btn-primary gallery-action-btn" title="View Details">
                            <i class="fa fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-default gallery-action-btn" title="Quick Edit">
                            <i class="fa fa-edit"></i>
                        </button>
                    </div>
                </div>
                <div class="gallery-card-content">
                    <h6 class="gallery-card-title">${title}</h6>
                    <div class="gallery-metadata">
                        ${metadata_html}
                    </div>
                </div>
            </div>
        `);
        
        // Store image data for navigation
        gallery_card.data('images', image_field_info);
        gallery_card.data('imageUrls', image_urls);
        
        // Bind event handlers
        gallery_card.on('click', '.gallery-action-btn', (e) => {
            e.stopPropagation();
            const action = $(e.currentTarget).attr('title');
            if (action === 'View Details') {
                this.show_record_details(record);
            } else if (action === 'Quick Edit') {
                this.open_record_for_edit(record);
            }
        }).on('click', (e) => {
            // Don't show details if clicking on navigation buttons or their icons
            if (!$(e.target).hasClass('gallery-action-btn') && 
                !$(e.target).hasClass('gallery-nav-btn') &&
                !$(e.target).closest('.gallery-nav-btn').length &&
                !$(e.target).closest('.gallery-navigation').length &&
                !$(e.target).hasClass('fa-chevron-left') &&
                !$(e.target).hasClass('fa-chevron-right')) {
                this.show_record_details(record);
            }
        });
        
        // Bind navigation handlers
        if (image_urls.length > 1) {
            gallery_card.on('click', '.gallery-prev-btn', (e) => {
                console.log('Previous button clicked');
                e.stopPropagation();
                e.preventDefault();
                this.navigate_gallery_image(gallery_card, -1);
            }).on('click', '.gallery-next-btn', (e) => {
                console.log('Next button clicked');
                e.stopPropagation();
                e.preventDefault();
                this.navigate_gallery_image(gallery_card, 1);
            });
            
            // Also handle clicks on the icons inside the buttons
            gallery_card.on('click', '.gallery-prev-btn i, .gallery-next-btn i', (e) => {
                console.log('Navigation icon clicked');
                e.stopPropagation();
                e.preventDefault();
                const btn = $(e.target).closest('.gallery-nav-btn');
                if (btn.hasClass('gallery-prev-btn')) {
                    this.navigate_gallery_image(gallery_card, -1);
                } else if (btn.hasClass('gallery-next-btn')) {
                    this.navigate_gallery_image(gallery_card, 1);
                }
            });
        }
        
        return gallery_card;
    }

    async debug_gallery_field(record_name, field_name) {
        try {
            // Get the doctype name from current table
            let doctype_name = this.current_doctype;
            if (!doctype_name && this.current_table) {
                const table_response = await frappe.db.get_value('Flansa Table', this.current_table, 'doctype_name');
                doctype_name = table_response.message?.doctype_name;
            }
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.debug_gallery_field_data',
                args: {
                    doctype_name: doctype_name,
                    record_name: record_name,
                    field_name: field_name
                }
            });
            
            if (response.message && response.message.success) {
                console.log('=== DEBUG GALLERY FIELD DATA ===');
                console.log('Record:', response.message.record_name);
                console.log('Field:', response.message.field_name);
                console.log('Raw Value:', response.message.raw_value);
                console.log('Type:', response.message.raw_value_type);
                console.log('String representation:', response.message.raw_value_str);
                console.log('Repr:', response.message.raw_value_repr);
                console.log('================================');
                
                const analysis = response.message.analysis;
                let analysisHtml = '';
                if (analysis.is_json_array || analysis.is_list) {
                    analysisHtml = `
                        <div style="background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            <strong>📸 Multi-Image Field Detected!</strong><br>
                            Contains ${analysis.item_count} images
                        </div>
                    `;
                }
                
                frappe.msgprint(`
                    <h4>Gallery Field Debug: ${field_name}</h4>
                    <p><strong>Record:</strong> ${response.message.record_name}</p>
                    <p><strong>Type:</strong> ${response.message.raw_value_type}</p>
                    ${analysisHtml}
                    <p><strong>Raw Value:</strong><br><pre style="max-height: 200px; overflow-y: auto; background: #f5f5f5; padding: 10px; border-radius: 4px;">${response.message.raw_value_str}</pre></p>
                `);
            } else {
                console.error('Debug failed:', response.message);
            }
        } catch (error) {
            console.error('Error debugging gallery field:', error);
        }
    }

    navigate_gallery_image(gallery_card, direction) {
        console.log('navigate_gallery_image called with direction:', direction);
        
        const image_urls = gallery_card.data('imageUrls');
        const current_index = parseInt(gallery_card.data('current-image'));
        const total_images = image_urls.length;
        
        console.log('Current state:', { current_index, total_images, image_urls });
        
        // Calculate new index
        let new_index = current_index + direction;
        if (new_index < 0) {
            new_index = total_images - 1; // Wrap to last image
        } else if (new_index >= total_images) {
            new_index = 0; // Wrap to first image
        }
        
        console.log('New index calculated:', new_index);
        
        // Don't navigate if we're at the same image
        if (new_index === current_index) {
            console.log('Same image, not navigating');
            return;
        }
        
        // Add transition effect
        const img_element = gallery_card.find('.gallery-card-image');
        img_element.addClass('transitioning');
        
        console.log('Starting navigation to image:', image_urls[new_index]);
        
        // Update the image after a brief delay for transition effect
        setTimeout(() => {
            img_element.attr('src', image_urls[new_index]);
            
            // Update data attributes
            gallery_card.data('current-image', new_index);
            gallery_card.attr('data-current-image', new_index);
            
            // Update the indicator
            gallery_card.find('.current-image').text(new_index + 1);
            
            // Remove transition class
            setTimeout(() => {
                img_element.removeClass('transitioning');
            }, 100);
            
            console.log(`Successfully navigated to image ${new_index + 1} of ${total_images}`);
        }, 100);
    }

    open_record_for_edit(record) {
        // Get the doctype name for the current table
        frappe.db.get_value('Flansa Table', this.current_table, 'doctype_name')
        .then(r => {
            if (r.message && r.message.doctype_name) {
                frappe.set_route('Form', r.message.doctype_name, record.name);
            } else {
                frappe.msgprint('Cannot edit: DocType not found');
            }
        });
    }

    // Helper method to refresh reports maintaining current context
    refresh_reports_with_context() {
        if (this.filter_app) {
            this.load_saved_reports_for_app(this.filter_app);
        } else if (this.filter_table) {
            this.load_saved_reports(this.filter_table);
        } else {
            this.load_saved_reports();
        }
    }

    async load_saved_reports(filter_table = null) {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.get_user_reports',
                args: {
                    base_table: filter_table || undefined
                }
            });

            if (response.message) {
                await this.display_saved_reports(response.message, filter_table);
            }
        } catch (error) {
            console.error('Error loading saved reports:', error);
            this.show_reports_error();
        }
    }

    display_saved_reports(reports) {
        const container = $('#saved-reports-list');
        container.empty();

        if (reports.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 40px;">
                    <i class="fa fa-bookmark-o text-muted" style="font-size: 48px; opacity: 0.3;"></i>
                    <h4>No Saved Reports</h4>
                    <p class="text-muted">Create your first report to get started</p>
                    <button class="btn btn-primary" onclick="$('#create-new-report-btn').click()">
                        <i class="fa fa-plus"></i> Create New Report
                    </button>
                </div>
            `);
            return;
        }

        // Group reports by table
        const grouped_reports = {};
        reports.forEach(report => {
            if (!grouped_reports[report.base_table]) {
                grouped_reports[report.base_table] = [];
            }
            grouped_reports[report.base_table].push(report);
        });

        // Display grouped reports
        Object.keys(grouped_reports).forEach(table_name => {
            const table_reports = grouped_reports[table_name];
            const table_section = $(`
                <div class="report-table-group">
                    <h6 class="report-table-header">
                        <i class="fa fa-table"></i>
                        ${table_name}
                        <span class="badge">${table_reports.length}</span>
                    </h6>
                    <div class="report-table-items"></div>
                </div>
            `);

            const items_container = table_section.find('.report-table-items');
            table_reports.forEach(report => {
                const report_item = this.create_report_item(report);
                items_container.append(report_item);
            });

            container.append(table_section);
        });
    }

    create_report_item(report) {
        const type_icon = report.report_type === 'Gallery' ? 'fa-th' : 'fa-table';
        const public_badge = report.is_public ? '<span class="label label-info">Public</span>' : '';
        
        return $(`
            <div class="report-item" data-report-id="${report.name}">
                <div class="report-info">
                    <div class="report-header">
                        <i class="fa ${type_icon}"></i>
                        <strong>${report.report_title}</strong>
                        ${public_badge}
                    </div>
                    <div class="report-meta">
                        <small class="text-muted">
                            Created by ${report.created_by_user} • ${frappe.datetime.str_to_user(report.created_on)}
                            ${report.description ? '• ' + report.description : ''}
                        </small>
                    </div>
                </div>
                <div class="report-actions">
                    <button class="btn btn-xs btn-primary report-action-btn" data-action="load" title="Load Report">
                        <i class="fa fa-play"></i>
                    </button>
                    <button class="btn btn-xs btn-default report-action-btn" data-action="edit" title="Edit Report">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-default report-action-btn" data-action="duplicate" title="Duplicate Report">
                        <i class="fa fa-copy"></i>
                    </button>
                    <button class="btn btn-xs btn-danger report-action-btn" data-action="delete" title="Delete Report">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `);
    }

    show_reports_error() {
        $('#saved-reports-list').html(`
            <div class="text-center" style="padding: 40px;">
                <i class="fa fa-exclamation-triangle text-warning" style="font-size: 48px;"></i>
                <h4>Failed to Load Reports</h4>
                <p class="text-muted">There was an error loading your saved reports</p>
                <button class="btn btn-default" onclick="window.report_builder.refresh_reports_with_context()">
                    <i class="fa fa-refresh"></i> Try Again
                </button>
            </div>
        `);
    }

    create_new_report() {
        // Reset report state for new report
        this.reset_report_state();
        
        // Check for URL parameters to determine if this is localized mode
        const urlParams = new URLSearchParams(window.location.search);
        const table_id = urlParams.get('table');
        
        if (table_id) {
            // Set localized state
            this.preselected_table = table_id;
            this.is_localized = true;
            console.log('Create new report in localized mode for table:', table_id);
        }
        
        // Open report builder modal
        this.show_report_builder_modal('Create New Report', false);
    }

    async load_saved_report(report_id) {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { report_id: report_id }
            });

            if (response.message && response.message.success) {
                const report = response.message.report;
                
                // Load the report configuration
                this.current_table = report.base_table;
                this.selected_fields = report.config.selected_fields || [];
                this.filters = report.config.filters || [];
                this.sort_config = report.config.sort || [];
                this.current_report_id = report.id;
                this.current_report_title = report.title;
                
                // Load available fields for the table but DON'T reset state
                await this.select_table(report.base_table, false);
                
                // Show report builder modal in edit mode
                this.show_report_builder_modal(`Edit Report: ${report.title}`, true);
                
                frappe.show_alert(`Report "${report.title}" loaded for editing`, 'green');
                
            } else {
                frappe.msgprint({
                    title: 'Load Failed',
                    message: response.message.error || 'Failed to load report',
                    indicator: 'red'
                });
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load report: ' + error.message,
                indicator: 'red'
            });
        }
    }

    async load_saved_report_for_viewing(report_id) {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { report_id: report_id }
            });

            if (response.message && response.message.success) {
                const report = response.message.report;
                console.log('Loading saved report for viewing:', report);
                
                // Load the report configuration
                this.current_table = report.base_table;
                this.current_report_id = report.id;
                this.current_report_title = report.title;
                
                // Pre-set the saved configuration
                this.selected_fields = report.config.selected_fields || [];
                this.filters = report.config.filters || [];
                this.sort_config = report.config.sort || [];
                
                // Load view options if available
                if (report.view_options) {
                    this.current_view = report.view_options.view_type || 'table';
                    this.page_size = report.view_options.page_size || 20;
                }
                
                // Load available fields for the table but DON'T reset state
                await this.select_table(report.base_table, false);
                
                console.log('Loaded configuration - fields:', this.selected_fields.length, 'filters:', this.filters.length);
                
                // Run the report immediately
                await this.run_report();
                
                frappe.show_alert(`Report "${report.title}" loaded and executed`, 'green');
                
            } else {
                frappe.msgprint({
                    title: 'Load Failed',
                    message: response.message.error || 'Failed to load report',
                    indicator: 'red'
                });
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load report: ' + error.message,
                indicator: 'red'
            });
        }
    }

    handle_report_action(action, report_id) {
        switch (action) {
            case 'load':
                // Navigate to dedicated report viewer
                window.location.href = `/app/flansa-report-viewer/${report_id}`;
                break;
            case 'edit':
                // Navigate to report builder in edit mode
                window.location.href = `/app/flansa-report-builder?edit=${report_id}`;
                break;
            case 'duplicate':
                this.duplicate_report(report_id);
                break;
            case 'delete':
                this.delete_report(report_id);
                break;
        }
    }

    async duplicate_report(report_id) {
        frappe.confirm('Duplicate this report?', async () => {
            // Load the original report and save as new
            await this.load_saved_report(report_id);
            setTimeout(() => {
                this.save_report();
            }, 1000);
        });
    }

    delete_report(report_id) {
        frappe.confirm('Are you sure you want to delete this report?', () => {
            frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: 'Flansa Saved Report',
                    name: report_id
                },
                callback: (r) => {
                    if (!r.exc) {
                        frappe.show_alert('Report deleted successfully', 'green');
                        this.refresh_reports_with_context(); // Refresh list
                    }
                }
            });
        });
    }

    async setup_localized_view(table_id) {
        console.log('Setting up localized view for table:', table_id);
        
        // Hide the table selection section if localized
        if (this.is_localized) {
            // Find the table selection section (after saved reports)
            $('.section-card').eq(1).find('h4').html(`<i class="fa fa-database"></i> Selected Table`);
            $('.section-card').eq(1).find('small').text(`Building report for: ${table_id}`);
            $('#table-selector').closest('.form-group').hide();
            
            // Show table info directly
            try {
                const table_doc = await frappe.db.get_doc('Flansa Table', table_id);
                $('#table-info').show();
                $('#selected-table-name').text(table_doc.table_label || table_id);
                $('#selected-table-details').text(`Table: ${table_id} | Status: ${table_doc.status}`);
                
                // Update page title to show context
                $('.page-title').html(`
                    <i class="fa fa-chart-bar" style="margin-right: 8px; color: var(--flansa-primary, #007bff);"></i>
                    Report Builder: ${table_doc.table_label || table_id}
                `);
                $('.page-subtitle').text(`Create reports for ${table_doc.table_label || table_id} table`);
                
                // Show back button
                $('#back-to-builder-btn').show();
            } catch (error) {
                console.error('Error loading table info:', error);
            }
        }
        
        // Auto-select and load the table
        this.current_table = table_id;
        await this.select_table(table_id);
        
        // Show success message
        frappe.show_alert({
            message: `Report Builder ready for table: ${table_id}`,
            indicator: 'green'
        });
        
        // Filter saved reports to show only reports for this table
        await this.load_saved_reports(table_id);
        
        // Auto-scroll to field selection
        setTimeout(() => {
            $('html, body').animate({
                scrollTop: $('#field-selection-section').offset().top - 100
            }, 800);
        }, 1000);
    }

    async load_saved_reports(filter_table = null) {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.get_user_reports',
                args: {
                    base_table: filter_table || undefined
                }
            });

            if (response.message) {
                await this.display_saved_reports(response.message, filter_table);
            }
        } catch (error) {
            console.error('Error loading saved reports:', error);
            this.show_reports_error();
        }
    }

    async load_saved_reports_for_app(app_name) {
        try {
            // First get all tables for this application
            const tables_response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    filters: { application: app_name },
                    fields: ['name'],
                    limit_page_length: 500
                }
            });

            if (tables_response.message && tables_response.message.length > 0) {
                // Get all reports for these tables
                const table_names = tables_response.message.map(t => t.name);
                
                const reports_response = await frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'Flansa Saved Report',
                        filters: [['base_table', 'in', table_names]],
                        fields: ['*'],
                        limit_page_length: 500
                    }
                });

                if (reports_response.message) {
                    // Update banner with app name
                    const app_details = await frappe.db.get_value('Flansa Application', app_name, 'app_title');
                    if (app_details && app_details.message) {
                        const app_title = app_details.message.app_title || app_name;
                        $('#banner-title').text(`${app_title} Reports`);
                        // Subtitle removed for compact design
                        // $('#banner-subtitle').text(`All reports for tables in ${app_title}`);
                        $('.page-title span').text(`Report Builder - ${app_title}`);
                    }
                    
                    await this.display_saved_reports(reports_response.message, null, app_name);
                } else {
                    await this.display_saved_reports([], null, app_name);
                }
            } else {
                // No tables in this app
                await this.display_saved_reports([], null, app_name);
            }
        } catch (error) {
            console.error('Error loading reports for app:', error);
            this.show_reports_error();
        }
    }

    async display_saved_reports(reports, filter_table = null, filter_app = null) {
        const container = $('#saved-reports-list');
        container.empty();

        if (reports.length === 0) {
            let empty_text = 'No Saved Reports';
            let empty_subtitle = 'Create your first report to get started';
            
            if (filter_app) {
                empty_text = 'No Reports for this Application';
                empty_subtitle = 'Create reports for tables in this application';
            } else if (filter_table) {
                // Fetch table label for display
                let table_display_name = filter_table;
                try {
                    const table_response = await frappe.db.get_value('Flansa Table', filter_table, 'table_label');
                    if (table_response && table_response.table_label) {
                        table_display_name = table_response.table_label;
                    }
                } catch (error) {
                    console.log('Could not fetch table label, using internal name');
                }
                
                empty_text = `No Saved Reports for ${table_display_name}`;
                empty_subtitle = 'Create your first report for this table';
            }
            
            container.html(`
                <div class="empty-state text-center" style="padding: 40px;">
                    <i class="fa fa-bookmark-o text-muted" style="font-size: 48px; opacity: 0.3;"></i>
                    <h4>${empty_text}</h4>
                    <p class="text-muted">${empty_subtitle}</p>
                    <button class="btn btn-primary" onclick="$('#create-new-report-btn').click()">
                        <i class="fa fa-plus"></i> Create New Report
                    </button>
                </div>
            `);
            return;
        }

        // Update section header with report count
        await this.update_reports_header_count(reports.length, filter_table || filter_app);
        
        // If filtering by table, show flat list; otherwise group by table
        if (filter_table) {
            // Show flat list for single table
            reports.forEach(report => {
                const report_item = this.create_report_item(report);
                container.append(report_item);
            });
        } else {
            // Group reports by table (original behavior)
            const grouped_reports = {};
            reports.forEach(report => {
                if (!grouped_reports[report.base_table]) {
                    grouped_reports[report.base_table] = [];
                }
                grouped_reports[report.base_table].push(report);
            });

            // Display grouped reports
            Object.keys(grouped_reports).forEach(table_name => {
                const table_reports = grouped_reports[table_name];
                const table_section = $(`
                    <div class="report-table-group">
                        <h6 class="report-table-header">
                            <i class="fa fa-table"></i>
                            ${table_name}
                            <span class="badge">${table_reports.length}</span>
                        </h6>
                        <div class="report-table-items"></div>
                    </div>
                `);

                const items_container = table_section.find('.report-table-items');
                table_reports.forEach(report => {
                    const report_item = this.create_report_item(report);
                    items_container.append(report_item);
                });

                container.append(table_section);
            });
        }
    }

    extract_all_image_urls(image_value) {
        /**
         * Extract all image URLs from a field value that might contain multiple images
         * Returns array of image URLs
         */
        console.log('extract_all_image_urls called with:', image_value, 'Type:', typeof image_value);
        
        if (!image_value) {
            return [];
        }
        
        let processed_value = image_value;
        
        // Handle different data formats that might be returned
        if (typeof image_value === 'object') {
            console.log('Image value is object:', image_value);
            // If it's an array, process each element
            if (Array.isArray(image_value)) {
                const urls = [];
                image_value.forEach((item, index) => {
                    const url = this.get_single_image_url(item);
                    if (url && url !== '/assets/frappe/images/default-avatar.png') {
                        urls.push(url);
                    }
                });
                console.log('Extracted URLs from array:', urls);
                return urls;
            }
            // If it's a single object, treat as single image
            else {
                const url = this.get_single_image_url(image_value);
                return url && url !== '/assets/frappe/images/default-avatar.png' ? [url] : [];
            }
        }
        
        // Convert to string and process
        processed_value = String(processed_value).trim();
        
        // Handle JSON strings that contain arrays
        if (processed_value.startsWith('[') && processed_value.endsWith(']')) {
            try {
                const parsed = JSON.parse(processed_value);
                console.log('Parsed JSON array:', parsed);
                if (Array.isArray(parsed)) {
                    const urls = [];
                    parsed.forEach((item, index) => {
                        console.log(`Processing array item ${index}:`, item);
                        const url = this.get_single_image_url(item);
                        if (url && url !== '/assets/frappe/images/default-avatar.png') {
                            urls.push(url);
                        }
                    });
                    console.log('Final extracted URLs:', urls);
                    return urls;
                }
            } catch (e) {
                console.log('Failed to parse as JSON array:', e.message);
            }
        }
        
        // Handle single image case
        const single_url = this.get_single_image_url(processed_value);
        return single_url && single_url !== '/assets/frappe/images/default-avatar.png' ? [single_url] : [];
    }

    get_single_image_url(image_value) {
        /**
         * Extract a single image URL from various formats
         */
        if (!image_value) {
            return '/assets/frappe/images/default-avatar.png';
        }
        
        // If it's an object, extract file_url
        if (typeof image_value === 'object') {
            return image_value.file_url || image_value.url || image_value.name || '/assets/frappe/images/default-avatar.png';
        }
        
        // Convert to string and process
        const str_value = String(image_value).trim();
        
        // Handle JSON object strings
        if (str_value.startsWith('{') && str_value.endsWith('}')) {
            try {
                const parsed = JSON.parse(str_value);
                return parsed.file_url || parsed.url || parsed.name || '/assets/frappe/images/default-avatar.png';
            } catch (e) {
                // Try regex extraction for Python-style dicts
                const fileUrlMatch = str_value.match(/'file_url':\s*'([^']+)'/);
                if (fileUrlMatch) {
                    return fileUrlMatch[1];
                }
            }
        }
        
        // Handle direct file paths
        if (str_value.startsWith('http://') || str_value.startsWith('https://')) {
            return str_value;
        } else if (str_value.startsWith('/files/')) {
            return `${window.location.origin}${str_value}`;
        } else if (str_value.startsWith('/')) {
            return `${window.location.origin}${str_value}`;
        } else {
            return `${window.location.origin}/files/${str_value}`;
        }
    }

    get_full_image_url(image_value) {
        console.log('get_full_image_url called with:', image_value, 'Type:', typeof image_value);
        
        if (!image_value) {
            console.log('No image value, using default avatar');
            return '/assets/frappe/images/default-avatar.png';
        }
        
        let processed_value = image_value;
        
        // Handle different data formats that might be returned
        if (typeof image_value === 'object') {
            console.log('Image value is object:', image_value);
            // If it's an array, take the first element
            if (Array.isArray(image_value)) {
                processed_value = image_value.length > 0 ? image_value[0] : null;
                console.log('Extracted from array:', processed_value);
            }
            // If it's an object with common file properties
            else if (image_value.file_url) {
                processed_value = image_value.file_url;
                console.log('Extracted file_url:', processed_value);
            }
            else if (image_value.url) {
                processed_value = image_value.url;
                console.log('Extracted url:', processed_value);
            }
            else if (image_value.name) {
                processed_value = image_value.name;
                console.log('Extracted name:', processed_value);
            }
            // Convert object to string and try to parse
            else {
                processed_value = String(image_value);
                console.log('Converted object to string:', processed_value);
            }
        }
        
        // If still no valid value
        if (!processed_value || processed_value === 'null' || processed_value === 'undefined') {
            console.log('No valid processed value, using default avatar');
            return '/assets/frappe/images/default-avatar.png';
        }
        
        // Convert to string and trim
        processed_value = String(processed_value).trim();
        
        // Handle JSON strings and Python-style object strings that might be embedded
        if (processed_value.startsWith('[') || processed_value.startsWith('{')) {
            try {
                // First try parsing as JSON
                const parsed = JSON.parse(processed_value);
                console.log('Parsed JSON:', parsed);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    processed_value = parsed[0];
                } else if (typeof parsed === 'object' && (parsed.file_url || parsed.url || parsed.name)) {
                    processed_value = parsed.file_url || parsed.url || parsed.name;
                }
                console.log('Extracted from JSON:', processed_value);
            } catch (e) {
                console.log('Failed to parse as JSON:', e.message);
                // Try to handle Python-style dict string (with single quotes)
                try {
                    // Look for file_url pattern in the string
                    const fileUrlMatch = processed_value.match(/'file_url':\s*'([^']+)'/);
                    if (fileUrlMatch) {
                        processed_value = fileUrlMatch[1];
                        console.log('Extracted file_url from Python-style dict:', processed_value);
                    } else {
                        // Try to extract name field as fallback
                        const nameMatch = processed_value.match(/'name':\s*'([^']+)'/);
                        if (nameMatch) {
                            processed_value = `/files/${nameMatch[1]}`;
                            console.log('Extracted name from Python-style dict:', processed_value);
                        } else {
                            console.log('Could not extract any file path from object string');
                            return '/assets/frappe/images/default-avatar.png';
                        }
                    }
                } catch (e2) {
                    console.log('Failed to parse as Python dict:', e2.message);
                    return '/assets/frappe/images/default-avatar.png';
                }
            }
        }
        
        let full_url;
        // Handle different image URL formats
        if (processed_value.startsWith('http://') || processed_value.startsWith('https://')) {
            // Already a full URL
            full_url = processed_value;
        } else if (processed_value.startsWith('/files/')) {
            // Frappe file path - convert to full URL
            full_url = `${window.location.origin}${processed_value}`;
        } else if (processed_value.startsWith('/')) {
            // Absolute path - convert to full URL
            full_url = `${window.location.origin}${processed_value}`;
        } else {
            // Relative path or filename - assume it's in /files/
            full_url = `${window.location.origin}/files/${processed_value}`;
        }
        
        console.log('Final image URL conversion:', image_value, '->', full_url);
        return full_url;
    }

    show_report_builder_modal(title, is_edit_mode = false) {
        // Close any existing modal
        if (this.modal_dialog) {
            this.modal_dialog.hide();
            // Clean up event handlers
            $('body').off('.modal_events');
            $(document).off('.modal_events');
        }

        // Create modal dialog
        this.modal_dialog = new frappe.ui.Dialog({
            title: title,
            size: 'extra-large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'report_builder_html',
                    options: this.get_modal_html()
                }
            ],
            primary_action_label: 'Preview Report',
            primary_action: () => {
                this.run_report_from_modal(is_edit_mode);
            },
            secondary_action_label: 'Save Report',
            secondary_action: () => {
                this.save_report_from_modal(is_edit_mode);
            },
            onhide: () => {
                // Clean up event handlers when modal is closed
                console.log('Modal closing, cleaning up event handlers');
                $('body').off('.modal_events');
                $(document).off('.modal_events');
            }
        });

        this.modal_dialog.show();

        // Initialize modal content after DOM is ready
        // Use a longer timeout to ensure modal DOM is fully rendered
        setTimeout(async () => {
            console.log('Modal DOM ready, setting up content...');
            await this.setup_modal_content(is_edit_mode);
        }, 300);
    }

    get_modal_html() {
        return `
            <div class="report-builder-modal-content">
                <!-- Table Selection Section -->
                <div class="modal-section" id="modal-table-section">
                    <h5><i class="fa fa-database"></i> Select Table</h5>
                    <div class="form-group">
                        <select class="form-control" id="modal-table-selector" style="max-width: 300px;">
                            <option value="">-- Select a Table --</option>
                        </select>
                    </div>
                    <div id="modal-table-info" class="table-info" style="display: none;">
                        <div class="info-card">
                            <h6 id="modal-selected-table-name"></h6>
                            <p id="modal-selected-table-details" class="text-muted"></p>
                        </div>
                    </div>
                </div>

                <!-- Field Selection Section -->
                <div class="modal-section" id="modal-field-section" style="display: none;">
                    <h5><i class="fa fa-columns"></i> Select Fields</h5>
                    <div class="row">
                        <!-- Available Fields -->
                        <div class="col-md-5">
                            <h6>Available Fields</h6>
                            <div class="field-search-box">
                                <input type="text" class="form-control" id="modal-field-search" placeholder="Search fields...">
                            </div>
                            <div class="field-categories" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
                                <!-- Current Table Fields -->
                                <div class="field-category">
                                    <div class="category-header" data-toggle="collapse" data-target="#modal-current-fields" aria-expanded="true">
                                        <i class="fa fa-chevron-down"></i>
                                        <strong>Current Table Fields</strong>
                                        <span class="badge" id="modal-current-fields-count">0</span>
                                    </div>
                                    <div id="modal-current-fields" class="field-list collapse in"></div>
                                </div>
                                
                                <!-- System Fields -->
                                <div class="field-category">
                                    <div class="category-header" data-toggle="collapse" data-target="#modal-system-fields" aria-expanded="false">
                                        <i class="fa fa-chevron-right"></i>
                                        <strong>System Fields</strong>
                                        <span class="badge" id="modal-system-fields-count">0</span>
                                    </div>
                                    <div id="modal-system-fields" class="field-list collapse"></div>
                                </div>
                                
                                <!-- Related Fields -->
                                <div class="field-category">
                                    <div class="category-header" data-toggle="collapse" data-target="#modal-related-fields" aria-expanded="false">
                                        <i class="fa fa-chevron-right"></i>
                                        <strong>Related Fields</strong>
                                        <span class="badge" id="modal-related-fields-count">0</span>
                                    </div>
                                    <div id="modal-related-fields" class="field-list collapse"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Transfer Buttons -->
                        <div class="col-md-2 text-center" style="padding-top: 100px;">
                            <button class="btn btn-flansa-primary btn-sm transfer-btn" id="modal-add-field-btn" disabled>
                                <i class="fa fa-chevron-right"></i>
                            </button>
                            <button class="btn btn-default btn-sm transfer-btn" id="modal-add-all-btn">
                                <i class="fa fa-chevron-double-right"></i>
                            </button>
                            <button class="btn btn-default btn-sm transfer-btn" id="modal-remove-field-btn" disabled>
                                <i class="fa fa-chevron-left"></i>
                            </button>
                            <button class="btn btn-default btn-sm transfer-btn" id="modal-remove-all-btn">
                                <i class="fa fa-chevron-double-left"></i>
                            </button>
                        </div>

                        <!-- Selected Fields -->
                        <div class="col-md-5">
                            <h6>Selected Fields <span class="badge" id="modal-selected-fields-count">0</span></h6>
                            <div id="modal-selected-fields" class="selected-field-list" style="min-height: 200px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
                                <div class="empty-state text-center" style="padding: 40px;">
                                    <i class="fa fa-columns text-muted" style="font-size: 36px; opacity: 0.3;"></i>
                                    <p class="text-muted">No fields selected yet</p>
                                    <small class="text-muted">Select fields from the left panel</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Filters and Sort Section -->
                <div class="modal-section" id="modal-filters-section" style="display: none;">
                    <h5><i class="fa fa-filter"></i> Filters & Sorting</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0">Filters</h6>
                                <button class="btn btn-xs btn-flansa-primary" id="modal-add-filter-btn">
                                    <i class="fa fa-plus"></i> Add Filter
                                </button>
                            </div>
                            <div id="modal-filters-container" style="min-height: 100px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; background: white;">
                                <div class="empty-state text-center" style="padding: 30px;">
                                    <i class="fa fa-filter text-muted" style="font-size: 24px; opacity: 0.3;"></i>
                                    <p class="text-muted mb-0">No filters added</p>
                                    <small class="text-muted">Click "Add Filter" to filter your report data</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0">Sorting</h6>
                                <button class="btn btn-xs btn-flansa-primary" id="modal-add-sort-btn">
                                    <i class="fa fa-plus"></i> Add Sort
                                </button>
                            </div>
                            <div id="modal-sort-container" style="min-height: 100px; max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; background: white;">
                                <div class="empty-state text-center" style="padding: 30px;">
                                    <i class="fa fa-sort text-muted" style="font-size: 24px; opacity: 0.3;"></i>
                                    <p class="text-muted mb-0">Default: Newest First</p>
                                    <small class="text-muted">Click "Add Sort" to customize sort order</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
            .report-builder-modal-content .modal-section {
                margin-bottom: 20px;
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #f9f9f9;
            }
            .report-builder-modal-content .modal-section h5 {
                margin-top: 0;
                color: #333;
                border-bottom: 1px solid #ddd;
                padding-bottom: 8px;
            }
            .report-builder-modal-content .field-categories {
                background: white;
            }
            .report-builder-modal-content .field-category {
                border-bottom: 1px solid #eee;
            }
            .report-builder-modal-content .category-header {
                padding: 10px 15px;
                background: #f8f9fa;
                cursor: pointer;
                font-weight: 500;
            }
            .report-builder-modal-content .category-header:hover {
                background: #e9ecef;
            }
            .report-builder-modal-content .field-item {
                padding: 8px 15px;
                cursor: pointer;
                border-bottom: 1px solid #f0f0f0;
            }
            .report-builder-modal-content .field-item:hover {
                background: #f8f9fa;
            }
            .report-builder-modal-content .field-item.selected {
                background: #e3f2fd;
            }
            .report-builder-modal-content .selected-field-list {
                background: white;
            }
            .report-builder-modal-content .selected-field-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid #eee;
                background: white;
            }
            .report-builder-modal-content .selected-field-item:hover {
                background: #f8f9fa;
            }
            .report-builder-modal-content .transfer-btn {
                display: block;
                margin: 5px auto;
                width: 40px;
            }
            .report-builder-modal-content .info-card {
                background: #e8f4fd;
                border: 1px solid #bee5eb;
                border-radius: 4px;
                padding: 15px;
                margin-top: 10px;
            }
            </style>
        `;
    }

    async setup_modal_content(is_edit_mode) {
        console.log('setup_modal_content called, is_edit_mode:', is_edit_mode, 'is_localized:', this.is_localized, 'preselected_table:', this.preselected_table);
        
        // Set up event handlers for modal elements first
        this.bind_modal_events();
        
        // Populate table selector and wait for it to complete
        await this.populate_modal_table_selector();
        
        // If localized mode, pre-select table and hide selection
        if (this.is_localized && this.preselected_table) {
            console.log('Setting up localized mode for table:', this.preselected_table);
            const selector = $('#modal-table-selector');
            console.log('Selector option count before setting value:', selector.find('option').length);
            
            selector.val(this.preselected_table);
            console.log('Set selector value to:', this.preselected_table, 'Current value:', selector.val());
            
            await this.select_modal_table(this.preselected_table);
            $('#modal-table-section').hide(); // Hide table selection in localized mode
            
            // Show field selection and filters sections immediately
            $('#modal-field-section').show();
            $('#modal-filters-section').show();
            
        } else if (is_edit_mode && this.current_table) {
            console.log('Setting up edit mode for table:', this.current_table);
            // Edit mode - select the saved table and hide table selection
            $('#modal-table-selector').val(this.current_table);
            await this.select_modal_table(this.current_table);
            $('#modal-table-section').hide(); // Hide table selection in edit mode too
            
            // Show field selection and filters sections immediately
            $('#modal-field-section').show();
            $('#modal-filters-section').show();
        } else {
            console.log('Standard mode - showing table selection');
        }
        
        // If edit mode, update displays after table is loaded
        if (is_edit_mode) {
            setTimeout(() => {
                // Update all displays for edit mode
                this.update_modal_selected_fields_display();
                this.update_modal_filters_display();
                this.update_modal_sort_display();
                this.update_modal_transfer_buttons();
                console.log('Edit mode displays updated');
            }, 500);
        }
    }

    async populate_modal_table_selector() {
        const selector = $('#modal-table-selector');
        console.log('populate_modal_table_selector called, selector found:', selector.length);
        
        if (selector.length === 0) {
            console.warn('Modal table selector not found in DOM yet');
            return;
        }
        
        selector.empty().append('<option value="">-- Select a Table --</option>');
        
        try {
            // Load tables
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    fields: ['name', 'table_label', 'table_name', 'status'],
                    filters: {status: 'Active'},
                    order_by: 'table_label'
                }
            });

            if (response.message) {
                response.message.forEach(table => {
                    selector.append(`<option value="${table.name}">${table.table_label || table.table_name}</option>`);
                });
                console.log(`Loaded ${response.message.length} tables into modal selector. Final option count:`, selector.find('option').length);
                
                // Debug: log the actual options
                selector.find('option').each(function(i, option) {
                    console.log(`Option ${i}: value="${option.value}", text="${option.text}"`);
                });
            } else {
                console.warn('No tables returned from API');
            }
        } catch (error) {
            console.error('Error loading tables for modal:', error);
            frappe.msgprint('Failed to load tables for report builder');
        }
    }

    bind_modal_events() {
        const self = this;
        
        // Clear any existing event handlers to prevent duplication
        $(document).off('click.modal_events change.modal_events input.modal_events');
        
        // Table selection
        $(document).on('change.modal_events', '#modal-table-selector', (e) => {
            const table_name = e.target.value;
            if (table_name) {
                this.select_modal_table(table_name);
            }
        });

        // Field selection events - Fixed to work properly with Frappe modal
        // Use body delegation since modal is dynamically created
        $('body').on('click.modal_events', '.modal .field-item', function(e) {
            console.log('Field item clicked in modal');
            e.stopPropagation();
            e.preventDefault();
            
            const field_item = $(this);
            const fieldname = field_item.data('fieldname');
            console.log('Field:', fieldname);
            
            // Toggle selection
            field_item.toggleClass('selected');
            
            // Update button states
            self.update_modal_transfer_buttons();
            
            return false; // Prevent any bubbling
        });

        $('body').on('click.modal_events', '.modal .selected-field-item', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            const field_item = $(this);
            field_item.toggleClass('selected');
            self.update_modal_transfer_buttons();
            console.log('Modal selected field clicked:', field_item.data('fieldname'), 'selected:', field_item.hasClass('selected'));
            
            return false; // Prevent any bubbling
        });

        // Transfer buttons - Fixed with proper event handling
        $('body').on('click.modal_events', '#modal-add-field-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add field button clicked');
            this.modal_add_selected_fields();
            return false;
        });
        
        $('body').on('click.modal_events', '#modal-add-all-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add all fields button clicked');
            this.modal_add_all_fields();
            return false;
        });
        
        $('body').on('click.modal_events', '#modal-remove-field-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Remove field button clicked');
            this.modal_remove_selected_fields();
            return false;
        });
        
        $('body').on('click.modal_events', '#modal-remove-all-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Remove all fields button clicked');
            this.modal_remove_all_fields();
            return false;
        });

        // Field search
        $('body').on('input.modal_events', '#modal-field-search', (e) => {
            this.modal_filter_fields(e.target.value.toLowerCase());
        });

        // Filter and sort buttons
        $('body').on('click.modal_events', '#modal-add-filter-btn', (e) => {
            e.preventDefault();
            this.modal_add_filter();
        });
        
        $('body').on('click.modal_events', '#modal-add-sort-btn', (e) => {
            e.preventDefault();
            this.modal_add_sort();
        });
    }

    async select_modal_table(table_name) {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.get_report_field_options',
                args: { table_name: table_name }
            });

            if (response.message && response.message.success) {
                this.current_table = table_name;
                this.available_fields = response.message.fields;
                this.populate_modal_available_fields();
                this.update_modal_selected_fields_display();
                
                // Show table info
                const table_doc = await frappe.db.get_doc('Flansa Table', table_name);
                $('#modal-table-info').show();
                $('#modal-selected-table-name').text(table_doc.table_label || table_name);
                $('#modal-selected-table-details').text(`Table: ${table_name} | Status: ${table_doc.status}`);
                
                // Show field selection section
                $('#modal-field-section').show();
                $('#modal-filters-section').show();
            }
        } catch (error) {
            frappe.msgprint('Failed to load table fields: ' + error.message);
        }
    }

    populate_modal_available_fields() {
        console.log('populate_modal_available_fields called with fields:', this.available_fields);
        
        // Current table fields
        const current_container = $('#modal-current-fields');
        console.log('Current fields container found:', current_container.length);
        current_container.empty();
        
        if (this.available_fields.current.length > 0) {
            console.log('Creating field items for', this.available_fields.current.length, 'current fields');
            this.available_fields.current.forEach(field => {
                const field_item = this.create_modal_field_item(field);
                console.log('Created field item:', field_item, 'for field:', field.fieldname);
                current_container.append(field_item);
            });
        } else {
            console.log('No current fields available');
        }
        $('#modal-current-fields-count').text(this.available_fields.current.length);

        // System fields
        const system_container = $('#modal-system-fields');
        system_container.empty();
        
        if (this.available_fields.system && this.available_fields.system.length > 0) {
            this.available_fields.system.forEach(field => {
                const field_item = this.create_modal_field_item(field);
                system_container.append(field_item);
            });
        } else {
            system_container.html('<div class="text-muted" style="padding: 15px;">No system fields available</div>');
        }
        $('#modal-system-fields-count').text(this.available_fields.system ? this.available_fields.system.length : 0);

        // Related fields (grouped by link field)
        const related_container = $('#modal-related-fields');
        related_container.empty();
        
        if (this.available_fields.related_groups && this.available_fields.related_groups.length > 0) {
            this.available_fields.related_groups.forEach(group => {
                // Create group header
                const group_header = $(`
                    <div class="related-field-group" style="margin-bottom: 10px;">
                        <div class="group-header" style="background: #f0f8ff; padding: 6px 10px; font-weight: 600; color: #0066cc; border-radius: 4px; margin-bottom: 3px; font-size: 12px;">
                            <i class="fa fa-link"></i> ${group.link_field_label} → ${group.target_table_label}
                        </div>
                        <div class="group-fields"></div>
                    </div>
                `);
                
                const group_fields_container = group_header.find('.group-fields');
                group.fields.forEach(field => {
                    const field_item = this.create_modal_field_item(field);
                    group_fields_container.append(field_item);
                });
                
                related_container.append(group_header);
            });
        } else {
            related_container.html('<div class="text-muted" style="padding: 15px;">No related fields available<br><small>Add Link fields to access related table data</small></div>');
        }
        
        const total_related = this.available_fields.related ? this.available_fields.related.length : 0;
        $('#modal-related-fields-count').text(total_related);
    }

    create_modal_field_item(field) {
        const icon = this.get_field_icon(field.fieldtype);
        const gallery_badge = field.is_gallery ? '<span class="label label-info">Gallery</span>' : '';
        const logic_badge = field.is_logic_field ? `<span class="label label-success">${field.logic_type}</span>` : '';
        const system_badge = field.is_system_field ? '<span class="label label-warning">System</span>' : '';
        const is_selected = this.is_field_selected(field.fieldname);
        
        const category_info = field.category === 'related' ? 
            `<small class="text-info"><i class="fa fa-link"></i> ${field.table_label}</small>` :
            field.category === 'system' ? 
            `<small class="text-warning"><i class="fa fa-cog"></i> System</small>` :
            field.category === 'parent' ? 
            `<small class="text-info">${field.table_label}</small>` : '';
        
        const field_item = $(`
            <div class="field-item ${is_selected ? 'selected' : ''}" 
                 data-fieldname="${field.fieldname}" 
                 data-category="${field.category}"
                 style="cursor: pointer; user-select: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px;">
                    <div style="flex: 1;">
                        <i class="${icon}" style="margin-right: 6px; color: #666;"></i>
                        <strong>${field.label}</strong>
                        <small class="text-muted">(${field.fieldtype})</small>
                        ${gallery_badge}
                        ${logic_badge}
                        ${system_badge}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${category_info}
                        ${is_selected ? '<i class="fa fa-check-circle text-primary"></i>' : ''}
                    </div>
                </div>
            </div>
        `);
        
        // Add click handler for single selection
        field_item.on('click', (e) => {
            e.preventDefault();
            this.toggle_modal_field_selection(field_item, field);
        });
        
        return field_item;
    }

    toggle_modal_field_selection(field_item, field) {
        const is_currently_selected = field_item.hasClass('selected');
        
        if (is_currently_selected) {
            // Deselect field
            field_item.removeClass('selected');
            field_item.find('.fa-check-circle').remove();
        } else {
            // Clear other selections for single selection mode
            $('.report-builder-modal-content .field-item.selected').each((_, elem) => {
                $(elem).removeClass('selected');
                $(elem).find('.fa-check-circle').remove();
            });
            
            // Select this field
            field_item.addClass('selected');
            if (!field_item.find('.fa-check-circle').length) {
                field_item.find('.text-primary').last().after('<i class="fa fa-check-circle text-primary" style="margin-left: 6px;"></i>');
            }
        }
        
        this.update_modal_transfer_buttons();
    }

    update_modal_transfer_buttons() {
        const selected_available = $('.report-builder-modal-content .field-item.selected').length > 0;
        const selected_chosen = $('.report-builder-modal-content .selected-field-item.selected').length > 0;
        
        $('#modal-add-field-btn').prop('disabled', !selected_available);
        $('#modal-remove-field-btn').prop('disabled', !selected_chosen);
        
        console.log('Modal transfer buttons updated - available:', selected_available, 'chosen:', selected_chosen);
    }

    modal_add_selected_fields() {
        $('.report-builder-modal-content .field-item.selected').each((index, elem) => {
            const fieldname = $(elem).data('fieldname');
            const category = $(elem).data('category');
            
            const field = this.find_field_by_name(fieldname, category);
            if (field && !this.is_field_selected(fieldname)) {
                this.selected_fields.push(field);
            }
            $(elem).removeClass('selected');
        });
        
        this.update_modal_selected_fields_display();
        this.update_modal_transfer_buttons();
    }

    modal_add_all_fields() {
        $('.report-builder-modal-content .field-item').each((index, elem) => {
            const fieldname = $(elem).data('fieldname');
            const category = $(elem).data('category');
            
            const field = this.find_field_by_name(fieldname, category);
            if (field && !this.is_field_selected(fieldname)) {
                this.selected_fields.push(field);
            }
        });
        
        this.update_modal_selected_fields_display();
    }

    modal_remove_selected_fields() {
        const to_remove = [];
        $('.report-builder-modal-content .selected-field-item.selected').each((index, elem) => {
            to_remove.push(parseInt($(elem).data('index')));
        });
        
        // Sort in reverse order to remove from end first
        to_remove.sort((a, b) => b - a);
        to_remove.forEach(index => {
            this.selected_fields.splice(index, 1);
        });
        
        this.update_modal_selected_fields_display();
        this.update_modal_transfer_buttons();
    }

    modal_remove_all_fields() {
        this.selected_fields = [];
        this.update_modal_selected_fields_display();
    }

    update_modal_selected_fields_display() {
        const container = $('#modal-selected-fields');
        container.empty();
        
        if (this.selected_fields.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 30px;">
                    <i class="fa fa-columns text-muted" style="font-size: 36px; opacity: 0.3;"></i>
                    <p class="text-muted">No fields selected yet</p>
                    <small class="text-muted">Select fields from the left panel</small>
                </div>
            `);
        } else {
            this.selected_fields.forEach((field, index) => {
                const field_item = this.create_modal_selected_field_item(field, index);
                container.append(field_item);
            });
        }
        
        $('#modal-selected-fields-count').text(this.selected_fields.length);
    }

    create_modal_selected_field_item(field, index) {
        const icon = this.get_field_icon(field.fieldtype);
        const display_label = field.custom_label || field.label;
        const category_badge = field.category === 'parent' ? 
            '<small class="badge badge-info">Related</small>' : '';
        
        return $(`
            <div class="selected-field-item" data-fieldname="${field.fieldname}" data-index="${index}">
                <div style="flex: 1;">
                    <i class="${icon}"></i>
                    <strong class="field-label">${display_label}</strong>
                    <small class="text-muted">(${field.fieldtype})</small>
                    ${category_badge}
                    ${field.custom_label ? '<small class="text-info">Custom</small>' : ''}
                </div>
                <div class="field-actions">
                    <button class="btn btn-xs btn-default" title="Edit Label" onclick="window.report_builder.edit_modal_field_label(${index})">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-default" title="Move Up" onclick="window.report_builder.move_modal_field(${index}, -1)">
                        <i class="fa fa-arrow-up"></i>
                    </button>
                    <button class="btn btn-xs btn-default" title="Move Down" onclick="window.report_builder.move_modal_field(${index}, 1)">
                        <i class="fa fa-arrow-down"></i>
                    </button>
                </div>
            </div>
        `);
    }

    modal_filter_fields(search_term) {
        $('.report-builder-modal-content .field-item').each(function() {
            const field_text = $(this).text().toLowerCase();
            if (field_text.includes(search_term)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    edit_modal_field_label(index) {
        const field = this.selected_fields[index];
        const current_label = field.custom_label || field.label;
        
        const d = new frappe.ui.Dialog({
            title: `Edit Column Name: ${field.label}`,
            fields: [
                {
                    fieldname: 'custom_label',
                    fieldtype: 'Data',
                    label: 'Custom Column Name',
                    default: current_label,
                    reqd: 1,
                    description: 'This name will appear as the column header in reports'
                }
            ],
            primary_action_label: 'Update',
            primary_action: (values) => {
                if (values.custom_label.trim()) {
                    this.selected_fields[index].custom_label = values.custom_label.trim();
                    this.update_modal_selected_fields_display();
                    frappe.show_alert(`Column name updated to "${values.custom_label}"`, 'green');
                }
                d.hide();
            },
            secondary_action_label: 'Reset to Original',
            secondary_action: () => {
                delete this.selected_fields[index].custom_label;
                this.update_modal_selected_fields_display();
                frappe.show_alert('Column name reset to original', 'blue');
                d.hide();
            }
        });
        
        d.show();
    }

    move_modal_field(index, direction) {
        const new_index = index + direction;
        if (new_index >= 0 && new_index < this.selected_fields.length) {
            [this.selected_fields[index], this.selected_fields[new_index]] = 
                [this.selected_fields[new_index], this.selected_fields[index]];
            this.update_modal_selected_fields_display();
        }
    }

    modal_add_filter() {
        if (!this.current_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first.');
            return;
        }
        
        // Set flag to update modal display after filter is added
        this.updating_modal = true;
        this.show_filter_dialog();
    }

    modal_add_sort() {
        if (!this.current_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first.');
            return;
        }
        
        // Set flag to update modal display after sort is added  
        this.updating_modal = true;
        this.show_sort_dialog();
    }

    async run_report_from_modal(is_edit_mode = false) {
        if (this.selected_fields.length === 0) {
            frappe.msgprint('Please select at least one field to display in the report.');
            return;
        }

        // Check for unsaved changes in edit mode
        if (is_edit_mode && this.has_unsaved_changes()) {
            const proceed = await this.confirm_unsaved_changes();
            if (!proceed) {
                return;
            }
        }

        // Hide modal
        this.modal_dialog.hide();
        
        // If this is a saved report, redirect to dedicated view mode
        if (this.current_report_id) {
            window.location.href = `/app/flansa-report-viewer/${this.current_report_id}`;
        } else {
            // For new reports, create a temporary report first
            await this.create_temporary_report();
        }
    }

    async save_report_from_modal(is_edit_mode) {
        if (!this.current_table || this.selected_fields.length === 0) {
            frappe.msgprint('Please select a table and fields first.');
            return;
        }

        if (is_edit_mode && this.current_report_id) {
            // Update existing report
            await this.update_existing_report();
        } else {
            // Save new report
            await this.save_new_report_from_modal();
        }
    }

    async save_new_report_from_modal() {
        // Hide current modal
        this.modal_dialog.hide();
        
        // Show save dialog using existing logic
        this.save_report();
    }

    async update_existing_report() {
        const report_config = {
            base_table: this.current_table,
            selected_fields: this.selected_fields,
            filters: this.filters,
            sort: this.sort_config
        };

        try {
            const response = await frappe.call({
                method: 'frappe.client.set_value',
                args: {
                    doctype: 'Flansa Saved Report',
                    name: this.current_report_id,
                    fieldname: 'report_config',
                    value: JSON.stringify(report_config)
                }
            });

            if (!response.exc) {
                frappe.show_alert(`Report "${this.current_report_title}" updated successfully`, 'green');
                this.modal_dialog.hide();
                
                // Refresh saved reports list
                const filter_table = this.is_localized ? this.preselected_table : null;
                await this.load_saved_reports(filter_table);
            } else {
                frappe.msgprint('Failed to update report');
            }
        } catch (error) {
            frappe.msgprint('Error updating report: ' + error.message);
        }
    }

    update_modal_filters_display() {
        const container = $('#modal-filters-container');
        container.empty();
        
        if (this.filters.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 30px;">
                    <i class="fa fa-filter text-muted" style="font-size: 24px; opacity: 0.3;"></i>
                    <p class="text-muted mb-0">No filters added</p>
                    <small class="text-muted">Click "Add Filter" to filter your report data</small>
                </div>
            `);
        } else {
            this.filters.forEach((filter, index) => {
                const filter_item = this.create_modal_filter_item(filter, index);
                container.append(filter_item);
            });
        }
    }

    create_modal_filter_item(filter, index) {
        const field = this.find_field_by_name(filter.field, 'current') || this.find_field_by_name(filter.field, 'parent');
        const field_label = field ? field.label : filter.field;
        
        return $(`
            <div class="filter-item" style="padding: 8px 12px; border-bottom: 1px solid #eee; background: #f8f9fa; margin: 2px;">
                <div class="d-flex justify-content-between align-items-center">
                    <div style="flex: 1;">
                        <strong>${field_label}</strong>
                        <span class="text-muted">${filter.operator}</span>
                        <span class="badge badge-primary">${filter.value}</span>
                    </div>
                    <div class="filter-actions">
                        <button class="btn btn-xs btn-default" title="Edit" onclick="window.report_builder.edit_modal_filter(${index})">
                            <i class="fa fa-edit"></i>
                        </button>
                        <button class="btn btn-xs btn-danger" title="Remove" onclick="window.report_builder.remove_modal_filter(${index})">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    update_modal_sort_display() {
        const container = $('#modal-sort-container');
        container.empty();
        
        if (this.sort_config.length === 0) {
            container.html(`
                <div class="empty-state text-center" style="padding: 30px;">
                    <i class="fa fa-sort text-muted" style="font-size: 24px; opacity: 0.3;"></i>
                    <p class="text-muted mb-0">Default: Newest First</p>
                    <small class="text-muted">Click "Add Sort" to customize sort order</small>
                </div>
            `);
        } else {
            this.sort_config.forEach((sort, index) => {
                const sort_item = this.create_modal_sort_item(sort, index);
                container.append(sort_item);
            });
        }
    }

    create_modal_sort_item(sort, index) {
        const field = this.find_field_by_name(sort.field, 'current') || this.find_field_by_name(sort.field, 'parent');
        const field_label = field ? field.label : sort.field;
        const direction_icon = sort.direction === 'asc' ? 'fa-sort-alpha-asc' : 'fa-sort-alpha-desc';
        const direction_text = sort.direction === 'asc' ? 'Ascending' : 'Descending';
        
        return $(`
            <div class="sort-item" style="padding: 8px 12px; border-bottom: 1px solid #eee; background: #f8f9fa; margin: 2px;">
                <div class="d-flex justify-content-between align-items-center">
                    <div style="flex: 1;">
                        <strong>${field_label}</strong>
                        <span class="text-muted">
                            <i class="fa ${direction_icon}"></i>
                            ${direction_text}
                        </span>
                        <span class="badge badge-secondary">${index + 1}</span>
                    </div>
                    <div class="sort-actions">
                        <button class="btn btn-xs btn-default" title="Move Up" onclick="window.report_builder.move_modal_sort(${index}, -1)">
                            <i class="fa fa-arrow-up"></i>
                        </button>
                        <button class="btn btn-xs btn-default" title="Move Down" onclick="window.report_builder.move_modal_sort(${index}, 1)">
                            <i class="fa fa-arrow-down"></i>
                        </button>
                        <button class="btn btn-xs btn-danger" title="Remove" onclick="window.report_builder.remove_modal_sort(${index})">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    edit_modal_filter(index) {
        // Use the existing show_filter_dialog method but modify the filter at index
        this.edit_filter_index = index;
        this.show_filter_dialog();
    }

    remove_modal_filter(index) {
        this.filters.splice(index, 1);
        this.update_modal_filters_display();
        frappe.show_alert('Filter removed', 'orange');
    }

    move_modal_sort(index, direction) {
        const new_index = index + direction;
        if (new_index >= 0 && new_index < this.sort_config.length) {
            [this.sort_config[index], this.sort_config[new_index]] = 
                [this.sort_config[new_index], this.sort_config[index]];
            this.update_modal_sort_display();
        }
    }

    remove_modal_sort(index) {
        this.sort_config.splice(index, 1);
        this.update_modal_sort_display();
        frappe.show_alert('Sort option removed', 'orange');
    }

    back_to_table_builder() {
        // Check if we're in URL viewing mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('view') || urlParams.get('edit')) {
            // Navigate back to report builder main page (without URL parameters)
            window.location.href = '/app/flansa-report-builder';
            return;
        }
        
        if (this.preselected_table) {
            // Navigate back to Visual Builder with the same table
            window.location.href = `/app/flansa-visual-builder/${this.preselected_table}`;
        } else {
            // Navigate to general Visual Builder
            window.location.href = '/app/flansa-visual-builder';
        }
    }

    async load_report_for_viewing(report_id) {
        console.log('load_report_for_viewing called with:', report_id);
        console.log('Report ID type:', typeof report_id);
        console.log('Report ID value:', JSON.stringify(report_id));
        
        if (!report_id) {
            console.error('No report_id provided to load_report_for_viewing');
            frappe.show_alert('No report ID provided', 'red');
            return;
        }
        
        try {
            // Hide saved reports section and show only results
            console.log('Hiding saved reports section...');
            $('.section-card').first().hide(); // Hide saved reports section
            $('#back-to-builder-btn').show(); // Show back button
            
            console.log('Making API call to load saved report with args:', { report_id: report_id });
            // Load the saved report
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { 
                    report_id: String(report_id) // Ensure it's a string
                }
            });

            console.log('API response:', response);
            if (response.message && response.message.success) {
                const saved_report = response.message.report;
                
                // Update page title
                $('.page-title').html(`
                    <i class="fa fa-chart-bar" style="margin-right: 8px; color: var(--flansa-primary, #007bff);"></i>
                    ${saved_report.title || 'Saved Report'}
                `);
                $('.page-subtitle').text(`Viewing saved report • Table: ${saved_report.base_table}`);
                
                // Load report configuration  
                const config = saved_report.config || {};
                
                this.current_table = saved_report.base_table;
                this.selected_fields = config.selected_fields || [];
                this.filters = config.filters || [];
                this.sort_config = config.sort_config || [];
                this.current_report_id = saved_report.name;
                this.current_report_title = saved_report.title;
                
                // Add action buttons to page actions
                this.add_view_mode_buttons(saved_report.id);
                
                // Load available fields for the table but don't reset state
                await this.select_table(saved_report.base_table, false);
                
                console.log('Table loaded, running report...');
                // Run the report to display results
                await this.run_report();
                
            } else {
                frappe.show_alert('Failed to load saved report', 'red');
            }
            
        } catch (error) {
            console.error('Error loading report for viewing:', error);
            frappe.show_alert('Error loading report', 'red');
        }
    }

    async load_report_for_editing(report_id) {
        console.log('Loading report for editing:', report_id);
        
        try {
            // Load the saved report
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                args: { report_id: report_id }
            });

            if (response.message && response.message.success) {
                const report = response.message.report;
                
                // Load the report configuration for editing
                this.current_table = report.base_table;
                this.selected_fields = report.config.selected_fields || [];
                this.filters = report.config.filters || [];
                this.sort_config = report.config.sort || [];
                this.current_report_id = report.id;
                this.current_report_title = report.title;
                
                // Store original configuration for change detection
                this.original_report_config = {
                    base_table: report.base_table,
                    selected_fields: JSON.parse(JSON.stringify(report.config.selected_fields || [])),
                    filters: JSON.parse(JSON.stringify(report.config.filters || [])),
                    sort: JSON.parse(JSON.stringify(report.config.sort || []))
                };
                
                // Load available fields for the table but DON'T reset state
                await this.select_table(report.base_table, false);
                
                // Show report builder modal in edit mode
                this.show_report_builder_modal(`Edit Report: ${report.title}`, true);
                
                frappe.show_alert(`Report "${report.title}" loaded for editing`, 'green');
                
            } else {
                frappe.show_alert('Failed to load saved report', 'red');
            }
            
        } catch (error) {
            console.error('Error loading report for editing:', error);
            frappe.show_alert('Error loading report', 'red');
        }
    }

    add_view_mode_buttons(report_id) {
        const pageActions = $('.page-actions');
        
        // Remove existing buttons if any
        pageActions.find('#edit-report-btn, #share-report-btn, #delete-report-btn').remove();
        
        // Check if this is a temporary report
        const urlParams = new URLSearchParams(window.location.search);
        const is_temp_report = urlParams.get('temp') === '1';
        
        if (is_temp_report) {
            // For temporary reports, show save button
            const saveBtn = $(`
                <button class="btn btn-primary" id="save-temp-report-btn" title="Save this report">
                    <i class="fa fa-save"></i> Save Report
                </button>
            `);
            
            saveBtn.on('click', () => {
                this.save_temporary_report();
            });
            
            pageActions.prepend(saveBtn);
        } else {
            // For saved reports, show edit and share buttons
            const editBtn = $(`
                <button class="btn btn-primary" id="edit-report-btn" title="Edit this report">
                    <i class="fa fa-edit"></i> Edit
                </button>
            `);
            
            const shareBtn = $(`
                <button class="btn btn-default" id="share-report-btn" title="Share this report">
                    <i class="fa fa-share-alt"></i> Share
                </button>
            `);
            
            editBtn.on('click', () => {
                window.location.href = `/app/flansa-report-builder?edit=${report_id}`;
            });
            
            shareBtn.on('click', () => {
                this.share_current_report();
            });
            
            pageActions.prepend(shareBtn);
            pageActions.prepend(editBtn);
        }
    }
    
    add_share_button() {
        // Deprecated - use add_view_mode_buttons instead
        this.add_view_mode_buttons(this.current_report_id);
    }

    share_current_report() {
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('?')[0];
        const shareUrl = `${baseUrl}?view=${this.current_report_id}`;
        
        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                frappe.show_alert({
                    message: 'Report URL copied to clipboard!',
                    indicator: 'green'
                });
            });
        } else {
            // Fallback for older browsers
            const temp = document.createElement('textarea');
            temp.value = shareUrl;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            frappe.show_alert({
                message: 'Report URL copied to clipboard!',
                indicator: 'green'
            });
        }
        
        // Also show the URL in a dialog for easy copying
        const share_dialog = new frappe.ui.Dialog({
            title: 'Share Report',
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'share_url',
                    label: 'Share URL',
                    default: shareUrl,
                    read_only: 1
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'share_info',
                    options: `
                        <div class="text-muted" style="margin-top: 10px;">
                            <p><strong>View Mode:</strong> ${shareUrl}</p>
                            <p><strong>Edit Mode:</strong> ${baseUrl}?edit=${this.current_report_id}</p>
                            <small>The URL has been copied to your clipboard.</small>
                        </div>
                    `
                }
            ]
        });
        
        share_dialog.show();
    }
    
    async save_temporary_report() {
        // Convert temporary report to permanent report with proper title
        const d = new frappe.ui.Dialog({
            title: 'Save Report',
            fields: [
                {
                    fieldname: 'report_title',
                    fieldtype: 'Data',
                    label: 'Report Title',
                    reqd: 1,
                    default: this.current_report_title.replace(/^Temp Report - /, '').replace(/ - \d+:\d+:\d+.*$/, ''),
                    description: 'Give your report a permanent name'
                },
                {
                    fieldname: 'description',
                    fieldtype: 'Small Text',
                    label: 'Description',
                    description: 'Optional description of what this report shows'
                },
                {
                    fieldname: 'is_public',
                    fieldtype: 'Check',
                    label: 'Make Public',
                    description: 'Allow other users to view and use this report'
                }
            ],
            primary_action_label: 'Save Report',
            primary_action: async (values) => {
                try {
                    // Update the temporary report with new details
                    const response = await frappe.call({
                        method: 'frappe.client.set_value',
                        args: {
                            doctype: 'Flansa Saved Report',
                            name: this.current_report_id,
                            fieldname: {
                                'report_title': values.report_title,
                                'description': values.description || '',
                                'is_public': values.is_public ? 1 : 0
                            }
                        }
                    });
                    
                    if (!response.exc) {
                        frappe.show_alert(`Report "${values.report_title}" saved successfully!`, 'green');
                        d.hide();
                        
                        // Redirect to dedicated viewer without temp parameter
                        window.location.href = `/app/flansa-report-viewer/${this.current_report_id}`;
                    } else {
                        frappe.msgprint('Failed to save report');
                    }
                } catch (error) {
                    frappe.msgprint('Error saving report: ' + error.message);
                }
            }
        });
        
        d.show();
    }
    
    toggle_filter_display(show_table_reports) {
        // Update button states
        if (show_table_reports) {
            $('#show-all-reports-btn').removeClass('btn-primary').addClass('btn-default');
            $('#show-table-reports-btn').removeClass('btn-default').addClass('btn-primary');
            // Reload reports with table filter
            this.load_saved_reports(this.filter_table);
        } else {
            $('#show-table-reports-btn').removeClass('btn-primary').addClass('btn-default');
            $('#show-all-reports-btn').removeClass('btn-default').addClass('btn-primary');
            // Reload all reports
            this.load_saved_reports(null);
        }
    }
    
    setup_context_menu() {
        // Context menu button toggle
        $(document).on('click', '#context-menu-btn', (e) => {
            e.stopPropagation();
            const menu = $('#context-menu');
            menu.toggle();
        });
        
        // Close menu when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.context-menu-wrapper').length) {
                $('#context-menu').hide();
            }
        });
        
        // Handle menu item clicks
        $(document).on('click', '.context-menu-item', (e) => {
            const action = $(e.currentTarget).data('action');
            $('#context-menu').hide();
            
            switch(action) {
                case 'theme':
                    this.show_theme_settings();
                    break;
                case 'refresh-cache':
                    this.clear_cache();
                    break;
                case 'export-data':
                    this.export_reports();
                    break;
                case 'keyboard-shortcuts':
                    this.show_keyboard_shortcuts();
                    break;
            }
        });
        
        // Quick navigation buttons
        $(document).on('click', '#quick-nav-table-builder', (e) => {
            e.preventDefault();
            if (this.filter_app) {
                window.location.href = `/app/flansa-visual-builder/${this.filter_app}`;
            } else {
                frappe.show_alert('App information not available', 'orange');
            }
        });
        
        $(document).on('click', '#quick-nav-relationships', (e) => {
            e.preventDefault();
            if (this.filter_app) {
                window.location.href = `/app/flansa-relationship-builder/${this.filter_app}`;
            } else {
                frappe.show_alert('App information not available', 'orange');
            }
        });
        
        $(document).on('click', '#quick-nav-app-dashboard', (e) => {
            e.preventDefault();
            if (this.filter_app) {
                window.location.href = `/app/flansa-app-dashboard/${this.filter_app}`;
            } else {
                frappe.show_alert('App information not available', 'orange');
            }
        });
        
        $(document).on('click', '#quick-nav-workspace', (e) => {
            e.preventDefault();
            window.location.href = '/app/flansa-workspace';
        });
    }
    
    show_theme_settings() {
        // Use FlansaThemeManager directly
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.showThemeSettings(() => {
                // Refresh callback
                if (this.apply_theme) {
                    this.apply_theme();
                }
            });
        } else {
            frappe.show_alert('Theme manager not available', 'orange');
        }
    }
    
    clear_cache() {
        if (window.flansaBrowserCacheManager) {
            window.flansaBrowserCacheManager.refreshAllAssets();
            frappe.show_alert('Cache cleared successfully!', 'green');
        } else {
            window.location.reload(true);
        }
    }
    
    export_reports() {
        frappe.msgprint({
            title: 'Export Reports',
            message: 'Report export functionality will be available in a future update.',
            indicator: 'blue'
        });
    }
    
    show_keyboard_shortcuts() {
        const shortcuts = [
            { key: 'Ctrl + N', action: 'Create new report' },
            { key: 'Ctrl + S', action: 'Save current report' },
            { key: 'Ctrl + R', action: 'Refresh reports list' },
            { key: 'Esc', action: 'Close dialogs' }
        ];
        
        const shortcut_html = shortcuts.map(s => 
            `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                <span style="font-family: monospace; background: #f8f9fa; padding: 2px 6px; border-radius: 4px;">${s.key}</span>
                <span>${s.action}</span>
            </div>`
        ).join('');
        
        frappe.msgprint({
            title: 'Keyboard Shortcuts',
            message: `<div style="max-width: 400px;">${shortcut_html}</div>`,
            indicator: 'blue'
        });
    }
    
    apply_theme() {
        // Apply theme settings if theme manager is available
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.applySavedTheme();
        }
    }
    
    async setup_breadcrumbs() {
        // Use custom breadcrumb container instead of default Frappe breadcrumbs
        const breadcrumbContainer = document.getElementById('breadcrumb-container');
        if (!breadcrumbContainer) return;
        
        const breadcrumbs = [];
        
        // Always start with Workspace
        breadcrumbs.push({ text: "Workspace", url: "/app/flansa-workspace" });
        
        // Handle app filter context
        if (this.filter_app) {
            try {
                // Get app title
                const app_response = await frappe.call({
                    method: 'frappe.client.get_value',
                    args: {
                        doctype: 'Flansa Application',
                        filters: { name: this.filter_app },
                        fieldname: ['app_title']
                    }
                });
                
                if (app_response.message) {
                    frappe.breadcrumbs.add(
                        app_response.message.app_title || this.filter_app,
                        `/app/flansa-app-dashboard/${this.filter_app}`
                    );
                }
            } catch (error) {
                console.log('Could not fetch app data for breadcrumbs');
            }
            
            frappe.breadcrumbs.add("Reports");
        } else if (this.filter_table) {
            // Get URL parameters for additional context
            const urlParams = new URLSearchParams(window.location.search);
            const app_name = urlParams.get('app');
            
            // Context-aware breadcrumbs for table-specific reports
            if (app_name) {
                try {
                    // Try to get app title
                    const app_response = await frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            doctype: 'Flansa Application',
                            filters: { name: app_name },
                            fieldname: ['app_title']
                        }
                    });
                    
                    if (app_response.message) {
                        frappe.breadcrumbs.add(
                            app_response.message.app_title || app_name,
                            `/app/flansa-app-dashboard/${app_name}`
                        );
                    }
                } catch (error) {
                    // Fallback if app data not available
                    console.log('Could not fetch app data for breadcrumbs');
                }
            }
            
            // Add table context
            try {
                // Try to get table label using correct field name
                const table_response = await frappe.call({
                    method: 'frappe.client.get_value',
                    args: {
                        doctype: 'Flansa Table',
                        filters: { name: this.filter_table },
                        fieldname: ['table_label']
                    }
                });
                
                if (table_response.message) {
                    frappe.breadcrumbs.add(
                        table_response.message.table_label || this.filter_table,
                        `/app/flansa-visual-builder/${this.filter_table}`
                    );
                }
            } catch (error) {
                // Fallback if table data not available - use ID but show it's a fallback
                frappe.breadcrumbs.add(`Table: ${this.filter_table}`);
            }
            
            frappe.breadcrumbs.add("Reports");
        } else {
            // General reports breadcrumb
            frappe.breadcrumbs.add("Report Builder");
        }
        
        // Also populate our custom breadcrumb container
        this.render_custom_breadcrumbs();
    }
    
    render_custom_breadcrumbs() {
        const breadcrumbContainer = document.getElementById('breadcrumb-container');
        if (!breadcrumbContainer) return;
        
        // Build breadcrumb items based on current context
        const breadcrumbs = [];
        
        // Always start with Workspace
        breadcrumbs.push({ text: "🏠 Workspace", url: "/app/flansa-workspace" });
        
        if (this.filter_app) {
            breadcrumbs.push({ text: "📱 Apps", url: `/app/flansa-app-dashboard/${this.filter_app}` });
            breadcrumbs.push({ text: "📊 Reports" });
            
            // Show app name indicator
            this.show_app_name_indicator(this.filter_app);
        } else if (this.filter_table) {
            breadcrumbs.push({ text: "🔧 Table Builder", url: `/app/flansa-visual-builder/${this.filter_table}` });
            breadcrumbs.push({ text: "📊 Reports" });
        } else {
            breadcrumbs.push({ text: "📊 Report Builder" });
        }
        
        // Render breadcrumbs
        const breadcrumbHTML = breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            if (isLast) {
                return `<span style="color: #666; font-weight: 500;">${item.text}</span>`;
            } else if (item.url) {
                return `<a href="${item.url}" style="color: #007bff; text-decoration: none; font-weight: 500;">${item.text}</a>`;
            } else {
                return `<span style="color: #666;">${item.text}</span>`;
            }
        }).join('<span style="margin: 0 4px; color: #ccc;">›</span>');
        
        breadcrumbContainer.innerHTML = breadcrumbHTML;
    }
    
    async update_reports_header_count(count, filter_context) {
        // Update the section header to show report count (consistent with Visual Builder pattern)
        const countText = `${count} report${count !== 1 ? 's' : ''}`;
        
        // Update header title
        const sectionHeaderTitle = $('.section-header h4');
        if (sectionHeaderTitle.length) {
            let baseTitle = 'Saved Reports';
            
            if (filter_context) {
                // Check if it's an app filter (this.filter_app) or table filter (this.filter_table)
                if (this.filter_app) {
                    // Handle app context
                    try {
                        const app_response = await frappe.db.get_value('Flansa Application', this.filter_app, 'app_title');
                        const app_display_name = (app_response && app_response.app_title) ? app_response.app_title : this.filter_app;
                        baseTitle = `${app_display_name} Reports`;
                    } catch (error) {
                        console.log('Could not fetch app title, using internal name');
                        baseTitle = `${this.filter_app} Reports`;
                    }
                } else if (this.filter_table) {
                    // Handle table context
                    try {
                        const table_response = await frappe.db.get_value('Flansa Table', this.filter_table, 'table_label');
                        // Fix: The response structure is table_response.message.table_label
                        const table_display_name = (table_response && table_response.message && table_response.message.table_label) ? table_response.message.table_label : this.filter_table;
                        baseTitle = `Reports for ${table_display_name}`;
                    } catch (error) {
                        console.log('Could not fetch table label, using internal name');
                        baseTitle = `Reports for ${this.filter_table}`;
                    }
                }
            }
            sectionHeaderTitle.html(`<i class="fa fa-bookmark"></i> ${baseTitle}`);
        }
        
        // Update count display (consistent with Visual Builder's field count display)
        const countDisplay = $('.section-header small');
        if (countDisplay.length) {
            // Simple count display like Visual Builder: "X reports"
            countDisplay.text(countText);
            countDisplay.css('color', 'var(--flansa-text-secondary, var(--flansa-gray-600))');
        }
    }
    
    setup_navigation() {
        // Clear default page title to avoid redundancy with banner
        this.page.set_title('');
        
        // Add back/forward navigation buttons instead of redundant title
        this.page.add_button('← Back', () => {
            window.history.back();
        }, 'btn-default');
        
        this.page.add_button('Forward →', () => {
            window.history.forward();
        }, 'btn-default');
        
        // Add navigation buttons based on context
        if (this.filter_app) {
            // Add App Settings button for app context
            this.page.add_button('⚙️ App Settings', () => {
                window.location.href = `/app/flansa-app-dashboard/${this.filter_app}`;
            }, 'btn-default');
        } else if (this.filter_table) {
            // Extract app name from URL or use a method to get it
            const urlParams = new URLSearchParams(window.location.search);
            const app_name = urlParams.get('app');
            
            if (app_name) {
                this.page.add_button('⚙️ App Settings', () => {
                    window.location.href = `/app/flansa-app-dashboard/${app_name}`;
                }, 'btn-default');
            }
            
            // Add table settings button for current table (use same icon as relationships)
            this.page.add_button('🔗 Table Settings', () => {
                // Use the correct URL format: /app/flansa-visual-builder/TABLE_ID
                window.location.href = `/app/flansa-visual-builder/${this.filter_table}`;
            }, 'btn-default');
        }
        
        // Add standard navigation buttons
        this.page.add_button('🏠 Workspace', () => {
            window.location.href = '/app/flansa-workspace';
        }, 'btn-default');
        
        // Add theme settings to menu if available
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.addThemeMenuToPage(this.page);
        }
        
        // Add standard cache management menu items
        this.page.add_menu_item('🔄 Refresh Assets Only', () => {
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.refreshAllAssets();
                frappe.show_alert('Assets refreshed!', 'green');
            } else {
                frappe.show_alert('Cache manager not available', 'orange');
            }
        });
        
        this.page.add_menu_item('🚀 Force Reload (Clear All)', () => {
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.forceReloadWithNuclearOption();
            } else {
                window.location.reload(true);
            }
        });
    }
    
    show_app_name_indicator(app_id) {
        if (app_id) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Flansa Application',
                    filters: { name: app_id },
                    fieldname: ['app_title']
                },
                callback: (r) => {
                    if (r.message && r.message.app_title) {
                        // Update the left side of banner with app name
                        $('#app-name-display').text(r.message.app_title);
                    }
                }
            });
        } else {
            // Reset to Flansa Platform if no app context
            $('#app-name-display').text('Flansa Platform');
        }
    }
}

// Initialize the Report Builder when page loads
frappe.pages['flansa-report-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Flansa Report Builder',
        single_column: true
    });
    
    // Setup Flansa navigation using navigation manager
    if (window.FlansaNavigationManager) {
        // Navigation will be setup automatically by the navigation manager
        setTimeout(() => {
            window.FlansaNavigationManager.setupPageNavigation(page, 'flansa-report-builder');
        }, 100);
    }
    
    // Load the HTML template
    $(page.body).html(frappe.render_template('flansa_report_builder'));
    
    // Initialize the report builder after HTML is loaded
    setTimeout(() => {
        window.report_builder = new FlansaReportBuilder(page);
    }, 100);
};

frappe.pages['flansa-report-builder'].on_page_show = function(wrapper) {
    console.log('=== FRAPPE PAGE SHOW EVENT START ===');
    console.log('Current URL:', window.location.href);
    console.log('Search params:', window.location.search);
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const table_id = urlParams.get('table');
    const view_report_id = urlParams.get('view');
    const edit_report_id = urlParams.get('edit');
    const is_temp_report = urlParams.get('temp') === '1';
    
    console.log('Page show event triggered. URL params:', {
        table_id, view_report_id, edit_report_id
    });
    console.log('Report builder exists:', !!window.report_builder);
    
    // Debug logging for URL parameters
    console.log('URL parameters detected:', {
        view_report_id,
        edit_report_id,
        table_id
    });
    
    if (window.report_builder) {
        if (view_report_id) {
            // Redirect to dedicated report viewer for better UX
            console.log('Redirecting to dedicated viewer for report:', view_report_id);
            window.location.href = `/app/flansa-report-viewer/${view_report_id}`;
        } else if (edit_report_id) {
            // Load report in edit mode (modal)
            console.log('Loading report for editing:', edit_report_id);
            setTimeout(() => {
                window.report_builder.load_report_for_editing(edit_report_id);
            }, 500);
        } else if (table_id) {
            // Set as localized to specific table
            console.log('Setting up localized view for table:', table_id);
            window.report_builder.preselected_table = table_id;
            window.report_builder.is_localized = true;
            
            setTimeout(() => {
                window.report_builder.setup_localized_view(table_id);
            }, 500);
        }
    } else {
        console.log('Report builder not ready, will retry...');
        // Retry if report builder isn't ready yet
        setTimeout(() => {
            if (window.report_builder) {
                if (view_report_id) {
                    console.log('Retry: Redirecting to viewer for:', view_report_id);
                    window.location.href = `/app/flansa-report-viewer/${view_report_id}`;
                } else if (edit_report_id) {
                    console.log('Retry: Calling load_report_for_editing with:', edit_report_id);
                    window.report_builder.load_report_for_editing(edit_report_id);
                }
            } else {
                console.error('Report builder still not ready after retry');
            }
        }, 1000);
    }
};

console.log("Flansa Report Builder JavaScript loaded successfully!");
// Apply theme on page load
$(document).ready(function() {
    if (window.page_instance && window.page_instance.apply_theme) {
        window.page_instance.apply_theme();
    }
});
