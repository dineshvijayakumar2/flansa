/**
 * Flansa Report Integration System
 * Bridges Record Viewer with Frappe Report Builder and custom reporting
 */

class FlansaReportIntegration {
    constructor(recordViewer) {
        this.recordViewer = recordViewer;
        this.reportTypes = {
            'tabular': 'Standard Data Table',
            'summary': 'Summary with Grouping', 
            'chart': 'Visual Charts',
            'pivot': 'Pivot Table Analysis',
            'export': 'Data Export'
        };
        
        this.initializeReportActions();
    }
    
    /**
     * Initialize report-related actions in the record viewer
     */
    initializeReportActions() {
        // Add report actions to context menu
        this.addReportContextMenuItems();
        
        // Add report toolbar
        this.addReportToolbar();
        
        // Bind report events
        this.bindReportEvents();
    }
    
    /**
     * Add report options to context menu
     */
    addReportContextMenuItems() {
        const contextMenu = $('#flansa-context-menu');
        if (contextMenu.length) {
            const reportMenuItems = `
                <div class="context-menu-divider"></div>
                <div class="context-menu-item" data-action="create-report" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;">
                    <i class="fa fa-chart-bar" style="width: 16px;"></i>
                    <span>Create Report</span>
                </div>
                <div class="context-menu-item" data-action="open-report-builder" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;">
                    <i class="fa fa-cogs" style="width: 16px;"></i>
                    <span>Report Builder</span>
                </div>
                <div class="context-menu-item" data-action="export-data" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;">
                    <i class="fa fa-download" style="width: 16px;"></i>
                    <span>Export Data</span>
                </div>
            `;
            
            contextMenu.append(reportMenuItems);
        }
    }
    
    /**
     * Add report toolbar above the data viewer
     */
    addReportToolbar() {
        const toolbar = `
            <div class="flansa-report-toolbar" style="background: #f8f9fa; border: 1px solid #e0e6ed; border-radius: 6px; padding: 12px 16px; margin: 16px 20px; display: flex; align-items: center; justify-content: space-between;">
                <div class="report-actions" style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-light" id="quick-report-btn" title="Quick Report">
                        <i class="fa fa-chart-line"></i> Quick Report
                    </button>
                    <button class="btn btn-sm btn-light" id="group-by-btn" title="Group By">
                        <i class="fa fa-layer-group"></i> Group By
                    </button>
                    <button class="btn btn-sm btn-light" id="pivot-btn" title="Pivot Table">
                        <i class="fa fa-table"></i> Pivot
                    </button>
                </div>
                <div class="export-actions" style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-primary" id="export-excel-btn" title="Export to Excel">
                        <i class="fa fa-file-excel"></i> Excel
                    </button>
                    <button class="btn btn-sm btn-secondary" id="export-pdf-btn" title="Export to PDF">
                        <i class="fa fa-file-pdf"></i> PDF
                    </button>
                </div>
            </div>
        `;
        
        // Insert toolbar before controls bar
        $('.controls-bar').before(toolbar);
    }
    
    /**
     * Bind report-related events
     */
    bindReportEvents() {
        // Quick report generation
        $(document).on('click', '#quick-report-btn', () => {
            this.generateQuickReport();
        });
        
        // Group by functionality
        $(document).on('click', '#group-by-btn', () => {
            this.showGroupByDialog();
        });
        
        // Pivot table
        $(document).on('click', '#pivot-btn', () => {
            this.generatePivotTable();
        });
        
        // Export actions
        $(document).on('click', '#export-excel-btn', () => {
            this.exportToExcel();
        });
        
        $(document).on('click', '#export-pdf-btn', () => {
            this.exportToPDF();
        });
        
        // Context menu actions
        $(document).on('click', '[data-action="create-report"]', () => {
            this.openReportCreator();
        });
        
        $(document).on('click', '[data-action="open-report-builder"]', () => {
            this.openReportBuilder();
        });
    }
    
