/**
 * Flansa Form Builder - Custom Form Designer
 * Replaces traditional DocType form editing with visual no-code interface
 */

frappe.pages['flansa-form-builder'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Form Builder',
        single_column: true
    });
    
    // Add standardized Back button
    setTimeout(() => {
        if (window.FlansaNav && typeof window.FlansaNav.addBackButton === 'function') {
            window.FlansaNav.addBackButton(page);
        } else {
            // Fallback: Add back button directly
            page.add_button('← Back', () => {
                window.history.back();
            }, 'btn-default');
        }
    }, 100);
    
    // Setup Flansa navigation using navigation manager
    if (window.FlansaNavigationManager) {
        setTimeout(() => {
            window.FlansaNavigationManager.setupPageNavigation(page, 'flansa-form-builder');
        }, 150);
    }
    
    // Initialize custom Flansa form builder
    new FlansaFormBuilder(page);
};

class FlansaFormBuilder {
    constructor(page) {
        this.page = page;
        this.wrapper = page.wrapper;
        this.$container = $(this.wrapper).find('.layout-main-section');
        
        // Get table parameter from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        this.table_name = urlParams.get('table') || null;
        this.mode = urlParams.get('mode') || 'design'; // design, preview, settings
        
        this.form_config = {};
        this.current_fields = [];
        this.selected_field_index = -1;
        this._adding_field = false; // Track field addition to prevent duplicates
        
        this.init();
    }
    
    
    // Debounce utility to prevent rapid successive additions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
        init() {
        // Store global reference for drop handlers
        window.form_builder_instance = this;
        
        // Load the HTML template content
        this.setup_template();
        
        if (!this.table_name) {
            this.show_table_selector();
            return;
        }
        
        this.setup_events();
        this.load_table_data();
        this.apply_theme();
    }
    
    setup_template() {
        try {
            // Load the HTML template using frappe's template system
            const template_content = frappe.render_template('flansa_form_builder');
            this.$container.html(template_content);
            
            // Enhance the back button with smart navigation
            this.setup_smart_back_button();
            
        } catch (error) {
            console.error('Error loading form builder template:', error);
            // Fallback to basic template
            this.$container.html(`
                <div class="flansa-form-builder-page" style="background: #f8f9fa; min-height: 100vh; padding: 20px;">
                    <div style="text-align: center; padding: 60px 20px;">
                        <h3>Form Builder</h3>
                        <p>Loading form builder interface...</p>
                    </div>
                </div>
            `);
        }
    }
    
    setup_smart_back_button() {
        // Make the back button use smart navigation
        this.$container.find('#back-to-tables-btn').off('click').on('click', () => {
            this.handleSmartBackNavigation();
        });
    }
    
    handleSmartBackNavigation() {
        // Smart back button logic
        if (window.history.length > 1 && document.referrer) {
            const referrer = new URL(document.referrer);
            if (referrer.pathname.includes('/app/flansa-')) {
                window.history.back();
                return;
            }
        }
        
        // Fallback to logical parent
        const route = frappe.get_route();
        const app_id = route[1] || new URLSearchParams(window.location.search).get('app');
        
        if (app_id) {
            window.location.href = `/app/flansa-app-dashboard/${app_id}`;
        } else {
            window.location.href = '/app/flansa-workspace';
        }
    }
    
    setup_fields_palette() {
        // Create a more functional palette showing actual DocType fields and tools
        let palette_html = `
            <div class="palette-section" style="margin-bottom: 20px;">
                <h6 style="margin-bottom: 12px; color: var(--flansa-text-primary, #495057); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa fa-plus"></i> Add New Field
                </h6>
                <button class="btn btn-primary btn-sm add-new-field-btn" style="width: 100%; margin-bottom: 16px;">
                    <i class="fa fa-plus"></i> Add Field to Table
                </button>
            </div>
            
            <div class="palette-section" style="margin-bottom: 20px;">
                <h6 style="margin-bottom: 12px; color: var(--flansa-text-primary, #495057); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa fa-info-circle"></i> Layout Tools
                </h6>
                <div style="padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e0e6ed;">
                    <p style="margin: 0; font-size: 12px; color: #6c757d; line-height: 1.4;">
                        Use the <strong>Section</strong> and <strong>Column</strong> buttons in the form header above to organize your fields.
                    </p>
                </div>
            </div>
            
            <div class="palette-section">
                <h6 style="margin-bottom: 12px; color: var(--flansa-text-primary, #495057); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fa fa-list"></i> Available Fields
                </h6>
                <div id="available-fields-list" style="max-height: 300px; overflow-y: auto;">
                    <div style="text-align: center; padding: 20px; color: var(--flansa-text-secondary, #6c757d);">
                        <i class="fa fa-spinner fa-spin" style="margin-bottom: 8px;"></i>
                        <div>Loading fields...</div>
                    </div>
                </div>
            </div>
        `;

        $('#fields-palette-content').html(palette_html);
        
        // Load available fields from the table
        this.load_available_fields();
    }

    load_available_fields() {
        if (!this.table_fields || this.table_fields.length === 0) {
            $('#available-fields-list').html(`
                <div style="text-align: center; padding: 20px; color: var(--flansa-text-secondary, #6c757d);">
                    <i class="fa fa-info-circle" style="margin-bottom: 8px;"></i>
                    <div>No fields available</div>
                </div>
            `);
            return;
        }

        // Filter out fields that are already in the form
        const fieldsInForm = this.current_fields
            .filter(f => f.field_type !== 'Section Break' && f.field_type !== 'Column Break')
            .map(f => f.field_name);

        const availableFields = this.table_fields.filter(field => 
            !fieldsInForm.includes(field.field_name)
        );

        let fields_html = '';
        
        if (availableFields.length === 0) {
            fields_html = `
                <div style="text-align: center; padding: 20px; color: var(--flansa-text-secondary, #6c757d);">
                    <i class="fa fa-check-circle" style="margin-bottom: 8px; color: #28a745;"></i>
                    <div>All fields are used</div>
                </div>
            `;
        } else {
            availableFields.forEach(field => {
                const icon = this.get_field_icon(field.field_type);
                fields_html += `
                    <div class="field-item available-field" data-field-name="${field.field_name}" draggable="true"
                         style="border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 6px; padding: 10px; margin-bottom: 6px; cursor: move; background: white; transition: all 0.2s ease;"
                         onmouseover="this.style.borderColor='var(--flansa-success, #28a745)'; this.style.backgroundColor='var(--flansa-background, #f8f9fa)';"
                         onmouseout="this.style.borderColor='var(--flansa-border, #e0e6ed)'; this.style.backgroundColor='white';">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center;">
                                <i class="${icon}" style="margin-right: 8px; color: var(--flansa-success, #28a745); width: 16px;"></i>
                                <div>
                                    <div style="font-weight: 600; color: var(--flansa-text-primary, #495057); font-size: 13px;">${field.field_label}</div>
                                    <div style="font-size: 11px; color: var(--flansa-text-secondary, #6c757d);">${field.field_type}</div>
                                </div>
                            </div>
                            <i class="fa fa-arrows-alt" style="color: var(--flansa-text-secondary, #6c757d); font-size: 14px;"></i>
                        </div>
                    </div>
                `;
            });
        }

        $('#available-fields-list').html(fields_html);
    }

    get_field_icon(field_type) {
        const icons = {
            'Data': 'fa fa-font',
            'Text': 'fa fa-align-left', 
            'Long Text': 'fa fa-align-left',
            'Int': 'fa fa-hashtag',
            'Float': 'fa fa-calculator',
            'Currency': 'fa fa-dollar-sign',
            'Date': 'fa fa-calendar',
            'Datetime': 'fa fa-clock',
            'Check': 'fa fa-check-square',
            'Select': 'fa fa-list',
            'Link': 'fa fa-link',
            'Attach': 'fa fa-paperclip',
            'Attach Image': 'fa fa-image'
        };
        return icons[field_type] || 'fa fa-question-circle';
    }

