
// Logo Redirect Fallback - runs after page is fully loaded
$(window).on('load', function() {
    setTimeout(function() {
        console.log('Running logo redirect fallback...');
        
        // Find any remaining /app links and fix them
        const appLinks = document.querySelectorAll('a[href="/app"], a[href="/app/"]');
        appLinks.forEach(function(link) {
            if (link.closest('.navbar')) {
                console.log('Fallback: fixing navbar app link', link);
                link.href = '/app/flansa';
                
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (frappe && frappe.set_route) {
                        frappe.set_route('flansa');
                    } else {
                        window.location.href = '/app/flansa';
                    }
                });
            }
        });
        
        // Also check for navbar-brand
        const navbarBrand = document.querySelector('.navbar-brand');
        if (navbarBrand && navbarBrand.href && navbarBrand.href.includes('/app')) {
            console.log('Fallback: fixing navbar-brand', navbarBrand);
            navbarBrand.href = '/app/flansa';
            
            navbarBrand.addEventListener('click', function(e) {
                e.preventDefault();
                if (frappe && frappe.set_route) {
                    frappe.set_route('flansa');
                } else {
                    window.location.href = '/app/flansa';
                }
            });
        }
    }, 1000);
});
