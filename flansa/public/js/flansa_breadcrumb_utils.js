/**
 * Flansa Breadcrumb Utilities
 * Provides enhanced breadcrumb functionality including keyboard navigation
 */

window.FlansaBreadcrumbUtils = {
    /**
     * Initialize breadcrumb enhancements
     */
    init() {
        this.setupKeyboardNavigation();
        this.setupOverflowHandling();
        this.setupTooltips();
    },
    
    /**
     * Setup keyboard navigation for breadcrumbs
     */
    setupKeyboardNavigation() {
        // Listen for keyboard events on breadcrumb container
        $(document).on('keydown', '.page-breadcrumbs', function(e) {
            const $breadcrumbs = $(this).find('.breadcrumb-item a');
            const $focused = $(':focus');
            const currentIndex = $breadcrumbs.index($focused);
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        $breadcrumbs.eq(currentIndex - 1).focus();
                    }
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    if (currentIndex < $breadcrumbs.length - 1) {
                        $breadcrumbs.eq(currentIndex + 1).focus();
                    }
                    break;
                    
                case 'Home':
                    e.preventDefault();
                    $breadcrumbs.first().focus();
                    break;
                    
                case 'End':
                    e.preventDefault();
                    $breadcrumbs.last().focus();
                    break;
            }
        });
    },
    
    /**
     * Handle breadcrumb overflow with ellipsis
     */
    setupOverflowHandling() {
        const checkBreadcrumbOverflow = () => {
            $('.page-breadcrumbs').each(function() {
                const $container = $(this);
                const containerWidth = $container.width();
                const contentWidth = $container[0].scrollWidth;
                
                if (contentWidth > containerWidth) {
                    // Add overflow class for styling
                    $container.addClass('breadcrumb-overflow');
                    
                    // Optionally collapse middle items
                    const $items = $container.find('.breadcrumb-item');
                    if ($items.length > 4) {
                        // Keep first 2 and last 2, hide middle ones
                        $items.slice(2, -2).addClass('breadcrumb-collapsed');
                        
                        // Add expand button if not exists
                        if (!$container.find('.breadcrumb-expand').length) {
                            const $expandBtn = $('<span class="breadcrumb-expand">...</span>');
                            $expandBtn.insertAfter($items.eq(1));
                            
                            $expandBtn.on('click', function() {
                                $items.removeClass('breadcrumb-collapsed');
                                $(this).remove();
                            });
                        }
                    }
                } else {
                    $container.removeClass('breadcrumb-overflow');
                }
            });
        };
        
        // Check on load and resize
        $(window).on('resize', frappe.utils.debounce(checkBreadcrumbOverflow, 250));
        checkBreadcrumbOverflow();
    },
    
    /**
     * Add tooltips to truncated breadcrumb items
     */
    setupTooltips() {
        $(document).on('mouseenter', '.breadcrumb-item', function() {
            const $item = $(this);
            const text = $item.text().trim();
            
            // Check if text is truncated
            if ($item[0].offsetWidth < $item[0].scrollWidth) {
                $item.attr('title', text);
            } else {
                $item.removeAttr('title');
            }
        });
    },
    
    /**
     * Enhanced breadcrumb add function with caching
     */
    addBreadcrumb(label, route, options = {}) {
        // Get or create cache
        if (!window.breadcrumbCache) {
            window.breadcrumbCache = new Map();
        }
        
        const cacheKey = `${label}_${route}`;
        const cached = window.breadcrumbCache.get(cacheKey);
        
        if (cached && !options.force) {
            // Use cached breadcrumb
            frappe.breadcrumbs.add(cached.label, cached.route);
        } else {
            // Add new breadcrumb and cache it
            frappe.breadcrumbs.add(label, route);
            window.breadcrumbCache.set(cacheKey, { label, route });
            
            // Clear old cache entries (keep last 20)
            if (window.breadcrumbCache.size > 20) {
                const firstKey = window.breadcrumbCache.keys().next().value;
                window.breadcrumbCache.delete(firstKey);
            }
        }
    },
    
    /**
     * Build hierarchical breadcrumbs with proper context
     */
    async buildHierarchicalBreadcrumbs(context) {
        frappe.breadcrumbs.clear();
        
        // Always start with workspace
        this.addBreadcrumb("Workspace", "/app/flansa");
        
        // Add context-specific breadcrumbs
        if (context.application) {
            this.addBreadcrumb(
                context.application.title || context.application.name,
                `/app/flansa-app-dashboard/${context.application.name}`
            );
        }
        
        if (context.table) {
            this.addBreadcrumb(
                context.table.label || context.table.name,
                `/app/flansa-table-builder/${context.table.name}`
            );
        }
        
        if (context.report) {
            this.addBreadcrumb(
                "Reports",
                context.table ? `/app/flansa-saved-reports?table=${context.table.name}` : "/app/flansa-saved-reports"
            );
            
            // Truncate long report names
            const reportTitle = context.report.title || "Report";
            const displayTitle = reportTitle.length > 30 ? reportTitle.substring(0, 27) + '...' : reportTitle;
            this.addBreadcrumb(displayTitle, "");
        }
        
        if (context.current) {
            // Add current page as last breadcrumb
            this.addBreadcrumb(context.current, "");
        }
    },
    
    /**
     * Clear breadcrumb cache
     */
    clearCache() {
        if (window.breadcrumbCache) {
            window.breadcrumbCache.clear();
        }
        if (window.flansaBreadcrumbCache) {
            window.flansaBreadcrumbCache = {};
        }
    }
};

// Initialize on document ready
$(document).ready(() => {
    window.FlansaBreadcrumbUtils.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.FlansaBreadcrumbUtils;
}