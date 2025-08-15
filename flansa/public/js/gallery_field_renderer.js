/**
 * Gallery Field Renderer for Flansa
 * Enhances Long Text fields marked as galleries to support multi-image upload and display
 * Similar to Airtable's image gallery functionality
 * 
 * Future-Compatible Design:
 * - Defensive coding with try-catch blocks
 * - Feature detection before using APIs
 * - Graceful degradation for missing features
 * - Error handling without breaking the form
 * - Compatible with multiple Frappe versions
 */

// Version and compatibility info
const FLANSA_GALLERY_VERSION = '1.0.0';
const REQUIRED_FRAPPE_FEATURES = ['frappe.ui.form.on', 'frappe.call', 'frappe.utils.get_random'];

// Utility functions for future compatibility
const GalleryUtils = {
    // Safe feature detection - fixed to check frappe namespace
    hasFeature: function(feature_path) {
        try {
            const parts = feature_path.split('.');
            let obj = window;
            for (const part of parts) {
                if (!obj || typeof obj[part] === 'undefined') return false;
                obj = obj[part];
            }
            return true;
        } catch (e) {
            return false;
        }
    },
    
    // Safe API calls
    safeCall: function(fn, args = [], fallback = null) {
        try {
            return fn.apply(this, args);
        } catch (e) {
            console.warn('Gallery renderer safe call failed:', e);
            return fallback;
        }
    },
    
    // Check if Frappe core functions are available (non-blocking)
    checkCompatibility: function() {
        const missing = REQUIRED_FRAPPE_FEATURES.filter(feature => !this.hasFeature(feature));
        if (missing.length > 0) {
            console.warn('Gallery renderer missing some features (will use fallbacks):', missing);
            // Don't return false - continue with fallbacks
        }
        return true; // Always return true to allow execution with fallbacks
    },
    
    // Fallback for get_random if not available
    getRandomId: function(length = 8) {
        if (frappe && frappe.utils && frappe.utils.get_random) {
            return frappe.utils.get_random(length);
        }
        // Fallback implementation
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // Safe DOM manipulation
    safeFind: function($element, selector) {
        try {
            return $element && $element.find ? $element.find(selector) : $();
        } catch (e) {
            console.warn('Safe find failed:', e);
            return $();
        }
    },
    
    // Safe form field access
    safeGetField: function(frm, fieldname) {
        try {
            if (!frm || !frm.get_field || typeof frm.get_field !== 'function') return null;
            return frm.get_field(fieldname);
        } catch (e) {
            console.warn('Safe get field failed:', e);
            return null;
        }
    }
};

// Streamlined field value update - relies primarily on server-side clearing
function updateFieldValue(frm, fieldname, value) {
    console.log(`🔧 Updating field ${fieldname} (client-side)`);
    
    try {
        // Simple client-side update for immediate UI feedback
        frm.doc[fieldname] = value;
        
        // Use Frappe's set_value if available
        if (frm.set_value && typeof frm.set_value === 'function') {
            frm.set_value(fieldname, value);
        }
        
        // Mark form as dirty to indicate changes
        if (frm.dirty) frm.dirty();
        
        console.log('✅ Client-side field update completed');
        
    } catch (e) {
        console.error('❌ Error in updateFieldValue:', e);
    }
}

// Gallery operation queue - stores operations to be executed on save
const GalleryOperationQueue = {
    queues: {}, // Stores queues per field: { fieldname: { uploads: [], deletions: [] } }
    
    addUpload: function(frm, fieldname, file_info) {
        if (!this.queues[fieldname]) {
            this.queues[fieldname] = { uploads: [], deletions: [] };
        }
        this.queues[fieldname].uploads.push(file_info);
        console.log(`📎 Queued upload for ${fieldname}:`, file_info.name);
    },
    
    addDeletion: function(frm, fieldname, file_name) {
        if (!this.queues[fieldname]) {
            this.queues[fieldname] = { uploads: [], deletions: [] };
        }
        this.queues[fieldname].deletions.push(file_name);
        console.log(`🗑️ Queued deletion for ${fieldname}:`, file_name);
    },
    
    clearQueue: function(fieldname) {
        if (this.queues[fieldname]) {
            this.queues[fieldname] = { uploads: [], deletions: [] };
            console.log(`🧹 Cleared queue for ${fieldname}`);
        }
    },
    
    processQueue: function(frm, fieldname, callback) {
        const queue = this.queues[fieldname];
        if (!queue || (queue.uploads.length === 0 && queue.deletions.length === 0)) {
            console.log(`✅ No pending operations for ${fieldname}`);
            if (callback) callback(true);
            return;
        }
        
        console.log(`⚙️ Processing queue for ${fieldname}: ${queue.uploads.length} uploads, ${queue.deletions.length} deletions`);
        
        // Process deletions first
        let deletion_count = 0;
        const total_deletions = queue.deletions.length;
        
        if (total_deletions > 0) {
            queue.deletions.forEach(file_name => {
                delete_file_attachment_with_callback(file_name, () => {
                    deletion_count++;
                    console.log(`✅ Deleted ${deletion_count}/${total_deletions}: ${file_name}`);
                    
                    if (deletion_count >= total_deletions) {
                        // All deletions done, now process uploads
                        processUploads();
                    }
                });
            });
        } else {
            // No deletions, directly process uploads
            processUploads();
        }
        
        function processUploads() {
            // For now, uploads are already done immediately for better UX
            // Just clear the queue
            GalleryOperationQueue.clearQueue(fieldname);
            console.log(`✅ Queue processed for ${fieldname}`);
            if (callback) callback(true);
        }
    }
};

// Deferred gallery field update - only updates client-side, server update happens on save
function updateGalleryFieldDeferred(frm, fieldname, gallery_data, callback) {
    console.log('🖼️ Updating gallery field (deferred mode)...');
    
    try {
        // Convert array to JSON string if needed
        const data_to_send = Array.isArray(gallery_data) ? JSON.stringify(gallery_data) : gallery_data;
        
        // Only update client-side for immediate feedback
        updateFieldValue(frm, fieldname, data_to_send);
        
        console.log('✅ Gallery field updated client-side (will sync on save)');
        if (callback) callback(true, 'deferred_update');
        
    } catch (e) {
        console.error('❌ Error in updateGalleryFieldDeferred:', e);
        if (callback) callback(false, e);
    }
}


// Alternative approach: Hook into form setup instead of using frappe.ui.form.on
function setup_gallery_fields() {
    // console.log('🔍 Setting up gallery field enhancement...');  // Reduced logging
    
    // Override the form's refresh method to add gallery enhancement
    const original_setup = frappe.ui.form.Layout.prototype.make_fields;
    
    frappe.ui.form.Layout.prototype.make_fields = function() {
        const result = original_setup.call(this);
        
        // Add gallery enhancement after fields are created
        if (this.frm && this.frm.meta && this.frm.meta.fields) {
            console.log('🔍 Gallery renderer: Checking form', this.frm.doctype, 'for gallery fields...');
            
            let galleryFieldsFound = 0;
            let longTextFieldsFound = 0;
            
            this.frm.meta.fields.forEach(field => {
                if (field.fieldtype === 'Long Text') {
                    longTextFieldsFound++;
                    console.log(`📝 Found Long Text field: ${field.fieldname} (${field.label})`);
                    
                    if (field.description) {
                        console.log(`   Description preview: ${field.description.substring(0, 100)}...`);
                        
                        if (is_gallery_field(field)) {
                            galleryFieldsFound++;
                            console.log(`🖼️  GALLERY FIELD DETECTED: ${field.fieldname}`);
                            // Delay enhancement slightly to ensure field is rendered
                            setTimeout(() => {
                                enhance_gallery_field(this.frm, field);
                            }, 100);
                        } else {
                            console.log(`   Not a gallery field`);
                        }
                    } else {
                        console.log(`   No description`);
                    }
                }
            });
            
            console.log(`📊 Summary: Found ${longTextFieldsFound} Long Text fields, ${galleryFieldsFound} gallery fields`);
            
            if (galleryFieldsFound === 0 && longTextFieldsFound > 0) {
                console.log('⚠️  No gallery fields detected despite having Long Text fields. Check field descriptions.');
            }
            
            // Hook into before_save to process gallery operations (only once per form)
            if (galleryFieldsFound > 0 && !this.frm._gallery_save_hooked) {
                this.frm._gallery_save_hooked = true;
                console.log('🔗 Hooking into form save for gallery operations...');
                
                // Try multiple hook points to ensure we catch the save event
                const frm = this.frm;
                
                // Method 1: Hook into events
                frm.events = frm.events || {};
                const original_after_save_event = frm.events.after_save;
                
                frm.events.after_save = function(frm) {
                    console.log('🎯 Gallery after_save EVENT triggered!');
                    processGalleryDeletions(frm);
                    
                    if (original_after_save_event) {
                        original_after_save_event(frm);
                    }
                };
                
                // Method 2: Override save_or_update
                const original_save_or_update = frm.save_or_update;
                frm.save_or_update = function() {
                    console.log('🎯 Gallery save_or_update triggered!');
                    
                    // Call original save
                    const result = original_save_or_update.apply(this, arguments);
                    
                    // Process deletions after a delay
                    setTimeout(() => {
                        console.log('🎯 Processing deletions after save_or_update...');
                        processGalleryDeletions(this);
                    }, 1000);
                    
                    return result;
                };
                
                // Method 3: Use frappe.after_ajax
                frappe.after_ajax(() => {
                    console.log('🎯 After AJAX callback - checking for completed save...');
                    if (frm.doc.__saved) {
                        processGalleryDeletions(frm);
                        frm.doc.__saved = false; // Reset flag
                    }
                });
                
                // Define the deletion processing function
                function processGalleryDeletions(frm) {
                    console.log('🔄 EXECUTING gallery deletions after save...');
                    
                    // Find all gallery fields
                    const gallery_fields = frm.meta.fields.filter(f => 
                        f.fieldtype === 'Long Text' && 
                        f.description && 
                        f.description.includes('is_gallery')
                    );
                    
                    // Process each gallery field's queue
                    gallery_fields.forEach(field => {
                        const queue = GalleryOperationQueue.queues[field.fieldname];
                        if (queue && queue.deletions.length > 0) {
                            console.log(`🗑️ Processing ${queue.deletions.length} file deletions for ${field.fieldname}`);
                            
                            // Delete files immediately after save
                            let processed = 0;
                            queue.deletions.forEach((file_name, idx) => {
                                // Stagger deletions slightly to avoid overwhelming server
                                setTimeout(() => {
                                    console.log(`🔥 Deleting file ${idx + 1}/${queue.deletions.length}: ${file_name}`);
                                    delete_file_attachment_with_callback(file_name, (success) => {
                                        processed++;
                                        if (success !== false) {
                                            console.log(`✅ Deleted file ${processed}/${queue.deletions.length}: ${file_name}`);
                                        } else {
                                            console.warn(`❌ Failed to delete file: ${file_name}`);
                                        }
                                        
                                        // Show completion message when all done
                                        if (processed === queue.deletions.length) {
                                            frappe.show_alert(`${processed} file(s) deleted successfully`, 'green');
                                        }
                                    });
                                }, idx * 200); // 200ms between each deletion
                            });
                            
                            // Clear the queue after scheduling deletions
                            GalleryOperationQueue.clearQueue(field.fieldname);
                        }
                    });
                    
                    console.log('✅ Gallery deletion processing complete');
                };
            }
        }
        
        return result;
    };
}

// Global handler for all doctypes to process gallery deletions after save
$(document).on('form-save-after', function(e, frm) {
    console.log('🎯 Global form-save-after event triggered for:', frm.doctype);
    
    // Check if this form has gallery fields
    const gallery_fields = frm.meta.fields.filter(f => 
        f.fieldtype === 'Long Text' && 
        f.description && 
        f.description.includes('is_gallery')
    );
    
    if (gallery_fields.length > 0) {
        console.log('🖼️ Processing gallery deletions for form with gallery fields...');
        
        gallery_fields.forEach(field => {
            const queue = GalleryOperationQueue.queues[field.fieldname];
            if (queue && queue.deletions.length > 0) {
                console.log(`🗑️ Found ${queue.deletions.length} files to delete for ${field.fieldname}`);
                
                // Process deletions
                let processed = 0;
                const total = queue.deletions.length;
                
                queue.deletions.forEach((file_name, idx) => {
                    // Delete with slight delay
                    setTimeout(() => {
                        console.log(`🔥 Deleting ${idx + 1}/${total}: ${file_name}`);
                        
                        frappe.call({
                            method: 'frappe.client.delete',
                            args: {
                                doctype: 'File',
                                name: file_name
                            },
                            callback: function(r) {
                                processed++;
                                if (!r.exc) {
                                    console.log(`✅ Deleted ${processed}/${total}: ${file_name}`);
                                } else {
                                    console.warn(`❌ Failed to delete: ${file_name}`, r.exc);
                                }
                                
                                if (processed === total) {
                                    frappe.show_alert(`${processed} file(s) deleted`, 'green');
                                }
                            }
                        });
                    }, idx * 100);
                });
                
                // Clear queue after processing
                GalleryOperationQueue.clearQueue(field.fieldname);
            }
        });
    }
});

// Also try the traditional form.on approach as fallback
frappe.ui.form.on('*', {
    refresh: function(frm) {
        console.log('🔍 Gallery renderer: Traditional form refresh called for', frm.doctype);
        
        // Find all Long Text fields marked as galleries and enhance them
        let galleryFieldsFound = 0;
        let longTextFieldsFound = 0;
        
        frm.meta.fields.forEach(field => {
            if (field.fieldtype === 'Long Text') {
                longTextFieldsFound++;
                console.log(`📝 Found Long Text field: ${field.fieldname} (${field.label})`);
                
                if (field.description) {
                    console.log(`   Description preview: ${field.description.substring(0, 100)}...`);
                    
                    if (is_gallery_field(field)) {
                        galleryFieldsFound++;
                        console.log(`🖼️  GALLERY FIELD DETECTED: ${field.fieldname}`);
                        enhance_gallery_field(frm, field);
                    } else {
                        console.log(`   Not a gallery field`);
                    }
                } else {
                    console.log(`   No description`);
                }
            }
        });
        
        console.log(`📊 Summary: Found ${longTextFieldsFound} Long Text fields, ${galleryFieldsFound} gallery fields`);
        
        if (galleryFieldsFound === 0 && longTextFieldsFound > 0) {
            console.log('⚠️  No gallery fields detected despite having Long Text fields. Check field descriptions.');
        }
    }
});

// Inject CSS to prevent gallery field flash before JavaScript loads
function injectGalleryCSS() {
    if (document.getElementById('flansa-gallery-preload-css')) return; // Already injected
    
    const css = `
        /* Hide Long Text fields that will become gallery fields */
        .form-group[data-fieldtype="Long Text"] .control-input {
            transition: opacity 0.3s ease;
        }
        
        /* Gallery field enhanced marker */
        .flansa-gallery-enhanced .control-input {
            display: none !important;
        }
        
        /* Smooth gallery loading */
        .flansa-gallery-container {
            opacity: 0;
            animation: galleryFadeIn 0.3s ease forwards;
        }
        
        @keyframes galleryFadeIn {
            to { opacity: 1; }
        }
    `;
    
    const style = document.createElement('style');
    style.id = 'flansa-gallery-preload-css';
    style.textContent = css;
    document.head.appendChild(style);
}

// Initialize gallery field setup with compatibility checks
function initializeGalleryRenderer() {
    // console.log(`🚀 Initializing Flansa Gallery Renderer v${FLANSA_GALLERY_VERSION}...`);  // Reduced logging
    
    // Inject CSS first to prevent field flash
    injectGalleryCSS();
    
    // Check compatibility but continue anyway with fallbacks
    GalleryUtils.checkCompatibility();
    
    // Check required global objects
    if (typeof frappe === 'undefined') {
        console.warn('Gallery renderer: frappe object not available, retrying...');
        setTimeout(initializeGalleryRenderer, 1000);
        return;
    }
    
    if (typeof $ === 'undefined') {
        console.warn('Gallery renderer: jQuery not available');
        return;
    }
    
    console.log('✅ Gallery renderer compatibility check passed');
    setup_gallery_fields();
}

// Inject CSS immediately when script loads to prevent any flash
injectGalleryCSS();

// Multiple initialization approaches for maximum compatibility
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGalleryRenderer);
} else {
    // DOM already loaded
    initializeGalleryRenderer();
}