    open_table_builder_add_field() {
        // Navigate to table builder with the current table for adding fields
        frappe.msgprint({
            title: 'Add New Field',
            message: `
                <p>To add new fields to this table, you'll be redirected to the Table Builder.</p>
                <p><strong>Table:</strong> ${this.table_name}</p>
                <p>After adding fields, return here to organize your form layout.</p>
            `,
            primary_action: {
                label: 'Open Table Builder',
                action: () => {
                    // Navigate to table builder for this specific table
                    window.open(`/app/flansa-visual-builder?table=${this.table_name}`, '_blank');
                }
            }
        });
    }

    add_existing_field_to_form(fieldName) {
        // Prevent duplicate additions
        if (this._adding_field) {
            console.log('Field addition already in progress, skipping duplicate');
            return;
        }
        
        this._adding_field = true;
        
        // Check if field already exists
        const fieldExists = this.current_fields.some(field => 
            field.field_name === fieldName && !field.is_layout_element
        );
        
        if (fieldExists) {
            frappe.show_alert({
                message: `Field "${fieldName}" is already in the form`,
                indicator: 'orange'
            });
            this._adding_field = false;
            return;
        }
        
        // Find the field in table_fields
        const field = this.table_fields.find(f => f.field_name === fieldName);
        if (!field) {
            frappe.show_alert('Field not found', 'red');
            this._adding_field = false;
            return;
        }

        // Add the field to current_fields
        this.current_fields.push(field);

        // Re-render the form canvas
        this.render_form_canvas();

        // Update available fields list
        this.load_available_fields();

        frappe.show_alert({
            message: `"${field.field_label}" added to form`,
            indicator: 'green'
        });
        
        // Reset the flag after a short delay
        setTimeout(() => {
            this._adding_field = false;
        }, 500);
    }

    generate_auto_field_name(fieldType) {
        // Generate automatic field names for section and column breaks
        const timestamp = Date.now();
        const prefix = fieldType === 'Section Break' ? 'section_break' : 'column_break';
        return `${prefix}_${timestamp}`;
    }

    add_layout_item_to_canvas(fieldType) {
        // Handle Section Break and Column Break as pure layout elements
        $('#empty-canvas-message').hide();
        
        const layout_element = {
            layout_type: fieldType,
            layout_id: this.generate_auto_field_name(fieldType),
            label: fieldType === 'Section Break' ? 'New Section' : '',
            is_layout_element: true,  // Mark as layout-only, not a DocType field
            order: this.current_fields.length
        };

        this.current_fields.push(layout_element);
        this.render_form_canvas();

        frappe.show_alert({
            message: `Added ${fieldType} (layout only)`,
            indicator: 'green'
        });
    }
    
    setup_canvas() {
        // Make canvas droppable
        const canvas = document.getElementById('form-canvas-content');
        
        if (canvas) {
            canvas.addEventListener('dragover', (e) => {
                e.preventDefault();
                canvas.classList.add('drag-over');
            });
            
            canvas.addEventListener('dragleave', (e) => {
                if (!canvas.contains(e.relatedTarget)) {
                    canvas.classList.remove('drag-over');
                }
            });
            
            canvas.addEventListener('drop', (e) => {
                e.preventDefault();
                canvas.classList.remove('drag-over');
                
                const itemData = e.dataTransfer.getData('text/plain');
                const itemType = e.dataTransfer.getData('item-type');
                
                if (itemType === 'field') {
                    // Handle existing field from available fields
                    this.add_existing_field_to_form(itemData);
                } else if (itemType === 'form-field') {
                    // Handle moving existing form fields
                    const fieldIndex = parseInt(e.dataTransfer.getData('field-index'));
                    this.move_field_to_end(fieldIndex);
                } else {
                    // Fallback for old behavior
                    this.add_field_to_canvas(itemData, e.clientX, e.clientY);
                }
            });
        }
        
        // Setup drag handlers for layout items and available fields
        $(document).on('dragstart', '.field-item', function(e) {
            const $item = $(this);
            
            if ($item.hasClass('available-field')) {
                // Available existing fields
                const fieldName = $item.data('field-name');
                e.originalEvent.dataTransfer.setData('text/plain', fieldName);
                e.originalEvent.dataTransfer.setData('item-type', 'field');
            }
            
            $item.addClass('dragging');
        });
        
        // Setup drag handlers for form fields (for cross-section movement)
        $(document).on('dragstart', '.form-field', function(e) {
            const $field = $(this);
            const fieldIndex = $field.data('field-index');
            const fieldName = $field.data('field-name');
            
            e.originalEvent.dataTransfer.setData('text/plain', fieldName);
            e.originalEvent.dataTransfer.setData('item-type', 'form-field');
            e.originalEvent.dataTransfer.setData('field-index', fieldIndex.toString());
            
            $field.addClass('dragging');
        });
        
        $(document).on('dragend', '.field-item, .form-field', function() {
            $(this).removeClass('dragging');
        });
        
        // Setup section drop zones for cross-section drag and drop
        this.setup_section_drop_zones();
    }
    
