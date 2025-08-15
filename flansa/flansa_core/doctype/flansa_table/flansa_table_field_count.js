// Real-time field count updater for Flansa Table
frappe.ui.form.on('Flansa Table', {
    refresh: function(frm) {
        if (frm.doc.name && !frm.doc.__islocal) {
            // Update field count only - buttons handled by client script
            update_field_count(frm);
        }
    },
    
    onload: function(frm) {
        if (frm.doc.name && !frm.doc.__islocal) {
            update_field_count(frm);
        }
    }
});

function update_field_count(frm) {
    if (!frm.doc.name) return;
    
    frappe.call({
        method: 'flansa.flansa_core.doctype.flansa_table.flansa_table.get_table_fields_safe',
        args: {
            table_name: frm.doc.name
        },
        callback: function(r) {
            if (r.message && !r.message.error) {
                var count = r.message.count || 0;
                
                // Update the field count in the form
                if (frm.doc.field_count !== count) {
                    frappe.model.set_value(frm.doctype, frm.docname, 'field_count', count);
                    frm.refresh_field('field_count');
                    
                    // Show message
                    frappe.show_alert({
                        message: `Field count updated: ${count} fields`,
                        indicator: 'green'
                    });
                }
                
                // Update any field count displays
                frm.dashboard.clear_headline();
                if (count > 0) {
                    frm.dashboard.set_headline(`<span class="indicator green">Ready</span> ${count} fields configured`);
                } else {
                    frm.dashboard.set_headline(`<span class="indicator orange">Setup Required</span> No fields added yet`);
                }
                
            } else if (r.message && r.message.error) {
                console.error('Field count update error:', r.message.error);
            }
        }
    });
}