// Fallback initialization
$(document).ready(function() {
    console.log('🚀 jQuery ready - ensuring gallery fields initialized...');
    // Only initialize if not already done
    if (!window.flansaGalleryInitialized) {
        initializeGalleryRenderer();
        window.flansaGalleryInitialized = true;
    }
});

// Track enhanced fields to prevent duplicates
let enhanced_fields = new Set();

function enhance_current_form_gallery_fields() {
    if (!cur_frm || !cur_frm.meta || !cur_frm.meta.fields) return;
    
    const form_id = `${cur_frm.doctype}_${cur_frm.docname || 'new'}`;
    
    cur_frm.meta.fields.forEach(field => {
        if (field.fieldtype === 'Long Text' && field.description && is_gallery_field(field)) {
            const field_id = `${form_id}_${field.fieldname}`;
            
            // Check if this specific field is already enhanced
            if (!enhanced_fields.has(field_id)) {
                const $field = cur_frm.get_field(field.fieldname).$wrapper;
                
                // Double check the DOM doesn't already have the gallery container
                if ($field && !$field.find('.flansa-gallery-container').length) {
                    console.log(`🖼️ Enhancing gallery field: ${field.fieldname} on form ${cur_frm.doctype}`);
                    enhance_gallery_field(cur_frm, field);
                    enhanced_fields.add(field_id);
                } else if ($field && $field.find('.flansa-gallery-container').length) {
                    // Mark as enhanced even if already exists in DOM
                    enhanced_fields.add(field_id);
                }
            }
        }
    });
}