    setup_section_drop_zones() {
        // Make individual sections droppable for cross-section field movement
        $(document).on('dragover', '.section-content, .droppable-section', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).addClass('drag-over');
            $(this).css({
                'border-color': 'var(--flansa-primary, #007bff)',
                'background-color': 'rgba(0, 123, 255, 0.05)'
            });
            
            // Hide placeholder during drag
            $(this).find('.empty-section-placeholder').hide();
        });
        
        $(document).on('dragleave', '.section-content, .droppable-section', function(e) {
            if (!$(this)[0].contains(e.relatedTarget)) {
                $(this).removeClass('drag-over');
                $(this).css({
                    'border-color': 'transparent',
                    'background-color': ''
                });
                
                // Show placeholder if section is empty
                if ($(this).find('.form-field').length === 0) {
                    $(this).find('.empty-section-placeholder').show();
                }
            }
        });
        
        $(document).on('drop', '.section-content, .droppable-section', function(e) {
            // Prevent duplicate drops
            e.preventDefault();
            e.stopPropagation();
            
            if ($(this).hasClass('drop-processing')) {
                return; // Already processing a drop
            }
            $(this).addClass('drop-processing');
            
            setTimeout(() => {
                $(this).removeClass('drop-processing');
            }, 1000);

            e.preventDefault();
            e.stopPropagation();
            $(this).removeClass('drag-over');
            $(this).css({
                'border-color': 'transparent',
                'background-color': ''
            });
            
            const itemType = e.originalEvent.dataTransfer.getData('item-type');
            const itemData = e.originalEvent.dataTransfer.getData('text/plain');
            
            if (itemType === 'form-field') {
                const fieldIndex = parseInt(e.originalEvent.dataTransfer.getData('field-index'));
                const $section = $(this).closest('.form-section');
                const sectionFieldIndex = parseInt($section.data('field-index'));
                
                // Get form builder instance
                const formBuilder = window.form_builder_instance || 
                    (window.page_instance && window.page_instance.form_builder);
                
                if (formBuilder) {
                    formBuilder.move_field_to_section_by_index(fieldIndex, sectionFieldIndex);
                }
            } else if (itemType === 'field') {
                // Handle adding field from palette to specific section
                const $section = $(this).closest('.form-section');
                const sectionFieldIndex = parseInt($section.data('field-index'));
                
                const formBuilder = window.form_builder_instance || 
                    (window.page_instance && window.page_instance.form_builder);
                
                if (formBuilder) {
                    formBuilder.add_field_to_section_by_index(itemData, sectionFieldIndex);
                }
            }
        });
    }
    
    move_field_to_end(fieldIndex) {
        // Move field to the end of the form
        if (fieldIndex < 0 || fieldIndex >= this.current_fields.length) return;
        
        const field = this.current_fields.splice(fieldIndex, 1)[0];
        this.current_fields.push(field);
        
        this.render_form_canvas();
        
        frappe.show_alert({
            message: `Moved "${field.field_label}" to end of form`,
            indicator: 'blue'
        });
    }
    
    move_field_to_section(fieldIndex, targetSectionIndex) {
        // Move field to a specific section
        if (fieldIndex < 0 || fieldIndex >= this.current_fields.length) return;
        
        const field = this.current_fields.splice(fieldIndex, 1)[0];
        
        // Find the target section
        let sectionCount = 0;
        let insertIndex = this.current_fields.length;
        
        for (let i = 0; i < this.current_fields.length; i++) {
            if (this.current_fields[i].is_layout_element && 
                this.current_fields[i].layout_type === 'Section Break') {
                if (sectionCount === targetSectionIndex) {
                    insertIndex = i + 1;
                    break;
                }
                sectionCount++;
            }
        }
        
        this.current_fields.splice(insertIndex, 0, field);
        this.render_form_canvas();
        
        frappe.show_alert({
            message: `Moved "${field.field_label}" to section ${targetSectionIndex + 1}`,
            indicator: 'green'
        });
    }
    
    add_field_to_section(fieldName, targetSectionIndex) {
        // Add field from palette to specific section
        const field = this.table_fields.find(f => f.field_name === fieldName);
        if (!field) return;
        
        // Find the target section
        let sectionCount = 0;
        let insertIndex = this.current_fields.length;
        
        for (let i = 0; i < this.current_fields.length; i++) {
            if (this.current_fields[i].is_layout_element && 
                this.current_fields[i].layout_type === 'Section Break') {
                if (sectionCount === targetSectionIndex) {
                    insertIndex = i + 1;
                    break;
                }
                sectionCount++;
            }
        }
        
        this.current_fields.splice(insertIndex, 0, field);
        this.render_form_canvas();
        this.load_available_fields();
        
        frappe.show_alert({
            message: `Added "${field.field_label}" to section ${targetSectionIndex + 1}`,
            indicator: 'green'
        });
    }
    
    move_field_to_section_by_index(fieldIndex, sectionFieldIndex) {
        // Move field to the section identified by the section field's index
        if (fieldIndex < 0 || fieldIndex >= this.current_fields.length) return;
        
        const field = this.current_fields.splice(fieldIndex, 1)[0];
        
        // Find where to insert after the section
        let insertIndex = sectionFieldIndex + 1;
        
        // Make sure we don't go past the end
        if (insertIndex > this.current_fields.length) {
            insertIndex = this.current_fields.length;
        }
        
        this.current_fields.splice(insertIndex, 0, field);
        this.render_form_canvas();
        
        const sectionField = this.current_fields[sectionFieldIndex];
        const sectionName = sectionField?.field_label || 'Section';
        
        frappe.show_alert({
            message: `Moved "${field.field_label}" to "${sectionName}"`,
            indicator: 'green'
        });
    }
    
    add_field_to_section_by_index(fieldName, sectionFieldIndex) {
        // Skip if another field addition is in progress
        if (this._adding_field) {
            console.log('Field addition already in progress, skipping section-specific addition');
            return;
        }
        
        // Check if field already exists in this section or form
        const fieldExists = this.current_fields.some(field => 
            field.field_name === fieldName && !field.is_layout_element
        );
        
        if (fieldExists) {
            frappe.show_alert({
                message: `Field "${fieldName}" is already in the form`,
                indicator: 'orange'
            });
            return;
        }

        // Add field from palette to specific section by section field index
        const field = this.table_fields.find(f => f.field_name === fieldName);
        if (!field) return;
        
        // Insert right after the section header
        let insertIndex = sectionFieldIndex + 1;
        
        // Make sure we don't go past the end
        if (insertIndex > this.current_fields.length) {
            insertIndex = this.current_fields.length;
        }
        
        this.current_fields.splice(insertIndex, 0, field);
        this.render_form_canvas();
        this.load_available_fields();
        
        const sectionField = this.current_fields[sectionFieldIndex];
        const sectionName = sectionField?.field_label || 'Section';
        
        frappe.show_alert({
            message: `"${field.field_label}" added to "${sectionName}"`,
            indicator: 'green'
        });
    }
    
    setup_events() {
        const self = this;
        
        // Initialize components
        this.setup_fields_palette();
        this.setup_canvas();
        
        // Back button
        $(document).on('click', '#back-to-tables-btn', function() {
            frappe.set_route('flansa-workspace');
        });
        
        // Mode switching
        $(document).on('click', '.mode-btn', function() {
            const mode = $(this).data('mode');
            self.switch_mode(mode);
        });
        
        // Save form
        $(document).on('click', '#save-form-btn', function() {
            self.save_form_config();
        });
        
        // Reset form
        $(document).on('click', '#reset-form-btn', function() {
            self.reset_form();
        });
        
        // Smart organize fields
        $(document).on('click', '#smart-organize-btn', function() {
            self.smart_organize_fields();
        });
        
        // Column layout change
        $(document).on('change', '#column-layout-select', function() {
            const layout = $(this).val();
            if (layout === 'auto') {
                $('#smart-layout-options').show();
            } else {
                $('#smart-layout-options').hide();
            }
            self.apply_column_layout(layout);
        });
        
        // Add new field button
        $(document).on('click', '.add-new-field-btn', function() {
            self.open_table_builder_add_field();
        });
        
        // Click on available field to add to form
        $(document).on('click', '.available-field', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const fieldName = $(this).data('field-name');
            self.add_existing_field_to_form(fieldName);
        });
        
        // Context menu
        $(document).on('click', '#context-menu-btn', function(e) {
            e.stopPropagation();
            $('#context-menu').toggle();
        });
        
        $(document).on('click', function() {
            $('#context-menu').hide();
        });
        
        // Context menu actions
        $(document).on('click', '.context-menu-item', function() {
            const action = $(this).data('action');
            $('#context-menu').hide();
            
            switch(action) {
                case 'theme':
                    self.show_theme_dialog();
                    break;
                case 'preview':
                    self.switch_mode('preview');
                    break;
                case 'save':
                    self.save_form_config();
                    break;
                case 'help':
                    self.show_help_dialog();
                    break;
            }
        });
        
        // Canvas tools
        $(document).on('click', '#refresh-fields-btn', function() {
            self.refresh_table_fields();
        });
        
        $(document).on('click', '#add-section-btn', function() {
            self.add_section();
        });
        
        // Visual Column Layout Handlers
        $(document).on('click', '#set-1-column', function(e) {
            e.preventDefault();
            self.set_section_columns(1);
        });
        
        $(document).on('click', '#set-2-columns', function(e) {
            e.preventDefault();
            self.set_section_columns(2);
        });
        
        $(document).on('click', '#set-3-columns', function(e) {
            e.preventDefault();
            self.set_section_columns(3);
        });
        
        $(document).on('click', '#custom-columns', function(e) {
            e.preventDefault();
            self.show_custom_column_dialog();
        });
        
        $(document).on('click', '#clear-canvas-btn', function() {
            self.clear_canvas();
        });
        
        // Table selector and error buttons
        $(document).on('click', '#back-to-workspace-btn', function() {
            window.location.href = '/app/flansa-workspace';
        });
        
        $(document).on('click', '#retry-btn', function() {
            window.location.reload();
        });
    }
    
    load_table_data() {
        frappe.call({
            method: 'flansa.flansa_core.api.form_builder.get_table_form_config',
            args: { table_name: this.table_name },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.form_config = r.message.form_config || {};
                    
                    // Check if we have saved form sections, otherwise use raw table fields
                    if (this.form_config.sections && this.form_config.sections.length > 0) {
                        console.log('📋 Loading saved form sections:', this.form_config.sections);
                        
                        // Validate saved fields - remove any that no longer exist in table
                        const validFieldNames = (r.message.fields || []).map(f => f.field_name);
                        const validatedSections = this.form_config.sections.filter(field => {
                            // Keep layout elements
                            if (field.is_layout_element) {
                                return true;
                            }
                            // Keep only fields that still exist in the table
                            return validFieldNames.includes(field.field_name);
                        });
                        
                        // Check if any fields were removed during validation
                        const removedFields = this.form_config.sections.filter(field => 
                            !field.is_layout_element && !validFieldNames.includes(field.field_name)
                        );
                        
                        if (removedFields.length > 0) {
                            console.log('🚨 Removed invalid fields from saved form:', removedFields.map(f => f.field_name));
                            frappe.show_alert({
                                message: `Auto-removed ${removedFields.length} deleted field(s): ${removedFields.map(f => f.field_name).join(', ')}`,
                                indicator: 'orange'
                            });
                        }
                        
                        this.current_fields = validatedSections;
                    } else {
                        console.log('📋 Loading raw table fields (no saved sections):', r.message.fields);
                        this.current_fields = r.message.fields || [];
                    }
                    
                    // Store raw fields for reference
                    this.table_fields = r.message.fields || [];
                    
                    // Update header with table name using the new header manager
                    const table_display_name = r.message.table_label || r.message.table_name || this.table_name;
                    if (window.FlansaHeaderManager) {
                        window.FlansaHeaderManager.updateTitle(`📝 ${table_display_name} Forms`);
                    }
                    
                    this.render_form_canvas();
                    
                    // Load saved form settings into UI controls
                    this.load_form_settings();
                    
                    // Update available fields list
                    this.load_available_fields();
                } else {
                    const error_msg = r.message?.error || 'Error loading table data';
                    frappe.msgprint(error_msg);
                    console.error('Form Builder Error:', error_msg);
                }
            }
        });
    }
    
    add_field_to_canvas(fieldType) {
        // Remove empty canvas state
        $('#empty-canvas-message').hide();
        
        // Create field configuration dialog
        this.show_field_config_dialog(fieldType, (field_config) => {
            this.current_fields.push(field_config);
            this.render_form_canvas();
        });
    }
    
    show_field_config_dialog(fieldType, callback) {
        const dialog = new frappe.ui.Dialog({
            title: `Add ${fieldType} Field`,
            fields: [
                {
                    label: 'Field Name',
                    fieldname: 'field_name',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Technical name for the field (no spaces)'
                },
                {
                    label: 'Field Label',
                    fieldname: 'field_label',
                    fieldtype: 'Data',
                    reqd: 1,
                    description: 'Display label for the field'
                },
                {
                    label: 'Description',
                    fieldname: 'description',
                    fieldtype: 'Text',
                    description: 'Help text for users'
                },
                {
                    label: 'Required',
                    fieldname: 'is_required',
                    fieldtype: 'Check',
                    default: 0
                },
                {
                    label: 'Read Only',
                    fieldname: 'is_readonly',
                    fieldtype: 'Check',
                    default: 0
                }
            ],
            primary_action_label: 'Add Field',
            primary_action: (values) => {
                const field_config = {
                    field_name: values.field_name,
                    field_label: values.field_label,
                    field_type: fieldType,
                    description: values.description,
                    is_required: values.is_required,
                    is_readonly: values.is_readonly,
                    field_order: this.current_fields.length + 1
                };
                
                // Add field type specific configurations
                if (fieldType === 'Select') {
                    // Add options dialog
                    this.add_select_options(field_config, callback);
                } else if (fieldType === 'Link') {
                    // Add link target dialog
                    this.add_link_target(field_config, callback);
                } else {
                    callback(field_config);
                }
                
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    render_form_canvas() {
        if (this.current_fields.length === 0) {
            $('#empty-canvas-message').show();
            return;
        }
        
        $('#empty-canvas-message').hide();
        
        let form_html = '';
        let current_section = null;
        
        this.current_fields.forEach((field, index) => {
            // Handle layout elements (Section Break, Column Break)
            if (field.is_layout_element && field.layout_type === 'Section Break') {
                // Close previous section
                if (current_section) {
                    form_html += '</div></div>';
                }
                
                // Start new section with visual column layout
                const columnLayout = field.column_layout || 'grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));';
                const columnCount = field.column_count || 'auto';
                const sectionClass = field.field_index === this.selected_field_index ? 'form-section selected' : 'form-section';
                
                form_html += `
                    <div class="${sectionClass}" data-field-index="${index}" data-section-id="section-${index}" onclick="window.form_builder_instance.select_section(${index})" style="margin-bottom: 20px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 8px; overflow: hidden; cursor: pointer;">
                        <div class="section-header" style="background: var(--flansa-background, #f8f9fa); padding: 12px 16px; border-bottom: 1px solid var(--flansa-border, #e0e6ed); display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fa fa-grip-vertical" style="color: var(--flansa-text-secondary, #6c757d); cursor: move;"></i>
                                <strong style="color: var(--flansa-text-primary, #495057);">${field.field_label || 'Section'}</strong>
                                <span class="column-indicator" style="background: var(--flansa-primary, #007bff); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                                    ${columnCount === 'auto' ? 'Auto' : columnCount + ' Col'}
                                </span>
                            </div>
                            <div class="section-actions">
                                <button class="btn btn-xs btn-light edit-section" title="Edit Section"><i class="fa fa-edit"></i></button>
                                <button class="btn btn-xs btn-danger remove-section" title="Remove Section"><i class="fa fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="section-content droppable-section" data-field-index="${index}" data-section-id="section-${index}" style="padding: 16px; display: grid; gap: 16px; ${columnLayout}; min-height: 60px; border: 2px dashed transparent; transition: all 0.2s;">
                `;
                current_section = field;
            } else if (field.is_layout_element && field.layout_type === 'Column Break') {
                form_html += '<div class="column-break" style="width: 100%; border-top: 1px dashed var(--flansa-border, #e0e6ed); margin: 16px 0; font-size: 12px; color: var(--flansa-text-secondary, #6c757d); text-align: center; padding: 8px;">Column Break</div>';
            } else if (field.field_type === 'Column Break') {
                // Handle old-style column breaks for backward compatibility
                form_html += '<div class="column-break" style="width: 100%; border-top: 1px dashed var(--flansa-border, #e0e6ed); margin: 16px 0; font-size: 12px; color: var(--flansa-text-secondary, #6c757d); text-align: center; padding: 8px;">Column Break</div>';
            } else {
                // Regular field
                if (!current_section) {
                    // Start default section
                    form_html += `
                        <div class="form-section default-section" data-field-index="-1" style="margin-bottom: 20px; border: 1px solid var(--flansa-border, #e0e6ed); border-radius: 8px; background: white;">
                            <div class="section-content droppable-section" data-field-index="-1" style="padding: 16px; min-height: 60px; border: 2px dashed transparent; transition: all 0.2s;">
                    `;
                    current_section = { field_label: 'Form Fields' };
                }
                
                form_html += this.render_field_preview(field, index);
            }
        });
        
        // Close last section
        if (current_section) {
            form_html += '</div></div>';
        }
        
        $('#form-canvas-content').html(form_html);
        
        // Add empty section placeholders for better UX
        this.add_empty_section_placeholders();
        
        // Bind field interaction events
        this.bind_field_events();
    }
    
    render_field_preview(field, index) {
        const required_indicator = field.is_required ? '<span class="text-danger">*</span>' : '';
        const readonly_indicator = field.is_readonly ? '<i class="fa fa-lock text-muted"></i>' : '';
        
        let field_html = `
            <div class="form-field" data-field-index="${index}" data-field-name="${field.field_name}" draggable="true" style="margin-bottom: 16px; padding: 12px; border: 1px solid transparent; border-radius: 4px; transition: all 0.2s; cursor: move;">
                <div class="field-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label class="field-label" style="font-weight: 600; margin: 0; color: var(--flansa-text-primary, #495057);">
                        ${field.field_label || field.field_name} ${required_indicator} ${readonly_indicator}
                    </label>
                    <div class="field-actions" style="display: none;">
                        <button class="btn btn-xs btn-light edit-field-layout" title="Edit Field Layout" style="margin-right: 4px;"><i class="fa fa-edit"></i></button>
                        <button class="btn btn-xs btn-light edit-field-properties" title="Edit Field Properties" style="margin-right: 4px;"><i class="fa fa-cog"></i></button>
                        <button class="btn btn-xs btn-danger remove-field" title="Remove Field"><i class="fa fa-trash"></i></button>
                    </div>
                </div>
                <div class="field-preview">
                    ${this.render_field_input_preview(field)}
                </div>
                ${field.description ? `<small class="field-description" style="color: var(--flansa-text-secondary, #6c757d); font-size: 12px;">${field.description}</small>` : ''}
            </div>
        `;
        
        return field_html;
    }
    
    render_field_input_preview(field) {
        switch (field.field_type) {
            case 'Data':
                return `<input type="text" class="form-control" placeholder="${field.field_label}" disabled>`;
            case 'Text':
                return `<textarea class="form-control" rows="3" placeholder="${field.field_label}" disabled></textarea>`;
            case 'Int':
            case 'Float':
                return `<input type="number" class="form-control" placeholder="${field.field_label}" disabled>`;
            case 'Date':
                return `<input type="date" class="form-control" disabled>`;
            case 'Check':
                return `<div class="checkbox"><label><input type="checkbox" disabled> ${field.field_label}</label></div>`;
            case 'Select':
                return `<select class="form-control" disabled><option>Select ${field.field_label}</option></select>`;
            case 'Gallery':
                return `<div class="gallery-field-preview"><i class="fa fa-images"></i> Gallery Field</div>`;
            default:
                return `<input type="text" class="form-control" placeholder="${field.field_label}" disabled>`;
        }
    }
    
    bind_field_events() {
        const self = this;
        
        // Edit field layout (form config only)
        $(document).off('click', '.edit-field-layout').on('click', '.edit-field-layout', function(e) {
            e.stopPropagation();
            const index = parseInt($(this).closest('.form-field').data('field-index'));
            self.edit_field_layout(index);
        });
        
        // Edit field properties (redirect to Visual Builder)
        $(document).off('click', '.edit-field-properties').on('click', '.edit-field-properties', function(e) {
            e.stopPropagation();
            const index = parseInt($(this).closest('.form-field').data('field-index'));
            self.edit_field_properties(index);
        });
        
        // Remove field
        $(document).off('click', '.remove-field').on('click', '.remove-field', function(e) {
            e.stopPropagation();
            const index = parseInt($(this).closest('.form-field').data('field-index'));
            self.remove_field(index);
        });
        
        // Field selection
        $(document).off('click', '.form-field').on('click', '.form-field', function() {
            $('.form-field').removeClass('selected');
            $(this).addClass('selected');
            const index = parseInt($(this).data('field-index'));
            self.show_field_properties(index);
            self.selected_field_index = index;
        });
        
        // Show field actions on hover
        $(document).off('mouseenter mouseleave', '.form-field').on({
            mouseenter: function() {
                $(this).find('.field-actions').show();
            },
            mouseleave: function() {
                $(this).find('.field-actions').hide();
            }
        }, '.form-field');
        
        // Section editing and removal
        $(document).off('click', '.edit-section').on('click', '.edit-section', function(e) {
            e.stopPropagation();
            const index = parseInt($(this).closest('.form-section').data('field-index'));
            self.edit_section(index);
        });
        
        $(document).off('click', '.remove-section').on('click', '.remove-section', function(e) {
            e.stopPropagation();
            const index = parseInt($(this).closest('.form-section').data('field-index'));
            self.remove_section(index);
        });
    }
    
    edit_field_layout(index) {
        const field = this.current_fields[index];
        // Only edit form layout properties (label, description, etc.)
        console.log('Edit field layout:', field);
        // TODO: Implement layout editing dialog
        frappe.msgprint('Field layout editing coming soon!');
    }
    
    edit_field_properties(index) {
        const field = this.current_fields[index];
        // Redirect to Visual Builder field properties dialog
        const urlParams = new URLSearchParams(window.location.search);
        const tableParam = urlParams.get('table');
        
        if (!tableParam) {
            frappe.msgprint('Unable to determine table for field editing');
            return;
        }
        
        frappe.show_alert({
            message: `Redirecting to Visual Builder to edit "${field.field_label}" properties...`,
            indicator: 'blue'
        });
        
        // Navigate to Visual Builder with field selection
        window.location.href = `/app/flansa-visual-builder?table=${tableParam}&edit_field=${field.field_name}`;
    }
    
    remove_field(index) {
        const field = this.current_fields[index];
        frappe.confirm(`Remove field "${field.field_label}"?`, () => {
            this.current_fields.splice(index, 1);
            this.render_form_canvas();
            
            // Refresh available fields list to show the removed field
            this.load_available_fields();
            
            frappe.show_alert({
                message: `Removed "${field.field_label}" from form`,
                indicator: 'orange'
            });
        });
    }
    
    edit_section(index) {
        const field = this.current_fields[index];
        if (!field || !field.is_layout_element || field.layout_type !== 'Section Break') {
            return;
        }
        
        const dialog = new frappe.ui.Dialog({
            title: 'Edit Section',
            fields: [
                {
                    label: 'Section Title',
                    fieldname: 'section_title',
                    fieldtype: 'Data',
                    default: field.field_label || '',
                    reqd: 1,
                    description: 'Title displayed in the section header'
                }
            ],
            primary_action_label: 'Update Section',
            primary_action: (values) => {
                this.current_fields[index].field_label = values.section_title;
                this.render_form_canvas();
                
                frappe.show_alert({
                    message: `Updated section title to "${values.section_title}"`,
                    indicator: 'green'
                });
                
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    remove_section(index) {
        const field = this.current_fields[index];
        if (!field || !field.is_layout_element || field.layout_type !== 'Section Break') {
            return;
        }
        
        frappe.confirm(
            `Remove section "${field.field_label || 'Section'}"? All fields in this section will be moved to the previous section.`,
            () => {
                // Find all fields that belong to this section
                let fieldsToMove = [];
                let startIndex = index + 1;
                
                // Collect fields until next section or end
                for (let i = startIndex; i < this.current_fields.length; i++) {
                    const currentField = this.current_fields[i];
                    
                    // Stop if we hit another section break
                    if (currentField.is_layout_element && currentField.layout_type === 'Section Break') {
                        break;
                    }
                    
                    fieldsToMove.push(currentField);
                }
                
                // Remove the section and its fields from their current positions
                this.current_fields.splice(index, fieldsToMove.length + 1);
                
                // Find the previous section or add fields to the end
                let insertIndex = this.current_fields.length;
                if (index > 0) {
                    // Find where to insert the fields (after the previous section header)
                    for (let i = index - 1; i >= 0; i--) {
                        if (this.current_fields[i].is_layout_element && 
                            this.current_fields[i].layout_type === 'Section Break') {
                            insertIndex = i + 1;
                            break;
                        }
                    }
                }
                
                // Insert the moved fields
                this.current_fields.splice(insertIndex, 0, ...fieldsToMove);
                
                this.render_form_canvas();
                
                frappe.show_alert({
                    message: `Removed section "${field.field_label || 'Section'}" and moved ${fieldsToMove.length} field(s)`,
                    indicator: 'orange'
                });
            }
        );
    }
    
    show_field_properties(index) {
        const field = this.current_fields[index];
        const self = this;
        
        let properties_html = `
            <div class="field-properties properties-form">
                <h6 style="margin-bottom: 16px; color: var(--flansa-text-primary, #495057);">Field Properties</h6>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--flansa-text-secondary, #6c757d);">Field Name</label>
                    <input type="text" class="form-control" value="${field.field_name || ''}" data-property="field_name" style="font-size: 14px; padding: 6px 8px;">
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--flansa-text-secondary, #6c757d);">Field Label</label>
                    <input type="text" class="form-control" value="${field.field_label || ''}" data-property="field_label" style="font-size: 14px; padding: 6px 8px;">
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--flansa-text-secondary, #6c757d);">Field Type</label>
                    <select class="form-control" data-property="field_type" style="font-size: 14px; padding: 6px 8px;">
                        <option value="${field.field_type}" selected>${field.field_type}</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--flansa-text-secondary, #6c757d);">Description</label>
                    <textarea class="form-control" rows="2" data-property="description" style="font-size: 14px; padding: 6px 8px;">${field.description || ''}</textarea>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" data-property="is_required" ${field.is_required ? 'checked' : ''} style="margin-right: 8px;"> 
                        <span style="font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--flansa-text-secondary, #6c757d);">Required</span>
                    </label>
                </div>
                <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" data-property="is_readonly" ${field.is_readonly ? 'checked' : ''} style="margin-right: 8px;"> 
                        <span style="font-weight: 600; font-size: 12px; text-transform: uppercase; color: var(--flansa-text-secondary, #6c757d);">Read Only</span>
                    </label>
                </div>
            </div>
        `;
        
        $('#properties-content').html(properties_html);
        
        // Bind property change events
        $('#properties-content input, #properties-content textarea, #properties-content select').off('change').on('change', function() {
            const property = $(this).data('property');
            const value = $(this).prop('type') === 'checkbox' ? $(this).prop('checked') : $(this).val();
            self.current_fields[index][property] = value;
            self.render_form_canvas();
        });
    }
    
    switch_mode(mode) {
        this.mode = mode;
        $('.mode-btn').removeClass('active');
        $(`.mode-btn[data-mode="${mode}"]`).addClass('active');
        
        // Update URL
        if (this.table_name) {
            frappe.set_route('flansa-form-builder', this.table_name, mode);
        }
        
        // Hide all modes first
        $('.form-mode').hide();
        
        // Show selected mode
        switch(mode) {
            case 'design':
                $('#design-mode').show();
                break;
            case 'preview':
                $('#preview-mode').show();
                this.render_preview();
                break;
            case 'settings':
                $('#settings-mode').show();
                this.load_form_settings();
                break;
        }
    }
    
    save_form_config() {
        if (!this.table_name) {
            frappe.msgprint('No table selected');
            return;
        }
        
        const config = {
            table_name: this.table_name,
            form_config: {
                layout_type: $('#layout-type-select').val() || 'standard',
                column_layout: $('#column-layout-select').val() || 'auto',
                sections: this.current_fields,
                custom_css: $('#custom-css-input').val() || '',
                form_title: $('#form-title-input').val() || '',
                form_description: $('#form-description-input').val() || '',
                smart_options: {
                    group_related_fields: $('#group-related-fields').is(':checked'),
                    prioritize_required: $('#prioritize-required').is(':checked'),
                    responsive_breakpoints: $('#responsive-breakpoints').is(':checked')
                }
            }
        };
        
        console.log('💾 Saving form config:', config);
        
        frappe.call({
            method: 'flansa.flansa_core.api.form_builder.save_form_config',
            args: config,
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: 'Form configuration saved successfully!',
                        indicator: 'green'
                    });
                    this.form_config = config.form_config;
                } else {
                    frappe.msgprint('Error saving form configuration: ' + (r.message?.error || 'Unknown error'));
                }
            }
        });
    }
    
    show_table_selector() {
        // Show table selection interface
        $('#form-builder-content').hide();
        $('#table-selector').show();
    }

    
    apply_theme() {
        // Apply theme settings if theme manager is available
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.applySavedTheme();
        }
    }
    
    // Additional helper methods
    
    add_section() {
        this.add_layout_item_to_canvas('Section Break');
        frappe.show_alert({
            message: 'New section added to form',
            indicator: 'green'
        });
    }
    
    set_section_columns(columnCount) {
        const selectedSectionIndex = this.get_selected_section_index();
        if (selectedSectionIndex === -1) {
            frappe.show_alert({
                message: 'Please select a section first',
                indicator: 'orange'
            });
            return;
        }
        
        // Update the section's column configuration
        const section = this.current_fields[selectedSectionIndex];
        if (section && section.is_layout_element && section.layout_type === 'Section Break') {
            section.column_count = columnCount;
            section.column_layout = this.get_column_layout_css(columnCount);
            
            this.render_form_canvas();
            
            frappe.show_alert({
                message: `Section set to ${columnCount} column${columnCount > 1 ? 's' : ''}`,
                indicator: 'green'
            });
        }
    }
    
    get_column_layout_css(columnCount) {
        switch(columnCount) {
            case 1:
                return 'grid-template-columns: 1fr;';
            case 2:
                return 'grid-template-columns: 1fr 1fr;';
            case 3:
                return 'grid-template-columns: 1fr 1fr 1fr;';
            default:
                return 'grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));';
        }
    }
    
    get_selected_section_index() {
        // Find the currently selected section
        const $selectedSection = $('.form-section.selected');
        if ($selectedSection.length === 0) {
            // If no section is selected, use the last section
            for (let i = this.current_fields.length - 1; i >= 0; i--) {
                if (this.current_fields[i].is_layout_element && 
                    this.current_fields[i].layout_type === 'Section Break') {
                    return i;
                }
            }
            return -1;
        }
        
        const sectionIndex = parseInt($selectedSection.data('field-index'));
        return sectionIndex;
    }
    
    show_custom_column_dialog() {
        const dialog = new frappe.ui.Dialog({
            title: 'Custom Column Layout',
            fields: [
                {
                    fieldname: 'column_count',
                    fieldtype: 'Int',
                    label: 'Number of Columns',
                    default: 2,
                    description: 'Enter number of columns (1-6)'
                },
                {
                    fieldname: 'column_widths',
                    fieldtype: 'Data',
                    label: 'Column Widths',
                    description: 'e.g., "2fr 1fr" or "300px auto 1fr"',
                    depends_on: 'eval:doc.column_count > 1'
                },
                {
                    fieldname: 'responsive',
                    fieldtype: 'Check',
                    label: 'Responsive Layout',
                    default: 1,
                    description: 'Automatically adjust on smaller screens'
                }
            ],
            primary_action_label: 'Apply Layout',
            primary_action: (values) => {
                this.apply_custom_column_layout(values);
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    apply_custom_column_layout(values) {
        const selectedSectionIndex = this.get_selected_section_index();
        if (selectedSectionIndex === -1) {
            frappe.show_alert({
                message: 'Please select a section first',
                indicator: 'orange'
            });
            return;
        }
        
        const section = this.current_fields[selectedSectionIndex];
        if (section && section.is_layout_element && section.layout_type === 'Section Break') {
            section.column_count = values.column_count;
            
            let columnLayout;
            if (values.column_widths && values.column_count > 1) {
                columnLayout = `grid-template-columns: ${values.column_widths};`;
            } else {
                columnLayout = this.get_column_layout_css(values.column_count);
            }
            
            if (values.responsive) {
                columnLayout += ' @media (max-width: 768px) { grid-template-columns: 1fr; }';
            }
            
            section.column_layout = columnLayout;
            section.responsive = values.responsive;
            
            this.render_form_canvas();
            
            frappe.show_alert({
                message: `Custom ${values.column_count} column layout applied`,
                indicator: 'green'
            });
        }
    }
    
    refresh_table_fields() {
        frappe.show_alert({
            message: 'Syncing fields with table...',
            indicator: 'blue'
        });
        
        // Note: Current form state is preserved during sync
        
        // Reload table data with force refresh
        frappe.call({
            method: 'flansa.flansa_core.api.form_builder.get_table_form_config',
            args: { 
                table_name: this.table_name,
                force_refresh: true  // Add flag to bypass caching
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    const oldFieldNames = this.table_fields.map(f => f.field_name);
                    const newTableFields = r.message.fields || [];
                    const newFieldNames = newTableFields.map(f => f.field_name);
                    
                    console.log('🔄 Sync Debug:', {
                        oldFields: oldFieldNames,
                        newFields: newFieldNames,
                        oldCount: oldFieldNames.length,
                        newCount: newFieldNames.length
                    });
                    
                    // Find deleted fields
                    const deletedFields = oldFieldNames.filter(name => !newFieldNames.includes(name));
                    const addedFields = newFieldNames.filter(name => !oldFieldNames.includes(name));
                    
                    console.log('🔄 Field Changes:', {
                        deleted: deletedFields,
                        added: addedFields
                    });
                    
                    // Update table fields
                    this.table_fields = newTableFields;
                    
                    // Remove deleted fields from current form
                    let hasChanges = false;
                    
                    if (deletedFields.length > 0) {
                        this.current_fields = this.current_fields.filter(field => {
                            // Keep layout elements and fields that still exist
                            return field.is_layout_element || !deletedFields.includes(field.field_name);
                        });
                        hasChanges = true;
                        
                        // Re-render form canvas
                        this.render_form_canvas();
                    }
                    
                    // Show sync results
                    if (deletedFields.length > 0 || addedFields.length > 0) {
                        let message = [];
                        if (deletedFields.length > 0) {
                            message.push(`Removed ${deletedFields.length} deleted field(s): ${deletedFields.join(', ')}`);
                        }
                        if (addedFields.length > 0) {
                            message.push(`Found ${addedFields.length} new field(s): ${addedFields.join(', ')}`);
                        }
                        
                        frappe.show_alert({
                            message: message.join(' | '),
                            indicator: hasChanges ? 'orange' : 'blue'
                        });
                    } else {
                        frappe.show_alert({
                            message: 'Fields are in sync - no changes needed',
                            indicator: 'green'
                        });
                    }
                    
                    // Refresh available fields list
                    this.load_available_fields();
                    
                } else {
                    frappe.show_alert({
                        message: 'Failed to sync fields',
                        indicator: 'red'
                    });
                }
            },
            error: () => {
                frappe.show_alert({
                    message: 'Error syncing fields',
                    indicator: 'red'
                });
            }
        });
    }
    
    force_reload_fields() {
        frappe.show_alert({
            message: 'Force reloading fields directly from DocType...',
            indicator: 'orange'
        });
        
        // Get the DocType name first
        frappe.call({
            method: 'frappe.client.get_value',
            args: {
                doctype: 'Flansa Table',
                filters: { name: this.table_name },
                fieldname: 'doctype_name'
            },
            callback: (r) => {
                if (r.message && r.message.doctype_name) {
                    const doctype_name = r.message.doctype_name;
                    console.log('🔥 Force reload for DocType:', doctype_name);
                    
                    // Get fields directly from DocType meta
                    frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'DocType',
                            name: doctype_name
                        },
                        callback: (dr) => {
                            if (dr.message && dr.message.fields) {
                                const doctype_fields = dr.message.fields;
                                
                                // Filter for Flansa-created fields (excluding standard Frappe fields)
                                const flansa_fields = doctype_fields.filter(field => {
                                    const standard_fields = ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx'];
                                    return !standard_fields.includes(field.fieldname) && 
                                           !field.fieldname.startsWith('_') &&
                                           field.fieldtype !== 'Section Break' &&
                                           field.fieldtype !== 'Column Break';
                                });
                                
                                console.log('🔥 Direct DocType fields:', flansa_fields.map(f => f.fieldname));
                                
                                // Convert to form builder format
                                const formatted_fields = flansa_fields.map(field => ({
                                    field_name: field.fieldname,
                                    field_label: field.label || field.fieldname,
                                    field_type: field.fieldtype,
                                    options: field.options || '',
                                    is_required: field.reqd || 0,
                                    is_readonly: field.read_only || 0,
                                    description: field.description || ''
                                }));
                                
                                // Compare with current fields
                                const oldFieldNames = this.table_fields.map(f => f.field_name);
                                const newFieldNames = formatted_fields.map(f => f.field_name);
                                
                                console.log('🔥 Force Reload Comparison:', {
                                    oldFields: oldFieldNames,
                                    newFields: newFieldNames,
                                    difference: {
                                        deleted: oldFieldNames.filter(name => !newFieldNames.includes(name)),
                                        added: newFieldNames.filter(name => !oldFieldNames.includes(name))
                                    }
                                });
                                
                                // Update table fields
                                this.table_fields = formatted_fields;
                                
                                // Remove deleted fields from form
                                const deletedFields = oldFieldNames.filter(name => !newFieldNames.includes(name));
                                if (deletedFields.length > 0) {
                                    this.current_fields = this.current_fields.filter(field => {
                                        return field.is_layout_element || !deletedFields.includes(field.field_name);
                                    });
                                    this.render_form_canvas();
                                }
                                
                                // Refresh available fields
                                this.load_available_fields();
                                
                                frappe.show_alert({
                                    message: `Force reload complete! Found ${formatted_fields.length} fields directly from DocType`,
                                    indicator: 'green'
                                });
                                
                            } else {
                                frappe.show_alert({
                                    message: 'Failed to get DocType fields',
                                    indicator: 'red'
                                });
                            }
                        }
                    });
                } else {
                    frappe.show_alert({
                        message: 'Could not find DocType name for table',
                        indicator: 'red'
                    });
                }
            }
        });
    }
    
    clear_canvas() {
        frappe.confirm('Clear all fields from the form?', () => {
            this.current_fields = [];
            this.render_form_canvas();
            $('#properties-content').html('<div class="no-selection" style="text-align: center; padding: 40px 20px; color: var(--flansa-text-secondary, #6c757d);"><i class="fa fa-hand-pointer-o fa-2x" style="margin-bottom: 16px; opacity: 0.5;"></i><p style="margin: 0;">Select a field or section to edit properties</p></div>');
        });
    }
    
    reset_form() {
        frappe.confirm('Reset the form to its original state? This will undo all changes.', () => {
            this.load_table_data();
        });
    }
    
    render_preview() {
        if (this.current_fields.length === 0) {
            $('#preview-form-content').html('<p style="text-align: center; padding: 40px; color: var(--flansa-text-secondary, #6c757d);">No fields to preview. Add some fields in design mode.</p>');
            return;
        }
        
        let preview_html = '<form class="preview-form">';
        
        this.current_fields.forEach(field => {
            if (field.field_type === 'Section Break') {
                preview_html += `<div class="form-section"><h5 style="margin: 20px 0 10px 0; color: var(--flansa-text-primary, #495057);">${field.field_label}</h5>`;
            } else if (field.field_type !== 'Column Break') {
                preview_html += `
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 600; color: var(--flansa-text-primary, #495057);">
                            ${field.field_label} ${field.is_required ? '<span style="color: #dc3545;">*</span>' : ''}
                        </label>
                        ${this.render_field_input_preview(field)}
                        ${field.description ? `<small style="color: var(--flansa-text-secondary, #6c757d); font-size: 12px;">${field.description}</small>` : ''}
                    </div>
                `;
            }
        });
        
        preview_html += '</form>';
        $('#preview-form-content').html(preview_html);
    }
    
    load_form_settings() {
        // Load current form settings into the settings form
        $('#form-title-input').val(this.form_config.form_title || '');
        $('#form-description-input').val(this.form_config.form_description || '');
        $('#layout-type-select').val(this.form_config.layout_type || 'standard');
        $('#column-layout-select').val(this.form_config.column_layout || 'auto');
        $('#custom-css-input').val(this.form_config.custom_css || '');
        
        // Load smart options
        const smartOptions = this.form_config.smart_options || {};
        $('#group-related-fields').prop('checked', smartOptions.group_related_fields !== false);
        $('#prioritize-required').prop('checked', smartOptions.prioritize_required !== false);
        $('#responsive-breakpoints').prop('checked', smartOptions.responsive_breakpoints !== false);
        
        // Show/hide smart layout options
        if (this.form_config.column_layout === 'auto') {
            $('#smart-layout-options').show();
        }
    }

    smart_organize_fields() {
        if (!this.current_fields || this.current_fields.length === 0) {
            frappe.show_alert('No fields available to organize', 'orange');
            return;
        }

        // Get smart layout preferences
        const groupRelated = $('#group-related-fields').is(':checked');
        const prioritizeRequired = $('#prioritize-required').is(':checked');
        const responsive = $('#responsive-breakpoints').is(':checked');

        console.log('🧠 Smart organizing fields with options:', {
            groupRelated, 
            prioritizeRequired, 
            responsive,
            fields: this.current_fields.length
        });

        // Extract only actual fields (preserve their properties), skip layout elements
        const actualFields = this.current_fields.filter(field => 
            !field.is_layout_element && 
            field.field_type !== 'Section Break' && 
            field.field_type !== 'Column Break'
        );

        console.log('📋 Preserving field properties for', actualFields.length, 'fields');

        // Organize fields based on best practices while preserving properties
        const organizedFields = this.apply_smart_organization(
            actualFields, 
            { groupRelated, prioritizeRequired, responsive }
        );

        // Update current fields and re-render
        this.current_fields = organizedFields;
        this.render_form_canvas();

        frappe.show_alert({
            message: `Organized ${actualFields.length} fields using smart layout (properties preserved)`,
            indicator: 'green'
        });
    }

    apply_smart_organization(fields, options) {
        const { groupRelated, prioritizeRequired, responsive } = options;
        
        // Define field categories for smart grouping
        const basicFields = ['Data', 'Select', 'Int', 'Float', 'Check'];
        const textFields = ['Text', 'Small Text', 'Long Text', 'Text Editor'];
        const dateFields = ['Date', 'Datetime', 'Time'];
        const relationFields = ['Link', 'Dynamic Link', 'Table'];
        const specialFields = ['Attach', 'Attach Image', 'Color', 'Signature'];

        let organizedFields = [];
        
        // 1. Add a main section header as layout element
        organizedFields.push({
            layout_type: 'Section Break',
            layout_id: 'main_section_' + Date.now(),
            field_label: 'Basic Information',
            is_layout_element: true,
            order: 0
        });

        // 2. Group fields by category and importance
        const fieldGroups = {
            required: [],
            basic: [],
            text: [],
            dates: [],
            relations: [],
            special: []
        };

        // Categorize fields
        fields.forEach(field => {
            if (field.field_type === 'Section Break' || field.field_type === 'Column Break') {
                return; // Skip existing breaks
            }

            const category = this.categorize_field(field, {
                basicFields, textFields, dateFields, relationFields, specialFields
            });

            if (prioritizeRequired && field.is_required) {
                fieldGroups.required.push(field);
            } else {
                fieldGroups[category].push(field);
            }
        });

        // 3. Add required fields first (if prioritizing)
        if (prioritizeRequired && fieldGroups.required.length > 0) {
            organizedFields.push(...fieldGroups.required);
            
            // Add column break for responsive layout
            if (responsive && fieldGroups.required.length > 2) {
                organizedFields.push({
                    layout_type: 'Column Break',
                    layout_id: 'required_col_break_' + Date.now(),
                    field_label: '',
                    is_layout_element: true,
                    order: 10
                });
            }
        }

        // 4. Add basic fields
        if (fieldGroups.basic.length > 0) {
            organizedFields.push(...fieldGroups.basic);
        }

        // 5. Add text fields in their own section if there are many
        if (groupRelated && fieldGroups.text.length > 1) {
            organizedFields.push({
                layout_type: 'Section Break',
                layout_id: 'text_section_' + Date.now(),
                field_label: 'Additional Information',
                is_layout_element: true,
                order: 20
            });
        }
        organizedFields.push(...fieldGroups.text);

        // 6. Add date fields with column break for responsive layout
        if (fieldGroups.dates.length > 0) {
            if (responsive && organizedFields.length > 3) {
                organizedFields.push({
                    layout_type: 'Column Break',
                    layout_id: 'dates_col_break_' + Date.now(),
                    field_label: '',
                    is_layout_element: true,
                    order: 30
                });
            }
            organizedFields.push(...fieldGroups.dates);
        }

        // 7. Add relationships in their own section if grouping
        if (groupRelated && fieldGroups.relations.length > 0) {
            organizedFields.push({
                layout_type: 'Section Break',
                layout_id: 'relations_section_' + Date.now(),
                field_label: 'Related Information',
                is_layout_element: true,
                order: 40
            });
            organizedFields.push(...fieldGroups.relations);
        } else {
            organizedFields.push(...fieldGroups.relations);
        }

        // 8. Add special fields last
        if (fieldGroups.special.length > 0) {
            if (groupRelated) {
                organizedFields.push({
                    layout_type: 'Section Break',
                    layout_id: 'special_section_' + Date.now(),
                    field_label: 'Attachments & Media',
                    is_layout_element: true,
                    order: 50
                });
            }
            organizedFields.push(...fieldGroups.special);
        }

        return organizedFields;
    }

    categorize_field(field, categories) {
        const { basicFields, textFields, dateFields, relationFields, specialFields } = categories;
        
        if (basicFields.includes(field.field_type)) return 'basic';
        if (textFields.includes(field.field_type)) return 'text';
        if (dateFields.includes(field.field_type)) return 'dates';
        if (relationFields.includes(field.field_type)) return 'relations';
        if (specialFields.includes(field.field_type)) return 'special';
        
        return 'basic'; // Default category
    }

    apply_column_layout(layout) {
        console.log('📐 Applying column layout:', layout);
        
        // Save the layout preference
        this.form_config.column_layout = layout;
        
        // Update CSS classes on the form canvas
        const canvas = $('#form-canvas-content');
        canvas.removeClass('single-column two-column three-column');
        
        switch (layout) {
            case 'single':
                canvas.addClass('single-column');
                break;
            case 'two-column':
                canvas.addClass('two-column');
                break;
            case 'three-column':
                canvas.addClass('three-column');
                break;
            case 'auto':
                // Smart layout adds column breaks automatically
                break;
        }
        
        // Re-render the form to apply changes
        this.render_form_canvas();
    }
    
    show_theme_dialog() {
        if (window.FlansaThemeManager) {
            window.FlansaThemeManager.showThemeSettings();
        }
    }
    
    show_help_dialog() {
        if (window.FlansaNavigationManager) {
            window.FlansaNavigationManager.showHelpDialog();
        }
    }
    
    

    add_empty_section_placeholders() {
        // Add drop zones to empty sections
        $('.section-content').each(function() {
            const $section = $(this);
            const fieldsInSection = $section.find('.form-field').length;
            
            if (fieldsInSection === 0) {
                if (!$section.find('.empty-section-placeholder').length) {
                    $section.append(`
                        <div class="empty-section-placeholder" style="
                            text-align: center;
                            padding: 40px 20px;
                            color: var(--flansa-text-secondary, #6c757d);
                            border: 2px dashed var(--flansa-border, #e0e6ed);
                            border-radius: 8px;
                            background: var(--flansa-background, #f8f9fa);
                            margin: 8px;
                            transition: all 0.2s;
                        ">
                            <i class="fa fa-mouse-pointer fa-2x" style="margin-bottom: 12px; opacity: 0.5;"></i>
                            <p style="margin: 0; font-size: 14px;">Drop fields here</p>
                            <small style="opacity: 0.7;">or drag fields from the left panel</small>
                        </div>
                    `);
                }
            } else {
                $section.find('.empty-section-placeholder').remove();
            }
        });
    }
    
    select_section(sectionIndex) {
        // Remove previous selection
        $('.form-section').removeClass('selected');
        
        // Add selection to clicked section
        $(`.form-section[data-field-index="${sectionIndex}"]`).addClass('selected');
        
        this.selected_field_index = sectionIndex;
        
        // Update property panel if visible
        this.show_section_properties(sectionIndex);
    }
    
    show_section_properties(sectionIndex) {
        const section = this.current_fields[sectionIndex];
        if (!section || !section.is_layout_element) return;
        
        // You can expand this to show a properties panel
        console.log('Selected section:', section);
    }
}
// Apply theme on page load
$(document).ready(function() {
    if (window.page_instance && window.page_instance.apply_theme) {
        window.page_instance.apply_theme();
    }



});
