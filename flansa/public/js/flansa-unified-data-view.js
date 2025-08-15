/**
 * Flansa Unified Data View System
 * Modern data viewing system inspired by Airtable, Notion, and Salesforce
 * Single component handles both table records and reports with multiple view modes
 */

class FlansaUnifiedDataView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            // Data source
            data_source: options.data_source, // 'table' or 'report'
            source_id: options.source_id, // table_name or report_id
            
            // View modes
            default_view: options.default_view || 'table',
            available_views: options.available_views || ['table', 'grid', 'kanban', 'calendar'],
            
            // Features
            enable_search: options.enable_search !== false,
            enable_filters: options.enable_filters !== false,
            enable_sorting: options.enable_sorting !== false,
            enable_grouping: options.enable_grouping !== false,
            enable_exports: options.enable_exports !== false,
            enable_inline_edit: options.enable_inline_edit !== false,
            
            // Pagination
            page_size: options.page_size || 25,
            virtual_scrolling: options.virtual_scrolling || false,
            
            // Customization
            allow_view_config: options.allow_view_config !== false,
            allow_column_config: options.allow_column_config !== false,
            
            // Callbacks
            on_record_click: options.on_record_click,
            on_record_edit: options.on_record_edit,
            on_record_delete: options.on_record_delete
        };
        
        // State
        this.current_view = this.options.default_view;
        this.current_page = 1;
        this.search_term = '';
        this.filters = [];
        this.sort_config = [];
        this.group_by = null;
        this.selected_records = new Set();
        this.view_configs = this.loadViewConfigs();
        
        // Data
        this.data = [];
        this.columns = [];
        this.total_records = 0;
        this.loading = false;
        
        this.init();
    }
    
    init() {
        this.createLayout();
        this.bindEvents();
        this.loadData();
        this.applyTheme();
    }
    
    createLayout() {
        const layout = `
            <div class="flansa-unified-data-view" style="height: 100%; display: flex; flex-direction: column;">
                <!-- Toolbar -->
                <div class="data-view-toolbar" style="background: var(--flansa-background, #f8f9fa); border-bottom: 1px solid var(--flansa-border, #e0e6ed); padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <!-- View Mode Switcher -->
                    <div class="view-mode-switcher" style="display: flex; background: white; border-radius: 6px; border: 1px solid var(--flansa-border, #e0e6ed); overflow: hidden;">
                        ${this.options.available_views.map(view => `
                            <button class="view-mode-btn" data-view="${view}" style="padding: 6px 12px; border: none; background: transparent; cursor: pointer; transition: all 0.2s; ${view === this.current_view ? 'background: var(--flansa-primary, #007bff); color: white;' : ''}">
                                <i class="fa ${this.getViewIcon(view)}"></i>
                                <span style="margin-left: 4px; text-transform: capitalize;">${view}</span>
                            </button>
                        `).join('')}
                    </div>
                    
                    <!-- Search -->
                    ${this.options.enable_search ? `
                        <div class="search-container" style="flex: 1; max-width: 300px; position: relative;">
                            <input type="text" id="unified-search" placeholder="Search records..." style="width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 4px; font-size: 14px;">
                            <i class="fa fa-search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--flansa-text-secondary, #6c757d);"></i>
                        </div>
                    ` : ''}
                    
                    <!-- Action Buttons -->
                    <div class="action-buttons" style="display: flex; gap: 8px; margin-left: auto;">
                        ${this.options.enable_filters ? `
                            <button id="filter-btn" class="btn btn-light" style="padding: 8px 12px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 4px; background: white; display: flex; align-items: center; gap: 6px;">
                                <i class="fa fa-filter"></i>
                                <span>Filter</span>
                                <span id="filter-count" class="badge" style="display: none; background: var(--flansa-primary, #007bff); color: white; border-radius: 10px; padding: 2px 6px; font-size: 10px;"></span>
                            </button>
                        ` : ''}
                        
                        ${this.options.enable_grouping ? `
                            <button id="group-btn" class="btn btn-light" style="padding: 8px 12px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 4px; background: white; display: flex; align-items: center; gap: 6px;">
                                <i class="fa fa-layer-group"></i>
                                <span>Group</span>
                            </button>
                        ` : ''}
                        
                        ${this.options.allow_view_config ? `
                            <button id="view-config-btn" class="btn btn-light" style="padding: 8px 12px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 4px; background: white; display: flex; align-items: center; gap: 6px;">
                                <i class="fa fa-cog"></i>
                                <span>Configure</span>
                            </button>
                        ` : ''}
                        
                        ${this.options.enable_exports ? `
                            <div class="dropdown" style="position: relative;">
                                <button id="export-btn" class="btn btn-light" style="padding: 8px 12px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 4px; background: white; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa fa-download"></i>
                                    <span>Export</span>
                                    <i class="fa fa-caret-down"></i>
                                </button>
                                <div id="export-menu" class="dropdown-menu" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 120px; z-index: 1000;">
                                    <button class="export-option" data-format="csv" style="width: 100%; padding: 8px 12px; border: none; background: transparent; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                        <i class="fa fa-file-csv"></i>
                                        <span>CSV</span>
                                    </button>
                                    <button class="export-option" data-format="excel" style="width: 100%; padding: 8px 12px; border: none; background: transparent; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                        <i class="fa fa-file-excel"></i>
                                        <span>Excel</span>
                                    </button>
                                    <button class="export-option" data-format="pdf" style="width: 100%; padding: 8px 12px; border: none; background: transparent; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                        <i class="fa fa-file-pdf"></i>
                                        <span>PDF</span>
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Active Filters Display -->
                <div id="active-filters" class="active-filters" style="display: none; padding: 8px 16px; background: var(--flansa-background-secondary, #ffffff); border-bottom: 1px solid var(--flansa-border, #e0e6ed); flex-wrap: wrap; gap: 8px;"></div>
                
                <!-- Data Container -->
                <div class="data-container" style="flex: 1; overflow: hidden; position: relative;">
                    <!-- Loading State -->
                    <div id="loading-state" class="loading-state" style="display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.9); z-index: 100; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center;">
                            <div class="spinner" style="width: 40px; height: 40px; border: 3px solid var(--flansa-border, #e0e6ed); border-top: 3px solid var(--flansa-primary, #007bff); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
                            <p style="color: var(--flansa-text-secondary, #6c757d); margin: 0;">Loading data...</p>
                        </div>
                    </div>
                    
                    <!-- No Data State -->
                    <div id="no-data-state" class="no-data-state" style="display: none; text-align: center; padding: 60px 20px; color: var(--flansa-text-secondary, #6c757d);">
                        <i class="fa fa-database" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                        <h3 style="margin: 0 0 8px 0; font-weight: 600;">No data found</h3>
                        <p style="margin: 0;">Try adjusting your search or filter criteria</p>
                    </div>
                    
                    <!-- Data Views -->
                    <div id="table-view" class="data-view" style="display: none; height: 100%; overflow: auto;">
                        <table class="table table-hover" style="margin: 0; background: white;">
                            <thead style="background: var(--flansa-background, #f8f9fa); position: sticky; top: 0; z-index: 10;">
                            </thead>
                            <tbody>
                            </tbody>
                        </table>
                    </div>
                    
                    <div id="grid-view" class="data-view" style="display: none; height: 100%; overflow: auto; padding: 16px;">
                        <div class="grid-container" style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));"></div>
                    </div>
                    
                    <div id="kanban-view" class="data-view" style="display: none; height: 100%; overflow: auto; padding: 16px;">
                        <div class="kanban-container" style="display: flex; gap: 16px; min-height: 100%;"></div>
                    </div>
                    
                    <div id="calendar-view" class="data-view" style="display: none; height: 100%; overflow: auto;">
                        <div class="calendar-container" style="height: 100%;"></div>
                    </div>
                </div>
                
                <!-- Pagination -->
                <div class="pagination-container" style="padding: 12px 16px; background: var(--flansa-background, #f8f9fa); border-top: 1px solid var(--flansa-border, #e0e6ed); display: flex; align-items: center; justify-content: between;">
                    <div class="record-info" style="color: var(--flansa-text-secondary, #6c757d); font-size: 14px;">
                        <span id="record-range">0-0</span> of <span id="total-records">0</span> records
                        <span id="selected-info" style="margin-left: 12px; display: none;">
                            (<span id="selected-count">0</span> selected)
                        </span>
                    </div>
                    <div class="pagination-controls" style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
                        <button id="prev-page" class="btn btn-sm btn-light" disabled>
                            <i class="fa fa-chevron-left"></i>
                        </button>
                        <span id="page-info" style="padding: 0 12px; font-size: 14px;">Page 1 of 1</span>
                        <button id="next-page" class="btn btn-sm btn-light" disabled>
                            <i class="fa fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .flansa-unified-data-view .view-mode-btn:hover {
                    background: var(--flansa-background, #f8f9fa) !important;
                }
                
                .flansa-unified-data-view .view-mode-btn.active {
                    background: var(--flansa-primary, #007bff) !important;
                    color: white !important;
                }
                
                .flansa-unified-data-view .table th {
                    background: var(--flansa-background, #f8f9fa);
                    border-bottom: 2px solid var(--flansa-border, #e0e6ed);
                    font-weight: 600;
                    padding: 12px;
                    user-select: none;
                    cursor: pointer;
                }
                
                .flansa-unified-data-view .table th:hover {
                    background: var(--flansa-background-hover, #e9ecef);
                }
                
                .flansa-unified-data-view .table td {
                    padding: 12px;
                    border-bottom: 1px solid var(--flansa-border, #e0e6ed);
                    vertical-align: middle;
                }
                
                .flansa-unified-data-view .table tbody tr:hover {
                    background: var(--flansa-background-hover, #f8f9fa);
                }
                
                .flansa-unified-data-view .grid-card {
                    background: white;
                    border: 1px solid var(--flansa-border, #e0e6ed);
                    border-radius: 8px;
                    padding: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .flansa-unified-data-view .grid-card:hover {
                    border-color: var(--flansa-primary, #007bff);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                
                .flansa-unified-data-view .kanban-column {
                    background: var(--flansa-background, #f8f9fa);
                    border-radius: 8px;
                    padding: 16px;
                    min-width: 300px;
                    min-height: 400px;
                }
                
                .flansa-unified-data-view .kanban-card {
                    background: white;
                    border: 1px solid var(--flansa-border, #e0e6ed);
                    border-radius: 6px;
                    padding: 12px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .flansa-unified-data-view .kanban-card:hover {
                    border-color: var(--flansa-primary, #007bff);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                
                .flansa-unified-data-view .filter-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: var(--flansa-primary, #007bff);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .flansa-unified-data-view .filter-chip .remove-filter {
                    cursor: pointer;
                    opacity: 0.8;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                }
                
                .flansa-unified-data-view .filter-chip .remove-filter:hover {
                    opacity: 1;
                    background: rgba(255,255,255,0.3);
                }
            </style>
        `;
        
        $(this.container).html(layout);
    }
    
    getViewIcon(view) {
        const icons = {
            table: 'fa-table',
            grid: 'fa-th',
            kanban: 'fa-columns',
            calendar: 'fa-calendar',
            chart: 'fa-chart-bar'
        };
        return icons[view] || 'fa-eye';
    }
    
    bindEvents() {
        const container = $(this.container);
        
        // View mode switching
        container.on('click', '.view-mode-btn', (e) => {
            const view = $(e.currentTarget).data('view');
            this.switchView(view);
        });
        
        // Search
        if (this.options.enable_search) {
            container.on('input', '#unified-search', this.debounce((e) => {
                this.search_term = $(e.target).val();
                this.currentPage = 1;
                this.loadData();
            }, 300));
        }
        
        // Pagination
        container.on('click', '#prev-page', () => {
            if (this.current_page > 1) {
                this.current_page--;
                this.loadData();
            }
        });
        
        container.on('click', '#next-page', () => {
            const totalPages = Math.ceil(this.total_records / this.options.page_size);
            if (this.current_page < totalPages) {
                this.current_page++;
                this.loadData();
            }
        });
        
        // Export functionality
        if (this.options.enable_exports) {
            container.on('click', '#export-btn', (e) => {
                e.stopPropagation();
                container.find('#export-menu').toggle();
            });
            
            container.on('click', '.export-option', (e) => {
                const format = $(e.currentTarget).data('format');
                this.exportData(format);
                container.find('#export-menu').hide();
            });
            
            $(document).on('click', (e) => {
                if (!$(e.target).closest('#export-btn, #export-menu').length) {
                    container.find('#export-menu').hide();
                }
            });
        }
        
        // Filter and group buttons
        container.on('click', '#filter-btn', () => this.showFilterDialog());
        container.on('click', '#group-btn', () => this.showGroupDialog());
        container.on('click', '#view-config-btn', () => this.showViewConfigDialog());
        
        // Table sorting
        container.on('click', '.table th[data-sortable]', (e) => {
            const field = $(e.currentTarget).data('field');
            this.toggleSort(field);
        });
        
        // Record selection and actions
        container.on('click', '.record-row', (e) => {
            if (!$(e.target).is('input[type="checkbox"]')) {
                const recordId = $(e.currentTarget).data('record-id');
                if (this.options.on_record_click) {
                    this.options.on_record_click(recordId, this.data.find(r => r.id === recordId));
                }
            }
        });
        
        container.on('change', '.record-checkbox', (e) => {
            const recordId = $(e.currentTarget).data('record-id');
            if ($(e.currentTarget).is(':checked')) {
                this.selected_records.add(recordId);
            } else {
                this.selected_records.delete(recordId);
            }
            this.updateSelectionUI();
        });
    }
    
    switchView(view) {
        if (this.current_view === view) return;
        
        // Update button states
        $(this.container).find('.view-mode-btn').removeClass('active');
        $(this.container).find(`.view-mode-btn[data-view="${view}"]`).addClass('active');
        
        // Hide all views
        $(this.container).find('.data-view').hide();
        
        // Show selected view
        $(this.container).find(`#${view}-view`).show();
        
        this.current_view = view;
        this.renderCurrentView();
        this.saveViewConfig();
    }
    
    async loadData() {
        this.loading = true;
        this.showLoading();
        
        try {
            const params = {
                page: this.current_page,
                page_size: this.options.page_size,
                search: this.search_term,
                filters: this.filters,
                sort: this.sort_config,
                group_by: this.group_by
            };
            
            let response;
            if (this.options.data_source === 'table') {
                // Create a temporary report config for table data
                const reportConfig = {
                    table_name: this.options.source_id,
                    fields: [], // Auto-select all fields
                    filters: this.filters,
                    sort_by: this.sort_config,
                    search_term: this.search_term,
                    limit: this.options.page_size,
                    offset: (this.current_page - 1) * this.options.page_size
                };
                
                response = await frappe.call({
                    method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                    args: {
                        report_config: reportConfig,
                        view_options: {
                            view_mode: this.current_view,
                            page: this.current_page,
                            page_size: this.options.page_size
                        }
                    }
                });
            } else {
                // For saved reports, use the same method with different config
                response = await frappe.call({
                    method: 'flansa.flansa_core.api.report_builder_api.execute_report',
                    args: {
                        report_config: {
                            report_id: this.options.source_id,
                            filters: this.filters,
                            sort_by: this.sort_config,
                            search_term: this.search_term,
                            limit: this.options.page_size,
                            offset: (this.current_page - 1) * this.options.page_size
                        },
                        view_options: {
                            view_mode: this.current_view,
                            page: this.current_page,
                            page_size: this.options.page_size
                        }
                    }
                });
            }
            
            if (response.message && response.message.success) {
                this.data = response.message.data || [];
                this.columns = response.message.columns || [];
                this.total_records = response.message.total_count || 0;
                
                this.renderCurrentView();
                this.updatePagination();
                this.hideLoading();
                
                if (this.data.length === 0) {
                    this.showNoData();
                } else {
                    this.hideNoData();
                }
            } else {
                throw new Error(response.message?.error || 'Failed to load data');
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Error loading data: ' + error.message);
        } finally {
            this.loading = false;
        }
    }
    
    renderCurrentView() {
        switch (this.current_view) {
            case 'table':
                this.renderTableView();
                break;
            case 'grid':
                this.renderGridView();
                break;
            case 'kanban':
                this.renderKanbanView();
                break;
            case 'calendar':
                this.renderCalendarView();
                break;
        }
    }
    
    renderTableView() {
        const table = $(this.container).find('#table-view table');
        const thead = table.find('thead');
        const tbody = table.find('tbody');
        
        // Render headers
        let headerHtml = '<tr>';
        if (this.options.allow_selection) {
            headerHtml += '<th style="width: 40px;"><input type="checkbox" id="select-all"></th>';
        }
        
        this.columns.forEach(col => {
            const sortIcon = this.getSortIcon(col.field);
            headerHtml += `
                <th data-field="${col.field}" data-sortable="true" style="cursor: pointer;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span>${col.label}</span>
                        <i class="fa ${sortIcon}" style="margin-left: 6px; opacity: 0.5;"></i>
                    </div>
                </th>
            `;
        });
        headerHtml += '</tr>';
        thead.html(headerHtml);
        
        // Render rows
        let bodyHtml = '';
        this.data.forEach(record => {
            bodyHtml += '<tr class="record-row" data-record-id="' + record.id + '">';
            
            if (this.options.allow_selection) {
                const checked = this.selected_records.has(record.id) ? 'checked' : '';
                bodyHtml += `<td><input type="checkbox" class="record-checkbox" data-record-id="${record.id}" ${checked}></td>`;
            }
            
            this.columns.forEach(col => {
                const value = this.formatCellValue(record[col.field], col);
                bodyHtml += `<td>${value}</td>`;
            });
            
            bodyHtml += '</tr>';
        });
        tbody.html(bodyHtml);
    }
    
    renderGridView() {
        const container = $(this.container).find('.grid-container');
        let html = '';
        
        this.data.forEach(record => {
            html += `
                <div class="grid-card" data-record-id="${record.id}">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--flansa-text-primary, #495057);">
                        ${record[this.getPrimaryField()] || 'Untitled'}
                    </div>
                    ${this.columns.slice(0, 4).map(col => `
                        <div style="margin-bottom: 6px; font-size: 14px;">
                            <span style="color: var(--flansa-text-secondary, #6c757d); font-weight: 500;">${col.label}:</span>
                            <span style="margin-left: 6px;">${this.formatCellValue(record[col.field], col)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        container.html(html);
    }
    
    renderKanbanView() {
        // Implement kanban view based on group_by field
        const container = $(this.container).find('.kanban-container');
        
        if (!this.group_by) {
            container.html('<p style="text-align: center; padding: 40px; color: var(--flansa-text-secondary, #6c757d);">Please select a field to group by for Kanban view</p>');
            return;
        }
        
        // Group data by the selected field
        const groups = this.groupDataBy(this.group_by);
        let html = '';
        
        Object.keys(groups).forEach(groupKey => {
            const records = groups[groupKey];
            html += `
                <div class="kanban-column">
                    <h6 style="margin: 0 0 16px 0; font-weight: 600; color: var(--flansa-text-primary, #495057);">
                        ${groupKey || 'Untitled'} (${records.length})
                    </h6>
                    ${records.map(record => `
                        <div class="kanban-card" data-record-id="${record.id}">
                            <div style="font-weight: 500; margin-bottom: 6px;">
                                ${record[this.getPrimaryField()] || 'Untitled'}
                            </div>
                            ${this.columns.slice(0, 2).map(col => {
                                if (col.field !== this.group_by) {
                                    return `
                                        <div style="font-size: 12px; color: var(--flansa-text-secondary, #6c757d);">
                                            ${this.formatCellValue(record[col.field], col)}
                                        </div>
                                    `;
                                }
                                return '';
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        container.html(html);
    }
    
    renderCalendarView() {
        // Implement calendar view for date-based data
        const container = $(this.container).find('.calendar-container');
        container.html('<p style="text-align: center; padding: 40px; color: var(--flansa-text-secondary, #6c757d);">Calendar view coming soon...</p>');
    }
    
    // Utility methods
    getSortIcon(field) {
        const sortConfig = this.sort_config.find(s => s.field === field);
        if (!sortConfig) return 'fa-sort';
        return sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
    }
    
    formatCellValue(value, column) {
        if (value === null || value === undefined) return '';
        
        switch (column.type) {
            case 'Date':
                return new Date(value).toLocaleDateString();
            case 'Datetime':
                return new Date(value).toLocaleString();
            case 'Currency':
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
            case 'Check':
                return value ? '<i class="fa fa-check text-success"></i>' : '<i class="fa fa-times text-muted"></i>';
            case 'Link':
                return `<a href="#" class="text-primary">${value}</a>`;
            default:
                return String(value);
        }
    }
    
    getPrimaryField() {
        return this.columns.length > 0 ? this.columns[0].field : 'name';
    }
    
    groupDataBy(field) {
        const groups = {};
        this.data.forEach(record => {
            const key = record[field] || 'Unassigned';
            if (!groups[key]) groups[key] = [];
            groups[key].push(record);
        });
        return groups;
    }
    
    toggleSort(field) {
        const existingSort = this.sort_config.find(s => s.field === field);
        
        if (existingSort) {
            if (existingSort.direction === 'asc') {
                existingSort.direction = 'desc';
            } else {
                this.sort_config = this.sort_config.filter(s => s.field !== field);
            }
        } else {
            this.sort_config.push({ field, direction: 'asc' });
        }
        
        this.current_page = 1;
        this.loadData();
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.total_records / this.options.page_size);
        const startRecord = (this.current_page - 1) * this.options.page_size + 1;
        const endRecord = Math.min(this.current_page * this.options.page_size, this.total_records);
        
        $(this.container).find('#record-range').text(`${startRecord}-${endRecord}`);
        $(this.container).find('#total-records').text(this.total_records);
        $(this.container).find('#page-info').text(`Page ${this.current_page} of ${totalPages}`);
        
        $(this.container).find('#prev-page').prop('disabled', this.current_page <= 1);
        $(this.container).find('#next-page').prop('disabled', this.current_page >= totalPages);
    }
    
    updateSelectionUI() {
        const selectedCount = this.selected_records.size;
        if (selectedCount > 0) {
            $(this.container).find('#selected-info').show();
            $(this.container).find('#selected-count').text(selectedCount);
        } else {
            $(this.container).find('#selected-info').hide();
        }
    }
    
    showLoading() {
        $(this.container).find('#loading-state').show();
    }
    
    hideLoading() {
        $(this.container).find('#loading-state').hide();
    }
    
    showNoData() {
        $(this.container).find('#no-data-state').show();
        $(this.container).find('.data-view').hide();
    }
    
    hideNoData() {
        $(this.container).find('#no-data-state').hide();
        $(this.container).find(`#${this.current_view}-view`).show();
    }
    
    showError(message) {
        frappe.msgprint(message);
        this.hideLoading();
    }
    
    // Configuration methods
    loadViewConfigs() {
        const saved = localStorage.getItem(`flansa_view_config_${this.options.source_id}`);
        return saved ? JSON.parse(saved) : {};
    }
    
    saveViewConfig() {
        const config = {
            current_view: this.current_view,
            sort_config: this.sort_config,
            filters: this.filters,
            group_by: this.group_by
        };
        localStorage.setItem(`flansa_view_config_${this.options.source_id}`, JSON.stringify(config));
    }
    
    // Dialog methods
    showFilterDialog() {
        // Implement filter dialog
        console.log('Show filter dialog');
    }
    
    showGroupDialog() {
        // Implement group by dialog
        console.log('Show group dialog');
    }
    
    showViewConfigDialog() {
        // Implement view configuration dialog
        console.log('Show view config dialog');
    }
    
    // Export methods
    exportData(format) {
        const data = {
            columns: this.columns,
            data: this.data,
            format: format
        };
        
        frappe.call({
            method: 'flansa.flansa_core.api.export.export_data',
            args: data,
            callback: (response) => {
                if (response.message && response.message.success) {
                    // Download file
                    const link = document.createElement('a');
                    link.href = response.message.download_url;
                    link.download = response.message.filename;
                    link.click();
                } else {
                    frappe.msgprint('Export failed: ' + (response.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    // Utility methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    applyTheme() {
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.applySavedTheme();
        }
    }
}

// Make globally available
window.FlansaUnifiedDataView = FlansaUnifiedDataView;

console.log('🎯 Flansa Unified Data View System loaded');