// Clear enhanced fields when navigating to different forms
let last_form_id = '';
setInterval(function() {
    if (typeof cur_frm !== 'undefined' && cur_frm) {
        const current_form_id = `${cur_frm.doctype}_${cur_frm.docname || 'new'}`;
        
        // If we switched to a different form, clear the enhanced fields tracking
        if (current_form_id !== last_form_id) {
            enhanced_fields.clear();
            last_form_id = current_form_id;
        }
        
        enhance_current_form_gallery_fields();
    } else {
        // No current form, clear tracking
        if (last_form_id !== '') {
            enhanced_fields.clear();
            last_form_id = '';
        }
    }
}, 2000);

function is_gallery_field(field) {
    if (!field.description) return false;
    
    // Check for simple string match first (backward compatibility)
    if (field.description.includes('is_gallery')) {
        return true;
    }
    
    // Check for JSON format (new format)
    try {
        const desc_data = JSON.parse(field.description);
        
        // Check the actual structure from user's field: flansa_config.config.gallery_metadata
        if (desc_data.flansa_config && desc_data.flansa_config.config && desc_data.flansa_config.config.gallery_metadata) {
            return desc_data.flansa_config.config.gallery_metadata.is_gallery;
        }
        
        // Also check alternative structure: flansa_config.gallery_metadata (backward compatibility)
        if (desc_data.flansa_config && desc_data.flansa_config.gallery_metadata) {
            return desc_data.flansa_config.gallery_metadata.is_gallery;
        }
        
        // Direct gallery_metadata at root level
        if (desc_data.gallery_metadata) {
            return desc_data.gallery_metadata.is_gallery;
        }
        
    } catch (e) {
        // Not JSON or parse error, continue
    }
    
    return false;
}

