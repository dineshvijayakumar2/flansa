
// Enhanced Flansa Logo Redirect and Duplicate Removal
(function() {
    'use strict';
    
    let redirectSetup = false;
    
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
    
    function setupFlansaLogoRedirect() {
        console.log('Setting up Flansa logo redirect...');
        
        // Multiple approaches to find and fix the logo
        const selectors = [
            '.navbar-home a',
            '.navbar-brand',
            'a[href="/app"]',
            'a[href="/app/"]',
            '.navbar .navbar-nav a:first-child',
            '.navbar-header a'
        ];
        
        let logoFound = false;
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (element && !logoFound) {
                    // Check if this looks like the main logo/home link
                    const isMainLogo = (
                        element.href === window.location.origin + '/app' ||
                        element.href === window.location.origin + '/app/' ||
                        element.classList.contains('navbar-brand') ||
                        element.closest('.navbar-home')
                    );
                    
                    if (isMainLogo) {
                        console.log('Found main logo element:', element);
                        setupLogoRedirect(element);
                        logoFound = true;
                    }
                }
            });
        });
        
        // Fallback: look for any link that goes to /app
        if (!logoFound) {
            const appLinks = document.querySelectorAll('a[href*="/app"]');
            appLinks.forEach(link => {
                if (link.href.endsWith('/app') || link.href.endsWith('/app/')) {
                    console.log('Found app link as fallback:', link);
                    setupLogoRedirect(link);
                    logoFound = true;
                }
            });
        }
        
        // Replace any standalone "Frappe" text in navbar
        replaceStandaloneFrappeText();
        
        // Remove duplicates regardless
        removeDuplicateFlansaElements();
        
        if (logoFound) {
            redirectSetup = true;
            console.log('Flansa logo redirect setup complete');
        } else {
            console.log('No suitable logo element found, will retry');
        }
        
        return logoFound;
    }
    
    function setupLogoRedirect(element) {
        // Update href to point to flansa-workspace
        element.href = '/app/flansa-workspace';
        element.setAttribute('title', 'Flansa Workspace');
        
        // Replace logo image with Flansa logo
        const logoImg = element.querySelector('img');
        if (logoImg && window.FlansaLogoConfig && !isFlansaLogo(logoImg)) {
            console.log('🎨 Replacing Frappe logo with Flansa logo');
            
            // Apply logo using central config
            applyLogoToElement(logoImg);
            
            // Force image reload by creating new image element
            const newImg = new Image();
            newImg.onload = function() {
                logoImg.src = this.src;
                console.log('✅ Logo image replaced and cache refreshed');
            };
            newImg.src = logoImg.src;
        }
        
        // Replace any Frappe text with Flansa
        if (element.textContent && element.textContent.trim() === 'Frappe') {
            console.log('🏷️ Replacing Frappe text with Flansa');
            element.textContent = 'Flansa';
        }
        
        // Remove any existing onclick handlers
        element.onclick = null;
        
        // Add comprehensive click handler
        element.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Flansa logo clicked, redirecting to workspace...');
            
            // Multiple redirect approaches
            if (typeof frappe !== 'undefined' && frappe.set_route) {
                console.log('Using frappe.set_route');
                frappe.set_route('flansa-workspace');
            } else if (typeof frappe !== 'undefined' && frappe.router) {
                console.log('Using frappe.router');
                frappe.router.push_state('flansa-workspace');
            } else {
                console.log('Using window.location redirect');
                window.location.href = '/app/flansa-workspace';
            }
            
            return false;
        }, true); // Use capture phase
        
        // Also override any mousedown events
        element.addEventListener('mousedown', function(e) {
            if (e.button === 1) { // Middle click
                e.preventDefault();
                window.open('/app/flansa-workspace', '_blank');
            }
        });
        
        console.log('Logo redirect handlers attached to:', element);
    }
    
    function removeDuplicateFlansaElements() {
        // Remove duplicate Flansa workspace links
        const flansaLinks = document.querySelectorAll('.flansa-workspace-link');
        flansaLinks.forEach(link => {
            console.log('Removing duplicate Flansa link:', link);
            link.remove();
        });
        
        // Remove any duplicate Flansa text in navbar
        const navItems = document.querySelectorAll('.navbar-nav li');
        navItems.forEach(item => {
            const text = item.textContent || '';
            if (text.includes('Flansa') && !item.closest('.navbar-home')) {
                console.log('Hiding duplicate Flansa nav item:', item);
                item.style.display = 'none';
            }
        });
        
        // Remove duplicate logos (keep only the first one)
        const logos = document.querySelectorAll('.navbar img[src*="flansa"]');
        if (logos.length > 1) {
            console.log('Found', logos.length, 'Flansa logos, removing duplicates');
            for (let i = 1; i < logos.length; i++) {
                const parent = logos[i].closest('li') || logos[i].parentElement;
                if (parent) {
                    parent.style.display = 'none';
                }
            }
        }
    }
    
    function replaceStandaloneFrappeText() {
        // Find and replace standalone "Frappe" text in navbar
        const textSelectors = [
            '.navbar-brand',
            '.navbar-home a',
            '.navbar .navbar-nav li a',
            '.navbar-header a'
        ];
        
        textSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Only replace if it's standalone "Frappe" text (not part of a larger string)
                if (element.textContent && element.textContent.trim() === 'Frappe') {
                    console.log('🏷️ Replacing standalone Frappe text with Flansa');
                    element.textContent = 'Flansa';
                    
                    // Make it clickable to Flansa workspace if not already a link
                    if (element.tagName !== 'A') {
                        element.style.cursor = 'pointer';
                        element.onclick = function() {
                            window.location.href = '/app/flansa-workspace';
                        };
                    } else {
                        element.href = '/app/flansa-workspace';
                    }
                }
                
                // Also check for text nodes within elements
                const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                
                let textNode;
                while (textNode = walker.nextNode()) {
                    if (textNode.textContent && textNode.textContent.trim() === 'Frappe') {
                        console.log('🏷️ Replacing text node "Frappe" with "Flansa"');
                        textNode.textContent = 'Flansa';
                    }
                }
            });
        });
    }
    
    function initializeRedirect() {
        if (redirectSetup) return;
        
        // Try immediate setup
        if (setupFlansaLogoRedirect()) {
            return;
        }
        
        // Wait for navbar to be ready with multiple attempts
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds
        
        const checkInterval = setInterval(function() {
            attempts++;
            
            if (setupFlansaLogoRedirect() || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                if (attempts >= maxAttempts) {
                    console.log('Max attempts reached for logo redirect setup');
                }
            }
        }, 100);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRedirect);
    } else {
        initializeRedirect();
    }
    
    // Re-run when page changes (for SPA navigation)
    if (typeof $ !== 'undefined') {
        $(document).on('app-loaded', function() {
            console.log('App loaded, setting up logo redirect');
            redirectSetup = false;
            setTimeout(initializeRedirect, 100);
        });
        
        $(document).on('page-change', function() {
            console.log('Page changed, setting up logo redirect');
            redirectSetup = false;
            setTimeout(initializeRedirect, 100);
        });
    }
    
    // Also listen for frappe events
    if (typeof frappe !== 'undefined') {
        $(document).on('app-loaded', function() {
            console.log('Frappe app loaded, setting up logo redirect');
            redirectSetup = false;
            setTimeout(initializeRedirect, 200);
        });
    }
    
    // Fallback: check periodically for the first 30 seconds
    let periodicCheck = 0;
    const periodicInterval = setInterval(function() {
        periodicCheck++;
        
        if (!redirectSetup && periodicCheck < 300) { // 30 seconds
            initializeRedirect();
        } else {
            clearInterval(periodicInterval);
        }
    }, 100);
    
})();
