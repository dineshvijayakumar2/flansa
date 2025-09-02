/**
 * Flansa Shadcn Table Component
 * Component-based table following Shadcn design patterns
 * Used across saved reports, report viewer, and record viewer pages
 */

// Base Component Class
class Component {
    constructor(tagName = 'div', props = {}) {
        this.element = document.createElement(tagName);
        this.props = props;
        this.children = [];
        this.applyProps();
    }
    
    applyProps() {
        if (this.props.className) {
            this.element.className = this.props.className;
        }
        if (this.props.id) {
            this.element.id = this.props.id;
        }
        if (this.props.style) {
            Object.assign(this.element.style, this.props.style);
        }
        if (this.props.onClick) {
            this.element.addEventListener('click', this.props.onClick);
        }
        if (this.props.innerHTML) {
            this.element.innerHTML = this.props.innerHTML;
        }
        if (this.props.textContent) {
            this.element.textContent = this.props.textContent;
        }
        // Apply any other attributes
        Object.keys(this.props).forEach(key => {
            if (!['className', 'id', 'style', 'onClick', 'innerHTML', 'textContent', 'children'].includes(key)) {
                this.element.setAttribute(key, this.props[key]);
            }
        });
    }
    
    append(...children) {
        children.forEach(child => {
            if (child instanceof Component) {
                this.element.appendChild(child.element);
                this.children.push(child);
            } else if (child instanceof HTMLElement) {
                this.element.appendChild(child);
            } else if (typeof child === 'string') {
                this.element.appendChild(document.createTextNode(child));
            }
        });
        return this;
    }
    
    render() {
        return this.element;
    }
}

// Table Component
class Table extends Component {
    constructor(props = {}) {
        super('div', {
            className: 'flansa-table-container',
            ...props
        });
        
        this.wrapper = new Component('div', {
            className: 'flansa-table-wrapper'
        });
        
        this.table = new Component('table', {
            className: 'flansa-table'
        });
        
        this.wrapper.append(this.table);
        this.append(this.wrapper);
    }
    
    setChildren(children) {
        this.table.element.innerHTML = '';
        this.table.append(...children);
        return this;
    }
}

// TableCaption Component
class TableCaption extends Component {
    constructor(props = {}) {
        super('caption', {
            className: 'flansa-table-caption',
            ...props
        });
    }
}

// TableHeader Component
class TableHeader extends Component {
    constructor(props = {}) {
        super('thead', {
            className: 'flansa-table-header',
            ...props
        });
    }
}

// TableBody Component
class TableBody extends Component {
    constructor(props = {}) {
        super('tbody', {
            className: 'flansa-table-body',
            ...props
        });
    }
}

// TableFooter Component
class TableFooter extends Component {
    constructor(props = {}) {
        super('tfoot', {
            className: 'flansa-table-footer',
            ...props
        });
    }
}

// TableRow Component
class TableRow extends Component {
    constructor(props = {}) {
        super('tr', {
            className: 'flansa-table-row',
            ...props
        });
    }
}

// TableHead Component (th)
class TableHead extends Component {
    constructor(props = {}) {
        const className = ['flansa-table-head'];
        if (props.className) className.push(props.className);
        
        super('th', {
            ...props,
            className: className.join(' ')
        });
        
        if (props.sortable) {
            this.element.classList.add('sortable');
        }
    }
}

// TableCell Component (td)
class TableCell extends Component {
    constructor(props = {}) {
        const className = ['flansa-table-cell'];
        if (props.className) className.push(props.className);
        
        super('td', {
            ...props,
            className: className.join(' ')
        });
    }
}

// Badge Component
class Badge extends Component {
    constructor(props = {}) {
        const variant = props.variant || 'default';
        super('span', {
            className: `flansa-badge flansa-badge-${variant}`,
            ...props
        });
    }
}

// Button Component
class Button extends Component {
    constructor(props = {}) {
        const variant = props.variant || 'ghost';
        super('button', {
            className: `flansa-btn flansa-btn-${variant}`,
            ...props
        });
    }
}

