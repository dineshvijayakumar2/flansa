/**
 * Flansa Global Logo Replacement and Configuration
 * Central logo management and replacement system
 */

// Central Logo Configuration
window.FlansaLogoConfig = {
    // Logo variants (choose the best one for your brand)
    LOGO_VARIANTS: {
        'modern': 'Flansa_Logo_Modern.svg',     // Clean, professional look
        'icon': 'Flansa_Icon.svg',              // Icon-only for very small spaces
        'premium': 'Flansa_Logo_Premium.svg',   // Animated, premium feel
        'original': 'Flansa_Logo.svg'           // Your current logo
    },
    
    // Current active logo (change this to switch logos)
    ACTIVE_LOGO: 'modern', // Options: 'modern', 'icon', 'premium', 'original'
    
    // Logo settings
    get LOGO_FILENAME() {
        return this.LOGO_VARIANTS[this.ACTIVE_LOGO] || this.LOGO_VARIANTS.modern;
    },
    LOGO_PATH: '/assets/flansa/images/',
    LOGO_ALT: 'Flansa',
    LOGO_TITLE: 'Flansa - Return to Workspace',
    
    // Adaptive logo sizing based on context - MUCH LARGER SIZES
    LOGO_SIZES: {
        'navbar': { height: '65px', width: 'auto' },      // Top navigation - EXTRA LARGE
        'header': { height: '75px', width: 'auto' },      // Page headers
        'large': { height: '100px', width: 'auto' },      // Hero sections
        'small': { height: '50px', width: 'auto' }        // Compact areas
    },
    
    // Default sizing - MUCH LARGER
    LOGO_HEIGHT: '65px',  // Significantly increased
    LOGO_WIDTH: 'auto',
    LOGO_BORDER_RADIUS: '4px',
    
    // Visual enhancements for small sizes
    ENABLE_SMALL_SIZE_OPTIMIZATION: true,
    SMALL_SIZE_EFFECTS: {
        contrast: 1.1,
        brightness: 1.05,
        shadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    
    // Navigation
    WORKSPACE_URL: '/app/flansa-workspace',
    
    // Cache busting
    CACHE_BUST: true,
    
    /**
     * Get the complete logo URL with optional cache busting
     */
    getLogoUrl: function(cacheBust = this.CACHE_BUST) {
        const baseUrl = this.LOGO_PATH + this.LOGO_FILENAME;
        return cacheBust ? `${baseUrl}?v=${Date.now()}` : baseUrl;
    },
    
    /**
     * Apply logo attributes to an img element
     */
    applyToElement: function(imgElement) {
        if (!imgElement) return;
        
        imgElement.src = this.getLogoUrl();
        imgElement.alt = this.LOGO_ALT;
        imgElement.title = this.LOGO_TITLE;
        imgElement.style.height = this.LOGO_HEIGHT;
        imgElement.style.width = this.LOGO_WIDTH;
        imgElement.style.borderRadius = this.LOGO_BORDER_RADIUS;
        imgElement.style.cursor = 'pointer';
        imgElement.style.transition = 'opacity 0.2s';
        
        // Apply small size optimizations if enabled
        if (this.ENABLE_SMALL_SIZE_OPTIMIZATION) {
            const effects = this.SMALL_SIZE_EFFECTS;
            imgElement.style.filter = `contrast(${effects.contrast}) brightness(${effects.brightness})`;
            imgElement.style.boxShadow = effects.shadow;
        }
        
        // Smart logo selection for very small sizes
        const logoHeight = parseInt(imgElement.style.height);
        if (logoHeight <= 24 && this.ACTIVE_LOGO !== 'icon') {
            // Temporarily switch to icon for very small placements
            const iconUrl = this.LOGO_PATH + this.LOGO_VARIANTS.icon + (this.CACHE_BUST ? `?v=${Date.now()}` : '');
            imgElement.src = iconUrl;
        }
        
        // Add replacement marker
        imgElement.classList.add('flansa-logo-replaced');
    },
    
    /**
     * Check if an element is already using Flansa logo
     */
    isFlansaLogo: function(imgElement) {
        return imgElement && (
            imgElement.src.includes(this.LOGO_FILENAME) ||
            imgElement.classList.contains('flansa-logo-replaced')
        );
    },
    
    /**
     * Make element clickable to workspace
     */
    makeClickable: function(element) {
        if (!element) return;
        
        // If it's already in a link
        const parentLink = element.closest('a');
        if (parentLink) {
            parentLink.href = this.WORKSPACE_URL;
            parentLink.onclick = (e) => {
                e.preventDefault();
                window.location.href = this.WORKSPACE_URL;
            };
        } else {
            // Make element itself clickable
            element.style.cursor = 'pointer';
            element.onclick = () => {
                window.location.href = this.WORKSPACE_URL;
            };
        }
    },
    
    /**
     * Switch between logo variants
     */
    switchLogo: function(variant) {
        if (!this.LOGO_VARIANTS[variant]) {
            console.warn('Logo variant not found:', variant);
            console.log('Available variants:', Object.keys(this.LOGO_VARIANTS));
            return;
        }
        
        this.ACTIVE_LOGO = variant;
        console.log(`🎨 Switched to ${variant} logo variant`);
        
        // Update all existing logos
        const logos = document.querySelectorAll('.flansa-logo-replaced');
        logos.forEach(logo => {
            logo.src = this.getLogoUrl();
        });
        
        // Save preference
        localStorage.setItem('flansa_logo_variant', variant);
    },
    
    /**
     * Get adaptive logo size for context
     */
    getAdaptiveSize: function(context = 'navbar') {
        return this.LOGO_SIZES[context] || this.LOGO_SIZES.navbar;
    }
};

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
    
    // Force larger size directly inline
    img.style.cssText = `
        height: 65px !important;
        min-height: 65px !important;
        width: auto !important;
        object-fit: contain !important;
        border-radius: ${window.FlansaLogoConfig.LOGO_BORDER_RADIUS} !important;
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

// Helper function to make logo clickable
function makeLogoClickable(element) {
    if (!element) return;
    
    // If it's an image, wrap it in a link
    if (element.tagName === 'IMG' && element.parentElement.tagName !== 'A') {
        const link = document.createElement('a');
        link.href = window.FlansaLogoConfig.WORKSPACE_URL;
        link.title = window.FlansaLogoConfig.LOGO_TITLE;
        element.parentElement.insertBefore(link, element);
        link.appendChild(element);
    } else if (element.tagName === 'A') {
        element.href = window.FlansaLogoConfig.WORKSPACE_URL;
        element.title = window.FlansaLogoConfig.LOGO_TITLE;
    }
}

// Make it globally available
window.FLANSA_LOGO = window.FlansaLogoConfig;

// Load saved logo preference
(function() {
    const savedVariant = localStorage.getItem('flansa_logo_variant');
    if (savedVariant && window.FlansaLogoConfig.LOGO_VARIANTS[savedVariant]) {
        window.FlansaLogoConfig.ACTIVE_LOGO = savedVariant;
        console.log(`🎨 Loaded saved logo variant: ${savedVariant}`);
    }
})();

(function() {
    'use strict';
    
    let logoReplaced = false;
    
    function replaceGlobalLogo() {
        if (logoReplaced) return;
        
        try {
            // Target the Frappe logo in the navbar
            const logoSelectors = [
                '.navbar-brand img',           // Standard navbar logo
                '.navbar .navbar-brand img',   // More specific
                '.navbar-header img',          // Alternative location
                'img[alt="Frappe"]',          // By alt text
                'img[src*="frappe"]',         // By source containing frappe
                '.navbar img[width="24"]',     // Common Frappe logo size
                '.navbar-brand .brand-logo'   // Brand logo class
            ];
            
            let logoReplaced = false;
            
            logoSelectors.forEach(selector => {
                const logos = document.querySelectorAll(selector);
                logos.forEach(logo => {
                    if (!isFlansaLogo(logo)) {
                        // Replace with Flansa logo using central config
                        const newSrc = window.FlansaLogoConfig.LOGO_PATH + window.FlansaLogoConfig.LOGO_FILENAME;
                        
                        // Force reload by preloading image
                        const preloadImg = new Image();
                        preloadImg.onload = function() {
                            applyLogoToElement(logo);
                            console.log('✅ Global logo replaced with cache refresh');
                        };
                        preloadImg.src = newSrc;
                        
                        // Make logo clickable using central config
                        makeLogoClickable(logo);
                        
                        logoReplaced = true;
                        console.log('✅ Flansa logo replaced successfully');
                    }
                });
            });
            
            // Also replace any brand text that says "Frappe"
            const brandTexts = document.querySelectorAll('.navbar-brand, .brand-text');
            brandTexts.forEach(brandText => {
                if (brandText.textContent && brandText.textContent.includes('Frappe')) {
                    brandText.textContent = brandText.textContent.replace('Frappe', 'Flansa');
                }
            });
            
            if (logoReplaced) {
                window.flansaLogoReplaced = true;
            }
            
        } catch (error) {
            console.warn('Error replacing Flansa logo:', error);
        }
    }
    
    // Function to initialize logo replacement
    function initializeLogoReplacement() {
        // Try immediate replacement
        replaceGlobalLogo();
        
        // Set up observer for dynamic content
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function(mutations) {
                let shouldCheck = false;
                
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' || mutation.type === 'attributes') {
                        shouldCheck = true;
                    }
                });
                
                if (shouldCheck && !window.flansaLogoReplaced) {
                    replaceGlobalLogo();
                }
            });
            
            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'class']
            });
            
            // Stop observing after logo is replaced or 30 seconds
            setTimeout(() => {
                if (window.flansaLogoReplaced) {
                    observer.disconnect();
                }
            }, 30000);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLogoReplacement);
    } else {
        initializeLogoReplacement();
    }
    
    // Also listen for Frappe-specific events
    if (typeof frappe !== 'undefined') {
        $(document).on('app-loaded page-change toolbar-setup', function() {
            setTimeout(replaceGlobalLogo, 100);
        });
    }
    
    // Backup: Periodic check for first 10 seconds
    let checkCount = 0;
    const checkInterval = setInterval(function() {
        checkCount++;
        
        if (!window.flansaLogoReplaced && checkCount < 100) { // 10 seconds
            replaceGlobalLogo();
        } else {
            clearInterval(checkInterval);
        }
    }, 100);
    
})();

// Add CSS to ensure navbar can accommodate larger logo
(function addNavbarStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Force larger navbar for bigger logo */
        .navbar {
            min-height: 80px !important;  /* Much larger */
            padding: 10px 15px !important;
        }
        
        /* Force ALL logo images to be larger */
        .navbar-brand img,
        .navbar img,
        .navbar-home img,
        img[alt="Logo"],
        img[alt="Flansa"],
        img[title="Flansa"] {
            height: 65px !important;
            min-height: 65px !important;
            max-height: 65px !important;
            width: auto !important;
            object-fit: contain !important;
            vertical-align: middle;
            display: inline-block !important;
        }
        
        /* Ensure logo container has proper alignment */
        .navbar-brand,
        .navbar-home,
        .navbar-home a {
            display: inline-flex !important;
            align-items: center !important;
            height: 60px !important;
            padding: 0 !important;
        }
        
        /* Adjust other navbar elements to align properly */
        .navbar-nav > li > a {
            line-height: 60px !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
        }
        
        /* Force logo in all contexts to be larger */
        .page-head img[src*="Flansa"],
        .layout-side-section img[src*="Flansa"],
        header img[src*="Flansa"] {
            height: 65px !important;
            min-height: 65px !important;
        }
    `;
    document.head.appendChild(style);
})();

// Console helpers for logo management
window.switchFlansaLogo = function(variant) {
    window.FlansaLogoConfig.ACTIVE_LOGO = variant;
    replaceGlobalLogo();
};

// Force immediate logo size increase
setInterval(() => {
    const logos = document.querySelectorAll('.navbar img, .navbar-brand img, img[alt="Logo"], img[alt="Flansa"]');
    logos.forEach(img => {
        if (img && img.style.height !== '65px') {
            img.style.cssText = `
                height: 65px !important;
                min-height: 65px !important;
                max-height: 65px !important;
                width: auto !important;
                object-fit: contain !important;
                display: inline-block !important;
                vertical-align: middle !important;
            `;
        }
    });
}, 500);

console.log('🎨 Flansa Logo System loaded with LARGER SIZE (65px)!');
console.log('Available logos:', Object.keys(window.FlansaLogoConfig.LOGO_VARIANTS));
console.log('Current logo:', window.FlansaLogoConfig.ACTIVE_LOGO);
console.log('💡 Switch logos with: switchFlansaLogo("modern") or switchFlansaLogo("premium")');