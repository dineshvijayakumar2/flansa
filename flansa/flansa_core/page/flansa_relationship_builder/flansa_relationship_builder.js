
// Handle duplicate relationship name errors
function handleDuplicateNameError(response) {
    if (response && response.duplicate_name && response.existing_rel_details) {
        const existing = response.existing_rel_details;
        const suggestions = response.suggested_names || [];
        
        let message = `A relationship named "${existing.relationship_name}" already exists`;
        if (existing.from_table_name && existing.to_table_name) {
            message += ` between ${existing.from_table_name} and ${existing.to_table_name}`;
        }
        message += '.\n\n';
        
        if (suggestions.length > 0) {
            message += 'Suggested alternative names:\n';
            suggestions.forEach((name, index) => {
                message += `${index + 1}. ${name}\n`;
            });
            message += '\nWould you like to use one of these suggestions?';
            
            // Show dialog with suggestions
            const suggestionDialog = new frappe.ui.Dialog({
                title: 'Duplicate Relationship Name',
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'info',
                        options: `<div class="alert alert-warning">
                            <strong>Duplicate Name Detected!</strong><br>
                            ${message.replace(/\n/g, '<br>')}
                        </div>`
                    },
                    {
                        fieldtype: 'Select',
                        fieldname: 'suggested_name',
                        label: 'Select Alternative Name',
                        options: suggestions.join('\n'),
                        reqd: 1,
                        default: suggestions[0]
                    },
                    {
                        fieldtype: 'Data',
                        fieldname: 'custom_name',
                        label: 'Or Enter Custom Name',
                        description: 'Leave blank to use selected suggestion above'
                    }
                ],
                primary_action_label: 'Use This Name',
                primary_action: function(values) {
                    const newName = values.custom_name || values.suggested_name;
                    if (newName) {
                        // Update the relationship name field in the current dialog
                        if (window.current_relationship_dialog) {
                            window.current_relationship_dialog.set_value('relationship_name', newName);
                        }
                        suggestionDialog.hide();
                        frappe.show_alert({
                            message: `Relationship name updated to: ${newName}`,
                            indicator: 'green'
                        });
                    }
                }
            });
            
            suggestionDialog.show();
            
        } else {
            frappe.msgprint({
                title: 'Duplicate Relationship Name',
                message: message + '\nPlease choose a different name.',
                indicator: 'red'
            });
        }
        
        return true; // Indicates we handled the error
    }
    return false; // Not a duplicate name error
}

frappe.pages['flansa-relationship-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Relationship Builder',
        single_column: true
    });
    
    // Initialize Simplified Relationship Builder
    window.relationship_builder = new SimplifiedRelationshipBuilder(page);
};

// Simplified Relationship Builder - Clean, intuitive interface
/**
 * DEVELOPMENT STATUS (2025-08-07):
 * ✅ UI Consistency: Complete - matches other pages with unified theming
 * ✅ Relationship Display: Fixed - shows tiles by default, proper rendering
 * ✅ View Button: Fixed - shows field details dialog with real-time info
 * ✅ Add Field Dialogs: Enhanced UX with autocomplete, validation, context-aware descriptions
 * 
 * ✅ FIXED: Field sync problem between DocType and Flansa Field table
 * - Fixed API response format handling in add_lookup_fields() and add_computed_fields()
 * - Added comprehensive field sync diagnostic tools in Field Sync Tools menu
 * - Created auto-fix mechanisms for field synchronization issues
 * - Users now see actual table fields instead of generic field lists
 * 
 * FIXES APPLIED:
 * 1. ✅ Fixed field management API response parsing (was expecting array, got object)  
 * 2. ✅ Added field sync diagnostic API with auto-fix capabilities
 * 3. ✅ Added Field Sync Tools menu to all Flansa pages  
 * 4. ✅ Enhanced field sync mechanisms with proper error handling
 * 
 * WORKING METHODS: All methods now working - field dialogs show real table fields
 * DIAGNOSTIC TOOLS: FieldSyncTools.diagnoseTable(), FieldSyncTools.diagnoseAllTables()
 */
class SimplifiedRelationshipBuilder {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        this.tables = [];
        this.view_mode = 'tiles'; // Default view mode
        
        // Get application from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        this.app_id = urlParams.get('app') || null;
        this.from_table = urlParams.get('from_table') || null;
        
        this.setup_page();
        this.load_tables();
        this.load_data();
    }
    
    setup_page() {
        // Add standardized Back button with safety check
        setTimeout(() => {
            if (window.FlansaNav && typeof window.FlansaNav.addBackButton === 'function') {
                window.FlansaNav.addBackButton(this.page);
            } else {
                // Fallback: Add back button directly
                this.page.add_button('← Back', () => {
                    window.history.back();
                }, 'btn-default');
            }
        }, 100);
        
        // Clean setup - no buttons above banner for consistent design
        
        // Hide default page header to make banner freeze at top
        this.hide_default_page_header();
        
        // Field sync tools removed - no longer needed with native field management
        
        // Only theme settings in menu (ellipsis)
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.addThemeMenuToPage(this.page, () => {
                this.load_data();
            });
        }
    }
    
    hide_default_page_header() {
        // Hide the default Frappe page header to make our banner freeze at top
        $(this.wrapper).find('.page-head').hide();
        $('body .page-head').hide();
        
        // Also add CSS to ensure it stays hidden
        if (!$('#relationship-builder-page-head-css').length) {
            $('<style id="relationship-builder-page-head-css">')
                .text('.page-head { display: none !important; }')
                .appendTo('head');
        }
    }
    
    
    
    // Real-time relationship name validation
    validate_relationship_name(dialog, relationship_name) {
        if (!relationship_name) {
            this.update_validation_status(dialog, '', 'info');
            return;
        }
        
        // Call backend validation
        frappe.call({
            method: 'flansa.flansa_core.api.relationship_management.validate_unique_relationship_name',
            args: {
                relationship_name: relationship_name
            },
            callback: (r) => {
                if (r.message) {
                    if (r.message.valid) {
                        this.update_validation_status(dialog, '✅ Relationship name is available', 'success');
                    } else {
                        let error_msg = `❌ ${r.message.error}`;
                        if (r.message.suggested_names && r.message.suggested_names.length > 0) {
                            error_msg += `<br><strong>Suggestions:</strong> ${r.message.suggested_names.join(', ')}`;
                        }
                        this.update_validation_status(dialog, error_msg, 'error');
                    }
                }
            }
        });
    }
    
    // Update validation status display
    update_validation_status(dialog, message, type) {
        const validation_field = dialog.fields_dict.validation_status;
        if (validation_field) {
            let color = type === 'success' ? 'green' : type === 'error' ? 'red' : 'blue';
            let html = message ? `<div style="color: ${color}; font-size: 12px; margin-top: 5px;">${message}</div>` : '';
            validation_field.$wrapper.html(html);
        }
    }
    
    // Generate and set link field name
    generate_and_set_link_field_name(dialog) {
        const parent_table = dialog.get_value('parent_table');
        const child_table = dialog.get_value('child_table');
        const relationship_name = dialog.get_value('relationship_name');
        
        // Always try to generate a field name if we have parent_table
        if (parent_table) {
            // Use relationship_name if available, otherwise use a generic name
            const rel_name = relationship_name || 'relationship';
            // Call backend to generate field name
            frappe.call({
                method: 'flansa.flansa_core.api.relationship_management.generate_relationship_field_name',
                args: {
                    relationship_name: relationship_name,
                    parent_table: parent_table,
                    child_table: child_table
                },
                callback: (r) => {
                    if (r.message && r.message.field_name) {
                        dialog.set_value('link_field_name', r.message.field_name);
                    }
                }
            });
        }
    }
    