// Main Table Builder Class
class FlansaShadcnTable {
    constructor(options = {}) {
        this.container = options.container;
        this.columns = options.columns || [];
        this.data = options.data || [];
        this.pagination = options.pagination !== false;
        this.pageSize = options.pageSize || 20;
        this.currentPage = 1;
        this.selectable = options.selectable || false;
        this.selectedRows = new Set();
        this.onRowClick = options.onRowClick;
        this.onSelectionChange = options.onSelectionChange;
        this.emptyMessage = options.emptyMessage || 'No data available';
        this.caption = options.caption;
        this.showFooter = options.showFooter || false;
        
        this.sortField = null;
        this.sortDirection = 'asc';
        
        this.init();
    }
    
    init() {
        this.injectStyles();
        this.render();
    }
    
    injectStyles() {
        if (document.getElementById('flansa-shadcn-table-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'flansa-shadcn-table-styles';
        style.textContent = `
            /* Flansa Shadcn Table - Root Variables */
            :root {
                --border: 214.3 31.8% 91.4%;
                --input: 214.3 31.8% 91.4%;
                --ring: 222.2 84% 4.9%;
                --background: 0 0% 100%;
                --foreground: 222.2 84% 4.9%;
                --primary: 222.2 47.4% 11.2%;
                --primary-foreground: 210 40% 98%;
                --secondary: 210 40% 96.1%;
                --secondary-foreground: 222.2 47.4% 11.2%;
                --muted: 210 40% 96.1%;
                --muted-foreground: 215.4 16.3% 46.9%;
                --accent: 210 40% 96.1%;
                --accent-foreground: 222.2 47.4% 11.2%;
            }
            
            /* Container */
            .flansa-table-container {
                width: 100%;
            }
            
            .flansa-table-wrapper {
                position: relative;
                width: 100%;
                overflow: auto;
                border: 1px solid hsl(var(--border));
                border-radius: 0.5rem;
                background: hsl(var(--background));
            }
            
            /* Table */
            .flansa-table {
                width: 100%;
                caption-side: bottom;
                font-size: 0.875rem;
                line-height: 1.25rem;
            }
            
            .flansa-table-caption {
                margin-top: 1rem;
                font-size: 0.875rem;
                color: hsl(var(--muted-foreground));
            }
            
            /* Header */
            .flansa-table-header {
                border-bottom: 1px solid hsl(var(--border));
            }
            
            .flansa-table-head {
                height: 3rem;
                padding-left: 1rem;
                padding-right: 1rem;
                text-align: left;
                vertical-align: middle;
                color: hsl(var(--muted-foreground));
                font-weight: 500;
                font-size: 0.875rem;
            }
            
            .flansa-table-head.sortable {
                cursor: pointer;
                user-select: none;
                transition: color 0.2s;
            }
            
            .flansa-table-head.sortable:hover {
                color: hsl(var(--foreground));
            }
            
            .flansa-table-head.text-right {
                text-align: right;
            }
            
            .flansa-table-head.text-center {
                text-align: center;
            }
            
            /* Body */
            .flansa-table-body {
                font-size: 0.875rem;
            }
            
            .flansa-table-row {
                border-bottom: 1px solid hsl(var(--border));
                transition: background-color 0.2s;
            }
            
            .flansa-table-row:hover {
                background-color: hsl(var(--muted));
            }
            
            .flansa-table-row.selected {
                background-color: hsl(var(--accent));
            }
            
            .flansa-table-body .flansa-table-row:last-child {
                border-bottom: 0;
            }
            
            .flansa-table-cell {
                padding: 1rem;
                vertical-align: middle;
                color: hsl(var(--foreground));
            }
            
            .flansa-table-cell.font-medium {
                font-weight: 500;
            }
            
            .flansa-table-cell.text-right {
                text-align: right;
            }
            
            .flansa-table-cell.text-center {
                text-align: center;
            }
            
            .flansa-table-cell.text-muted {
                color: hsl(var(--muted-foreground));
            }
            
            /* Footer */
            .flansa-table-footer {
                border-top: 1px solid hsl(var(--border));
                background-color: hsl(var(--muted));
                font-weight: 500;
            }
            
            .flansa-table-footer .flansa-table-cell {
                font-weight: 500;
            }
            
            /* Badges */
            .flansa-badge {
                display: inline-flex;
                align-items: center;
                border-radius: 9999px;
                padding: 0.125rem 0.625rem;
                font-size: 0.75rem;
                font-weight: 600;
                transition: all 0.2s;
            }
            
            .flansa-badge-default {
                border: 1px solid hsl(var(--border));
                background-color: hsl(var(--background));
                color: hsl(var(--foreground));
            }
            
            .flansa-badge-secondary {
                background-color: hsl(var(--secondary));
                color: hsl(var(--secondary-foreground));
            }
            
            .flansa-badge-destructive {
                background-color: hsl(0 84.2% 60.2%);
                color: hsl(0 0% 98%);
            }
            
            .flansa-badge-outline {
                border: 1px solid hsl(var(--border));
            }
            
            .flansa-badge-success {
                background-color: hsl(142.1 76.2% 36.3%);
                color: hsl(0 0% 98%);
            }
            
            .flansa-badge-warning {
                background-color: hsl(47.9 95.8% 53.1%);
                color: hsl(47.9 95.8% 10%);
            }
            
            .flansa-badge-info {
                background-color: hsl(221.2 83.2% 53.3%);
                color: hsl(0 0% 98%);
            }
            
            /* Buttons */
            .flansa-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
                border-radius: 0.375rem;
                font-size: 0.875rem;
                font-weight: 500;
                transition: all 0.2s;
                cursor: pointer;
                outline: none;
                border: 1px solid transparent;
            }
            
            .flansa-btn:focus-visible {
                outline: 2px solid transparent;
                outline-offset: 2px;
                box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring));
            }
            
            .flansa-btn:disabled {
                pointer-events: none;
                opacity: 0.5;
            }
            
            .flansa-btn-default {
                background-color: hsl(var(--primary));
                color: hsl(var(--primary-foreground));
                padding: 0.5rem 1rem;
            }
            
            .flansa-btn-default:hover {
                background-color: hsl(var(--primary) / 0.9);
            }
            
            .flansa-btn-ghost {
                padding: 0.5rem;
                background: transparent;
                color: hsl(var(--foreground));
            }
            
            .flansa-btn-ghost:hover {
                background-color: hsl(var(--accent));
                color: hsl(var(--accent-foreground));
            }
            
            .flansa-btn-outline {
                border: 1px solid hsl(var(--border));
                background-color: hsl(var(--background));
                padding: 0.5rem 1rem;
            }
            
            .flansa-btn-outline:hover {
                background-color: hsl(var(--accent));
                color: hsl(var(--accent-foreground));
            }
            
            /* Checkbox */
            .flansa-checkbox {
                height: 1rem;
                width: 1rem;
                border-radius: 0.25rem;
                border: 1px solid hsl(var(--primary));
                cursor: pointer;
            }
            
            /* Pagination */
            .flansa-pagination {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem;
                border-top: 1px solid hsl(var(--border));
                background: hsl(var(--background));
            }
            
            .flansa-pagination-info {
                font-size: 0.875rem;
                color: hsl(var(--muted-foreground));
            }
            
            .flansa-pagination-controls {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            
            /* Empty State */
            .flansa-empty-state {
                padding: 4rem 2rem;
                text-align: center;
            }
            
            .flansa-empty-icon {
                font-size: 3rem;
                opacity: 0.3;
                margin-bottom: 1rem;
            }
            
            .flansa-empty-text {
                color: hsl(var(--muted-foreground));
                font-size: 0.875rem;
            }
            
            /* Utilities */
            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border-width: 0;
            }
            
            /* Responsive */
            @media (max-width: 640px) {
                .flansa-table {
                    font-size: 0.75rem;
                }
                
                .flansa-table-head,
                .flansa-table-cell {
                    padding: 0.75rem;
                }
                
                .flansa-pagination {
                    flex-direction: column;
                    gap: 1rem;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    render() {
        const containerEl = typeof this.container === 'string' 
            ? document.querySelector(this.container) 
            : this.container;
            
        if (!containerEl) {
            console.error('FlansaShadcnTable: Container not found');
            return;
        }
        
        containerEl.innerHTML = '';
        
        if (this.data.length === 0) {
            this.renderEmptyState(containerEl);
            return;
        }
        
        // Create table using components
        const table = new Table();
        
        // Add caption if provided
        if (this.caption) {
            const caption = new TableCaption({ textContent: this.caption });
            table.table.append(caption);
        }
        
        // Create header
        const header = this.createHeader();
        table.table.append(header);
        
        // Create body
        const body = this.createBody();
        table.table.append(body);
        
        // Create footer if needed
        if (this.showFooter) {
            const footer = this.createFooter();
            table.table.append(footer);
        }
        
        containerEl.appendChild(table.render());
        
        // Add pagination if enabled
        if (this.pagination) {
            this.renderPagination(containerEl);
        }
    }
    
    createHeader() {
        const header = new TableHeader();
        const row = new TableRow();
        
        // Add checkbox column if selectable
        if (this.selectable) {
            const th = new TableHead({ className: 'w-12' });
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'flansa-checkbox';
            checkbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
            th.element.appendChild(checkbox);
            row.append(th);
        }
        
        // Add column headers
        this.columns.forEach(column => {
            const props = {
                textContent: column.title,
                sortable: column.sortable
            };
            
            if (column.align) {
                props.className = `text-${column.align}`;
            }
            
            const th = new TableHead(props);
            
            if (column.sortable) {
                th.element.addEventListener('click', () => this.handleSort(column.field));
                
                if (this.sortField === column.field) {
                    const arrow = document.createElement('span');
                    arrow.style.marginLeft = '0.5rem';
                    arrow.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
                    th.element.appendChild(arrow);
                }
            }
            
            row.append(th);
        });
        
        header.append(row);
        return header;
    }
    
    createBody() {
        const body = new TableBody();
        const paginatedData = this.getPaginatedData();
        
        paginatedData.forEach(rowData => {
            const row = this.createRow(rowData);
            body.append(row);
        });
        
        return body;
    }
    
    createRow(rowData) {
        const row = new TableRow();
        
        if (this.selectedRows.has(rowData.id || rowData)) {
            row.element.classList.add('selected');
        }
        
        if (this.onRowClick) {
            row.element.style.cursor = 'pointer';
            row.element.addEventListener('click', () => this.onRowClick(rowData));
        }
        
        // Add checkbox cell if selectable
        if (this.selectable) {
            const td = new TableCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'flansa-checkbox';
            checkbox.checked = this.selectedRows.has(rowData.id || rowData);
            checkbox.addEventListener('click', (e) => e.stopPropagation());
            checkbox.addEventListener('change', (e) => this.handleRowSelection(rowData, e.target.checked));
            td.element.appendChild(checkbox);
            row.append(td);
        }
        
        // Add data cells
        this.columns.forEach(column => {
            const cell = this.createCell(rowData, column);
            row.append(cell);
        });
        
        return row;
    }
    
    createCell(rowData, column) {
        const value = this.getCellValue(rowData, column.field);
        const props = {};
        
        if (column.align) {
            props.className = `text-${column.align}`;
        }
        
        if (column.className) {
            props.className = (props.className || '') + ' ' + column.className;
        }
        
        const cell = new TableCell(props);
        
        // Apply formatter or type-specific rendering
        if (column.formatter) {
            cell.element.innerHTML = column.formatter(value, rowData);
        } else if (column.type === 'badge') {
            const badge = new Badge({
                textContent: value,
                variant: column.badgeVariant?.[value] || 'default'
            });
            cell.append(badge);
        } else if (column.type === 'actions' && column.actions) {
            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '0.25rem';
            actionsDiv.style.justifyContent = 'flex-end';
            
            column.actions.forEach(action => {
                const btn = new Button({
                    variant: 'ghost',
                    innerHTML: action.icon || action.label,
                    title: action.title || action.label,
                    onClick: (e) => {
                        e.stopPropagation();
                        if (action.handler) {
                            action.handler(rowData);
                        }
                    }
                });
                actionsDiv.appendChild(btn.render());
            });
            
            cell.element.appendChild(actionsDiv);
        } else {
            cell.element.textContent = value || '';
        }
        
        return cell;
    }
    
    createFooter() {
        const footer = new TableFooter();
        const row = new TableRow();
        
        // Example footer - can be customized
        const cell = new TableCell({
            colSpan: this.columns.length + (this.selectable ? 1 : 0),
            textContent: `Total: ${this.data.length} items`
        });
        
        row.append(cell);
        footer.append(row);
        return footer;
    }
    
    renderEmptyState(container) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'flansa-table-wrapper';
        emptyDiv.innerHTML = `
            <div class="flansa-empty-state">
                <div class="flansa-empty-icon">📋</div>
                <div class="flansa-empty-text">${this.emptyMessage}</div>
            </div>
        `;
        container.appendChild(emptyDiv);
    }
    
    renderPagination(container) {
        const totalPages = Math.ceil(this.data.length / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.data.length);
        
        const pagination = document.createElement('div');
        pagination.className = 'flansa-pagination';
        
        // Info
        const info = document.createElement('div');
        info.className = 'flansa-pagination-info';
        info.textContent = `${start}-${end} of ${this.data.length} ${this.selectedRows.size ? `(${this.selectedRows.size} selected)` : ''}`;
        
        // Controls
        const controls = document.createElement('div');
        controls.className = 'flansa-pagination-controls';
        
        const prevBtn = new Button({
            variant: 'outline',
            textContent: 'Previous',
            disabled: this.currentPage === 1,
            onClick: () => this.goToPage(this.currentPage - 1)
        });
        
        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        
        const nextBtn = new Button({
            variant: 'outline',
            textContent: 'Next',
            disabled: this.currentPage === totalPages,
            onClick: () => this.goToPage(this.currentPage + 1)
        });
        
        controls.appendChild(prevBtn.render());
        controls.appendChild(pageInfo);
        controls.appendChild(nextBtn.render());
        
        pagination.appendChild(info);
        pagination.appendChild(controls);
        container.appendChild(pagination);
    }
    
    // Helper methods
    getCellValue(row, field) {
        const fields = field.split('.');
        let value = row;
        for (const f of fields) {
            value = value?.[f];
        }
        return value;
    }
    
    getPaginatedData() {
        if (!this.pagination) return this.data;
        const start = (this.currentPage - 1) * this.pageSize;
        return this.data.slice(start, start + this.pageSize);
    }
    
    handleSort(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        
        this.data.sort((a, b) => {
            const aVal = this.getCellValue(a, field);
            const bVal = this.getCellValue(b, field);
            
            if (aVal === bVal) return 0;
            const comparison = aVal < bVal ? -1 : 1;
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
        
        this.render();
    }
    
    handleSelectAll(checked) {
        if (checked) {
            this.data.forEach(row => this.selectedRows.add(row.id || row));
        } else {
            this.selectedRows.clear();
        }
        this.render();
        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedRows));
        }
    }
    
    handleRowSelection(rowData, checked) {
        const id = rowData.id || rowData;
        if (checked) {
            this.selectedRows.add(id);
        } else {
            this.selectedRows.delete(id);
        }
        this.render();
        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedRows));
        }
    }
    
    goToPage(page) {
        const totalPages = Math.ceil(this.data.length / this.pageSize);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.render();
    }
    
    // Public API
    setData(data) {
        this.data = data;
        this.currentPage = 1;
        this.selectedRows.clear();
        this.render();
    }
    
    updateData(data) {
        this.data = data;
        this.render();
    }
    
    refresh() {
        this.render();
    }
    
    getSelectedRows() {
        return Array.from(this.selectedRows);
    }
    
    destroy() {
        const containerEl = typeof this.container === 'string' 
            ? document.querySelector(this.container) 
            : this.container;
        if (containerEl) {
            containerEl.innerHTML = '';
        }
    }
}

// Export components and main class
if (typeof window !== 'undefined') {
    window.FlansaShadcnTable = FlansaShadcnTable;
    window.FlansaTableComponents = {
        Component,
        Table,
        TableCaption,
        TableHeader,
        TableBody,
        TableFooter,
        TableRow,
        TableHead,
        TableCell,
        Badge,
        Button
    };
}