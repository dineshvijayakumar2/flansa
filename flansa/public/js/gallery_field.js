/**
 * Modern Gallery Field Component for Flansa Forms
 * Implements drag-drop functionality and responsive gallery view
 */

frappe.ui.form.ControlGallery = class ControlGallery extends frappe.ui.form.ControlData {
    constructor(opts) {
        super(opts);
        this.gallery_data = [];
        this.max_files = 10;
    }

    make_input() {
        this.make_gallery_container();
        this.bind_events();
        this.load_gallery_data();
    }

    make_gallery_container() {
        this.$wrapper.html(`
            <div class="flansa-gallery-field" data-fieldname="${this.df.fieldname}">
                <div class="gallery-header">
                    <label class="control-label">${this.df.label || this.df.fieldname}</label>
                    <button type="button" class="btn btn-sm btn-primary add-gallery-btn">
                        <i class="fa fa-plus"></i> Add Images
                    </button>
                </div>
                <div class="gallery-container">
                    <div class="gallery-grid" id="gallery-${this.df.fieldname}">
                        <!-- Gallery items will be rendered here -->
                    </div>
                    <div class="gallery-drop-zone" style="display: none;">
                        <div class="drop-zone-content">
                            <i class="fa fa-cloud-upload fa-3x"></i>
                            <p>Drag & drop images here</p>
                            <small>Or click to browse files</small>
                        </div>
                        <input type="file" multiple accept="image/*" class="gallery-file-input">
                    </div>
                </div>
                <input type="hidden" class="gallery-data-input" name="${this.df.fieldname}">
            </div>
        `);

        this.$gallery_grid = this.$wrapper.find('.gallery-grid');
        this.$drop_zone = this.$wrapper.find('.gallery-drop-zone');
        this.$file_input = this.$wrapper.find('.gallery-file-input');
        this.$data_input = this.$wrapper.find('.gallery-data-input');
    }

    bind_events() {
        const self = this;

        // Add images button
        this.$wrapper.find('.add-gallery-btn').on('click', function() {
            self.$file_input.click();
        });

        // File input change
        this.$file_input.on('change', function(e) {
            self.handle_file_selection(e.target.files);
        });

        // Drag and drop events
        this.$drop_zone.on('dragover', function(e) {
            e.preventDefault();
            $(this).addClass('dragover');
        });

        this.$drop_zone.on('dragleave', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
        });

        this.$drop_zone.on('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('dragover');
            const files = e.originalEvent.dataTransfer.files;
            self.handle_file_selection(files);
        });

        // Show drop zone on drag enter
        this.$wrapper.on('dragenter', function(e) {
            e.preventDefault();
            self.$drop_zone.show();
        });

        // Hide drop zone when not dragging
        $(document).on('dragend', function() {
            self.$drop_zone.hide();
        });
    }

    handle_file_selection(files) {
        const self = this;
        
        if (!files || files.length === 0) return;

        // Check max files limit
        if (this.gallery_data.length + files.length > this.max_files) {
            frappe.msgprint(`Maximum ${this.max_files} files allowed`);
            return;
        }

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                this.upload_file(file);
            }
        });
    }

    upload_file(file) {
        const self = this;
        
        // Show upload progress
        const $progress_item = $(`
            <div class="gallery-item uploading">
                <div class="upload-progress">
                    <i class="fa fa-spinner fa-spin"></i>
                    <small>Uploading...</small>
                </div>
            </div>
        `);
        this.$gallery_grid.append($progress_item);

        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('doctype', this.frm.doctype);
        formData.append('docname', this.frm.docname || 'temp');
        formData.append('fieldname', this.df.fieldname);

        // Upload file
        frappe.call({
            url: '/api/method/upload_file',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                $progress_item.remove();
                
                if (response.message) {
                    const file_data = {
                        file_url: response.message.file_url,
                        file_name: response.message.file_name,
                        file_size: response.message.file_size || 0,
                        description: '',
                        sort_order: self.gallery_data.length
                    };
                    
                    self.gallery_data.push(file_data);
                    self.render_gallery_item(file_data);
                    self.update_data_input();
                }
            },
            error: function(xhr) {
                $progress_item.remove();
                frappe.msgprint('Upload failed: ' + xhr.responseText);
            }
        });
    }

    render_gallery_item(item, index) {
        const self = this;
        // Use enhanced image URL processing
        const image_src = this.get_enhanced_image_src(item);
        const $item = $(`
            <div class="gallery-item" data-index="${index || this.gallery_data.length - 1}">
                <div class="gallery-image">
                    <img src="${image_src}" alt="${item.description || item.file_name}" loading="lazy">
                </div>
                <div class="gallery-overlay">
                    <button type="button" class="btn btn-sm btn-light edit-btn" title="Edit">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-danger remove-btn" title="Remove">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
                <div class="gallery-meta">
                    <input type="text" class="form-control form-control-sm description-input" 
                           placeholder="Add description..." value="${item.description || ''}" 
                           style="font-size: 11px;">
                </div>
            </div>
        `);

        // Bind item events
        $item.find('.remove-btn').on('click', function() {
            const index = parseInt($item.data('index'));
            self.remove_gallery_item(index);
        });

        $item.find('.edit-btn').on('click', function() {
            self.edit_gallery_item($item);
        });

        $item.find('.description-input').on('change', function() {
            const index = parseInt($item.data('index'));
            if (self.gallery_data[index]) {
                self.gallery_data[index].description = $(this).val();
                self.update_data_input();
            }
        });

        this.$gallery_grid.append($item);
        return $item;
    }

    remove_gallery_item(index) {
        const self = this;
        frappe.confirm('Remove this image?', function() {
            self.gallery_data.splice(index, 1);
            self.render_gallery();
            self.update_data_input();
        });
    }

    edit_gallery_item($item) {
        const index = parseInt($item.data('index'));
        const item = this.gallery_data[index];
        
        const dialog = new frappe.ui.Dialog({
            title: 'Edit Image',
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'description',
                    label: 'Description',
                    default: item.description || ''
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview',
                    options: `<img src="${this.get_enhanced_image_src(item)}" style="max-width: 100%; height: auto; border-radius: 4px;">`
                }
            ],
            primary_action: (values) => {
                item.description = values.description;
                $item.find('.description-input').val(values.description);
                this.update_data_input();
                dialog.hide();
            }
        });
        dialog.show();
    }

    load_gallery_data() {
        try {
            const value = this.get_value();
            if (value) {
                this.gallery_data = this.parse_gallery_value(value);
            } else {
                this.gallery_data = [];
            }
            this.render_gallery();
        } catch (e) {
            console.error('Error loading gallery data:', e);
            this.gallery_data = [];
        }
    }
    
    parse_gallery_value(value) {
        // Enhanced parsing for different data formats
        if (!value || value === '' || value === 'null' || value === 'undefined') {
            return [];
        }
        
        // If value is already an array, return it
        if (Array.isArray(value)) {
            return value;
        }
        
        // Try to parse as JSON first
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (Array.isArray(parsed)) {
                return parsed;
            }
            // If parsed is a single object, wrap in array
            if (typeof parsed === 'object' && parsed !== null) {
                return [parsed];
            }
        } catch (e) {
            console.warn('Failed to parse gallery value as JSON, trying alternative parsing:', value, e);
            
            // Try enhanced image processing for complex formats
            const processed_urls = this.extract_all_image_urls(value);
            if (processed_urls.length > 0) {
                // Convert URLs back to gallery objects
                return processed_urls.map((url, index) => ({
                    file_url: url,
                    file_name: `Image_${index + 1}`,
                    file_size: 0,
                    description: '',
                    sort_order: index
                }));
            }
        }
        
        return [];
    }
    
    extract_all_image_urls(image_value) {
        if (!image_value) return [];
        
        let processed_value = image_value;
        
        // Handle different data formats
        if (typeof image_value === 'object') {
            if (Array.isArray(image_value)) {
                const urls = [];
                image_value.forEach((item) => {
                    const url = this.get_single_image_url(item);
                    if (url && url !== '/assets/frappe/images/default-avatar.png') {
                        urls.push(url);
                    }
                });
                return urls;
            } else {
                const url = this.get_single_image_url(image_value);
                return url && url !== '/assets/frappe/images/default-avatar.png' ? [url] : [];
            }
        }
        
        // Convert to string and process
        processed_value = String(processed_value).trim();
        
        // Handle JSON strings that contain arrays
        if (processed_value.startsWith('[') && processed_value.endsWith(']')) {
            try {
                const parsed = JSON.parse(processed_value);
                if (Array.isArray(parsed)) {
                    const urls = [];
                    parsed.forEach((item) => {
                        const url = this.get_single_image_url(item);
                        if (url && url !== '/assets/frappe/images/default-avatar.png') {
                            urls.push(url);
                        }
                    });
                    return urls;
                }
            } catch (e) {
                // Failed to parse
            }
        }
        
        // Handle single image case
        const single_url = this.get_single_image_url(processed_value);
        return single_url && single_url !== '/assets/frappe/images/default-avatar.png' ? [single_url] : [];
    }
    
    get_single_image_url(image_value) {
        if (!image_value) return '/assets/frappe/images/default-avatar.png';
        
        // If it's an object, extract file_url
        if (typeof image_value === 'object') {
            return image_value.file_url || image_value.url || image_value.name || '/assets/frappe/images/default-avatar.png';
        }
        
        // Convert to string and process
        const str_value = String(image_value).trim();
        
        // Handle JSON object strings
        if (str_value.startsWith('{') && str_value.endsWith('}')) {
            try {
                const parsed = JSON.parse(str_value);
                return parsed.file_url || parsed.url || parsed.name || '/assets/frappe/images/default-avatar.png';
            } catch (e) {
                // Try regex extraction for Python-style dicts
                const fileUrlMatch = str_value.match(/'file_url':\s*'([^']+)'/);
                if (fileUrlMatch) {
                    return fileUrlMatch[1];
                }
            }
        }
        
        // Handle direct file paths
        if (str_value.startsWith('http://') || str_value.startsWith('https://')) {
            return str_value;
        } else if (str_value.startsWith('/files/')) {
            return `${window.location.origin}${str_value}`;
        } else if (str_value.startsWith('/assets/') || str_value.startsWith('/images/')) {
            return `${window.location.origin}${str_value}`;
        } else if (str_value && !str_value.includes(' ')) {
            // Assume it's a file path if it doesn't contain spaces
            return `${window.location.origin}/files/${str_value}`;
        }
        
        return '/assets/frappe/images/default-avatar.png';
    }
    
    get_enhanced_image_src(item) {
        // Enhanced version that handles more image formats
        if (!item) return '/assets/frappe/images/default-avatar.png';
        
        // For gallery field objects, try multiple properties
        if (typeof item === 'object') {
            // First try the direct file_url or data properties
            if (item.file_url) return item.file_url;
            if (item.data) return item.data;
            if (item.url) return item.url;
            
            // Then try processing any raw value stored in the object
            if (item.raw_value) {
                const processed_urls = this.extract_all_image_urls(item.raw_value);
                if (processed_urls.length > 0) return processed_urls[0];
            }
            
            // Finally try the name field as a file path
            if (item.file_name) return this.get_single_image_url(item.file_name);
            if (item.name) return this.get_single_image_url(item.name);
        }
        
        // For string values, process them
        return this.get_single_image_url(item);
    }

    render_gallery() {
        this.$gallery_grid.empty();
        this.gallery_data.forEach((item, index) => {
            this.render_gallery_item(item, index);
        });
    }

    update_data_input() {
        const json_data = JSON.stringify(this.gallery_data);
        this.$data_input.val(json_data);
        
        // Update the actual form field
        if (this.frm && this.frm.doc) {
            this.frm.doc[this.df.fieldname] = json_data;
        }
    }

    get_value() {
        return this.$data_input.val() || this.value || '';
    }

    set_value(value) {
        this.value = value;
        if (this.$data_input) {
            this.$data_input.val(value || '');
            this.load_gallery_data();
        }
    }
};

// Register the control
frappe.ui.form.make_control = (function(original_make_control) {
    return function(opts) {
        if (opts.df && opts.df.fieldtype === 'Gallery') {
            return new frappe.ui.form.ControlGallery(opts);
        }
        return original_make_control.call(this, opts);
    };
})(frappe.ui.form.make_control);