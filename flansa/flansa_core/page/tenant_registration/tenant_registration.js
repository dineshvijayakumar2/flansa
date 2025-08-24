frappe.pages['tenant-registration'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Tenant Registration',
        single_column: true
    });
    
    new TenantRegistration(page);
};

class TenantRegistration {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        this.isEditMode = false;
        this.editingTenantId = null;
        
        // Check if we're in edit mode (tenant ID in route)
        const route = frappe.get_route();
        if (route.length > 1 && route[1]) {
            this.isEditMode = true;
            this.editingTenantId = route[1];
        }
        
        this.setup_ui();
        this.load_limits();
    }
    
    setup_ui() {
        this.$container.html(`
            <div class="tenant-registration-container">
                <div class="row">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h3><i class="fa fa-${this.isEditMode ? 'edit' : 'plus-circle'}"></i> ${this.isEditMode ? 'Edit Tenant' : 'Register New Tenant'}</h3>
                                <p class="text-muted">${this.isEditMode ? 'Modify tenant information and settings' : 'Create a new tenant for multi-tenant management'}</p>
                            </div>
                            <div class="card-body">
                                <form id="tenant-registration-form">
                                    <!-- Basic Information -->
                                    <div class="form-section">
                                        <h5><i class="fa fa-info-circle"></i> Basic Information</h5>
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label for="tenant_name">Tenant Name *</label>
                                                    <input type="text" class="form-control" id="tenant_name" name="tenant_name" required placeholder="e.g., ACME Corporation">
                                                    <small class="form-text text-muted">This will be used to generate the tenant ID</small>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label for="generated_tenant_id">${this.isEditMode ? 'Tenant ID (Read-only)' : 'Generated Tenant ID'}</label>
                                                    <input type="text" class="form-control" id="generated_tenant_id" readonly placeholder="${this.isEditMode ? 'Loading...' : 'Will be generated automatically'}">
                                                    <small class="form-text text-muted">${this.isEditMode ? 'Tenant ID cannot be changed' : 'Auto-generated from tenant name'}</small>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label for="admin_email">Admin Email *</label>
                                            <input type="email" class="form-control" id="admin_email" name="admin_email" required placeholder="admin@company.com">
                                            <small class="form-text text-muted">Primary administrator email for this tenant</small>
                                        </div>
                                    </div>
                                    
                                    <!-- Domain Configuration -->
                                    <div class="form-section">
                                        <h5><i class="fa fa-globe"></i> Domain Configuration</h5>
                                        <div class="form-group">
                                            <label for="primary_domain">Primary Domain</label>
                                            <input type="text" class="form-control" id="primary_domain" name="primary_domain" placeholder="tenant.flansa.local (auto-generated if empty)">
                                            <small class="form-text text-muted">Leave empty for auto-generated domain</small>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label for="custom_domains">Custom Domains</label>
                                            <textarea class="form-control" id="custom_domains" name="custom_domains" rows="3" placeholder="app.company.com&#10;company-app.com&#10;(one domain per line)"></textarea>
                                            <small class="form-text text-muted">Additional custom domains (optional, one per line)</small>
                                        </div>
                                    </div>
                                    
                                    <!-- Resource Limits -->
                                    <div class="form-section">
                                        <h5><i class="fa fa-cogs"></i> Resource Limits</h5>
                                        <div class="row">
                                            <div class="col-md-4">
                                                <div class="form-group">
                                                    <label for="max_users">Max Users</label>
                                                    <select class="form-control" id="max_users" name="max_users">
                                                        <option value="100" selected>100</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="form-group">
                                                    <label for="max_tables">Max Tables</label>
                                                    <select class="form-control" id="max_tables" name="max_tables">
                                                        <option value="50" selected>50</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="form-group">
                                                    <label for="storage_limit_gb">Storage Limit (GB)</label>
                                                    <select class="form-control" id="storage_limit_gb" name="storage_limit_gb">
                                                        <option value="10" selected>10 GB</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Features -->
                                    <div class="form-section">
                                        <h5><i class="fa fa-star"></i> Features</h5>
                                        <div class="form-group">
                                            <div class="form-check">
                                                <input type="checkbox" class="form-check-input" id="custom_branding" name="custom_branding" value="1">
                                                <label class="form-check-label" for="custom_branding">
                                                    Enable Custom Branding
                                                </label>
                                                <small class="form-text text-muted">Allow tenant to customize branding and theme</small>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Actions -->
                                    <div class="form-actions">
                                        <button type="submit" class="btn btn-primary btn-lg">
                                            <i class="fa fa-${this.isEditMode ? 'save' : 'plus-circle'}"></i> ${this.isEditMode ? 'Update Tenant' : 'Register Tenant'}
                                        </button>
                                        <button type="button" class="btn btn-secondary btn-lg ml-2" onclick="frappe.set_route('tenant-switcher')">
                                            <i class="fa fa-arrow-left"></i> Back to Tenant Management
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <h5><i class="fa fa-info-circle"></i> Registration Info</h5>
                            </div>
                            <div class="card-body">
                                <h6>Tenant ID Generation</h6>
                                <p>The tenant ID is automatically generated from the tenant name, cleaned and made URL-safe.</p>
                                
                                <h6>Domain Configuration</h6>
                                <p>If no primary domain is specified, one will be auto-generated. Custom domains can be added for branded access.</p>
                                
                                <h6>Resource Limits</h6>
                                <p>Set appropriate limits based on the tenant's expected usage. These can be modified later if needed.</p>
                                
                                <h6>Multi-Tenant Mode</h6>
                                <p>Once a second tenant is registered, the system automatically enables multi-tenant mode with complete data isolation.</p>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h5><i class="fa fa-users"></i> Existing Tenants</h5>
                            </div>
                            <div class="card-body" id="existing-tenants-list">
                                <div class="text-center">
                                    <i class="fa fa-spinner fa-spin"></i> Loading...
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .tenant-registration-container {
                    padding: 20px;
                }
                
                .form-section {
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #eee;
                }
                
                .form-section:last-of-type {
                    border-bottom: none;
                }
                
                .form-section h5 {
                    color: #333;
                    margin-bottom: 15px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #007bff;
                }
                
                .form-actions {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 2px solid #eee;
                }
                
                .tenant-preview {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 10px;
                }
                
                .tenant-preview h6 {
                    margin-bottom: 5px;
                    color: #495057;
                }
                
                .tenant-preview .tenant-id {
                    font-family: monospace;
                    color: #6c757d;
                    font-size: 0.9em;
                }
            </style>
        `);
        
        this.bind_events();
    }
    
    bind_events() {
        // Auto-generate tenant ID on name change
        $('#tenant_name').on('input', () => {
            this.generate_tenant_id_preview();
        });
        
        // Form submission
        $('#tenant-registration-form').on('submit', (e) => {
            e.preventDefault();
            this.register_tenant();
        });
        
        // Domain validation
        $('#primary_domain').on('blur', () => {
            this.validate_domain_field('primary_domain');
        });
    }
    
    async generate_tenant_id_preview() {
        const tenantName = $('#tenant_name').val();
        if (!tenantName) {
            $('#generated_tenant_id').val('');
            return;
        }
        
        try {
            const response = await this.call_api('check_tenant_id_availability', {
                tenant_name: tenantName
            });
            
            $('#generated_tenant_id').val(response.tenant_id);
            
            if (!response.available) {
                $('#generated_tenant_id').addClass('is-invalid');
                frappe.show_alert('Tenant ID already exists', 'orange');
            } else {
                $('#generated_tenant_id').removeClass('is-invalid');
            }
            
        } catch (error) {
            console.error('Error generating tenant ID:', error);
        }
    }
    
    async validate_domain_field(fieldName) {
        const domain = $(`#${fieldName}`).val();
        if (!domain) return;
        
        try {
            const response = await this.call_api('validate_domain', {
                domain: domain
            });
            
            const field = $(`#${fieldName}`);
            if (response.valid) {
                field.removeClass('is-invalid').addClass('is-valid');
            } else {
                field.removeClass('is-valid').addClass('is-invalid');
                frappe.show_alert(response.message, 'orange');
            }
            
        } catch (error) {
            console.error('Error validating domain:', error);
        }
    }
    
    async load_limits() {
        try {
            // Load existing tenant data if in edit mode
            if (this.isEditMode) {
                await this.load_tenant_data();
            }
            
            const limits = await this.call_api('get_tenant_limits');
            
            // Populate user limits
            const userSelect = $('#max_users');
            userSelect.empty();
            limits.user_limits.forEach(limit => {
                userSelect.append(`<option value="${limit}">${limit} users</option>`);
            });
            userSelect.val('100');
            
            // Populate table limits
            const tableSelect = $('#max_tables');
            tableSelect.empty();
            limits.table_limits.forEach(limit => {
                tableSelect.append(`<option value="${limit}">${limit} tables</option>`);
            });
            tableSelect.val('50');
            
            // Populate storage limits
            const storageSelect = $('#storage_limit_gb');
            storageSelect.empty();
            limits.storage_limits.forEach(limit => {
                storageSelect.append(`<option value="${limit}">${limit} GB</option>`);
            });
            storageSelect.val('10');
            
        } catch (error) {
            console.error('Error loading limits:', error);
        }
        
        // Load existing tenants
        this.load_existing_tenants();
    }
    
    async load_tenant_data() {
        try {
            const tenantData = await this.call_api('get_tenant_details', { tenant_id: this.editingTenantId });
            
            // Populate form fields
            $('#tenant_name').val(tenantData.tenant_name);
            $('#generated_tenant_id').val(tenantData.tenant_id);
            $('#admin_email').val(tenantData.admin_email);
            $('#primary_domain').val(tenantData.primary_domain);
            $('#max_users').val(tenantData.max_users);
            $('#max_tables').val(tenantData.max_tables);
            $('#storage_limit_gb').val(tenantData.storage_limit_gb);
            $('#custom_branding').prop('checked', tenantData.custom_branding === 1);
            
            // Handle custom domains
            if (tenantData.custom_domains && tenantData.custom_domains.length > 0) {
                const domainsText = tenantData.custom_domains.map(d => d.domain).join('\n');
                $('#custom_domains').val(domainsText);
            }
            
            // Disable tenant name field in edit mode (to prevent ID changes)
            $('#tenant_name').prop('disabled', true);
            
        } catch (error) {
            frappe.msgprint({
                title: 'Error Loading Tenant',
                message: 'Failed to load tenant data: ' + error.message,
                indicator: 'red'
            });
            frappe.set_route('tenant-switcher'); // Go back to tenant switcher
        }
    }
    
    async load_existing_tenants() {
        try {
            const tenants = await this.call_api('get_available_tenants');
            const container = $('#existing-tenants-list');
            
            if (tenants.length === 0) {
                container.html('<p class="text-muted">No existing tenants</p>');
                return;
            }
            
            let html = '';
            tenants.forEach(tenant => {
                html += `
                    <div class="tenant-preview">
                        <h6>${tenant.tenant_name}</h6>
                        <div class="tenant-id">ID: ${tenant.tenant_id}</div>
                        <div><small>Domain: ${tenant.primary_domain || 'N/A'}</small></div>
                        <div><small>Status: <span class="badge badge-${tenant.status === 'Active' ? 'success' : 'secondary'}">${tenant.status}</span></small></div>
                    </div>
                `;
            });
            
            container.html(html);
            
        } catch (error) {
            $('#existing-tenants-list').html('<p class="text-muted">Error loading tenants</p>');
        }
    }
    
    async register_tenant() {
        // Show loading state
        const submitBtn = $('button[type="submit"]');
        const originalText = submitBtn.html();
        
        try {
            submitBtn.html('<i class="fa fa-spinner fa-spin"></i> Registering...').prop('disabled', true);
            
            // Gather form data
            const formData = {
                tenant_name: $('#tenant_name').val(),
                admin_email: $('#admin_email').val(),
                primary_domain: $('#primary_domain').val(),
                max_users: $('#max_users').val(),
                max_tables: $('#max_tables').val(),
                storage_limit_gb: $('#storage_limit_gb').val(),
                custom_branding: $('#custom_branding').is(':checked') ? 1 : 0,
                custom_domains: $('#custom_domains').val()
            };
            
            // Register or update tenant
            const apiMethod = this.isEditMode ? 'update_tenant' : 'register_new_tenant';
            if (this.isEditMode) {
                formData.tenant_id = this.editingTenantId; // Add tenant_id for updates
            }
            const result = await this.call_api(apiMethod, formData);
            
            if (this.isEditMode) {
                // Show simple success message for updates
                frappe.msgprint({
                    title: 'Success',
                    message: `
                        <div class="text-center">
                            <i class="fa fa-check-circle text-success" style="font-size: 48px;"></i>
                            <h4 class="mt-3">Tenant Updated Successfully!</h4>
                            <p><strong>Tenant:</strong> ${result.tenant_name}</p>
                            <p><strong>Tenant ID:</strong> <code>${result.tenant_id}</code></p>
                        </div>
                    `,
                    indicator: 'green',
                    primary_action: {
                        label: 'Back to Tenant Management',
                        action: () => frappe.set_route('tenant-switcher')
                    }
                });
            } else {
                // Show success message with options for new registrations
                frappe.confirm(
                    `<div class="text-center">
                        <i class="fa fa-check-circle text-success" style="font-size: 48px;"></i>
                        <h4 class="mt-3">Tenant Registered Successfully!</h4>
                        <p><strong>Tenant:</strong> ${result.tenant_name}</p>
                        <p><strong>Tenant ID:</strong> <code>${result.tenant_id}</code></p>
                        <p><strong>Domain:</strong> ${result.primary_domain}</p>
                        <hr>
                        <p class="mt-3">Would you like to switch to this tenant and go to Flansa Workspace?</p>
                    </div>`,
                    () => {
                        // User clicked Yes - Switch tenant and redirect
                        this.switch_tenant_and_redirect(result.tenant_id);
                    },
                    () => {
                        // User clicked No - Just redirect to workspace with current tenant
                        this.redirect_to_workspace();
                    },
                    'Switch to New Tenant?',
                    'Switch & Go to Workspace',
                    'Go to Workspace'
                );
            }
            
            // Reset form
            $('#tenant-registration-form')[0].reset();
            $('#generated_tenant_id').val('');
            
            // Reload existing tenants list
            this.load_existing_tenants();
            
        } catch (error) {
            frappe.msgprint({
                title: 'Registration Failed',
                message: error.message || 'An error occurred during tenant registration',
                indicator: 'red'
            });
        } finally {
            // Reset button state
            submitBtn.html(originalText).prop('disabled', false);
        }
    }
    
    async switch_tenant_and_redirect(tenant_id) {
        try {
            // Show switching message
            frappe.show_alert('Switching to new tenant...', 'blue');
            
            // Set the tenant in session/local storage for the workspace
            localStorage.setItem('flansa_current_tenant_id', tenant_id);
            
            // Redirect to Flansa Workspace
            setTimeout(() => {
                frappe.set_route('flansa-workspace');
            }, 500);
            
        } catch (error) {
            console.error('Error switching tenant:', error);
            frappe.show_alert('Error switching tenant, redirecting anyway...', 'orange');
            this.redirect_to_workspace();
        }
    }
    
    redirect_to_workspace() {
        frappe.show_alert('Redirecting to Flansa Workspace...', 'blue');
        setTimeout(() => {
            frappe.set_route('flansa-workspace');
        }, 500);
    }
    
    async call_api(method, args = {}) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `flansa.flansa_core.page.tenant_registration.tenant_registration.${method}`,
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
}

// Make globally accessible
window.tenantRegistration = null;

frappe.pages['tenant-registration'].on_page_show = function() {
    if (window.tenantRegistration) {
        window.tenantRegistration.load_existing_tenants();
    }
};