show_create_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Create Relationship',
            size: 'large',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: 'Tables'
                },
                {
                    label: 'Parent Table',
                    fieldname: 'parent_table',
                    fieldtype: 'Link',
                    options: 'Flansa Table',
                    reqd: 1,
                    description: 'Table that will have a link to view child records',
                    get_query: () => {
                        const filters = [];
                        // Filter by application if we have app context
                        if (this.app_id) {
                            filters.push(['application', '=', this.app_id]);
                        }
                        return { filters: filters };
                    },
                    change: () => {
                        this.update_relationship_preview(dialog);
                        this.auto_generate_name(dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Child Table',
                    fieldname: 'child_table',
                    fieldtype: 'Link',
                    options: 'Flansa Table',
                    reqd: 1,
                    description: 'Table that will have a reference field to parent',
                    get_query: () => {
                        const filters = [];
                        // Filter by application if we have app context
                        if (this.app_id) {
                            filters.push(['application', '=', this.app_id]);
                        }
                        return { filters: filters };
                    },
                    change: () => {
                        this.update_relationship_preview(dialog);
                        this.auto_generate_name(dialog);
                        this.handle_relationship_type_change(dialog);
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Relationship Type'
                },
                {
                    label: 'Type',
                    fieldname: 'relationship_type',
                    fieldtype: 'Select',
                    options: ['One to Many', 'Many to Many', 'Self Referential'],
                    default: 'One to Many',
                    reqd: 1,
                    change: () => {
                        this.update_relationship_preview(dialog);
                        this.handle_relationship_type_change(dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Relationship Name',
                    fieldname: 'relationship_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Descriptive name for this relationship (auto-generated)',
                    change: () => {
                        const relationship_name = dialog.get_value('relationship_name');
                        this.validate_relationship_name(dialog, relationship_name);
                        this.generate_and_set_link_field_name(dialog);
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Description'
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Small Text',
                    description: 'Optional short notes about this relationship and how it should be used'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Options'
                },
                {
                    label: 'Cascade Delete',
                    fieldname: 'cascade_delete',
                    fieldtype: 'Check',
                    description: 'Delete child records when parent is deleted'
                },
                {
                    label: 'Required Reference',
                    fieldname: 'required_reference',
                    fieldtype: 'Check',
                    depends_on: 'eval:doc.relationship_type == "One to Many"',
                    description: 'Make the child reference field required'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Auto-Create Parent Link',
                    fieldname: 'create_parent_link',
                    fieldtype: 'Check',
                    default: 1,
                    depends_on: 'eval:doc.relationship_type == "One to Many"',
                    description: 'Create hyperlink field in parent to show child records'
                },
                {
                    label: 'Create Reverse Relationship',
                    fieldname: 'create_reverse',
                    fieldtype: 'Check',
                    default: 0,
                    depends_on: 'eval:doc.relationship_type == "One to Many"',
                    description: 'Also create the reverse relationship (e.g., if creating Order→Customer, also create Customer→Orders)'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Field Configuration'
                },
                {
                    fieldname: 'link_field_name',
                    fieldtype: 'Data',
                    label: 'Link Field Name',
                    description: 'The name of the link field that will be created (auto-generated, but can be customized)',
                    read_only: 0
                },
                {
                    fieldname: 'validation_status',
                    fieldtype: 'HTML',
                    label: 'Validation Status'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Preview'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'relationship_preview',
                    label: 'Relationship Preview'
                }
            ],
            primary_action_label: 'Create Relationship',
            primary_action: (values) => {
                this.create_relationship(values, dialog);
            }
        });
        
        // Store dialog reference for duplicate name handling
        window.current_relationship_dialog = dialog;
        dialog.show();
        
        // Initialize validation status
        this.update_validation_status(dialog, '', 'info');
        
        // Initialize link field name when dialog opens
        setTimeout(() => {
            this.generate_and_set_link_field_name(dialog);
        }, 100); // Small delay to ensure dialog is fully rendered
        

        

    }
    
    auto_generate_name(dialog) {
        const parent_table = dialog.get_value('parent_table');
        const child_table = dialog.get_value('child_table');
        
        if (parent_table && child_table && !dialog.get_value('relationship_name')) {
            frappe.db.get_value('Flansa Table', parent_table, 'table_label', (r1) => {
                frappe.db.get_value('Flansa Table', child_table, 'table_label', (r2) => {
                    const parent_label = r1.table_label || parent_table;
                    const child_label = r2.table_label || child_table;
                    const suggested_name = `${parent_label} → ${child_label}`;
                    dialog.set_value('relationship_name', suggested_name);
                });
            });
        }
    }
    
    update_relationship_preview(dialog) {
        const parent_table = dialog.get_value('parent_table');
        const child_table = dialog.get_value('child_table');
        const relationship_type = dialog.get_value('relationship_type');
        
        if (!parent_table || !child_table) {
            dialog.set_value('relationship_preview', '<div class="text-muted">Select both tables to see preview</div>');
            return;
        }
        
        // Get table labels for display
        frappe.db.get_value('Flansa Table', parent_table, 'table_label', (r1) => {
            frappe.db.get_value('Flansa Table', child_table, 'table_label', (r2) => {
                const parent_label = (r1 && r1.table_label) ? r1.table_label : parent_table;
                const child_label = (r2 && r2.table_label) ? r2.table_label : child_table;
                
                let preview_html;
                
                if (relationship_type === 'Self Referential') {
                    preview_html = `
                        <div class="relationship-preview" style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
                            <h6><i class="fa fa-refresh"></i> Self Referential Relationship Preview</h6>
                            <div style="display: flex; align-items: center; justify-content: center; margin: 15px 0;">
                                <div class="table-box" style="padding: 20px; background: white; border-radius: 10px; border: 3px solid #9c27b0; text-align: center; position: relative;">
                                    <strong>${parent_label}</strong>
                                    <div style="color: #666; font-size: 12px;">Self-Referencing Table</div>
                                    <div style="position: absolute; top: -10px; right: -10px; background: #9c27b0; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                                        ↻
                                    </div>
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <span class="badge badge-purple" style="background: #9c27b0;">${relationship_type}</span>
                            </div>`;
                } else {
                    preview_html = `
                        <div class="relationship-preview" style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
                            <h6><i class="fa fa-link"></i> Relationship Preview</h6>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin: 15px 0;">
                                <div class="table-box" style="padding: 12px; background: white; border-radius: 5px; border: 2px solid #007bff; flex: 1; text-align: center;">
                                    <strong>${parent_label}</strong>
                                    <div style="color: #666; font-size: 12px;">Parent Table</div>
                                </div>
                                <div style="padding: 0 20px; font-size: 24px; color: #28a745;">
                                    ${relationship_type === 'Many to Many' ? '⇄' : '→'}
                                </div>
                                <div class="table-box" style="padding: 12px; background: white; border-radius: 5px; border: 2px solid #28a745; flex: 1; text-align: center;">
                                    <strong>${child_label}</strong>
                                    <div style="color: #666; font-size: 12px;">Child Table</div>
                                </div>
                            </div>
                            <div style="text-align: center;">
                                <span class="badge badge-primary">${relationship_type}</span>
                            </div>`;
                }
        
                if (relationship_type === 'Self Referential') {
                    preview_html += `
                        <div style="margin-top: 15px; padding: 10px; background: #f3e5f5; border-radius: 5px;">
                            <strong>What this creates:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                <li>Parent reference field in <strong>${parent_label}</strong> pointing to itself</li>
                                <li>Virtual children table field to view subordinate records</li>
                                <li>Enables hierarchical structures like Employee → Manager, Category → Parent Category</li>
                            </ul>
                        </div>
                    `;
                } else if (relationship_type === 'One to Many') {
                    preview_html += `
                        <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 5px;">
                            <strong>What this creates:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                <li>Reference field in <strong>${child_label}</strong> pointing to <strong>${parent_label}</strong></li>
                                <li>Hyperlink field in <strong>${parent_label}</strong> to view related <strong>${child_label}</strong> records</li>
                            </ul>
                        </div>
                    `;
                } else {
                    preview_html += `
                        <div style="margin-top: 15px; padding: 10px; background: #fff3e0; border-radius: 5px;">
                            <strong>What this creates:</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                <li>Junction table to link <strong>${parent_label}</strong> and <strong>${child_label}</strong></li>
                                <li>Table fields in both tables to manage the many-to-many relationship</li>
                            </ul>
                        </div>
                    `;
                }
                
                preview_html += '</div>';
                dialog.set_value('relationship_preview', preview_html);
            });
        });
    }
    
    handle_relationship_type_change(dialog) {
        const relationship_type = dialog.get_value('relationship_type');
        const parent_table = dialog.get_value('parent_table');
        const child_table = dialog.get_value('child_table');
        
        // If Self Referential is selected, automatically set child table to parent table
        if (relationship_type === 'Self Referential' && parent_table && parent_table !== child_table) {
            dialog.set_value('child_table', parent_table);
        }
        
        // If same table is selected for both, suggest Self Referential
        if (parent_table && child_table && parent_table === child_table && relationship_type !== 'Self Referential') {
            frappe.msgprint({
                title: 'Self Referential Relationship',
                message: 'You\'ve selected the same table for both parent and child. Consider using "Self Referential" relationship type for hierarchical structures like Employee → Manager.',
                indicator: 'blue'
            });
        }
    }
    
    create_relationship(values, dialog) {
        frappe.call({
            method: 'flansa.flansa_core.api.enterprise_relationship_api.create_enterprise_relationship',
            args: {
                relationship_config: values
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: `✅ ${r.message.message}`,
                        indicator: 'green'
                    });
                    dialog.hide();
                    this.load_data();
                } else {
                    // Show error directly since validation is now handled inline
                    frappe.show_alert({
                        message: `❌ ${r.message?.error || 'Failed to create relationship'}`,
                        indicator: 'red'
                    });
                }
            }
        });
    }
    
    load_tables() {
        frappe.call({
            method: 'flansa.flansa_core.api.table_api.get_tables_list',
            args: {
                app_name: this.app_id  // Filter tables by current app
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.tables = r.message.tables;
                }
            }
        });
    }
    
    load_data() {
        if (this.app_id) {
            // Load relationships for specific app
            frappe.call({
                method: 'flansa.flansa_core.api.enterprise_relationship_api.get_relationships_with_fields',
                args: {
                    app_name: this.app_id
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        this.render_relationships_list(r.message.relationships);
                    } else {
                        // Fallback to basic list if enhanced API fails
                        this.load_app_relationships_fallback();
                    }
                }
            });
        } else {
            // Load all relationships if no app context
            frappe.call({
                method: 'flansa.flansa_core.api.enterprise_relationship_api.get_relationships_with_fields',
                callback: (r) => {
                    if (r.message && r.message.success) {
                        this.render_relationships_list(r.message.relationships);
                    } else {
                        // Fallback to basic list if enhanced API fails
                        frappe.call({
                            method: 'frappe.client.get_list',
                            args: {
                                doctype: 'Flansa Relationship',
                                fields: ['name', 'relationship_name', 'relationship_type', 'parent_table', 'child_table'],
                                limit_page_length: 20,
                                order_by: 'creation desc'
                            },
                            callback: (r) => {
                                if (r.message) {
                                    this.render_relationships_list(r.message);
                                }
                            }
                        });
                    }
                }
            });
        }
    }
    
    load_app_relationships_fallback() {
        // Get tables for this app first, then filter relationships
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Flansa Table',
                fields: ['name'],
                filters: [['application', '=', this.app_id]],
                limit_page_length: 0
            },
            callback: (r) => {
                if (r.message && r.message.length > 0) {
                    const table_names = r.message.map(t => t.name);
                    // Get relationships where parent_table or child_table is in our app's tables
                    frappe.call({
                        method: 'frappe.client.get_list',
                        args: {
                            doctype: 'Flansa Relationship',
                            fields: ['name', 'relationship_name', 'relationship_type', 'parent_table', 'child_table'],
                            filters: [
                                ['OR', [
                                    ['parent_table', 'in', table_names],
                                    ['child_table', 'in', table_names]
                                ]]
                            ],
                            limit_page_length: 20,
                            order_by: 'creation desc'
                        },
                        callback: (r) => {
                            if (r.message) {
                                this.render_relationships_list(r.message);
                            }
                        }
                    });
                } else {
                    // No tables in this app, show empty state
                    this.render_relationships_list([]);
                }
            }
        });
    }
    
    render_relationships_list(relationships) {
        const html = `
            <div class="relationships-container">
                <!-- Compact Modern Header - Now at absolute top -->
                <div class="flansa-compact-header" style="background: var(--flansa-gradient-primary); color: var(--flansa-white); padding: 16px 20px; margin: 0 -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                    <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa fa-cube" style="font-size: 18px; opacity: 0.9;"></i>
                        <span style="font-size: 16px; font-weight: 600;" id="app-name-display">Loading...</span>
                    </div>
                    <div class="header-right" style="display: flex; align-items: center; gap: 12px;">
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2;">🔗 Relationships</h3>
                        <div class="context-menu-wrapper" style="position: relative;">
                            <button id="context-menu-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: background-color 0.2s;" title="More options">
                                ⋯
                            </button>
                            <div id="context-menu" style="display: none; position: absolute; top: 40px; right: 0; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 1000; border: 1px solid rgba(0,0,0,0.1);">
                                <div class="context-menu-item" data-action="theme" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-paint-brush" style="width: 16px;"></i>
                                    <span>Theme Settings</span>
                                </div>
                                <div class="context-menu-item" data-action="refresh-cache" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-refresh" style="width: 16px;"></i>
                                    <span>Clear Cache</span>
                                </div>
                                <div class="context-menu-item" data-action="export-data" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-download" style="width: 16px;"></i>
                                    <span>Export Relationships</span>
                                </div>
                                <div class="context-menu-item" data-action="keyboard-shortcuts" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;">
                                    <i class="fa fa-keyboard-o" style="width: 16px;"></i>
                                    <span>Keyboard Shortcuts</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Modern Breadcrumb Navigation -->
                <div class="flansa-breadcrumb-bar" style="background: rgba(255,255,255,0.95); padding: 8px 20px; margin: 0 -20px 0 -20px; font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; gap: 8px; font-size: 14px;" id="breadcrumb-container">
                    <a href="/app/flansa-workspace" style="color: #2d3748; text-decoration: none; font-weight: 600; font-weight: 500;">🏠 Workspace</a>
                    <i class="fa fa-chevron-right" style="opacity: 0.5; margin: 0 8px;"></i>
                    <span style="color: #333; font-weight: 500;" id="app-breadcrumb">📱 Loading...</span>
                    <i class="fa fa-chevron-right" style="opacity: 0.5; margin: 0 8px;"></i>
                    <span style="color: #333; font-weight: 500;">🔗 Relationships</span>
                </div>
                
                <!-- Page Header for Quick Navigation -->
                <div id="page-header" style="padding: 20px 20px 10px 20px; margin: 0 -20px 0 -20px; background: white; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #333;">Table Relationships</h2>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Manage connections between your tables</p>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button class="btn btn-sm btn-primary" id="quick-nav-table-builder" title="Edit Tables">
                                <i class="fa fa-table"></i> Tables
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-reports" title="View Reports">
                                <i class="fa fa-chart-bar"></i> Reports
                            </button>
                            <button class="btn btn-sm btn-default" id="quick-nav-app-dashboard" title="App Dashboard">
                                <i class="fa fa-tachometer"></i> Apps
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Content Area -->
                <div class="flansa-workspace-content" style="padding: var(--flansa-spacing-xl) var(--flansa-spacing-xl) 0;">
                    <!-- Stats Section -->
                    <div class="section-header" style="border-bottom: 1px solid var(--flansa-border, var(--flansa-gray-200)); padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; font-weight: normal;">Relationships</h4>
                        <small id="relationship-count-display" style="color: var(--flansa-text-secondary, var(--flansa-gray-600));">${relationships.length} relationship${relationships.length !== 1 ? 's' : ''}</small>
                    </div>
                    
                    <!-- Search and Filters Toolbar -->
                    <div class="relationships-toolbar" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--flansa-spacing-lg); margin-bottom: var(--flansa-spacing-xl); padding: var(--flansa-spacing-md); background: var(--flansa-surface, var(--flansa-white)); border-radius: var(--flansa-radius-lg); box-shadow: var(--flansa-shadow-sm); border: var(--flansa-border-width-sm) solid var(--flansa-border, transparent);">
                        <div class="toolbar-left" style="display: flex; gap: var(--flansa-spacing-sm);">
                            <button class="btn btn-flansa-primary" onclick="window.relationship_builder.show_create_dialog()">
                                <i class="fa fa-plus"></i> Add Relationship
                            </button>
                        </div>
                        <div class="toolbar-center" style="display: flex; justify-content: center; max-width: 400px; width: 100%;">
                            <div class="search-wrapper" style="position: relative; width: 100%;">
                                <input type="text" class="form-control search-input" 
                                    id="relationship-search" placeholder="Search relationships..." style="padding-left: 40px; border-radius: var(--flansa-radius-md); border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300));" />
                                <i class="fa fa-search search-icon" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--flansa-text-secondary, var(--flansa-gray-500));"></i>
                            </div>
                        </div>
                        <div class="toolbar-right" style="display: flex; gap: var(--flansa-spacing-md); align-items: center;">
                            <select class="form-control" id="relationship-type-filter" style="min-width: 140px; border-radius: var(--flansa-radius-md); border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300));">
                                <option value="">All Types</option>
                                <option value="One to Many">One to Many</option>
                                <option value="Many to Many">Many to Many</option>
                            </select>
                            <div class="view-toggle" style="display: flex; border: var(--flansa-border-width-sm) solid var(--flansa-border, var(--flansa-gray-300)); border-radius: var(--flansa-radius-md); overflow: hidden;">
                                <button class="btn btn-default btn-sm view-btn ${this.view_mode === 'tiles' ? 'active' : ''}" onclick="window.relationship_builder.switch_view('tiles')" style="border: none; border-radius: 0; padding: 6px 12px;" title="Tile View">
                                    <i class="fa fa-th"></i>
                                </button>
                                <button class="btn btn-default btn-sm view-btn ${this.view_mode === 'table' ? 'active' : ''}" onclick="window.relationship_builder.switch_view('table')" style="border: none; border-radius: 0; padding: 6px 12px;" title="Table View">
                                    <i class="fa fa-list"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="relationships-list">
                
                ${relationships.length === 0 ? `
                    <div class="empty-state text-center" style="padding: 40px 20px;">
                        <h4>No relationships yet</h4>
                        <p class="text-muted">Create relationships to connect your tables</p>
                    </div>
                ` : `
                    <!-- Relationships will be rendered by render_filtered_relationships based on view_mode -->
                `}
                    </div>
                </div>
            </div>
        `;
        
        this.$container.html(html);
        
        // Store relationships for filtering
        this.all_relationships = relationships;
        this.filtered_relationships = [...relationships];
        
        // Bind search and filter events
        this.bind_search_and_filters();
        
        // Initialize count display
        this.update_relationship_count_display();
        
        // Render the relationships if there are any
        if (relationships.length > 0) {
            this.render_filtered_relationships();
        }
        
        // Load table labels for better readability
        this.load_table_labels(relationships);
        
        // Set up context menu and quick navigation
        this.setup_context_menu_and_navigation();
        
        // Populate app name in banner and breadcrumbs
        this.populate_app_info();
    }
    
    setup_context_menu_and_navigation() {
        // Context menu functionality
        $(document).on('click', '#context-menu-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menu = $('#context-menu');
            menu.toggle();
        });
        
        // Close context menu when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('#context-menu-btn, #context-menu').length) {
                $('#context-menu').hide();
            }
        });
        
        // Context menu item actions
        $(document).on('click', '.context-menu-item', (e) => {
            e.preventDefault();
            const action = $(e.currentTarget).data('action');
            this.handle_context_menu_action(action);
            $('#context-menu').hide();
        });
        
        // Quick navigation buttons
        $(document).on('click', '#quick-nav-table-builder', (e) => {
            e.preventDefault();
            if (this.app_id) {
                window.location.href = `/app/flansa-visual-builder?app=${this.app_id}`;
            } else {
                window.location.href = '/app/flansa-visual-builder';
            }
        });
        
        $(document).on('click', '#quick-nav-reports', (e) => {
            e.preventDefault();
            if (this.app_id) {
                window.location.href = `/app/flansa-saved-reports?app=${this.app_id}`;
            } else {
                window.location.href = '/app/flansa-saved-reports';
            }
        });
        
        $(document).on('click', '#quick-nav-app-dashboard', (e) => {
            e.preventDefault();
            if (this.app_id) {
                window.location.href = `/app/flansa-app-dashboard?app=${this.app_id}`;
            } else {
                frappe.show_alert('App information not available', 'orange');
            }
        });
        
    }
    
    handle_context_menu_action(action) {
        switch (action) {
            case 'theme':
                if (window.FlansaThemeManager) {
                    window.FlansaThemeManager.showThemeSettings(() => { if (this.apply_theme) this.apply_theme(); });
                } else {
                    frappe.show_alert('Theme manager not available', 'orange');
                }
                break;
                
            case 'refresh-cache':
                if (window.flansaBrowserCacheManager) {
                    window.flansaBrowserCacheManager.refreshAllAssets();
                    frappe.show_alert('Cache cleared successfully!', 'green');
                } else {
                    window.location.reload(true);
                }
                break;
                
            case 'export-data':
                this.export_relationships();
                break;
                
            case 'keyboard-shortcuts':
                this.show_keyboard_shortcuts();
                break;
                
            default:
                frappe.show_alert('Unknown action: ' + action, 'orange');
        }
    }
    
    async populate_app_info() {
        if (this.app_id) {
            try {
                const app_response = await frappe.call({
                    method: 'frappe.client.get_value',
                    args: {
                        doctype: 'Flansa Application',
                        filters: { name: this.app_id },
                        fieldname: ['app_title']
                    }
                });
                
                if (app_response.message && app_response.message.app_title) {
                    $('#app-name-display').text(app_response.message.app_title);
                    $('#app-breadcrumb').text(`📱 ${app_response.message.app_title}`);
                } else {
                    $('#app-name-display').text('Flansa Platform');
                    $('#app-breadcrumb').text('📱 Application');
                }
            } catch (error) {
                console.error('Error loading app info:', error);
                $('#app-name-display').text('Flansa Platform');
                $('#app-breadcrumb').text('📱 Application');
            }
        } else {
            $('#app-name-display').text('Flansa Platform');
            $('#app-breadcrumb').text('📱 All Applications');
        }
    }
    
    export_relationships() {
        if (!this.all_relationships || this.all_relationships.length === 0) {
            frappe.show_alert('No relationships to export', 'orange');
            return;
        }
        
        try {
            const export_data = {
                relationships: this.all_relationships.map(rel => ({
                    name: rel.name,
                    relationship_name: rel.relationship_name,
                    relationship_type: rel.relationship_type,
                    parent_table: rel.parent_table,
                    child_table: rel.child_table
                })),
                exported_at: new Date().toISOString(),
                app_id: this.app_id,
                version: '1.0'
            };
            
            // Download as JSON
            const blob = new Blob([JSON.stringify(export_data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `relationships_export_${new Date().toISOString().split('T')[0]}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            frappe.show_alert('Relationships exported successfully!', 'green');
        } catch (error) {
            console.error('Export error:', error);
            frappe.show_alert('Export failed: ' + error.message, 'red');
        }
    }
    
    show_keyboard_shortcuts() {
        const shortcuts = [
            { key: 'Ctrl/Cmd + N', action: 'Create new relationship' },
            { key: 'Ctrl/Cmd + F', action: 'Search relationships' },
            { key: 'Ctrl/Cmd + R', action: 'Refresh data' },
            { key: 'T', action: 'Switch to table view' },
            { key: 'G', action: 'Switch to tile view' },
            { key: 'Esc', action: 'Close dialogs' }
        ];
        
        let content = '<div style="font-family: monospace; line-height: 1.6;">';
        content += '<h4 style="margin-bottom: 15px;">⌨️ Keyboard Shortcuts</h4>';
        shortcuts.forEach(shortcut => {
            content += `<div style="margin-bottom: 8px;"><strong>${shortcut.key}</strong> - ${shortcut.action}</div>`;
        });
        content += '</div>';
        
        frappe.msgprint({
            title: 'Keyboard Shortcuts',
            message: content,
            indicator: 'blue'
        });
    }
    
    load_table_labels(relationships) {
        // Load table labels asynchronously for better readability
        relationships.forEach(rel => {
            const parent_table = rel.parent_table || rel.from_table;
            const child_table = rel.child_table || rel.to_table;
            
            if (parent_table) {
                frappe.db.get_value('Flansa Table', parent_table, 'table_label', (r) => {
                    const label = r && r.table_label ? r.table_label : parent_table;
                    $(`#parent-${rel.name}`).text(label);
                    $(`#parent-table-${rel.name}`).text(label); // For table view
                });
            }
            
            if (child_table) {
                frappe.db.get_value('Flansa Table', child_table, 'table_label', (r) => {
                    const label = r && r.table_label ? r.table_label : child_table;
                    $(`#child-${rel.name}`).text(label);
                    $(`#child-table-${rel.name}`).text(label); // For table view
                });
            }
        });
    }
    
    add_lookup_fields(relationship_name) {
        // Debug logging
        console.log('add_lookup_fields called with:', relationship_name);
        console.log('All relationships:', this.all_relationships);
        
        // Get relationship details from our cached data
        const relationship = this.all_relationships ? this.all_relationships.find(r => r.name === relationship_name) : null;
        if (!relationship) {
            frappe.show_alert(`Relationship ${relationship_name} not found. Please refresh the page.`, 'red');
            console.error('Relationship not found in cache:', relationship_name);
            return;
        }
        
        // Get parent table name
        const parent_table_name = relationship.parent_table || relationship.from_table;
        
        // Fetch fields from the native field management API
        frappe.call({
            method: 'flansa.native_fields.get_table_fields_native',
            args: {
                table_name: parent_table_name
            },
            callback: (r) => {
                let field_options = [];
                let field_descriptions = {};
                
                // Native API returns {success: true, fields: [...]} format
                if (r.message && r.message.success && r.message.fields && r.message.fields.length > 0) {
                    // Filter fields suitable for lookup (more inclusive approach)  
                    const suitable_fields = r.message.fields.filter(f => {
                        // Basic field validation
                        if (!f.fieldname) return false;
                        
                        // Exclude system/internal fields
                        if (f.fieldname.startsWith('naming_series') || 
                            f.fieldname.endsWith('_count') ||
                            ['idx', 'owner', 'creation', 'modified', 'modified_by', 'docstatus'].includes(f.fieldname)) {
                            return false;
                        }
                        
                        // Exclude purely layout fields
                        if (['HTML', 'Section Break', 'Column Break', 'Tab Break', 'Button', 'Heading'].includes(f.fieldtype)) {
                            return false;
                        }
                        
                        // Include most data fields (more inclusive than before)
                        const allowedTypes = [
                            'Data', 'Text', 'Small Text', 'Long Text', 'Select', 'Link', 
                            'Date', 'Datetime', 'Time', 'Email', 'Phone', 'URL',
                            'Int', 'Float', 'Currency', 'Percent', 'Check', 'Rating',
                            'Code', 'Text Editor', 'Markdown Editor', 'Color', 'Barcode'
                        ];
                        
                        return allowedTypes.includes(f.fieldtype);
                    });
                    
                    suitable_fields.forEach(f => {
                        field_options.push(f.fieldname);
                        const label = f.label || f.fieldname;
                        field_descriptions[f.fieldname] = `${label} (${f.fieldtype})`;
                    });
                    
                    // Enhanced debugging information
                    const excluded_fields = r.message.fields.filter(f => !suitable_fields.includes(f));
                    console.log(`🔍 Lookup Fields Debug for ${parent_table_name}:`, {
                        total_fields: r.message.fields.length,
                        suitable_fields: suitable_fields.length,
                        excluded_fields: excluded_fields.length,
                        suitable_field_details: suitable_fields.map(f => `${f.fieldname}:${f.fieldtype}`),
                        excluded_field_details: excluded_fields.map(f => `${f.fieldname}:${f.fieldtype}`),
                        field_type_summary: r.message.fields.reduce((acc, f) => {
                            acc[f.fieldtype] = (acc[f.fieldtype] || 0) + 1;
                            return acc;
                        }, {})
                    });
                    
                    // Show alert if no suitable fields found
                    if (suitable_fields.length === 0) {
                        console.warn(`⚠️ No suitable lookup fields found in ${parent_table_name}`);
                    }
                }
                
                // If no fields found, try to get from DocType
                if (field_options.length === 0) {
                    // Try to get DocType name and fetch fields from there
                    frappe.db.get_value('Flansa Table', parent_table_name, 'doctype_name', (r) => {
                        if (r && r.doctype_name) {
                            frappe.model.with_doctype(r.doctype_name, () => {
                                const meta = frappe.get_meta(r.doctype_name);
                                meta.fields.forEach(f => {
                                    if (f.fieldtype && !['Section Break', 'Column Break', 'HTML', 'Button'].includes(f.fieldtype)) {
                                        field_options.push(f.fieldname);
                                        field_descriptions[f.fieldname] = `${f.label || f.fieldname} (${f.fieldtype})`;
                                    }
                                });
                                this.show_lookup_field_dialog(relationship_name, relationship, field_options, field_descriptions);
                            });
                        } else {
                            // Final fallback
                            field_options = ['name', 'title'];
                            field_descriptions = {
                                'name': 'Name (Data)',
                                'title': 'Title (Text)'
                            };
                            this.show_lookup_field_dialog(relationship_name, relationship, field_options, field_descriptions);
                        }
                    });
                    return;
                }
                
                // Show the dialog with actual field options
                this.show_lookup_field_dialog(relationship_name, relationship, field_options, field_descriptions);
            },
            error: () => {
                // Fallback to basic options if API fails
                const fallback_options = ['name', 'title'];
                const fallback_descriptions = {
                    'name': 'Name (Data)',
                    'title': 'Title (Text)'
                };
                this.show_lookup_field_dialog(relationship_name, relationship, fallback_options, fallback_descriptions);
            }
        });
    }
    
    show_lookup_field_dialog(relationship_name, relationship, field_options, field_descriptions) {
        const parent_table_name = relationship.parent_table || relationship.from_table;
        
        const dialog = new frappe.ui.Dialog({
            title: 'Add Lookup Field',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: `Create Lookup Field for: ${relationship.relationship_name}`
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'info',
                    options: `
                        <div class="alert alert-info">
                            <strong>About Lookup Fields:</strong><br>
                            Lookup fields automatically fetch and display data from the parent table (<strong>${parent_table_name}</strong>) 
                            and show it in the child table. For example, you can display customer details in order records.
                        </div>
                    `
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display name for the new lookup field',
                    change: function() {
                        // Auto-generate field name from label
                        const label = this.get_value();
                        if (label) {
                            const field_name = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
                            dialog.set_value('field_name', field_name);
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name for the field (auto-generated from label)'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Source Configuration'
                },
                {
                    label: 'Source Field to Fetch',
                    fieldname: 'source_field',
                    fieldtype: 'Autocomplete',
                    options: field_options && field_options.length > 0 ? field_options : [
                        'name', 'title'
                    ],
                    reqd: 1,
                    description: `Enter or select the field name from the parent table (${parent_table_name}) that you want to lookup`,
                    change: function() {
                        const value = this.get_value();
                        if (field_descriptions && field_descriptions[value]) {
                            dialog.$wrapper.find('.source-field-info').html(`
                                <small class="text-info">
                                    <i class="fa fa-info-circle"></i> ${field_descriptions[value]}
                                </small>
                            `);
                        } else if (value) {
                            dialog.$wrapper.find('.source-field-info').html(`
                                <small class="text-muted">
                                    <i class="fa fa-info-circle"></i> Will lookup "${value}" from ${parent_table_name}
                                </small>
                            `);
                        }
                    }
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'source_field_info',
                    options: '<div class="source-field-info"></div>'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'help_text',
                    options: `
                        <div class="alert alert-warning" style="margin-top: 15px;">
                            <strong>💡 Tip:</strong> You can type any field name that exists in the <strong>${parent_table_name}</strong> table. 
                            Common examples: <code>name</code>, <code>title</code>, <code>email</code>, <code>status</code>
                        </div>
                    `
                }
            ],
            primary_action_label: 'Create Lookup Field',
            primary_action: (values) => {
                // Validate field name
                if (!values.field_name.match(/^[a-z][a-z0-9_]*$/)) {
                    frappe.show_alert('Field name must start with a letter and contain only lowercase letters, numbers, and underscores', 'red');
                    return;
                }
                
                this.create_lookup_field(relationship_name, values);
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    create_lookup_field(relationship_name, field_data) {
        // Actually create the lookup field via API call
        console.log('Creating lookup field:', relationship_name, field_data);
        
        // Show loading message
        frappe.show_alert({
            message: `Creating lookup field "${field_data.field_label}"...`,
            indicator: 'blue'
        });
        
        // Call the backend API to create the lookup field
        frappe.call({
            method: 'flansa.flansa_core.api.lookup_fields_management.add_lookup_field',
            args: {
                relationship_name: relationship_name,
                source_field: field_data.source_field,
                field_config: {
                    field_name: field_data.field_name,
                    field_label: field_data.field_label,
                    fieldtype: field_data.fieldtype || 'Data',
                    in_list_view: field_data.in_list_view || 0,
                    search_index: field_data.search_index || 0
                }
            },
            callback: (response) => {
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: `✅ Successfully created lookup field: ${field_data.field_label}`,
                        indicator: 'green'
                    });
                    
                    // Refresh the fields display to show the new field (force refresh from API)
                    setTimeout(() => {
                        this.show_fields_detail(relationship_name, true);
                    }, 1500);
                } else {
                    frappe.show_alert({
                        message: `❌ Error creating lookup field: ${response.message?.error || 'Unknown error'}`,
                        indicator: 'red'
                    });
                    console.error('Lookup field creation error:', response);
                }
            },
            error: (error) => {
                frappe.show_alert({
                    message: `❌ Failed to create lookup field: ${error.message || 'Unknown error'}`,
                    indicator: 'red'
                });
                console.error('API call error:', error);
            }
        });
    }
    
    show_lookup_fields_dialog(relationship_name, field_data) {
        // Remove duplicates and format for Frappe Select field
        const unique_fields = field_data.source_fields.reduce((acc, f) => {
            if (!acc.find(existing => existing.fieldname === f.fieldname)) {
                acc.push(f);
            }
            return acc;
        }, []);
        
        // Debug: log the fields to see what we're getting
        console.log('Source fields received:', field_data.source_fields);
        console.log('Unique fields after deduplication:', unique_fields);
        
        // Simple format - just use fieldnames for now to debug
        const source_field_options = unique_fields.map(f => f.fieldname).join('\n');
        
        console.log('Final options string:', source_field_options);
        
        const dialog = new frappe.ui.Dialog({
            title: 'Add Lookup Fields',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'info',
                    options: `
                        <div class="alert alert-info">
                            <strong>Lookup Fields:</strong> Create fields in the <strong>${field_data.child_table_label}</strong> table that automatically fetch data from the parent <strong>${field_data.parent_table_label}</strong> record.
                            <br>When a ${field_data.child_table_label} is linked to a ${field_data.parent_table_label}, these fields will automatically show additional information from that ${field_data.parent_table_label}.
                        </div>
                        <div class="alert alert-warning">
                            <strong>Debug:</strong> Found ${field_data.source_fields.length} original fields, ${unique_fields.length} after deduplication.
                            <br><small>Original: ${field_data.source_fields.map(f => f.fieldname).join(', ')}</small>
                            <br><small>Unique: ${unique_fields.map(f => f.fieldname).join(', ')}</small>
                        </div>
                    `
                },
                {
                    label: 'Source Field',
                    fieldname: 'source_field',
                    fieldtype: 'Select',
                    options: source_field_options,
                    reqd: 1,
                    description: `Field from ${field_data.parent_table_label} table to fetch and display in ${field_data.child_table_label}`,
                    change: function() {
                        const source_field = this.get_value();
                        const selected_field = unique_fields.find(f => f.fieldname === source_field);
                        if (selected_field) {
                            // Auto-populate target field name and label
                            const target_name = `${field_data.parent_table_name}_${source_field}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            const target_label = `${selected_field.label || source_field} (from ${field_data.parent_table_label})`;
                            
                            dialog.set_value('target_field', target_name);
                            dialog.set_value('field_label', target_label);
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Preview',
                    fieldname: 'field_preview',
                    fieldtype: 'HTML',
                    options: '<div class="text-muted">Select a source field to see preview</div>'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Target Field Configuration'
                },
                {
                    label: 'Target Field Name',
                    fieldname: 'target_field',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: `Internal name for the lookup field in ${field_data.child_table_label} table`
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: `Display label for the lookup field in ${field_data.child_table_label} table`
                }
            ],
            primary_action_label: 'Create Lookup Field',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.api.enterprise_relationship_api.add_lookup_field',
                    args: {
                        relationship_name: relationship_name,
                        field_config: values
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert('Lookup field created successfully', 'green');
                            dialog.hide();
                            this.load_data(); // Refresh the main view
                        } else {
                            frappe.show_alert(r.message?.error || 'Failed to create lookup field', 'red');
                        }
                    }
                });
            }
        });
        
        // Update field preview when source field changes
        dialog.fields_dict.source_field.$input.on('change', function() {
            const source_field = $(this).val();
            const selected_field = unique_fields.find(f => f.fieldname === source_field);
            
            if (selected_field) {
                const preview_html = `
                    <div class="field-preview" style="padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        <h6><i class="fa fa-eye"></i> Lookup Field Preview</h6>
                        <p><strong>Source:</strong> ${field_data.parent_table_label}.${selected_field.label || source_field}</p>
                        <p><strong>Target:</strong> ${field_data.child_table_label} (new lookup field)</p>
                        <p><strong>Type:</strong> <span class="badge badge-info">${selected_field.fieldtype}</span></p>
                        ${selected_field.options ? `<p><strong>Options:</strong> ${selected_field.options}</p>` : ''}
                        <p><strong>What this creates:</strong> A read-only field in <strong>${field_data.child_table_label}</strong> that automatically displays ${selected_field.label || source_field} from the parent <strong>${field_data.parent_table_label}</strong> record.</p>
                        <p><strong>Example:</strong> When a ${field_data.child_table_label} is linked to a ${field_data.parent_table_label}, this field will show the ${selected_field.label || source_field} from that ${field_data.parent_table_label}.</p>
                    </div>
                `;
                dialog.fields_dict.field_preview.$wrapper.html(preview_html);
            }
        });
        
        dialog.show();
    }
    
    add_computed_fields(relationship_name) {
        // Debug logging
        console.log('add_computed_fields called with:', relationship_name);
        console.log('All relationships:', this.all_relationships);
        
        // Ensure all_relationships exists
        if (!this.all_relationships || !Array.isArray(this.all_relationships)) {
            console.error('all_relationships is not properly initialized');
            frappe.show_alert('Relationships not loaded. Please refresh the page.', 'red');
            return;
        }
        
        // Log relationship names for debugging
        console.log('Available relationship names:', this.all_relationships.map(r => r.name));
        
        // Get relationship details from our cached data
        const relationship = this.all_relationships.find(r => r.name === relationship_name);
        if (!relationship) {
            frappe.show_alert(`Relationship ${relationship_name} not found. Available: ${this.all_relationships.map(r => r.name).join(', ')}`, 'red');
            console.error('Relationship not found in cache:', relationship_name);
            console.error('Available relationships:', this.all_relationships);
            return;
        }
        
        // Get child table name for numeric fields
        const child_table_name = relationship.child_table || relationship.to_table;
        
        if (!child_table_name) {
            frappe.show_alert('Child table name not found', 'red');
            return;
        }
        
        // Fetch fields from the native field management API  
        frappe.call({
            method: 'flansa.native_fields.get_table_fields_native',
            args: {
                table_name: child_table_name
            },
            callback: (r) => {
                let numeric_field_options = [];
                let field_descriptions = {};
                
                // Always allow Count operation (doesn't need target field)
                // For other operations, try to find numeric fields
                let all_suitable_fields = [];
                
                // Native API returns {success: true, fields: [...]} format
                if (r.message && r.message.success && r.message.fields && r.message.fields.length > 0) {
                    console.log('Raw fields from API:', r.message.fields);
                    
                    // Get all fields that might be suitable for aggregation
                    all_suitable_fields = r.message.fields.filter(f => 
                        f.fieldname && 
                        !f.fieldname.startsWith('naming_series') &&
                        !f.fieldname.startsWith('name') &&
                        !f.fieldname.includes('docstatus') &&
                        !f.fieldname.includes('idx')
                    );
                    
                    // Find truly numeric fields for Sum/Average/Min/Max operations
                    const numeric_fields = all_suitable_fields.filter(f => 
                        ['Currency', 'Float', 'Int', 'Number', 'Percent'].includes(f.fieldtype)
                    );
                    
                    // Date fields for Min/Max operations
                    const date_fields = all_suitable_fields.filter(f =>
                        ['Date', 'Datetime', 'Time'].includes(f.fieldtype)
                    );
                    
                    // Categorize fields by type for appropriate operations
                    const text_fields = all_suitable_fields.filter(f => 
                        ['Data', 'Text', 'Small Text', 'Long Text', 'Link', 'Select'].includes(f.fieldtype)
                    );
                    
                    // Add all suitable fields to options with type info
                    all_suitable_fields.forEach(f => {
                        numeric_field_options.push(f.fieldname);
                        const label = f.label || f.fieldname;
                        let suffix = '';
                        if (numeric_fields.includes(f)) {
                            suffix = ' (Numeric - Sum/Average/Min/Max)';
                        } else if (date_fields.includes(f)) {
                            suffix = ' (Date - Min/Max)';  
                        } else if (text_fields.includes(f)) {
                            suffix = ' (Text - Count/Distinct Count/Combine Text)';
                        } else {
                            suffix = ` (${f.fieldtype} - Count/Distinct Count)`;
                        }
                        field_descriptions[f.fieldname] = `${label}${suffix}`;
                    });
                    
                    console.log(`✅ Fields Debug:`, {
                        child_table: child_table_name,
                        total_fields: r.message.fields.length,
                        suitable_fields: all_suitable_fields.length,
                        truly_numeric: numeric_fields.length,
                        all_options: numeric_field_options
                    });
                } else {
                    console.log('⚠️ No fields returned from API or API failed');
                }
                
                console.log(`Total field options found: ${numeric_field_options.length}`);
                
                // Always show dialog - Count operations don't need target fields
                // If no fields found, user can still create Count computed fields
                
                // Show the dialog with actual field options
                console.log('About to show dialog with options:', numeric_field_options);
                try {
                    this.show_computed_field_dialog(relationship_name, relationship, numeric_field_options, field_descriptions);
                } catch (error) {
                    console.error('Error showing dialog:', error);
                    frappe.show_alert(`Error showing dialog: ${error.message}`, 'red');
                }
            },
            error: (error) => {
                console.error('API Error:', error);
                frappe.show_alert(`Failed to fetch fields from table ${child_table_name}. Please check if the table exists and has fields.`, 'red');
            }
        });
    }
    
    show_computed_field_dialog(relationship_name, relationship, numeric_field_options, field_descriptions) {
        console.log('show_computed_field_dialog called with:', {
            relationship_name,
            relationship,
            numeric_field_options,
            field_descriptions
        });
        
        const child_table_name = relationship.child_table || relationship.to_table;
        
        // Always allow dialog to show - Count operations don't need target fields
        console.log('Dialog will show. Available target fields:', numeric_field_options?.length || 0);
        
        const dialog = new frappe.ui.Dialog({
            title: 'Add Computed Field',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: `Create Computed Field for: ${relationship.relationship_name}`
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'info',
                    options: `
                        <div class="alert alert-info">
                            <strong>About Computed Fields:</strong><br>
                            Computed fields calculate aggregate values from the child table (<strong>${child_table_name}</strong>) 
                            and display them in the parent table. For example, show total order amount or count of orders for each customer.
                        </div>
                    `
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display name for the computed field',
                    change: function() {
                        // Auto-generate field name from label
                        const label = this.get_value();
                        if (label) {
                            const field_name = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
                            dialog.set_value('field_name', field_name);
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name for the field (auto-generated from label)'
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Computation Configuration'
                },
                {
                    label: 'Computation Type',
                    fieldname: 'computation_type',
                    fieldtype: 'Select',
                    options: 'Count\nDistinct Count\nSum\nAverage\nMinimum\nMaximum\nCombine Text',
                    default: 'Count',
                    reqd: 1,
                    description: 'Type of calculation to perform on the child records',
                    change: function() {
                        const comp_type = this.get_value();
                        const target_field = dialog.fields_dict.target_field;
                        
                        if (comp_type === 'Count') {
                            target_field.df.hidden = true;
                            target_field.df.reqd = false;
                            target_field.df.description = 'Count operation counts all child records - no target field needed';
                            dialog.set_value('target_field', '');
                        } else {
                            target_field.df.hidden = false;
                            target_field.df.reqd = true;
                            
                            // Update description based on operation type
                            if (comp_type === 'Distinct Count') {
                                target_field.df.description = 'Count unique values in the selected field';
                            } else if (['Sum', 'Average', 'Minimum', 'Maximum'].includes(comp_type)) {
                                target_field.df.description = 'Select a numeric field for mathematical operations';
                            } else if (comp_type === 'Combine Text') {
                                target_field.df.description = 'Select a text field to combine unique values with commas';
                            }
                        }
                        dialog.refresh();
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Target Field',
                    fieldname: 'target_field',
                    fieldtype: 'Autocomplete',
                    options: numeric_field_options && numeric_field_options.length > 0 ? numeric_field_options : [
                        'amount', 'total', 'quantity', 'price', 'cost', 'value', 'score'
                    ],
                    description: numeric_field_options && numeric_field_options.length > 0 
                        ? `Select a field from ${child_table_name} table to aggregate`
                        : `Enter a field name from ${child_table_name} table (you can type any field name)`,
                    depends_on: 'eval:doc.computation_type != "Count"',
                    change: function() {
                        const value = this.get_value();
                        if (field_descriptions && field_descriptions[value]) {
                            dialog.$wrapper.find('.target-field-info').html(`
                                <small class="text-info">
                                    <i class="fa fa-info-circle"></i> ${field_descriptions[value]}
                                </small>
                            `);
                        } else if (value) {
                            dialog.$wrapper.find('.target-field-info').html(`
                                <small class="text-muted">
                                    <i class="fa fa-info-circle"></i> Will aggregate "${value}" from ${child_table_name}
                                </small>
                            `);
                        }
                    }
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'target_field_info',
                    options: '<div class="target-field-info"></div>'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'help_text',
                    options: `
                        <div class="alert alert-warning" style="margin-top: 15px;">
                            <strong>💡 Tip:</strong> Enter any numeric field that exists in the <strong>${child_table_name}</strong> table. 
                            Common examples: <code>amount</code>, <code>quantity</code>, <code>price</code>, <code>total</code>
                        </div>
                    `
                }
            ],
            primary_action_label: 'Create Computed Field',
            primary_action: (values) => {
                // Validate field name
                if (!values.field_name.match(/^[a-z][a-z0-9_]*$/)) {
                    frappe.show_alert('Field name must start with a letter and contain only lowercase letters, numbers, and underscores', 'red');
                    return;
                }
                
                // Validate that target field is selected for non-count operations
                if (values.computation_type !== 'Count' && !values.target_field) {
                    frappe.show_alert('Target field is required for aggregation operations other than Count', 'red');
                    return;
                }
                
                this.create_computed_field(relationship_name, values);
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    create_computed_field(relationship_name, field_data) {
        // Actually create the computed field via API call
        console.log('Creating computed field:', relationship_name, field_data);
        
        // Show loading message
        frappe.show_alert({
            message: `Creating computed field "${field_data.field_label}"...`,
            indicator: 'blue'
        });
        
        // Call the backend API to create the computed field
        frappe.call({
            method: 'flansa.flansa_core.api.enterprise_relationship_api.add_computed_field',
            args: {
                relationship_name: relationship_name,
                field_config: {
                    field_name: field_data.field_name,
                    field_label: field_data.field_label,
                    computation_type: field_data.computation_type || 'Count',
                    target_field: field_data.target_field,
                    formula: field_data.formula
                }
            },
            callback: (response) => {
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: `✅ Successfully created computed field: ${field_data.field_label}`,
                        indicator: 'green'
                    });
                    
                    // Refresh the fields display to show the new field (force refresh from API)
                    setTimeout(() => {
                        this.show_fields_detail(relationship_name, true);
                    }, 1500);
                } else {
                    frappe.show_alert({
                        message: `❌ Error creating computed field: ${response.message?.error || 'Unknown error'}`,
                        indicator: 'red'
                    });
                    console.error('Computed field creation error:', response);
                }
            },
            error: (error) => {
                frappe.show_alert({
                    message: `❌ Failed to create computed field: ${error.message || 'Unknown error'}`,
                    indicator: 'red'
                });
                console.error('API call error:', error);
            }
        });
    }
    
    show_computed_fields_dialog(relationship_name, field_data) {
        // Filter numeric and date fields for aggregations
        const numeric_fields = field_data.source_fields.filter(f => 
            ['Currency', 'Float', 'Int', 'Percent'].includes(f.fieldtype)
        );
        const date_fields = field_data.source_fields.filter(f => 
            ['Date', 'Datetime'].includes(f.fieldtype)
        );
        const all_aggregate_fields = [...numeric_fields, ...date_fields];
        
        // Remove duplicates and format properly
        const unique_aggregate_fields = all_aggregate_fields.reduce((acc, f) => {
            if (!acc.find(existing => existing.fieldname === f.fieldname)) {
                acc.push(f);
            }
            return acc;
        }, []);
        
        const target_field_options = unique_aggregate_fields.map(f => {
            const label = f.label || f.fieldname;
            return label !== f.fieldname ? `${f.fieldname}\n${label}` : f.fieldname;
        }).join('\n');
        
        const dialog = new frappe.ui.Dialog({
            title: 'Add Computed Fields',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'info',
                    options: `
                        <div class="alert alert-info">
                            <strong>Computed Fields:</strong> Create fields that automatically calculate values from <strong>${field_data.child_table_label}</strong> records.
                            <br>Examples: COUNT of records, SUM of amounts, AVERAGE of ratings.
                        </div>
                    `
                },
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Internal name for the computed field'
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: `Display label for the lookup field in ${field_data.child_table_label} table`
                },
                {
                    fieldtype: 'Section Break',
                    label: 'Computation Configuration'
                },
                {
                    label: 'Computation Type',
                    fieldname: 'computation_type',
                    fieldtype: 'Select',
                    options: ['Count', 'Sum', 'Average', 'Min', 'Max', 'Formula'],
                    default: 'Count',
                    reqd: 1,
                    change: function() {
                        const type = this.get_value();
                        const needs_target = ['Sum', 'Average', 'Min', 'Max'].includes(type);
                        const needs_formula = type === 'Formula';
                        
                        dialog.fields_dict.target_field.toggle(needs_target);
                        dialog.fields_dict.formula.toggle(needs_formula);
                        dialog.fields_dict.computation_preview.toggle(true);
                        
                        // Auto-generate field name and label based on type
                        if (type === 'Count') {
                            const suggested_name = `total_${field_data.child_table_name}_count`;
                            const suggested_label = `Total ${field_data.child_table_label} Count`;
                            dialog.set_value('field_name', suggested_name);
                            dialog.set_value('field_label', suggested_label);
                        }
                        
                        // Update preview
                        this.update_computation_preview();
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Target Field',
                    fieldname: 'target_field',
                    fieldtype: 'Select',
                    options: target_field_options,
                    description: 'Field to calculate on (for Sum, Average, etc.)',
                    hidden: 1,
                    change: function() {
                        const target_field = this.get_value();
                        const computation_type = dialog.get_value('computation_type');
                        
                        if (target_field && computation_type !== 'Count') {
                            const selected_field = unique_aggregate_fields.find(f => f.fieldname === target_field);
                            if (selected_field) {
                                const suggested_name = `${computation_type.toLowerCase()}_${target_field}`;
                                const suggested_label = `${computation_type} ${selected_field.label || target_field}`;
                                dialog.set_value('field_name', suggested_name);
                                dialog.set_value('field_label', suggested_label);
                            }
                        }
                    }
                },
                {
                    label: 'Formula',
                    fieldname: 'formula',
                    fieldtype: 'Code',
                    options: 'Javascript',
                    description: 'Custom formula (advanced users)',
                    hidden: 1
                },
                {
                    fieldtype: 'Section Break'
                },
                {
                    label: 'Preview',
                    fieldname: 'computation_preview',
                    fieldtype: 'HTML',
                    options: '<div class="text-muted">Select computation type to see preview</div>'
                }
            ],
            primary_action_label: 'Create Computed Field',
            primary_action: (values) => {
                frappe.call({
                    method: 'flansa.flansa_core.api.enterprise_relationship_api.add_computed_field',
                    args: {
                        relationship_name: relationship_name,
                        field_config: values
                    },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            frappe.show_alert('Computed field created successfully', 'green');
                            dialog.hide();
                            this.load_data(); // Refresh the main view
                        } else {
                            frappe.show_alert(r.message?.error || 'Failed to create computed field', 'red');
                        }
                    }
                });
            }
        });
        
        // Add method to update computation preview
        dialog.fields_dict.computation_type.update_computation_preview = function() {
            const type = dialog.get_value('computation_type');
            const target_field = dialog.get_value('target_field');
            let preview_html = '';
            
            switch(type) {
                case 'Count':
                    preview_html = `
                        <div class="alert alert-primary">
                            <h6><i class="fa fa-calculator"></i> Count Computation</h6>
                            <p><strong>Will count:</strong> Total number of ${field_data.child_table_label} records</p>
                            <p><strong>Example result:</strong> 5 (if there are 5 related records)</p>
                        </div>
                    `;
                    break;
                case 'Sum':
                    preview_html = target_field ? `
                        <div class="alert alert-success">
                            <h6><i class="fa fa-plus"></i> Sum Computation</h6>
                            <p><strong>Will sum:</strong> All ${target_field} values from ${field_data.child_table_label}</p>
                            <p><strong>Example:</strong> If amounts are 100, 200, 300 → Result: 600</p>
                        </div>
                    ` : '<div class="text-muted">Select a target field for Sum computation</div>';
                    break;
                case 'Average':
                    preview_html = target_field ? `
                        <div class="alert alert-info">
                            <h6><i class="fa fa-calculator"></i> Average Computation</h6>
                            <p><strong>Will average:</strong> All ${target_field} values from ${field_data.child_table_label}</p>
                            <p><strong>Example:</strong> If amounts are 100, 200, 300 → Result: 200</p>
                        </div>
                    ` : '<div class="text-muted">Select a target field for Average computation</div>';
                    break;
                case 'Min':
                    preview_html = target_field ? `
                        <div class="alert alert-warning">
                            <h6><i class="fa fa-arrow-down"></i> Minimum Computation</h6>
                            <p><strong>Will find:</strong> Smallest ${target_field} value from ${field_data.child_table_label}</p>
                            <p><strong>Example:</strong> If dates are 2024-01-01, 2024-02-01 → Result: 2024-01-01</p>
                        </div>
                    ` : '<div class="text-muted">Select a target field for Min computation</div>';
                    break;
                case 'Max':
                    preview_html = target_field ? `
                        <div class="alert alert-danger">
                            <h6><i class="fa fa-arrow-up"></i> Maximum Computation</h6>
                            <p><strong>Will find:</strong> Largest ${target_field} value from ${field_data.child_table_label}</p>
                            <p><strong>Example:</strong> If dates are 2024-01-01, 2024-02-01 → Result: 2024-02-01</p>
                        </div>
                    ` : '<div class="text-muted">Select a target field for Max computation</div>';
                    break;
                case 'Formula':
                    preview_html = `
                        <div class="alert alert-secondary">
                            <h6><i class="fa fa-code"></i> Custom Formula</h6>
                            <p><strong>Advanced:</strong> Write JavaScript code for custom calculations</p>
                            <p><strong>Available:</strong> Access to all ${field_data.child_table_label} records and their fields</p>
                        </div>
                    `;
                    break;
            }
            
            dialog.fields_dict.computation_preview.$wrapper.html(preview_html);
        };
        
        dialog.show();
    }
    
    show_fields_detail(relationship_name, force_refresh = false) {
        // Debug logging
        console.log('show_fields_detail called with:', relationship_name);
        console.log('All relationships:', this.all_relationships);
        
        // Always fetch fresh data from API if force_refresh is true (after field operations)
        // or if no cached data exists
        const relationship = this.all_relationships ? this.all_relationships.find(r => r.name === relationship_name) : null;
        
        if (!relationship && !force_refresh) {
            frappe.show_alert(`Relationship ${relationship_name} not found. Fetching from server...`, 'orange');
        }
        
        // Check if cached data has been enriched with detailed field data from enterprise API
        const hasDetailedData = relationship && relationship.lookup_fields !== undefined && 
                               (relationship.lookup_fields.length > 0 || relationship._detailed_data_fetched === true);
        
        if (relationship && !force_refresh && hasDetailedData) {
            // Use cached data only if not forcing refresh AND cached data has detailed fields or was previously fetched
            this.render_fields_detail_dialog(relationship);
        } else {
            // Always fetch fresh data from API
            frappe.call({
                method: 'flansa.flansa_core.api.enterprise_relationship_api.get_relationship_fields_detail',
                args: {
                    relationship_name: relationship_name
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        // Update the cached data with fresh info
                        const updatedRelationship = r.message.relationship;
                        updatedRelationship._detailed_data_fetched = true; // Mark as having detailed data
                        
                        // Preserve the original table references if they're missing in the API response
                        const index = this.all_relationships.findIndex(rel => rel.name === relationship_name);
                        if (index !== -1) {
                            const originalRel = this.all_relationships[index];
                            updatedRelationship.child_table = updatedRelationship.child_table || originalRel.child_table;
                            updatedRelationship.parent_table = updatedRelationship.parent_table || originalRel.parent_table;
                            updatedRelationship.to_table = updatedRelationship.to_table || originalRel.to_table;
                            updatedRelationship.from_table = updatedRelationship.from_table || originalRel.from_table;
                            
                            this.all_relationships[index] = updatedRelationship;
                        }
                        
                        this.render_fields_detail_dialog(updatedRelationship);
                    } else {
                        // Even if API fails, show basic info
                        frappe.show_alert('Loading relationship details...', 'blue');
                        // Try to show at least basic relationship info
                        const basic_relationship = {
                            name: relationship_name,
                            relationship_name: relationship_name,
                            relationship_type: 'One to Many',
                            computed_fields: [],
                            lookup_fields: []
                        };
                        this.render_fields_detail_dialog(basic_relationship);
                    }
                },
                error: (r) => {
                    // On error, still show basic dialog
                    const basic_relationship = {
                        name: relationship_name,
                        relationship_name: relationship_name,
                        relationship_type: 'One to Many',
                        computed_fields: [],
                        lookup_fields: []
                    };
                    this.render_fields_detail_dialog(basic_relationship);
                }
            });
        }
    }
    
    render_fields_detail_dialog(relationship) {
        const computed_fields_html = relationship.computed_fields && relationship.computed_fields.length > 0 ? `
            <h6><i class="fa fa-calculator"></i> Computed Fields (${relationship.computed_fields.length})</h6>
            <div class="table-responsive" style="margin-bottom: 20px;">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Field Name</th>
                            <th>Label</th>
                            <th>Type</th>
                            <th>Target Field</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${relationship.computed_fields.map(cf => `
                            <tr>
                                <td><code>${cf.field_name}</code></td>
                                <td>${cf.field_label || cf.field_name}</td>
                                <td><span class="badge badge-info">${cf.computation_type}</span></td>
                                <td>${cf.target_field || '-'}</td>
                                <td>
                                    <button class="btn btn-xs btn-danger" onclick="window.relationship_builder.remove_computed_field('${relationship.name}', '${cf.name || cf.field_name}')">
                                        <i class="fa fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="text-muted">No computed fields created yet.</p>';
        
        const lookup_fields_html = relationship.lookup_fields && relationship.lookup_fields.length > 0 ? `
            <h6><i class="fa fa-link"></i> Lookup Fields (${relationship.lookup_fields.length})</h6>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Field Name</th>
                            <th>Label</th>
                            <th>Fetch From</th>
                            <th>Type</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${relationship.lookup_fields.map(lf => `
                            <tr>
                                <td><code>${lf.fieldname}</code></td>
                                <td>${lf.label || lf.fieldname}</td>
                                <td><small>${lf.fetch_from || 'N/A'}</small></td>
                                <td><span class="badge badge-secondary">${lf.fieldtype}</span></td>
                                <td>
                                    <button class="btn btn-xs btn-danger" onclick="window.relationship_builder.remove_lookup_field('${relationship.name}', '${lf.fieldname}')">
                                        <i class="fa fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '<p class="text-muted">No lookup fields created yet.</p>';
        
        const dialog = new frappe.ui.Dialog({
            title: `Fields for ${relationship.relationship_name}`,
            size: 'extra-large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'fields_detail',
                    options: `
                        <div class="relationship-fields-detail">
                            <div class="row" style="margin-bottom: 20px;">
                                <div class="col-md-8">
                                    <h5><i class="fa fa-link"></i> ${relationship.relationship_name}</h5>
                                    <p class="text-muted">${relationship.description || 'No description'}</p>
                                    ${this.getLinkFieldDisplay(relationship)}
                                </div>
                                <div class="col-md-4 text-right">
                                    <button class="btn btn-sm btn-outline-info" disabled style="cursor: default;">
                                        ${this.getRelationshipIcon(relationship.relationship_type)} ${relationship.relationship_type}
                                    </button>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    ${computed_fields_html}
                                </div>
                                <div class="col-md-6">
                                    ${lookup_fields_html}
                                </div>
                            </div>
                            
                            <div class="text-center" style="margin-top: 20px;">
                                <button class="btn btn-primary" id="add-computed-field-btn">
                                    <i class="fa fa-calculator"></i> Add Computed Field
                                </button>
                                <button class="btn btn-success" id="add-lookup-field-btn" style="margin-left: 10px;">
                                    <i class="fa fa-plus"></i> Add Lookup Field
                                </button>
                            </div>
                        </div>
                    `
                }
            ]
        });
        
        dialog.show();
        
        // Bind button events after dialog is shown
        dialog.$wrapper.find('#add-computed-field-btn').on('click', () => {
            dialog.hide();
            this.add_computed_fields(relationship.name);
        });
        
        dialog.$wrapper.find('#add-lookup-field-btn').on('click', () => {
            dialog.hide();
            this.add_lookup_fields(relationship.name);
        });
    }
    
    getLinkFieldDisplay(relationship) {
        // Display link field information next to relationship name
        if (relationship.link_fields && relationship.link_fields.length > 0) {
            const linkField = relationship.link_fields[0]; // Usually just 1 link field
            return `
                <div style="margin-top: 8px;">
                    <small class="text-muted">
                        <i class="fa fa-arrow-right"></i> 
                        Connected via: <code>${linkField.fieldname}</code> 
                        ${linkField.required ? '<i class="fa fa-asterisk text-warning" title="Required field"></i>' : ''}
                        ${linkField.in_list_view ? '<i class="fa fa-list text-info" title="Shown in list view"></i>' : ''}
                    </small>
                </div>
            `;
        }
        return '<div style="margin-top: 8px;"><small class="text-warning"><i class="fa fa-exclamation-triangle"></i> No link field found</small></div>';
    }
    
    remove_computed_field(relationship_name, field_name) {
        frappe.confirm(`Remove computed field "${field_name}"?`, () => {
            frappe.call({
                method: 'flansa.flansa_core.api.enterprise_relationship_api.remove_computed_field',
                args: {
                    relationship_name: relationship_name,
                    field_name: field_name
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert('Computed field removed', 'green');
                        this.load_data();
                        // Close and reopen the dialog
                        setTimeout(() => this.show_fields_detail(relationship_name), 500);
                    } else {
                        frappe.show_alert('Failed to remove field', 'red');
                    }
                }
            });
        });
    }
    
    remove_lookup_field(relationship_name, field_name) {
        frappe.confirm(`Remove lookup field "${field_name}"?`, () => {
            frappe.call({
                method: 'flansa.flansa_core.api.enterprise_relationship_api.remove_lookup_field',
                args: {
                    relationship_name: relationship_name,
                    field_name: field_name
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert('Lookup field removed', 'green');
                        this.load_data();
                        // Close and reopen the dialog
                        setTimeout(() => this.show_fields_detail(relationship_name), 500);
                    } else {
                        frappe.show_alert('Failed to remove field', 'red');
                    }
                }
            });
        });
    }

    delete_relationship(relationship_name) {
        frappe.confirm(
            'Are you sure you want to delete this relationship? This action cannot be undone.',
            () => {
                frappe.call({
                    method: 'frappe.client.delete',
                    args: {
                        doctype: 'Flansa Relationship',
                        name: relationship_name
                    },
                    callback: (r) => {
                        if (r && !r.exc) {
                            frappe.show_alert('Relationship deleted successfully', 'green');
                            this.load_data();
                        } else {
                            frappe.show_alert('Failed to delete relationship', 'red');
                        }
                    }
                });
            }
        );
    }
    
    edit_relationship(relationship_name) {
        // Navigate to the relationship form for editing
        frappe.set_route('Form', 'Flansa Relationship', relationship_name);
    }
    
    open_parent_table_builder(table_name) {
        if (!table_name) {
            frappe.show_alert('Parent table not found', 'orange');
            return;
        }
        
        // Open Visual Builder directly with the table ID
        const url = `/app/flansa-visual-builder?table=${table_name}`;
        window.open(url, '_blank');
        
        // Get table label for notification
        frappe.db.get_value('Flansa Table', table_name, 'table_label', (r) => {
            if (r && r.table_label) {
                frappe.show_alert(`Opening ${r.table_label} in Visual Builder`, 'blue');
            }
        });
    }
    
    open_child_table_builder(table_name) {
        if (!table_name) {
            frappe.show_alert('Child table not found', 'orange');
            return;
        }
        
        // Open Visual Builder directly with the table ID
        const url = `/app/flansa-visual-builder?table=${table_name}`;
        window.open(url, '_blank');
        
        // Get table label for notification
        frappe.db.get_value('Flansa Table', table_name, 'table_label', (r) => {
            if (r && r.table_label) {
                frappe.show_alert(`Opening ${r.table_label} in Visual Builder`, 'blue');
            }
        });
    }
    
    bind_search_and_filters() {
        const self = this;
        
        // Search functionality
        $('#relationship-search').on('input', function() {
            self.filter_relationships();
        });
        
        // Type filter
        $('#relationship-type-filter').on('change', function() {
            self.filter_relationships();
        });
        
        // Status filter
    }
    
    filter_relationships() {
        const searchTerm = $('#relationship-search').val().toLowerCase();
        const typeFilter = $('#relationship-type-filter').val();
        
        this.filtered_relationships = this.all_relationships.filter(rel => {
            // Search filter
            const searchMatch = !searchTerm || 
                (rel.relationship_name || '').toLowerCase().includes(searchTerm) ||
                (rel.parent_table || rel.from_table || '').toLowerCase().includes(searchTerm) ||
                (rel.child_table || rel.to_table || '').toLowerCase().includes(searchTerm);
            
            // Type filter
            const typeMatch = !typeFilter || rel.relationship_type === typeFilter;
            
            return searchMatch && typeMatch;
        });
        
        // Re-render the filtered relationships
        this.render_filtered_relationships();
        
        // Update the count display
        this.update_relationship_count_display();
    }
    
    render_filtered_relationships() {
        const relationships = this.filtered_relationships;
        
        if (relationships.length === 0) {
            let empty_content;
            if (this.view_mode === 'tiles') {
                empty_content = `
                    <div class="items-grid mt-3">
                        ${this.render_create_relationship_tile()}
                    </div>
                `;
            } else {
                empty_content = `
                    <div class="empty-state text-center" style="padding: 40px 20px;">
                        <i class="fa fa-link fa-4x text-muted"></i>
                        <h4 class="mt-3">No relationships yet</h4>
                        <p class="text-muted">Create relationships to connect your tables</p>
                        <button class="btn btn-flansa-primary" onclick="window.relationship_builder.show_create_dialog()">
                            <i class="fa fa-plus"></i> Add First Relationship
                        </button>
                    </div>
                `;
            }
            $('.relationships-list').html(empty_content);
            return;
        }
        
        let content_html;
        
        if (this.view_mode === 'table') {
            content_html = this.render_relationships_table(relationships);
        } else {
            content_html = this.render_relationships_tiles(relationships);
        }
        
        $('.relationships-list').html(content_html);
        
        // Load table labels for the filtered relationships
        this.load_table_labels(relationships);
        
        // Bind tile click events if in tiles view
        if (this.view_mode === 'tiles') {
            this.bind_tile_events();
        }
    }
    
    render_relationships_tiles(relationships) {
        return `
            <div class="items-grid mt-3">
                ${relationships.map(rel => this.render_relationship_tile(rel)).join('')}
            </div>
        `;
    }
    
    render_relationship_tile(relationship) {
        return `
            <div class="grid-item flansa-card relationship-tile-clickable" data-relationship-name="${relationship.name}" onclick="window.relationship_builder.edit_relationship('${relationship.name}')" style="cursor: pointer;" title="Click to edit relationship properties">
                <div class="item-header">
                    <div class="item-icon">
                        ${this.getRelationshipIcon(relationship.relationship_type)}
                    </div>
                    <div class="item-title">${relationship.relationship_name}</div>
                </div>
                <div class="item-meta">
                    <small class="relationship-flow">
                        <span id="parent-${relationship.name}">Loading...</span>
                        <span style="margin: 0 5px;">${relationship.relationship_type === 'Many to Many' ? '⇄' : '→'}</span>
                        <span id="child-${relationship.name}">Loading...</span>
                    </small>
                    <small class="status-badge flansa-text-info">${relationship.relationship_type}</small>
                    ${relationship.computed_fields && relationship.computed_fields.length > 0 ? `
                        <small><i class="fa fa-calculator"></i> ${relationship.computed_fields.length} computed</small>
                    ` : ''}
                    ${relationship.lookup_fields && relationship.lookup_fields.length > 0 ? `
                        <small><i class="fa fa-link"></i> ${relationship.lookup_fields.length} lookup</small>
                    ` : ''}
                </div>
                <div class="item-description">
                    ${this.getRelationshipDescription(relationship.relationship_type)}
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-flansa-primary" onclick="event.stopPropagation(); window.relationship_builder.show_fields_detail('${relationship.name}')">
                        <i class="fa fa-eye"></i> View Fields
                    </button>
                    <button class="btn btn-sm btn-flansa-success" onclick="event.stopPropagation(); window.relationship_builder.add_computed_fields('${relationship.name}')">
                        <i class="fa fa-calculator"></i> Add Computed
                    </button>
                </div>
                <div class="item-secondary-actions" style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;">
                    <button class="btn btn-xs btn-default" onclick="event.stopPropagation(); window.relationship_builder.add_lookup_fields('${relationship.name}')" title="Add Lookup Fields">
                        <i class="fa fa-link"></i> Lookup
                    </button>
                    <button class="btn btn-xs btn-default" onclick="event.stopPropagation(); window.relationship_builder.open_parent_table_builder('${relationship.parent_table || relationship.from_table}')" title="Open Parent Table">
                        <i class="fa fa-table"></i> Parent
                    </button>
                    <button class="btn btn-xs btn-default" onclick="event.stopPropagation(); window.relationship_builder.open_child_table_builder('${relationship.child_table || relationship.to_table}')" title="Open Child Table">
                        <i class="fa fa-table"></i> Child
                    </button>
                    <button class="btn btn-xs btn-outline-danger" onclick="event.stopPropagation(); window.relationship_builder.delete_relationship('${relationship.name}')" title="Delete Relationship">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    render_create_relationship_tile() {
        return `
            <div class="grid-item flansa-card create-relationship-tile" onclick="window.relationship_builder.show_create_dialog()">
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <div class="empty-state-icon">
                        <i class="fa fa-plus"></i>
                    </div>
                    <div class="empty-state-title">Add Relationship</div>
                    <div class="empty-state-description">Connect your tables with relationships</div>
                </div>
            </div>
        `;
    }
    
    render_relationships_table(relationships) {
        return `
            <div class="table-responsive mt-3">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Relationship Name</th>
                            <th>Type</th>
                            <th>Connection</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${relationships.map(rel => `
                            <tr>
                                <td>
                                    <strong>${rel.relationship_name}</strong>
                                    <br><small class="text-muted">${rel.name}</small>
                                </td>
                                <td>
                                    <span class="badge badge-info">${rel.relationship_type}</span>
                                </td>
                                <td>
                                    <small>
                                        <span class="badge badge-outline-primary" id="parent-table-${rel.name}">Loading...</span>
                                        <span style="margin: 0 8px;">${rel.relationship_type === 'Many to Many' ? '⇄' : '→'}</span>
                                        <span class="badge badge-outline-success" id="child-table-${rel.name}">Loading...</span>
                                    </small>
                                </td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-info" onclick="window.relationship_builder.show_fields_detail('${rel.name}')" title="View Fields">
                                            <i class="fa fa-eye"></i> View
                                        </button>
                                        <button class="btn btn-success" onclick="window.relationship_builder.add_computed_fields('${rel.name}')" title="Add Computed Field">
                                            <i class="fa fa-calculator"></i> Computed
                                        </button>
                                        <button class="btn btn-default" onclick="window.relationship_builder.add_lookup_fields('${rel.name}')" title="Add Lookup Field">
                                            <i class="fa fa-link"></i> Lookup
                                        </button>
                                        <button class="btn btn-danger" onclick="window.relationship_builder.delete_relationship('${rel.name}')" title="Delete Relationship">
                                            <i class="fa fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    update_relationship_count_display() {
        // Update the count in section header
        const visibleCount = this.filtered_relationships ? this.filtered_relationships.length : this.all_relationships.length;
        const totalCount = this.all_relationships.length;
        
        let countText = `${visibleCount} relationship${visibleCount !== 1 ? 's' : ''}`;
        if (this.filtered_relationships && visibleCount !== totalCount) {
            countText += ` of ${totalCount} total`;
        }
        
        $('#relationship-count-display').text(countText);
    }
    
    getRelationshipDescription(relationship_type) {
        const descriptions = {
            'One to Many': 'Each parent record can have multiple child records, but each child belongs to only one parent',
            'Many to Many': 'Records from both tables can be related to multiple records from the other table',
            'One to One': 'Each record from one table is related to exactly one record from the other table'
        };
        
        return descriptions[relationship_type] || `${relationship_type} relationship between tables`;
    }
    
    getRelationshipIcon(relationship_type) {
        const icons = {
            'One to Many': '<i class="fa fa-sitemap"></i>',
            'Many to Many': '<i class="fa fa-exchange"></i>',
            'One to One': '<i class="fa fa-arrows-h"></i>'
        };
        
        return icons[relationship_type] || '<i class="fa fa-link"></i>';
    }
    
    switch_view(mode) {
        this.view_mode = mode;
        
        // Update active button state
        $('.view-btn').removeClass('active');
        $(`.view-btn[onclick*="${mode}"]`).addClass('active');
        
        // Re-render relationships with new view
        this.render_filtered_relationships();
    }
    
    bind_tile_events() {
        const self = this;
        
        // Make tiles clickable (except when clicking buttons)
        $('.grid-item.flansa-card').on('click', function(e) {
            if (!$(e.target).closest('.item-actions').length && 
                !$(e.target).closest('.item-secondary-actions').length && 
                !$(e.target).closest('button').length) {
                const relationship_name = $(this).data('relationship-name');
                if (relationship_name) {
                    self.edit_relationship(relationship_name);
                }
            }
        });
    }
}

frappe.pages['flansa-relationship-builder'].on_page_show = function() {
    if (window.relationship_builder) {
        window.relationship_builder.load_data();
    }
};
// Apply theme on page load
$(document).ready(function() {
    if (window.page_instance && window.page_instance.apply_theme) {
        window.page_instance.apply_theme();
    }
});
