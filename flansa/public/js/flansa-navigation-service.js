/**
 * Flansa Navigation Service
 * Handles all navigation between reports, records, and forms
 * Maintains navigation history and context
 */

class FlansaNavigationService {
    constructor() {
        this.history = [];
        this.maxHistorySize = 20;
        this.currentContext = null;
        this.beforeNavigateCallbacks = [];
        
        this.init();
    }

    init() {
        console.log('🧭 Initializing Flansa Navigation Service');
        
        // Listen for browser back button
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.flansaContext) {
                this.restoreContext(e.state.flansaContext);
            }
        });

        // Listen for Frappe route changes
        frappe.router.on('change', () => {
            this.onRouteChange();
        });

        // Setup global navigation events
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for navigation requests from any component
        $(document).on('flansa:navigate', (e, data) => {
            this.navigate(data);
        });

        // Quick navigation shortcuts
        $(document).on('keydown', (e) => {
            // Alt + R: Go to reports
            if (e.altKey && e.key === 'r') {
                e.preventDefault();
                this.navigateToReportList();
            }
            
            // Alt + N: Create new record
            if (e.altKey && e.key === 'n') {
                e.preventDefault();
                this.navigateToNewRecord();
            }
            
            // Alt + Left: Go back
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.goBack();
            }
        });
    }

    /**
     * Main navigation method
     */
    navigate(options) {
        const {
            type,       // 'report' | 'record' | 'form-builder' | 'custom'
            table,      // Table/DocType name
            recordId,   // Record ID (for record view)
            mode,       // 'view' | 'edit' | 'new'
            params,     // Additional parameters
            context     // Context to preserve
        } = options;

        // Save current context before navigating
        this.saveCurrentContext();

        // Execute before navigate callbacks
        const canNavigate = this.executeBeforeNavigate(options);
        if (!canNavigate) return;

        // Build route based on type
        let route;
        switch (type) {
            case 'report':
                route = this.buildReportRoute(table, params);
                break;
            case 'record':
                route = this.buildRecordRoute(table, recordId, mode, params);
                break;
            case 'form-builder':
                route = this.buildFormBuilderRoute(table);
                break;
            default:
                route = options.route || [];
        }

        // Navigate
        console.log('🚀 Navigating to:', route);
        frappe.set_route(route);

        // Store context
        this.currentContext = {
            type,
            table,
            recordId,
            mode,
            params,
            timestamp: new Date(),
            previousContext: context
        };

        // Update browser history
        this.updateBrowserHistory();
    }

    /**
     * Navigate to report/list view (View Data)
     */
    navigateToReport(table, params = {}) {
        this.navigate({
            type: 'report',
            table: table,
            params: params
        });
    }
    
    /**
     * Navigate to specific report by report ID
     */
    navigateToReportById(reportId, params = {}) {
        const route = ['flansa-report-viewer', reportId];
        frappe.set_route(route);
        // Update URL with explicit type parameter
        const queryParams = new URLSearchParams(window.location.search);
        queryParams.set('type', 'report');
        if (params.temp) queryParams.set('temp', '1');
        const newUrl = window.location.pathname + '?' + queryParams.toString();
        window.history.replaceState({}, '', newUrl);
    }
    
    /**
     * Navigate to View Data for a table
     */
    navigateToViewData(table) {
        // Direct route to report viewer for table data viewing with explicit type parameter
        const route = ['flansa-report-viewer', table];
        frappe.set_route(route);
        // Update URL with explicit type parameter
        const newUrl = window.location.pathname + '?type=table';
        window.history.replaceState({}, '', newUrl);
    }

    /**
     * Navigate to single record view
     */
    navigateToRecord(table, recordId, mode = 'view') {
        // Build the route
        let route = ['flansa-record-viewer', table];
        
        if (mode === 'new') {
            route.push('new');
        } else if (recordId) {
            route.push(recordId);
        }
        
        // Use frappe.set_route directly with proper query parameter handling
        if (mode === 'edit' && recordId) {
            // For edit mode, append query parameter after navigation
            frappe.set_route(route);
            // Update URL with query parameter
            const newUrl = window.location.pathname + '?mode=edit';
            window.history.replaceState({}, '', newUrl);
        } else {
            frappe.set_route(route);
        }
        
        // Store context
        this.currentContext = {
            type: 'record',
            table: table,
            recordId: recordId,
            mode: mode,
            timestamp: new Date()
        };
    }

    /**
     * Navigate to create new record
     */
    navigateToNewRecord(table = null) {
        if (!table && this.currentContext) {
            table = this.currentContext.table;
        }

        if (!table) {
            frappe.show_alert({
                message: 'No table context available',
                indicator: 'orange'
            });
            return;
        }

        this.navigate({
            type: 'record',
            table: table,
            mode: 'new'
        });
    }

    /**
     * Navigate to form builder
     */
    navigateToFormBuilder(table) {
        this.navigate({
            type: 'form-builder',
            table: table
        });
    }

    /**
     * Navigate to report list
     */
    navigateToReportList() {
        frappe.set_route('flansa-workspace');
    }

    /**
     * Go back to previous page
     */
    goBack() {
        if (this.history.length > 0) {
            const previousContext = this.history.pop();
            console.log('⬅️ Going back to:', previousContext);
            
            // Restore previous context
            this.restoreContext(previousContext);
        } else {
            // Default fallback
            frappe.set_route('');
        }
    }

    /**
     * Go to home/dashboard
     */
    goHome() {
        frappe.set_route('flansa-workspace');
    }

    /**
     * Build route for report view
     */
    buildReportRoute(table, params = {}) {
        let route = ['flansa-report-viewer', table];
        
        // Add query parameters
        const queryParams = new URLSearchParams();
        
        // Always specify the type explicitly
        if (params.reportId) {
            queryParams.set('type', 'report');
        } else {
            queryParams.set('type', 'table');
        }
        
        if (params.view) queryParams.set('view', params.view);
        if (params.filters) queryParams.set('filters', JSON.stringify(params.filters));
        if (params.sort) queryParams.set('sort', JSON.stringify(params.sort));
        if (params.page) queryParams.set('page', params.page);
        if (params.temp) queryParams.set('temp', '1');
        
        const queryString = queryParams.toString();
        if (queryString) {
            route.push('?' + queryString);
        }

        return route;
    }

    /**
     * Build route for record view
     */
    buildRecordRoute(table, recordId, mode = 'view', params = {}) {
        let route = ['flansa-record-viewer', table];
        
        if (mode === 'new') {
            route.push('new');
        } else if (recordId) {
            route.push(recordId);
        }

        // No query parameters in route array - handle separately
        return route;
    }

    /**
     * Build route for form builder
     */
    buildFormBuilderRoute(table) {
        return ['flansa-form-builder', table];
    }

    /**
     * Save current context to history
     */
    saveCurrentContext() {
        if (this.currentContext) {
            // Limit history size
            if (this.history.length >= this.maxHistorySize) {
                this.history.shift();
            }
            
            this.history.push({
                ...this.currentContext,
                savedAt: new Date()
            });
            
            console.log('💾 Saved context to history:', this.history.length, 'items');
        }
    }

    /**
     * Restore a previous context
     */
    restoreContext(context) {
        if (!context) return;

        const route = this.buildRouteFromContext(context);
        frappe.set_route(route);
        
        this.currentContext = context;
    }

    /**
     * Build route from context object
     */
    buildRouteFromContext(context) {
        switch (context.type) {
            case 'report':
                return this.buildReportRoute(context.table, context.params);
            case 'record':
                return this.buildRecordRoute(context.table, context.recordId, context.mode, context.params);
            case 'form-builder':
                return this.buildFormBuilderRoute(context.table);
            default:
                return context.route || [];
        }
    }

    /**
     * Update browser history state
     */
    updateBrowserHistory() {
        if (this.currentContext) {
            const state = {
                flansaContext: this.currentContext
            };
            
            const url = window.location.pathname + window.location.search;
            window.history.pushState(state, '', url);
        }
    }

    /**
     * Handle Frappe route changes
     */
    onRouteChange() {
        const route = frappe.get_route();
        const page = route[0];
        
        // Update context based on route (check both hyphens and underscores)
        if (page === 'flansa-report-viewer' || page === 'flansa_report_viewer') {
            this.currentContext = {
                type: 'report',
                table: route[1],
                params: this.parseQueryParams(),
                timestamp: new Date()
            };
        } else if (page === 'flansa-record-viewer' || page === 'flansa_record_viewer') {
            this.currentContext = {
                type: 'record',
                table: route[1],
                recordId: route[2] !== 'new' ? route[2] : null,
                mode: route[2] === 'new' ? 'new' : this.getMode(),
                timestamp: new Date()
            };
        } else if (page === 'flansa-form-builder') {
            this.currentContext = {
                type: 'form-builder',
                table: route[1],
                timestamp: new Date()
            };
        }

        // Emit context change event
        $(document).trigger('flansa:context-changed', this.currentContext);
    }

    /**
     * Parse query parameters from URL
     */
    parseQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const urlParams = new URLSearchParams(queryString);
        
        for (const [key, value] of urlParams) {
            try {
                // Try to parse JSON values
                params[key] = JSON.parse(value);
            } catch {
                // Keep as string if not JSON
                params[key] = value;
            }
        }
        
        return params;
    }

    /**
     * Get mode from query parameters
     */
    getMode() {
        const params = this.parseQueryParams();
        return params.mode || 'view';
    }

    /**
     * Register a callback to be executed before navigation
     */
    beforeNavigate(callback) {
        this.beforeNavigateCallbacks.push(callback);
    }

    /**
     * Execute all before navigate callbacks
     */
    executeBeforeNavigate(options) {
        for (const callback of this.beforeNavigateCallbacks) {
            const result = callback(options);
            if (result === false) {
                console.log('🚫 Navigation cancelled by callback');
                return false;
            }
        }
        return true;
    }

    /**
     * Get breadcrumbs for current context
     */
    getBreadcrumbs() {
        const breadcrumbs = [
            { label: 'Home', route: [''] }
        ];

        if (this.currentContext) {
            switch (this.currentContext.type) {
                case 'report':
                    breadcrumbs.push({
                        label: 'Reports',
                        route: ['flansa-workspace']
                    });
                    breadcrumbs.push({
                        label: this.currentContext.table,
                        route: this.buildReportRoute(this.currentContext.table)
                    });
                    break;
                    
                case 'record':
                    breadcrumbs.push({
                        label: 'Reports',
                        route: ['flansa-workspace']
                    });
                    breadcrumbs.push({
                        label: this.currentContext.table,
                        route: this.buildReportRoute(this.currentContext.table)
                    });
                    if (this.currentContext.recordId) {
                        breadcrumbs.push({
                            label: this.currentContext.recordId,
                            route: this.buildRecordRoute(
                                this.currentContext.table,
                                this.currentContext.recordId
                            )
                        });
                    } else if (this.currentContext.mode === 'new') {
                        breadcrumbs.push({
                            label: 'New Record',
                            route: []
                        });
                    }
                    break;
                    
                case 'form-builder':
                    breadcrumbs.push({
                        label: 'Form Builder',
                        route: ['flansa-form-builder']
                    });
                    breadcrumbs.push({
                        label: this.currentContext.table,
                        route: this.buildFormBuilderRoute(this.currentContext.table)
                    });
                    break;
            }
        }

        return breadcrumbs;
    }

    /**
     * Check if can leave current page (for unsaved changes)
     */
    canLeavePage() {
        // Check if there are unsaved changes
        const hasUnsavedChanges = $(document).triggerHandler('flansa:check-unsaved-changes');
        
        if (hasUnsavedChanges) {
            return new Promise((resolve) => {
                frappe.confirm(
                    'You have unsaved changes. Do you want to leave without saving?',
                    () => resolve(true),
                    () => resolve(false)
                );
            });
        }
        
        return Promise.resolve(true);
    }

    /**
     * Add standardized Back button to any Frappe page
     * @param {Object} page - Frappe page instance
     * @param {Object} options - Configuration options
     */
    addBackButton(page, options = {}) {
        const config = {
            label: '← Back',
            position: 'primary',
            btnClass: 'btn-default',
            showForward: false,
            ...options
        };

        // Add Back button
        page.add_button(config.label, () => {
            window.history.back();
        }, config.btnClass);

        // Optionally add Forward button
        if (config.showForward) {
            page.add_button('Forward →', () => {
                window.history.forward();
            }, config.btnClass);
        }

        console.log(`🔙 Added Back button to page: ${page.title}`);
    }

    /**
     * Add standardized navigation controls to any page
     * @param {Object} page - Frappe page instance
     * @param {Object} options - Configuration options
     */
    addStandardNavigation(page, options = {}) {
        const config = {
            showBack: true,
            showForward: false,
            showHome: false,
            ...options
        };

        if (config.showBack) {
            this.addBackButton(page, { 
                showForward: config.showForward,
                btnClass: 'btn-default'
            });
        }

        if (config.showHome) {
            page.add_button('🏠 Home', () => {
                frappe.set_route('');
            }, 'btn-default');
        }

        console.log(`🧭 Added standard navigation to page: ${page.title}`);
    }
}

// Create singleton instance
window.FlansaNav = window.FlansaNav || new FlansaNavigationService();