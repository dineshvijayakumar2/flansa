// Railway Navbar Force Fix - Create navbar regardless of boot conditions
// Place this file in: flansa/public/js/railway-navbar-force.js
// Add to hooks.py app_include_js as first item

console.log('🚂 Railway Navbar Force Fix loading...');

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        forceCreateNavbar();
    }, 2000);
});

function forceCreateNavbar() {
    console.log('🔧 Force creating navbar for Railway...');
    console.log('Boot home_page:', frappe.boot?.home_page);
    
    // Method 1: Force Frappe toolbar creation (ignore setup-wizard)
    if (!frappe.frappe_toolbar && frappe.ui && frappe.ui.toolbar) {
        try {
            console.log('Creating Frappe toolbar (bypassing setup-wizard check)...');
            frappe.frappe_toolbar = new frappe.ui.toolbar.Toolbar();
            console.log('✅ Frappe toolbar created');
            return; // Success, exit
        } catch (e) {
            console.log('❌ Frappe toolbar creation failed:', e);
        }
    }
    
    // Method 2: Create basic navbar manually if Frappe method fails
    if (!document.querySelector('.navbar')) {
        console.log('Creating manual navbar...');
        createManualNavbar();
    }
}

function createManualNavbar() {
    // Find or create header
    let header = document.querySelector('header');
    if (!header) {
        header = document.createElement('header');
        document.body.insertBefore(header, document.body.firstChild);
    }
    
    // Create navbar HTML
    header.innerHTML = `
        <nav class="navbar navbar-expand navbar-light bg-white border-bottom sticky-top">
            <div class="container-fluid">
                <a class="navbar-brand d-flex align-items-center" href="/app">
                    <img src="/assets/flansa/images/flansa-logo.svg" height="32" class="me-2" 
                         onerror="this.src='/assets/frappe/images/frappe-logo.svg'">
                    <span class="fw-bold">Flansa</span>
                </a>
                <div class="navbar-nav ms-auto">
                    <a class="nav-link" href="/app" title="Home">
                        <svg width="16" height="16"><use href="#icon-home"></use></svg> Home
                    </a>
                    <div class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown" title="User">
                            <svg width="16" height="16"><use href="#icon-user"></use></svg> User
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="/app/user">My Profile</a></li>
                            <li><a class="dropdown-item" href="/app/flansa-workspace">Workspace</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="/api/method/logout">Logout</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </nav>
    `;
    
    // Add body padding for navbar
    document.body.style.paddingTop = '60px';
    console.log('✅ Manual navbar created');
}

// Also run when page changes
if (frappe && frappe.router) {
    frappe.router.on('change', function() {
        setTimeout(forceCreateNavbar, 1000);
    });
}