frappe.ui.form.on('Flansa Table', {
	refresh: function(frm) {
		// Add custom button to open visual builder
		if (!frm.is_new()) {
			frm.add_custom_button(__('Visual Table Builder'), function() {
				frappe.set_route('flansa-table-builder', frm.doc.name);
			}, __('Actions'));
		}
		
		// Add button to preview the generated DocType
		if (!frm.is_new() && frm.doc.doctype_name && frm.doc.status === 'Active') {
			frm.add_custom_button(__('Open Table'), function() {
				frappe.set_route('List', frm.doc.doctype_name);
			}, __('Actions'));
		}
	},
	
	table_name: function(frm) {
		// Auto-generate doctype name
		if (frm.doc.table_name && frm.doc.workspace) {
			frappe.db.get_value('Flansa Workspace', frm.doc.workspace, 'workspace_name', (r) => {
				if (r && r.workspace_name) {
					frm.set_value('doctype_name', `FLS ${r.workspace_name} ${frm.doc.table_name}`);
				}
			});
		}
	},
	
	status: function(frm) {
		if (frm.doc.status === 'Active' && !frm.is_new()) {
			frappe.confirm(
				__('Activating this table will create/update the DocType. Continue?'),
				function() {
					frm.save();
				},
				function() {
					frm.set_value('status', 'Draft');
				}
			);
		}
	}
});