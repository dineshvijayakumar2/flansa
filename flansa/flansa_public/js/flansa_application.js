frappe.ui.form.on('Flansa Application', {
	refresh: function(frm) {
		// Add custom buttons
		if (!frm.is_new()) {
			// Open Application Dashboard
			frm.add_custom_button(__('Open Dashboard'), function() {
				frappe.set_route('flansa-app-dashboard', frm.doc.name);
			}, __('Actions'));
			
			// Export Schema
			frm.add_custom_button(__('Export YAML Schema'), function() {
				export_schema(frm, 'yaml');
			}, __('Schema'));
			
			frm.add_custom_button(__('Export JSON Schema'), function() {
				export_schema(frm, 'json');
			}, __('Schema'));
			
			// Import Schema
			frm.add_custom_button(__('Import Schema'), function() {
				show_import_dialog(frm);
			}, __('Schema'));
			
			// Application Stats
			show_application_stats(frm);
		}
		
		// Show application builder link for new apps
		if (frm.is_new()) {
			frm.add_custom_button(__('Use App Builder'), function() {
				frappe.set_route('flansa-app-builder');
			});
		}
	}
});

function export_schema(frm, format_type) {
	frappe.call({
		method: 'flansa_platform.api.application.export_application_schema',
		args: {
			app_name: frm.doc.name,
			format_type: format_type
		},
		callback: function(r) {
			if (r.message) {
				// Create download
				const filename = `${frm.doc.app_name}_schema.${format_type}`;
				download_file(r.message, filename);
			}
		}
	});
}

function download_file(content, filename) {
	const element = document.createElement('a');
	const file = new Blob([content], {type: 'text/plain'});
	element.href = URL.createObjectURL(file);
	element.download = filename;
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

function show_import_dialog(frm) {
	const dialog = new frappe.ui.Dialog({
		title: __('Import Application Schema'),
		fields: [
			{
				fieldname: 'format_type',
				label: __('Format'),
				fieldtype: 'Select',
				options: 'yaml\njson',
				default: 'yaml',
				reqd: 1
			},
			{
				fieldname: 'schema_content',
				label: __('Schema Content'),
				fieldtype: 'Code',
				options: 'YAML',
				reqd: 1
			},
			{
				fieldname: 'file_upload',
				label: __('Or Upload File'),
				fieldtype: 'Attach',
				description: __('Upload .yaml or .json schema file')
			}
		],
		primary_action_label: __('Import'),
		primary_action: function(values) {
			if (values.file_upload) {
				// Handle file upload
				frappe.call({
					method: 'frappe.client.get_value',
					args: {
						doctype: 'File',
						filters: {file_url: values.file_upload},
						fieldname: 'content'
					},
					callback: function(r) {
						if (r.message && r.message.content) {
							import_schema(r.message.content, values.format_type);
						}
					}
				});
			} else {
				import_schema(values.schema_content, values.format_type);
			}
			dialog.hide();
		}
	});
	
	dialog.show();
}

function import_schema(schema_content, format_type) {
	frappe.call({
		method: 'flansa_platform.api.application.import_application_schema',
		args: {
			schema_content: schema_content,
			format_type: format_type
		},
		callback: function(r) {
			if (r.message) {
				frappe.show_alert({
					message: __('Application imported successfully'),
					indicator: 'green'
				});
				
				setTimeout(() => {
					frappe.set_route('Form', 'Flansa Application', r.message.name);
				}, 1000);
			}
		}
	});
}

function show_application_stats(frm) {
	// Add a custom section for application statistics
	if (!frm.dashboard) {
		frm.dashboard = new frappe.ui.Dashboard({
			parent: frm.dashboard_wrapper
		});
	}
	
	frm.dashboard.reset();
	
	frappe.call({
		method: 'flansa_platform.flansa_platform.doctype.flansa_application.flansa_application.get_application_context',
		args: {
			name: frm.doc.name
		},
		callback: function(r) {
			if (r.message) {
				const stats = r.message.statistics;
				
				frm.dashboard.add_section(
					frappe.render_template('flansa_app_stats', {
						stats: stats,
						workspaces: r.message.workspaces
					})
				);
			}
		}
	});
}