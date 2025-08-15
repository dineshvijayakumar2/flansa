// Copyright (c) 2025, Flansa Team and contributors
// For license information, please see license.txt

frappe.ui.form.on("Flansa Relationship", {
    refresh(frm) {
        // Enhanced relationship form with formula support
        frm.set_intro("");
        
        if (!frm.is_new()) {
            // Add action buttons
            frm.add_custom_button(__('Formula Builder'), function() {
                show_formula_builder_dialog(frm);
            }, __('Tools'));
            
            frm.add_custom_button(__('Test Formula'), function() {
                test_relationship_formula(frm);
            }, __('Tools'));
            
            frm.add_custom_button(__('Generate Reports'), function() {
                generate_relationship_reports(frm);
            }, __('Actions'));
        }
        
        // Show relationship preview
        if (frm.doc.from_table && frm.doc.to_table) {
            show_relationship_preview(frm);
        }
    },
    
    relationship_type(frm) {
        update_relationship_config(frm);
        auto_generate_field_names(frm);
    },
    
    from_table(frm) {
        update_relationship_name(frm);
        auto_generate_field_names(frm);
    },
    
    to_table(frm) {
        update_relationship_name(frm);
        auto_generate_field_names(frm);
    }
});

// Computed Fields Child Table
frappe.ui.form.on("Flansa Computed Field", {
    formula_expression(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        validate_formula_expression(frm, row);
    },
    
    computation_type(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        update_computed_field_ui(frm, row);
    }
});

function show_formula_builder_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: __('Formula Builder'),
        size: 'large',
        fields: [
            {
                fieldname: 'field_name',
                label: __('Field Name'),
                fieldtype: 'Data',
                reqd: 1
            },
            {
                fieldname: 'field_label',
                label: __('Field Label'),
                fieldtype: 'Data',
                reqd: 1
            },
            {
                fieldname: 'formula_type',
                label: __('Formula Type'),
                fieldtype: 'Select',
                options: 'QuickBase Style\nSQL Expression\nPython Expression',
                default: 'QuickBase Style',
                change: function() {
                    update_formula_help(dialog);
                }
            },
            {
                fieldname: 'formula_expression',
                label: __('Formula'),
                fieldtype: 'Code',
                options: 'javascript',
                reqd: 1,
                description: 'Example: SUM([Orders.Amount]) or [Field1] * [Field2]'
            },
            {
                fieldname: 'formula_help',
                label: __('Formula Help'),
                fieldtype: 'HTML'
            }
        ],
        primary_action_label: __('Add Formula Field'),
        primary_action(values) {
            add_formula_field_to_relationship(frm, values, dialog);
        }
    });
    
    dialog.show();
    update_formula_help(dialog);
}

function update_formula_help(dialog) {
    const formula_type = dialog.get_value('formula_type');
    let help_html = '';
    
    if (formula_type === 'QuickBase Style') {
        help_html = `
            <div class="formula-help">
                <h6>QuickBase Formula Syntax:</h6>
                <ul>
                    <li><code>[Field_Name]</code> - Current record field</li>
                    <li><code>[Parent.Field_Name]</code> - Parent record field</li>
                    <li><code>SUM([Child.Amount])</code> - Sum of child values</li>
                    <li><code>AVG([Child.Quantity])</code> - Average of child values</li>
                    <li><code>COUNT([Child.Name])</code> - Count of child records</li>
                    <li><code>IF(condition, true_value, false_value)</code> - Conditional</li>
                </ul>
                <h6>Examples:</h6>
                <ul>
                    <li><code>[Unit_Price] * [Quantity]</code></li>
                    <li><code>SUM([Order_Items.Total])</code></li>
                    <li><code>IF([Status] == "Active", 1, 0)</code></li>
                </ul>
            </div>
        `;
    }
    
    dialog.set_value('formula_help', help_html);
}

