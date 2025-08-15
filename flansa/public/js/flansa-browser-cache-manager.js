/**
 * Flansa Browser Cache Manager
 * Comprehensive solution for browser cache issues that bench migrate cannot solve
 * Specifically addresses cached CSS, JS, and theme files that persist across sessions
 */

class FlansaBrowserCacheManager {
    constructor() {
        this.cacheVersion = Date.now();
        this.assetTimestamp = this.getAssetTimestamp();
        
        console.log('FlansaBrowserCacheManager initialized with version:', this.cacheVersion);
        this.init();
    }
    
    init() {
        // Immediate cache check on load
        this.checkAndHandleCachedAssets();
        
        // Expose global functions
        window.flansaForceReload = () => this.forceReloadWithNuclearOption();
        window.flansaRefreshAssets = () => this.refreshAllAssets();
        window.flansaCheckCacheIssues = () => this.checkForCacheIssues();
        
        // Add automatic cache detection
        this.addAutomaticCacheDetection();
        
        console.log('Browser cache manager ready');
    }
    
    /**
     * Get asset timestamp from server or generate one
     */
    getAssetTimestamp() {
        // Try to get from a meta tag if available
        const meta = document.querySelector('meta[name="flansa-asset-version"]');
        if (meta) {
            return meta.getAttribute('content');
        }
        
        // Generate based on current time
        return Date.now();
    }
    
    /**
     * Check and handle cached assets on page load
     */
    checkAndHandleCachedAssets() {
        console.log('Checking for cached asset issues...');
        
        // Check if assets need refreshing
        const lastAssetCheck = localStorage.getItem('flansa_last_asset_check');
        const currentTimestamp = Date.now();
        
        // Check every 5 minutes or on first load
        if (!lastAssetCheck || (currentTimestamp - parseInt(lastAssetCheck)) > 5 * 60 * 1000) {
            this.refreshAllAssets();
            localStorage.setItem('flansa_last_asset_check', currentTimestamp.toString());
        }
    }
    
    /**
     * Force reload with nuclear option - handles the worst cache cases
     */
    forceReloadWithNuclearOption() {
        console.log('🚀 Nuclear cache option activated...');
        
        frappe.show_alert({
            message: 'Clearing ALL browser caches and reloading...',
            indicator: 'orange'
        });
        
        // Step 1: Clear everything possible
        this.clearAllBrowserCaches();
        
        // Step 2: Add aggressive cache busting
        const url = new URL(window.location.href);
        const timestamp = Date.now();
        
        url.searchParams.set('_v', timestamp);
        url.searchParams.set('_nocache', '1');
        url.searchParams.set('_force', 'true');
        url.searchParams.set('_flansa_reload', timestamp);
        
        // Step 3: Nuclear reload
        setTimeout(() => {
            window.location.replace(url.toString());
        }, 100);
    }
    
