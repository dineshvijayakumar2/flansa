// Copyright (c) 2025, Flansa Team and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flansa Table', {
    refresh: function(frm) {
        if (frm.doc.name && !frm.is_new()) {
            add_enhanced_flansa_buttons(frm);
            add_flansa_indicators(frm);
        }
        
        // Auto-populate doctype_name will be handled server-side using ID-based naming
        // No need to set it in JavaScript - let the server generate it properly
    },
    
    table_label(frm) {
        // Auto-generate table_name and doctype_name from label
        if (frm.doc.table_label && !frm.doc.table_name) {
            const table_name = frm.doc.table_label
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
            frm.set_value('table_name', table_name);
        }
        
        // DocType name generation will be handled server-side with ID-based naming
    },
    
    table_name(frm) {
        // DocType name generation will be handled server-side with ID-based naming
    }
});

function add_enhanced_flansa_buttons(frm) {
    // Clear existing buttons to avoid duplicates
    frm.clear_custom_buttons();
    
    // Primary Visual Builder button
    frm.add_custom_button('🎨 Open Visual Builder', function() {
        open_visual_builder_with_app_name(frm);
    }).addClass('btn-primary');
    
    // DocType Management Group - Always show Force Generate
    frm.add_custom_button('🔨 Force Generate DocType', function() {
        force_regenerate_doctype(frm);
    }, 'DocType Management');
    
    if (frm.doc.doctype_name) {
        frm.add_custom_button('⚙️ DocType Settings', function() {
            frappe.set_route('Form', 'DocType', frm.doc.doctype_name);
        }, 'DocType Management');
        
        if (frm.doc.status === 'Active') {
            frm.add_custom_button('📋 View Data List', function() {
                // Use Flansa Report Viewer with explicit type parameter
                window.FlansaNav.navigateToViewData(frm.doc.name);
            }, 'DocType Management');
        }
    }
    
    // Field Sync Options
    frm.add_custom_button('🔄 Force Resync', function() {
        force_resync_fields(frm);
    }, 'Field Sync');
    
    frm.add_custom_button('🔄 Sync Out-of-Sync', function() {
        sync_out_of_sync_fields(frm);
    }, 'Field Sync');
    
    frm.add_custom_button('🔄 Sync All to DocType', function() {
        sync_all_to_doctype(frm);
    }, 'Field Sync');
    
    frm.add_custom_button('📥 Sync DocType to JSON', function() {
        sync_doctype_to_json_fields(frm);
    }, 'Field Sync');
    
    // Navigation & Quick Actions
    frm.add_custom_button('📋 View Fields List', function() {
        frappe.set_route('List', 'Flansa Field', { 'flansa_table': frm.doc.name });
    }, 'Quick Actions');
    
    if (frm.doc.application) {
        frm.add_custom_button('🏠 App Dashboard', function() {
            window.open(`/app/flansa-app-dashboard/${frm.doc.application}`, '_blank');
        }, 'Quick Actions');
        
        frm.add_custom_button('🔗 Relationship Builder', function() {
            window.open(`/app/flansa-relationship-builder/${frm.doc.application}?from_table=${frm.doc.name}`, '_blank');
        }, 'Quick Actions');
    }
    
    // Debug button for development
    frm.add_custom_button('🔍 Debug Info', function() {
        show_app_name_debug(frm);
    }, 'Debug');
    
    // Activation button if not active
    if (frm.doc.name && frm.doc.status !== 'Active') {
        frm.add_custom_button('🚀 Activate Table', function() {
            activate_table(frm);
        });
    }
}

