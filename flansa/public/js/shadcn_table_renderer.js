/**
 * Flansa Shadcn Table Renderer
 * Reusable component for rendering data tables with Shadcn styling
 * Supports images, lightbox integration, and custom field rendering
 */

class FlansaShadcnTableRenderer {
    constructor(options = {}) {
        this.container = options.container;
        this.data = options.data || [];
        this.fields = options.fields || [];
        this.onRecordClick = options.onRecordClick;
        this.onImageClick = options.onImageClick;
        this.onActionClick = options.onActionClick;
        this.showActions = options.showActions !== false; // Default true
        this.maxFields = options.maxFields || 5; // Limit fields for clean display
        this.imageFields = options.imageFields || [];
        this.primaryField = options.primaryField || null;
        
        this.injectStyles();
    }
    
    render() {
        if (!this.container) {
            console.error('FlansaShadcnTableRenderer: No container provided');
            return;
        }
        
        const containerElement = typeof this.container === 'string' 
            ? document.querySelector(this.container)
            : this.container;
            
        if (!containerElement) {
            console.error('FlansaShadcnTableRenderer: Container not found');
            return;
        }
        
        // Clear container
        containerElement.innerHTML = '';
        
        // Create table structure
        const tableWrapper = this.createTableStructure();
        containerElement.appendChild(tableWrapper);
        
        // Populate headers
        this.renderHeaders();
        
        // Populate rows
        this.renderRows();
    }
    
    createTableStructure() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flansa-shadcn-data-table';
        
        wrapper.innerHTML = `
            <div class="flansa-shadcn-table-wrapper">
                <table class="flansa-shadcn-table">
                    <thead class="flansa-shadcn-table-header">
                        <tr class="flansa-shadcn-table-row" id="table-header-row">
                        </tr>
                    </thead>
                    <tbody class="flansa-shadcn-table-body" id="table-body">
                    </tbody>
                </table>
            </div>
        `;
        