    /**
     * Clear all browser caches comprehensively
     */
    async clearAllBrowserCaches() {
        console.log('Clearing all browser caches...');
        
        // 1. Clear localStorage (but preserve user preferences)
        const preserve = ['flansa_user_scheme', 'flansa_custom_primary', 'flansa_custom_secondary', 'sid', 'user_id'];
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (!preserve.includes(key)) {
                localStorage.removeItem(key);
            }
        });
        
        // 2. Clear sessionStorage completely
        sessionStorage.clear();
        
        // 3. Clear Service Workers
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
            } catch (e) {
                console.warn('Service worker clearing failed:', e);
            }
        }
        
        // 4. Clear Cache API
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {
                console.warn('Cache API clearing failed:', e);
            }
        }
        
        // 5. Clear IndexedDB (if any)
        if ('indexedDB' in window) {
            try {
                // This is more complex, but most Frappe apps don't use it heavily
                console.log('IndexedDB clearing skipped (not commonly used)');
            } catch (e) {
                console.warn('IndexedDB clearing failed:', e);
            }
        }
    }
    
    /**
     * Refresh all assets with cache busting
     */
    refreshAllAssets() {
        console.log('Refreshing all assets with cache busting...');
        
        const timestamp = Date.now();
        
        // Refresh CSS files
        this.refreshCSSAssets(timestamp);
        
        // Refresh JavaScript files (for next load)
        this.refreshJSAssets(timestamp);
        
        // Clear CSS custom properties
        this.clearCSSCustomProperties();
        
        // Trigger asset refresh event
        window.dispatchEvent(new CustomEvent('flansa:assets-refreshed', {
            detail: { timestamp: timestamp }
        }));
    }
    
    /**
     * Refresh CSS assets with cache busting
     */
    refreshCSSAssets(timestamp) {
        const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
        
        cssLinks.forEach(link => {
            // Create new link element
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.type = 'text/css';
            
            // Add cache busting to URL
            const url = new URL(link.href);
            url.searchParams.set('_t', timestamp);
            url.searchParams.set('_v', this.cacheVersion);
            url.searchParams.set('_nocache', '1');
            newLink.href = url.toString();
            
            // Replace old link
            link.parentNode.insertBefore(newLink, link);
            
            // Remove old link after new one loads
            newLink.onload = () => {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
            };
            
            console.log('Refreshed CSS:', url.toString());
        });
    }
    
    /**
     * Refresh JavaScript assets (for next page load)
     */
    refreshJSAssets(timestamp) {
        const scripts = document.querySelectorAll('script[src]');
        
        scripts.forEach(script => {
            // Don't reload scripts on current page, just prepare for next load
            if (script.src) {
                const url = new URL(script.src);
                url.searchParams.set('_t', timestamp);
                url.searchParams.set('_v', this.cacheVersion);
                
                // Store for next load
                script.setAttribute('data-cache-bust', url.toString());
                console.log('Prepared JS refresh:', url.toString());
            }
        });
        
        // Special handling for gallery field renderer
        this.forceReloadGalleryRenderer(timestamp);
    }
    
    /**
     * Force reload gallery field renderer specifically
     */
    forceReloadGalleryRenderer(timestamp) {
        // Clear any cached gallery-related modules
        if (typeof frappe !== 'undefined' && frappe.require) {
            // Clear from require cache if it exists
            const galleryModules = [
                '/assets/flansa/js/gallery_field_renderer.js',
                '/assets/flansa/js/gallery_field.js',
                '/assets/flansa/js/gallery_test_simple.js'
            ];
            
            galleryModules.forEach(module => {
                if (frappe.require.cache && frappe.require.cache[module]) {
                    delete frappe.require.cache[module];
                    console.log('Cleared from require cache:', module);
                }
            });
        }
        
        // Clear localStorage items related to gallery
        const galleryKeys = Object.keys(localStorage).filter(key => 
            key.includes('gallery') || 
            key.includes('Gallery') ||
            key.includes('enhanced_fields')
        );
        
        galleryKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log('Cleared gallery localStorage key:', key);
        });
        
        // Clear any gallery-specific variables
        if (typeof window !== 'undefined') {
            if (window.enhanced_fields) {
                window.enhanced_fields = new Set();
                console.log('Cleared enhanced_fields tracking');
            }
        }
    }
    
    /**
     * Clear CSS custom properties
     */
    clearCSSCustomProperties() {
        const properties = [
            '--flansa-primary', '--flansa-secondary', '--flansa-gradient-primary',
            '--flansa-text-primary', '--flansa-text-secondary', '--flansa-surface',
            '--flansa-background'
        ];
        
        properties.forEach(prop => {
            document.documentElement.style.removeProperty(prop);
        });
        
        // Remove theme classes
        document.body.classList.remove('flansa-theme-dark');
    }
    
    /**
     * Check for cache issues and display helpful information
     */
    async checkForCacheIssues() {
        console.log('🔍 Checking for cache issues...');
        
        const issues = [];
        const details = [];
        
        // Check for old localStorage items (more specific filtering)
        const oldKeys = Object.keys(localStorage).filter(key => {
            return (
                // Old Flansa version keys
                key.startsWith('flansa_') && 
                !['flansa_user_scheme', 'flansa_custom_primary', 'flansa_custom_secondary'].includes(key)
            ) || (
                // Old Frappe cache keys
                key.startsWith('_') && 
                (key.includes('assets') || key.includes('page') || key.includes('metadata') || key.includes('version'))
            ) || (
                // Gallery-related cache keys
                key.includes('gallery') || 
                key.includes('Gallery') ||
                key.includes('enhanced_fields') ||
                key.includes('gallery_field_renderer')
            ) || (
                // Other problematic keys
                key.startsWith('route:') || 
                key.startsWith('preferred_breadcrumbs:') ||
                key.includes('form_tour')
            );
        });
        
        if (oldKeys.length > 0) {
            issues.push(`Found ${oldKeys.length} old localStorage items`);
            details.push(`Keys: ${oldKeys.slice(0, 5).join(', ')}${oldKeys.length > 5 ? '...' : ''}`);
        }
        
        // Check for service workers
        let serviceWorkerCount = 0;
        if ('serviceWorker' in navigator) {
            try {
                const regs = await navigator.serviceWorker.getRegistrations();
                serviceWorkerCount = regs.length;
                if (serviceWorkerCount > 0) {
                    issues.push(`Found ${serviceWorkerCount} service workers`);
                }
            } catch (e) {
                console.warn('Could not check service workers:', e);
            }
        }
        
        // Check for caches
        let cacheCount = 0;
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                cacheCount = names.length;
                if (cacheCount > 0) {
                    issues.push(`Found ${cacheCount} cache storage entries`);
                    details.push(`Cache names: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '...' : ''}`);
                }
            } catch (e) {
                console.warn('Could not check caches:', e);
            }
        }
        
        // Display results
        if (issues.length > 0) {
            const dialog = new frappe.ui.Dialog({
                title: '🔍 Cache Issues Detected',
                size: 'large',
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'issues_info',
                        options: `
                            <div style="padding: 10px;">
                                <h4>Found potential cache issues:</h4>
                                <ul>
                                    ${issues.map(issue => `<li><strong>${issue}</strong></li>`).join('')}
                                </ul>
                                
                                <h5>Details:</h5>
                                <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
                                    ${details.join('<br>')}
                                </div>
                                
                                <div class="alert alert-warning" style="margin-top: 15px;">
                                    <strong>What this means:</strong><br>
                                    These cached items may cause theme changes and other updates to not appear properly.
                                </div>
                            </div>
                        `
                    }
                ],
                primary_action_label: '🚀 Force Clear All & Reload',
                primary_action: () => {
                    dialog.hide();
                    this.forceReloadWithNuclearOption();
                },
                secondary_action_label: '🧹 Clear Issues Only',
                secondary_action: () => {
                    this.clearDetectedIssues(oldKeys);
                    dialog.hide();
                    frappe.show_alert('Cache issues cleared! Refresh page if needed.', 'green');
                }
            });
            
            dialog.show();
        } else {
            frappe.show_alert({
                message: 'No cache issues detected! 🎉',
                indicator: 'green'
            });
        }
    }
    
    /**
     * Clear only the detected cache issues
     */
    async clearDetectedIssues(problematicKeys) {
        console.log('🧹 Clearing detected cache issues...');
        
        // Clear problematic localStorage keys
        problematicKeys.forEach(key => {
            try {
                localStorage.removeItem(key);
                console.log('Cleared localStorage key:', key);
            } catch (e) {
                console.warn(`Could not remove ${key}:`, e);
            }
        });
        
        // Clear service workers
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                    console.log('Unregistered service worker:', registration.scope);
                }
            } catch (e) {
                console.warn('Service worker clearing failed:', e);
            }
        }
        
        // Clear cache storage
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                    console.log('Deleted cache:', cacheName);
                }
            } catch (e) {
                console.warn('Cache storage clearing failed:', e);
            }
        }
        
        // Refresh assets
        this.refreshAllAssets();
    }
    
    /**
     * Add automatic cache issue detection
     */
    addAutomaticCacheDetection() {
        // Check for theme application issues
        setTimeout(() => {
            const rootStyles = getComputedStyle(document.documentElement);
            const primaryColor = rootStyles.getPropertyValue('--flansa-primary');
            
            // If theme should be applied but isn't
            const userScheme = localStorage.getItem('flansa_user_scheme');
            if (userScheme && !primaryColor) {
                console.warn('⚠️ Theme cache issue detected');
                frappe.show_alert({
                    message: 'Theme cache issue detected. Click to refresh.',
                    indicator: 'orange',
                    action: {
                        label: 'Refresh Theme',
                        action: () => this.refreshAllAssets()
                    }
                }, 10);
            }
        }, 2000);
    }
    
    /**
     * Add refresh controls to any page
     */
    addCacheControlsToPage(page) {
        if (!page || !page.add_menu_item) return;
        
        page.add_menu_item('🚀 Force Reload (Nuclear)', () => {
            this.forceReloadWithNuclearOption();
        });
        
        page.add_menu_item('🔄 Refresh Assets Only', () => {
            this.refreshAllAssets();
            frappe.show_alert('Assets refreshed!', 'green');
        });
        
        page.add_menu_item('🔍 Check Cache Issues', () => {
            this.checkForCacheIssues();
        });
    }
    
    /**
     * Create a cache status panel
     */
    showCacheStatus() {
        const d = new frappe.ui.Dialog({
            title: '🔧 Browser Cache Status',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'cache_status',
                    options: this.generateCacheStatusHTML()
                }
            ],
            primary_action_label: 'Force Clear All',
            primary_action: () => {
                d.hide();
                this.forceReloadWithNuclearOption();
            },
            secondary_action_label: 'Refresh Assets',
            secondary_action: () => {
                this.refreshAllAssets();
                d.set_df_property('cache_status', 'options', this.generateCacheStatusHTML());
                frappe.show_alert('Assets refreshed!', 'green');
            }
        });
        
        d.show();
    }
    
    /**
     * Generate cache status HTML
     */
    generateCacheStatusHTML() {
        const localStorageCount = Object.keys(localStorage).length;
        const sessionStorageCount = Object.keys(sessionStorage).length;
        
        return `
            <div style="padding: 20px;">
                <h4>📊 Current Cache Status</h4>
                <table class="table table-bordered">
                    <tr>
                        <td><strong>LocalStorage Items</strong></td>
                        <td>${localStorageCount}</td>
                    </tr>
                    <tr>
                        <td><strong>SessionStorage Items</strong></td>
                        <td>${sessionStorageCount}</td>
                    </tr>
                    <tr>
                        <td><strong>Last Asset Check</strong></td>
                        <td>${localStorage.getItem('flansa_last_asset_check') || 'Never'}</td>
                    </tr>
                    <tr>
                        <td><strong>Current Theme</strong></td>
                        <td>${localStorage.getItem('flansa_user_scheme') || 'Default'}</td>
                    </tr>
                </table>
                
                <h4>🛠️ Available Actions</h4>
                <div class="alert alert-info">
                    <p><strong>Refresh Assets Only:</strong> Clears CSS/JS caches but keeps preferences</p>
                    <p><strong>Force Clear All:</strong> Nuclear option - clears everything and reloads</p>
                </div>
                
                <h4>⌨️ Keyboard Shortcuts</h4>
                <ul>
                    <li><kbd>Ctrl+Shift+R</kbd> - Force Clear All</li>
                    <li><kbd>Ctrl+Alt+R</kbd> - Refresh Assets Only</li>
                </ul>
            </div>
        `;
    }
}

