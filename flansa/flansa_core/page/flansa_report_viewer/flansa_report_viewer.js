// Load shared FlansaReportRenderer if not already available
if (!window.FlansaReportRenderer) {
    console.log('Loading FlansaReportRenderer in report viewer...');
    // Use synchronous loading to ensure availability
    try {
        frappe.require('/assets/flansa/js/flansa_report_renderer.js');
        console.log('FlansaReportRenderer loaded in report viewer successfully');
    } catch (error) {
        console.warn('Could not load FlansaReportRenderer in report viewer:', error);
    }
}

class FlansaReportViewer {
    constructor(page = null) {
        this.page = page;
        this.report_id = null;
        this.is_temp_report = false;
        this.current_report_data = null;
        this.current_view = 'table';
        this.current_page = 1;
        this.page_size = 20;
        this.search_term = '';
        this.total_unfiltered_records = 0;
        this.tile_layout = 'grid';
        this.tile_size = 'medium';
        
        this.init();
    }
    
    init() {
        this.extract_url_parameters();
        this.setup_ui();
        this.bind_events();
        this.setup_navigation();
        this.apply_theme();
        this.setup_initial_breadcrumbs();
        this.load_report();
    }
    
    extract_url_parameters() {
        // Extract parameters from URL query string for hierarchical structure
        const urlParams = new URLSearchParams(window.location.search);
        
        // Hierarchical parameters
        this.app_id = urlParams.get('app');
        this.table_name = urlParams.get('table');
        this.report_id = urlParams.get('report');
        this.is_temp_report = urlParams.get('temp') === '1';
        
        // Determine mode based on hierarchical parameters
        if (this.report_id) {
            this.is_table_direct = false;
            console.log('📊 Report viewer mode: Loading report', this.report_id, 
                this.app_id ? `(app: ${this.app_id})` : '', 
                this.table_name ? `(table: ${this.table_name})` : '');
        } else if (this.table_name) {
            this.is_table_direct = true;
            console.log('📋 Table viewer mode: Loading table', this.table_name, 
                this.app_id ? `(app: ${this.app_id})` : '');
        } else {
            // Fallback: try to extract from path for backward compatibility
            const path = window.location.pathname;
            const pathParts = path.split('/');
            const typeParam = urlParams.get('type'); // 'report' or 'table'
            
            if (pathParts.length >= 4) {
                this.identifier = pathParts[3];
                
                // Explicit type parameter takes precedence
                if (typeParam === 'report') {
                    this.report_id = this.identifier;
                    this.is_table_direct = false;
                    console.log('📊 Report viewer mode (legacy): Loading report', this.report_id);
                } else if (typeParam === 'table') {
                    this.table_name = this.identifier;
                    this.is_table_direct = true;
                    console.log('📋 Table viewer mode (legacy): Loading table', this.table_name);
                } else {
                    // Pattern matching fallback
                    if (this.identifier && this.identifier.startsWith('FR-')) {
                        this.report_id = this.identifier;
                        this.is_table_direct = false;
                        console.log('📊 Report viewer mode (pattern): Loading report', this.report_id);
                    } else {
                        this.table_name = this.identifier;
                        this.is_table_direct = true;
                        console.log('📋 Table viewer mode (pattern): Loading table', this.table_name);
                    }
                }
            }
        }
        
        // Store context for breadcrumbs and navigation
        this.context = {
            app_id: this.app_id,
            table_name: this.table_name,
            report_id: this.report_id
        };
    }
    
    bind_events() {
        // View mode switching
        $('.view-mode-btn').on('click', (e) => {
            const view = $(e.currentTarget).data('view');
            this.switch_view(view);
        });
        
        // Back to reports button
        $('#back-to-reports-btn').on('click', () => {
            window.location.href = '/app/flansa-saved-reports';
        });
        
        // Search functionality
        $('#report-search').on('input', frappe.utils.debounce(() => {
            this.perform_search();
        }, 300));
        
        $('#clear-search-btn').on('click', () => {
            $('#report-search').val('');
            this.perform_search();
        });
        
        // Tile layout controls
        $(document).on('click', '.tile-layout-btn', (e) => {
            const layout = $(e.currentTarget).data('layout');
            this.change_tile_layout(layout);
        });
        
        // Tile size controls
        $(document).on('click', '.tile-size-btn', (e) => {
            const size = $(e.currentTarget).data('size');
            this.change_tile_size(size);
        });
        
        // Image click events - use event delegation for dynamically created elements
        $(document).on('click', '.table-thumbnail', (e) => {
            const recordIndex = $(e.target).closest('tr').index();
            const fieldIndex = $(e.target).closest('td').index();
            const field = this.current_report_config.selected_fields[fieldIndex];
            this.open_image_lightbox(recordIndex, field.fieldname, 0);
        });
        
        $(document).on('click', '.gallery-card-image', (e) => {
            const card = $(e.target).closest('.gallery-card');
            const recordName = card.data('record-name');
            const recordIndex = this.current_report_data.data.findIndex(r => r.name === recordName);
            const currentImageIndex = parseInt(card.data('current-image')) || 0;
            const image_fields = this.current_report_config.selected_fields.filter(f => 
                ['Attach Image', 'Attach'].includes(f.fieldtype) || 
                f.fieldname.toLowerCase().includes('image')
            );
            if (image_fields.length > 0) {
                this.open_image_lightbox(recordIndex, image_fields[0].fieldname, currentImageIndex);
            }
        });
        
        // Context menu functionality
        $(document).on('click', '#context-menu-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = $('#context-menu');
            menu.toggle();
        });
        