function add_formula_field_to_relationship(frm, values, dialog) {
    // Validate formula first
    frappe.call({
        method: 'flansa.utils.formula_engine.validate_quickbase_formula',
        args: {
            formula: values.formula_expression,
            doctype: frm.doc.to_table || frm.doc.from_table
        },
        callback: function(r) {
            if (r.message && r.message.valid) {
                // Add computed field
                const child = frm.add_child('computed_fields', {
                    field_name: values.field_name,
                    field_label: values.field_label,
                    computation_type: 'Formula',
                    formula_expression: values.formula_expression,
                    auto_add: 1
                });
                frm.refresh_field('computed_fields');
                dialog.hide();
                frappe.show_alert({
                    message: __('Formula field added'),
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: __('Formula Error'),
                    message: r.message ? r.message.message : 'Formula validation failed',
                    indicator: 'red'
                });
            }
        }
    });
}

function test_relationship_formula(frm) {
    if (!frm.doc.computed_fields || frm.doc.computed_fields.length === 0) {
        frappe.msgprint(__('No computed fields to test'));
        return;
    }
    
    const formulas = frm.doc.computed_fields.map(cf => ({
        name: cf.field_name,
        label: cf.field_label,
        formula: cf.formula_expression
    }));
    
    const dialog = new frappe.ui.Dialog({
        title: __('Test Formula'),
        fields: [
            {
                fieldname: 'test_record',
                label: __('Test Record'),
                fieldtype: 'Data',
                description: __('Enter a record name to test formulas against')
            },
            {
                fieldname: 'formula_to_test',
                label: __('Formula to Test'),
                fieldtype: 'Select',
                options: formulas.map(f => f.name).join('\n'),
                reqd: 1
            }
        ],
        primary_action_label: __('Test'),
        primary_action(values) {
            const selected_formula = formulas.find(f => f.name === values.formula_to_test);
            if (selected_formula) {
                test_formula_execution(frm, selected_formula, values.test_record, dialog);
            }
        }
    });
    
    dialog.show();
}

function test_formula_execution(frm, formula_config, test_record, dialog) {
    frappe.call({
        method: 'flansa.utils.formula_engine.evaluate_quickbase_formula_api',
        args: {
            formula: formula_config.formula,
            doctype: frm.doc.to_table || frm.doc.from_table,
            doc_name: test_record
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.msgprint({
                    title: __('Formula Test Result'),
                    message: `
                        <p><strong>Formula:</strong> ${formula_config.label}</p>
                        <p><strong>Expression:</strong> <code>${formula_config.formula}</code></p>
                        <p><strong>Result:</strong> <span class="text-success h5">${r.message.result}</span></p>
                    `,
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: __('Formula Test Failed'),
                    message: `Error: ${r.message ? r.message.error : 'Unknown error'}`,
                    indicator: 'red'
                });
            }
            dialog.hide();
        }
    });
}

function show_relationship_preview(frm) {
    const preview_html = `
        <div class="relationship-preview" style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
            <h6><i class="fa fa-link"></i> Relationship Overview</h6>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
                <div class="table-box" style="padding: 10px; background: white; border-radius: 5px; border: 2px solid #007bff; flex: 1;">
                    <strong>${frm.doc.from_table}</strong>
                    <br><small class="text-muted">${frm.doc.from_field || 'Auto-generated field'}</small>
                </div>
                <div style="padding: 0 20px; font-size: 18px;">
                    ${get_relationship_arrow(frm.doc.relationship_type)}
                </div>
                <div class="table-box" style="padding: 10px; background: white; border-radius: 5px; border: 2px solid #28a745; flex: 1;">
                    <strong>${frm.doc.to_table}</strong>
                    <br><small class="text-muted">${frm.doc.to_field || 'Auto-generated field'}</small>
                </div>
            </div>
            <div style="text-align: center; margin-top: 10px;">
                <span class="badge badge-info">${frm.doc.relationship_type}</span>
                ${frm.doc.enterprise_type ? `<span class="badge badge-secondary">${frm.doc.enterprise_type}</span>` : ''}
            </div>
        </div>
    `;
    
    // Add to form
    if (!frm.fields_dict.relationship_preview_html) {
        frm.set_df_property('relationship_type', 'description', preview_html);
    }
}