function add_flansa_indicators(frm) {
    if (frm.doc.fields_count) {
        frm.dashboard.add_indicator('📊 Fields: ' + frm.doc.fields_count, 'blue');
    }
    
    // Check DocType status more accurately
    if (frm.doc.doctype_name) {
        // Simple existence check using frappe.call
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'DocType',
                filters: { name: frm.doc.doctype_name }
            },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    // DocType exists
                    if (frm.doc.status === 'Active') {
                        frm.dashboard.add_indicator('✅ Active DocType', 'green');
                    } else {
                        frm.dashboard.add_indicator('⚡ DocType Ready (Status: ' + (frm.doc.status || 'Draft') + ')', 'blue');
                    }
                } else {
                    // DocType doesn't exist
                    frm.dashboard.add_indicator('❌ DocType Missing', 'red');
                }
            }
        });
    } else {
        // No DocType name set
        frm.dashboard.add_indicator('⚠️ ' + (frm.doc.status || 'Draft') + ' - No DocType', 'orange');
    }
    
    const app_name = frm.doc.application || frm.doc.app_name || frm.doc.name;
    if (app_name && app_name !== frm.doc.name) {
        frm.dashboard.add_indicator('🎯 App: ' + app_name, 'purple');
    }
}

// Removed generate_doctype_name function - DocType naming now handled server-side with ID-based naming

function open_visual_builder_with_app_name(frm) {
    const app_name = frm.doc.application || frm.doc.app_name;
    
    if (app_name) {
        console.log('Opening visual builder with app name:', app_name);
        frappe.show_alert('Opening Visual Builder with app: ' + app_name, 'blue');
        frappe.set_route('flansa-visual-builder', app_name);
    } else {
        frappe.msgprint({
            title: '🎨 Visual Builder Requires Application',
            message: `
                <p>To use the Visual Builder, this table needs to be linked to an application.</p>
                <p><strong>Alternative:</strong> To view the data directly, use the "📋 View Data List" button instead.</p>
                <p><em>Table ID: ${frm.doc.name}</em></p>
            `,
            indicator: 'orange'
        });
    }
}

function force_resync_fields(frm) {
    frappe.show_alert('🔄 Resyncing fields from JSON...', 'blue');
    
    frappe.call({
        method: 'flansa.flansa_core.api.field_management.sync_json_to_flansa_fields',
        args: { table_name: frm.doc.name },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert('✅ Resynced ' + r.message.count + ' fields!', 'green');
                frm.refresh();
            } else {
                frappe.show_alert('❌ Resync failed: ' + (r.message.error || 'Unknown error'), 'red');
            }
        }
    });
}

function sync_out_of_sync_fields(frm) {
    frappe.show_alert('🔄 Checking for out-of-sync fields...', 'blue');
    
    frappe.call({
        method: 'flansa.flansa_core.api.field_management.sync_out_of_sync_fields',
        args: { table_name: frm.doc.name },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert('✅ Synced ' + r.message.synced + ' out-of-sync fields!', 'green');
                if (r.message.details) {
                    frappe.msgprint({
                        title: 'Sync Details',
                        message: r.message.details,
                        indicator: 'blue'
                    });
                }
                frm.refresh();
            } else {
                frappe.show_alert('❌ Sync failed: ' + (r.message.error || 'Unknown error'), 'red');
            }
        }
    });
}

function sync_all_to_doctype(frm) {
    if (!frm.doc.doctype_name) {
        frappe.msgprint('Please generate the DocType first before syncing fields');
        return;
    }
    
    frappe.confirm('This will sync all fields to the generated DocType. Continue?', function() {
        frappe.show_alert('🔄 Syncing all fields to DocType...', 'blue');
        
        frappe.call({
            method: 'flansa.flansa_core.api.field_management.sync_fields_to_doctype',
            args: { 
                table_name: frm.doc.name,
                doctype_name: frm.doc.doctype_name
            },
            callback: function(r) {
                if (r.message && r.message.success) {
                    frappe.show_alert('✅ Synced ' + r.message.count + ' fields to DocType!', 'green');
                    frappe.msgprint({
                        title: 'Sync Complete',
                        message: r.message.details || 'All fields have been synced to the DocType.',
                        indicator: 'green'
                    });
                } else {
                    frappe.msgprint({
                        title: 'Sync Failed',
                        message: r.message.error || 'Failed to sync fields to DocType',
                        indicator: 'red'
                    });
                }
            }
        });
    });
}

