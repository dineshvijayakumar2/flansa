frappe.pages['tenant-switcher'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Tenant Management',
        single_column: true
    });
    
    new TenantSwitcher(page);
};

class TenantSwitcher {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        this.setup_ui();
        this.load_data();
    }
    
    setup_ui() {
        this.$container.html(`
            <div class="tenant-switcher-container">
                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h4><i class="fa fa-users"></i> Current Tenant Information</h4>
                            </div>
                            <div class="card-body" id="current-tenant-info">
                                <div class="text-center">
                                    <i class="fa fa-spinner fa-spin"></i> Loading...
                                </div>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h4><i class="fa fa-exchange"></i> Switch Tenant</h4>
                            </div>
                            <div class="card-body" id="tenant-list">
                                <div class="text-center">
                                    <i class="fa fa-spinner fa-spin"></i> Loading tenants...
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fa fa-info-circle"></i> Multi-Tenant Info</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>Tenant Context:</strong> Allows you to switch between different organizational contexts within the same Flansa installation.</p>
                                <p><strong>Data Isolation:</strong> Each tenant has completely isolated data - applications, tables, reports, etc.</p>
                                <p><strong>Usage:</strong> Select a tenant below to switch your current context. All subsequent operations will be scoped to that tenant.</p>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h5><i class="fa fa-cog"></i> Actions</h5>
                            </div>
                            <div class="card-body">
                                <button class="btn btn-success btn-block" onclick="tenantSwitcher.showCreateTenantForm()">
                                    <i class="fa fa-plus"></i> Create New Tenant
                                </button>
                                <button class="btn btn-info btn-block mt-2" onclick="frappe.set_route('flansa-workspace')">
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
                .tenant-switcher-container {
                    padding: 20px;
                }
                
                .tenant-card {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                
                .tenant-card:hover {
                    border-color: #007bff;
                    box-shadow: 0 2px 8px rgba(0,123,255,0.2);
                }
                
                .tenant-card.current {
                    border-color: #28a745;
                    background-color: #f8fff9;
                }
                
                .tenant-card.inactive {
                    border-color: #6c757d;
                    background-color: #f8f9fa;
                    opacity: 0.8;
                }
                
                .tenant-card.inactive h5 {
                    color: #6c757d;
                }
                
                .tenant-card h5 {
                    margin-bottom: 5px;
                    color: #333;
                }
                
                .tenant-card .tenant-id {
                    font-family: monospace;
                    color: #666;
                    font-size: 0.9em;
                }
                
                .tenant-card .tenant-stats {
                    font-size: 0.85em;
                    color: #888;
                    margin-top: 8px;
                }
                
                .tenant-card .switch-btn {
                    margin-top: 10px;
                }
                
                .current-tenant-badge {
                    display: inline-block;
                    background: #28a745;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.8em;
                    margin-left: 10px;
                }
                
                .tenant-actions .btn-group-vertical {
                    gap: 2px;
                }
                
                .tenant-actions .btn {
                    border-radius: 4px;
                    min-width: 32px;
                }
                
                .tenant-card .d-flex {
                    gap: 10px;
                }
                
                .tenant-card:hover .tenant-actions {
                    opacity: 1;
                }
                
                .tenant-actions {
                    opacity: 0.7;
                    transition: opacity 0.3s ease;
                }
            </style>
        `);
    }
    
    async load_data() {
        try {
            // Load current tenant info
            const currentTenant = await this.call_api('get_current_tenant_info');
            this.render_current_tenant(currentTenant);
            
            // Load available tenants
            const tenants = await this.call_api('get_available_tenants');
            this.render_tenant_list(tenants, currentTenant.tenant_id);
            
        } catch (error) {
            console.error('Tenant data load error:', error);
            this.show_error('Failed to load tenant data: ' + (error.message || 'Unknown error'));
        }
    }
    
    render_current_tenant(tenant) {
        const stats = tenant.stats;
        const $info = $('#current-tenant-info');
        
        $info.html(`
            <div class="row">
                <div class="col-md-6">
                    <h5>${tenant.tenant_name} <span class="current-tenant-badge">CURRENT</span></h5>
                    <p><strong>Tenant ID:</strong> <code>${tenant.tenant_id}</code></p>
                    <p><strong>Domain:</strong> ${tenant.primary_domain || 'N/A'}</p>
                    <p><strong>Status:</strong> <span class="badge badge-success">${tenant.status}</span></p>
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
    
    render_tenant_list(tenants, currentTenantId) {
        const $list = $('#tenant-list');
        
        if (tenants.length === 0) {
            $list.html('<p class="text-muted">No tenants available</p>');
            return;
        }
        
        let html = '';
        tenants.forEach(tenant => {
            const isCurrent = tenant.tenant_id === currentTenantId;
            let cardClass = 'tenant-card';
            if (isCurrent) {
                cardClass += ' current';
            } else if (tenant.status === 'Inactive') {
                cardClass += ' inactive';
            }
            const statusColor = tenant.status === 'Active' ? 'success' : 'secondary';
            
            html += `
                <div class="${cardClass}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1" onclick="tenantSwitcher.switchTenant('${tenant.tenant_id}')" style="cursor: pointer;">
                            <h5>${tenant.tenant_name}${isCurrent ? '<span class="current-tenant-badge">CURRENT</span>' : ''}</h5>
                            <div class="tenant-id">ID: ${tenant.tenant_id}</div>
                            <div>Domain: ${tenant.primary_domain || 'N/A'}</div>
                            <div>Status: <span class="badge badge-${statusColor}">${tenant.status}</span></div>
                        </div>
                        <div class="tenant-actions">
                            <div class="btn-group-vertical btn-group-sm">
                                <button class="btn btn-outline-info" onclick="event.stopPropagation(); tenantSwitcher.viewTenantStats('${tenant.tenant_id}')" title="View Statistics">
                                    <i class="fa fa-chart-bar"></i>
                                </button>
                                <button class="btn btn-outline-primary" onclick="event.stopPropagation(); tenantSwitcher.showEditTenantForm('${tenant.tenant_id}')" title="Edit Tenant">
                                    <i class="fa fa-edit"></i>
                                </button>
                                ${tenant.status === 'Active' ? 
                                    `<button class="btn btn-outline-warning" onclick="event.stopPropagation(); tenantSwitcher.deactivateTenant('${tenant.tenant_id}')" title="Deactivate">
                                        <i class="fa fa-pause"></i>
                                    </button>` : 
                                    `<button class="btn btn-outline-success" onclick="event.stopPropagation(); tenantSwitcher.activateTenant('${tenant.tenant_id}')" title="Activate">
                                        <i class="fa fa-play"></i>
                                    </button>`
                                }
                                <button class="btn btn-outline-danger" onclick="event.stopPropagation(); tenantSwitcher.deleteTenant('${tenant.tenant_id}')" title="Delete Tenant">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    ${!isCurrent && tenant.status === 'Active' ? '<button class="btn btn-sm btn-primary switch-btn mt-2" onclick="event.stopPropagation(); tenantSwitcher.switchTenant(\'' + tenant.tenant_id + '\')"><i class="fa fa-exchange"></i> Switch to this tenant</button>' : ''}
                    ${tenant.status === 'Inactive' ? '<div class="mt-2"><small class="text-muted"><i class="fa fa-info-circle"></i> Activate tenant to enable switching</small></div>' : ''}
                </div>
            `;
        });
        
        $list.html(html);
    }
    
    async switchTenant(tenantId) {
        try {
            frappe.show_alert({
                message: 'Switching tenant context...',
                indicator: 'blue'
            });
            
            // Store in localStorage for workspace
            localStorage.setItem('flansa_current_tenant_id', tenantId);
            
            const result = await this.call_api('switch_tenant_context', { tenant_id: tenantId });
            
            if (result.status === 'success') {
                frappe.show_alert({
                    message: `Switched to tenant: ${tenantId}`,
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
                message: 'Failed to switch tenant: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async viewTenantStats(tenantId) {
        try {
            const stats = await this.call_api('get_tenant_statistics', { tenant_id: tenantId });
            
            if (stats.status === 'success') {
                const s = stats.statistics;
                frappe.msgprint({
                    title: `Tenant Statistics: ${tenantId}`,
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
                message: 'Failed to load tenant statistics: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async activateTenant(tenantId) {
        frappe.confirm(
            `Are you sure you want to activate tenant: <strong>${tenantId}</strong>?`,
            async () => {
                try {
                    const result = await this.call_api('activate_tenant', { tenant_id: tenantId });
                    if (result.status === 'success') {
                        frappe.show_alert('Tenant activated successfully', 'green');
                        this.load_data(); // Refresh the list
                    }
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to activate tenant: ' + error.message,
                        indicator: 'red'
                    });
                }
            }
        );
    }
    
    async deactivateTenant(tenantId) {
        frappe.confirm(
            `Are you sure you want to deactivate tenant: <strong>${tenantId}</strong>?<br><small class="text-warning">This will prevent users from accessing this tenant.</small>`,
            async () => {
                try {
                    const result = await this.call_api('deactivate_tenant', { tenant_id: tenantId });
                    if (result.status === 'success') {
                        frappe.show_alert('Tenant deactivated successfully', 'orange');
                        this.load_data(); // Refresh the list
                    }
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to deactivate tenant: ' + error.message,
                        indicator: 'red'
                    });
                }
            }
        );
    }
    
    showCreateTenantForm() {
        this.showTenantForm(false, null);
    }
    
    async showEditTenantForm(tenantId) {
        try {
            const tenantData = await this.call_api('get_tenant_details', { tenant_id: tenantId });
            this.showTenantForm(true, tenantData);
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load tenant data: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    showTenantForm(isEdit, tenantData) {
        const title = isEdit ? 'Edit Tenant' : 'Create New Tenant';
        const primaryAction = isEdit ? 'Update Tenant' : 'Create Tenant';
        
        const dialog = new frappe.ui.Dialog({
            title: title,
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'tenant_name',
                    label: 'Tenant Name',
                    reqd: 1,
                    default: tenantData?.tenant_name || ''
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'tenant_id',
                    label: 'Tenant ID',
                    default: tenantData?.tenant_id || '',
                    read_only: isEdit ? 1 : 0,
                    description: isEdit ? 'Tenant ID cannot be changed' : 'Auto-generated from name'
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'admin_email',
                    label: 'Admin Email',
                    reqd: 1,
                    default: tenantData?.admin_email || ''
                },
                {
                    fieldtype: 'Data',
                    fieldname: 'primary_domain',
                    label: 'Primary Domain',
                    default: tenantData?.primary_domain || ''
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'max_users',
                    label: 'Max Users',
                    options: '10\n25\n50\n100\n250\n500\n1000',
                    default: tenantData?.max_users || 100
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'max_tables',
                    label: 'Max Tables',
                    options: '5\n10\n25\n50\n100\n200',
                    default: tenantData?.max_tables || 50
                },
                {
                    fieldtype: 'Select',
                    fieldname: 'storage_limit_gb',
                    label: 'Storage Limit (GB)',
                    options: '1\n5\n10\n25\n50\n100',
                    default: tenantData?.storage_limit_gb || 10
                },
                {
                    fieldtype: 'Check',
                    fieldname: 'custom_branding',
                    label: 'Enable Custom Branding',
                    default: tenantData?.custom_branding || 0
                },
                {
                    fieldtype: 'Small Text',
                    fieldname: 'custom_domains',
                    label: 'Custom Domains (one per line)',
                    default: tenantData?.custom_domains ? tenantData.custom_domains.map(d => d.domain).join('\n') : ''
                }
            ],
            primary_action_label: primaryAction,
            primary_action: (values) => {
                if (isEdit) {
                    this.updateTenant(tenantData.tenant_id, values, dialog);
                } else {
                    this.createTenant(values, dialog);
                }
            }
        });
        
        // Auto-generate tenant ID for new tenants
        if (!isEdit) {
            dialog.fields_dict.tenant_name.$input.on('input', () => {
                const name = dialog.get_value('tenant_name');
                if (name) {
                    const cleanedName = name.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
                    const tenantId = cleanedName.substring(0, 20) + '_' + Date.now().toString().slice(-6);
                    dialog.set_value('tenant_id', tenantId);
                }
            });
        }
        
        dialog.show();
    }
    
    async createTenant(values, dialog) {
        try {
            const result = await this.call_api('register_new_tenant', values);
            dialog.hide();
            frappe.show_alert('Tenant created successfully', 'green');
            this.load_data();
            
            // Ask if user wants to switch to new tenant
            frappe.confirm(
                `Tenant "${values.tenant_name}" created successfully. Switch to this tenant?`,
                () => this.switchTenant(result.tenant_id)
            );
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to create tenant: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async updateTenant(tenantId, values, dialog) {
        try {
            values.tenant_id = tenantId;
            await this.call_api('update_tenant', values);
            dialog.hide();
            frappe.show_alert('Tenant updated successfully', 'green');
            this.load_data();
        } catch (error) {
            // Check if it's a version conflict but update succeeded
            if (error.message && error.message.includes('Document has been modified')) {
                dialog.hide();
                frappe.show_alert('Tenant updated successfully', 'green');
                this.load_data();
            } else {
                frappe.msgprint({
                    title: 'Error',
                    message: 'Failed to update tenant: ' + error.message,
                    indicator: 'red'
                });
            }
        }
    }
    
    async deleteTenant(tenantId) {
        frappe.confirm(
            `Are you sure you want to <strong>permanently delete</strong> tenant: <strong>${tenantId}</strong>?<br><br><span class="text-danger">⚠️ This action cannot be undone and will delete all tenant data!</span>`,
            async () => {
                try {
                    await this.call_api('delete_tenant', { tenant_id: tenantId });
                    frappe.show_alert('Tenant deleted successfully', 'green');
                    this.load_data();
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to delete tenant: ' + error.message,
                        indicator: 'red'
                    });
                }
            }
        );
    }
    
    async call_api(method, args = {}) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `flansa.flansa_core.page.tenant_switcher.tenant_switcher.${method}`,
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
window.tenantSwitcher = null;

frappe.pages['tenant-switcher'].on_page_show = function() {
    if (window.tenantSwitcher) {
        window.tenantSwitcher.load_data();
    }
};

// Set global reference when page loads
$(document).ready(function() {
    setTimeout(() => {
        if (frappe.get_route()[0] === 'tenant-switcher') {
            window.tenantSwitcher = new TenantSwitcher(frappe.pages['tenant-switcher']);
        }
    }, 500);
});