function get_gallery_config(field) {
    if (!field.description) return {};
    
    // Try to parse JSON format first
    try {
        const desc_data = JSON.parse(field.description);
        
        // Check the actual structure from user's field: flansa_config.config.gallery_metadata
        if (desc_data.flansa_config && desc_data.flansa_config.config && desc_data.flansa_config.config.gallery_metadata) {
            return desc_data.flansa_config.config.gallery_metadata;
        }
        
        // Also check alternative structure: flansa_config.gallery_metadata (backward compatibility)
        if (desc_data.flansa_config && desc_data.flansa_config.gallery_metadata) {
            return desc_data.flansa_config.gallery_metadata;
        }
        
        // Direct gallery_metadata at root level
        if (desc_data.gallery_metadata) {
            return desc_data.gallery_metadata;
        }
        
        // Return the full config if available (for backward compatibility)
        if (desc_data.flansa_config && desc_data.flansa_config.config) {
            return desc_data.flansa_config.config;
        }
        
    } catch (e) {
        // Not JSON, try to extract from string format
        try {
            const desc_match = field.description.match(/Config: ({.*})/);
            if (desc_match) {
                return JSON.parse(desc_match[1]);
            }
        } catch (e2) {
            console.warn('Could not parse gallery config:', e2);
        }
    }
    
    // Return default config
    return {
        max_files: 10,
        allowed_extensions: 'jpg,jpeg,png,gif,webp',
        show_thumbnails: true
    };
}

