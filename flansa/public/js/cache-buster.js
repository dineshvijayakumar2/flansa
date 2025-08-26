
// Helper function to check if an image is already a Flansa logo
function isFlansaLogo(img) {
    if (!img || !img.src) return false;
    return img.src.includes('Flansa') || img.src.includes('flansa') || 
           img.getAttribute('alt') === 'Flansa' || 
           img.getAttribute('title') === 'Flansa';
}

// Helper function to apply Flansa logo to an element
function applyLogoToElement(img) {
    if (!window.FlansaLogoConfig) return;
    
    const logoUrl = window.FlansaLogoConfig.LOGO_PATH + window.FlansaLogoConfig.LOGO_FILENAME;
    img.alt = window.FlansaLogoConfig.LOGO_ALT;
    img.title = window.FlansaLogoConfig.LOGO_TITLE;
    
    // Force larger size with inline styles
    img.style.cssText = `
        height: 65px !important;
        min-height: 65px !important;
        width: auto !important;
        object-fit: contain !important;
        border-radius: 4px !important;
        display: inline-block !important;
        vertical-align: middle !important;
    `;
    
    // Add cache busting
    const timestamp = new Date().getTime();
    if (logoUrl.includes('?')) {
        img.src = logoUrl + '&t=' + timestamp;
    } else {
        img.src = logoUrl + '?t=' + timestamp;
    }
}

// Cache busting utilities
window.flansaCacheBuster = {
    version: Date.now(),
    clearBrowserCache: function() {
        // Force reload with cache busting
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister();
                }
            });
        }
        
        // Clear various caches
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) {
                    caches.delete(name);
                }
            });
        }
        
        // Add cache busting parameter to current URL and reload
        const url = new URL(window.location);
        url.searchParams.set('_cb', Date.now());
        window.location.replace(url.toString());
    },
    
    refreshFlansaLogo: function() {
        console.log('🔄 Force refreshing Flansa logo...');
        
        // Clear logo replacement flags
        window.flansaLogoReplaced = false;
        
        // Remove existing logo replacement markers
        document.querySelectorAll('.flansa-logo-replaced').forEach(logo => {
            logo.classList.remove('flansa-logo-replaced');
        });
        
        // Force re-run logo replacement scripts
        if (window.replaceGlobalLogo) {
            window.replaceGlobalLogo();
        }
        
        // Manually trigger logo replacement using central config
        const logoImages = document.querySelectorAll('.navbar img, .navbar-brand img, .navbar-header img');
        logoImages.forEach(img => {
            if (window.FlansaLogoConfig && !isFlansaLogo(img)) {
                applyLogoToElement(img);
                console.log('✅ Logo refreshed:', img);
            }
        });
        
        // Replace text
        document.querySelectorAll('.navbar-brand, .navbar-home a').forEach(element => {
            if (element.textContent && element.textContent.trim() === 'Frappe') {
                element.textContent = 'Flansa';
                element.href = '/app/flansa';
            }
        });
        
        console.log('✅ Flansa logo force refresh complete');
    }
};

// Auto-clear cache every 5 minutes to prevent stale JavaScript issues
setInterval(function() {
    if (window.location.pathname.includes('flansa-visual-builder')) {
        // Only refresh if user hasn't interacted recently
        const lastActivity = window.flansaLastActivity || Date.now();
        if (Date.now() - lastActivity > 300000) { // 5 minutes
            console.log('Auto-refreshing to clear cache...');
            window.flansaCacheBuster.clearBrowserCache();
        }
    }
}, 300000);

// Track user activity
document.addEventListener('click', function() {
    window.flansaLastActivity = Date.now();
});

// Add keyboard shortcut for manual logo refresh: Ctrl+Shift+L
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        console.log('🔄 Manual logo refresh triggered (Ctrl+Shift+L)');
        window.flansaCacheBuster.refreshFlansaLogo();
        
        // Show user feedback
        if (typeof frappe !== 'undefined' && frappe.show_alert) {
            frappe.show_alert({
                message: 'Flansa logo refreshed!',
                indicator: 'green'
            });
        }
    }
});

// Also expose global functions for console use
window.refreshFlansaLogo = window.flansaCacheBuster.refreshFlansaLogo;
window.clearCache = window.flansaCacheBuster.clearBrowserCache;

console.log('🔧 Cache buster loaded. Use Ctrl+Shift+L to refresh logo, or run refreshFlansaLogo() in console.');
