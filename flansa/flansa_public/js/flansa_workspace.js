frappe.ui.form.on('Flansa Workspace', {
	refresh: function(frm) {
		// Add custom button to enter the workspace
		if (!frm.is_new()) {
			frm.add_custom_button(__('Open Workspace'), function() {
				frappe.set_route('flansa-workspace', frm.doc.name);
			}, __('Actions'));
		}
		
		// Show workspace statistics
		if (!frm.is_new()) {
			frm.add_custom_button(__('View Tables'), function() {
				frappe.set_route('List', 'Flansa Table', {workspace: frm.doc.name});
			});
			
			frm.add_custom_button(__('View Relationships'), function() {
				frappe.set_route('List', 'Flansa Relationship', {workspace: frm.doc.name});
			});
		}
	},
	
	workspace_name: function(frm) {
		// Auto-generate a safe workspace name
		if (frm.doc.workspace_name) {
			const safe_name = frm.doc.workspace_name
				.replace(/[^a-zA-Z0-9\s]/g, '')
				.replace(/\s+/g, '_')
				.substring(0, 30);
			
			if (safe_name !== frm.doc.workspace_name) {
				frm.set_value('workspace_name', safe_name);
			}
		}
	}
});