        return wrapper;
    }
    
    renderHeaders() {
        const headerRow = document.getElementById('table-header-row');
        headerRow.innerHTML = '';
        
        // Get display fields (limit for clean layout)
        const displayFields = this.getDisplayFields();
        
        displayFields.forEach(field => {
            const th = document.createElement('th');
            th.className = 'flansa-shadcn-table-head';
            th.textContent = field.label || field.fieldname;
            headerRow.appendChild(th);
        });
        
        // Add actions column if enabled
        if (this.showActions) {
            const actionsHeader = document.createElement('th');
            actionsHeader.className = 'flansa-shadcn-table-head text-right';
            actionsHeader.textContent = 'Actions';
            headerRow.appendChild(actionsHeader);
        }
    }
    
    renderRows() {
        const tbody = document.getElementById('table-body');
        if (!tbody) {
            console.error('FlansaShadcnTableRenderer: table-body element not found, skipping renderRows');
            return;
        }
        tbody.innerHTML = '';
        
        if (!this.data || this.data.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'flansa-shadcn-table-row';
            emptyRow.innerHTML = `
                <td colspan="${this.getDisplayFields().length + (this.showActions ? 1 : 0)}" 
                    class="flansa-shadcn-table-cell text-center text-muted-foreground" style="padding: 2rem;">
                    No data available
                </td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }
        
        this.data.forEach((record, index) => {
            const row = this.createTableRow(record, index);
            tbody.appendChild(row);
        });
    }
    
    createTableRow(record, index) {
        const row = document.createElement('tr');
        row.className = 'flansa-shadcn-table-row';
        row.dataset.recordIndex = index;
        row.dataset.recordName = record.name;
        
        // Add click handler for row
        if (this.onRecordClick) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons or images
                if (e.target.closest('button, img, .action-btn')) {
                    return;
                }
                this.onRecordClick(record, index);
            });
        }
        
        // Get display fields
        const displayFields = this.getDisplayFields();
        
        displayFields.forEach((field, fieldIndex) => {
            const cell = this.createTableCell(record, field, fieldIndex, index);
            row.appendChild(cell);
        });
        
        // Add actions column if enabled
        if (this.showActions) {
            const actionsCell = this.createActionsCell(record, index);
            row.appendChild(actionsCell);
        }
        
        return row;
    }
    
    createTableCell(record, field, fieldIndex, recordIndex) {
        const cell = document.createElement('td');
        cell.className = 'flansa-shadcn-table-cell';
        
        const value = record[field.fieldname];
        
        // Handle different field types
        if (this.isImageField(field)) {
            cell.appendChild(this.createImageCell(value, field, recordIndex));
        } else if (fieldIndex === 0 || field === this.primaryField) {
            // Primary field - make it prominent
            cell.className += ' font-medium';
            cell.appendChild(this.createPrimaryCell(value, record));
        } else {
            // Regular field
            cell.appendChild(this.createRegularCell(value, field));
        }
        
        return cell;
    }
    
    createImageCell(value, field, recordIndex) {
        const container = document.createElement('div');
        container.className = 'flex items-center gap-2';
        
        const imageUrls = this.extractImageUrls(value);
        
        if (imageUrls.length > 0) {
            const img = document.createElement('img');
            img.src = imageUrls[0];
            img.alt = 'Image';
            img.className = 'w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200';
            img.style.minWidth = '2.5rem'; // Ensure consistent sizing
            
            // Add error handling for broken images
            img.onerror = function() {
                this.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400';
                placeholder.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                this.parentNode.insertBefore(placeholder, this);
            };
            
            // Add click handler for lightbox
            if (this.onImageClick) {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onImageClick(recordIndex, field.fieldname, 0);
                });
            }
            
            container.appendChild(img);
            
            // Add count indicator if multiple images
            if (imageUrls.length > 1) {
                const count = document.createElement('span');
                count.className = 'text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-full';
                count.textContent = `+${imageUrls.length - 1}`;
                container.appendChild(count);
            }
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400';
            placeholder.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
            container.appendChild(placeholder);
        }
        
        return container;
    }
    
    createPrimaryCell(value, record) {
        const container = document.createElement('div');
        container.className = 'flex flex-col gap-1';
        
        const title = document.createElement('div');
        title.className = 'text-sm font-semibold cursor-pointer text-gray-900 hover:text-blue-600 transition-colors';
        title.textContent = value || 'Untitled';
        
        if (this.onRecordClick) {
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onRecordClick(record, -1);
            });
        }
        
        const subtitle = document.createElement('div');
        subtitle.className = 'text-xs text-muted-foreground';
        subtitle.textContent = `ID: ${record.name || 'N/A'}`;
        
        container.appendChild(title);
        container.appendChild(subtitle);
        
        return container;
    }
    
    createRegularCell(value, field) {
        const container = document.createElement('div');
        container.className = 'table-cell-content';
        
        if (value === null || value === undefined || value === '') {
            container.className += ' text-muted-foreground italic';
            container.textContent = '—';
        } else {
            container.className += ' text-sm text-gray-700';
            
            // Format based on field type
            if (field.fieldtype === 'Date' && value) {
                container.textContent = this.formatDate(value);
            } else if (field.fieldtype === 'Currency' && value) {
                container.textContent = this.formatCurrency(value);
            } else {
                const truncatedValue = this.truncateText(String(value), 80);
                container.textContent = truncatedValue;
                
                // Add title attribute for full text on hover if truncated
                if (truncatedValue.endsWith('...')) {
                    container.title = String(value);
                    container.style.cursor = 'help';
                }
            }
        }
        
        return container;
    }
    
    createActionsCell(record, recordIndex) {
        const cell = document.createElement('td');
        cell.className = 'flansa-shadcn-table-cell text-right';
        
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex gap-1 justify-end';
        
        // View button
        const viewBtn = this.createActionButton('view', 'View Record', `
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
            </svg>
        `);
        
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onActionClick) {
                this.onActionClick('view', record, recordIndex);
            }
        });
        
        // Edit button
        const editBtn = this.createActionButton('edit', 'Edit Record', `
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
        `);
        
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onActionClick) {
                this.onActionClick('edit', record, recordIndex);
            }
        });
        
        actionsContainer.appendChild(viewBtn);
        actionsContainer.appendChild(editBtn);
        cell.appendChild(actionsContainer);
        
        return cell;
    }
    
    createActionButton(action, title, iconSvg) {
        const button = document.createElement('button');
        button.className = 'flansa-shadcn-btn-ghost action-btn';
        button.title = title;
        button.dataset.action = action;
        button.innerHTML = iconSvg;
        return button;
    }
    
    getDisplayFields() {
        if (!this.fields || this.fields.length === 0) {
            return [];
        }
        
        // Prioritize primary field, then image fields, then others
        const primaryFields = this.primaryField ? [this.primaryField] : [this.fields[0]];
        const imageFields = this.fields.filter(f => this.isImageField(f)).slice(0, 2); // Max 2 image fields
        const otherFields = this.fields.filter(f => 
            f !== primaryFields[0] && 
            !this.isImageField(f)
        ).slice(0, this.maxFields - primaryFields.length - imageFields.length);
        
        return [...primaryFields, ...imageFields, ...otherFields];
    }
    
    isImageField(field) {
        return ['Attach Image', 'Attach'].includes(field.fieldtype) || 
               field.fieldname.toLowerCase().includes('image') ||
               this.imageFields.includes(field.fieldname);
    }
    
    extractImageUrls(value) {
        if (!value) return [];
        
        // Handle different data formats - same logic as Report Viewer
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                const urls = [];
                value.forEach((item) => {
                    const url = this.getSingleImageUrl(item);
                    if (url && url !== '/assets/frappe/images/default-avatar.png') {
                        urls.push(url);
                    }
                });
                return urls;
            } else {
                const url = this.getSingleImageUrl(value);
                return url && url !== '/assets/frappe/images/default-avatar.png' ? [url] : [];
            }
        }
        
        // Convert to string and process
        const processed_value = String(value).trim();
        
        // Handle JSON arrays
        if (processed_value.startsWith('[') && processed_value.endsWith(']')) {
            try {
                const parsed = JSON.parse(processed_value);
                if (Array.isArray(parsed)) {
                    const urls = [];
                    parsed.forEach((item) => {
                        const url = this.getSingleImageUrl(item);
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
        const single_url = this.getSingleImageUrl(processed_value);
        return single_url && single_url !== '/assets/frappe/images/default-avatar.png' ? [single_url] : [];
    }
    
    getSingleImageUrl(image_value) {
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
    
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (e) {
            return dateString;
        }
    }
    
    formatCurrency(value) {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);
        } catch (e) {
            return value;
        }
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    injectStyles() {
        // Check if styles already exist
        if (document.getElementById('flansa-shadcn-table-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'flansa-shadcn-table-styles';
        style.textContent = `
            /* Flansa Shadcn Data Table Styles */
            .flansa-shadcn-data-table {
                width: 100%;
                margin: 0;
                padding: 0;
            }
            
            .flansa-shadcn-table-wrapper {
                width: 100%;
                overflow-x: auto;
                border: 1px solid hsl(214.3 31.8% 91.4%);
                border-radius: 0.75rem;
                background: white;
                box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
                margin: 0;
            }
            
            .flansa-shadcn-table {
                width: 100%;
                caption-side: bottom;
                font-size: 0.875rem;
                border-collapse: collapse;
                table-layout: auto;
                min-width: 100%;
                max-width: 100%;
            }
            
            .flansa-shadcn-table-header {
                background: linear-gradient(to bottom, hsl(210 40% 98%), hsl(210 40% 96%));
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%);
            }
            
            .flansa-shadcn-table-row {
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%);
                transition: all 0.2s ease;
            }
            
            .flansa-shadcn-table-body .flansa-shadcn-table-row:hover {
                background: hsl(210 40% 98%);
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            
            .flansa-shadcn-table-body .flansa-shadcn-table-row:last-child {
                border-bottom: 0;
            }
            
            .flansa-shadcn-table-head {
                padding: 1rem 1.25rem;
                text-align: left;
                font-weight: 600;
                color: hsl(215.4 16.3% 46.9%);
                text-transform: uppercase;
                letter-spacing: 0.025em;
                font-size: 0.75rem;
                background: linear-gradient(to right, transparent, hsl(210 40% 98%), transparent);
                border-right: 1px solid hsl(214.3 31.8% 91.4%);
                white-space: nowrap;
                min-width: 120px;
            }
            
            .flansa-shadcn-table-head:first-child {
                min-width: 200px;
                width: 25%;
            }
            
            .flansa-shadcn-table-head:last-child {
                border-right: none;
                width: 120px;
                min-width: 120px;
            }
            
            .flansa-shadcn-table-cell {
                padding: 1rem 1.25rem;
                vertical-align: middle;
                color: hsl(222.2 47.4% 11.2%);
                border-right: 1px solid hsl(214.3 31.8% 95%);
                word-wrap: break-word;
                overflow-wrap: break-word;
                max-width: 0;
                position: relative;
            }
            
            .flansa-shadcn-table-cell:first-child {
                min-width: 200px;
                width: 25%;
                max-width: 300px;
            }
            
            .flansa-shadcn-table-cell:last-child {
                border-right: none;
                width: 120px;
                min-width: 120px;
                max-width: 120px;
            }
            
            .flansa-shadcn-table-cell.font-medium {
                font-weight: 500;
            }
            
            .table-cell-content {
                display: block;
                width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                line-height: 1.4;
            }
            
            .table-cell-content.text-muted-foreground {
                white-space: nowrap;
            }
            
            .text-right {
                text-align: right;
            }
            
            .text-center {
                text-align: center;
            }
            
            .text-muted-foreground {
                color: hsl(215.4 16.3% 46.9%);
            }
            
            /* Button styles */
            .flansa-shadcn-btn-ghost {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.5rem;
                border-radius: 0.375rem;
                background: transparent;
                border: 1px solid transparent;
                color: hsl(215.4 16.3% 46.9%);
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 36px;
                min-height: 36px;
            }
            
            .flansa-shadcn-btn-ghost:hover {
                background: hsl(210 40% 96.1%);
                color: hsl(222.2 47.4% 11.2%);
                border-color: hsl(214.3 31.8% 91.4%);
                transform: scale(1.05);
            }
            
            .flansa-shadcn-btn-ghost:focus {
                outline: 2px solid transparent;
                outline-offset: 2px;
                box-shadow: 0 0 0 2px hsl(222.2 47.4% 11.2%);
            }
            
            /* Flex utilities */
            .flex {
                display: flex;
            }
            
            .flex-col {
                flex-direction: column;
            }
            
            .items-center {
                align-items: center;
            }
            
            .justify-end {
                justify-content: flex-end;
            }
            
            .gap-1 {
                gap: 0.25rem;
            }
            
            .gap-2 {
                gap: 0.5rem;
            }
            
            /* Text utilities */
            .text-sm {
                font-size: 0.875rem;
                line-height: 1.25rem;
            }
            
            .text-xs {
                font-size: 0.75rem;
                line-height: 1rem;
            }
            
            .font-semibold {
                font-weight: 600;
            }
            
            .italic {
                font-style: italic;
            }
            
            /* Image utilities */
            .w-10 {
                width: 2.5rem;
            }
            
            .h-10 {
                height: 2.5rem;
            }
            
            .rounded-lg {
                border-radius: 0.5rem;
            }
            
            .rounded-full {
                border-radius: 9999px;
            }
            
            .object-cover {
                object-fit: cover;
            }
            
            .cursor-pointer {
                cursor: pointer;
            }
            
            .border {
                border-width: 1px;
            }
            
            .border-gray-200 {
                border-color: rgb(229 231 235);
            }
            
            .bg-gray-100 {
                background-color: rgb(243 244 246);
            }
            
            .bg-gray-200 {
                background-color: rgb(229 231 235);
            }
            
            .text-gray-400 {
                color: rgb(156 163 175);
            }
            
            .text-gray-700 {
                color: rgb(55 65 81);
            }
            
            .text-gray-900 {
                color: rgb(17 24 39);
            }
            
            .hover\\:text-blue-600:hover {
                color: rgb(37 99 235);
            }
            
            .transition-colors {
                transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
                transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                transition-duration: 150ms;
            }
            
            .px-2 {
                padding-left: 0.5rem;
                padding-right: 0.5rem;
            }
            
            .py-1 {
                padding-top: 0.25rem;
                padding-bottom: 0.25rem;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Public methods for external updates
    updateData(newData) {
        this.data = newData;
        
        // Check if table structure exists, if not, do a full render
        const tbody = document.getElementById('table-body');
        if (!tbody) {
            console.log('FlansaShadcnTableRenderer: Table structure not found, doing full render');
            this.render();
        } else {
            this.renderRows();
        }
    }
    
    updateFields(newFields) {
        this.fields = newFields;
        this.render();
    }
    
    destroy() {
        if (this.container) {
            const containerElement = typeof this.container === 'string' 
                ? document.querySelector(this.container)
                : this.container;
            if (containerElement) {
                containerElement.innerHTML = '';
            }
        }
    }
}

// Export for use in other modules
window.FlansaShadcnTableRenderer = FlansaShadcnTableRenderer;