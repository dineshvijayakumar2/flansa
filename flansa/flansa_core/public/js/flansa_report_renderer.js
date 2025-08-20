/**
 * Flansa Report Renderer - Shared display component for consistent report rendering
 * Used by both Report Builder preview and Report Viewer
 */

window.FlansaReportRenderer = {
    
    /**
     * Main rendering function - determines and renders appropriate view
     */
    render(data, config = {}) {
        if (data.is_grouped && data.groups) {
            return this.renderGroupedView(data, config);
        } else {
            return this.renderTableView(data, config);
        }
    },

    /**
     * Render modern grouped report view with collapsible sections
     */
    renderGroupedView(data, config = {}) {
        const {
            showActions = false,
            tableClass = 'table table-sm',
            onRecordClick = null
        } = config;

        const grouping = data.grouping;
        const groups = data.groups;
        
        let html = `
            <div class="grouped-report-container">
                <!-- Summary Cards -->
                <div class="report-summary">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fa fa-layer-group"></i>
                                </div>
                                <div class="summary-content">
                                    <h6>Groups</h6>
                                    <span class="summary-value">${data.total_groups}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fa fa-database"></i>
                                </div>
                                <div class="summary-content">
                                    <h6>Total Records</h6>
                                    <span class="summary-value">${data.total}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fa fa-tags"></i>
                                </div>
                                <div class="summary-content">
                                    <h6>Grouped By</h6>
                                    <span class="summary-value">${grouping.field_label}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Groups Container -->
                <div class="groups-container">
        `;
        
        groups.forEach((group, index) => {
            const aggregateDisplay = group.aggregate ? 
                ` • ${group.aggregate_type}: ${parseFloat(group.aggregate).toFixed(2)}` : '';
            
            html += `
                <div class="group-section" data-group-index="${index}">
                    <div class="group-header" onclick="FlansaReportRenderer.toggleGroup(${index})">
                        <div class="group-header-left">
                            <i class="fa fa-chevron-down group-toggle-icon" id="toggle-${index}"></i>
                            <div class="group-title">
                                <strong>${this.formatValue(group.group_label) || '(Empty)'}</strong>
                                <span class="group-meta">${group.count} records${aggregateDisplay}</span>
                            </div>
                        </div>
                        <div class="group-header-right">
                            ${group.has_more ? '<span class="more-indicator">+more</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="group-content" id="group-content-${index}">
                        ${this.renderGroupTable(group, data.fields, showActions, tableClass, onRecordClick)}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
            ${this.getGroupedViewStyles()}
        `;
        
        return html;
    },

    /**
     * Render table for a single group
     */
    renderGroupTable(group, fields, showActions, tableClass, onRecordClick) {
        if (!group.records || group.records.length === 0) {
            return `
                <div class="empty-group">
                    <i class="fa fa-inbox"></i>
                    <p>No records in this group</p>
                </div>
            `;
        }

        let html = `
            <div class="table-responsive">
                <table class="${tableClass}">
                    <thead class="thead-light">
                        <tr>
                            ${fields.map(field => `<th>${field.custom_label || field.field_label || field.fieldname}</th>`).join('')}
                            ${showActions ? '<th width="120">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        group.records.forEach((record, index) => {
            const recordId = record.name || `record-${index}`;
            const clickHandler = onRecordClick ? `onclick="(${onRecordClick})('${recordId}')"` : '';
            
            html += `<tr ${clickHandler ? `class="clickable-row" ${clickHandler}` : ''}>`;
            
            fields.forEach(field => {
                const value = record[field.fieldname] || '';
                const formatted = this.formatFieldValue(value, field.fieldtype);
                html += `<td>${formatted}</td>`;
            });
            
            if (showActions) {
                html += `
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-sm" onclick="window.viewRecord('${recordId}')" title="View">
                                <i class="fa fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" onclick="window.editRecord('${recordId}')" title="Edit">
                                <i class="fa fa-edit"></i>
                            </button>
                        </div>
                    </td>
                `;
            }
            
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    },

    /**
     * Render regular table view
     */
    renderTableView(data, config = {}) {
        const {
            showActions = false,
            tableClass = 'table table-striped table-hover',
            onRecordClick = null,
            fields = []
        } = config;

        // Determine columns to display
        let headerColumns = [];
        
        if (data.data && data.data.length > 0 && fields.length === 0) {
            // Auto-detect columns from data
            const firstRecord = data.data[0];
            for (let key in firstRecord) {
                let label = key;
                if (key === '_count') {
                    label = 'Count';
                } else if (key.includes('_sum')) {
                    label = key.replace('_sum', ' (Sum)').replace('_', ' ');
                } else if (key.includes('_avg')) {
                    label = key.replace('_avg', ' (Avg)').replace('_', ' ');
                } else if (key.includes('_min')) {
                    label = key.replace('_min', ' (Min)').replace('_', ' ');
                } else if (key.includes('_max')) {
                    label = key.replace('_max', ' (Max)').replace('_', ' ');
                }
                headerColumns.push({ key: key, label: label });
            }
        } else {
            // Use provided fields
            headerColumns = fields.map(field => ({
                key: field.fieldname,
                label: field.custom_label || field.field_label || field.fieldname
            }));
        }
        
        let html = `
            <div class="table-responsive">
                <table class="${tableClass}">
                    <thead class="thead-dark">
                        <tr>
                            ${headerColumns.map(col => `<th>${col.label}</th>`).join('')}
                            ${showActions ? '<th width="120">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (data.data && data.data.length > 0) {
            data.data.forEach((record, index) => {
                const recordId = record.name || `record-${index}`;
                const clickHandler = onRecordClick ? `onclick="(${onRecordClick})('${recordId}')"` : '';
                
                html += `<tr ${clickHandler ? `class="clickable-row" ${clickHandler}` : ''}>`;
                
                headerColumns.forEach(col => {
                    let value = record[col.key] || '';
                    
                    // Format numeric aggregations
                    if (col.key.includes('_sum') || col.key.includes('_avg') || col.key.includes('_min') || col.key.includes('_max')) {
                        if (value && !isNaN(value)) {
                            value = parseFloat(value).toFixed(2);
                        }
                    } else {
                        // Find field type for proper formatting
                        const field = fields.find(f => f.fieldname === col.key);
                        if (field) {
                            value = this.formatFieldValue(value, field.fieldtype);
                        }
                    }
                    
                    html += `<td>${value}</td>`;
                });
                
                if (showActions) {
                    html += `
                        <td>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary btn-sm" onclick="window.viewRecord('${recordId}')" title="View">
                                    <i class="fa fa-eye"></i>
                                </button>
                                <button class="btn btn-outline-secondary btn-sm" onclick="window.editRecord('${recordId}')" title="Edit">
                                    <i class="fa fa-edit"></i>
                                </button>
                            </div>
                        </td>
                    `;
                }
                
                html += '</tr>';
            });
        } else {
            html += `
                <tr>
                    <td colspan="${headerColumns.length + (showActions ? 1 : 0)}" class="text-center text-muted">
                        <div class="empty-state">
                            <i class="fa fa-inbox fa-2x"></i>
                            <p>No data found</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="table-footer">
                <p class="text-muted">
                    <i class="fa fa-info-circle"></i>
                    Showing ${data.data ? data.data.length : 0} of ${data.total || 0} records
                </p>
            </div>
        `;
        
        return html;
    },

    /**
     * Format field value based on field type
     */
    formatFieldValue(value, fieldtype) {
        if (!value && value !== 0) return '';
        
        switch (fieldtype) {
            case 'Currency':
                return parseFloat(value).toFixed(2);
            case 'Date':
                return frappe.datetime.str_to_user ? frappe.datetime.str_to_user(value) : value;
            case 'Datetime':
                return frappe.datetime.str_to_user ? frappe.datetime.str_to_user(value) : value;
            case 'Check':
                return value ? '✓' : '✗';
            case 'Attach Image':
            case 'Attach':
                if (value && (value.startsWith('http') || value.startsWith('/files'))) {
                    return `<img src="${value}" class="field-image" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">`;
                }
                return value;
            default:
                return this.formatValue(value);
        }
    },

    /**
     * General value formatting
     */
    formatValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '...';
        }
        return String(value);
    },

    /**
     * Toggle group visibility
     */
    toggleGroup(index) {
        const content = document.getElementById(`group-content-${index}`);
        const icon = document.getElementById(`toggle-${index}`);
        
        if (content && icon) {
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                icon.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
                icon.classList.add('collapsed');
            }
        }
    },

    /**
     * Get styles for grouped view
     */
    getGroupedViewStyles() {
        return `
            <style>
                .grouped-report-container {
                    max-height: 70vh;
                    overflow-y: auto;
                }
                
                .report-summary {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                
                .summary-card {
                    display: flex;
                    align-items: center;
                    padding: 15px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e9ecef;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.2s ease;
                }
                
                .summary-card:hover {
                    transform: translateY(-2px);
                }
                
                .summary-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 15px;
                }
                
                .summary-icon i {
                    color: white;
                    font-size: 1.2rem;
                }
                
                .summary-content h6 {
                    margin: 0 0 5px 0;
                    color: #666;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                
                .summary-value {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #2c3e50;
                    line-height: 1;
                }
                
                .group-section {
                    margin-bottom: 15px;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .group-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.2s ease;
                }
                
                .group-header:hover {
                    background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
                }
                
                .group-header-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .group-toggle-icon {
                    transition: transform 0.2s ease;
                    font-size: 1rem;
                }
                
                .group-toggle-icon.collapsed {
                    transform: rotate(-90deg);
                }
                
                .group-title {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .group-meta {
                    color: #e8f2ff;
                    font-weight: normal;
                    font-size: 0.8rem;
                }
                
                .more-indicator {
                    background: rgba(255,255,255,0.2);
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                }
                
                .group-content {
                    background: white;
                    max-height: 400px;
                    overflow-y: auto;
                    transition: all 0.3s ease;
                }
                
                .group-content.collapsed {
                    max-height: 0;
                    overflow: hidden;
                }
                
                .group-content table {
                    margin: 0;
                }
                
                .group-content td, .group-content th {
                    padding: 10px 15px;
                    border-top: 1px solid #f8f9fa;
                }
                
                .group-content thead th {
                    background: #f8f9fa;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #dee2e6;
                    color: #495057;
                }
                
                .empty-group {
                    padding: 40px;
                    text-align: center;
                    color: #6c757d;
                }
                
                .empty-group i {
                    font-size: 2rem;
                    margin-bottom: 10px;
                }
                
                .empty-state {
                    padding: 40px;
                    text-align: center;
                    color: #6c757d;
                }
                
                .empty-state i {
                    margin-bottom: 10px;
                    opacity: 0.5;
                }
                
                .table-footer {
                    padding: 15px;
                    background: #f8f9fa;
                    border-top: 1px solid #dee2e6;
                }
                
                .clickable-row:hover {
                    background-color: #f5f5f5;
                    cursor: pointer;
                }
                
                .field-image {
                    border: 1px solid #dee2e6;
                }
                
                .btn-group-sm .btn {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                }
            </style>
        `;
    }
};

// Make it globally available
window.FlansaReportRenderer = FlansaReportRenderer;