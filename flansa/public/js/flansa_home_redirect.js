// Auto-redirect to Flansa Workspace for appropriate users
function initFlansaRedirect() {
    // Check if we're on the desk page and should redirect
    if (window.location.pathname === '/app' || window.location.pathname === '/app/') {
        // Check if user has Flansa roles
        if (typeof frappe !== 'undefined' && frappe.call) {
            frappe.call({
                method: 'flansa.overrides.get_home_page',
                callback: function(r) {
                    if (r.message === 'flansa-workspace-builder') {
                        // Only redirect if not already on flansa workspace builder
                        if (!window.location.href.includes('flansa-workspace-builder')) {
                            if (frappe.set_route) {
                                frappe.set_route('flansa-workspace-builder');
                            }
                        }
                    }
                }
            });
        }
    }
}

// Wait for both jQuery and frappe to be available
if (typeof $ !== 'undefined') {
    $(document).ready(initFlansaRedirect);
} else {
    // Fallback if jQuery isn't loaded yet
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFlansaRedirect);
    } else {
        initFlansaRedirect();
    }
}

// DISABLED: Add Flansa Workspace link to navbar (handled by flansa-logo-redirect.js)
// function addFlansaNavigation() {
//     // Check if jQuery is available
//     if (typeof $ === 'undefined') {
//         setTimeout(addFlansaNavigation, 500);
//         return;
//     }
    
//     // Wait for navbar to load
//     setTimeout(function() {
//         try {
//             // Check if we need to add the Flansa workspace link
//             if ($('.navbar-home').length && !$('.flansa-link').length) {
//                 // Add Flansa Workspace link to navbar
//                 const flansaLink = `
//                     <li class="flansa-link">
//                         <a href="/app/flansa" class="text-primary" style="font-weight: 500;">
//                             <i class="fa fa-th-large"></i> Flansa
//                         </a>
//                     </li>
//                 `;
//                 
//                 $('.navbar-nav').prepend(flansaLink);
//             }
//             
//             // Add to sidebar if present
//             if ($('.desk-sidebar').length && !$('.flansa-sidebar-link').length) {
//                 const flansaSidebarLink = `
//                     <div class="flansa-sidebar-link">
//                         <a href="/app/flansa" class="btn btn-primary btn-sm mb-2" style="width: 100%;">
//                             <i class="fa fa-th-large"></i> Flansa Workspace
//                         </a>
//                     </div>
//                 `;
//                 
//                 $('.desk-sidebar .sidebar-menu').prepend(flansaSidebarLink);
//             }
//         } catch (e) {
//             console.log('Flansa navigation setup failed:', e);
//         }
//     }, 1000);
// }

// Initialize navigation when DOM is ready
if (typeof $ !== 'undefined') {
    // $(document).ready(addFlansaNavigation); // Disabled - handled by logo redirect
} else {
    if (document.readyState === 'loading') {
        // document.addEventListener('DOMContentLoaded', addFlansaNavigation); // Disabled
    } else {
        // addFlansaNavigation(); // Disabled
    }
}

// Override desk home behavior
function setupRouterOverride() {
    // Wait for frappe to be available
    setTimeout(function() {
        if (typeof frappe !== 'undefined' && frappe.router) {
            frappe.router.on('change', function() {
                // If user lands on desk without a specific route, redirect to flansa
                const route = frappe.get_route();
                
                if (route.length === 0 || (route.length === 1 && route[0] === '')) {
                    // Check user permissions
                    frappe.call({
                        method: 'flansa.overrides.get_home_page',
                        callback: function(r) {
                            if (r.message === 'flansa-workspace-builder') {
                                frappe.set_route('flansa-workspace-builder');
                            }
                        }
                    });
                }
            });
        }
    }, 500);
}

// Initialize router override when DOM is ready
if (typeof $ !== 'undefined') {
    $(document).ready(setupRouterOverride);
} else {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupRouterOverride);
    } else {
        setupRouterOverride();
    }
}