    /**
     * Generate quick report with current data and filters
     */
    generateQuickReport() {
        const reportData = {
            title: `${this.recordViewer.table_info.table_label} Report`,
            doctype: this.recordViewer.table_info.doctype_name,
            fields: this.getReportFields(),
            filters: this.getCurrentFilters(),
            data: this.recordViewer.filtered_data,
            generated_on: new Date().toISOString()
        };
        
        this.openReportViewer(reportData);
    }
    
    /**
     * Show group by dialog for data summarization
     */
    showGroupByDialog() {
        const groupableFields = this.recordViewer.table_fields.filter(field => 
            ['Link', 'Select', 'Date', 'Data'].includes(field.fieldtype)
        );
        
        const dialog = new frappe.ui.Dialog({
            title: 'Group Data By Field',
            fields: [
                {
                    fieldtype: 'Select',
                    fieldname: 'group_field',
                    label: 'Group By Field',
                    options: groupableFields.map(f => ({
                        label: f.label,
                        value: f.fieldname
                    })),
                    reqd: 1
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'aggregate_field',
                    label: 'Count/Sum Field',
                    options: this.getNumericFields()
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'aggregate_function',
                    label: 'Function',
                    options: ['Count', 'Sum', 'Average', 'Min', 'Max'],
                    default: 'Count'
                }
            ],
            primary_action: (values) => {
                this.generateGroupedReport(values);
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    /**
     * Generate grouped/summarized report
     */
    generateGroupedReport(groupConfig) {
        const groupedData = this.groupData(
            this.recordViewer.filtered_data,
            groupConfig.group_field,
            groupConfig.aggregate_field,
            groupConfig.aggregate_function
        );
        
        const reportData = {
            title: `${this.recordViewer.table_info.table_label} - Grouped by ${groupConfig.group_field}`,
            type: 'summary',
            group_by: groupConfig.group_field,
            data: groupedData,
            charts: this.generateChartConfig(groupedData, groupConfig)
        };
        
        this.openReportViewer(reportData);
    }
    
    /**
     * Group data by field with aggregation
     */
    groupData(data, groupField, aggregateField, aggregateFunction) {
        const groups = {};
        
        data.forEach(record => {
            const groupValue = record[groupField] || 'Not Set';
            if (!groups[groupValue]) {
                groups[groupValue] = {
                    group: groupValue,
                    count: 0,
                    records: []
                };
            }
            
            groups[groupValue].count++;
            groups[groupValue].records.push(record);
            
            // Calculate aggregation if specified
            if (aggregateField && aggregateFunction !== 'Count') {
                const value = parseFloat(record[aggregateField]) || 0;
                if (!groups[groupValue].aggregate_values) {
                    groups[groupValue].aggregate_values = [];
                }
                groups[groupValue].aggregate_values.push(value);
            }
        });
        
        // Calculate final aggregated values
        Object.values(groups).forEach(group => {
            if (group.aggregate_values) {
                switch (aggregateFunction) {
                    case 'Sum':
                        group.aggregate_result = group.aggregate_values.reduce((a, b) => a + b, 0);
                        break;
                    case 'Average':
                        group.aggregate_result = group.aggregate_values.reduce((a, b) => a + b, 0) / group.aggregate_values.length;
                        break;
                    case 'Min':
                        group.aggregate_result = Math.min(...group.aggregate_values);
                        break;
                    case 'Max':
                        group.aggregate_result = Math.max(...group.aggregate_values);
                        break;
                }
            }
        });
        
        return Object.values(groups);
    }
    
    /**
     * Generate chart configuration for grouped data
     */
    generateChartConfig(groupedData, groupConfig) {
        return {
            type: 'column',
            title: `${groupConfig.group_field} Distribution`,
            data: {
                labels: groupedData.map(g => g.group),
                datasets: [{
                    label: groupConfig.aggregate_function === 'Count' ? 'Count' : groupConfig.aggregate_field,
                    data: groupedData.map(g => g.aggregate_result || g.count)
                }]
            }
        };
    }
    
    /**
     * Open Frappe Report Builder with current context
     */
    openReportBuilder() {
        const reportConfig = {
            reference_doctype: this.recordViewer.table_info.doctype_name,
            reference_name: this.recordViewer.table_name,
            filters: this.getCurrentFilters(),
            fields: this.getReportFields()
        };
        
        // Navigate to report builder with context
        frappe.set_route('query-report', 'flansa-report-builder', reportConfig);
    }
    
    /**
     * Open report creator dialog
     */
    openReportCreator() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create New Report',
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'report_name',
                    label: 'Report Name',
                    reqd: 1
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'report_type',
                    label: 'Report Type',
                    options: Object.entries(this.reportTypes).map(([key, value]) => ({
                        label: value,
                        value: key
                    })),
                    default: 'tabular'
                },
                {
                    fieldtype: 'Small Text',
                    fieldname: 'description',
                    label: 'Description'
                }
            ],
            primary_action: (values) => {
                this.createNewReport(values);
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    /**
     * Get fields suitable for reporting
     */
    getReportFields() {
        return this.recordViewer.table_fields.map(field => ({
            fieldname: field.fieldname,
            label: field.label,
            fieldtype: field.fieldtype,
            width: field.width || 120
        }));
    }
    
    /**
     * Get current active filters
     */
    getCurrentFilters() {
        const filters = [...(this.recordViewer.active_filters || [])];
        
        if (this.recordViewer.search_term) {
            filters.push({
                field: 'search',
                condition: 'like',
                value: this.recordViewer.search_term
            });
        }
        
        return filters;
    }
    
    /**
     * Get numeric fields for aggregation
     */
    getNumericFields() {
        return this.recordViewer.table_fields
            .filter(field => ['Int', 'Float', 'Currency'].includes(field.fieldtype))
            .map(field => ({
                label: field.label,
                value: field.fieldname
            }));
    }
    
    /**
     * Export current data to Excel
     */
    exportToExcel() {
        const exportData = {
            filename: `${this.recordViewer.table_info.table_label}_${new Date().toISOString().split('T')[0]}.xlsx`,
            data: this.recordViewer.filtered_data,
            fields: this.getReportFields()
        };
        
        this.performExport(exportData, 'excel');
    }
    
    /**
     * Export current data to PDF
     */
    exportToPDF() {
        const exportData = {
            filename: `${this.recordViewer.table_info.table_label}_${new Date().toISOString().split('T')[0]}.pdf`,
            data: this.recordViewer.filtered_data,
            fields: this.getReportFields(),
            title: `${this.recordViewer.table_info.table_label} Report`,
            orientation: 'landscape'
        };
        
        this.performExport(exportData, 'pdf');
    }
    
    /**
     * Perform actual export operation
     */
    async performExport(exportData, format) {
        try {
            frappe.show_progress('Exporting...', 30, 100, 'Preparing data...');
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.export_api.export_data',
                args: {
                    format: format,
                    data: exportData
                }
            });
            
            frappe.hide_progress();
            
            if (response.message && response.message.success) {
                // Download the file
                const downloadUrl = response.message.download_url;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = exportData.filename;
                link.click();
                
                frappe.show_alert({
                    message: 'Export completed successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Export failed');
            }
            
        } catch (error) {
            frappe.hide_progress();
            frappe.show_alert({
                message: 'Export failed: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    /**
     * Open report viewer with generated report
     */
    openReportViewer(reportData) {
        // Store report data temporarily
        sessionStorage.setItem('flansa_temp_report', JSON.stringify(reportData));
        
        // Navigate to report viewer
        frappe.set_route('flansa-report-viewer', 'temp-report');
    }
}

// Export for use in record viewer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlansaReportIntegration;
} else {
    window.FlansaReportIntegration = FlansaReportIntegration;
}