function enhance_gallery_field(frm, field) {
    try {
        const fieldname = field.fieldname;
        const field_obj = GalleryUtils.safeGetField(frm, fieldname);
        
        if (!field_obj || !field_obj.$wrapper) {
            console.warn('Gallery field wrapper not found for:', fieldname);
            return;
        }
        
        const $field_wrapper = field_obj.$wrapper;
        
        // IMMEDIATELY hide the Long Text field to prevent flash
        GalleryUtils.safeFind($field_wrapper, '.control-input').hide();
        GalleryUtils.safeFind($field_wrapper, '.control-input textarea').hide();
        GalleryUtils.safeFind($field_wrapper, 'textarea').hide();
    
    if (!$field_wrapper.find('.flansa-gallery-enhanced').length) {
        // Get gallery configuration
        const gallery_config = get_gallery_config(field);
        console.log('Gallery config for field', fieldname, ':', gallery_config);
        
        // Add gallery enhancement
        $field_wrapper.addClass('flansa-gallery-enhanced');
        
        // Create gallery interface
        const gallery_html = `
            <div class="flansa-gallery-container" style="margin-top: 10px;">
                <div class="gallery-controls" style="margin-bottom: 10px;">
                    <button type="button" class="btn btn-sm btn-primary add-images-btn">
                        <i class="fa fa-plus"></i> Add Images
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary clear-gallery-btn">
                        <i class="fa fa-trash"></i> Clear All
                    </button>
                    <span class="gallery-info" style="margin-left: 10px; color: #666; font-size: 12px;">
                        Max: ${gallery_config.max_files || 'unlimited'} images
                    </span>
                </div>
                <div class="gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 10px; border: 1px solid #d1d8dd; border-radius: 4px; min-height: 80px; background: #f8f9fa;">
                    <div class="gallery-placeholder" style="display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 14px; grid-column: 1 / -1;">
                        <i class="fa fa-images" style="margin-right: 5px;"></i>
                        No images uploaded yet
                    </div>
                </div>
                <input type="file" multiple accept="image/*" style="display: none;" class="gallery-file-input">
            </div>
        `;
        
        // Insert after the JSON field
        $field_wrapper.find('.control-input').after(gallery_html);
        
        // Bind events
        const $gallery_container = $field_wrapper.find('.flansa-gallery-container');
        const $file_input = $gallery_container.find('.gallery-file-input');
        const $gallery_grid = $gallery_container.find('.gallery-grid');
        const $add_btn = $gallery_container.find('.add-images-btn');
        const $clear_btn = $gallery_container.find('.clear-gallery-btn');
        
        // Add images button
        $add_btn.on('click', function() {
            $file_input.click();
        });
        
        // File input change
        $file_input.on('change', function(e) {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                upload_gallery_images(frm, fieldname, files, gallery_config, $gallery_grid);
            }
        });
        
        // Clear gallery button - immediate deletion mode
        $clear_btn.on('click', function() {
            frappe.confirm('Clear all images from gallery? Files will be deleted immediately.', () => {
                console.log('🧹 Starting immediate gallery clear...');
                
                const images = get_gallery_images(frm, fieldname);
                
                // Delete files immediately instead of queuing
                const files_to_delete = images.filter(img => img && img.file_name);
                if (files_to_delete.length > 0) {
                    console.log(`🗑️ Deleting ${files_to_delete.length} files immediately...`);
                    
                    let deleted_count = 0;
                    files_to_delete.forEach((image, idx) => {
                        if (image.file_name) {
                            // Delete with slight delay to avoid overwhelming server
                            setTimeout(() => {
                                console.log(`🔥 Deleting file ${idx + 1}/${files_to_delete.length}: ${image.file_name}`);
                                
                                frappe.call({
                                    method: 'frappe.client.delete',
                                    args: {
                                        doctype: 'File',
                                        name: image.file_name
                                    },
                                    callback: function(r) {
                                        deleted_count++;
                                        if (!r.exc) {
                                            console.log(`✅ Deleted ${deleted_count}/${files_to_delete.length}: ${image.file_name}`);
                                        } else {
                                            console.warn(`❌ Failed to delete: ${image.file_name}`, r.exc);
                                        }
                                        
                                        if (deleted_count === files_to_delete.length) {
                                            frappe.show_alert(`${deleted_count} file(s) deleted successfully`, 'green');
                                        }
                                    },
                                    error: function(err) {
                                        deleted_count++;
                                        console.error(`❌ Error deleting ${image.file_name}:`, err);
                                    }
                                });
                            }, idx * 200); // 200ms delay between deletions
                        }
                    });
                }
                
                // Clear the field using deferred update
                updateGalleryFieldDeferred(frm, fieldname, '', (success) => {
                    if (success) {
                        frappe.show_alert('Gallery cleared - changes will be saved with the form', 'blue');
                    }
                });
                
                // Clear the UI immediately for user feedback
                $gallery_grid.html(`
                    <div class="gallery-placeholder" style="display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 14px; grid-column: 1 / -1; padding: 20px;">
                        <i class="fa fa-images" style="margin-right: 5px;"></i>
                        No images uploaded yet
                    </div>
                `);
                
                // Clear any cached references
                if (window.enhanced_fields) {
                    window.enhanced_fields.clear();
                }
            });
        });
        
        // Load existing images
        load_existing_gallery_images(frm, fieldname, $gallery_grid);
        
        // Ensure field stays hidden (already hidden above, this is redundant safety)
    }
    } catch (e) {
        console.error('Error enhancing gallery field:', field.fieldname, e);
        // Graceful degradation - don't break the form
    }
}

