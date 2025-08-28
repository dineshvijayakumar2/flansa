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
        // Hide default page title for cleaner look
        this.page.$title_area.hide();
        
        this.$container.html(`
            <div class="table-selector-container" style="margin: -20px;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                     color: white; padding: 24px; text-align: center;">
                    <i class="fa fa-table" style="font-size: 36px; opacity: 0.9;"></i>
                    <h2 style="margin: 12px 0 4px 0; font-weight: 600;">Table Builder</h2>
                    <p style="margin: 0; opacity: 0.9;">Select a table to manage its fields</p>
                </div>
                
                <!-- Table List -->
                <div style="padding: 24px; background: #fafbfc; min-height: calc(100vh - 180px);">
                    <div style="max-width: 1000px; margin: 0 auto;">
                        <div style="margin-bottom: 20px;">
                            <input type="text" class="form-control" id="table-search" 
                                   placeholder="Search tables..." 
                                   style="max-width: 400px; padding-left: 36px;">
                            <i class="fa fa-search" style="position: absolute; left: 36px; top: 10px; color: #8d99a6;"></i>
                        </div>
                        <div id="table-list">
                            <div class="text-center text-muted">Loading tables...</div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        this.load_table_list();
        
        // Setup search
        this.$container.find('#table-search').on('input', (e) => {
            this.filter_table_list(e.target.value);
        });
    }
    
    filter_table_list(search_term) {
        const term = search_term.toLowerCase();
        const cards = this.$container.find('.table-card');
        
        cards.each(function() {
            const $card = $(this);
            const name = $card.data('name').toLowerCase();
            const label = $card.data('label').toLowerCase();
            
            if (name.includes(term) || label.includes(term)) {
                $card.show();
            } else {
                $card.hide();
            }
        });
    }
    
    async load_table_list() {
        try {
            const result = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    fields: ['name', 'table_name', 'table_label', 'doctype_name', 'creation'],
                    order_by: 'creation desc',
                    limit_page_length: 100
                }
            });
            
            const tables = result.message || [];
            const $list = this.$container.find('#table-list');
            
            if (tables.length === 0) {
                $list.html(`
                    <div class="text-center" style="padding: 60px; background: white; border-radius: 8px;">
                        <i class="fa fa-database" style="font-size: 48px; color: #8d99a6;"></i>
                        <h5 style="margin-top: 15px;">No tables found</h5>
                        <p class="text-muted">Create a table first to start building</p>
                    </div>
                `);
                return;
            }
            
            let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">';
            tables.forEach(table => {
                const hasDoctype = table.doctype_name ? true : false;
                const statusColor = hasDoctype ? '#28a745' : '#fd7e14';
                const statusText = hasDoctype ? 'Active' : 'Not Generated';
                const iconColor = hasDoctype ? '#28a745' : '#8d99a6';
                
                html += `
                    <div class="table-card" data-name="${table.table_name}" data-label="${table.table_label || table.table_name}"
                         style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; 
                                padding: 20px; cursor: pointer; transition: all 0.2s; position: relative;"
                         onclick="window.location.href='/app/flansa-table-builder?table=${table.name}'">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <i class="fa fa-table" style="font-size: 24px; color: ${iconColor};"></i>
                            <span style="background: ${statusColor}20; color: ${statusColor}; 
                                        padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                ${statusText}
                            </span>
                        </div>
                        <h5 style="margin: 0 0 4px 0; color: #2e3338;">
                            ${table.table_label || table.table_name}
                        </h5>
                        <div style="font-size: 12px; color: #8d99a6;">
                            ${table.table_name}
                        </div>
                        ${hasDoctype ? `
                            <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
                                <i class="fa fa-code"></i> ${table.doctype_name}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            html += '</div>';
            
            $list.html(html);
            
            // Add hover effect
            this.$container.find('.table-card').hover(
                function() {
                    $(this).css({
                        'border-color': '#667eea',
                        'box-shadow': '0 4px 12px rgba(102,126,234,0.15)',
                        'transform': 'translateY(-2px)'
                    });
                },
                function() {
                    $(this).css({
                        'border-color': '#e2e8f0',
                        'box-shadow': 'none',
                        'transform': 'translateY(0)'
                    });
                }
            );
            
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
        // Hide default page title for modern look
        this.page.$title_area.hide();
        
        // Create modern layout matching Visual Builder style
        this.$container.html(`
            <div class="table-builder-container" style="margin: -20px;">
                <!-- Modern Header with gradient -->
                <div class="table-builder-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                     color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); border: none; color: white;"
                                onclick="window.location.href='/app/flansa-table-builder'">
                            <i class="fa fa-arrow-left"></i>
                        </button>
                        <i class="fa fa-table" style="font-size: 20px; opacity: 0.9;"></i>
                        <div>
                            <h3 style="margin: 0; font-size: 20px; font-weight: 600;">Table Builder</h3>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
                                ${this.table_data.table_label || this.table_data.table_name}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); border: none; color: white;"
                                onclick="frappe.pages['flansa-table-builder'].builder.refresh_fields()">
                            <i class="fa fa-refresh"></i>
                        </button>
                        ${this.table_data.doctype_name ? 
                            `<button class="btn btn-sm" style="background: white; color: #667eea; border: none;"
                                    onclick="frappe.pages['flansa-table-builder'].builder.view_data()">
                                <i class="fa fa-chart-bar"></i> View Data
                            </button>` : ''}
                    </div>
                </div>
                
                <!-- Toolbar Section -->
                <div class="table-builder-toolbar" style="background: white; padding: 12px 24px; 
                     border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-sm" onclick="frappe.pages['flansa-table-builder'].builder.show_add_field_dialog()">
                            <i class="fa fa-plus"></i> Add Field
                        </button>
                        <button class="btn btn-default btn-sm" onclick="frappe.pages['flansa-table-builder'].builder.show_add_gallery_dialog()">
                            <i class="fa fa-images"></i> Add Gallery
                        </button>
                        <button class="btn btn-default btn-sm" onclick="frappe.pages['flansa-table-builder'].builder.show_naming_settings()">
                            <i class="fa fa-tag"></i> Naming Settings
                        </button>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="position: relative;">
                            <input type="text" class="form-control" id="field-search" 
                                   placeholder="Search fields..." 
                                   style="width: 300px; padding-left: 32px; border-radius: 4px;">
                            <i class="fa fa-search" style="position: absolute; left: 12px; top: 50%; 
                               transform: translateY(-50%); color: #8d99a6;"></i>
                        </div>
                        <select class="form-control" id="field-type-filter" style="width: 150px;">
                            <option value="">All Types</option>
                            <option value="Data">Data</option>
                            <option value="Text">Text</option>
                            <option value="Int">Number</option>
                            <option value="Currency">Currency</option>
                            <option value="Date">Date</option>
                            <option value="Select">Select</option>
                            <option value="Check">Checkbox</option>
                            <option value="Link">Link</option>
                        </select>
                    </div>
                </div>
                
                <!-- Stats Bar -->
                <div class="table-stats-bar" style="background: #f8f9fa; padding: 8px 24px; 
                     display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                    <div>
                        <span style="color: #6c757d;">Table: </span>
                        <span style="font-weight: 600;">${this.table_data.table_name}</span>
                        ${this.table_data.doctype_name ? 
                            `<span style="margin-left: 16px; color: #6c757d;">DocType: </span>
                             <span style="font-weight: 600;">${this.table_data.doctype_name}</span>` : 
                            `<span style="margin-left: 16px; color: #fd7e14;">⚠️ Not Generated</span>`}
                    </div>
                    <div id="field-count" style="color: #6c757d;">
                        <i class="fa fa-database"></i> 0 fields
                    </div>
                </div>
                
                <!-- Fields Container -->
                <div class="fields-main-container" style="padding: 20px 24px; background: #fafbfc; min-height: calc(100vh - 200px);">
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
        
        // Setup type filter
        this.$container.find('#field-type-filter').on('change', (e) => {
            this.filter_by_type(e.target.value);
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
        
        // Update count with better formatting
        this.$container.find('#field-count').html(`<i class="fa fa-database"></i> ${this.fields.length} fields`);
        
        if (this.fields.length === 0) {
            $container.html(`
                <div class="text-center" style="padding: 60px 20px; background: white; border-radius: 8px; border: 2px dashed #d1d8dd;">
                    <i class="fa fa-database" style="font-size: 48px; color: #8d99a6;"></i>
                    <h5 style="margin-top: 15px; color: #2e3338;">No fields yet</h5>
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
                <div class="field-category" style="margin-bottom: 24px;">
                    <h6 style="color: #6c757d; margin-bottom: 12px; font-weight: 600;">
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
                <div class="field-category" style="margin-bottom: 24px;">
                    <h6 style="color: #6c757d; margin-bottom: 12px; font-weight: 600;">
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
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 12px;
                }
                
                .field-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 14px;
                    transition: all 0.2s;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                
                .field-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 4px 12px rgba(102,126,234,0.15);
                    transform: translateY(-2px);
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
                
                .table-builder-container * {
                    box-sizing: border-box;
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
            <div class="field-card ${is_system ? 'system-field' : ''}" data-fieldname="${field.fieldname}" data-fieldtype="${field.fieldtype}">
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
    
    filter_by_type(type) {
        const cards = this.$container.find('.field-card');
        
        cards.each(function() {
            const $card = $(this);
            const fieldType = $card.data('fieldtype');
            
            if (!type || fieldType === type) {
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
                    description: 'For Select: Option1\nOption2\nOption3. For Link: DocType name',
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
    
    view_data() {
        // Open the default report for this table
        if (this.table_data) {
            window.location.href = `/app/flansa-report-viewer/${this.table_id}`;
        }
    }
    
    show_add_gallery_dialog() {
        frappe.msgprint('Gallery field feature coming soon!');
    }
    
    show_naming_settings() {
        frappe.msgprint('Naming settings feature coming soon!');
    }
}