function get_relationship_arrow(type) {
    const arrows = {
        'One to Many': '→',
        'Many to One': '←',
        'One to One': '↔',
        'Many to Many': '⇄',
        'Self Referential': '↻'
    };
    return arrows[type] || '→';
}

function update_relationship_config(frm) {
    // Auto-configure based on relationship type
    const config = get_relationship_config(frm.doc.relationship_type);
    if (config) {
        Object.keys(config).forEach(key => {
            if (config[key] !== undefined && !frm.doc[key]) {
                frm.set_value(key, config[key]);
            }
        });
    }
}

function get_relationship_config(type) {
    const configs = {
        'Master-Detail': {
            cascade_delete: 1,
            inherit_permissions: 1,
            required_field: 1
        },
        'Lookup': {
            cascade_delete: 0,
            inherit_permissions: 0,
            required_field: 0
        },
        'Summary': {
            cascade_delete: 0,
            inherit_permissions: 0,
            required_field: 1
        }
    };
    return configs[type];
}

function auto_generate_field_names(frm) {
    if (!frm.doc.from_table || !frm.doc.to_table) return;
    
    frappe.call({
        method: 'flansa.flansa_core.api.improved_relationship_api.auto_generate_field_names',
        args: {
            from_table: frm.doc.from_table,
            to_table: frm.doc.to_table,
            relationship_type: frm.doc.relationship_type
        },
        callback: function(r) {
            if (r.message) {
                if (!frm.doc.from_field && r.message.from_field) {
                    frm.set_value('from_field', r.message.from_field);
                }
                if (!frm.doc.to_field && r.message.to_field) {
                    frm.set_value('to_field', r.message.to_field);
                }
            }
        }
    });
}

function update_relationship_name(frm) {
    if (!frm.doc.from_table || !frm.doc.to_table) return;
    
    if (!frm.doc.relationship_name) {
        frappe.db.get_value('Flansa Table', frm.doc.from_table, 'table_label', (r1) => {
            frappe.db.get_value('Flansa Table', frm.doc.to_table, 'table_label', (r2) => {
                const from_label = r1.table_label || frm.doc.from_table;
                const to_label = r2.table_label || frm.doc.to_table;
                frm.set_value('relationship_name', `${from_label} → ${to_label}`);
            });
        });
    }
}

function validate_formula_expression(frm, row) {
    if (!row.formula_expression) return;
    
    frappe.call({
        method: 'flansa.utils.formula_engine.validate_quickbase_formula',
        args: {
            formula: row.formula_expression,
            doctype: frm.doc.to_table || frm.doc.from_table
        },
        callback: function(r) {
            if (r.message && !r.message.valid) {
                frappe.show_alert({
                    message: `Formula Error: ${r.message.message}`,
                    indicator: 'red'
                });
            } else if (r.message && r.message.valid) {
                frappe.show_alert({
                    message: 'Formula is valid',
                    indicator: 'green'
                });
            }
        }
    });
}

function update_computed_field_ui(frm, row) {
    // Update UI based on computation type
    if (row.computation_type === 'Formula') {
        // Show formula expression field
        frm.refresh_field('computed_fields');
    }
}

function generate_relationship_reports(frm) {
    frappe.prompt([
        {
            fieldname: 'report_type',
            label: __('Report Type'),
            fieldtype: 'Select',
            options: [
                'Summary Report',
                'Detail Report', 
                'Formula Analysis',
                'Data Quality Report'
            ],
            default: 'Summary Report',
            reqd: 1
        }
    ], function(values) {
        frappe.show_alert({
            message: `Generating ${values.report_type}...`,
            indicator: 'blue'
        });
        // Implementation for report generation
    }, __('Generate Report'), __('Generate'));
}