function upload_gallery_images(frm, fieldname, files, config, $gallery_grid) {
    const max_files = config.max_files || 10;
    const current_images = get_gallery_images(frm, fieldname);
    
    if (current_images.length + files.length > max_files) {
        frappe.msgprint(`Cannot upload ${files.length} images. Maximum allowed: ${max_files}. Current: ${current_images.length}`);
        return;
    }
    
    let uploaded_count = 0;
    const total_files = files.length;
    
    files.forEach((file, index) => {
        // Use jQuery AJAX with proper FormData for Frappe file upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('doctype', frm.doctype);
        formData.append('docname', frm.docname || '');
        formData.append('is_private', 0); // Make files public so they can be displayed
        formData.append('fieldname', fieldname);
        
        $.ajax({
            url: '/api/method/upload_file',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-Frappe-CSRF-Token': frappe.csrf_token
            },
            success: function(response) {
                try {
                    const result = typeof response === 'string' ? JSON.parse(response) : response;
                    
                    if (result.message) {
                        // Create image object with file URL instead of base64
                        const image_data = {
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            file_url: result.message.file_url,
                            file_name: result.message.name,
                            uploaded_at: new Date().toISOString(),
                            id: GalleryUtils.getRandomId(8)
                        };
                        
                        // Add to gallery
                        current_images.push(image_data);
                        
                        uploaded_count++;
                        if (uploaded_count === total_files) {
                            // All files processed - use deferred update
                            updateGalleryFieldDeferred(frm, fieldname, current_images, (success) => {
                                if (success) {
                                    render_gallery_images(current_images, $gallery_grid, frm, fieldname);
                                    frappe.show_alert(`${total_files} image(s) added - save form to persist changes`, 'blue');
                                } else {
                                    frappe.show_alert('Images uploaded but update failed', 'orange');
                                }
                            });
                        }
                    } else {
                        frappe.msgprint(`Failed to upload ${file.name}: No file information returned`);
                    }
                } catch (e) {
                    frappe.msgprint(`Failed to upload ${file.name}: Invalid response format`);
                    console.error('Upload response parsing error:', e, response);
                }
            },
            error: function(xhr, status, error) {
                let error_msg = 'Unknown error';
                
                try {
                    const response = xhr.responseJSON || JSON.parse(xhr.responseText);
                    error_msg = response.message || response.exc || error;
                } catch (e) {
                    error_msg = xhr.responseText || error;
                }
                
                frappe.msgprint(`Upload failed: ${file.name} - ${error_msg}`);
                console.error('Upload error:', {
                    status: status,
                    error: error,
                    response: xhr.responseText,
                    file: file.name
                });
            }
        });
    });
}

