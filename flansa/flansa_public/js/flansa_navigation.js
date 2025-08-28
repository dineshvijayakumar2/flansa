/**
 * Flansa Navigation Helper
 * Provides consistent navigation patterns across all Flansa pages
 */

// Global Flansa Navigation utility
window.FlansaNavigation = {
    /**
     * Add consistent Flansa Home button to any page
     * @param {Object} page - Frappe page object
     */
    addHomeButton(page) {
        page.set_secondary_action('🏠 Flansa Home', () => {
            window.location.href = '/app/flansa-workspace';
        }, 'octicon octicon-home');
    },
    
    /**
     * Add standard navigation menu items for application context
     * @param {Object} page - Frappe page object
     * @param {string} app_id - Application ID
     * @param {Object} options - Navigation options
     */
    addApplicationNavigation(page, app_id, options = {}) {
        const {
            showDashboard = true,
            showVisualBuilder = true,
            showRelationships = true,
            showSettings = true,
            currentPage = null
        } = options;
        
        if (showDashboard && currentPage !== 'dashboard') {
            page.add_menu_item('📱 Application Dashboard', () => {
                window.location.href = `/app/flansa-app-builder/${app_id}`;
            });
        }
        
        if (showVisualBuilder && currentPage !== 'visual-builder') {
            page.add_menu_item('📋 Table Builder', () => {
                window.location.href = `/app/flansa-table-builder/${app_id}`;
            });
        }
        
        if (showRelationships && currentPage !== 'relationships') {
            page.add_menu_item('🔗 Relationship Builder', () => {
                window.location.href = `/app/flansa-relationship-builder/${app_id}`;
            });
        }
        
        if (showSettings && currentPage !== 'settings') {
            page.add_menu_item('⚙️ Application Settings', () => {
                frappe.set_route('Form', 'Flansa Application', app_id);
            });
        }
    },
    
    /**
     * Add consistent refresh and utility buttons
     * @param {Object} page - Frappe page object
     * @param {Function} refreshCallback - Function to call on refresh
     */
    addUtilityButtons(page, refreshCallback) {
        page.add_button('🔄 Refresh', refreshCallback);
    },
    
    /**
     * Setup complete navigation for a Flansa page
     * @param {Object} page - Frappe page object
     * @param {Object} config - Navigation configuration
     */
    setupPageNavigation(page, config = {}) {
        const {
            app_id = null,
            currentPage = null,
            refreshCallback = null,
            showHome = true,
            applicationNav = {}
        } = config;
        
        // Add home button
        if (showHome) {
            this.addHomeButton(page);
        }
        
        // Add application navigation if app_id provided
        if (app_id) {
            this.addApplicationNavigation(page, app_id, {
                currentPage,
                ...applicationNav
            });
        }
        
        // Add utility buttons
        if (refreshCallback) {
            this.addUtilityButtons(page, refreshCallback);
        }
    }
};

// Auto-enhance pages on load
$(document).ready(() => {
    // Apply consistent styling to Flansa pages
    if (window.location.pathname.includes('flansa-')) {
        $('body').addClass('flansa-page');
    }
});