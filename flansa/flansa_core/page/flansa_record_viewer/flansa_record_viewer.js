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
    
    // Helper method for API calls
    call_api(method, args) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: method,
                args: args,
                callback: (response) => {
                    if (response.message) {
                        resolve(response.message);
                    } else {

    // Load form builder configuration
    async load_form_configuration() {
        try {
            const formConfigResponse = await this.call_api(
                'flansa.flansa_core.api.form_builder.get_table_form_config',
                { table_name: this.table_name }
            );
            
            if (formConfigResponse.success) {
                this.form_config = formConfigResponse.form_config || {};
                this.form_sections = formConfigResponse.form_config?.sections || [];
                console.log('📋 Loaded form builder configuration:', this.form_config);
                return true;
            } else {
                console.warn('⚠️ No form builder configuration found, using default layout');
                this.form_config = {};
                this.form_sections = [];
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading form configuration:', error);
            this.form_config = {};
            this.form_sections = [];
            return false;
        }
    }
                        resolve({ success: false, error: 'No response' });
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
    
    // Gallery field detection
    is_gallery_field(field) {
        if (!field || field.fieldtype !== 'Long Text') {
            return false;
        }
        
        // Check field name for gallery keywords
        const fieldName = (field.fieldname || '').toLowerCase();
        if (fieldName.includes('gallery') || fieldName.includes('image') || fieldName.includes('photo')) {
            return true;
        }
        
        // Check field label for gallery keywords
        const fieldLabel = (field.label || '').toLowerCase();
        if (fieldLabel.includes('gallery') || fieldLabel.includes('image') || fieldLabel.includes('photo')) {
            return true;
        }
        
        return false;
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
            <div class="flansa-record-viewer-page">
                <!-- Compact Modern Header -->
                <div class="flansa-compact-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; margin: -20px -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                    <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                        <i class="fa fa-file-text-o" style="font-size: 20px; opacity: 0.9;"></i>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">${modeTitle}</h3>
                            <p style="margin: 0; font-size: 12px; opacity: 0.8;">Table: ${this.table_name || 'Unknown'}</p>
                        </div>
                    </div>
                    <div class="header-right" style="display: flex; align-items: center; gap: 8px;">
                        <span class="mode-badge" style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">
                            ${this.mode.toUpperCase()}
                        </span>
                    </div>
                </div>

                <!-- Navigation Breadcrumbs -->
                <div class="flansa-breadcrumbs" style="padding: 12px 0; margin-bottom: 16px; border-bottom: 1px solid #f0f3f7;">
                    <nav style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6c757d;">
                        <a href="/app/flansa-dashboard" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                            <i class="fa fa-home"></i> Dashboard
                        </a>
                        <span style="color: #dee2e6;">→</span>
                        <a href="/app/flansa-report-viewer/${this.table_name}" style="color: #667eea; text-decoration: none;">
                            ${this.table_name}
                        </a>
                        <span style="color: #dee2e6;">→</span>
                        <span style="color: #6c757d;">${this.record_id ? 'Record ' + this.record_id : 'New Record'}</span>
                    </nav>
                </div>

                <!-- Action Bar -->
                <div class="flansa-action-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 12px 16px; background: #f8f9fc; border-radius: 6px; border: 1px solid #e3e6f0;">
                    <div class="action-left" style="display: flex; align-items: center; gap: 12px;">
                        <button type="button" class="btn btn-sm btn-outline-secondary back-to-list" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-arrow-left"></i> Back to List
                        </button>
                    </div>
                    <div class="action-right" id="record-actions">
                        <!-- Action buttons will be populated dynamically -->
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="record-content" id="record-content">
                    <div class="text-center" style="padding: 50px;">
                        <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p class="text-muted" style="margin-top: 20px;">Loading record...</p>
                    </div>
                </div>
                
                <!-- Status Bar -->
                <div class="flansa-status-bar" style="position: fixed; bottom: 0; left: 0; right: 0; background: #ffffff; border-top: 1px solid #e3e6f0; padding: 8px 20px; font-size: 12px; color: #6c757d; display: flex; justify-content: space-between; align-items: center; z-index: 99;">
                    <div class="status-left">
                        <span id="status-message">Ready</span>
                    </div>
                    <div class="status-right">
                        <span>Flansa Platform</span>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .flansa-record-viewer-page {
                    padding-bottom: 60px; /* Space for status bar */
                }
                
                .btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .form-group {
                    transition: all 0.2s ease;
                }
                
                .form-group:hover {
                    background: rgba(102, 126, 234, 0.02);
                    border-radius: 4px;
                    padding: 8px;
                    margin: -8px;
                }
                
                .gallery-view img:hover,
                .gallery-edit-item img:hover {
                    transform: scale(1.05);
                    transition: transform 0.2s ease;
                }
            </style>
        `);
    }

    
    bind_events() {
        // Event handlers will be added here as needed
        console.log('🔗 Binding events for record viewer');
    }
    
    load_data() {
        console.log('📊 Loading data for record viewer');
        
        // First load form configuration, then load data
        this.load_form_configuration().then((hasFormConfig) => {
            if (this.mode === 'new') {
                this.load_table_structure();
            } else {
                this.load_record_data();
            }
        });
    }

    
    load_table_structure() {
        // Load both table metadata and form layout
        Promise.all([
            this.call_api('flansa.flansa_core.api.table_api.get_table_meta', { table_name: this.table_name }),
            this.call_api('flansa.flansa_core.api.form_builder.get_form_layout', { table_name: this.table_name })
        ]).then(([metaResponse, layoutResponse]) => {
            if (metaResponse.success) {
                this.table_fields = metaResponse.fields || [];
                this.doctype_name = metaResponse.doctype_name;
                
                // Use form builder layout if available
                if (layoutResponse.success && layoutResponse.layout) {
                    this.form_layout = layoutResponse.layout;
                    console.log('📋 Using form builder layout');
                } else {
                    this.form_layout = null;
                    console.log('📋 Using default field layout');
                }
                
                this.render_new_record_form();
            } else {
                this.show_error('Failed to load table structure: ' + (metaResponse.error || 'Unknown error'));
            }
        }).catch(error => {
            console.error('Error loading table structure:', error);
            this.show_error('Error loading table structure');
        });
    }
    
    load_record_data() {
        // Load both record data and form layout
        Promise.all([
            this.call_api('flansa.flansa_core.api.table_api.get_record', { 
                table_name: this.table_name, 
                record_id: this.record_id 
            }),
            this.call_api('flansa.flansa_core.api.form_builder.get_form_layout', { table_name: this.table_name })
        ]).then(([recordResponse, layoutResponse]) => {
            if (recordResponse.success) {
                this.record_data = recordResponse.record || {};
                this.table_fields = recordResponse.fields || [];
                this.doctype_name = recordResponse.doctype_name;
                
                // Use form builder layout if available
                if (layoutResponse.success && layoutResponse.layout) {
                    this.form_layout = layoutResponse.layout;
                    console.log('📋 Using form builder layout');
                } else {
                    this.form_layout = null;
                    console.log('📋 Using default field layout');
                }
                
                this.render_record();
            } else {
                this.show_error('Record not found: ' + (recordResponse.error || 'Unknown error'));
            }
        }).catch(error => {
            console.error('Error loading record:', error);
            this.show_error('Error loading record');
        });
    }
    
    render_record() {
        const content = document.getElementById('record-content');
        const actionsContainer = document.getElementById('record-actions');
        if (!content) return;
        
        // Update action buttons
        if (actionsContainer) {
            let actionHtml = '';
            if (this.mode === 'view') {
                actionHtml = `
                    <button type="button" class="btn btn-sm btn-primary edit-record" style="display: flex; align-items: center; gap: 6px;">
                        <i class="fa fa-edit"></i> Edit Record
                    </button>
                `;
            } else if (this.mode === 'edit') {
                actionHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-sm btn-success save-record" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary cancel-edit" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-times"></i> Cancel
                        </button>
                    </div>
                `;
            } else if (this.mode === 'new') {
                actionHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-sm btn-success save-record" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-plus"></i> Create Record
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary cancel-create" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-times"></i> Cancel
                        </button>
                    </div>
                `;
            }
            actionsContainer.innerHTML = actionHtml;
            
            // Add Form Builder button for view mode
        if (this.mode === 'view') {
            const formBuilderBtn = document.createElement('button');
            formBuilderBtn.type = 'button';
            formBuilderBtn.className = 'btn btn-sm btn-outline-primary form-builder-btn';
            formBuilderBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-left: 8px;';
            formBuilderBtn.innerHTML = '<i class="fa fa-paint-brush"></i> Customize Form';
            formBuilderBtn.title = 'Open Form Builder to customize this form layout';
            
            formBuilderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.open(`/app/flansa-form-builder?table=${this.table_name}`, '_blank');
            });
            
            // Only add if it doesn't already exist
            if (!actionsContainer.querySelector('.form-builder-btn')) {
                actionsContainer.appendChild(formBuilderBtn);
            }
        }
        }
        
        // Update status message
        const statusMessage = this.mode === 'new' ? 'Creating new record' :
                            this.mode === 'edit' ? `Editing record ${this.record_id}` : 
                            `Viewing record ${this.record_id}`;
        this.update_status(statusMessage);
        
        let html = `
            <div class="record-form-container" style="background: white; border-radius: 8px; border: 1px solid #e3e6f0; overflow: hidden;">
                <div class="record-header" style="background: #f8f9fc; padding: 16px 20px; border-bottom: 1px solid #e3e6f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #2c3e50;">${this.mode === 'new' ? 'Create New' : this.mode === 'edit' ? 'Edit' : 'View'} Record</h4>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">${this.mode === 'new' ? 'New record creation' : `Record ID: ${this.record_id}`}</p>
                        </div>
                        <div class="record-meta" style="text-align: right; font-size: 12px; color: #6c757d;">
                            ${this.record_data.creation ? `<div>Created: ${new Date(this.record_data.creation).toLocaleDateString()}</div>` : ''}
                            ${this.record_data.modified ? `<div>Modified: ${new Date(this.record_data.modified).toLocaleDateString()}</div>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="record-fields" style="padding: 24px;">
        
        // Add form title and description from form builder config
        if (this.form_config && (this.form_config.form_title || this.form_config.form_description)) {
            let headerHtml = '';
            
            if (this.form_config.form_title) {
                headerHtml += `<h4 style="margin: 0 0 8px 0; color: #2c3e50; font-weight: 600;">${this.form_config.form_title}</h4>`;
            }
            
            if (this.form_config.form_description) {
                headerHtml += `<p style="margin: 0 0 16px 0; color: #6c757d; font-size: 14px;">${this.form_config.form_description}</p>`;
            }
            
            if (headerHtml) {
                html += `
                    <div class="form-builder-header" style="margin-bottom: 20px; padding: 16px; background: #f8f9fc; border-radius: 6px; border-left: 4px solid #667eea;">
                        ${headerHtml}
                    </div>
                `;
            }
        }
        
        
        // Render fields with sections
        if (this.table_fields && this.table_fields.length > 0) {
            // Group fields into sections for better organization
            const sections = this.organize_fields_into_sections(this.table_fields);
            
            sections.forEach((section, sectionIndex) => {
                html += `
                    <div class="field-section" style="margin-bottom: ${sectionIndex < sections.length - 1 ? '32px' : '0'};">
                        ${section.title ? `<h5 style="margin: 0 0 16px 0; color: #495057; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                            <i class="fa fa-${section.icon || 'folder-o'}" style="color: #667eea;"></i>
                            ${section.title}
                        </h5>` : ''}
                        <div class="fields-grid" style="display: grid; grid-template-columns: ${section.columns || 'repeat(auto-fit, minmax(300px, 1fr))'}; gap: 20px;">
                `;
                
                section.fields.forEach(field => {
                    html += this.render_field(field);
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="empty-state" style="text-align: center; padding: 40px;">
                    <i class="fa fa-inbox fa-3x" style="color: #dee2e6; margin-bottom: 16px;"></i>
                    <h5 style="color: #6c757d; margin-bottom: 8px;">No Fields Defined</h5>
                    <p class="text-muted">This table doesn't have any fields configured yet.</p>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        content.innerHTML = html;
        
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            this.bind_record_events();
        this.apply_form_builder_styles();
        }, 50);
    }

    
    render_new_record_form() {
        // Use the same render_record method but with empty data
        this.record_data = {}; // Ensure empty data for new record
        this.render_record();
    }
    
    render_field(field, value = null, isEdit = false) {
        if (!field) return '';
        
        const fieldName = field.fieldname || 'unnamed_field';
        const fieldLabel = field.label || fieldName;
        const fieldValue = value !== null ? value : (this.record_data[fieldName] || '');
        const isReadonly = this.mode === 'view' && !isEdit;
        
        let html = `
            <div class="form-group" style="margin-bottom: 20px;">
                <label class="control-label">${fieldLabel}</label>
        `;
        
        // Check if this is a gallery field
        if (this.is_gallery_field(field)) {
            if (isReadonly) {
                // View mode - show gallery
                html += this.render_gallery_view(fieldValue);
            } else {
                // Edit mode - show editable gallery
                html += this.render_gallery_edit(fieldValue, fieldName);
            }
        } else if (isReadonly) {
            // View mode for regular fields
            html += `<div class="form-control-static">${this.escapeHtml(fieldValue) || '<em class="text-muted">No value</em>'}</div>`;
        } else {
            // Edit mode for regular fields
            const fieldType = field.fieldtype || 'Data';
            
            switch (fieldType) {
                case 'Long Text':
                case 'Text Editor':
                    html += `<textarea class="form-control" name="${fieldName}" rows="4">${this.escapeHtml(fieldValue)}</textarea>`;
                    break;
                case 'Check':
                    html += `<input type="checkbox" name="${fieldName}" ${fieldValue ? 'checked' : ''}>`;
                    break;
                case 'Date':
                    html += `<input type="date" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}">`;
                    break;
                case 'Int':
                case 'Float':
                    html += `<input type="number" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}">`;
                    break;
                default:
                    html += `<input type="text" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}">`;
            }
        }
        
        html += '</div>';
        return html;
    }
    
    // Gallery rendering methods
    render_gallery_view(value) {
        if (!value) {
            return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No images uploaded</div>';
        }
        
        const images = this.parseGalleryData(value);
        if (images.length === 0) {
            return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No images found</div>';
        }
        
        let html = '<div class="gallery-view" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto;">';
        
        images.forEach((image, index) => {
            const imageUrl = this.safeImageUrl(image);
            if (imageUrl && imageUrl !== '/assets/frappe/images/default-avatar.png') {
                html += `
                    <div class="gallery-item" style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; border: 1px solid #eee;">
                        <img src="${imageUrl}" 
                             style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                             alt="Gallery image ${index + 1}"
                             onclick="frappe.utils.preview_image('${this.escapeJsString(imageUrl)}')"
                             title="Click to view full size"
                             onerror="this.src='/assets/frappe/images/default-avatar.png'">
                    </div>
                `;
            }
        });
        
        html += '</div>';
        html += `<div class="text-muted" style="margin-top: 8px; font-size: 12px;">${images.length} image(s) - Click to view full size</div>`;
        
        return html;
    }
    
    render_gallery_edit(value, fieldName) {
        let html = `
            <div class="gallery-edit-container" data-field-name="${fieldName}">
                <div class="gallery-controls" style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm btn-primary add-gallery-images">
                        <i class="fa fa-plus"></i> Add Images
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary clear-gallery">
                        <i class="fa fa-trash"></i> Clear All
                    </button>
                    <small class="text-muted">JPG, PNG, GIF supported • Click images to view or remove</small>
                </div>
                <div class="gallery-display-area">
                    ${this.render_gallery_edit_content(value, fieldName)}
                </div>
                <input type="hidden" name="${fieldName}" value="${this.escapeHtml(value || '')}">
                <input type="file" class="gallery-file-input" multiple accept="image/*" style="display: none;">
            </div>
        `;
        
        return html;
    }

    
    // Helper methods for gallery functionality
    parseGalleryData(value) {
        if (!value) return [];
        
        try {
            if (typeof value === 'string') {
                if (value.startsWith('[') && value.endsWith(']')) {
                    return JSON.parse(value);
                } else if (value.includes('\n')) {
                    // Handle newline-separated URLs
                    return value.split('\n').filter(url => url.trim()).map(url => ({
                        file_url: url.trim(),
                        file_name: url.trim().split('/').pop(),
                        description: 'Image'
                    }));
                } else if (value.trim()) {
                    // Single URL
                    return [{
                        file_url: value.trim(),
                        file_name: value.trim().split('/').pop(),
                        description: 'Image'
                    }];
                }
            } else if (Array.isArray(value)) {
                return value;
            }
        } catch (e) {
            console.error('Error parsing gallery data:', e);
        }
        
        return [];
    }
    
    safeImageUrl(image) {
        if (!image) return '/assets/frappe/images/default-avatar.png';
        
        let url = '';
        if (typeof image === 'object') {
            url = image.file_url || image.url || image.name || '';
        } else {
            url = String(image).trim();
        }
        
        if (!url) return '/assets/frappe/images/default-avatar.png';
        
        // Validate URL format
        if (url.includes('<') || url.includes('>')) {
            console.warn('Potentially unsafe image URL:', url);
            return '/assets/frappe/images/default-avatar.png';
        }
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        } else if (url.startsWith('/files/')) {
            return window.location.origin + url;
        } else if (url.startsWith('/assets/')) {
            return window.location.origin + url;
        } else if (url && !url.includes(' ')) {
            return window.location.origin + '/files/' + url;
        }
        
        return '/assets/frappe/images/default-avatar.png';
    }
    
    escapeJsString(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }
    
    bind_record_events() {
        console.log('🔗 Binding record events...');
        
        const content = document.getElementById('record-content');
        const actionsContainer = document.getElementById('record-actions');
        const page = document.querySelector('.flansa-record-viewer-page');
        
        console.log('Elements found:', { content: !!content, actionsContainer: !!actionsContainer, page: !!page });
        
        if (!content) {
            console.error('Record content not found!');
            return;
        }
        
        // Bind action bar button events (these are in the action bar, not content)
        if (actionsContainer) {
            console.log('Binding action bar events...');
            
            // Edit button
            const editBtn = actionsContainer.querySelector('.edit-record');
            console.log('Edit button found:', !!editBtn);
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    console.log('Edit button clicked!');
                    e.preventDefault();
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('mode', 'edit');
                    window.location.href = currentUrl.toString();
                });
            }
            
            // Save button
            const saveBtn = actionsContainer.querySelector('.save-record');
            console.log('Save button found:', !!saveBtn);
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    console.log('Save button clicked!');
                    e.preventDefault();
                    this.save_record();
                });
            }
            
            // Cancel buttons
            const cancelEdit = actionsContainer.querySelector('.cancel-edit');
            console.log('Cancel edit button found:', !!cancelEdit);
            if (cancelEdit) {
                cancelEdit.addEventListener('click', (e) => {
                    console.log('Cancel edit clicked!');
                    e.preventDefault();
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('mode', 'view');
                    window.location.href = currentUrl.toString();
                });
            }
            
            const cancelCreate = actionsContainer.querySelector('.cancel-create');
            console.log('Cancel create button found:', !!cancelCreate);
            if (cancelCreate) {
                cancelCreate.addEventListener('click', (e) => {
                    console.log('Cancel create clicked!');
                    e.preventDefault();
                    frappe.set_route('flansa-report-viewer', this.table_name);
                });
            }
        } else {
            console.error('Actions container not found!');
        }
        
        // Bind navigation events (these are in the page container)
        if (page) {
            const backToListBtn = page.querySelector('.back-to-list');
            console.log('Back to list button found:', !!backToListBtn);
            if (backToListBtn) {
                backToListBtn.addEventListener('click', (e) => {
                    console.log('Back to list clicked!');
                    e.preventDefault();
                    frappe.set_route('flansa-report-viewer', this.table_name);
                });
            }
        }
        
        // Bind lightbox events for gallery images
        const lightboxImages = content.querySelectorAll('.gallery-lightbox-trigger, .gallery-view img, .gallery-edit-item img');
        console.log('Lightbox images found:', lightboxImages.length);
        lightboxImages.forEach(img => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                const imageUrl = img.src;
                console.log('Image clicked for lightbox:', imageUrl);
                this.show_image_lightbox(imageUrl);
            });
        });
        
        // Gallery event handlers (these are in the content area)
        this.bind_gallery_events(content);
        
        console.log('✅ Event binding completed');
    }
    
    bind_gallery_events(content) {
        // Add Images button
        const addImagesBtns = content.querySelectorAll('.add-gallery-images');
        addImagesBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = btn.closest('.gallery-edit-container');
                const fieldName = container.dataset.fieldName;
                this.add_gallery_images(fieldName);
            });
        });
        
        // Clear All button
        const clearBtns = content.querySelectorAll('.clear-gallery');
        clearBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = btn.closest('.gallery-edit-container');
                const fieldName = container.dataset.fieldName;
                this.clear_gallery_images(fieldName);
            });
        });
        
        // Remove individual image buttons
        const removeBtns = content.querySelectorAll('.gallery-remove-image');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = btn.closest('.gallery-edit-container');
                const fieldName = container.dataset.fieldName;
                const imageIndex = parseInt(btn.dataset.imageIndex);
                this.remove_gallery_image(fieldName, imageIndex);
            });
        });
    }

    
    save_record() {
        const formData = this.collect_form_data();
        
        if (this.mode === 'new') {
            // Create new record
            frappe.call({
                method: 'flansa.flansa_core.api.table_api.create_record',
                args: {
                    table_name: this.table_name,
                    values: formData
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert({
                            message: 'Record created successfully',
                            indicator: 'green'
                        });
                        
                        // Redirect to view the new record
                        frappe.set_route('flansa-record-viewer', this.table_name, response.message.record_name);
                    } else {
                        frappe.show_alert({
                            message: 'Failed to create record: ' + (response.message?.error || 'Unknown error'),
                            indicator: 'red'
                        });
                    }
                },
                error: (error) => {
                    console.error('Error creating record:', error);
                    frappe.show_alert({
                        message: 'Error creating record',
                        indicator: 'red'
                    });
                }
            });
        } else {
            // Update existing record
            frappe.call({
                method: 'flansa.flansa_core.api.table_api.update_record',
                args: {
                    table_name: this.table_name,
                    record_name: this.record_id,
                    values: formData
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert({
                            message: 'Record updated successfully',
                            indicator: 'green'
                        });
                        
                        // Switch to view mode
                        const currentUrl = new URL(window.location);
                        currentUrl.searchParams.set('mode', 'view');
                        window.location.href = currentUrl.toString();
                    } else {
                        frappe.show_alert({
                            message: 'Failed to update record: ' + (response.message?.error || 'Unknown error'),
                            indicator: 'red'
                        });
                    }
                },
                error: (error) => {
                    console.error('Error updating record:', error);
                    frappe.show_alert({
                        message: 'Error updating record',
                        indicator: 'red'
                    });
                }
            });
        }
    }
    
    collect_form_data() {
        const formData = {};
        const content = document.getElementById('record-content');
        if (!content) return formData;
        
        const inputs = content.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    formData[input.name] = input.checked ? 1 : 0;
                } else {
                    formData[input.name] = input.value;
                }
            }
        });
        
        return formData;
    }
    

    // Gallery action methods
    add_gallery_images(fieldName) {
        console.log('🖼️ Adding images to gallery field:', fieldName);
        
        // Create file input dialog
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            this.upload_gallery_images(fieldName, files);
        });
        
        fileInput.click();
    }
    
    async upload_gallery_images(fieldName, files) {
        console.log(`📤 Uploading ${files.length} images for field:`, fieldName);
        
        try {
            frappe.show_alert({
                message: `Uploading ${files.length} image(s)...`,
                indicator: 'blue'
            });
            
            const uploadedImages = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`Uploading file ${i + 1}:`, file.name);
                
                const uploadResult = await this.upload_single_file(file);
                if (uploadResult && uploadResult.file_url) {
                    uploadedImages.push({
                        file_url: uploadResult.file_url,
                        file_name: uploadResult.file_name || file.name,
                        description: 'Gallery Image'
                    });
                }
            }
            
            if (uploadedImages.length > 0) {
                // Get current gallery data
                const currentValue = this.record_data[fieldName] || '';
                const currentImages = this.parseGalleryData(currentValue);
                
                // Add new images
                const allImages = [...currentImages, ...uploadedImages];
                
                // Update the field value
                const newValue = JSON.stringify(allImages);
                this.record_data[fieldName] = newValue;
                
                // Update the hidden input
                const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
                if (hiddenInput) {
                    hiddenInput.value = newValue;
                }
                
                // Re-render the gallery
                this.refresh_gallery_display(fieldName, newValue);
                
                frappe.show_alert({
                    message: `Successfully uploaded ${uploadedImages.length} image(s)`,
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Error uploading images:', error);
            frappe.show_alert({
                message: 'Error uploading images: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    upload_single_file(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('is_private', 0);
            formData.append('folder', 'Home/Attachments');
            formData.append('doctype', this.doctype_name || '');
            formData.append('docname', this.record_id || '');
            
            // Use the correct Frappe upload API endpoint
            fetch('/api/method/upload_file', {
                method: 'POST',
                headers: {
                    'X-Frappe-CSRF-Token': frappe.csrf_token
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    resolve(data.message);
                } else {
                    reject(new Error('Upload failed - no response'));
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                reject(error);
            });
        });
    }


    
    async clear_gallery_images(fieldName) {
        console.log('🧹 Clearing gallery field:', fieldName);
        
        const currentValue = this.record_data[fieldName] || '';
        const images = this.parseGalleryData(currentValue);
        
        if (images.length === 0) {
            frappe.show_alert({
                message: 'Gallery is already empty',
                indicator: 'blue'
            });
            return;
        }
        
        // Show confirmation dialog
        const confirmDelete = await new Promise((resolve) => {
            frappe.confirm(
                `Are you sure you want to delete all ${images.length} images? This action cannot be undone.`,
                () => resolve(true),
                () => resolve(false)
            );
        });
        
        if (!confirmDelete) return;
        
        try {
            frappe.show_alert({
                message: `Deleting ${images.length} images...`,
                indicator: 'blue'
            });
            
            // Clear the field value
            this.record_data[fieldName] = '';
            
            // Update the hidden input
            const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
            if (hiddenInput) {
                hiddenInput.value = '';
            }
            
            // Re-render the gallery
            this.refresh_gallery_display(fieldName, '');
            
            frappe.show_alert({
                message: 'Gallery cleared successfully',
                indicator: 'green'
            });
            
        } catch (error) {
            console.error('Error clearing gallery:', error);
            frappe.show_alert({
                message: 'Error clearing gallery: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async remove_gallery_image(fieldName, imageIndex) {
        console.log(`🗑️ Removing image ${imageIndex} from field:`, fieldName);
        
        try {
            const currentValue = this.record_data[fieldName] || '';
            const images = this.parseGalleryData(currentValue);
            
            if (imageIndex < 0 || imageIndex >= images.length) {
                frappe.show_alert({
                    message: 'Invalid image index',
                    indicator: 'red'
                });
                return;
            }
            
            // Remove the image from the array
            images.splice(imageIndex, 1);
            
            // Update the field value
            const newValue = images.length > 0 ? JSON.stringify(images) : '';
            this.record_data[fieldName] = newValue;
            
            // Update the hidden input
            const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
            if (hiddenInput) {
                hiddenInput.value = newValue;
            }
            
            // Re-render the gallery
            this.refresh_gallery_display(fieldName, newValue);
            
            frappe.show_alert({
                message: 'Image removed successfully',
                indicator: 'green'
            });
            
        } catch (error) {
            console.error('Error removing image:', error);
            frappe.show_alert({
                message: 'Error removing image: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    refresh_gallery_display(fieldName, newValue) {
        const container = document.querySelector(`.gallery-edit-container[data-field-name="${fieldName}"]`);
        if (!container) return;
        
        const displayArea = container.querySelector('.gallery-display-area');
        if (!displayArea) return;
        
        // Re-render the gallery content
        const galleryHtml = this.render_gallery_edit_content(newValue, fieldName);
        displayArea.innerHTML = galleryHtml;
        
        // Rebind events for the new content
        this.bind_gallery_events(container);
    }
    
    render_gallery_edit_content(value, fieldName) {
        if (!value) {
            return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No images uploaded yet. Click "Add Images" to start.</div>';
        }
        
        const images = this.parseGalleryData(value);
        if (images.length === 0) {
            return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No images found</div>';
        }
        
        let html = '<div class="gallery-edit-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: white;">';
        
        images.forEach((image, index) => {
            const imageUrl = this.safeImageUrl(image);
            if (imageUrl && imageUrl !== '/assets/frappe/images/default-avatar.png') {
                html += `
                    <div class="gallery-edit-item" style="position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; border: 1px solid #eee; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <img src="${imageUrl}" 
                             style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                             alt="Gallery image ${index + 1}"
                             onclick="frappe.utils.preview_image('${this.escapeJsString(imageUrl)}')"
                             title="Click to view full size"
                             onerror="this.src='/assets/frappe/images/default-avatar.png'">
                        <div class="gallery-item-actions" style="position: absolute; top: 5px; right: 5px;">
                            <button type="button" class="gallery-remove-image" data-image-index="${index}" 
                                    style="background: rgba(220,53,69,0.95); border: 1px solid #dc3545; color: white; border-radius: 50%; width: 28px; height: 28px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
                                    title="Remove image">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        html += `<div class="text-muted mt-2" style="font-size: 12px;">${images.length} image(s) - Click <i class="fa fa-trash"></i> to remove</div>`;
        
        return html;
    }
    
    // Utility methods for UI organization
    // Organize fields using form builder configuration
    organize_fields_into_sections(fields) {
        // If we have form builder sections, use them
        if (this.form_sections && this.form_sections.length > 0) {
            console.log('📋 Using form builder sections for field organization');
            return this.organize_fields_with_form_config(fields);
        }
        
        // Fallback to automatic organization
        console.log('📋 Using automatic field organization');
        return this.organize_fields_automatically(fields);
    }
    
    organize_fields_with_form_config(fields) {
        const sections = [];
        let currentSection = null;
        
        // Create field lookup for quick access
        const fieldLookup = {};
        fields.forEach(field => {
            fieldLookup[field.fieldname] = field;
        });
        
        this.form_sections.forEach(sectionField => {
            if (sectionField.is_layout_element && sectionField.layout_type === 'Section Break') {
                // Start new section
                if (currentSection && currentSection.fields.length > 0) {
                    sections.push(currentSection);
                }
                
                currentSection = {
                    title: sectionField.field_label || 'Section',
                    icon: this.getSectionIcon(sectionField.field_label),
                    columns: this.getSectionColumns(sectionField),
                    fields: []
                };
            } else if (sectionField.is_layout_element && sectionField.layout_type === 'Column Break') {
                // Handle column breaks within sections (visual hint for responsive layout)
                if (currentSection) {
                    currentSection.has_column_break = true;
                }
            } else if (sectionField.field_name && fieldLookup[sectionField.field_name]) {
                // Add field to current section
                if (!currentSection) {
                    currentSection = {
                        title: 'Basic Information',
                        icon: 'info-circle',
                        columns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        fields: []
                    };
                }
                
                // Use the actual field from the table with form builder customizations
                const actualField = fieldLookup[sectionField.field_name];
                const configuredField = {
                    ...actualField,
                    // Apply form builder customizations if any
                    label: sectionField.field_label || actualField.label,
                    description: sectionField.description || actualField.description,
                    form_config: sectionField // Store form config for advanced features
                };
                
                currentSection.fields.push(configuredField);
            }
        });
        
        // Add the last section
        if (currentSection && currentSection.fields.length > 0) {
            sections.push(currentSection);
        }
        
        // Add any fields not included in form builder config to a default section
        const usedFieldNames = new Set();
        sections.forEach(section => {
            section.fields.forEach(field => {
                usedFieldNames.add(field.fieldname);
            });
        });
        
        const unusedFields = fields.filter(field => !usedFieldNames.has(field.fieldname));
        if (unusedFields.length > 0) {
            sections.push({
                title: 'Additional Fields',
                icon: 'plus-circle',
                columns: 'repeat(auto-fit, minmax(300px, 1fr))',
                fields: unusedFields
            });
        }
        
        return sections;
    }
    
    organize_fields_automatically(fields) {
        const sections = [];
        let currentSection = {
            title: 'General Information',
            icon: 'info-circle',
            columns: 'repeat(auto-fit, minmax(300px, 1fr))',
            fields: []
        };
        
        fields.forEach(field => {
            if (field.fieldtype === 'Section Break') {
                // Start new section
                if (currentSection.fields.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: field.label || 'Section',
                    icon: 'folder-o',
                    columns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    fields: []
                };
            } else if (field.fieldtype !== 'Column Break') {
                // Add field to current section
                currentSection.fields.push(field);
            }
        });
        
        // Add the last section
        if (currentSection.fields.length > 0) {
            sections.push(currentSection);
        }
        
        // If no sections were created, create a default one
        if (sections.length === 0) {
            sections.push({
                title: null,
                icon: 'folder-o',
                columns: 'repeat(auto-fit, minmax(300px, 1fr))',
                fields: fields.filter(f => f.fieldtype !== 'Section Break' && f.fieldtype !== 'Column Break')
            });
        }
        
        return sections;
    }
    
    getSectionIcon(sectionTitle) {
        if (!sectionTitle) return 'folder-o';
        
        const title = sectionTitle.toLowerCase();
        if (title.includes('basic') || title.includes('general')) return 'info-circle';
        if (title.includes('contact') || title.includes('personal')) return 'user';
        if (title.includes('address') || title.includes('location')) return 'map-marker';
        if (title.includes('financial') || title.includes('payment')) return 'credit-card';
        if (title.includes('date') || title.includes('time')) return 'calendar';
        if (title.includes('attachment') || title.includes('media') || title.includes('image')) return 'paperclip';
        if (title.includes('additional') || title.includes('other')) return 'plus-circle';
        if (title.includes('related') || title.includes('reference')) return 'link';
        
        return 'folder-o';
    }
    
    getSectionColumns(sectionField) {
        // Check if this section has column breaks or specific layout preferences
        if (this.form_config.column_layout === 'two-column') {
            return 'repeat(2, 1fr)';
        } else if (this.form_config.column_layout === 'three-column') {
            return 'repeat(3, 1fr)';
        } else if (this.form_config.column_layout === 'single') {
            return '1fr';
        }
        
        // Default responsive grid
        return 'repeat(auto-fit, minmax(300px, 1fr))';
    }

    
    update_status(message) {
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
    
    show_image_lightbox(imageUrl) {
        console.log('📷 Showing lightbox for:', imageUrl);
        
        // Create lightbox overlay
        const lightbox = document.createElement('div');
        lightbox.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            cursor: pointer;
        `;
        
        // Create image element
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.cssText = `
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        `;
        
        // Create close button
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 30px;
            color: white;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            z-index: 10001;
        `;
        
        // Add elements to lightbox safely
        try {
            lightbox.appendChild(img);
            lightbox.appendChild(closeBtn);
        } catch (error) {
            console.error('Error adding elements to lightbox:', error);
            return;
        }

        lightbox.appendChild(closeBtn);
        
        // Add event listeners
        const closeLightbox = () => {
            document.body.removeChild(lightbox);
            document.body.style.overflow = '';
        };
        
        lightbox.addEventListener('click', closeLightbox);
        closeBtn.addEventListener('click', closeLightbox);
        
        // Prevent closing when clicking on image
        img.addEventListener('click', (e) => e.stopPropagation());
        
        // Add to DOM
        // Add to DOM safely
        try {
            document.body.appendChild(lightbox);
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error adding lightbox to DOM:', error);
            return;
        }
        
        // ESC key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Apply custom CSS from form builder configuration
    apply_form_builder_styles() {
        if (this.form_config && this.form_config.custom_css) {
            // Remove any existing form builder styles
            const existingStyle = document.getElementById('form-builder-custom-css');
            if (existingStyle) {
                existingStyle.remove();
            }
            
            // Add new custom styles
            const styleElement = document.createElement('style');
            styleElement.id = 'form-builder-custom-css';
            styleElement.textContent = this.form_config.custom_css;
            try {
                document.head.appendChild(styleElement);
                console.log('🎨 Applied custom CSS from form builder');
            } catch (error) {
                console.error('Error applying custom CSS:', error);
            }
        }
    }
    
    // Safe DOM operation helper
    safe_dom_operation(operation, errorMessage = 'DOM operation failed') {
        try {
            return operation();
        } catch (error) {
            console.error(errorMessage, error);
            return null;
        }
    }
    
    show_error(message) {
        const content = document.getElementById('record-content');
        if (content) {
            content.innerHTML = `
                <div class="text-center" style="padding: 50px;">
                    <i class="fa fa-exclamation-triangle fa-3x text-danger"></i>
                    <h4 style="margin-top: 20px; color: #d9534f;">${message}</h4>
                    <button class="btn btn-default" onclick="window.history.back()" style="margin-top: 20px;">
                        ← Go Back
                    </button>
                </div>
            `;
        }
    }
    
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}