function get_gallery_images(frm, fieldname) {
    // Use frm.doc[fieldname] instead of frm.get_value()
    const value = frm.doc[fieldname];
    
    // Handle empty string, null, or undefined
    if (!value || value === '' || value === 'null' || value === 'undefined') {
        return [];
    }
    
    // If value is already an array, return it
    if (Array.isArray(value)) {
        return value;
    }
    
    // Try to parse as JSON first
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        // If parsed is a single object, wrap in array
        if (typeof parsed === 'object' && parsed !== null) {
            return [parsed];
        }
    } catch (e) {
        console.warn('Failed to parse gallery images JSON, trying alternative parsing:', value, e);
        
        // Try enhanced image processing for complex formats
        const processed_urls = ImageProcessingUtils.extract_all_image_urls(value);
        if (processed_urls.length > 0) {
            // Convert URLs back to image objects
            return processed_urls.map((url, index) => ({
                name: `Image_${index + 1}`,
                file_url: url,
                url: url,
                type: 'image',
                size: 0,
                uploaded_at: new Date().toISOString(),
                id: GalleryUtils.getRandomId(8)
            }));
        }
    }
    
    return [];
}

function load_existing_gallery_images(frm, fieldname, $gallery_grid) {
    const images = get_gallery_images(frm, fieldname);
    render_gallery_images(images, $gallery_grid, frm, fieldname);
}

function render_gallery_images(images, $gallery_grid, frm, fieldname) {
    $gallery_grid.empty();
    
    if (images.length === 0) {
        $gallery_grid.html(`
            <div class="gallery-placeholder" style="display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 14px; grid-column: 1 / -1; padding: 20px;">
                <i class="fa fa-images" style="margin-right: 5px;"></i>
                No images uploaded yet
            </div>
        `);
        return;
    }
    
    images.forEach((image, index) => {
        // Use enhanced image processing for better compatibility
        const image_src = ImageProcessingUtils.get_enhanced_image_src(image);
        
        const $image_item = $(`
            <div class="gallery-item" style="position: relative; border-radius: 4px; overflow: hidden; aspect-ratio: 1; background: white; border: 1px solid #e9ecef;">
                <img src="${image_src}" alt="${image.name}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="${image.name}">
                <div class="gallery-item-overlay" style="position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.7); border-radius: 0 0 0 4px;">
                    <button type="button" class="btn btn-xs text-white remove-image-btn" style="border: none; background: none; padding: 4px 6px;" title="Remove image">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `);
        
        // Click to view full size
        $image_item.find('img').on('click', function() {
            show_image_preview(image);
        });
        
        // Remove image
        $image_item.find('.remove-image-btn').on('click', function(e) {
            e.stopPropagation();
            remove_gallery_image(frm, fieldname, index, $gallery_grid);
        });
        
        $gallery_grid.append($image_item);
    });
}

function show_image_preview(image) {
    // Use enhanced image processing for better compatibility
    const image_src = ImageProcessingUtils.get_enhanced_image_src(image);
    
    const dialog = new frappe.ui.Dialog({
        title: image.name,
        size: 'large',
        fields: [
            {
                fieldtype: 'HTML',
                options: `
                    <div style="text-align: center;">
                        <img src="${image_src}" style="max-width: 100%; max-height: 60vh; border-radius: 4px;">
                        <div style="margin-top: 15px; color: #6c757d; font-size: 12px;">
                            <div>File: ${image.name}</div>
                            <div>Size: ${(image.size / 1024).toFixed(1)} KB</div>
                            <div>Uploaded: ${new Date(image.uploaded_at).toLocaleString()}</div>
                            ${image.file_url ? '<div>Type: File attachment</div>' : '<div>Type: Base64 data</div>'}
                        </div>
                    </div>
                `
            }
        ]
    });
    dialog.show();
}

function delete_file_attachment(file_name) {
    delete_file_attachment_with_callback(file_name, null);
}

