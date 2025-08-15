/**
 * Flansa Record Viewer - Single Record Operations
 * Handles view, edit, and create operations for individual records
 */

frappe.pages['flansa-record-viewer'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Record Viewer',
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
    
    new FlansaRecordViewer(wrapper);
};

class FlansaRecordViewer {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = wrapper.page;
        this.table_name = null;
        this.record_id = null;
        this.mode = 'view'; // 'view', 'edit', 'new'
        this.record_data = {};
        this.table_fields = [];
        this.doctype_name = null;
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing Flansa Record Viewer');
        this.get_route_params();
        
        if (this.table_name) {
            this.setup_html();
            this.bind_events();
            this.load_data();
        }
    }
    
    get_route_params() {
        const route = frappe.get_route();
        this.table_name = route[1];
        this.record_id = route[2];
        
        // Get mode from query parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('mode') || 'view';
        
        if (!this.table_name) {
            frappe.show_alert({
                message: 'No table specified in route',
                indicator: 'red'
            });
            return;
        }
        
        // Handle different route patterns
        if (this.record_id === 'new') {
            this.mode = 'new';
            this.record_id = null;
        } else if (!this.record_id) {
            // No record ID provided - redirect to report viewer for list view
            console.log('📋 No record ID provided, redirecting to report viewer');
            frappe.set_route('flansa-report-viewer', this.table_name);
            return;
        }
        
        console.log('📋 Record viewer params:', {
            table: this.table_name,
            record_id: this.record_id,
            mode: this.mode
        });
    }
    
    setup_html() {
        const modeTitle = this.mode === 'new' ? 'Create New Record' : 
                         this.mode === 'edit' ? 'Edit Record' : 'View Record';
        
        this.page.set_title(modeTitle);
        
        this.page.main.html(`
            <div class="record-form-container" style="padding: 20px; max-width: 1200px; margin: 0 auto;">
                <!-- Header -->
                <div class="record-header" style="margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 id="record-title">${modeTitle}</h3>
                            <p class="text-muted" id="record-subtitle">Table: ${this.table_name}</p>
                        </div>
                        <div class="btn-group" id="action-buttons">
                            <!-- Buttons will be added dynamically based on mode -->
                        </div>
                    </div>
                </div>
                
                <!-- Loading indicator -->
                <div id="loading-container" style="text-align: center; padding: 60px; display: none;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <p style="margin-top: 15px; color: #6c757d;">Loading record data...</p>
                </div>
                
                <!-- Error container -->
                <div id="error-container" style="display: none;">
                    <div class="alert alert-danger" role="alert">
                        <h5>Error</h5>
                        <p id="error-message">Something went wrong</p>
                    </div>
                </div>
                
                <!-- Record form -->
                <div id="record-form" style="display: none;">
                    <form id="record-data-form">
                        <div id="fields-container" class="row">
                            <!-- Fields will be generated dynamically -->
                        </div>
                        
                        <div class="form-actions" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                            <div id="form-buttons">
                                <!-- Action buttons will be added here -->
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `);
    }
    
    bind_events() {
        const container = $(this.wrapper);
        
        // Gallery lightbox triggers
        $(document).on('click', '.gallery-lightbox-trigger', (e) => {
            e.preventDefault();
            const img = $(e.target);
            const gallery = img.closest('.gallery-view');
            
            let imageUrls = [];
            try {
                const encodedData = gallery.data('image-urls-encoded');
                if (encodedData) {
                    const decodedJson = atob(encodedData);
                    imageUrls = JSON.parse(decodedJson);
                }
            } catch (e) {
                console.error('❌ Error parsing image URLs:', e);
            }
            
            const startIndex = parseInt(img.data('image-index') || 0);
            const fieldName = gallery.data('field-name') || 'Gallery';
            
            this.open_image_lightbox(imageUrls, startIndex, `${fieldName} Images`);
        });
        
        // Gallery edit mode events
        $(document).on('click', '.add-gallery-images', (e) => {
            e.preventDefault();
            const fieldId = $(e.target).closest('.add-gallery-images').data('field-id');
            $(`#${fieldId}_file_input`).click();
        });
        
        $(document).on('change', 'input[type="file"][id$="_file_input"]', (e) => {
            const input = e.target;
            const fieldId = input.id.replace('_file_input', '');
            const files = Array.from(input.files);
            
            if (files.length > 0) {
                this.upload_gallery_images_edit_mode(fieldId, files);
            }
        });
        
        $(document).on('click', '.clear-gallery', (e) => {
            e.preventDefault();
            const fieldId = $(e.target).closest('.clear-gallery').data('field-id');
            this.clear_gallery_edit_mode(fieldId);
        });
        
        $(document).on('click', '.gallery-remove-image', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const button = $(e.target).closest('.gallery-remove-image');
            const fieldId = button.data('field-id');
            const imageIndex = button.data('image-index');
            
            this.remove_gallery_image_edit_mode(fieldId, imageIndex);
        });
    }
    
    async load_data() {
        $('#loading-container').show();
        $('#error-container').hide();
        $('#record-form').hide();
        
        try {
            console.log('📡 Loading data:', {
                table: this.table_name,
                record_id: this.record_id,
                mode: this.mode
            });
            
            if (this.mode === 'new') {
                // For new records, just load field structure
                const response = await frappe.call({
                    method: 'flansa.flansa_core.api.table_api.get_table_meta',
                    args: {
                        table_name: this.table_name
                    }
                });
                
                if (response.message && response.message.success) {
                    this.table_fields = response.message.fields || [];
                    this.doctype_name = response.message.doctype_name;
                    this.record_data = {}; // Empty record for new
                    
                    console.log('✅ Loaded table structure for new record');
                    
                    // Load form builder configuration
                    await this.load_form_layout();
                    
                    this.render_form();
                } else {
                    throw new Error(response.message?.error || 'Failed to load table structure');
                }
            } else {
                // Load specific record
                const response = await frappe.call({
                    method: 'flansa.flansa_core.api.table_api.get_record',
                    args: {
                        table_name: this.table_name,
                        record_id: this.record_id
                    }
                });
                
                if (response.message && response.message.success) {
                    this.record_data = response.message.record || {};
                    this.table_fields = response.message.fields || [];
                    this.doctype_name = response.message.doctype_name;
                    
                    console.log('✅ Loaded single record:', this.record_data);
                    
                    // Load form builder configuration
                    await this.load_form_layout();
                    
                    this.render_form();
                } else {
                    throw new Error(response.message?.error || 'Record not found');
                }
            }
            
        } catch (error) {
            console.error('❌ Error loading record:', error);
            this.show_error('Error loading record: ' + error.message);
        } finally {
            $('#loading-container').hide();
        }
    }
    
    show_error(message) {
        $('#error-message').text(message);
        $('#error-container').show();
        $('#loading-container').hide();
        $('#record-form').hide();
    }
    
    async load_form_layout() {
        try {
            console.log('📋 Loading form builder layout for:', this.table_name);
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.form_builder.get_table_form_config',
                args: {
                    table_name: this.table_name
                }
            });
            
            if (response.message && response.message.success) {
                // Transform the response to match expected format
                const formConfig = response.message.form_config || {};
                this.form_layout = {
                    sections: formConfig.sections || [],
                    layout_type: formConfig.layout_type || 'standard',
                    custom_css: formConfig.custom_css || '',
                    form_title: formConfig.form_title || '',
                    form_description: formConfig.form_description || ''
                };
                this.table_fields = response.message.fields || [];
                console.log('✅ Loaded form layout:', this.form_layout);
                console.log('✅ Loaded table fields:', this.table_fields);
            } else {
                console.log('⚠️ No form layout found, using default field layout');
                this.form_layout = null;
            }
        } catch (error) {
            console.error('❌ Error loading form layout:', error);
            this.form_layout = null;
        }
    }
    
    render_form() {
        console.log('🎨 Rendering form for mode:', this.mode);
        
        // Show/hide containers
        $('#loading-container').hide();
        $('#error-container').hide();
        $('#record-form').show();
        
        // Update header based on mode and data
        this.update_header();
        
        // Generate form fields
        this.render_form_fields();
        
        // Add appropriate action buttons
        this.render_action_buttons();
    }
    
    update_header() {
        const recordTitle = this.mode === 'new' ? 'New Record' :
                           this.mode === 'edit' ? `Edit: ${this.record_id}` :
                           `View: ${this.record_id}`;
        
        $('#record-title').text(recordTitle);
        $('#record-subtitle').text(`Table: ${this.table_name}`);
    }
    
    render_form_fields() {
        const fieldsContainer = $('#fields-container');
        fieldsContainer.empty();
        
        if (!this.table_fields || this.table_fields.length === 0) {
            fieldsContainer.html('<p class="text-muted">No fields available</p>');
            return;
        }
        
        if (this.form_layout && this.form_layout.sections) {
            this.render_form_builder_layout();
        } else {
            this.render_default_field_layout();
        }
    }
    
    render_default_field_layout() {
        const fieldsContainer = $('#fields-container');
        
        // Filter out system fields for display
        const systemFields = ['name', 'creation', 'modified', 'modified_by', 'owner', 'docstatus', 'idx'];
        const displayFields = this.mode === 'view' ? 
            this.table_fields : 
            this.table_fields.filter(field => !systemFields.includes(field.fieldname));
        
        displayFields.forEach(field => {
            const fieldValue = this.record_data[field.fieldname] || '';
            const fieldId = `field_${field.fieldname}`;
            const isReadonly = this.mode === 'view';
            
            const fieldHtml = this.render_single_field(field, fieldValue, fieldId, isReadonly);
            fieldsContainer.append(fieldHtml);
        });
    }
    
    render_form_builder_layout() {
        const fieldsContainer = $('#fields-container');
        
        this.form_layout.sections.forEach((section, sectionIndex) => {
            let sectionHtml = `
                <div class="form-section" data-section="${sectionIndex}">
                    <h4 class="section-title" style="margin-bottom: 20px; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                        ${section.title || 'Form Fields'}
                    </h4>
                    <div class="section-fields row">
            `;
            
            if (section.fields) {
                section.fields.forEach(formField => {
                    const field = this.table_fields.find(f => f.fieldname === formField.fieldname);
                    if (field) {
                        const fieldValue = this.record_data[field.fieldname] || '';
                        const fieldId = `field_${field.fieldname}`;
                        const isReadonly = this.mode === 'view';
                        
                        const mergedField = {
                            ...field,
                            label: formField.label || field.label,
                            reqd: formField.reqd !== undefined ? formField.reqd : field.reqd,
                            read_only: formField.read_only !== undefined ? formField.read_only : field.read_only
                        };
                        
                        sectionHtml += this.render_single_field(mergedField, fieldValue, fieldId, isReadonly);
                    }
                });
            }
            
            sectionHtml += `</div></div>`;
            fieldsContainer.append(sectionHtml);
        });
        
        // Render gallery fields if any
        if (this.form_layout.gallery_fields && this.form_layout.gallery_fields.length > 0) {
            let galleryHtml = `
                <div class="form-section gallery-section">
                    <h4 class="section-title" style="margin-bottom: 20px; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                        Gallery Fields
                    </h4>
                    <div class="section-fields row">
            `;
            
            this.form_layout.gallery_fields.forEach(galleryField => {
                // Find matching field from table_fields
                const field = this.table_fields.find(f => f.fieldname === galleryField.fieldname);
                if (field) {
                    const fieldValue = this.record_data[field.fieldname] || '';
                    const fieldId = `field_${field.fieldname}`;
                    const isReadonly = this.mode === 'view';
                    
                    galleryHtml += this.render_single_field(field, fieldValue, fieldId, isReadonly);
                }
            });
            
            galleryHtml += `</div></div>`;
            fieldsContainer.append(galleryHtml);
        }
    }
    
    render_single_field(field, value, fieldId, isReadonly) {
        let fieldHtml = '';
        
        // Handle special field types
        if (this.is_gallery_field(field)) {
            fieldHtml = this.render_gallery_field(field, value, fieldId, isReadonly);
        } else {
            fieldHtml = this.render_standard_field(field, value, fieldId, isReadonly);
        }
        
        return `
            <div class="col-md-6 mb-3">
                <label for="${fieldId}" class="form-label">
                    ${field.label}
                    ${field.reqd ? '<span class="text-danger">*</span>' : ''}
                </label>
                ${fieldHtml}
                ${field.description ? `<small class="form-text text-muted">${field.description}</small>` : ''}
            </div>
        `;
    }
    
    render_standard_field(field, value, fieldId, isReadonly) {
        const displayValue = this.format_field_value(value, field.fieldtype);
        
        if (isReadonly) {
            // View mode - show formatted value
            if (field.fieldtype === 'Attach Image' && value) {
                return `<img src="${value}" class="img-fluid" style="max-width: 200px; max-height: 150px; object-fit: cover; border-radius: 4px;" alt="${field.label}">`;
            } else if (field.fieldtype === 'Long Text') {
                return `<div class="form-control-plaintext" style="white-space: pre-wrap; max-height: 150px; overflow-y: auto;">${displayValue}</div>`;
            } else {
                return `<div class="form-control-plaintext">${displayValue}</div>`;
            }
        } else {
            // Edit mode - show input field
            switch (field.fieldtype) {
                case 'Long Text':
                case 'Text Editor':
                    return `<textarea class="form-control" id="${fieldId}" name="${field.fieldname}" rows="4" ${field.reqd ? 'required' : ''}>${value}</textarea>`;
                case 'Check':
                    return `<div class="form-check"><input class="form-check-input" type="checkbox" id="${fieldId}" name="${field.fieldname}" value="1" ${value ? 'checked' : ''}><label class="form-check-label" for="${fieldId}">Yes</label></div>`;
                case 'Select':
                    const options = field.options ? field.options.split('\n') : [];
                    let selectHtml = `<select class="form-select" id="${fieldId}" name="${field.fieldname}" ${field.reqd ? 'required' : ''}><option value="">Select...</option>`;
                    options.forEach(option => {
                        selectHtml += `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`;
                    });
                    selectHtml += '</select>';
                    return selectHtml;
                case 'Date':
                    return `<input type="date" class="form-control" id="${fieldId}" name="${field.fieldname}" value="${value}" ${field.reqd ? 'required' : ''}>`;
                case 'Datetime':
                    const datetimeValue = value ? new Date(value).toISOString().slice(0, 16) : '';
                    return `<input type="datetime-local" class="form-control" id="${fieldId}" name="${field.fieldname}" value="${datetimeValue}" ${field.reqd ? 'required' : ''}>`;
                case 'Int':
                case 'Float':
                case 'Currency':
                    return `<input type="number" class="form-control" id="${fieldId}" name="${field.fieldname}" value="${value}" ${field.reqd ? 'required' : ''} step="${field.fieldtype === 'Float' || field.fieldtype === 'Currency' ? '0.01' : '1'}">`;
                default:
                    return `<input type="text" class="form-control" id="${fieldId}" name="${field.fieldname}" value="${value}" ${field.reqd ? 'required' : ''}>`;
            }
        }
    }
    
    render_gallery_field(field, value, fieldId, isReadonly) {
        if (isReadonly) {
            // View mode - show gallery
            return this.create_gallery_view_html(value, field.fieldname);
        } else {
            // Edit mode - show editable gallery
            return `
                <div class="gallery-edit-container" data-field-name="${field.fieldname}" data-field-id="${fieldId}">
                    <div class="gallery-controls" style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center;">
                        <button type="button" class="btn btn-sm btn-primary add-gallery-images" data-field-id="${fieldId}">
                            <i class="fa fa-plus"></i> Add Images
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary clear-gallery" data-field-id="${fieldId}">
                            <i class="fa fa-trash"></i> Clear All
                        </button>
                        <small class="text-muted">Click images to view or remove them</small>
                    </div>
                    <div id="${fieldId}_gallery_display">
                        ${this.create_editable_gallery_html(value, field.fieldname, fieldId)}
                    </div>
                    <input type="hidden" id="${fieldId}_data" name="${field.fieldname}" value="${value ? value.replace(/"/g, '&quot;') : ''}">
                    <input type="file" id="${fieldId}_file_input" multiple accept="image/*" style="display: none;">
                </div>
            `;
        }
    }
    
    format_field_value(value, fieldtype) {
        if (!value) return '';
        
        switch (fieldtype) {
            case 'Date':
                return new Date(value).toLocaleDateString();
            case 'Datetime':
                return new Date(value).toLocaleString();
            case 'Currency':
                return parseFloat(value).toFixed(2);
            case 'Check':
                return value ? 'Yes' : 'No';
            case 'Long Text':
                return String(value);
            default:
                return String(value);
        }
    }
    
    render_action_buttons() {
        const actionButtons = $('#action-buttons');
        const formButtons = $('#form-buttons');
        actionButtons.empty();
        formButtons.empty();
        
        console.log('🎯 Rendering action buttons for mode:', this.mode);
        
        if (this.mode === 'view') {
            actionButtons.html(`
                <button type="button" class="btn btn-primary" id="edit-record-btn">
                    <i class="fa fa-edit"></i> Edit
                </button>
                <button type="button" class="btn btn-secondary" id="back-to-list-btn">
                    <i class="fa fa-arrow-left"></i> Back to List
                </button>
            `);
            
            // Bind events
            $('#edit-record-btn').on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('🔧 Edit button clicked!', {
                    table: this.table_name,
                    record_id: this.record_id,
                    FlansaNav: window.FlansaNav,
                    button: $('#edit-record-btn').length
                });
                
                // Simple direct navigation - most reliable approach
                const newUrl = `/app/flansa-record-viewer/${this.table_name}/${this.record_id}?mode=edit`;
                console.log('🔄 Navigating to:', newUrl);
                
                // Method 1: Try frappe.set_route with query parameter
                frappe.set_route('flansa-record-viewer', this.table_name, this.record_id);
                setTimeout(() => {
                    window.history.replaceState({}, '', newUrl);
                    // Force reload to ensure mode change is detected
                    window.location.reload();
                }, 50);
            });
        } else if (this.mode === 'edit') {
            formButtons.html(`
                <button type="submit" class="btn btn-success" id="save-record-btn">
                    <i class="fa fa-save"></i> Save Changes
                </button>
                <button type="button" class="btn btn-secondary" id="cancel-edit-btn">
                    <i class="fa fa-times"></i> Cancel
                </button>
            `);
            
            // Bind events
            $('#cancel-edit-btn').on('click', () => {
                window.FlansaNav.navigateToRecord(this.table_name, this.record_id, 'view');
            });
        } else if (this.mode === 'new') {
            formButtons.html(`
                <button type="submit" class="btn btn-success" id="create-record-btn">
                    <i class="fa fa-plus"></i> Create Record
                </button>
                <button type="button" class="btn btn-secondary" id="cancel-new-btn">
                    <i class="fa fa-times"></i> Cancel
                </button>
            `);
            
            // Bind events
            $('#cancel-new-btn').on('click', () => {
                window.FlansaNav.navigateToViewData(this.table_name);
            });
        }
        
        // Back to list button for all modes
        $('#back-to-list-btn').on('click', () => {
            window.FlansaNav.navigateToViewData(this.table_name);
        });
        
        // Form submission
        $('#record-data-form').off('submit').on('submit', (e) => {
            e.preventDefault();
            this.handle_form_submit();
        });
    }
    
    async handle_form_submit() {
        try {
            // Collect form data
            const formData = new FormData(document.getElementById('record-data-form'));
            const values = {};
            
            // Convert FormData to object
            for (let [key, value] of formData.entries()) {
                values[key] = value;
            }
            
            // Handle gallery fields specially
            this.table_fields.forEach(field => {
                if (this.is_gallery_field(field)) {
                    const fieldId = `field_${field.fieldname}`;
                    const hiddenInput = $(`#${fieldId}_data`);
                    if (hiddenInput.length > 0) {
                        values[field.fieldname] = hiddenInput.val() || '';
                    }
                }
            });
            
            console.log('💾 Form submission values:', values);
            
            if (this.mode === 'new') {
                await this.create_record(values);
            } else if (this.mode === 'edit') {
                await this.save_record(this.record_id, values);
            }
            
        } catch (error) {
            console.error('❌ Form submission error:', error);
            frappe.show_alert({
                message: 'Error submitting form: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async save_record(recordName, values) {
        try {
            frappe.show_alert({
                message: 'Saving record...',
                indicator: 'blue'
            });
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.update_record',
                args: {
                    table_name: this.table_name,
                    record_name: recordName,
                    values: values
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: 'Record updated successfully',
                    indicator: 'green'
                });
                // Navigate to view mode
                window.FlansaNav.navigateToRecord(this.table_name, recordName, 'view');
            } else {
                throw new Error(response.message?.error || 'Save failed');
            }
            
        } catch (error) {
            frappe.show_alert({
                message: 'Error saving record: ' + error.message,
                indicator: 'red'
            });
            console.error('Save error details:', error);
        }
    }
    
    async create_record(values) {
        try {
            frappe.show_alert({
                message: 'Creating record...',
                indicator: 'blue'
            });
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.create_record',
                args: {
                    table_name: this.table_name,
                    values: values
                }
            });
            
            if (response.message && response.message.success) {
                const newRecordName = response.message.record_name;
                frappe.show_alert({
                    message: 'Record created successfully',
                    indicator: 'green'
                });
                // Navigate to the new record in view mode
                window.FlansaNav.navigateToRecord(this.table_name, newRecordName, 'view');
            } else {
                throw new Error(response.message?.error || 'Create failed');
            }
            
        } catch (error) {
            frappe.show_alert({
                message: 'Error creating record: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    // Gallery field detection and rendering methods (reuse from existing code)
    is_gallery_field(field) {
        if (!field || field.fieldtype !== 'Long Text') {
            return false;
        }
        
        if (!field.description) {
            // Check if field name suggests it's for images/gallery
            if (field.fieldname.toLowerCase().includes('gallery') || 
                field.fieldname.toLowerCase().includes('image') ||
                field.fieldname.toLowerCase().includes('photo')) {
                return true;
            }
            return false;
        }
        
        // Check for gallery metadata in field description
        if (field.description.includes('is_gallery')) {
            return true;
        }
        
        try {
            const desc_data = JSON.parse(field.description);
            if (desc_data.flansa_config && desc_data.flansa_config.config && 
                desc_data.flansa_config.config.gallery_metadata) {
                return desc_data.flansa_config.config.gallery_metadata.is_gallery;
            }
            if (desc_data.gallery_metadata) {
                return desc_data.gallery_metadata.is_gallery;
            }
        } catch (e) {
            // Not JSON
        }
        
        return false;
    }
    
    create_gallery_view_html(value, fieldname) {
        if (!value) {
            return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No images uploaded</div>';
        }
        
        try {
            let images = [];
            
            // Parse gallery data
            if (typeof value === 'string') {
                if (value.startsWith('[') && value.endsWith(']')) {
                    images = JSON.parse(value);
                } else {
                    images = [{ file_url: value }];
                }
            } else if (Array.isArray(value)) {
                images = value;
            }
            
            if (!Array.isArray(images) || images.length === 0) {
                return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No images found</div>';
            }
            
            // Convert to image URLs for lightbox
            const imageUrls = images.map(image => this.get_image_url(image)).filter(url => 
                url && url !== '/assets/frappe/images/default-avatar.png'
            );
            
            if (imageUrls.length === 0) {
                return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No valid images found</div>';
            }
            
            // Create gallery grid with lightbox functionality
            const encodedImageUrls = btoa(JSON.stringify(imageUrls));
            
            let html = `<div class="gallery-view" data-field-name="${fieldname}" data-image-urls-encoded="${encodedImageUrls}" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto;">`;
            
            imageUrls.forEach((imageUrl, index) => {
                html += `
                    <div class="gallery-item" style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; border: 1px solid #eee;">
                        <img src="${imageUrl}" 
                             style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                             alt="Gallery image ${index + 1}"
                             class="gallery-lightbox-trigger"
                             data-image-index="${index}"
                             title="Click to view in lightbox">
                    </div>
                `;
            });
            
            html += '</div>';
            
            if (imageUrls.length > 0) {
                html += `<div class="text-muted" style="margin-top: 8px; font-size: 12px;">${imageUrls.length} image(s) - Click images to view in lightbox</div>`;
            }
            
            return html;
            
        } catch (e) {
            console.error('Error creating gallery view:', e);
            return '<div class="text-danger" style="padding: 10px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">Error loading gallery</div>';
        }
    }
    
    create_editable_gallery_html(value, fieldname, fieldId) {
        if (!value) {
            return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No images uploaded yet. Click "Add Images" to start.</div>';
        }
        
        try {
            let images = [];
            
            // Parse gallery data
            if (typeof value === 'string') {
                if (value.startsWith('[') && value.endsWith(']')) {
                    images = JSON.parse(value);
                } else {
                    images = [{ file_url: value }];
                }
            } else if (Array.isArray(value)) {
                images = value;
            }
            
            if (!Array.isArray(images) || images.length === 0) {
                return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No valid images found</div>';
            }
            
            // Convert to image URLs
            const imageUrls = images.map(image => this.get_image_url(image)).filter(url => 
                url && url !== '/assets/frappe/images/default-avatar.png'
            );
            
            if (imageUrls.length === 0) {
                return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No valid images found</div>';
            }
            
            // Create editable gallery grid
            let html = `<div class="gallery-edit-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: white;">`;
            
            imageUrls.forEach((imageUrl, index) => {
                html += `
                    <div class="gallery-edit-item" style="position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; border: 1px solid #eee; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <img src="${imageUrl}" 
                             style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                             alt="Gallery image ${index + 1}"
                             class="gallery-edit-image"
                             data-image-index="${index}"
                             data-field-id="${fieldId}"
                             title="Click to view full size">
                        <div class="gallery-item-actions" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 5px;">
                            <button type="button" class="gallery-remove-image" data-image-index="${index}" data-field-id="${fieldId}" 
                                    style="background: rgba(220,53,69,0.95); border: 1px solid #dc3545; color: white; border-radius: 50%; width: 28px; height: 28px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
                                    title="Remove image">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            html += `<div class="text-muted mt-2" style="font-size: 12px;">${imageUrls.length} image(s) - Click <i class="fa fa-trash"></i> to remove</div>`;
            
            return html;
            
        } catch (e) {
            console.error('Error creating editable gallery:', e);
            return '<div class="text-danger" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">Error loading gallery for editing</div>';
        }
    }
    
    get_image_url(image) {
        if (!image) return '/assets/frappe/images/default-avatar.png';
        
        if (typeof image === 'object') {
            return image.file_url || image.url || image.name || '/assets/frappe/images/default-avatar.png';
        }
        
        const str_value = String(image).trim();
        
        if (str_value.startsWith('http://') || str_value.startsWith('https://')) {
            return str_value;
        } else if (str_value.startsWith('/files/')) {
            return `${window.location.origin}${str_value}`;
        } else if (str_value.startsWith('/assets/')) {
            return `${window.location.origin}${str_value}`;
        } else if (str_value && !str_value.includes(' ')) {
            return `${window.location.origin}/files/${str_value}`;
        }
        
        return '/assets/frappe/images/default-avatar.png';
    }
    
    // Lightbox functionality (simplified)
    open_image_lightbox(images, startingIndex = 0, title = 'Image Gallery') {
        if (!images || images.length === 0) return;
        
        // Create simple lightbox modal
        const lightboxHtml = `
            <div class="image-lightbox-overlay" id="image-lightbox" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center;">
                <div class="lightbox-content" style="position: relative; max-width: 90%; max-height: 90%; display: flex; flex-direction: column; background: white; border-radius: 8px; overflow: hidden;">
                    <div class="lightbox-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #f8f9fa; border-bottom: 1px solid #ddd;">
                        <span class="lightbox-title" style="font-weight: 600; color: #495057;">${title}</span>
                        <button class="lightbox-close" style="background: none; border: none; font-size: 20px; color: #6c757d; cursor: pointer; padding: 5px;" title="Close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="lightbox-body" style="position: relative; display: flex; align-items: center; justify-content: center; min-height: 400px; max-height: 70vh; overflow: hidden;">
                        <img src="${images[startingIndex]}" alt="Image" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing lightbox
        $('#image-lightbox').remove();
        
        // Add to DOM
        $('body').append(lightboxHtml);
        
        // Bind close events
        $('#image-lightbox .lightbox-close').on('click', () => {
            $('#image-lightbox').fadeOut(200, () => {
                $('#image-lightbox').remove();
            });
        });
        
        // Click outside to close
        $('#image-lightbox').on('click', (e) => {
            if (e.target === $('#image-lightbox')[0]) {
                $('#image-lightbox .lightbox-close').click();
            }
        });
        
        // Show lightbox
        $('#image-lightbox').fadeIn(200);
    }
    
    // Gallery editing methods (simplified stubs - can be expanded)
    async upload_gallery_images_edit_mode(fieldId, files) {
        console.log(`📤 Upload ${files.length} files for ${fieldId}`);
        // Implementation for file upload
        frappe.show_alert({
            message: 'Gallery upload functionality will be implemented',
            indicator: 'blue'
        });
    }
    
    clear_gallery_edit_mode(fieldId) {
        console.log(`🧹 Clear gallery ${fieldId}`);
        // Implementation for clearing gallery
        this.update_gallery_field_data(fieldId, []);
    }
    
    remove_gallery_image_edit_mode(fieldId, imageIndex) {
        console.log(`🗑️ Remove image ${imageIndex} from ${fieldId}`);
        // Implementation for removing single image
    }
    
    update_gallery_field_data(fieldId, images) {
        let valueToStore = images.length === 0 ? '' : JSON.stringify(images);
        $(`#${fieldId}_data`).val(valueToStore);
        
        const container = $(`.gallery-edit-container[data-field-id="${fieldId}"]`);
        const fieldName = container.data('field-name');
        
        $(`#${fieldId}_gallery_display`).html(
            this.create_editable_gallery_html(valueToStore, fieldName, fieldId)
        );
    }
}