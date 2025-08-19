frappe.pages['tenant-switcher'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Tenant Switcher',
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
                                <button class="btn btn-primary btn-block" onclick="window.location.reload()">
                                    <i class="fa fa-refresh"></i> Refresh Page
                                </button>
                                <button class="btn btn-secondary btn-block mt-2" onclick="frappe.set_route('List', 'Flansa Tenant Registry')">
                                    <i class="fa fa-list"></i> Manage Tenants
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
            this.show_error('Failed to load tenant data: ' + error.message);
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
            const cardClass = isCurrent ? 'tenant-card current' : 'tenant-card';
            
            html += `
                <div class="${cardClass}" onclick="tenantSwitcher.switchTenant('${tenant.tenant_id}')">
                    <h5>${tenant.tenant_name}${isCurrent ? '<span class="current-tenant-badge">CURRENT</span>' : ''}</h5>
                    <div class="tenant-id">ID: ${tenant.tenant_id}</div>
                    <div>Domain: ${tenant.primary_domain || 'N/A'}</div>
                    <div>Status: <span class="badge badge-${tenant.status === 'Active' ? 'success' : 'secondary'}">${tenant.status}</span></div>
                    ${!isCurrent ? '<button class="btn btn-sm btn-primary switch-btn" onclick="event.stopPropagation(); tenantSwitcher.switchTenant(\'' + tenant.tenant_id + '\')"><i class="fa fa-exchange"></i> Switch to this tenant</button>' : ''}
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
    
    async call_api(method, args = {}) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `flansa.flansa_core.page.tenant_switcher.tenant_switcher.${method}`,
                args: args,
                callback: (response) => {
                    if (response.message) {
                        resolve(response.message);
                    } else {
                        reject(new Error('No response data'));
                    }
                },
                error: (error) => {
                    reject(error);
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