/**
 * Flansa Global Navigation Controller
 * Provides seamless navigation between reports, record viewers, forms, and other pages
 */

class FlansaNavigationController {
    constructor() {
        this.navigationStack = [];
        this.currentContext = null;
        this.maxStackSize = 10;
        
        this.init();
    }
    
    init() {
        console.log('🧭 Initializing Flansa Navigation Controller');
        
        // Listen for navigation events
        this.setupNavigationListeners();
        
        // Add global navigation bar
        this.injectNavigationBar();
        
        // Track current page context
        this.trackPageContext();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    setupNavigationListeners() {
        // Listen for custom navigation events
        $(document).on('flansa:navigate', (e, data) => {
            this.navigateTo(data.page, data.params, data.context);
        });
        
        // Listen for report to record viewer navigation
        $(document).on('flansa:view-record', (e, data) => {
            this.openRecordViewer(data.table, data.record, data.returnTo);
        });
        
        // Listen for record viewer to report navigation
        $(document).on('flansa:view-report', (e, data) => {
            this.openReport(data.reportName, data.filters, data.returnTo);
        });
        
        // Back navigation
        $(document).on('flansa:navigate-back', () => {
            this.navigateBack();
        });
    }
    
    injectNavigationBar() {
        // Check if we're in a Flansa page
        if (!this.isFlansaPage()) return;
        
        // Remove any existing navigation bar
        $('.flansa-navigation-bar').remove();
        
        const navBar = `
            <div class="flansa-navigation-bar" style="
                position: fixed;
                top: 60px;
                left: 0;
                right: 0;
                height: 48px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                z-index: 1030;
                display: flex;
                align-items: center;
                padding: 0 20px;
                color: white;
            ">
                <div class="nav-left" style="display: flex; align-items: center; gap: 15px;">
                    <button class="btn btn-sm nav-back-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                        display: none;
                    ">
                        <i class="fa fa-arrow-left"></i> Back
                    </button>
                    
                    <div class="nav-breadcrumbs" style="display: flex; align-items: center; gap: 10px;">
                        <!-- Breadcrumbs will be inserted here -->
                    </div>
                </div>
                
                <div class="nav-center" style="flex: 1; text-align: center;">
                    <span class="nav-title" style="font-size: 16px; font-weight: 500;"></span>
                </div>
                
                <div class="nav-right" style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn btn-sm nav-quick-access" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.3);
                        color: white;
                    " title="Quick Access (Ctrl+K)">
                        <i class="fa fa-search"></i> Quick Access
                    </button>
                    
                    <div class="nav-actions" style="display: flex; gap: 5px;">
                        <!-- Context-specific actions will be inserted here -->
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(navBar);
        
        // Adjust page content padding
        if ($('.page-content').length) {
            $('.page-content').css('padding-top', '108px');
        }
        
        // Bind navigation bar events
        this.bindNavigationBarEvents();
    }
    
    bindNavigationBarEvents() {
        // Back button
        $('.nav-back-btn').on('click', () => {
            this.navigateBack();
        });
        
        // Quick access
        $('.nav-quick-access').on('click', () => {
            this.showQuickAccess();
        });
    }
    
    trackPageContext() {
        const route = frappe.get_route();
        const pageName = route[0];
        
        this.currentContext = {
            page: pageName,
            route: route,
            timestamp: new Date(),
            data: {}
        };
        
        // Page-specific context
        switch(pageName) {
            case 'flansa-record-viewer':
                this.currentContext.type = 'record-viewer';
                this.currentContext.table = route[1];
                this.currentContext.data = {
                    table: route[1],
                    title: `Records: ${route[1]}`
                };
                break;
                
            case 'flansa-report-viewer':
                this.currentContext.type = 'report';
                this.currentContext.report = route[1];
                this.currentContext.data = {
                    report: route[1],
                    title: `Report: ${route[1]}`
                };
                break;
                
            case 'flansa-form-builder':
                this.currentContext.type = 'form-builder';
                this.currentContext.form = route[1];
                this.currentContext.data = {
                    form: route[1],
                    title: `Form Builder: ${route[1] || 'New'}`
                };
                break;
                
            default:
                this.currentContext.type = 'page';
                this.currentContext.data = {
                    title: pageName
                };
        }
        
        this.updateNavigationBar();
    }
    
    updateNavigationBar() {
        if (!this.currentContext) return;
        
        // Update title
        $('.nav-title').text(this.currentContext.data.title || '');
        
        // Update breadcrumbs
        this.updateBreadcrumbs();
        
        // Update back button visibility
        if (this.navigationStack.length > 0) {
            $('.nav-back-btn').show();
        } else {
            $('.nav-back-btn').hide();
        }
        
        // Update context actions
        this.updateContextActions();
    }
    
    updateBreadcrumbs() {
        const breadcrumbs = $('.nav-breadcrumbs');
        breadcrumbs.empty();
        
        // Home
        breadcrumbs.append(`
            <a href="/app" style="color: white; text-decoration: none;">
                <i class="fa fa-home"></i>
            </a>
        `);
        
        // Add separator
        breadcrumbs.append('<span style="color: rgba(255,255,255,0.6);">/</span>');
        
        // Current page
        if (this.currentContext.type === 'record-viewer' && this.currentContext.table) {
            breadcrumbs.append(`
                <span style="color: rgba(255,255,255,0.8);">Records</span>
                <span style="color: rgba(255,255,255,0.6);">/</span>
                <span style="color: white;">${this.currentContext.table}</span>
            `);
        } else if (this.currentContext.type === 'report' && this.currentContext.report) {
            breadcrumbs.append(`
                <span style="color: rgba(255,255,255,0.8);">Reports</span>
                <span style="color: rgba(255,255,255,0.6);">/</span>
                <span style="color: white;">${this.currentContext.report}</span>
            `);
        } else {
            breadcrumbs.append(`
                <span style="color: white;">${this.currentContext.data.title}</span>
            `);
        }
    }
    
    updateContextActions() {
        const actions = $('.nav-actions');
        actions.empty();
        
        // Add context-specific actions
        if (this.currentContext.type === 'record-viewer') {
            actions.append(`
                <button class="btn btn-sm btn-light nav-action-report" title="View Report">
                    <i class="fa fa-chart-bar"></i>
                </button>
                <button class="btn btn-sm btn-light nav-action-export" title="Export">
                    <i class="fa fa-download"></i>
                </button>
            `);
        } else if (this.currentContext.type === 'report') {
            actions.append(`
                <button class="btn btn-sm btn-light nav-action-records" title="View Records">
                    <i class="fa fa-table"></i>
                </button>
                <button class="btn btn-sm btn-light nav-action-filters" title="Filters">
                    <i class="fa fa-filter"></i>
                </button>
            `);
        }
        
        // Bind action events
        this.bindContextActionEvents();
    }
    
    bindContextActionEvents() {
        $('.nav-action-report').off('click').on('click', () => {
            if (this.currentContext.table) {
                this.openReport(`${this.currentContext.table}_report`, {}, this.currentContext);
            }
        });
        
        $('.nav-action-records').off('click').on('click', () => {
            // Extract table name from report name (assuming naming convention)
            const tableName = this.currentContext.report?.replace('_report', '');
            if (tableName) {
                this.openRecordViewer(tableName, null, this.currentContext);
            }
        });
    }
    
    navigateTo(page, params = {}, context = null) {
        console.log('🚀 Navigating to:', page, params);
        
        // Save current context to stack
        if (this.currentContext && context !== false) {
            this.pushToStack(this.currentContext);
        }
        
        // Build route
        let route = [page];
        if (params.id) route.push(params.id);
        
        // Navigate
        frappe.set_route(route);
        
        // Track new context
        setTimeout(() => this.trackPageContext(), 100);
    }
    
    openRecordViewer(tableName, recordId = null, returnTo = null) {
        console.log('📊 Opening record viewer:', tableName, recordId);
        
        // Save return context
        if (returnTo) {
            this.pushToStack(returnTo);
        }
        
        // Navigate to record viewer
        let route = ['flansa-record-viewer', tableName];
        if (recordId) {
            // Add record ID as query parameter
            route.push(`?record=${recordId}`);
        }
        
        frappe.set_route(route);
        
        // Trigger record viewer to focus on specific record if provided
        if (recordId) {
            setTimeout(() => {
                $(document).trigger('flansa:focus-record', { recordId });
            }, 500);
        }
    }
    
    openReport(reportName, filters = {}, returnTo = null) {
        console.log('📈 Opening report:', reportName, filters);
        
        // Save return context
        if (returnTo) {
            this.pushToStack(returnTo);
        }
        
        // Navigate to report
        frappe.set_route('flansa-report-viewer', reportName);
        
        // Apply filters after navigation
        setTimeout(() => {
            $(document).trigger('flansa:apply-report-filters', { filters });
        }, 500);
    }
    
    navigateBack() {
        if (this.navigationStack.length === 0) {
            // Go to home
            frappe.set_route('');
            return;
        }
        
        const previousContext = this.navigationStack.pop();
        console.log('⬅️ Navigating back to:', previousContext);
        
        // Restore previous route
        frappe.set_route(previousContext.route);
        
        // Restore context
        setTimeout(() => {
            this.currentContext = previousContext;
            this.updateNavigationBar();
        }, 100);
    }
    
    pushToStack(context) {
        // Limit stack size
        if (this.navigationStack.length >= this.maxStackSize) {
            this.navigationStack.shift();
        }
        
        this.navigationStack.push(context);
        console.log('📚 Navigation stack:', this.navigationStack.length, 'items');
    }
    
    showQuickAccess() {
        const dialog = new frappe.ui.Dialog({
            title: 'Quick Access',
            fields: [
                {
                    fieldtype: 'Data',
                    fieldname: 'search',
                    label: 'Search',
                    placeholder: 'Type to search tables, reports, forms...',
                    reqd: 0
                }
            ]
        });
        
        // Setup search
        dialog.$wrapper.find('input[data-fieldname="search"]').on('input', (e) => {
            const query = $(e.target).val();
            this.performQuickSearch(query, dialog);
        });
        
        dialog.show();
        
        // Focus on search input
        setTimeout(() => {
            dialog.$wrapper.find('input[data-fieldname="search"]').focus();
        }, 300);
    }
    
    async performQuickSearch(query, dialog) {
        if (!query || query.length < 2) return;
        
        // Search for tables, reports, forms
        const results = await this.searchFlansaEntities(query);
        
        // Display results
        let resultsHtml = '<div class="quick-access-results" style="max-height: 300px; overflow-y: auto; margin-top: 15px;">';
        
        if (results.tables.length > 0) {
            resultsHtml += '<div class="result-section"><strong>Tables</strong><ul>';
            results.tables.forEach(table => {
                resultsHtml += `<li><a href="#" class="quick-nav" data-type="table" data-name="${table}">${table}</a></li>`;
            });
            resultsHtml += '</ul></div>';
        }
        
        if (results.reports.length > 0) {
            resultsHtml += '<div class="result-section"><strong>Reports</strong><ul>';
            results.reports.forEach(report => {
                resultsHtml += `<li><a href="#" class="quick-nav" data-type="report" data-name="${report}">${report}</a></li>`;
            });
            resultsHtml += '</ul></div>';
        }
        
        resultsHtml += '</div>';
        
        // Update dialog content
        dialog.$wrapper.find('.modal-body').append(resultsHtml);
        
        // Bind click events
        dialog.$wrapper.find('.quick-nav').on('click', (e) => {
            e.preventDefault();
            const type = $(e.target).data('type');
            const name = $(e.target).data('name');
            
            dialog.hide();
            
            if (type === 'table') {
                this.openRecordViewer(name);
            } else if (type === 'report') {
                this.openReport(name);
            }
        });
    }
    
    async searchFlansaEntities(query) {
        // This would typically call an API to search
        // For now, return mock data
        return {
            tables: ['Customer', 'Order', 'Product'].filter(t => 
                t.toLowerCase().includes(query.toLowerCase())
            ),
            reports: ['Sales Report', 'Inventory Report', 'Customer Report'].filter(r => 
                r.toLowerCase().includes(query.toLowerCase())
            )
        };
    }
    
    setupKeyboardShortcuts() {
        $(document).on('keydown', (e) => {
            // Ctrl+K for quick access
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.showQuickAccess();
            }
            
            // Alt+Left for back navigation
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.navigateBack();
            }
        });
    }
    
    isFlansaPage() {
        const route = frappe.get_route();
        const flansaPages = [
            'flansa-record-viewer',
            'flansa-report-viewer',
            'flansa-form-builder',
            'flansa'
        ];
        
        return flansaPages.includes(route[0]);
    }
}

// Initialize on DOM ready
$(document).ready(() => {
    if (!window.flansaNavController) {
        window.flansaNavController = new FlansaNavigationController();
    }
});

// Export for use in other modules
window.FlansaNavigationController = FlansaNavigationController;