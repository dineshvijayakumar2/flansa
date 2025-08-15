/**
 * Flansa Header Manager - Consistent modern header across all Flansa pages
 * Provides uniform navigation, breadcrumbs, and back button functionality
 */

window.FlansaHeaderManager = {
    
    // Page configurations with proper app context
    PAGE_CONFIG: {
        'flansa-workspace': {
            title: '🏠 Workspace',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace', current: true }
            ],
            show_back: false
        },
        'flansa-app-dashboard': {
            title: '📱 App Dashboard',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '#', current: true }
            ],
            show_back: true
        },
        'flansa-visual-builder': {
            title: '📋 Visual Builder',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '/app/flansa-app-dashboard/{app_id}' },
                { label: '📋 {table_name} Builder', url: '#', current: true }
            ],
            show_back: true
        },
        'flansa-form-builder': {
            title: '📝 Form Builder',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '/app/flansa-app-dashboard/{app_id}' },
                { label: '📝 {table_name} Forms', url: '#', current: true }
            ],
            show_back: true
        },
        'flansa-record-viewer': {
            title: '📄 Records',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '/app/flansa-app-dashboard/{app_id}' },
                { label: '📄 {table_name}', url: '#', current: true }
            ],
            show_back: true
        },
        'flansa-report-builder': {
            title: '📊 Report Builder',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '/app/flansa-app-dashboard/{app_id}' },
                { label: '📊 Reports', url: '#', current: true }
            ],
            show_back: true
        },
        'flansa-report-viewer': {
            title: '👁️ Report Viewer',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '/app/flansa-app-dashboard/{app_id}' },
                { label: '👁️ {report_name}', url: '#', current: true }
            ],
            show_back: true
        },
        'flansa-relationship-builder': {
            title: '🔗 Relationship Builder',
            breadcrumbs: [
                { label: '🏠 Workspace', url: '/app/flansa-workspace' },
                { label: '📱 {app_name}', url: '/app/flansa-app-dashboard/{app_id}' },
                { label: '🔗 Relationships', url: '#', current: true }
            ],
            show_back: true
        }
    },
    
    /**
     * Extract route parameters and context
     */
    getPageContext(page_name) {
        const route = frappe.get_route();
        const urlParams = new URLSearchParams(window.location.search);
        
        return {
            page_name: page_name,
            route_params: route.slice(1), // Remove page name
            app_id: route[1] || urlParams.get('app'),
            table_name: route[1],
            report_name: route[1],
            search_params: urlParams
        };
    },
    
    /**
     * Get app name from app_id
     */
    async getAppName(app_id) {
        if (!app_id) return 'App';
        
        try {
            // Try to get from cache first
            const cached = sessionStorage.getItem(`flansa_app_name_${app_id}`);
            if (cached) return cached;
            
            // Fetch from API
            const response = await new Promise((resolve, reject) => {
                frappe.call({
                    method: 'flansa.api.get_app_info',
                    args: { app_id: app_id },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            resolve(r.message.app_name || r.message.app_label || 'App');
                        } else {
                            resolve('App');
                        }
                    },
                    error: () => resolve('App')
                });
            });
            
            // Cache the result
            sessionStorage.setItem(`flansa_app_name_${app_id}`, response);
            return response;
            
        } catch (error) {
            console.warn('Error fetching app name:', error);
            return 'App';
        }
    },
    
    /**
     * Get table label from table name
     */
    async getTableLabel(table_name) {
        if (!table_name) return 'Table';
        
        try {
            // Try to get from cache first
            const cached = sessionStorage.getItem(`flansa_table_label_${table_name}`);
            if (cached) return cached;
            
            // Fetch from API
            const response = await new Promise((resolve, reject) => {
                frappe.call({
                    method: 'flansa.api.get_table_metadata',
                    args: { table_name: table_name },
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            resolve(r.message.table_label || table_name);
                        } else {
                            resolve(table_name);
                        }
                    },
                    error: () => resolve(table_name)
                });
            });
            
            // Cache the result
            sessionStorage.setItem(`flansa_table_label_${table_name}`, response);
            return response;
            
        } catch (error) {
            console.warn('Error fetching table label:', error);
            return table_name;
        }
    },
    
    /**
     * Handle smart back button - go to previous page or logical parent
     */
    handleBackButton() {
        // Check if there's browser history to go back to
        if (window.history.length > 1 && document.referrer) {
            // Check if the referrer is also a Flansa page
            const referrer = new URL(document.referrer);
            if (referrer.pathname.includes('/app/flansa-')) {
                window.history.back();
                return;
            }
        }
        
        // Fallback to logical parent based on current page
        const context = this.getPageContext(frappe.get_route()[0]);
        
        if (context.app_id) {
            // If we have app context, go to app dashboard
            window.location.href = `/app/flansa-app-dashboard/${context.app_id}`;
        } else {
            // Otherwise go to workspace
            window.location.href = '/app/flansa-workspace';
        }
    },
    
    /**
     * Render breadcrumbs with proper context
     */
    async renderBreadcrumbs(page_name, context) {
        const config = this.PAGE_CONFIG[page_name];
        if (!config) return '';
        
        // Get dynamic data
        const app_name = await this.getAppName(context.app_id);
        const table_label = await this.getTableLabel(context.table_name);
        
        let breadcrumb_html = '';
        config.breadcrumbs.forEach((crumb, index) => {
            let label = crumb.label
                .replace('{app_name}', app_name)
                .replace('{table_name}', table_label)
                .replace('{report_name}', context.report_name || 'Report');
            
            let url = crumb.url
                .replace('{app_id}', context.app_id || '')
                .replace('{table_name}', context.table_name || '');
            
            if (crumb.current) {
                breadcrumb_html += `<span style="color: var(--flansa-text-primary, #495057); font-weight: 600;">${label}</span>`;
            } else {
                breadcrumb_html += `<a href="${url}" style="color: var(--flansa-primary, #007bff); text-decoration: none; font-weight: 600;">${label}</a>`;
            }
            
            // Add separator unless it's the last item
            if (index < config.breadcrumbs.length - 1) {
                breadcrumb_html += `<span style="color: var(--flansa-text-secondary, #6c757d); margin: 0 8px;"> / </span>`;
            }
        });
        
        return breadcrumb_html;
    },
    
    /**
     * Generate the complete modern header HTML
     */
    async generateHeader(page_name, options = {}) {
        const config = this.PAGE_CONFIG[page_name];
        if (!config) return '';
        
        const context = this.getPageContext(page_name);
        const breadcrumbs = await this.renderBreadcrumbs(page_name, context);
        
        const title = options.title || config.title
            .replace('{app_name}', await this.getAppName(context.app_id))
            .replace('{table_name}', await this.getTableLabel(context.table_name));
        
        return `
            <!-- Flansa Modern Header -->
            <div class="flansa-compact-header" style="background: var(--flansa-gradient-primary); color: var(--flansa-white); padding: 16px 20px; margin: -20px -20px 0 -20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; min-height: 56px; position: sticky; top: 0; z-index: 100;">
                <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
                    ${config.show_back ? `
                        <button class="btn btn-default" id="flansa-back-btn" title="Back" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 4px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background-color 0.2s;">
                            <i class="fa fa-arrow-left" style="font-size: 14px;"></i>
                            <span>Back</span>
                        </button>
                    ` : ''}
                    <span style="font-size: 16px; font-weight: 600;" id="flansa-page-title">${title}</span>
                </div>
                <div class="header-right" style="display: flex; align-items: center; gap: 12px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.2;" id="flansa-main-title">${title}</h3>
                    <div class="context-menu-wrapper" style="position: relative;">
                        <button id="flansa-context-menu-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: background-color 0.2s;" title="More options">⋯</button>
                        <div id="flansa-context-menu" style="display: none; position: absolute; top: 40px; right: 0; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 200px; z-index: 1000; border: 1px solid rgba(0,0,0,0.1);">
                            <div class="context-menu-item" data-action="theme" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;"><i class="fa fa-paint-brush" style="width: 16px;"></i><span>Theme Settings</span></div>
                            ${page_name === 'flansa-record-viewer' ? `
                                <div class="context-menu-item" data-action="new-record" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;"><i class="fa fa-plus" style="width: 16px;"></i><span>New Record</span></div>
                                <div class="context-menu-item" data-action="export" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;"><i class="fa fa-download" style="width: 16px;"></i><span>Export Data</span></div>
                                <div class="context-menu-item" data-action="refresh" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 8px; color: #333;"><i class="fa fa-refresh" style="width: 16px;"></i><span>Refresh</span></div>
                            ` : ''}
                            <div class="context-menu-item" data-action="help" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #333;"><i class="fa fa-question-circle" style="width: 16px;"></i><span>Help</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Flansa Breadcrumb Navigation -->
            <div class="flansa-breadcrumb-bar" style="background: var(--flansa-background, #f8f9fa); padding: 12px 20px; margin: 0 -20px 0 -20px; border-bottom: 1px solid var(--flansa-border, #e0e6ed); display: flex; align-items: center; gap: 8px; font-size: 14px;">
                ${breadcrumbs}
            </div>
        `;
    },
    
    /**
     * Get appropriate icon for page
     */
    getPageIcon(page_name) {
        const icons = {
            'flansa-workspace': 'fa-home',
            'flansa-app-dashboard': 'fa-tachometer-alt',
            'flansa-visual-builder': 'fa-table',
            'flansa-form-builder': 'fa-edit',
            'flansa-record-viewer': 'fa-database',
            'flansa-report-builder': 'fa-chart-bar',
            'flansa-report-viewer': 'fa-eye',
            'flansa-relationship-builder': 'fa-link'
        };
        return icons[page_name] || 'fa-cog';
    },
    
    /**
     * Setup header for a page
     */
    async setupHeader(page_name, container, options = {}) {
        try {
            const header_html = await this.generateHeader(page_name, options);
            $(container).prepend(header_html);
            
            // Bind events
            this.bindHeaderEvents();
            
        } catch (error) {
            console.error('Error setting up Flansa header:', error);
        }
    },
    
    /**
     * Bind header events
     */
    bindHeaderEvents() {
        // Back button
        $(document).off('click', '#flansa-back-btn').on('click', '#flansa-back-btn', () => {
            this.handleBackButton();
        });
        
        // Context menu
        $(document).off('click', '#flansa-context-menu-btn').on('click', '#flansa-context-menu-btn', function(e) {
            e.stopPropagation();
            $('#flansa-context-menu').toggle();
        });
        
        $(document).off('click').on('click', function() {
            $('#flansa-context-menu').hide();
        });
        
        // Context menu actions
        $(document).off('click', '.context-menu-item').on('click', '.context-menu-item', function() {
            const action = $(this).data('action');
            $('#flansa-context-menu').hide();
            
            switch(action) {
                case 'theme':
                    if (window.FlansaThemeManager) {
                        window.FlansaThemeManager.showThemeSettings();
                    }
                    break;
                case 'help':
                    if (window.FlansaNavigationManager) {
                        window.FlansaNavigationManager.showHelpDialog();
                    }
                    break;
            }
        });
        
        // Header hover effects
        $(document).off('mouseenter mouseleave', '.flansa-compact-header button').on({
            mouseenter: function() {
                $(this).css('background', 'rgba(255,255,255,0.3)');
            },
            mouseleave: function() {
                if ($(this).attr('id') !== 'flansa-context-menu-btn' || !$('#flansa-context-menu').is(':visible')) {
                    $(this).css('background', 'rgba(255,255,255,0.2)');
                }
            }
        }, '.flansa-compact-header button');
    },
    
    /**
     * Update header title dynamically
     */
    updateTitle(new_title) {
        $('#flansa-page-title, #flansa-main-title').text(new_title);
    }
};

// Auto-apply theme on header load
$(document).on('DOMContentLoaded', function() {
    if (window.FlansaThemeManager) {
        window.FlansaThemeManager.applySavedTheme();
    }
});