frappe.pages['flansa-database-viewer'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Database Viewer',
        single_column: true
    });

    page.main.html(frappe.render_template("flansa_database_viewer"));
    
    // Initialize the database viewer
    window.dbViewer = new FlansaDatabaseViewer(page);
};

class FlansaDatabaseViewer {
    constructor(page) {
        this.page = page;
        this.wrapper = page.main;
        this.current_table = null;
        this.current_structure_table = null;
        
        this.init();
    }
    
    init() {
        this.setup_events();
        this.load_tables();
        this.update_status('Database viewer initialized');
    }
    
    setup_events() {
        // Table search
        $(this.wrapper).find('#tableSearch').on('input', (e) => {
            this.filter_tables(e.target.value, '#tableList');
        });
        
        $(this.wrapper).find('#structureTableSearch').on('input', (e) => {
            this.filter_tables(e.target.value, '#structureTableList');
        });
        
        // Refresh table data
        $(this.wrapper).find('#refreshTableData').click(() => {
            if (this.current_table) {
                this.load_table_data(this.current_table);
            }
        });
        
        // Limit change
        $(this.wrapper).find('#limitRows').change(() => {
            if (this.current_table) {
                this.load_table_data(this.current_table);
            }
        });
        
        // SQL execution
        $(this.wrapper).find('#executeSql').click(() => {
            this.execute_sql();
        });
        
        $(this.wrapper).find('#clearSql').click(() => {
            $(this.wrapper).find('#sqlQuery').val('');
            $(this.wrapper).find('#sqlResults').html(`
                <div class="text-center p-4 text-muted">
                    <i class="fa fa-code fa-3x"></i>
                    <p class="mt-2">Write your SQL query above and click Execute</p>
                </div>
            `);
        });
        
        // Orphaned fields scan
        $(this.wrapper).find('#scanOrphanedFields').click(() => {
            this.scan_orphaned_fields();
        });
        
        // Orphaned tables scan
        $(this.wrapper).find('#scanOrphanedTables').click(() => {
            this.scan_orphaned_tables();
        });
        
        // Tab switching
        $(this.wrapper).find('.nav-link').click((e) => {
            e.preventDefault();
            const tabName = $(e.currentTarget).data('tab');
            this.showTab(tabName);
        });
    }
    
    update_status(message) {
        $(this.wrapper).find('#statusMessage').text(message);
    }
    
    showTab(tabName) {
        // Remove active class from all tabs
        $(this.wrapper).find('.nav-link').removeClass('active');
        $(this.wrapper).find('.tab-pane').removeClass('show active');
        
        // Add active class to clicked tab
        $(this.wrapper).find(`#${tabName}-tab`).addClass('active');
        $(this.wrapper).find(`#${tabName}`).addClass('show active');
        
        // Load data for specific tabs
        if (tabName === 'structure') {
            this.load_structure_tables();
        }
    }
    