function delete_file_attachment_with_callback(file_name, callback) {
    if (!file_name) {
        if (callback) callback(true); // Return success for empty file name
        return;
    }
    
    console.log('🗑️ Attempting to delete file attachment:', file_name);
    
    frappe.call({
        method: 'frappe.client.delete',
        args: {
            doctype: 'File',
            name: file_name
        },
        callback: function(response) {
            // Check if deletion was successful
            if (response && !response.exc) {
                console.log('✅ File attachment deleted successfully:', file_name);
                if (callback) callback(true);
            } else {
                console.warn('⚠️ File deletion response unclear:', file_name, response);
                if (callback) callback(true); // Still consider it success if no exception
            }
        },
        error: function(xhr, status, error) {
            // Safe error handling - xhr might be undefined
            let error_msg = 'Unknown error';
            
            try {
                if (xhr && xhr.responseJSON && xhr.responseJSON.message) {
                    error_msg = xhr.responseJSON.message;
                } else if (xhr && xhr.responseText) {
                    error_msg = xhr.responseText;
                } else if (error) {
                    error_msg = error.toString();
                }
                
                const status_code = xhr ? xhr.status : 0;
                
                if (error_msg.includes('does not exist') || 
                    error_msg.includes('not found') || 
                    status_code === 404) {
                    console.log('ℹ️ File attachment already deleted or not found:', file_name);
                } else {
                    console.warn('⚠️ Failed to delete file attachment:', file_name, error_msg);
                }
            } catch (e) {
                console.warn('⚠️ Error handling file deletion error:', file_name, e);
            }
            
            // Call callback with false to indicate failure
            if (callback) callback(false);
        }
    });
}

function remove_gallery_image(frm, fieldname, index, $gallery_grid) {
    const images = get_gallery_images(frm, fieldname);
    const image_to_remove = images[index];
    
    frappe.confirm('Remove this image from gallery?', () => {
        // Delete file immediately
        if (image_to_remove && image_to_remove.file_name) {
            console.log('🗑️ Deleting file immediately:', image_to_remove.file_name);
            
            frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: 'File',
                    name: image_to_remove.file_name
                },
                callback: function(r) {
                    if (!r.exc) {
                        console.log('✅ File deleted successfully:', image_to_remove.file_name);
                        frappe.show_alert('Image removed successfully', 'green');
                    } else {
                        console.warn('❌ Failed to delete file:', image_to_remove.file_name, r.exc);
                        frappe.show_alert('Image removed from gallery', 'orange');
                    }
                },
                error: function(err) {
                    console.error('❌ Error deleting file:', err);
                    frappe.show_alert('Image removed from gallery', 'orange');
                }
            });
        }
        
        // Remove from UI immediately
        complete_image_removal();
        
        function complete_image_removal() {
            // Remove from gallery array
            images.splice(index, 1);
            
            // Update the field using deferred approach
            updateGalleryFieldDeferred(frm, fieldname, images);
            
            // Re-render the gallery
            render_gallery_images(images, $gallery_grid, frm, fieldname);
            
            // Force field refresh after a moment
            setTimeout(() => {
                frm.refresh_field(fieldname);
                console.log('Gallery field after image removal:', frm.doc[fieldname]);
            }, 100);
            
            frappe.show_alert('Image removed completely', 'green');
        }
    });
}

// Enhanced image URL processing functions (from report viewer)
const ImageProcessingUtils = {
    extract_all_image_urls: function(image_value) {
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
    },
    
    get_single_image_url: function(image_value) {
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
    },
    
    get_enhanced_image_src: function(image) {
        // Enhanced version that handles more image formats
        if (!image) return '/assets/frappe/images/default-avatar.png';
        
        // For gallery field objects, try multiple properties
        if (typeof image === 'object') {
            // First try the direct file_url or data properties
            if (image.file_url) return image.file_url;
            if (image.data) return image.data;
            if (image.url) return image.url;
            
            // Then try processing any raw value stored in the object
            if (image.raw_value) {
                const processed_urls = this.extract_all_image_urls(image.raw_value);
                if (processed_urls.length > 0) return processed_urls[0];
            }
            
            // Finally try the name field as a file path
            if (image.name) return this.get_single_image_url(image.name);
        }
        
        // For string values, process them
        return this.get_single_image_url(image);
    }
};

// Export version info for debugging
window.FlansaGalleryRenderer = {
    version: FLANSA_GALLERY_VERSION,
    utils: GalleryUtils,
    imageUtils: ImageProcessingUtils,
    updateFieldValue: updateFieldValue
};

console.log(`✅ Flansa Gallery Field Renderer v${FLANSA_GALLERY_VERSION} loaded successfully`);
console.log('🔧 Features available:', {
    'frappe.ui.form': GalleryUtils.hasFeature('frappe.ui.form'),
    'frappe.ui.form.on': GalleryUtils.hasFeature('frappe.ui.form.on'),
    'frappe.call': GalleryUtils.hasFeature('frappe.call'),
    'frappe.utils.get_random': GalleryUtils.hasFeature('frappe.utils.get_random'),
    'jQuery': typeof $ !== 'undefined'
});