function sync_doctype_to_json_fields(frm) {
    if (!frm.doc.doctype_name) {
        frappe.msgprint('No DocType exists to sync from');
        return;
    }
    
    frappe.confirm('This will update the JSON fields based on the actual DocType. Continue?', function() {
        frappe.call({
            method: 'flansa.flansa_core.api.field_management.sync_doctype_to_json',
            args: { 
                table_name: frm.doc.name,
                doctype_name: frm.doc.doctype_name
            },
            callback: function(r) {
                if (r.message && r.message.success) {
                    frappe.show_alert('✅ Synced ' + r.message.count + ' fields from DocType to JSON!', 'green');
                    frm.reload();
                } else {
                    frappe.msgprint({
                        title: 'Sync Failed',
                        message: r.message.error || 'Failed to sync DocType to JSON',
                        indicator: 'red'
                    });
                }
            }
        });
    });
}

function show_app_name_debug(frm) {
    const app_name = frm.doc.application || frm.doc.app_name || frm.doc.name;
    
    let debug_html = '<h4>Application Name Debug</h4>';
    debug_html += '<p><strong>Table ID:</strong> ' + frm.doc.name + '</p>';
    debug_html += '<p><strong>Application:</strong> ' + (frm.doc.application || 'Not Set') + '</p>';
    debug_html += '<p><strong>Table Name:</strong> ' + (frm.doc.table_name || 'Not Set') + '</p>';
    debug_html += '<p><strong>DocType Name:</strong> ' + (frm.doc.doctype_name || 'Not Generated') + '</p>';
    debug_html += '<p><strong>Status:</strong> ' + (frm.doc.status || 'Draft') + '</p>';
    debug_html += '<p><strong>Fields Count:</strong> ' + (frm.doc.fields_count || 0) + '</p>';
    debug_html += '<hr>';
    debug_html += '<p><strong>Visual Builder URL:</strong><br>';
    if (app_name && app_name !== frm.doc.name) {
        debug_html += '<code>http://localhost:8000/app/flansa-visual-builder/' + app_name + '</code>';
    } else {
        debug_html += '<code>No application set</code>';
    }
    debug_html += '</p>';
    
    frappe.msgprint({
        title: 'Debug Information',
        message: debug_html,
        indicator: 'blue'
    });
}

function force_regenerate_doctype(frm) {
    frappe.confirm(
        __('This will force generate/regenerate the DocType (works even without fields). Continue?'),
        () => {
            frappe.show_alert('🔄 Generating DocType...', 'blue');
            
            // Call regenerate_doctype directly - it handles invalid references internally
            frappe.call({
                method: 'regenerate_doctype',
                doc: frm.doc,
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert({
                            message: '✅ ' + r.message.message,
                            indicator: 'green'
                        });
                        frm.reload_doc();
                    } else {
                        frappe.show_alert({
                            message: '❌ ' + (r.message?.message || __('Failed to generate DocType')),
                            indicator: 'red'
                        });
                    }
                }
            });
        }
    );
}

function view_table_data(frm) {
    if (frm.doc.doctype_name) {
        const url = `/app/${frm.doc.doctype_name.toLowerCase().replace(/\s+/g, '-')}`;
        window.open(url, '_blank');
    } else {
        frappe.msgprint(__('No DocType available. Please create fields first.'));
    }
}

function activate_table(frm) {
    frappe.call({
        method: 'activate_table_seamless',
        doc: frm.doc,
        callback: (r) => {
            if (r.message && r.message.success) {
                frappe.show_alert({
                    message: r.message.message,
                    indicator: 'green'
                });
                frm.reload_doc();
            } else {
                frappe.show_alert({
                    message: r.message?.error || __('Activation failed'),
                    indicator: 'red'
                });
            }
        }
    });
}