        // Close context menu when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#context-menu-btn, #context-menu').length) {
                $('#context-menu').hide();
            }
        });
        
        // Context menu item actions
        $(document).on('click', '.context-menu-item', (e) => {
            e.preventDefault();
            const action = $(e.currentTarget).data('action');
            this.handle_context_menu_action(action);
            $('#context-menu').hide();
        });
        
        // Record action buttons (for all modes)
        $(document).on('click', '.view-record-btn', (e) => {
            e.preventDefault();
            const recordName = $(e.currentTarget).data('record-name');
            console.log('👆 View button clicked for record:', recordName);
            this.view_record(recordName);
        });
        
        $(document).on('click', '.edit-record-btn', (e) => {
            e.preventDefault();
            const recordName = $(e.currentTarget).data('record-name');
            console.log('👆 Edit button clicked for record:', recordName);
            this.edit_record(recordName);
        });
        
        $(document).on('click', '.delete-record-btn', (e) => {
            e.preventDefault();
            const recordName = $(e.currentTarget).data('record-name');
            console.log('👆 Delete button clicked for record:', recordName);
            this.delete_record(recordName);
        });
        
        // New record button in view controls
        $(document).on('click', '#new-record-btn', (e) => {
            e.preventDefault();
            this.navigate_to_new_record();
        });
    }
    
    async load_report() {
        if (!this.report_id && !this.table_name) {
            this.show_error('No report ID or table name provided in URL');
            return;
        }
        
        this.show_loading();
        
        try {
            if (this.is_table_direct) {
                // Load table directly as a default report
                await this.load_table_direct();
            } else {
                // Try to load as saved report first, if that fails, try as table
                console.log('Loading saved report:', this.report_id);
                
                try {
                    const response = await frappe.call({
                        method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                        args: { report_id: this.report_id }
                    });
                    
                    console.log('Saved report response:', response);
                    
                    if (response.message && response.message.success) {
                        const report = response.message.report;
                        console.log('Loaded report:', report);
                        // Set table_name from report for action buttons to work
                        this.table_name = report.base_table;
                        this.update_page_title(report);
                        this.add_action_buttons(report);
                        this.setup_navigation_with_context(report);
                        await this.execute_report(report);
                    } else {
                        // Failed to load as report, try as table
                        console.log('Failed to load as report, trying as table...');
                        this.table_name = this.report_id;  // Use the ID as table name
                        this.is_table_direct = true;
                        await this.load_table_direct();
                    }
                } catch (reportError) {
                    console.log('Report loading failed, trying as table:', reportError);
                    // Failed to load as report, try as table
                    this.table_name = this.report_id;  // Use the ID as table name
                    this.is_table_direct = true;
                    await this.load_table_direct();
                }
            }
            
        } catch (error) {
            console.error('Error loading report:', error);
            this.show_error('Error loading report: ' + error.message);
        }
    }
    
    async load_table_direct() {
        try {
            // First, check if there are existing reports for this table
            console.log('Checking for existing reports for table:', this.table_name);
            const existingReportsResponse = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Saved Report',
                    filters: {
                        base_table: this.table_name
                    },
                    fields: ['name', 'modified'],
                    order_by: 'modified desc',
                    limit_page_length: 1
                }
            });
            
            if (existingReportsResponse.message && existingReportsResponse.message.length > 0) {
                // Use existing report as default
                const existingReport = existingReportsResponse.message[0];
                console.log('Found existing report, using as default:', existingReport);
                
                this.report_id = existingReport.name;
                this.is_table_direct = false; // Switch to report mode
                
                // Load the existing report
                const reportResponse = await frappe.call({
                    method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.load_report',
                    args: { report_id: this.report_id }
                });
                
                if (reportResponse.message && reportResponse.message.success) {
                    const report = reportResponse.message.report;
                    this.update_page_title(report);
                    this.add_action_buttons(report); // Use regular report buttons
                    this.setup_navigation_with_context(report);
                    await this.execute_report(report);
                    return;
                }
            }
            
            // No existing reports found, create default view
            console.log('No existing reports found, creating default view for table:', this.table_name);
            await this.create_default_table_view();
            
        } catch (error) {
            console.error('Error loading table:', error);
            this.show_error('Error loading table: ' + error.message);
        }
    }
    
    async create_default_table_view() {
        try {
            // Get table metadata using the new enhanced API
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_table_metadata',
                args: { table_name: this.table_name }
            });
            
            if (response.message && response.message.success) {
                const metadata = response.message;
                
                // Create a default report configuration with proper field formatting
                const selectedFields = metadata.fields.slice(0, 8).map(field => ({
                    fieldname: field.fieldname,
                    label: field.label || field.fieldname,
                    fieldtype: field.fieldtype,
                    custom_label: field.label || field.fieldname,
                    options: field.options || '',
                    reqd: field.reqd || 0,
                    read_only: field.read_only || 0
                }));
                
                const defaultReport = {
                    title: `${metadata.tableName || metadata.tableLabel || this.table_name} Records (Default View)`,
                    base_table: this.table_name,
                    table_label: metadata.tableName || metadata.tableLabel,
                    doctype_name: metadata.doctype_name,
                    config: {
                        base_table: this.table_name,
                        selected_fields: selectedFields,
                        filters: [],
                        sort: [{ field: 'modified', order: 'desc' }]
                    },
                    created_on: new Date(),
                    is_temporary: true,  // Mark as temporary default view
                    description: 'This is a temporary default view. Create a report to customize fields, filters, and sorting.'
                };
                
                // Update UI with table info
                this.update_page_title(defaultReport);
                this.add_action_buttons_for_table(defaultReport);
                this.setup_navigation_with_context(defaultReport);
                await this.execute_report(defaultReport);
                
            } else {
                this.show_error(response.message?.error || 'Table not found');
            }
            
        } catch (error) {
            console.error('Error creating default table view:', error);
            this.show_error('Error creating default table view: ' + error.message);
        }
    }
    
    update_page_title(report) {
        // Skip setting page title to avoid redundancy with banner
        // this.page.set_title(`${report.title} - Report Viewer`);
        
        // Update breadcrumbs with report context
        this.update_breadcrumbs(report);
        
        // Populate app name in banner and report title in page header
        this.populate_app_and_report_info(report);
        
        // Update banner subtitle with report info and description
        let subtitle = `Table: ${report.base_table} • Created: ${moment(report.created_on).format('MMM DD, YYYY')}`;
        
        // Add record count if available
        if (this.current_report_data && this.current_report_data.total !== undefined) {
            subtitle += ` • ${this.current_report_data.total} record${this.current_report_data.total !== 1 ? 's' : ''}`;
        }
        
        if (report.description && report.description.trim()) {
            subtitle += ` • ${report.description}`;
        }
        
        if ($('#report-meta-display').length) {
            $('#report-meta-display').text(subtitle);
        }
        
        // Update HTML elements if they exist for backward compatibility
        if ($('#report-title').length) {
            $('#report-title').text(report.title);
        }
        if ($('#report-subtitle').length) {
            $('#report-subtitle').text(`Table: ${report.base_table} • Created: ${moment(report.created_on).format('MMM DD, YYYY')}`);
        }
        
        // Show report description if available
        if (report.description && report.description.trim()) {
            if ($('#report-description').length) {
                $('#report-description').text(` • ${report.description}`).show();
            }
        } else {
            if ($('#report-description').length) {
                $('#report-description').hide();
            }
        }
        
        document.title = `${report.title} - Flansa Reports`;
    }
    
    async populate_app_and_report_info(report) {
        try {
            // Get table information to find the application
            const table_response = await frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Flansa Table',
                    filters: { name: report.base_table },
                    fieldname: ['table_label', 'application']
                }
            });
            
            if (table_response.message) {
                const table_data = table_response.message;
                
                // Get application information if available
                if (table_data.application) {
                    const app_response = await frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            doctype: 'Flansa Application',
                            filters: { name: table_data.application },
                            fieldname: ['app_title']
                        }
                    });
                    
                    if (app_response.message && app_response.message.app_title) {
                        // Populate app name in banner
                        $('#app-name-display').text(app_response.message.app_title);
                        
                        // Store app name for navigation
                        this.current_app_name = table_data.application;
                    }
                }
            }
            
            // Show page header with report title
            $('#page-header').show();
            $('#report-name-display').text(report.title);
            
            // Show report metadata
            let metadata = `Table: ${report.base_table}`;
            if (report.description && report.description.trim()) {
                metadata += ` • ${report.description}`;
            }
            metadata += ` • Created: ${moment(report.created_on).format('MMM DD, YYYY')}`;
            
            $('#report-meta-display').text(metadata);
            
        } catch (error) {
            console.error('Error loading app info:', error);
            // Fallback: at least show report title
            $('#page-header').show();
            $('#report-name-display').text(report.title);
            $('#app-name-display').text('Flansa Platform');
        }
    }
    
    add_action_buttons(report) {
        // Edit Report button will be added to view controls instead
        // Set up the edit button click handler
        $('#edit-report-btn').off('click').on('click', () => {
            // Use unified report builder for editing
            const url = `/app/flansa-report-builder?edit=${this.report_id}&table=${report.base_table}&source=report_viewer`;
            window.location.href = url;
        });
        
        // Add export/share options to menu
        this.page.add_menu_item('📤 Export Report', () => {
            frappe.msgprint('Export functionality coming soon!');
        });
        
        this.page.add_menu_item('🔗 Share Report', () => {
            frappe.msgprint('Share functionality coming soon!');
        });
    }
    
    add_action_buttons_for_table(report) {
        const isTemporaryView = report.is_temporary;
        
        // Add primary action buttons using correct Frappe page methods
        if (this.page && this.page.add_action_button) {
            // Add "View Saved Reports" button for all views
            this.page.add_action_button('📋 Saved Reports', () => {
                // Use direct URL navigation to preserve query parameters
                const url = `/app/flansa-saved-reports?table=${encodeURIComponent(this.table_name)}&source=report_viewer`;
                window.location.href = url;
            });
            
            if (isTemporaryView) {
                this.page.add_action_button('📊 Create Report', () => {
                    // Open unified report builder to create a proper report
                    // Use direct URL navigation to preserve query parameters
                    const url = `/app/flansa-report-builder?table=${encodeURIComponent(this.table_name)}&source=report_viewer`;
                    window.location.href = url;
                });
            }
            
            this.page.add_action_button('➕ New Record', () => {
                // Navigate to record viewer for new record
                if (window.FlansaNav) {
                    window.FlansaNav.navigateToNewRecord(this.table_name);
                } else {
                    frappe.set_route('flansa-record-viewer', this.table_name, 'new');
                }
            });
        } else if (this.page && this.page.add_button) {
            if (isTemporaryView) {
                this.page.add_button('📊 Create Report', () => {
                    const url = `/app/flansa-report-builder?table=${this.table_name}&source=report_viewer`;
                    window.location.href = url;
                }, 'btn-primary');
            }
            
            this.page.add_button('➕ New Record', () => {
                if (window.FlansaNav) {
                    window.FlansaNav.navigateToNewRecord(this.table_name);
                } else {
                    frappe.set_route('flansa-record-viewer', this.table_name, 'new');
                }
            }, 'btn-success');
        }
        
        // For direct table access, update edit button behavior
        $('#edit-report-btn').off('click').on('click', () => {
            if (isTemporaryView) {
                // Open unified report builder to create proper report
                const url = `/app/flansa-report-builder?table=${this.table_name}&source=report_viewer`;
                window.location.href = url;
            } else {
                // Should not reach here for temporary views
                this.show_table_customization_dialog();
            }
        });
        
        // Change edit button text for table context
        if ($('#edit-report-btn').length && isTemporaryView) {
            $('#edit-report-btn').html('<i class="fa fa-plus"></i> Create Report');
        }
        
        // Add table-specific menu items
        if (this.page && this.page.add_menu_item) {
            if (isTemporaryView) {
                this.page.add_menu_item('📊 Create Report', () => {
                    const url = `/app/flansa-report-builder?table=${this.table_name}&source=report_viewer`;
                    window.location.href = url;
                });
                
                this.page.add_menu_item('📋 Save Current View as Report', () => {
                    this.save_current_view_as_report();
                });
            }
            
            this.page.add_menu_item('🔧 Edit Table Structure', () => {
                window.location.href = `/app/flansa-table-builder/${this.table_name}`;
            });
            
            this.page.add_menu_item('📤 Export Data', () => {
                this.export_report_data();
            });
            
            this.page.add_menu_item('🔄 Refresh Data', () => {
                this.refresh_data();
            });
        }
    }
    
    async execute_report(report) {
        try {
            let response;
            
            if (this.is_table_direct) {
                // Use table API for direct table access
                response = await frappe.call({
                    method: 'flansa.flansa_core.api.table_api.get_table_records',
                    args: {
                        table_name: this.table_name
                    }
                });
                
                if (response.message && response.message.success) {
                    // Transform to match expected format
                    this.current_report_data = {
                        success: true,
                        data: response.message.records,
                        total: response.message.total,
                        page: response.message.page,
                        has_more: response.message.has_more
                    };
                    this.current_report_config = report.config;
                    
                    // Capture total unfiltered count when no search is active
                    if (!this.search_term) {
                        this.total_unfiltered_records = response.message.total;
                    }
                    
                    this.display_results();
                } else {
                    throw new Error(response.message?.error || 'Failed to load records');
                }
            } else {
                // Use existing report builder API for saved reports
                // Transform selected_fields to expected format if they're strings
                let selected_fields = report.config.selected_fields || [];
                if (selected_fields.length > 0 && typeof selected_fields[0] === 'string') {
                    // Convert string array to object array with proper categories and metadata
                    selected_fields = await this.transform_legacy_field_names(selected_fields, report.base_table);
                }
                
                response = await frappe.call({
                    method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                    args: {
                        report_config: {
                            base_table: report.base_table,
                            selected_fields: selected_fields,
                            filters: report.config.filters || [],
                            grouping: report.config.grouping || [], // Include grouping configuration
                            sort: report.config.sort || []
                        },
                        view_options: {
                            page: this.current_page,
                            page_size: this.page_size,
                            view_type: this.current_view,
                            search: this.search_term
                        }
                    }
                });
                
                if (response.message && response.message.success) {
                    this.current_report_data = response.message;
                    // Use the transformed config with proper field objects
                    this.current_report_config = {
                        ...report.config,
                        selected_fields: selected_fields
                    };
                    
                    // Capture total unfiltered count when no search is active
                    if (!this.search_term) {
                        this.total_unfiltered_records = response.message.total;
                    }
                    
                    this.display_results();
                } else {
                    throw new Error(response.message?.error || 'Failed to execute report');
                }
            }
            
        } catch (error) {
            console.error('Error executing report:', error);
            this.show_error('Error executing report: ' + error.message);
        }
    }
    
    async transform_legacy_field_names(field_names, table_name) {
        try {
            // Get field metadata from the report builder API
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.report_builder_api.get_report_field_options',
                args: { table_name: table_name }
            });
            
            if (!response.message || !response.message.success) {
                // Fallback to simple transformation
                return field_names.map(fieldname => {
                    const label = fieldname.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return {
                        fieldname: fieldname,
                        category: 'current',
                        field_label: label,
                        label: label, // Add both for compatibility
                        fieldtype: 'Data'
                    };
                });
            }
            
            const fields = response.message.fields;
            const transformed_fields = [];
            
            // Create lookup maps for different field categories
            const current_fields_map = {};
            const system_fields_map = {};
            const related_fields_map = {};
            
            // Build lookup maps
            fields.current?.forEach(f => current_fields_map[f.fieldname] = f);
            fields.system?.forEach(f => system_fields_map[f.fieldname] = f);
            fields.related_groups?.forEach(group => {
                group.fields?.forEach(f => related_fields_map[f.fieldname] = f);
            });
            
            // Transform each field name
            field_names.forEach(fieldname => {
                let field_config = null;
                
                // Check in current fields first
                if (current_fields_map[fieldname]) {
                    field_config = {
                        ...current_fields_map[fieldname],
                        category: 'current'
                    };
                }
                // Check in system fields
                else if (system_fields_map[fieldname]) {
                    field_config = {
                        ...system_fields_map[fieldname],
                        category: 'system'
                    };
                }
                // Check in related fields
                else if (related_fields_map[fieldname]) {
                    field_config = {
                        ...related_fields_map[fieldname],
                        category: 'related'
                    };
                }
                // Fallback for unknown fields
                else {
                    const label = fieldname.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    field_config = {
                        fieldname: fieldname,
                        category: 'current',
                        field_label: label,
                        label: label, // Add both for compatibility
                        fieldtype: 'Data'
                    };
                }
                
                transformed_fields.push(field_config);
            });
            
            return transformed_fields;
            
        } catch (error) {
            console.error('Error transforming legacy field names:', error);
            // Fallback to simple transformation
            return field_names.map(fieldname => {
                const label = fieldname.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return {
                    fieldname: fieldname,
                    category: 'current',
                    field_label: label,
                    label: label, // Add both for compatibility
                    fieldtype: 'Data'
                };
            });
        }
    }

    build_search_filters() {
        if (!this.search_term) return [];
        
        // Build search filters for common text fields
        const searchFilters = [];
        if (this.current_report_config && this.current_report_config.selected_fields) {
            this.current_report_config.selected_fields.forEach(field => {
                if (['Data', 'Text', 'Long Text'].includes(field.fieldtype)) {
                    searchFilters.push({
                        field: field.fieldname,
                        operator: 'like',
                        value: this.search_term
                    });
                }
            });
        }
        
        return searchFilters;
    }
    
    async perform_search() {
        this.search_term = $('#report-search').val();
        this.current_page = 1; // Reset to first page
        
        // Re-execute report with search
        if (this.current_report_data) {
            await this.execute_report({
                base_table: this.current_report_config.base_table,
                config: this.current_report_config
            });
        }
    }
    
    display_results() {
        this.hide_loading();
        
        // Always update record count display first (even when no results)
        const totalRecords = this.total_unfiltered_records || this.current_report_data.total;
        const filteredRecords = this.current_report_data.total;
        
        let displayCount;
        if (this.search_term && filteredRecords !== totalRecords) {
            displayCount = `${filteredRecords} of ${totalRecords} record${totalRecords !== 1 ? 's' : ''}`;
        } else {
            displayCount = `${totalRecords} record${totalRecords !== 1 ? 's' : ''}`;
        }
        
        $('#record-count-info').text(displayCount).css('color', 'var(--flansa-text-secondary, var(--flansa-gray-600))');
        
        // Update banner subtitle to include record count (use total unfiltered)
        this.update_banner_record_count();
        
        // Check for data availability - handle both regular and grouped reports
        const hasData = this.current_report_data.is_grouped ? 
            (this.current_report_data.groups && this.current_report_data.groups.length > 0) :
            (this.current_report_data.data && this.current_report_data.data.length > 0);
            
        if (!hasData) {
            this.show_no_results();
            return;
        }
        
        $('#report-content').show();
        
        // Always use shared FlansaReportRenderer for consistent display (including grouped reports)
        if (window.FlansaReportRenderer) {
            this.display_with_shared_renderer();
        } else {
            // Fallback to legacy display methods
            if (this.current_view === 'table') {
                this.display_table_view();
            } else if (this.current_view === 'tile') {
                this.display_tile_view();
            }
        }
    }
    
    
    display_tile_view() {
        const tileContainer = $('#tile-container');
        tileContainer.empty();
        
        if (!this.current_report_config.selected_fields || this.current_report_config.selected_fields.length === 0) {
            tileContainer.append('<div class="text-center text-muted">No fields configured for this report</div>');
            return;
        }
        
        // Apply tile settings
        this.apply_tile_settings();
        
        // Create tiles for each record
        this.current_report_data.data.forEach(record => {
            const tileCard = this.create_tile_card(record);
            tileContainer.append(tileCard);
        });
        
        $('#table-view').hide();
        $('#tile-view').show();
    }
    
    create_tile_card(record) {
        // Check for image fields
        const image_fields = this.current_report_config.selected_fields.filter(f => 
            ['Attach Image', 'Attach'].includes(f.fieldtype) || 
            f.fieldname.toLowerCase().includes('image')
        );
        
        // Collect all valid image URLs from image fields
        const image_urls = [];
        if (image_fields && image_fields.length > 0) {
            image_fields.forEach(field => {
                const raw_image_value = record[field.fieldname];
                const field_image_urls = this.extract_all_image_urls(raw_image_value);
                field_image_urls.forEach(url => {
                    if (url && url !== '/assets/frappe/images/default-avatar.png') {
                        image_urls.push(url);
                    }
                });
            });
        }
        
        // Find title field
        const title_field = this.current_report_config.selected_fields.find(f => 
            !['Attach Image', 'Attach', 'Long Text', 'Text Editor'].includes(f.fieldtype) && 
            f.fieldname !== 'name'
        );
        const title = title_field ? record[title_field.fieldname] : record.name || 'Untitled';
        
        // Get metadata fields
        const metadata_fields = this.current_report_config.selected_fields.filter(f => 
            !['Attach Image', 'Attach', 'Long Text', 'Text Editor'].includes(f.fieldtype) && 
            f.fieldname !== 'name' &&
            f.fieldname !== (title_field ? title_field.fieldname : null)
        ).slice(0, 4);
        
        // Create tile with or without image
        const hasImage = image_urls.length > 0;
        
        const tileCardHtml = hasImage ? `
            <div class="gallery-card clickable-tile" data-record-name="${record.name}" data-current-image="0" title="Click to view record">
                ${image_urls.length > 1 ? `
                    <div class="gallery-image-indicator">
                        <span class="current-image">1</span> / <span class="total-images">${image_urls.length}</span>
                    </div>
                    <div class="gallery-progress-bar">
                        <div class="gallery-progress-fill" style="width: ${100/image_urls.length}%"></div>
                    </div>
                ` : ''}
                <div class="gallery-image-wrapper">
                    <img src="${image_urls[0]}" alt="${title}" class="gallery-card-image" 
                         onerror="this.src='/assets/frappe/images/default-avatar.png'">
                    ${image_urls.length > 1 ? `
                        <div class="gallery-nav-controls">
                            <button class="gallery-nav-btn prev-btn" title="Previous Image">
                                <i class="fa fa-chevron-left"></i>
                            </button>
                            <button class="gallery-nav-btn next-btn" title="Next Image">
                                <i class="fa fa-chevron-right"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="gallery-card-content">
                    <h6 class="gallery-card-title">${title}</h6>
                    <div class="gallery-meta-list">
                        ${metadata_fields.map(field => {
                            const value = record[field.fieldname] || '';
                            const formatted_value = this.format_field_value(value, field.fieldtype);
                            const display_label = field.custom_label || field.field_label || field.label;
                            return `<div class="gallery-meta-item"><strong>${display_label}:</strong> ${formatted_value}</div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        ` : `
            <div class="gallery-card no-image clickable-tile" data-record-name="${record.name}" title="Click to view record">
                <div class="gallery-card-content">
                    <h6 class="gallery-card-title">${title}</h6>
                    <div class="gallery-meta-list">
                        ${metadata_fields.map(field => {
                            const value = record[field.fieldname] || '';
                            const formatted_value = this.format_field_value(value, field.fieldtype);
                            const display_label = field.custom_label || field.field_label || field.label;
                            return `<div class="gallery-meta-item"><strong>${display_label}:</strong> ${formatted_value}</div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
        
        const tile_card = $(tileCardHtml);
        
        // Add click-to-view functionality
        tile_card.on('click', (e) => {
            // Don't trigger if clicking on navigation buttons
            if ($(e.target).closest('.gallery-nav-btn').length > 0) {
                return;
            }
            
            const recordName = tile_card.data('record-name');
            if (recordName) {
                console.log('🔍 Tile clicked, viewing record:', recordName);
                this.view_record(recordName);
            }
        });
        
        // Store image data for navigation if images exist
        if (image_urls.length > 0) {
            tile_card.data('imageUrls', image_urls);
            
            // Bind navigation events if multiple images
            if (image_urls.length > 1) {
                tile_card.find('.prev-btn').on('click', (e) => {
                    e.stopPropagation();
                    this.navigate_gallery_image(tile_card, -1);
                });
                
                tile_card.find('.next-btn').on('click', (e) => {
                    e.stopPropagation();
                    this.navigate_gallery_image(tile_card, 1);
                });
            }
        }
        
        return tile_card;
    }
    
    extract_all_image_urls(image_value) {
        if (!image_value) return [];
        
        // Handle different data formats
        if (typeof image_value === 'object') {
            if (Array.isArray(image_value)) {
                const urls = [];
                image_value.forEach((item) => {
                    const url = this.get_single_image_url(item);
                    if (url && url !== '/assets/frappe/images/default-avatar.png') {
                        urls.push(url);
                    }
                });
                return urls;
            } else {
                const url = this.get_single_image_url(image_value);
                return url && url !== '/assets/frappe/images/default-avatar.png' ? [url] : [];
            }
        }
        
        // Convert to string and process
        const processed_value = String(image_value).trim();
        
        // Handle JSON strings that contain arrays
        if (processed_value.startsWith('[') && processed_value.endsWith(']')) {
            try {
                const parsed = JSON.parse(processed_value);
                if (Array.isArray(parsed)) {
                    const urls = [];
                    parsed.forEach((item) => {
                        const url = this.get_single_image_url(item);
                        if (url && url !== '/assets/frappe/images/default-avatar.png') {
                            urls.push(url);
                        }
                    });
                    return urls;
                }
            } catch (e) {
                // Failed to parse
            }
        }
        
        // Handle single image case
        const single_url = this.get_single_image_url(processed_value);
        return single_url && single_url !== '/assets/frappe/images/default-avatar.png' ? [single_url] : [];
    }
    
    get_single_image_url(image_value) {
        if (!image_value) return '/assets/frappe/images/default-avatar.png';
        
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
        } else if (str_value.startsWith('/assets/') || str_value.startsWith('/images/')) {
            return `${window.location.origin}${str_value}`;
        } else if (str_value && !str_value.includes(' ')) {
            // Assume it's a file path if it doesn't contain spaces
            return `${window.location.origin}/files/${str_value}`;
        }
        
        return '/assets/frappe/images/default-avatar.png';
    }
    
    format_field_value(value, fieldtype) {
        if (!value) return '';
        
        switch (fieldtype) {
            case 'Date':
                return moment(value).format('MMM DD, YYYY');
            case 'Datetime':
                return moment(value).format('MMM DD, YYYY HH:mm');
            case 'Currency':
                return frappe.format(value, {fieldtype: 'Currency'});
            default:
                return value;
        }
    }
    
    switch_view(view) {
        this.current_view = view;
        
        $('.view-mode-btn').removeClass('active');
        $(`.view-mode-btn[data-view="${view}"]`).addClass('active');
        
        if (view === 'tile') {
            $('#tile-controls').show();
        } else {
            $('#tile-controls').hide();
        }
        
        this.display_results();
    }
    
    apply_tile_settings() {
        const container = $('#tile-container');
        container.removeClass('layout-grid layout-horizontal size-small size-medium size-large');
        container.addClass(`layout-${this.tile_layout} size-${this.tile_size}`);
    }
    
    change_tile_layout(layout) {
        this.tile_layout = layout;
        
        // Update button states
        $('.tile-layout-btn').removeClass('active');
        $(`.tile-layout-btn[data-layout="${layout}"]`).addClass('active');
        
        // Apply settings if in tile view
        if (this.current_view === 'tile') {
            this.apply_tile_settings();
        }
    }
    
    change_tile_size(size) {
        this.tile_size = size;
        
        // Update button states
        $('.tile-size-btn').removeClass('active');
        $(`.tile-size-btn[data-size="${size}"]`).addClass('active');
        
        // Apply settings if in tile view
        if (this.current_view === 'tile') {
            this.apply_tile_settings();
        }
    }
    
    /**
     * Display results using shared FlansaReportRenderer for consistency
     */
    display_with_shared_renderer() {
        // Check if shared renderer is available
        if (!window.FlansaReportRenderer || typeof window.FlansaReportRenderer.render !== 'function') {
            console.warn('FlansaReportRenderer not available in report viewer, using fallback');
            
            // Use fallback display methods - only tile view has fallback
            if (this.current_view === 'table') {
                this.show_error('Table view unavailable - shared renderer required');
            } else if (this.current_view === 'tile') {
                this.display_tile_view();
            }
            return;
        }
        
        // Prepare configuration for renderer
        const config = {
            showActions: this.should_show_action_buttons(),
            tableClass: this.current_view === 'table' ? 'table table-striped table-hover' : 'table table-sm',
            fields: this.current_report_config.selected_fields || [],
            onRecordClick: this.current_view === 'table' ? null : (recordId) => {
                this.view_record(recordId);
            }
        };
        
        try {
            console.log('🔧 USING SHARED RENDERER FOR DISPLAY');
            console.log('Report data for rendering:', this.current_report_data);
            console.log('Is grouped?', this.current_report_data.is_grouped);
            console.log('showActions config:', config.showActions);
            
            // Generate HTML using shared renderer
            const html = window.FlansaReportRenderer.render(this.current_report_data, config);
            
            // For grouped reports or regular table view, display in table container
            if (this.current_view === 'table' || this.current_report_data.is_grouped) {
                const tableContainer = $('#table-view');
                tableContainer.empty().html(html);
                tableContainer.show();
                $('#tile-view').hide();
                
                // Set up action button handlers if function is available
                if (typeof window.FlansaReportRenderer.setupActionHandlers === 'function') {
                    window.FlansaReportRenderer.setupActionHandlers(
                        tableContainer[0],
                        (recordId) => this.view_record(recordId),
                        (recordId) => this.edit_record(recordId)
                    );
                }
            } else if (this.current_view === 'tile') {
                // For tile view, fall back to existing implementation since renderer focuses on table/grouped views
                this.display_tile_view();
            }
        } catch (error) {
            console.error('❌ SHARED RENDERER FAILED - Table view requires shared renderer');
            console.error('Error using shared renderer:', error);
            console.error('Report data:', this.current_report_data);
            
            // Only tile view has fallback, table view requires shared renderer
            if (this.current_view === 'tile') {
                console.log('🔧 FALLBACK: Using tile view');
                this.display_tile_view();
            } else {
                // Show error for table view since it requires shared renderer
                this.show_error('Table view unavailable - shared renderer failed to load');
            }
        }
    }
    
    show_loading() {
        $('#report-loading').show();
        $('#report-content, #report-error').hide();
    }
    
    hide_loading() {
        $('#report-loading').hide();
    }
    
    show_error(message) {
        $('#error-message').text(message);
        $('#report-error').show();
        $('#report-loading, #report-content').hide();
    }
    
    show_no_results() {
        $('#no-results').show();
        $('#table-view, #tile-view').hide();
        $('#report-content').show();
    }
    
    open_image_lightbox(recordIndex, fieldName, startingImageIndex = 0) {
        
        const record = this.current_report_data.data[recordIndex];
        const value = record[fieldName];
        const images = this.extract_all_image_urls(value);
        
        if (images.length === 0) {
            frappe.msgprint('No images found');
            return;
        }
        
        // Create lightbox modal using safe DOM creation
        const lightboxHtml = `
            <div class="image-lightbox-overlay" id="image-lightbox">
                <div class="lightbox-content">
                    <div class="lightbox-header">
                        <span class="lightbox-title">${record.name || 'Image Gallery'}</span>
                        <span class="lightbox-counter">
                            <span class="current-img">1</span> / <span class="total-imgs">${images.length}</span>
                        </span>
                        <button class="lightbox-close" title="Close (Esc)">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="lightbox-body">
                        <div class="lightbox-image-container">
                            <img src="" alt="Image" class="lightbox-image" id="lightbox-img">
                            ${images.length > 1 ? `
                                <button class="lightbox-nav lightbox-prev" title="Previous (←)">
                                    <i class="fa fa-chevron-left"></i>
                                </button>
                                <button class="lightbox-nav lightbox-next" title="Next (→)">
                                    <i class="fa fa-chevron-right"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing lightbox
        $('#image-lightbox').remove();
        
        // Add to DOM
        $('body').append(lightboxHtml);
        
        // Store current state
        this.lightbox_images = images;
        this.lightbox_current_index = startingImageIndex;
        
        // Bind events
        this.bind_lightbox_events();
        
        // Show lightbox and load starting image
        $('#image-lightbox').fadeIn(200, () => {
            $('#lightbox-img').attr('src', images[startingImageIndex]);
            // Update counter to show correct current image
            $('#image-lightbox .current-img').text(startingImageIndex + 1);
        });
    }
    
    bind_lightbox_events() {
        const lightbox = $('#image-lightbox');
        
        // Close events
        lightbox.find('.lightbox-close').on('click', () => this.close_lightbox());
        
        // Click outside to close
        lightbox.on('click', (e) => {
            if (e.target === lightbox[0] || $(e.target).hasClass('lightbox-body') || $(e.target).hasClass('lightbox-image-container')) {
                this.close_lightbox();
            }
        });
        
        // Navigation events
        lightbox.find('.lightbox-prev').on('click', () => this.navigate_lightbox(-1));
        lightbox.find('.lightbox-next').on('click', () => this.navigate_lightbox(1));
        
        // Keyboard events
        $(document).off('keydown.lightbox').on('keydown.lightbox', (e) => {
            switch(e.key) {
                case 'Escape':
                    this.close_lightbox();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigate_lightbox(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigate_lightbox(1);
                    break;
            }
        });
    }
    
    navigate_lightbox(direction) {
        if (!this.lightbox_images || this.lightbox_images.length <= 1) return;
        
        let newIndex = this.lightbox_current_index + direction;
        
        // Handle wraparound
        if (newIndex < 0) {
            newIndex = this.lightbox_images.length - 1;
        } else if (newIndex >= this.lightbox_images.length) {
            newIndex = 0;
        }
        
        this.lightbox_current_index = newIndex;
        
        // Update image with fade effect
        const img = $('#lightbox-img');
        img.fadeOut(100, () => {
            img.attr('src', this.lightbox_images[newIndex]);
            img.fadeIn(100);
        });
        
        // Update counter
        $('#image-lightbox .current-img').text(newIndex + 1);
    }
    
    close_lightbox() {
        $('#image-lightbox').fadeOut(200, () => {
            $('#image-lightbox').remove();
        });
        
        // Clean up event handlers
        $(document).off('keydown.lightbox');
        
        // Clean up state
        this.lightbox_images = null;
        this.lightbox_current_index = 0;
    }
    
    navigate_gallery_image(gallery_card, direction) {
        
        const image_urls = gallery_card.data('imageUrls');
        const current_index = parseInt(gallery_card.data('current-image')) || 0;
        
        if (!image_urls || image_urls.length <= 1) return;
        
        let new_index = current_index + direction;
        
        // Handle wraparound
        if (new_index < 0) {
            new_index = image_urls.length - 1;
        } else if (new_index >= image_urls.length) {
            new_index = 0;
        }
        
        // Update image with slide animation
        const img_element = gallery_card.find('.gallery-card-image');
        
        img_element.addClass('transitioning');
        
        // Create slide animations with different directions
        const slideOutTransform = direction > 0 ? 'translateX(100%) scale(0.95)' : 'translateX(-100%) scale(0.95)';
        const slideInStart = direction > 0 ? 'translateX(-100%) scale(0.95)' : 'translateX(100%) scale(0.95)';
        
        // Slide out current image
        img_element.css({
            'transform': slideOutTransform,
            'opacity': '0.3',
            'transition': 'transform 0.3s ease-out, opacity 0.3s ease-out'
        });
        
        setTimeout(() => {
            // Update image source and data
            img_element.attr('src', image_urls[new_index]);
            gallery_card.data('current-image', new_index);
            gallery_card.attr('data-current-image', new_index);
            
            // Position new image offscreen from opposite direction
            img_element.css({
                'transform': slideInStart,
                'opacity': '0.3'
            });
            
            // Slide in new image
            setTimeout(() => {
                img_element.css({
                    'transform': 'translateX(0) scale(1)',
                    'opacity': '1',
                    'transition': 'transform 0.4s ease-in, opacity 0.4s ease-in'
                });
                
                // Clean up after animation completes
                setTimeout(() => {
                    img_element.removeClass('transitioning').css({
                        'transform': '',
                        'opacity': '',
                        'transition': ''
                    });
                }, 400);
            }, 50);
            
            // Update indicator
            const indicator = gallery_card.find('.current-image');
            if (indicator.length > 0) {
                indicator.text(new_index + 1);
            }
            
            // Update progress bar
            const progressFill = gallery_card.find('.gallery-progress-fill');
            if (progressFill.length > 0) {
                const progressPercent = ((new_index + 1) / image_urls.length) * 100;
                progressFill.css({
                    'width': progressPercent + '%',
                    'transition': 'width 0.3s ease-in-out'
                });
            }
            
        }, 150);
    }
    
    apply_theme() {
        // Apply theme settings if theme manager is available
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.applySavedTheme();
        }
    }
    
    setup_initial_breadcrumbs() {
        frappe.breadcrumbs.clear();
        frappe.breadcrumbs.add("Workspace", "/app/flansa-workspace");
        frappe.breadcrumbs.add("Reports", "/app/flansa-saved-reports");
        frappe.breadcrumbs.add("Loading...");
        
        // Also setup initial custom breadcrumbs
        this.render_custom_breadcrumbs(null);
    }
    
    async update_breadcrumbs(report) {
        frappe.breadcrumbs.clear();
        frappe.breadcrumbs.add("Workspace", "/app/flansa-workspace");
        
        // Initialize cache if not exists (cache for current session)
        if (!window.flansaBreadcrumbCache) {
            window.flansaBreadcrumbCache = {};
        }
        
        // Try to get context information from the report
        if (report.base_table) {
            try {
                // Check cache first for table data
                const table_cache_key = `table_${report.base_table}`;
                let table_data = window.flansaBreadcrumbCache[table_cache_key];
                
                if (!table_data) {
                    // Get table information if not cached
                    const table_response = await frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            doctype: 'Flansa Table',
                            filters: { name: report.base_table },
                            fieldname: ['table_label', 'application']
                        }
                    });
                    
                    if (table_response.message) {
                        table_data = table_response.message;
                        // Cache for 5 minutes
                        window.flansaBreadcrumbCache[table_cache_key] = table_data;
                        setTimeout(() => delete window.flansaBreadcrumbCache[table_cache_key], 5 * 60 * 1000);
                    }
                }
                
                if (table_data) {
                    // Store table label for use in subtitles
                    this.table_label = table_data.table_label;
                    
                    // If we have app context, add it
                    if (table_data.application) {
                        const app_cache_key = `app_${table_data.application}`;
                        let app_data = window.flansaBreadcrumbCache[app_cache_key];
                        
                        if (!app_data) {
                            try {
                                const app_response = await frappe.call({
                                    method: 'frappe.client.get_value',
                                    args: {
                                        doctype: 'Flansa Application',
                                        filters: { name: table_data.application },
                                        fieldname: ['app_title']
                                    }
                                });
                                
                                if (app_response.message) {
                                    app_data = app_response.message;
                                    // Cache for 5 minutes
                                    window.flansaBreadcrumbCache[app_cache_key] = app_data;
                                    setTimeout(() => delete window.flansaBreadcrumbCache[app_cache_key], 5 * 60 * 1000);
                                    
                                    // Show app name indicator
                                    this.show_app_name_indicator(app_data.app_title);
                                }
                            } catch (error) {
                                console.log('Could not fetch app data for breadcrumbs');
                            }
                        }
                        
                        if (app_data) {
                            frappe.breadcrumbs.add(
                                app_data.app_title || table_data.application,
                                `/app/flansa-app-dashboard/${table_data.application}`
                            );
                            
                            // Show app name indicator if we have cached data
                            this.show_app_name_indicator(app_data.app_title || table_data.application);
                        }
                    }
                    
                    // Add table context
                    frappe.breadcrumbs.add(
                        table_data.table_label || report.base_table,
                        `/app/flansa-table-builder/${report.base_table}`
                    );
                    
                    // Add reports context with table filter
                    frappe.breadcrumbs.add(
                        "Reports",
                        `/app/flansa-saved-reports?table=${report.base_table}`
                    );
                }
            } catch (error) {
                // Fallback to general reports
                frappe.breadcrumbs.add("Reports", "/app/flansa-saved-reports");
            }
        } else {
            // General reports
            frappe.breadcrumbs.add("Reports", "/app/flansa-saved-reports");
        }
        
        // Add current report with breadcrumb overflow handling
        const report_title = report.title || "Report";
        // Truncate long titles for breadcrumb display
        const display_title = report_title.length > 30 ? report_title.substring(0, 27) + '...' : report_title;
        frappe.breadcrumbs.add(display_title);
        
        // Also populate our custom breadcrumb container
        this.render_custom_breadcrumbs(report);
    }
    
    render_custom_breadcrumbs(report) {
        const breadcrumbContainer = document.getElementById('breadcrumb-container');
        if (!breadcrumbContainer) return;
        
        // Build breadcrumb items based on current context
        const breadcrumbs = [];
        
        // Always start with Workspace
        breadcrumbs.push({ text: "🏠 Workspace", url: "/app/flansa-workspace" });
        
        if (report && report.base_table) {
            // Add context based on the table
            breadcrumbs.push({ text: "🔧 Table Builder", url: `/app/flansa-table-builder/${report.base_table}` });
            breadcrumbs.push({ text: "📊 Reports", url: `/app/flansa-saved-reports?table=${report.base_table}` });
            
            // Current report
            const report_title = report.title || "Report";
            const display_title = report_title.length > 20 ? report_title.substring(0, 17) + '...' : report_title;
            breadcrumbs.push({ text: `📋 ${display_title}` });
        } else {
            breadcrumbs.push({ text: "📊 Reports", url: "/app/flansa-saved-reports" });
            breadcrumbs.push({ text: "📋 Report Viewer" });
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
    
    update_banner_record_count() {
        // Update banner subtitle to include current record count
        if (this.current_report_config && this.current_report_data) {
            const report = {
                base_table: this.current_report_config.base_table,
                created_on: new Date(), // Placeholder
                description: this.current_report_config.description
            };
            
            // Use table label if available, fallback to internal name
            const table_display_name = this.table_label || report.base_table;
            let subtitle = `Table: ${table_display_name}`;
            
            // Add record count (use total unfiltered count)
            const totalRecords = this.total_unfiltered_records || this.current_report_data.total;
            if (totalRecords !== undefined) {
                subtitle += ` • ${totalRecords} record${totalRecords !== 1 ? 's' : ''}`;
            }
            
            // Add fields count
            if (this.current_report_config.selected_fields) {
                const fieldCount = this.current_report_config.selected_fields.length;
                subtitle += ` • ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`;
            }
            
            if (report.description && report.description.trim()) {
                subtitle += ` • ${report.description}`;
            }
            
            if ($('#report-meta-display').length) {
                $('#report-meta-display').text(subtitle);
            }
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
    }
    
    setup_navigation_with_context(report) {
        // Note: We'll add buttons that don't conflict with existing ones
        
        // Add context-specific navigation
        if (report.base_table) {
            // Try to get app context from table
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Flansa Table',
                    filters: { name: report.base_table },
                    fieldname: ['application']
                },
                callback: (r) => {
                    if (r.message && r.message.application) {
                        // Add App Settings button if we have app context
                        this.page.add_button('⚙️ App Settings', () => {
                            window.location.href = `/app/flansa-app-dashboard/${r.message.application}`;
                        }, 'btn-default');
                    }
                    
                    // Add Table Settings button
                    this.page.add_button('🔗 Table Settings', () => {
                        window.location.href = `/app/flansa-table-builder/${report.base_table}`;
                    }, 'btn-default');
                    
                    // Add standard navigation buttons (same as Report Builder)
                    this.page.add_button('🏠 Workspace', () => {
                        window.location.href = '/app/flansa-workspace';
                    }, 'btn-default');
                }
            });
        } else {
            // Fallback: add standard navigation (same as Report Builder)
            this.page.add_button('🏠 Workspace', () => {
                window.location.href = '/app/flansa-workspace';
            }, 'btn-default');
        }
        
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
    
    handle_context_menu_action(action) {
        switch (action) {
            case 'theme':
                if (window.FlansaThemeManager) {
                    window.FlansaThemeManager.showThemeSettings(() => { this.apply_theme(); });
                } else {
                    frappe.show_alert('Theme manager not available', 'orange');
                }
                break;
                
            case 'refresh-cache':
                if (window.flansaBrowserCacheManager) {
                    window.flansaBrowserCacheManager.refreshAllAssets();
                    frappe.show_alert('Cache cleared successfully!', 'green');
                } else {
                    window.location.reload(true);
                }
                break;
                
            case 'export-data':
                if (this.current_report_data && this.current_report_data.data) {
                    this.export_report_data();
                } else {
                    frappe.show_alert('No data to export', 'orange');
                }
                break;
                
            case 'keyboard-shortcuts':
                this.show_keyboard_shortcuts();
                break;
                
            default:
                frappe.show_alert('Unknown action: ' + action, 'orange');
        }
    }
    
    export_report_data() {
        try {
            const data = this.current_report_data.data;
            const fields = this.current_report_config.selected_fields;
            
            // Create CSV content
            const headers = fields.map(f => f.label || f.fieldname).join(',');
            const rows = data.map(record => {
                return fields.map(field => {
                    const value = record[field.fieldname] || '';
                    // Escape quotes and wrap in quotes if contains comma
                    const stringValue = String(value).replace(/"/g, '""');
                    return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
                }).join(',');
            });
            
            const csvContent = [headers, ...rows].join('\n');
            
            // Download CSV file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.current_report_config.title || 'report'}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            frappe.show_alert('Report exported successfully!', 'green');
        } catch (error) {
            console.error('Export error:', error);
            frappe.show_alert('Export failed: ' + error.message, 'red');
        }
    }
    
    show_keyboard_shortcuts() {
        const shortcuts = [
            { key: 'Ctrl/Cmd + R', action: 'Refresh data' },
            { key: 'T', action: 'Switch to table view' },
            { key: 'G', action: 'Switch to tile view' },
            { key: 'E', action: 'Edit report' },
            { key: 'Esc', action: 'Close dialogs' }
        ];
        
        let content = '<div style="font-family: monospace; line-height: 1.6;">';
        content += '<h4 style="margin-bottom: 15px;">⌨️ Keyboard Shortcuts</h4>';
        shortcuts.forEach(shortcut => {
            content += `<div style="margin-bottom: 8px;"><strong>${shortcut.key}</strong> - ${shortcut.action}</div>`;
        });
        content += '</div>';
        
        frappe.msgprint({
            title: 'Keyboard Shortcuts',
            message: content,
            indicator: 'blue'
        });
    }
    
    show_app_name_indicator(app_title) {
        if (app_title) {
            $('#app-name-text').text(app_title);
            $('#app-name-indicator').show();
        }
    }
    
    // Record actions for all modes (table direct and saved reports)
    view_record(recordName) {
        const tableName = this.get_table_name();
        if (!tableName) return;
        
        console.log('🔍 Navigating to view record:', { table: tableName, record: recordName });
        
        // Always use direct frappe.set_route for now - more reliable
        frappe.set_route('flansa-record-viewer', tableName, recordName);
    }
    
    edit_record(recordName) {
        const tableName = this.get_table_name();
        if (!tableName) return;
        
        console.log('✏️ Navigating to edit record:', { table: tableName, record: recordName });
        
        // Navigate to record first, then add edit mode via URL manipulation
        frappe.set_route('flansa-record-viewer', tableName, recordName);
        
        // Add edit mode parameter after navigation
        setTimeout(() => {
            if (window.location.pathname.includes(recordName)) {
                const newUrl = window.location.pathname + '?mode=edit';
                window.history.replaceState({}, '', newUrl);
                // Trigger a custom event to let the record viewer know about the mode change
                $(document).trigger('flansa:mode-changed', { mode: 'edit' });
            }
        }, 200);
    }
    
    navigate_to_new_record() {
        const tableName = this.get_table_name();
        if (!tableName) {
            console.error('No table name available for creating new record');
            frappe.msgprint('Unable to determine table for new record creation');
            return;
        }
        
        console.log('➕ Navigating to create new record for table:', tableName);
        
        // Use FlansaNav if available, otherwise use frappe.set_route
        if (window.FlansaNav) {
            window.FlansaNav.navigateToNewRecord(tableName);
        } else {
            frappe.set_route('flansa-record-viewer', tableName, 'new');
        }
    }
    
    async delete_record(recordName) {
        const tableName = this.get_table_name();
        if (!tableName) return;
        
        const confirmed = await new Promise(resolve => {
            frappe.confirm(
                `Are you sure you want to delete record "${recordName}"?`,
                () => resolve(true),
                () => resolve(false)
            );
        });
        
        if (!confirmed) return;
        
        try {
            // Use data service if available, otherwise direct API call
            if (window.FlansaDataService) {
                const result = await window.FlansaDataService.deleteRecord(tableName, recordName);
                if (result) {
                    // Refresh the data
                    await this.execute_report({
                        base_table: tableName,
                        config: this.current_report_config
                    });
                }
            } else {
                const response = await frappe.call({
                    method: 'flansa.flansa_core.api.table_api.delete_record',
                    args: {
                        table_name: tableName,
                        record_name: recordName
                    }
                });
                
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: 'Record deleted successfully',
                        indicator: 'green'
                    });
                    
                    // Refresh the data
                    await this.execute_report({
                        base_table: tableName,
                        config: this.current_report_config
                    });
                } else {
                    frappe.show_alert({
                        message: 'Failed to delete record: ' + (response.message?.error || 'Unknown error'),
                        indicator: 'red'
                    });
                }
            }
            
        } catch (error) {
            console.error('Error deleting record:', error);
            frappe.show_alert({
                message: 'Error deleting record: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    // Additional helper methods for saving current view
    async save_current_view_as_report() {
        const tableName = this.get_table_name();
        if (!tableName) return;
        
        const reportName = await new Promise(resolve => {
            frappe.prompt([{
                fieldname: 'report_name',
                label: 'Report Name',
                fieldtype: 'Data',
                reqd: true,
                default: `${tableName} Custom Report`
            }, {
                fieldname: 'description',
                label: 'Description',
                fieldtype: 'Small Text'
            }], (values) => {
                resolve(values);
            }, 'Save Current View as Report');
        });
        
        if (!reportName) return;
        
        try {
            // Create a saved report with current configuration
            const response = await frappe.call({
                method: 'flansa.flansa_core.doctype.flansa_saved_report.flansa_saved_report.create_report',
                args: {
                    title: reportName.report_name,
                    description: reportName.description || '',
                    base_table: tableName,
                    config: {
                        base_table: tableName,
                        selected_fields: this.current_report_config.selected_fields,
                        filters: [],
                        sort: [{ field: 'modified', order: 'desc' }],
                        show_actions: this.should_show_action_buttons() // Include current action button setting
                    }
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: 'Report saved successfully!',
                    indicator: 'green'
                });
                
                // Optionally redirect to the saved report
                frappe.confirm(
                    'Would you like to open the saved report?',
                    () => {
                        window.location.href = `/app/flansa-report-viewer/${response.message.report_id}`;
                    }
                );
            } else {
                frappe.show_alert({
                    message: 'Failed to save report: ' + (response.message?.error || 'Unknown error'),
                    indicator: 'red'
                });
            }
            
        } catch (error) {
            console.error('Error saving report:', error);
            frappe.show_alert({
                message: 'Error saving report: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async refresh_data() {
        frappe.show_alert({
            message: 'Refreshing data...',
            indicator: 'blue'
        });
        
        if (this.current_report_config) {
            const tableName = this.get_table_name();
            await this.execute_report({
                base_table: tableName,
                config: this.current_report_config
            });
        }
    }
    
    // Helper method to determine if action buttons should be shown
    should_show_action_buttons() {
        // For table direct mode, always show actions
        if (this.is_table_direct) {
            return true;
        }
        
        // For saved reports, check configuration
        if (this.current_report_config && this.current_report_config.show_actions !== undefined) {
            return this.current_report_config.show_actions;
        }
        
        // Default: show actions for saved reports too
        return true;
    }
    
    // Helper method to get table name for navigation
    get_table_name() {
        let tableName = null;
        
        if (this.is_table_direct) {
            tableName = this.table_name;
        } else if (this.current_report_config) {
            // For saved reports, get from config
            tableName = this.current_report_config.base_table;
        }
        
        console.log('🔧 get_table_name():', {
            is_table_direct: this.is_table_direct,
            table_name: this.table_name,
            config_base_table: this.current_report_config?.base_table,
            resolved_table_name: tableName
        });
        
        return tableName;
    }
}

// Initialize the Report Viewer when page loads
frappe.pages['flansa-report-viewer'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Report Viewer',
        single_column: true
    });
    
    // Add standardized Back button
    setTimeout(() => {
        if (window.FlansaNav && typeof window.FlansaNav.addBackButton === 'function') {
            window.FlansaNav.addBackButton(page);
        } else {
            // Fallback: Add back button directly
            page.add_button('← Back', () => {
                window.history.back();
            }, 'btn-default');
        }
    }, 100);
    
    // Load the HTML template
    $(page.body).html(frappe.render_template('flansa_report_viewer'));
    
    // Initialize the viewer
    window.report_viewer = new FlansaReportViewer(page);
};

console.log("Basic Flansa Report Viewer loaded successfully!");
// Apply theme on page load
$(document).ready(function() {
    if (window.page_instance && window.page_instance.apply_theme) {
        window.page_instance.apply_theme();
    }
});