// Initialize the browser cache manager
console.log('Loading Flansa Browser Cache Manager...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.flansaBrowserCacheManager = new FlansaBrowserCacheManager();
    });
} else {
    window.flansaBrowserCacheManager = new FlansaBrowserCacheManager();
}

// Add keyboard shortcuts globally
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+R - Nuclear option
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        if (window.flansaBrowserCacheManager) {
            window.flansaBrowserCacheManager.forceReloadWithNuclearOption();
        }
    }
    
    // Ctrl+Alt+R - Assets only
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'R') {
        e.preventDefault();
        if (window.flansaBrowserCacheManager) {
            window.flansaBrowserCacheManager.refreshAllAssets();
        }
    }
});

// Global utilities
window.flansaCache = {
    forceReload: () => window.flansaBrowserCacheManager?.forceReloadWithNuclearOption(),
    refreshAssets: () => window.flansaBrowserCacheManager?.refreshAllAssets(),
    checkIssues: () => window.flansaBrowserCacheManager?.checkForCacheIssues(),
    showStatus: () => window.flansaBrowserCacheManager?.showCacheStatus(),
    
    // Debugging utilities
    listAllKeys: () => {
        console.log('📋 All localStorage keys:', Object.keys(localStorage));
        return Object.keys(localStorage);
    },
    
    listProblematicKeys: () => {
        const problematic = Object.keys(localStorage).filter(key => {
            return (
                key.startsWith('flansa_') && 
                !['flansa_user_scheme', 'flansa_custom_primary', 'flansa_custom_secondary'].includes(key)
            ) || (
                key.startsWith('_') && 
                (key.includes('assets') || key.includes('page') || key.includes('metadata') || key.includes('version'))
            ) || (
                // Gallery-related cache keys
                key.includes('gallery') || 
                key.includes('Gallery') ||
                key.includes('enhanced_fields') ||
                key.includes('gallery_field_renderer')
            ) || (
                key.startsWith('route:') || 
                key.startsWith('preferred_breadcrumbs:') ||
                key.includes('form_tour')
            );
        });
        console.log('⚠️ Problematic keys:', problematic);
        return problematic;
    },
    
    clearProblematicKeysOnly: () => {
        const problematic = window.flansaCache.listProblematicKeys();
        problematic.forEach(key => {
            try {
                localStorage.removeItem(key);
                console.log('✅ Removed:', key);
            } catch (e) {
                console.warn('❌ Could not remove:', key, e);
            }
        });
        console.log(`🧹 Cleared ${problematic.length} problematic keys`);
        return `Cleared ${problematic.length} keys`;
    },
    
    // Gallery-specific cache clearing
    clearGalleryCache: () => {
        console.log('🖼️ Clearing gallery-specific cache...');
        
        // Clear gallery localStorage
        const galleryKeys = Object.keys(localStorage).filter(key => 
            key.includes('gallery') || 
            key.includes('Gallery') ||
            key.includes('enhanced_fields')
        );
        
        galleryKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log('✅ Cleared gallery key:', key);
        });
        
        // Clear enhanced fields tracking
        if (window.enhanced_fields) {
            window.enhanced_fields = new Set();
        }
        
        // Force refresh gallery-related assets
        if (window.flansaBrowserCacheManager) {
            window.flansaBrowserCacheManager.forceReloadGalleryRenderer(Date.now());
        }
        
        console.log(`🧹 Cleared ${galleryKeys.length} gallery cache items`);
        frappe.show_alert('Gallery cache cleared! Please refresh the page.', 'green');
        
        return `Cleared ${galleryKeys.length} gallery cache items`;
    }
};