frappe.pages['flansa-table-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Flansa Table Builder',
        single_column: true
    });
    
    // Initialize the Table Builder
    new FlansaTableBuilder(page);
};

class FlansaTableBuilder {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        this.table_id = null;
        this.table_data = null;
        this.fields = [];
        
        this.init();
    }
    
    async init() {
        // Get table from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.table_id = urlParams.get('table');
        
        if (!this.table_id) {
            this.show_table_selector();
        } else {
            await this.load_table();
        }
    }
    
    show_table_selector() {
        this.$container.html(`
            <div class="table-selector-container" style="max-width: 800px; margin: 40px auto;">
                <div class="card">
                    <div class="card-header">
                        <h3>Select a Table to Build</h3>
                    </div>
                    <div class="card-body">
                        <div id="table-list" style="max-height: 500px; overflow-y: auto;">
                            <div class="text-center text-muted">Loading tables...</div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        this.load_table_list();
    }
    
    async load_table_list() {
        try {
            const result = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    fields: ['name', 'table_name', 'table_label', 'doctype_name'],
                    order_by: 'creation desc',
                    limit_page_length: 100
                }
            });
            
            const tables = result.message || [];
            const $list = this.$container.find('#table-list');
            
            if (tables.length === 0) {
                $list.html('<div class="text-center text-muted">No tables found. Create a table first.</div>');
                return;
            }
            
            let html = '<div class="list-group">';
            tables.forEach(table => {
                html += `
                    <a href="/app/flansa-table-builder?table=${table.name}" 
                       class="list-group-item list-group-item-action">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="mb-1">${table.table_label || table.table_name}</h5>
                                <small class="text-muted">${table.table_name}</small>
                            </div>
                            <div>
                                ${table.doctype_name ? 
                                    '<span class="badge badge-success">Active</span>' : 
                                    '<span class="badge badge-warning">Not Generated</span>'}
                            </div>
                        </div>
                    </a>
                `;
            });
            html += '</div>';
            
            $list.html(html);
            
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load table list',
                indicator: 'red'
            });
            console.error('Error loading tables:', error);
        }
    }
    
    async load_table() {
        try {
            // Load table data
            const table_result = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Flansa Table',
                    name: this.table_id
                }
            });
            
            this.table_data = table_result.message;
            
            if (!this.table_data) {
                frappe.msgprint('Table not found');
                this.show_table_selector();
                return;
            }
            
            // Update page title
            this.page.set_title(`Table Builder: ${this.table_data.table_label || this.table_data.table_name}`);
            
            // Setup page UI
            this.setup_page();
            
            // Load fields
            await this.load_fields();
            
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load table',
                indicator: 'red'
            });
            console.error('Error loading table:', error);
        }
    }
    
    setup_page() {
        // Add buttons
        this.page.add_button('Back to Tables', () => {
            window.location.href = '/app/flansa-table-builder';
        });
        
        this.page.add_button('Add Field', () => {
            this.show_add_field_dialog();
        }, 'primary');
        
        // Create main layout
        this.$container.html(`
            <div class="table-builder-container">
                <!-- Table Info Header -->
                <div class="table-info-header" style="background: white; border: 1px solid #d1d8dd; 
                     border-radius: 4px; padding: 15px; margin-bottom: 20px;">
                    <div class="row">
                        <div class="col-md-8">
                            <h4 style="margin: 0 0 5px 0;">${this.table_data.table_label}</h4>
                            <div class="text-muted">
                                <small>Table Name: ${this.table_data.table_name}</small>
                                ${this.table_data.doctype_name ? 
                                    `<small class="ml-3">DocType: ${this.table_data.doctype_name}</small>` : ''}
                            </div>
                        </div>
                        <div class="col-md-4 text-right">
                            <button class="btn btn-sm btn-default" onclick="frappe.pages['flansa-table-builder'].builder.refresh_fields()">
                                <i class="fa fa-refresh"></i> Refresh
                            </button>
                            ${this.table_data.doctype_name ? 
                                `<button class="btn btn-sm btn-primary ml-2" onclick="frappe.pages['flansa-table-builder'].builder.view_records()">
                                    <i class="fa fa-eye"></i> View Records
                                </button>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Fields Section -->
                <div class="fields-section">
                    <div class="section-header" style="display: flex; justify-content: space-between; 
                         align-items: center; margin-bottom: 15px;">
                        <h5>Table Fields</h5>
                        <div class="field-stats">
                            <span class="badge badge-default" id="field-count">0 fields</span>
                        </div>
                    </div>
                    
                    <!-- Search Bar -->
                    <div class="field-search-bar" style="margin-bottom: 15px;">
                        <input type="text" class="form-control" id="field-search" 
                               placeholder="Search fields..." style="max-width: 400px;">
                    </div>
                    
                    <!-- Fields List -->
                    <div id="fields-container">
                        <div class="text-center text-muted">Loading fields...</div>
                    </div>
                </div>
            </div>
        `);
        
        // Store reference for button handlers
        frappe.pages['flansa-table-builder'].builder = this;
        
        // Setup search
        this.$container.find('#field-search').on('input', (e) => {
            this.filter_fields(e.target.value);
        });
    }
    
    async load_fields() {
        try {
            // Use the filtered fields API to hide tenant fields
            const result = await frappe.call({
                method: 'flansa.flansa_core.api.field_management.get_visual_builder_fields',
                args: {
                    table_name: this.table_id
                }
            });
            
            if (result.message && result.message.success) {
                this.fields = result.message.fields || [];
                this.render_fields();
            } else {
                frappe.msgprint('Failed to load fields');
            }
            
        } catch (error) {
            frappe.msgprint({
                title: 'Error',
                message: 'Failed to load fields',
                indicator: 'red'
            });
            console.error('Error loading fields:', error);
        }
    }
    
    render_fields() {
        const $container = this.$container.find('#fields-container');
        
        // Update count
        this.$container.find('#field-count').text(`${this.fields.length} fields`);
        
        if (this.fields.length === 0) {
            $container.html(`
                <div class="text-center" style="padding: 40px;">
                    <i class="fa fa-database" style="font-size: 48px; color: #8d99a6;"></i>
                    <h5 style="margin-top: 15px;">No fields yet</h5>
                    <p class="text-muted">Add your first field to get started</p>
                    <button class="btn btn-primary" onclick="frappe.pages['flansa-table-builder'].builder.show_add_field_dialog()">
                        <i class="fa fa-plus"></i> Add Field
                    </button>
                </div>
            `);
            return;
        }
        
        // Group fields by category
        const user_fields = this.fields.filter(f => f.category === 'user');
        const system_fields = this.fields.filter(f => f.category === 'system');
        
        let html = '<div class="fields-list">';
        
        // User fields
        if (user_fields.length > 0) {
            html += `
                <div class="field-category" style="margin-bottom: 30px;">
                    <h6 style="color: #6c757d; margin-bottom: 15px;">
                        <i class="fa fa-user"></i> User Fields (${user_fields.length})
                    </h6>
                    <div class="field-grid">
            `;
            
            user_fields.forEach(field => {
                html += this.render_field_card(field);
            });
            
            html += '</div></div>';
        }
        
        // System fields
        if (system_fields.length > 0) {
            html += `
                <div class="field-category" style="margin-bottom: 30px;">
                    <h6 style="color: #6c757d; margin-bottom: 15px;">
                        <i class="fa fa-cog"></i> System Fields (${system_fields.length})
                    </h6>
                    <div class="field-grid">
            `;
            
            system_fields.forEach(field => {
                html += this.render_field_card(field, true);
            });
            
            html += '</div></div>';
        }
        
        html += '</div>';
        
        $container.html(html);
        
        // Add CSS for field grid
        if (!document.getElementById('table-builder-styles')) {
            const style = document.createElement('style');
            style.id = 'table-builder-styles';
            style.innerHTML = `
                .field-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 15px;
                }
                
                .field-card {
                    background: white;
                    border: 1px solid #d1d8dd;
                    border-radius: 4px;
                    padding: 12px;
                    transition: all 0.2s;
                }
                
                .field-card:hover {
                    border-color: #5e64ff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .field-card.system-field {
                    background: #f8f9fa;
                }
                
                .field-card .field-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: 8px;
                }
                
                .field-card .field-name {
                    font-weight: 600;
                    color: #2e3338;
                    font-size: 14px;
                }
                
                .field-card .field-type {
                    display: inline-block;
                    padding: 2px 8px;
                    background: #e7f3ff;
                    color: #0066cc;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: 500;
                }
                
                .field-card .field-label {
                    color: #6c757d;
                    font-size: 13px;
                    margin-bottom: 4px;
                }
                
                .field-card .field-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 8px;
                }
                
                .field-card .field-actions button {
                    padding: 4px 8px;
                    font-size: 12px;
                    border-radius: 3px;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    render_field_card(field, is_system = false) {
        const field_type_colors = {
            'Data': '#0066cc',
            'Text': '#28a745',
            'Int': '#fd7e14',
            'Float': '#fd7e14',
            'Currency': '#e83e8c',
            'Date': '#6f42c1',
            'Datetime': '#6f42c1',
            'Check': '#17a2b8',
            'Select': '#20c997',
            'Link': '#dc3545',
            'Table': '#343a40'
        };
        
        const type_color = field_type_colors[field.fieldtype] || '#6c757d';
        
        return `
            <div class="field-card ${is_system ? 'system-field' : ''}" data-fieldname="${field.fieldname}">
                <div class="field-header">
                    <div>
                        <div class="field-name">${field.fieldname}</div>
                        <div class="field-label">${field.label || field.fieldname}</div>
                    </div>
                    <span class="field-type" style="background: ${type_color}20; color: ${type_color};">
                        ${field.fieldtype}
                    </span>
                </div>
                
                ${field.options ? `
                    <div style="font-size: 12px; color: #8d99a6; margin-top: 4px;">
                        <i class="fa fa-link"></i> ${field.options}
                    </div>
                ` : ''}
                
                ${field.reqd ? `
                    <div style="font-size: 12px; color: #d9534f; margin-top: 4px;">
                        <i class="fa fa-asterisk"></i> Required
                    </div>
                ` : ''}
                
                ${!is_system ? `
                    <div class="field-actions">
                        <button class="btn btn-xs btn-default" 
                                onclick="frappe.pages['flansa-table-builder'].builder.edit_field('${field.fieldname}')">
                            <i class="fa fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-xs btn-default" 
                                onclick="frappe.pages['flansa-table-builder'].builder.delete_field('${field.fieldname}')">
                            <i class="fa fa-trash"></i> Delete
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    filter_fields(search_term) {
        const term = search_term.toLowerCase();
        const cards = this.$container.find('.field-card');
        
        cards.each(function() {
            const $card = $(this);
            const fieldname = $card.data('fieldname').toLowerCase();
            const label = $card.find('.field-label').text().toLowerCase();
            
            if (fieldname.includes(term) || label.includes(term)) {
                $card.show();
            } else {
                $card.hide();
            }
        });
    }
    
    show_add_field_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Add Field',
            fields: [
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal field name (no spaces, use underscores)'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for the field'
                },
                {
                    label: 'Field Type',
                    fieldname: 'field_type',
                    fieldtype: 'Select',
                    options: ['Data', 'Text', 'Long Text', 'Int', 'Float', 'Currency', 
                             'Date', 'Datetime', 'Check', 'Select', 'Link', 'Table'],
                    reqd: 1,
                    default: 'Data'
                },
                {
                    label: 'Options',
                    fieldname: 'options',
                    fieldtype: 'Small Text',
                    description: 'For Select: Option1\\nOption2\\nOption3. For Link: DocType name',
                    depends_on: (doc) => ['Select', 'Link', 'Table'].includes(doc.field_type)
                },
                {
                    label: 'Is Required',
                    fieldname: 'is_required',
                    fieldtype: 'Check',
                    default: 0
                }
            ],
            primary_action_label: 'Add',
            primary_action: async (values) => {
                try {
                    const result = await frappe.call({
                        method: 'flansa.flansa_core.api.field_management.add_field',
                        args: {
                            table_name: this.table_id,
                            field_name: values.field_name,
                            field_label: values.field_label,
                            field_type: values.field_type,
                            options: values.options || '',
                            is_required: values.is_required || 0
                        }
                    });
                    
                    if (result.message && result.message.success) {
                        frappe.show_alert({
                            message: 'Field added successfully',
                            indicator: 'green'
                        });
                        dialog.hide();
                        this.load_fields();
                    } else {
                        frappe.msgprint({
                            title: 'Error',
                            message: result.message.error || 'Failed to add field',
                            indicator: 'red'
                        });
                    }
                } catch (error) {
                    frappe.msgprint({
                        title: 'Error',
                        message: 'Failed to add field',
                        indicator: 'red'
                    });
                }
            }
        });
        
        dialog.show();
    }
    
    edit_field(fieldname) {
        const field = this.fields.find(f => f.fieldname === fieldname);
        if (!field) return;
        
        const dialog = new frappe.ui.Dialog({
            title: `Edit Field: ${field.label}`,
            fields: [
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    default: field.label
                },
                {
                    label: 'Is Required',
                    fieldname: 'is_required',
                    fieldtype: 'Check',
                    default: field.reqd
                }
            ],
            primary_action_label: 'Update',
            primary_action: async (values) => {
                try {
                    const result = await frappe.call({
                        method: 'flansa.flansa_core.api.field_management.update_field',
                        args: {
                            table_name: this.table_id,
                            field_name: fieldname,
                            updates: {
                                field_label: values.field_label,
                                is_required: values.is_required
                            }
                        }
                    });
                    
                    if (result.message && result.message.success) {
                        frappe.show_alert({
                            message: 'Field updated successfully',
                            indicator: 'green'
                        });
                        dialog.hide();
                        this.load_fields();
                    } else {
                        frappe.msgprint('Failed to update field');
                    }
                } catch (error) {
                    frappe.msgprint('Failed to update field');
                }
            }
        });
        
        dialog.show();
    }
    
    delete_field(fieldname) {
        frappe.confirm(
            `Are you sure you want to delete the field "${fieldname}"? This action cannot be undone.`,
            async () => {
                try {
                    const result = await frappe.call({
                        method: 'flansa.flansa_core.api.field_management.delete_field',
                        args: {
                            table_name: this.table_id,
                            field_name: fieldname
                        }
                    });
                    
                    if (result.message && result.message.success) {
                        frappe.show_alert({
                            message: 'Field deleted successfully',
                            indicator: 'green'
                        });
                        this.load_fields();
                    } else {
                        frappe.msgprint('Failed to delete field');
                    }
                } catch (error) {
                    frappe.msgprint('Failed to delete field');
                }
            }
        );
    }
    
    refresh_fields() {
        this.load_fields();
        frappe.show_alert({
            message: 'Fields refreshed',
            indicator: 'green'
        });
    }
    
    view_records() {
        if (this.table_data && this.table_data.doctype_name) {
            window.location.href = `/app/flansa-record-viewer/${this.table_id}`;
        }
    }
}