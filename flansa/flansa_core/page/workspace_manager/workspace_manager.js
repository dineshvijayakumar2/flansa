frappe.pages['workspace-manager'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Workspace Manager',
        single_column: true
    });
    
    new WorkspaceManager(page);
};

class WorkspaceManager {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        this.setup_ui();
        this.load_data();
    }
    
    setup_ui() {
        this.$container.html(`
            <div class="workspace-switcher-container">
                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h4><i class="fa fa-users"></i> Current Workspace Information</h4>
                            </div>
                            <div class="card-body" id="current-workspace-info">
                                <div class="text-center">
                                    <i class="fa fa-spinner fa-spin"></i> Loading...
                                </div>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h4><i class="fa fa-exchange"></i> Switch Workspace</h4>
                            </div>
                            <div class="card-body" id="workspace-list">
                                <div class="text-center">
                                    <i class="fa fa-spinner fa-spin"></i> Loading workspaces...
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fa fa-info-circle"></i> Multi-Workspace Info</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>Workspace Context:</strong> Allows you to switch between different organizational contexts within the same Flansa installation.</p>
                                <p><strong>Data Isolation:</strong> Each workspace has completely isolated data - applications, tables, reports, etc.</p>
                                <p><strong>Usage:</strong> Select a workspace below to switch your current context. All subsequent operations will be scoped to that workspace.</p>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h5><i class="fa fa-cog"></i> Actions</h5>
                            </div>
                            <div class="card-body">
                                <button class="btn btn-success btn-block" onclick="window.workspaceManager.showCreateWorkspaceForm()">
                                    <i class="fa fa-plus"></i> Create New Workspace
                                </button>
                                <button class="btn btn-info btn-block mt-2" onclick="frappe.set_route('flansa-workspace-builder')">
                                    <i class="fa fa-cogs"></i> Go to Workspace
                                </button>
                                <button class="btn btn-primary btn-block mt-2" onclick="window.location.reload()">
                                    <i class="fa fa-refresh"></i> Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .workspace-switcher-container {
                    padding: 20px;
                }
                
                .workspace-card {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                
                .workspace-card:hover {
                    border-color: #007bff;
                    box-shadow: 0 2px 8px rgba(0,123,255,0.2);
                }
                
                .workspace-card.current {
                    border-color: #28a745;
                    background-color: #f8fff9;
                }
                
                .workspace-card.inactive {
                    border-color: #6c757d;
                    background-color: #f8f9fa;
                    opacity: 0.8;
                }
                
                .workspace-card.inactive h5 {
                    color: #6c757d;
                }
                
                .workspace-card h5 {
                    margin-bottom: 5px;
                    color: #333;
                }
                
                .workspace-card .workspace-id {
                    font-family: monospace;
                    color: #666;
                    font-size: 0.9em;
                }
                
                .workspace-card .workspace-stats {
                    font-size: 0.85em;
                    color: #888;
                    margin-top: 8px;
                }
                
                .workspace-card .switch-btn {
                    margin-top: 10px;
                }
                
                .current-workspace-badge {
                    display: inline-block;
                    background: #28a745;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.8em;
                    margin-left: 10px;
                }
                
                .workspace-actions .btn-group-vertical {
                    gap: 2px;
                }
                
                .workspace-actions .btn {
                    border-radius: 4px;
                    min-width: 32px;
                }
                
                .workspace-card .d-flex {
                    gap: 10px;
                }
                
                .workspace-card:hover .workspace-actions {
                    opacity: 1;
                }
                
                .workspace-actions {
                    opacity: 0.7;
                    transition: opacity 0.3s ease;
                }
            </style>
        `);
    }
    
    async load_data() {
        try {
            // Load current workspace info
            const currentWorkspace = await this.call_api('get_current_workspace_info');
            this.render_current_workspace(currentWorkspace);
            
            // Load available workspaces
            const workspaces = await this.call_api('get_available_workspaces');
            // Ensure workspaces is an array
            const workspaceArray = Array.isArray(workspaces) ? workspaces : 
                                   (workspaces && workspaces.message ? workspaces.message : []);
            this.render_workspace_list(workspaceArray, currentWorkspace.workspace_id);
            
        } catch (error) {
            console.error('Workspace data load error:', error);
            this.show_error('Failed to load workspace data: ' + (error.message || 'Unknown error'));
        }
    }
    
    render_current_workspace(workspace) {
        const stats = workspace.stats;
        const $info = $('#current-workspace-info');
        
        $info.html(`
            <div class="row">
                <div class="col-md-6">
                    <h5>${workspace.workspace_name} <span class="current-workspace-badge">CURRENT</span></h5>
                    <p><strong>Workspace ID:</strong> <code>${workspace.workspace_id}</code></p>
                    <p><strong>Domain:</strong> ${workspace.primary_domain || 'N/A'}</p>
                    <p><strong>Status:</strong> <span class="badge badge-success">${workspace.status}</span></p>
                </div>
                <div class="col-md-6">
                    <h6>Usage Statistics</h6>
                    <ul class="list-unstyled">
                        <li><i class="fa fa-cube"></i> Applications: <strong>${stats.apps}</strong></li>
                        <li><i class="fa fa-table"></i> Tables: <strong>${stats.tables}</strong></li>
                        <li><i class="fa fa-link"></i> Relationships: <strong>${stats.relationships}</strong></li>
                        <li><i class="fa fa-chart-bar"></i> Reports: <strong>${stats.reports}</strong></li>
                    </ul>
                </div>
            </div>
        `);
    }
    
    render_workspace_list(workspaces, currentWorkspaceId) {
        const $list = $('#workspace-list');
        
        if (!workspaces || workspaces.length === 0) {
            $list.html('<p class="text-muted">No workspaces available</p>');
            return;
        }
        
        let html = '';
        workspaces.forEach(workspace => {
            const isCurrent = workspace.workspace_id === currentWorkspaceId;
            let cardClass = 'workspace-card';
            if (isCurrent) {
                cardClass += ' current';
            } else if (workspace.status === 'Inactive') {
                cardClass += ' inactive';
            }
            const statusColor = workspace.status === 'Active' ? 'success' : 'secondary';
            
            html += `
                <div class="${cardClass}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1" onclick="window.workspaceManager.switchWorkspace('${workspace.workspace_id}')" style="cursor: pointer;">
                            <h5>${workspace.workspace_name}${isCurrent ? '<span class="current-workspace-badge">CURRENT</span>' : ''}</h5>
                            <div class="workspace-id">ID: ${workspace.workspace_id}</div>
                            <div>Domain: ${workspace.primary_domain || 'N/A'}</div>
                            <div>Status: <span class="badge badge-${statusColor}">${workspace.status}</span></div>
                        </div>
                        <div class="workspace-actions">
                            <div class="btn-group-vertical btn-group-sm">
                                <button class="btn btn-outline-info" onclick="event.stopPropagation(); window.workspaceManager.viewWorkspaceStats('${workspace.workspace_id}')" title="View Statistics">
                                    <i class="fa fa-chart-bar"></i>
                                </button>
                                <button class="btn btn-outline-primary" onclick="event.stopPropagation(); window.workspaceManager.showEditWorkspaceForm('${workspace.workspace_id}')" title="Edit Workspace">
                                    <i class="fa fa-edit"></i>
                                </button>
                                ${workspace.status === 'Active' ? 
                                    `<button class="btn btn-outline-warning" onclick="event.stopPropagation(); window.workspaceManager.deactivateWorkspace('${workspace.workspace_id}')" title="Deactivate">
                                        <i class="fa fa-pause"></i>
                                    </button>` : 
                                    `<button class="btn btn-outline-success" onclick="event.stopPropagation(); window.workspaceManager.activateWorkspace('${workspace.workspace_id}')" title="Activate">
                                        <i class="fa fa-play"></i>
                                    </button>`
                                }
                                <button class="btn btn-outline-danger" onclick="event.stopPropagation(); window.workspaceManager.deleteWorkspace('${workspace.workspace_id}')" title="Delete Workspace">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    ${!isCurrent && workspace.status === 'Active' ? '<button class="btn btn-sm btn-primary switch-btn mt-2" onclick="event.stopPropagation(); window.workspaceManager.switchWorkspace(\'' + workspace.workspace_id + '\')"><i class="fa fa-exchange"></i> Switch to this workspace</button>' : ''}
                    ${workspace.status === 'Inactive' ? '<div class="mt-2"><small class="text-muted"><i class="fa fa-info-circle"></i> Activate workspace to enable switching</small></div>' : ''}
                </div>
            `;
        });
        
        $list.html(html);
    }
    
    async switchWorkspace(workspaceId) {
        try {
            if (!workspaceId) {
                frappe.msgprint({
                    title: 'Error',
                    message: 'No workspace ID provided',
                    indicator: 'red'
                });
                return;
            }
            
            frappe.show_alert({
                message: 'Switching workspace context...',
                indicator: 'blue'
            });
            
            // Store in localStorage for workspace
            localStorage.setItem('flansa_current_workspace_id', workspaceId);
            
            const result = await this.call_api('switch_workspace_context', { workspace_id: workspaceId });
            
            if (result.status === 'success') {
                frappe.show_alert({
                    message: `Switched to workspace: ${workspaceId}`,
                    indicator: 'green'
                });
                
                // Reload the page to refresh the context
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
            
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to switch workspace: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async viewWorkspaceStats(workspaceId) {
        try {
            const stats = await this.call_api('get_workspace_statistics', { workspace_id: workspaceId });
            
            if (stats.status === 'success') {
                const s = stats.statistics;
                frappe.msgprint({
                    title: `Workspace Statistics: ${workspaceId}`,
                    message: `
                        <div class="row">
                            <div class="col-6">
                                <h6><i class="fa fa-cube"></i> Applications</h6>
                                <h4 class="text-primary">${s.applications}</h4>
                            </div>
                            <div class="col-6">
                                <h6><i class="fa fa-table"></i> Tables</h6>
                                <h4 class="text-info">${s.tables}</h4>
                            </div>
                            <div class="col-6 mt-3">
                                <h6><i class="fa fa-link"></i> Relationships</h6>
                                <h4 class="text-warning">${s.relationships}</h4>
                            </div>
                            <div class="col-6 mt-3">
                                <h6><i class="fa fa-chart-bar"></i> Reports</h6>
                                <h4 class="text-success">${s.reports}</h4>
                            </div>
                            <div class="col-6 mt-3">
                                <h6><i class="fa fa-cogs"></i> Form Configs</h6>
                                <h4 class="text-secondary">${s.form_configs}</h4>
                            </div>
                            <div class="col-6 mt-3">
                                <h6><i class="fa fa-clock"></i> Last Activity</h6>
                                <small class="text-muted">${s.last_activity || 'Never'}</small>
                            </div>
                        </div>
                    `,
                    wide: true
                });
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load workspace statistics: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async activateWorkspace(workspaceId) {
        frappe.confirm(
            `Are you sure you want to activate workspace: <strong>${workspaceId}</strong>?`,
            async () => {
                try {
                    const result = await this.call_api('activate_workspace', { workspace_id: workspaceId });
                    if (result.status === 'success') {
                        frappe.show_alert('Workspace activated successfully', 'green');
                        this.load_data(); // Refresh the list
                    }
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to activate workspace: ' + error.message,
                        indicator: 'red'
                    });
                }
            }
        );
    }
    
    async deactivateWorkspace(workspaceId) {
        frappe.confirm(
            `Are you sure you want to deactivate workspace: <strong>${workspaceId}</strong>?<br><small class="text-warning">This will prevent users from accessing this workspace.</small>`,
            async () => {
                try {
                    const result = await this.call_api('deactivate_workspace', { workspace_id: workspaceId });
                    if (result.status === 'success') {
                        frappe.show_alert('Workspace deactivated successfully', 'orange');
                        this.load_data(); // Refresh the list
                    }
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to deactivate workspace: ' + error.message,
                        indicator: 'red'
                    });
                }
            }
        );
    }
    
    showCreateWorkspaceForm() {
        this.showWorkspaceForm(false, null);
    }
    
    async showEditWorkspaceForm(workspaceId) {
        try {
            const workspaceData = await this.call_api('get_workspace_details', { workspace_id: workspaceId });
            this.showWorkspaceForm(true, workspaceData);
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load workspace data: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    showWorkspaceForm(isEdit, workspaceData) {
        const title = isEdit ? 'Edit Workspace' : 'Create New Workspace';
        const primaryAction = isEdit ? 'Update Workspace' : 'Create Workspace';
        
        const dialog = new frappe.ui.Dialog({
            title: title,
            size: 'large', // Make dialog larger to accommodate all fields
            fields: [
                // Workspace Details Section
                {
                    fieldtype: 'Section Break',
                    label: 'Workspace Details'
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'workspace_id',
                    label: 'Workspace ID',
                    default: workspaceData?.workspace_id || '',
                    read_only: isEdit ? 1 : 0,
                    description: isEdit ? 'Workspace ID cannot be changed' : 'Auto-generated from name'
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'workspace_name', 
                    label: 'Workspace Name',
                    reqd: 1,
                    default: workspaceData?.workspace_name || ''
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'status',
                    label: 'Status',
                    options: 'Active\nInactive\nSuspended\nPending',
                    default: workspaceData?.status || 'Active'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'primary_domain',
                    label: 'Primary Domain',
                    default: workspaceData?.primary_domain || ''
                },
                {
                    fieldtype: 'Datetime',
                    fieldname: 'created_date',
                    label: 'Created Date',
                    default: workspaceData?.created_date || frappe.datetime.now_datetime(),
                    read_only: isEdit ? 1 : 0
                },
                
                // Domain Configuration Section
                {
                    fieldtype: 'Section Break',
                    label: 'Domain Configuration'
                },
                {
                    fieldtype: 'Small Text',
                    fieldname: 'custom_domains',
                    label: 'Custom Domains (one per line)',
                    default: workspaceData?.custom_domains ? workspaceData.custom_domains.map(d => d.domain).join('\n') : ''
                },
                
                // Branding Section
                {
                    fieldtype: 'Section Break',
                    label: 'Branding'
                },
                {
                    fieldtype: 'Check',
                    fieldname: 'custom_branding',
                    label: 'Custom Branding',
                    default: workspaceData?.custom_branding || 0
                },
                {
                    fieldtype: 'Attach Image',
                    fieldname: 'workspace_logo',
                    label: 'Workspace Logo',
                    description: 'Logo to display in the workspace header',
                    default: workspaceData?.workspace_logo || ''
                },
                
                // Usage Statistics Section (Read-only for edit)
                ...(isEdit ? [
                    {
                        fieldtype: 'Section Break',
                        label: 'Usage Statistics',
                        collapsible: 1
                    },
                    {
                        fieldtype: 'Int',
                        fieldname: 'total_applications',
                        label: 'Total Applications',
                        default: workspaceData?.total_applications || 0,
                        read_only: 1
                    },
                    {
                        fieldtype: 'Int',
                        fieldname: 'total_tables',
                        label: 'Total Tables',
                        default: workspaceData?.total_tables || 0,
                        read_only: 1
                    },
                    {
                        fieldtype: 'Int',
                        fieldname: 'total_relationships',
                        label: 'Total Relationships',
                        default: workspaceData?.total_relationships || 0,
                        read_only: 1
                    },
                    {
                        fieldtype: 'Column Break'
                    },
                    {
                        fieldtype: 'Int',
                        fieldname: 'total_reports',
                        label: 'Total Reports',
                        default: workspaceData?.total_reports || 0,
                        read_only: 1
                    },
                    {
                        fieldtype: 'Int',
                        fieldname: 'total_form_configs',
                        label: 'Total Form Configs',
                        default: workspaceData?.total_form_configs || 0,
                        read_only: 1
                    },
                    {
                        fieldtype: 'Datetime',
                        fieldname: 'last_activity',
                        label: 'Last Activity',
                        default: workspaceData?.last_activity || '',
                        read_only: 1
                    }
                ] : [])
            ],
            primary_action_label: primaryAction,
            primary_action: (values) => {
                // Ensure workspace_logo is included even if hidden
                if (dialog.fields_dict.workspace_logo) {
                    values.workspace_logo = dialog.fields_dict.workspace_logo.get_value() || '';
                    console.log('Workspace logo value:', values.workspace_logo);
                }
                
                // Debug: log all values being sent
                console.log('Form values being submitted:', values);
                
                if (isEdit) {
                    this.updateWorkspace(workspaceData.workspace_id, values, dialog);
                } else {
                    this.createWorkspace(values, dialog);
                }
            }
        });
        
        // Auto-generate workspace ID for new workspaces
        if (!isEdit) {
            dialog.fields_dict.workspace_name.$input.on('input', () => {
                const name = dialog.get_value('workspace_name');
                if (name) {
                    const cleanedName = name.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
                    const workspaceId = cleanedName.substring(0, 20) + '_' + Date.now().toString().slice(-6);
                    dialog.set_value('workspace_id', workspaceId);
                }
            });
        }
        
        // Show/hide workspace logo field based on custom_branding checkbox
        setTimeout(() => {
            if (dialog.fields_dict.custom_branding && dialog.fields_dict.workspace_logo) {
                const toggleLogoVisibility = () => {
                    const customBrandingEnabled = dialog.get_value('custom_branding');
                    const logoWrapper = dialog.fields_dict.workspace_logo.wrapper;
                    if (logoWrapper) {
                        if (customBrandingEnabled) {
                            logoWrapper.style.display = 'block';
                        } else {
                            logoWrapper.style.display = 'none';
                        }
                    }
                };
                
                // Set up event listener
                dialog.fields_dict.custom_branding.$input.on('change', toggleLogoVisibility);
                
                // Initialize visibility
                toggleLogoVisibility();
            }
        }, 100);
        
        dialog.show();
    }
    
    async createWorkspace(values, dialog) {
        try {
            const result = await this.call_api('register_new_workspace', values);
            console.log('Create workspace result:', result); // Debug log
            
            dialog.hide();
            frappe.show_alert('Workspace created successfully', 'green');
            this.load_data();
            
            // Check if result has workspace_id before trying to switch
            if (result.workspace_id) {
                frappe.confirm(
                    `Workspace "${values.workspace_name}" created successfully. Switch to this workspace?`,
                    () => this.switchWorkspace(result.workspace_id)
                );
            } else {
                frappe.show_alert('Workspace created but could not switch automatically', 'orange');
            }
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to create workspace: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async updateWorkspace(workspaceId, values, dialog) {
        try {
            values.workspace_id = workspaceId;
            await this.call_api('update_workspace', values);
            dialog.hide();
            frappe.show_alert('Workspace updated successfully', 'green');
            this.load_data();
        } catch (error) {
            // Check if it's a version conflict but update succeeded
            if (error.message && error.message.includes('Document has been modified')) {
                dialog.hide();
                frappe.show_alert('Workspace updated successfully', 'green');
                this.load_data();
            } else {
                frappe.msgprint({
                    title: 'Error',
                    message: 'Failed to update workspace: ' + error.message,
                    indicator: 'red'
                });
            }
        }
    }
    
    async deleteWorkspace(workspaceId) {
        frappe.confirm(
            `Are you sure you want to <strong>permanently delete</strong> workspace: <strong>${workspaceId}</strong>?<br><br><span class="text-danger">⚠️ This action cannot be undone and will delete all workspace data!</span>`,
            async () => {
                try {
                    await this.call_api('delete_workspace', { workspace_id: workspaceId });
                    frappe.show_alert('Workspace deleted successfully', 'green');
                    this.load_data();
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to delete workspace: ' + error.message,
                        indicator: 'red'
                    });
                }
            }
        );
    }
    
    async call_api(method, args = {}) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `flansa.flansa_core.page.workspace_manager.workspace_manager.${method}`,
                args: args,
                callback: (response) => {
                    if (response && response.message !== undefined) {
                        resolve(response.message);
                    } else {
                        reject(new Error('No response data from API'));
                    }
                },
                error: (error) => {
                    console.error(`API Error for ${method}:`, error);
                    reject(new Error(`API call failed: ${error.responseText || error.message || 'Unknown error'}`));
                }
            });
        });
    }
    
    show_error(message) {
        this.$container.html(`
            <div class="alert alert-danger">
                <h4>Error</h4>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="window.location.reload()">Retry</button>
            </div>
        `);
    }
}

// Make it globally accessible
window.workspaceManager = null;

frappe.pages['workspace-manager'].on_page_show = function() {
    if (window.workspaceManager) {
        window.workspaceManager.load_data();
    }
};

// Set global reference when page loads
$(document).ready(function() {
    setTimeout(() => {
        if (frappe.get_route()[0] === 'workspace-manager') {
            window.workspaceManager = new WorkspaceManager(frappe.pages['workspace-manager']);
        }
    }, 500);
});