    load_tables() {
        this.update_status('Loading database tables...');
        
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.get_database_tables',
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_tables(r.message.tables, '#tableList');
                    this.update_status(`Loaded ${r.message.total_count} tables`);
                } else {
                    this.show_error('Failed to load tables: ' + (r.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    load_structure_tables() {
        // Reuse the same table loading for structure tab
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.get_database_tables',
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_tables(r.message.tables, '#structureTableList', 'structure');
                }
            }
        });
    }
    
    render_tables(tables, container_id, mode = 'data') {
        const container = $(this.wrapper).find(container_id);
        
        let html = '';
        tables.forEach(table => {
            const badgeClass = table.is_doctype ? 'bg-primary' : 
                              table.is_custom ? 'bg-warning' : 'bg-secondary';
            const badgeText = table.is_doctype ? 'DocType' : 
                             table.is_custom ? 'Custom' : 'System';
            
            html += `
                <div class="list-group-item list-group-item-action table-item" 
                     data-table="${table.name}" data-mode="${mode}"
                     style="cursor: pointer;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${table.name}</strong>
                            <small class="badge ${badgeClass} ml-2">${badgeText}</small>
                        </div>
                        <i class="fa fa-chevron-right text-muted"></i>
                    </div>
                </div>
            `;
        });
        
        container.html(html);
        
        // Add click events
        container.find('.table-item').click((e) => {
            const tableName = $(e.currentTarget).data('table');
            const mode = $(e.currentTarget).data('mode');
            
            // Remove active state from siblings
            container.find('.table-item').removeClass('active');
            $(e.currentTarget).addClass('active');
            
            if (mode === 'structure') {
                this.load_table_structure(tableName);
            } else {
                this.load_table_data(tableName);
            }
        });
    }
    
    filter_tables(searchTerm, container_id) {
        const container = $(this.wrapper).find(container_id);
        const items = container.find('.table-item');
        
        items.each((i, item) => {
            const tableName = $(item).data('table').toLowerCase();
            if (tableName.includes(searchTerm.toLowerCase())) {
                $(item).show();
            } else {
                $(item).hide();
            }
        });
    }
    
    load_table_data(tableName) {
        this.current_table = tableName;
        const limit = $(this.wrapper).find('#limitRows').val();
        
        this.update_status(`Loading data from ${tableName}...`);
        $(this.wrapper).find('#selectedTableName').text(`Table: ${tableName}`);
        
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.get_table_data',
            args: {
                table_name: tableName,
                limit: limit
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_table_data(r.message);
                    this.update_status(`Showing ${r.message.displayed_rows} of ${r.message.total_rows} rows from ${tableName}`);
                } else {
                    this.show_error('Failed to load table data: ' + (r.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    render_table_data(data) {
        const container = $(this.wrapper).find('#tableData');
        
        if (!data.data || data.data.length === 0) {
            container.html(`
                <div class="text-center p-4 text-muted">
                    <i class="fa fa-inbox fa-3x"></i>
                    <p class="mt-2">No data found in this table</p>
                </div>
            `);
            return;
        }
        
        // Create table HTML with fixed header and scrollable body
        let html = `
            <div class="table-data-container" style="height: 500px; overflow: auto; position: relative;">
                <table class="table table-sm table-striped table-hover" style="margin-bottom: 0;">
                    <thead class="table-dark" style="position: sticky; top: 0; z-index: 10;">
                        <tr>`;
        
        // Header
        data.columns.forEach(col => {
            html += `<th style="white-space: nowrap; background-color: #343a40; position: sticky; top: 0;">${col.Field}</th>`;
        });
        html += '</tr></thead>';
        
        // Body
        html += '<tbody>';
        data.data.forEach(row => {
            html += '<tr>';
            data.columns.forEach(col => {
                let value = row[col.Field];
                if (value === null) {
                    value = '<em class="text-muted">NULL</em>';
                } else if (typeof value === 'string' && value.length > 100) {
                    value = `<span title="${this.escapeHtml(String(value))}">${this.escapeHtml(value.substring(0, 100))}...</span>`;
                } else {
                    value = this.escapeHtml(String(value));
                }
                html += `<td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">${value}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        
        container.html(html);
    }
    
    load_table_structure(tableName) {
        this.current_structure_table = tableName;
        
        this.update_status(`Loading structure for ${tableName}...`);
        $(this.wrapper).find('#selectedStructureTableName').text(`Structure: ${tableName}`);
        
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.get_table_structure',
            args: {
                table_name: tableName
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_table_structure(r.message);
                    this.update_status(`Loaded structure for ${tableName}`);
                } else {
                    this.show_error('Failed to load table structure: ' + (r.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    render_table_structure(data) {
        const container = $(this.wrapper).find('#tableStructure');
        
        let html = '<div class="mb-4">';
        
        // Table Info
        if (data.status) {
            html += `
                <div class="card mb-3">
                    <div class="card-header"><h6>Table Information</h6></div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <strong>Engine:</strong> ${data.status.Engine || 'N/A'}<br>
                                <strong>Rows:</strong> ${data.status.Rows || 'N/A'}<br>
                                <strong>Data Length:</strong> ${this.formatBytes(data.status.Data_length || 0)}
                            </div>
                            <div class="col-md-6">
                                <strong>Index Length:</strong> ${this.formatBytes(data.status.Index_length || 0)}<br>
                                <strong>Collation:</strong> ${data.status.Collation || 'N/A'}<br>
                                <strong>Created:</strong> ${data.status.Create_time || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Column Structure
        html += `
            <div class="card mb-3">
                <div class="card-header"><h6>Columns</h6></div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead class="table-dark">
                                <tr>
                                    <th>Field</th>
                                    <th>Type</th>
                                    <th>Null</th>
                                    <th>Key</th>
                                    <th>Default</th>
                                    <th>Extra</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        data.structure.forEach(col => {
            const keyBadge = col.Key === 'PRI' ? '<span class="badge bg-primary">PRI</span>' :
                           col.Key === 'UNI' ? '<span class="badge bg-info">UNI</span>' :
                           col.Key === 'MUL' ? '<span class="badge bg-secondary">MUL</span>' : '';
            
            html += `
                <tr>
                    <td><strong>${col.Field}</strong></td>
                    <td><code>${col.Type}</code></td>
                    <td>${col.Null}</td>
                    <td>${keyBadge}</td>
                    <td>${col.Default || '<em class="text-muted">NULL</em>'}</td>
                    <td>${col.Extra || ''}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div></div></div>';
        
        // Indexes
        if (data.indexes && data.indexes.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header"><h6>Indexes</h6></div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-sm mb-0">
                                <thead class="table-dark">
                                    <tr>
                                        <th>Key Name</th>
                                        <th>Column</th>
                                        <th>Unique</th>
                                        <th>Type</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            data.indexes.forEach(idx => {
                html += `
                    <tr>
                        <td><strong>${idx.Key_name}</strong></td>
                        <td>${idx.Column_name}</td>
                        <td>${idx.Non_unique === '0' ? 'Yes' : 'No'}</td>
                        <td>${idx.Index_type}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div></div></div>';
        }
        
        html += '</div>';
        container.html(html);
    }
    
    execute_sql() {
        const query = $(this.wrapper).find('#sqlQuery').val().trim();
        
        if (!query) {
            frappe.msgprint('Please enter a SQL query');
            return;
        }
        
        this.update_status('Executing SQL query...');
        
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.execute_sql_query',
            args: {
                query: query
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.render_sql_results(r.message);
                    this.update_status(`Query executed successfully - ${r.message.row_count} rows returned`);
                } else {
                    this.show_error('SQL execution failed: ' + (r.message?.error || 'Unknown error'));
                    this.render_sql_error(r.message?.error || 'Unknown error');
                }
            }
        });
    }
    
    render_sql_results(data) {
        const container = $(this.wrapper).find('#sqlResults');
        
        if (!data.results || data.results.length === 0) {
            container.html(`
                <div class="alert alert-info">
                    <i class="fa fa-info-circle"></i> Query executed successfully but returned no results.
                </div>
            `);
            return;
        }
        
        let html = `
            <div class="alert alert-success">
                <i class="fa fa-check-circle"></i> Query executed successfully - ${data.row_count} rows returned
            </div>
            <div class="sql-results-container" style="height: 400px; overflow: auto; position: relative;">
                <table class="table table-sm table-striped table-hover" style="margin-bottom: 0;">
                    <thead class="table-dark" style="position: sticky; top: 0; z-index: 10;">
                        <tr>
        `;
        
        // Header
        data.columns.forEach(col => {
            html += `<th style="white-space: nowrap; background-color: #343a40; position: sticky; top: 0;">${col}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Body
        data.results.forEach(row => {
            html += '<tr>';
            data.columns.forEach(col => {
                let value = row[col];
                if (value === null) {
                    value = '<em class="text-muted">NULL</em>';
                } else if (typeof value === 'string' && value.length > 100) {
                    value = `<span title="${this.escapeHtml(String(value))}">${this.escapeHtml(value.substring(0, 100))}...</span>`;
                } else {
                    value = this.escapeHtml(String(value));
                }
                html += `<td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${value}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        container.html(html);
    }
    
    render_sql_error(error) {
        const container = $(this.wrapper).find('#sqlResults');
        container.html(`
            <div class="alert alert-danger">
                <i class="fa fa-exclamation-triangle"></i> <strong>Error:</strong> ${this.escapeHtml(error)}
            </div>
        `);
    }
    
    scan_orphaned_fields() {
        this.update_status('Scanning for orphaned fields...');
        
        $(this.wrapper).find('#scanOrphanedFields').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Scanning...');
        
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.scan_orphaned_fields',
            callback: (r) => {
                $(this.wrapper).find('#scanOrphanedFields').prop('disabled', false).html('<i class="fa fa-search"></i> Scan for Orphaned Fields');
                
                if (r.message && r.message.success) {
                    this.render_orphaned_fields(r.message);
                    this.update_status(r.message.scan_summary);
                } else {
                    this.show_error('Orphaned fields scan failed: ' + (r.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    render_orphaned_fields(data) {
        const container = $(this.wrapper).find('#orphanedResults');
        
        if (!data.orphaned_fields || data.orphaned_fields.length === 0) {
            container.html(`
                <div class="alert alert-success">
                    <i class="fa fa-check-circle"></i> <strong>Great!</strong> No orphaned fields found. Your database is clean.
                </div>
            `);
            return;
        }
        
        let html = `
            <div class="alert alert-warning">
                <i class="fa fa-exclamation-triangle"></i> <strong>Found ${data.total_count} orphaned fields</strong> that exist in database tables but not in DocType definitions.
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th>DocType</th>
                            <th>Table</th>
                            <th>Field Name</th>
                            <th>Type</th>
                            <th>Nullable</th>
                            <th>Default</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.orphaned_fields.forEach(field => {
            html += `
                <tr>
                    <td><strong>${field.doctype}</strong></td>
                    <td><code>${field.table_name}</code></td>
                    <td><span class="badge bg-warning">${field.field_name}</span></td>
                    <td><code>${field.field_type}</code></td>
                    <td>${field.is_nullable ? 'Yes' : 'No'}</td>
                    <td>${field.default_value || '<em class="text-muted">None</em>'}</td>
                    <td>
                        <button class="btn btn-xs btn-outline-danger" onclick="window.dbViewer.deleteOrphanedField('${field.doctype}', '${field.field_name}')">
                            <i class="fa fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        
        html += `
            <div class="mt-3">
                <div class="alert alert-info">
                    <i class="fa fa-info-circle"></i> <strong>What are orphaned fields?</strong><br>
                    These are database columns that exist in tables but are not defined in DocType or Custom Field definitions. 
                    They might be leftover from deleted fields or incomplete cleanup operations.
                </div>
            </div>
        `;
        
        container.html(html);
    }
    
    scan_orphaned_tables() {
        this.update_status('Scanning for orphaned tables...');
        
        $(this.wrapper).find('#scanOrphanedTables').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Scanning...');
        
        frappe.call({
            method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.scan_orphaned_tables',
            callback: (r) => {
                $(this.wrapper).find('#scanOrphanedTables').prop('disabled', false).html('<i class="fa fa-search"></i> Scan for Orphaned Tables');
                
                if (r.message && r.message.success) {
                    this.render_orphaned_tables(r.message);
                    this.update_status(r.message.scan_summary);
                } else {
                    this.show_error('Orphaned tables scan failed: ' + (r.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    render_orphaned_tables(data) {
        const container = $(this.wrapper).find('#orphanedTablesResults');
        
        if (!data.orphaned_tables || data.orphaned_tables.length === 0) {
            container.html(`
                <div class="alert alert-success">
                    <i class="fa fa-check-circle"></i> <strong>Excellent!</strong> No orphaned tables found. All database tables have corresponding DocType definitions.
                </div>
            `);
            return;
        }
        
        let html = `
            <div class="alert alert-warning">
                <i class="fa fa-database"></i> <strong>Found ${data.total_count} orphaned tables</strong> that exist in database but have no DocType definition.
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th>Table Name</th>
                            <th>Probable DocType</th>
                            <th>Rows</th>
                            <th>Columns</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.orphaned_tables.forEach(table => {
            const hasData = table.row_count > 0;
            const rowClass = hasData ? 'table-danger' : '';
            
            html += `
                <tr class="${rowClass}">
                    <td><code>${table.table_name}</code></td>
                    <td>${table.probable_doctype}</td>
                    <td>${table.row_count} ${hasData ? '<span class="badge badge-danger">Has Data!</span>' : ''}</td>
                    <td>${table.column_count}</td>
                    <td style="white-space: nowrap;">
                        <button class="btn btn-xs btn-outline-primary" onclick="window.dbViewer.viewTableData('${table.table_name}')">
                            <i class="fa fa-eye"></i> View
                        </button>
                        <button class="btn btn-xs btn-outline-danger ml-1" onclick="window.dbViewer.deleteOrphanedTable('${table.table_name}', ${table.row_count})">
                            <i class="fa fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        
        html += `
            <div class="mt-3">
                <div class="alert alert-info">
                    <i class="fa fa-info-circle"></i> <strong>What are orphaned tables?</strong><br>
                    These are database tables (usually starting with 'tab') that exist in the database but have no corresponding DocType definition. 
                    They might be:<br>
                    • Leftover from deleted custom DocTypes<br>
                    • Created by third-party apps that were uninstalled<br>
                    • Result of incomplete migrations or manual database operations<br>
                    <strong class="text-danger">⚠️ Tables with data (highlighted in red) need careful review before deletion!</strong>
                </div>
            </div>
        `;
        
        container.html(html);
    }
    
    viewTableData(tableName) {
        // Switch to tables tab and load the data
        this.showTab('tables');
        this.current_table = tableName;
        this.load_table_data(tableName);
    }
    
    deleteOrphanedTable(tableName, rowCount) {
        const hasData = rowCount > 0;
        
        frappe.confirm(
            `<div>
                <h4>⚠️ Delete Orphaned Table</h4>
                <p>Are you sure you want to delete the table:</p>
                <p><strong><code>${tableName}</code></strong></p>
                ${hasData ? `<div class="alert alert-danger">
                    <strong>WARNING:</strong> This table contains ${rowCount} rows of data!
                    <br>This action cannot be undone.
                </div>` : ''}
                <div class="alert alert-warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>Make sure you have a backup before proceeding</li>
                        <li>This operation is irreversible</li>
                        <li>Only Administrator can perform this action</li>
                    </ul>
                </div>
            </div>`,
            () => {
                // User confirmed, now delete
                frappe.call({
                    method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.delete_orphaned_table',
                    args: {
                        table_name: tableName,
                        confirm_delete: true
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: r.message.message,
                                indicator: 'green'
                            });
                            // Refresh the orphaned tables list
                            this.scan_orphaned_tables();
                        } else {
                            frappe.msgprint({
                                title: 'Deletion Failed',
                                message: r.message?.error || 'Failed to delete table',
                                indicator: 'red'
                            });
                        }
                    }
                });
            }
        );
    }
    
    deleteOrphanedField(doctype, fieldName) {
        frappe.confirm(
            `<div>
                <h4>⚠️ Delete Orphaned Field</h4>
                <p>Are you sure you want to delete the field:</p>
                <p><strong><code>${fieldName}</code></strong> from <strong>${doctype}</strong></p>
                <div class="alert alert-warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>Make sure you have a backup before proceeding</li>
                        <li>This will permanently remove the column from the database</li>
                        <li>Any data in this field will be lost</li>
                        <li>Only Administrator can perform this action</li>
                    </ul>
                </div>
            </div>`,
            () => {
                // User confirmed, now delete
                frappe.call({
                    method: 'flansa.flansa_core.page.flansa_database_viewer.flansa_database_viewer.delete_orphaned_field',
                    args: {
                        doctype_name: doctype,
                        field_name: fieldName,
                        confirm_delete: true
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: r.message.message,
                                indicator: 'green'
                            });
                            // Refresh the orphaned fields list
                            this.scan_orphaned_fields();
                        } else {
                            frappe.msgprint({
                                title: 'Deletion Failed',
                                message: r.message?.error || 'Failed to delete field',
                                indicator: 'red'
                            });
                        }
                    }
                });
            }
        );
    }
    
    show_error(message) {
        this.update_status('Error: ' + message);
        frappe.msgprint({
            title: 'Database Viewer Error',
            message: message,
            indicator: 'red'
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// CSS Styles
frappe.provide('frappe.pages');
$('<style>').html(`
    .flansa-database-viewer-page {
        padding-bottom: 60px;
    }
    
    .flansa-status-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #f8f9fa;
        border-top: 1px solid #dee2e6;
        padding: 8px 0;
        z-index: 1000;
        font-size: 13px;
        color: #6c757d;
    }
    
    .status-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .table-item.active {
        background-color: #007bff !important;
        color: white !important;
    }
    
    .table-item.active .badge {
        background-color: rgba(255, 255, 255, 0.2) !important;
    }
    
    .nav-tabs .nav-link {
        color: #495057;
    }
    
    .nav-tabs .nav-link.active {
        background-color: #007bff;
        border-color: #007bff;
        color: white;
    }
    
    .card-header h6 {
        margin: 0;
        font-weight: 600;
    }
    
    pre {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
        font-size: 12px;
        max-height: 300px;
        overflow-y: auto;
    }
`).appendTo('head');