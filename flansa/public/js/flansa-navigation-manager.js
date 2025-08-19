/**
 * Flansa Navigation Manager - Role-based navigation system
 * Organizes admin/builder tools vs end-user tools
 */

window.FlansaNavigationManager = {
    
    // Page categories
    ADMIN_PAGES: [
        'flansa-visual-builder',
        'flansa-relationship-builder', 
        'flansa-form-builder',
        'flansa-report-builder'
    ],
    
    END_USER_PAGES: [
        'flansa-workspace',
        'flansa-app-dashboard',
        'flansa-record-viewer',
        'flansa-report-viewer'
    ],
    
    // Page configurations
    PAGE_CONFIG: {
        // Admin/Builder Pages
        'flansa-visual-builder': {
            title: '📋 Visual Builder',
            description: 'Design table structures',
            category: 'admin',
            icon: 'fa-table',
            roles: ['System Manager', 'Flansa Admin', 'Flansa Builder']
        },
        'flansa-relationship-builder': {
            title: '🔗 Relationship Builder', 
            description: 'Define table relationships',
            category: 'admin',
            icon: 'fa-link',
            roles: ['System Manager', 'Flansa Admin', 'Flansa Builder']
        },
        'flansa-form-builder': {
            title: '📝 Form Builder',
            description: 'Create custom forms',
            category: 'admin', 
            icon: 'fa-edit',
            roles: ['System Manager', 'Flansa Admin', 'Flansa Builder']
        },
        'flansa-report-builder': {
            title: '📊 Report Builder',
            description: 'Build reports and analytics',
            category: 'admin',
            icon: 'fa-chart-bar',
            roles: ['System Manager', 'Flansa Admin', 'Flansa Builder']
        },
        'flansa-saved-reports': {
            title: '📊 Reports',
            description: 'View and manage saved reports',
            category: 'user',
            icon: 'fa-chart-line',
            roles: ['System Manager', 'Flansa Admin', 'Flansa User', 'Flansa Builder']
        },
        'flansa-unified-report-builder': {
            title: '🔧 New Report',
            description: 'Create new reports',
            category: 'admin',
            icon: 'fa-plus-circle',
            roles: ['System Manager', 'Flansa Admin', 'Flansa Builder']
        },
        
        // End-User Pages
        'flansa-workspace': {
            title: '🏠 Workspace',
            description: 'Application portfolio',
            category: 'user',
            icon: 'fa-home',
            roles: ['System Manager', 'Flansa Admin', 'Flansa User', 'Flansa Builder']
        },
        'flansa-app-dashboard': {
            title: '📱 App Dashboard', 
            description: 'Application overview',
            category: 'user',
            icon: 'fa-tachometer-alt',
            roles: ['System Manager', 'Flansa Admin', 'Flansa User', 'Flansa Builder']
        },
        'flansa-record-viewer': {
            title: '📄 Records',
            description: 'Browse and manage data',
            category: 'user',
            icon: 'fa-database',
            roles: ['System Manager', 'Flansa Admin', 'Flansa User', 'Flansa Builder']
        },
        'flansa-report-viewer': {
            title: '👁️ Report Viewer',
            description: 'View reports and analytics',
            category: 'user',
            icon: 'fa-eye',
            roles: ['System Manager', 'Flansa Admin', 'Flansa User', 'Flansa Builder']
        }
    },
    
    /**
     * Check if user has access to a specific page
     */
    hasPageAccess(page_name) {
        const config = this.PAGE_CONFIG[page_name];
        if (!config) return false;
        
        // Check if user has required roles
        const user_roles = frappe.user_roles || [];
        return config.roles.some(role => user_roles.includes(role));
    },
    
    /**
     * Get pages accessible to current user by category
     */
    getAccessiblePages(category = null) {
        const accessible_pages = [];
        
        for (const [page_name, config] of Object.entries(this.PAGE_CONFIG)) {
            if (this.hasPageAccess(page_name)) {
                if (!category || config.category === category) {
                    accessible_pages.push({
                        name: page_name,
                        ...config
                    });
                }
            }
        }
        
        return accessible_pages;
    },
    
    /**
     * Add admin navigation menu to a page
     */
    addAdminNavigation(page, current_page = null) {
        // More thorough validation
        if (!page) {
            console.warn('FlansaNavigationManager: page is null/undefined');
            return;
        }
        
        if (typeof page.add_menu_item !== 'function') {
            console.warn('FlansaNavigationManager: page.add_menu_item is not a function', page);
            return;
        }
        
        const admin_pages = this.getAccessiblePages('admin');
        
        if (admin_pages.length === 0) return;
        
        admin_pages.forEach(page_config => {
            if (page_config.name !== current_page) {
                try {
                    page.add_menu_item(page_config.title, () => {
                        window.location.href = `/app/${page_config.name}`;
                    }, false); // Pass false as the third parameter instead of true
                } catch (error) {
                    console.warn('FlansaNavigationManager: Error adding admin menu item', error, page_config);
                }
            }
        });
    },
    
    /**
     * Add end-user navigation menu to a page
     */
    addUserNavigation(page, current_page = null, app_id = null) {
        // More thorough validation
        if (!page) {
            console.warn('FlansaNavigationManager: page is null/undefined');
            return;
        }
        
        if (typeof page.add_menu_item !== 'function') {
            console.warn('FlansaNavigationManager: page.add_menu_item is not a function', page);
            return;
        }
        
        const user_pages = this.getAccessiblePages('user');
        
        if (user_pages.length === 0) return;
        
        user_pages.forEach(page_config => {
            if (page_config.name !== current_page) {
                let url = `/app/${page_config.name}`;
                
                // Add app context for relevant pages
                if (app_id && ['flansa-app-dashboard', 'flansa-record-viewer'].includes(page_config.name)) {
                    if (page_config.name === 'flansa-app-dashboard') {
                        url += `/${app_id}`;
                    } else if (page_config.name === 'flansa-record-viewer') {
                        url += `?app=${app_id}`;
                    }
                }
                
                try {
                    page.add_menu_item(page_config.title, () => {
                        window.location.href = url;
                    }, false); // Pass false as the third parameter
                } catch (error) {
                    console.warn('FlansaNavigationManager: Error adding menu item', error, page_config);
                }
            }
        });
    },
    
    /**
     * Add complete navigation menu with role-based sections
     */
    addCompleteNavigation(page, options = {}) {
        const {
            current_page = null,
            app_id = null,
            show_admin = true,
            show_user = true
        } = options;
        
        // Add user navigation first (most commonly used)
        if (show_user) {
            this.addUserNavigation(page, current_page, app_id);
        }
        
        // Add admin navigation if user has admin access
        if (show_admin && this.hasAdminAccess()) {
            this.addAdminNavigation(page, current_page);
        }
        
        // Add utility items
        if (page && page.add_menu_item) {
            page.add_menu_item('🔄 Refresh Page', () => {
                window.location.reload();
            }, false);
            
            // Add help option
            page.add_menu_item('❓ Help & Support', () => {
                this.showHelpDialog();
            }, false);
        }
    },
    
    /**
     * Check if current user has admin access
     */
    hasAdminAccess() {
        const user_roles = frappe.user_roles || [];
        const admin_roles = ['System Manager', 'Flansa Admin', 'Flansa Builder'];
        return admin_roles.some(role => user_roles.includes(role));
    },
    
    /**
     * Check if current user has builder access  
     */
    hasBuilderAccess() {
        const user_roles = frappe.user_roles || [];
        const builder_roles = ['System Manager', 'Flansa Admin', 'Flansa Builder'];
        return builder_roles.some(role => user_roles.includes(role));
    },
    
    /**
     * Get current page category
     */
    getCurrentPageCategory() {
        const current_route = frappe.get_route();
        const page_name = current_route[0];
        
        const config = this.PAGE_CONFIG[page_name];
        return config ? config.category : null;
    },
    
    /**
     * Setup navigation based on page type
     */
    setupPageNavigation(page, page_name, options = {}) {
        // Validate inputs
        if (!page) {
            console.warn('FlansaNavigationManager: setupPageNavigation called with null/undefined page');
            return;
        }
        
        if (typeof page.add_menu_item !== 'function') {
            console.warn('FlansaNavigationManager: page does not have add_menu_item method', page);
            return;
        }
        
        const config = this.PAGE_CONFIG[page_name];
        if (!config) {
            console.warn('FlansaNavigationManager: No config found for page', page_name);
            return;
        }
        
        // Check access
        if (!this.hasPageAccess(page_name)) {
            this.showAccessDenied(page);
            return;
        }
        
        // Add appropriate navigation
        const navigation_options = {
            current_page: page_name,
            ...options
        };
        
        try {
            if (config.category === 'admin') {
                // Admin pages get all navigation
                this.addCompleteNavigation(page, navigation_options);
            } else {
                // User pages get user navigation + admin if qualified
                this.addCompleteNavigation(page, navigation_options);
            }
        } catch (error) {
            console.error('FlansaNavigationManager: Error setting up navigation', error, page_name);
        }
    },
    
    /**
     * Show access denied message
     */
    showAccessDenied(page) {
        const message = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fa fa-lock fa-3x" style="color: #dc3545; margin-bottom: 16px;"></i>
                <h4 style="color: #dc3545; margin-bottom: 8px;">Access Denied</h4>
                <p style="color: #6c757d; margin-bottom: 20px;">You don't have permission to access this page.</p>
                <button class="btn btn-primary" onclick="window.location.href='/app/flansa-workspace'">
                    <i class="fa fa-home"></i> Go to Workspace
                </button>
            </div>
        `;
        
        $(page.body).html(message);
    },
    
    /**
     * Show help dialog
     */
    showHelpDialog() {
        const help_content = `
            <div style="padding: 20px;">
                <h5>📚 Flansa Platform Help</h5>
                
                <h6>🔧 Admin/Builder Tools:</h6>
                <ul>
                    <li><strong>Visual Builder:</strong> Design table structures and fields</li>
                    <li><strong>Relationship Builder:</strong> Define connections between tables</li>
                    <li><strong>Form Builder:</strong> Create custom data entry forms</li>
                    <li><strong>Report Builder:</strong> Build reports and analytics</li>
                </ul>
                
                <h6>👥 End-User Tools:</h6>
                <ul>
                    <li><strong>Workspace:</strong> Browse and manage applications</li>
                    <li><strong>App Dashboard:</strong> Overview of individual applications</li>
                    <li><strong>Record Viewer:</strong> Browse, create, and edit records</li>
                    <li><strong>Report Viewer:</strong> View reports and analytics</li>
                </ul>
                
                <h6>🎨 Theme Settings:</h6>
                <p>Use the theme menu (⋯) to customize colors and appearance.</p>
                
                <h6>🚀 Quick Tips:</h6>
                <ul>
                    <li>Use the navigation menu to switch between tools</li>
                    <li>Builder tools require admin/builder permissions</li>
                    <li>All changes are automatically saved</li>
                    <li>Use keyboard shortcuts where available</li>
                </ul>
            </div>
        `;
        
        const dialog = new frappe.ui.Dialog({
            title: '❓ Flansa Platform Help',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'help_content',
                    options: help_content
                }
            ]
        });
        
        dialog.show();
    },
    
    /**
     * Initialize navigation for current page
     */
    init() {
        // Auto-setup navigation when page loads
        const current_route = frappe.get_route();
        const page_name = current_route[0];
        
        if (this.PAGE_CONFIG[page_name]) {
            // Wait for page to be ready
            setTimeout(() => {
                const page_obj = frappe.pages[page_name];
                if (page_obj && page_obj.page && page_obj.page.add_menu_item) {
                    this.setupPageNavigation(page_obj.page, page_name);
                }
            }, 500);
        }
    }
};

// Auto-initialize when DOM is ready (disabled to prevent conflicts)
// Pages will call setupPageNavigation manually
/*
$(document).ready(() => {
    // Initialize navigation manager
    if (window.location.pathname.includes('flansa-')) {
        setTimeout(() => {
            window.FlansaNavigationManager.init();
        }, 1000);
    }
});

// Listen for route changes
$(document).on('app-loaded page-change', () => {
    if (window.location.pathname.includes('flansa-')) {
        setTimeout(() => {
            window.FlansaNavigationManager.init();
        }, 500);
    }
});
*/