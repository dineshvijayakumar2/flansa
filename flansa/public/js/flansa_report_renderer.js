/**
 * Flansa Report Renderer - Shared display component for consistent report rendering
 * Used by both Report Builder preview and Report Viewer
 */

window.FlansaReportRenderer = {
    
    /**
     * Main rendering function - determines and renders appropriate view
     */
    render(data, config = {}) {
        if (data.is_grouped && data.groups) {
            return this.renderGroupedView(data, config);
        } else {
            return this.renderTableView(data, config);
        }
    },

    /**
     * Render modern grouped report view with collapsible sections
     */
    renderGroupedView(data, config = {}) {
        const {
            showActions = false,
            tableClass = 'table table-sm',
            onRecordClick = null
        } = config;

        const grouping = data.grouping;
        const groups = data.groups;
        
        let html = `
            <div class="grouped-report-container">
                <!-- Summary Cards -->
                <div class="report-summary">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fa fa-layer-group"></i>
                                </div>
                                <div class="summary-content">
                                    <h6>Groups</h6>
                                    <span class="summary-value">${data.total_groups}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fa fa-database"></i>
                                </div>
                                <div class="summary-content">
                                    <h6>Total Records</h6>
                                    <span class="summary-value">${data.total}</span>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="summary-card">
                                <div class="summary-icon">
                                    <i class="fa fa-tags"></i>
                                </div>
                                <div class="summary-content">
                                    <h6>Grouped By</h6>
                                    <span class="summary-value">${grouping.field_label}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Groups Container -->
                <div class="groups-container">
        `;
        
        groups.forEach((group, index) => {
            const aggregateDisplay = group.aggregate ? 
                ` • ${group.aggregate_type}: ${parseFloat(group.aggregate).toFixed(2)}` : '';
            
            html += `
                <div class="group-section" data-group-index="${index}">
                    <div class="group-header" onclick="FlansaReportRenderer.toggleGroup(${index})">
                        <div class="group-header-left">
                            <i class="fa fa-chevron-down group-toggle-icon" id="toggle-${index}"></i>
                            <div class="group-title">
                                <strong>${this.formatValue(group.group_label) || '(Empty)'}</strong>
                                <span class="group-meta">${group.count} records${aggregateDisplay}</span>
                            </div>
                        </div>
                        <div class="group-header-right">
                            ${group.has_more ? '<span class="more-indicator">+more</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="group-content" id="group-content-${index}">
                        ${this.renderGroupTable(group, data.fields, showActions, tableClass, onRecordClick)}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
            ${this.getGroupedViewStyles()}
        `;
        
        return html;
    },

    /**
     * Render table for a single group
     */
    renderGroupTable(group, fields, showActions, tableClass, onRecordClick) {
        if (!group.records || group.records.length === 0) {
            return `
                <div class="empty-group">
                    <i class="fa fa-inbox"></i>
                    <p>No records in this group</p>
                </div>
            `;
        }

        let html = `
            <div class="table-responsive">
                <table class="${tableClass}">
                    <thead class="thead-light">
                        <tr>
                            ${fields.map(field => `<th>${field.custom_label || field.field_label || field.fieldname}</th>`).join('')}
                            ${showActions ? '<th width="120">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        group.records.forEach((record, index) => {
            const recordId = record.name || `record-${index}`;
            const clickHandler = onRecordClick ? `onclick="(${onRecordClick})('${recordId}')"` : '';
            
            html += `<tr ${clickHandler ? `class="clickable-row" ${clickHandler}` : ''}>`;
            
            fields.forEach(field => {
                const value = record[field.fieldname] || '';
                console.log(`🔍 GROUPED VIEW - Processing field: ${field.fieldname}`, field);
                const formatted = this.formatFieldValue(value, field.fieldtype, field.fieldname);
                html += `<td>${formatted}</td>`;
            });
            
            if (showActions) {
                html += `
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-sm view-record-btn" data-record-name="${recordId}" data-record-id="${recordId}" title="View">
                                <i class="fa fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-secondary btn-sm edit-record-btn" data-record-name="${recordId}" data-record-id="${recordId}" title="Edit">
                                <i class="fa fa-edit"></i>
                            </button>
                        </div>
                    </td>
                `;
            }
            
            html += '</tr>';
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    },

    /**
     * Render regular table view
     */
    renderTableView(data, config = {}) {
        const {
            showActions = false,
            tableClass = 'table table-striped table-hover',
            onRecordClick = null,
            fields = []
        } = config;

        // Determine columns to display
        let headerColumns = [];
        
        if (data.data && data.data.length > 0 && fields.length === 0) {
            // Auto-detect columns from data
            const firstRecord = data.data[0];
            for (let key in firstRecord) {
                let label = key;
                if (key === '_count') {
                    label = 'Count';
                } else if (key.includes('_sum')) {
                    label = key.replace('_sum', ' (Sum)').replace('_', ' ');
                } else if (key.includes('_avg')) {
                    label = key.replace('_avg', ' (Avg)').replace('_', ' ');
                } else if (key.includes('_min')) {
                    label = key.replace('_min', ' (Min)').replace('_', ' ');
                } else if (key.includes('_max')) {
                    label = key.replace('_max', ' (Max)').replace('_', ' ');
                }
                headerColumns.push({ key: key, label: label });
            }
        } else {
            // Use provided fields
            headerColumns = fields.map(field => ({
                key: field.fieldname,
                label: field.custom_label || field.field_label || field.fieldname
            }));
        }
        
        let html = `
            <div class="table-responsive">
                <table class="${tableClass}">
                    <thead class="thead-dark">
                        <tr>
                            ${headerColumns.map(col => `<th>${col.label}</th>`).join('')}
                            ${showActions ? '<th width="120">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (data.data && data.data.length > 0) {
            data.data.forEach((record, index) => {
                const recordId = record.name || `record-${index}`;
                const clickHandler = onRecordClick ? `onclick="(${onRecordClick})('${recordId}')"` : '';
                
                html += `<tr ${clickHandler ? `class="clickable-row" ${clickHandler}` : ''}>`;
                
                headerColumns.forEach(col => {
                    let value = record[col.key] || '';
                    
                    // Format numeric aggregations
                    if (col.key.includes('_sum') || col.key.includes('_avg') || col.key.includes('_min') || col.key.includes('_max')) {
                        if (value && !isNaN(value)) {
                            value = parseFloat(value).toFixed(2);
                        }
                    } else {
                        // Find field type for proper formatting
                        const field = fields.find(f => f.fieldname === col.key);
                        if (field) {
                            console.log(`🔍 TABLE VIEW - Processing field: ${col.key}`, field);
                            value = this.formatFieldValue(value, field.fieldtype, field.fieldname);
                        } else {
                            console.log(`🔍 TABLE VIEW - No field info found for: ${col.key}`);
                        }
                    }
                    
                    html += `<td>${value}</td>`;
                });
                
                if (showActions) {
                    html += `
                        <td>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary btn-sm view-record-btn" data-record-name="${recordId}" data-record-id="${recordId}" title="View">
                                    <i class="fa fa-eye"></i>
                                </button>
                                <button class="btn btn-outline-secondary btn-sm edit-record-btn" data-record-name="${recordId}" data-record-id="${recordId}" title="Edit">
                                    <i class="fa fa-edit"></i>
                                </button>
                            </div>
                        </td>
                    `;
                }
                
                html += '</tr>';
            });
        } else {
            html += `
                <tr>
                    <td colspan="${headerColumns.length + (showActions ? 1 : 0)}" class="text-center text-muted">
                        <div class="empty-state">
                            <i class="fa fa-inbox fa-2x"></i>
                            <p>No data found</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="table-footer">
                <p class="text-muted">
                    <i class="fa fa-info-circle"></i>
                    Showing ${data.data ? data.data.length : 0} of ${data.total || 0} records
                </p>
            </div>
        `;
        
        return html;
    },

    /**
     * Format field value based on field type
     */
    formatFieldValue(value, fieldtype, fieldname = '') {
        if (!value && value !== 0) return '';
        
        // Debug gallery field detection
        if (fieldtype === 'Long Text' && fieldname) {
            console.log(`🔍 Gallery Debug - Field: ${fieldname}, Type: ${fieldtype}`);
            console.log(`🔍 Value length: ${value ? value.length : 0}`);
            console.log(`🔍 Is gallery field: ${this.isGalleryField(value, fieldname)}`);
            if (value && value.length > 0) {
                console.log(`🔍 Value preview: ${value.substring(0, 100)}...`);
            }
        }
        
        switch (fieldtype) {
            case 'Currency':
                return parseFloat(value).toFixed(2);
            case 'Date':
                return frappe.datetime.str_to_user ? frappe.datetime.str_to_user(value) : value;
            case 'Datetime':
                return frappe.datetime.str_to_user ? frappe.datetime.str_to_user(value) : value;
            case 'Check':
                return value ? '✓' : '✗';
            case 'Attach Image':
            case 'Attach':
                if (value && (value.startsWith('http') || value.startsWith('/files'))) {
                    return `<img src="${value}" class="field-image clickable-image" 
                                 style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" 
                                 data-image-url="${value}" 
                                 title="Click to view full size">`;
                }
                return value;
            case 'Long Text':
            case 'Text':
                // Check if this is a gallery field (contains image URLs)
                if (this.isGalleryField(value, fieldname)) {
                    return this.renderGalleryField(value);
                }
                return this.formatValue(value);
            default:
                return this.formatValue(value);
        }
    },
    
    /**
     * Check if a field contains gallery data (image URLs)
     */
    isGalleryField(value, fieldname = '') {
        if (!value || typeof value !== 'string') return false;
        
        // Check if fieldname suggests it's a gallery
        const galleryPatterns = ['gallery', 'images', 'photos', 'pictures'];
        const isGalleryNamed = galleryPatterns.some(pattern => 
            fieldname.toLowerCase().includes(pattern)
        );
        
        // Check if value contains image URLs or JSON with image data
        const hasImageUrls = value.includes('/files/') || 
                           value.includes('http') || 
                           (value.includes('{') && value.includes('file_url'));
        
        return isGalleryNamed && hasImageUrls;
    },
    
    /**
     * Render gallery field as clickable thumbnail
     */
    renderGalleryField(value) {
        try {
            const images = this.extractImageUrls(value);
            if (images.length === 0) return this.formatValue(value);
            
            // Show first image as thumbnail with count indicator
            const firstImage = images[0];
            const countBadge = images.length > 1 ? 
                `<span class="image-count-badge">${images.length}</span>` : '';
            
            return `
                <div class="gallery-thumbnail-container" style="position: relative; display: inline-block;">
                    <img src="${firstImage}" class="field-image clickable-image" 
                         style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" 
                         data-image-url="${firstImage}" 
                         data-gallery-images="${images.join(',')}" 
                         title="Click to view gallery (${images.length} image${images.length > 1 ? 's' : ''})">
                    ${countBadge}
                </div>
            `;
        } catch (e) {
            console.warn('Error parsing gallery field:', e);
            return this.formatValue(value);
        }
    },
    
    /**
     * Extract image URLs from gallery field value
     */
    extractImageUrls(value) {
        if (!value) return [];
        
        const urls = [];
        
        try {
            // Try parsing as JSON array first
            if (value.startsWith('[')) {
                const parsed = JSON.parse(value);
                parsed.forEach(item => {
                    if (typeof item === 'string' && (item.startsWith('/files/') || item.startsWith('http'))) {
                        urls.push(item);
                    } else if (item.file_url) {
                        urls.push(item.file_url);
                    }
                });
            }
            // Try parsing as JSON object with images array
            else if (value.startsWith('{')) {
                const parsed = JSON.parse(value);
                if (parsed.images && Array.isArray(parsed.images)) {
                    parsed.images.forEach(img => {
                        if (img.file_url) urls.push(img.file_url);
                    });
                }
            }
        } catch (e) {
            // If JSON parsing fails, look for URLs in the text
            const urlMatches = value.match(/(\/files\/[^\s"',]+|https?:\/\/[^\s"',]+\.(jpg|jpeg|png|gif|webp))/gi);
            if (urlMatches) {
                urls.push(...urlMatches);
            }
        }
        
        return urls.filter(url => url && url.trim());
    },

    /**
     * General value formatting
     */
    formatValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.length > 50) {
            return value.substring(0, 50) + '...';
        }
        return String(value);
    },

    /**
     * Toggle group visibility
     */
    toggleGroup(index) {
        const content = document.getElementById(`group-content-${index}`);
        const icon = document.getElementById(`toggle-${index}`);
        
        if (content && icon) {
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                icon.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
                icon.classList.add('collapsed');
            }
        }
    },
    
    /**
     * Set up event handlers for action buttons and image lightbox
     */
    setupActionHandlers(container, viewHandler, editHandler) {
        if (!container || typeof container === 'string') {
            container = document.querySelector(container || '.flansa-report-container');
        }
        
        if (!container) return;
        
        // Remove existing handlers to prevent duplicates
        container.removeEventListener('click', this.actionClickHandler);
        
        // Store handlers for later use
        this.viewRecordHandler = viewHandler;
        this.editRecordHandler = editHandler;
        
        // Add event delegation for action buttons and images
        this.actionClickHandler = (e) => {
            const target = e.target.closest('button, .clickable-image');
            if (!target) return;
            
            if (target.classList.contains('view-record-btn') && this.viewRecordHandler) {
                const recordId = target.dataset.recordName || target.dataset.recordId;
                this.viewRecordHandler(recordId);
            } else if (target.classList.contains('edit-record-btn') && this.editRecordHandler) {
                const recordId = target.dataset.recordName || target.dataset.recordId;
                this.editRecordHandler(recordId);
            } else if (target.classList.contains('clickable-image')) {
                e.preventDefault();
                e.stopPropagation();
                const imageUrl = target.dataset.imageUrl;
                const galleryImages = target.dataset.galleryImages;
                console.log('🔍 Image clicked:', { imageUrl, galleryImages });
                this.openImageLightbox(imageUrl, galleryImages);
            }
        };
        
        container.addEventListener('click', this.actionClickHandler);
    },

    /**
     * Open image lightbox with gallery support
     */
    openImageLightbox(imageUrl, galleryImages = null) {
        // Parse gallery images if provided
        const images = galleryImages ? galleryImages.split(',') : [imageUrl];
        const startIndex = images.indexOf(imageUrl) >= 0 ? images.indexOf(imageUrl) : 0;
        
        // Use existing Frappe dialog for consistency with existing gallery viewer
        if (typeof frappe !== 'undefined' && frappe.ui && frappe.ui.Dialog) {
            this.openFrappeImageDialog(images, startIndex);
        } else {
            // Fallback to simple lightbox if Frappe UI is not available
            this.openSimpleLightbox(images, startIndex);
        }
    },
    
    /**
     * Open image dialog using Frappe UI
     */
    openFrappeImageDialog(images, startIndex = 0) {
        let currentIndex = startIndex;
        
        const updateImage = () => {
            try {
                const img = dialog.fields_dict.image.$wrapper.find('img');
                img.attr('src', images[currentIndex]);
                
                const counter = dialog.fields_dict.counter.$wrapper;
                counter.html(`<div style="text-align: center; color: #6c757d; font-size: 14px;">
                    Image ${currentIndex + 1} of ${images.length}
                </div>`);
                
                // Update navigation button states
                if (images.length > 1) {
                    const prevBtn = dialog.$wrapper.find('.img-nav-prev');
                    const nextBtn = dialog.$wrapper.find('.img-nav-next');
                    prevBtn.prop('disabled', false);
                    nextBtn.prop('disabled', false);
                }
                
                console.log(`🖼️ Image updated: ${currentIndex + 1}/${images.length}`);
            } catch (e) {
                console.error('Error updating image:', e);
            }
        };
        
        const dialog = new frappe.ui.Dialog({
            title: 'Image Viewer',
            size: 'large',
            fields: [
                {
                    fieldname: 'counter',
                    fieldtype: 'HTML',
                    options: ''
                },
                {
                    fieldname: 'image',
                    fieldtype: 'HTML',
                    options: `
                        <div style="text-align: center; position: relative;">
                            <img src="${images[currentIndex]}" 
                                 style="max-width: 100%; max-height: 60vh; border-radius: 4px;"
                                 loading="lazy">
                        </div>
                    `
                },
                ...(images.length > 1 ? [{
                    fieldname: 'navigation',
                    fieldtype: 'HTML',
                    options: `
                        <div style="text-align: center; margin-top: 15px;">
                            <button class="btn btn-sm btn-default img-nav-prev" style="margin-right: 10px;">
                                <i class="fa fa-chevron-left"></i> Previous
                            </button>
                            <button class="btn btn-sm btn-default img-nav-next">
                                Next <i class="fa fa-chevron-right"></i>
                            </button>
                        </div>
                    `
                }] : [])
            ]
        });
        
        dialog.show();
        updateImage();
        
        // Add navigation handlers
        if (images.length > 1) {
            dialog.$wrapper.find('.img-nav-prev').on('click', () => {
                currentIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
                updateImage();
            });
            
            dialog.$wrapper.find('.img-nav-next').on('click', () => {
                currentIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
                updateImage();
            });
            
            // Keyboard navigation
            $(document).on('keydown.image-viewer', (e) => {
                if (e.key === 'ArrowLeft') {
                    currentIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
                    updateImage();
                } else if (e.key === 'ArrowRight') {
                    currentIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
                    updateImage();
                } else if (e.key === 'Escape') {
                    dialog.hide();
                }
            });
            
            // Clean up keyboard handler when dialog is closed
            dialog.onhide = () => {
                $(document).off('keydown.image-viewer');
            };
        }
    },
    
    /**
     * Simple lightbox fallback
     */
    openSimpleLightbox(images, startIndex = 0) {
        // Create a simple overlay lightbox
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.9); z-index: 9999; 
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
        `;
        
        const img = document.createElement('img');
        img.src = images[startIndex];
        img.style.cssText = `
            max-width: 90%; max-height: 90%; 
            border-radius: 4px; cursor: pointer;
        `;
        
        overlay.appendChild(img);
        document.body.appendChild(overlay);
        
        // Close on click
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
        
        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    /**
     * Get styles for grouped view
     */
    getGroupedViewStyles() {
        return `
            <style>
                .grouped-report-container {
                    max-height: 70vh;
                    overflow-y: auto;
                }
                
                .report-summary {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                
                .summary-card {
                    display: flex;
                    align-items: center;
                    padding: 15px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e9ecef;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.2s ease;
                }
                
                .summary-card:hover {
                    transform: translateY(-2px);
                }
                
                .summary-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 15px;
                }
                
                .summary-icon i {
                    color: white;
                    font-size: 1.2rem;
                }
                
                .summary-content h6 {
                    margin: 0 0 5px 0;
                    color: #666;
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                
                .summary-value {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #2c3e50;
                    line-height: 1;
                }
                
                .group-section {
                    margin-bottom: 15px;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .group-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.2s ease;
                }
                
                .group-header:hover {
                    background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
                }
                
                .group-header-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .group-toggle-icon {
                    transition: transform 0.2s ease;
                    font-size: 1rem;
                }
                
                .group-toggle-icon.collapsed {
                    transform: rotate(-90deg);
                }
                
                .group-title {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .group-meta {
                    color: #e8f2ff;
                    font-weight: normal;
                    font-size: 0.8rem;
                }
                
                .more-indicator {
                    background: rgba(255,255,255,0.2);
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                }
                
                .group-content {
                    background: white;
                    max-height: 400px;
                    overflow-y: auto;
                    transition: all 0.3s ease;
                }
                
                .group-content.collapsed {
                    max-height: 0;
                    overflow: hidden;
                }
                
                .group-content table {
                    margin: 0;
                }
                
                .group-content td, .group-content th {
                    padding: 10px 15px;
                    border-top: 1px solid #f8f9fa;
                }
                
                .group-content thead th {
                    background: #f8f9fa;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #dee2e6;
                    color: #495057;
                }
                
                .empty-group {
                    padding: 40px;
                    text-align: center;
                    color: #6c757d;
                }
                
                .empty-group i {
                    font-size: 2rem;
                    margin-bottom: 10px;
                }
                
                .empty-state {
                    padding: 40px;
                    text-align: center;
                    color: #6c757d;
                }
                
                .empty-state i {
                    margin-bottom: 10px;
                    opacity: 0.5;
                }
                
                .table-footer {
                    padding: 15px;
                    background: #f8f9fa;
                    border-top: 1px solid #dee2e6;
                }
                
                .clickable-row:hover {
                    background-color: #f5f5f5;
                    cursor: pointer;
                }
                
                .field-image {
                    border: 1px solid #dee2e6;
                }
                
                .btn-group-sm .btn {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                }
                
                /* Gallery thumbnail styles */
                .gallery-thumbnail-container {
                    position: relative;
                    display: inline-block;
                }
                
                .image-count-badge {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #007bff;
                    color: white;
                    border-radius: 10px;
                    padding: 2px 6px;
                    font-size: 10px;
                    font-weight: bold;
                    line-height: 1;
                    min-width: 18px;
                    text-align: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                }
                
                .clickable-image:hover {
                    opacity: 0.8;
                    transition: opacity 0.2s ease;
                }
            </style>
        `;
    }
};

// Make it globally available
window.FlansaReportRenderer = FlansaReportRenderer;

// Add global fallback functions for legacy compatibility
if (!window.viewRecord) {
    window.viewRecord = function(recordId) {
        console.warn('viewRecord called but no handler set. Record ID:', recordId);
        frappe.msgprint('View record functionality not configured.');
    };
}

if (!window.editRecord) {
    window.editRecord = function(recordId) {
        console.warn('editRecord called but no handler set. Record ID:', recordId);
        frappe.msgprint('Edit record functionality not configured.');
    };
}