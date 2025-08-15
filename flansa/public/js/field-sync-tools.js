/**
 * Field Sync Tools - Client-side utilities for field synchronization
 * Provides easy access to field sync diagnostic and fix tools
 */

// Field Sync Tools v2.0 - Force cache refresh
window.FieldSyncTools = {
    
    /**
     * Show field sync diagnostic dialog for a specific table
     */
    diagnoseTable: function(table_name) {
        frappe.call({
            method: 'flansa.flansa_core.api.field_sync_diagnostic.diagnose_field_sync',
            args: { table_name: table_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.showDiagnosticResults(r.message);
                } else {
                    frappe.show_alert('Diagnostic failed: ' + (r.message?.error || 'Unknown error'), 'red');
                }
            }
        });
    },
    
    /**
     * Show diagnostic results in a dialog
     */
    showDiagnosticResults: function(data) {
        const dialog = new frappe.ui.Dialog({
            title: `🔍 Field Sync Diagnostic: ${data.table_label}`,
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'diagnostic_results',
                    options: this.generateDiagnosticHTML(data)
                }
            ],
            primary_action_label: 'Auto-Fix Issues',
            primary_action: () => {
                this.autoFixTable(data.table_name);
                dialog.hide();
            },
            secondary_action_label: 'Resync All',
            secondary_action: () => {
                this.resyncTable(data.table_name);
                dialog.hide();
            }
        });
        
        dialog.show();
    },
    
    /**
     * Generate HTML for diagnostic results
     */
    generateDiagnosticHTML: function(data) {
        const analysis = data.analysis;
        const statusColor = analysis.sync_status === 'in_sync' ? 'green' : 'orange';
        const statusIcon = analysis.sync_status === 'in_sync' ? '✅' : '⚠️';
        
        let html = `
            <div style="padding: 20px;">
                <div class="alert alert-${statusColor === 'green' ? 'success' : 'warning'}">
                    <h4>${statusIcon} Sync Status: ${analysis.sync_status.replace('_', ' ').toUpperCase()}</h4>
                    <p><strong>Table:</strong> ${data.table_name} (${data.table_label})</p>
                    <p><strong>DocType:</strong> ${data.doctype_name || 'Not set'}</p>
                </div>
                
                <h5>📊 Field Counts</h5>
                <table class="table table-bordered">
                    <tr>
                        <td><strong>JSON Fields</strong></td>
                        <td>${data.counts.json_fields}</td>
                    </tr>
                    <tr>
                        <td><strong>Flansa Field Records</strong></td>
                        <td>${data.counts.flansa_fields}</td>
                    </tr>
                    <tr>
                        <td><strong>DocType Fields</strong></td>
                        <td>${data.counts.doctype_fields}</td>
                    </tr>
                </table>`;
        
        if (analysis.missing_from_flansa.length > 0) {
            html += `
                <div class="alert alert-danger">
                    <h6>🔴 Missing from Flansa Field Table (${analysis.missing_from_flansa.length})</h6>
                    <p><small>${analysis.missing_from_flansa.join(', ')}</small></p>
                </div>`;
        }
        
        if (analysis.extra_in_flansa.length > 0) {
            html += `
                <div class="alert alert-info">
                    <h6>ℹ️ Extra in Flansa Field Table (${analysis.extra_in_flansa.length})</h6>
                    <p><small>${analysis.extra_in_flansa.join(', ')}</small></p>
                </div>`;
        }
        
        if (data.recommendations.length > 0) {
            html += '<h5>💡 Recommendations</h5><ul>';
            data.recommendations.forEach(rec => {
                const priorityColor = rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'info';
                html += `<li class="text-${priorityColor}"><strong>${rec.priority.toUpperCase()}:</strong> ${rec.description}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
        return html;
    },
    
    /**
     * Auto-fix field sync issues for a table
     */
    autoFixTable: function(table_name) {
        frappe.show_alert('Fixing field sync issues...', 'blue');
        
        frappe.call({
            method: 'flansa.flansa_core.api.field_sync_diagnostic.auto_fix_field_sync',
            args: { table_name: table_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert(`✅ Fixed ${r.message.actions_performed.length} sync issues`, 'green');
                } else {
                    frappe.show_alert('Fix failed: ' + (r.message?.error || 'Unknown error'), 'red');
                }
            }
        });
    },
    
    /**
     * Resync table using bench command wrapper
     */
    resyncTable: function(table_name) {
        frappe.show_alert('Running field resync...', 'blue');
        
        frappe.call({
            method: 'flansa.flansa_core.utils.auto_sync.bulk_sync_table',
            args: { table_id: table_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert(`✅ Resynced ${r.message.synced} fields`, 'green');
                } else {
                    frappe.show_alert('Resync failed: ' + (r.message?.error || 'Unknown error'), 'red');
                }
            }
        });
    },
    
    /**
     * Bulk diagnostic for all tables
     */
    diagnoseAllTables: function() {
        frappe.show_alert('Running bulk diagnostic...', 'blue');
        
        frappe.call({
            method: 'flansa.flansa_core.api.field_sync_diagnostic.bulk_diagnose_all_tables',
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.showBulkDiagnosticResults(r.message);
                } else {
                    frappe.show_alert('Bulk diagnostic failed: ' + (r.message?.error || 'Unknown error'), 'red');
                }
            }
        });
    },
    
    /**
     * Show bulk diagnostic results
     */
    showBulkDiagnosticResults: function(data) {
        const tablesWithIssues = data.results.filter(t => t.issues_count > 0);
        
        let html = `
            <div style="padding: 20px;">
                <div class="alert alert-info">
                    <h4>📊 Bulk Field Sync Diagnostic</h4>
                    <p><strong>Total Tables:</strong> ${data.total_tables}</p>
                    <p><strong>Tables with Issues:</strong> ${data.tables_with_issues}</p>
                    <p><strong>Total Issues:</strong> ${data.total_issues}</p>
                </div>`;
        
        if (tablesWithIssues.length > 0) {
            html += '<h5>🔴 Tables with Sync Issues</h5>';
            html += '<table class="table table-striped">';
            html += '<thead><tr><th>Table</th><th>Label</th><th>Status</th><th>Issues</th><th>Actions</th></tr></thead><tbody>';
            
            tablesWithIssues.forEach(table => {
                const statusColor = table.sync_status === 'in_sync' ? 'success' : 'warning';
                html += `
                    <tr>
                        <td><code>${table.table_name}</code></td>
                        <td>${table.table_label}</td>
                        <td><span class="badge badge-${statusColor}">${table.sync_status}</span></td>
                        <td><span class="badge badge-danger">${table.issues_count}</span></td>
                        <td><button class="btn btn-xs btn-primary" onclick="FieldSyncTools.diagnoseTable(&quot;${table.table_name}&quot;)">Diagnose</button></td>
                    </tr>`;
            });
            
            html += '</tbody></table>';
        } else {
            html += '<div class="alert alert-success"><h5>✅ All tables are synchronized!</h5></div>';
        }
        
        html += '</div>';
        
        const dialog = new frappe.ui.Dialog({
            title: '📋 Bulk Field Sync Report',
            size: 'extra-large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'bulk_results',
                    options: html
                }
            ],
            primary_action_label: 'Fix All Issues',
            primary_action: () => {
                this.bulkFixAllTables();
                dialog.hide();
            }
        });
        
        dialog.show();
    },
    
    /**
     * Bulk fix all tables
     */
    bulkFixAllTables: function() {
        frappe.show_alert('Fixing all field sync issues...', 'blue');
        
        frappe.call({
            method: 'flansa.flansa_core.api.field_sync_diagnostic.bulk_fix_all_tables',
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert(`✅ Fixed issues in ${r.message.tables_fixed}/${r.message.tables_with_issues} tables`, 'green');
                } else {
                    frappe.show_alert('Bulk fix failed: ' + (r.message?.error || 'Unknown error'), 'red');
                }
            }
        });
    },
    
    /**
     * Add field sync tools to any page
     */
    addToPage: function(page) {
        if (!page || !page.add_menu_item) return;
        
        page.add_menu_item('🔍 Field Sync Diagnostic', () => {
            this.diagnoseAllTables();
        });
        
        page.add_menu_item('🔧 Fix All Field Sync Issues', () => {
            this.bulkFixAllTables();
        });
    }
};

// Console shortcuts
window.diagnoseFields = (table_name) => FieldSyncTools.diagnoseTable(table_name);
window.fixFieldSync = (table_name) => FieldSyncTools.autoFixTable(table_name);
window.diagnoseAllFields = () => FieldSyncTools.diagnoseAllTables();

console.log('✅ Field Sync Tools loaded');
console.log('Usage: diagnoseFields("FT-001") or diagnoseAllFields() or FieldSyncTools.diagnoseAllTables()');