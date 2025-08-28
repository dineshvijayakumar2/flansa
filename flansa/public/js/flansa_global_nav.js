/**
 * Flansa Global Navigation Bar
 * Provides dark mode toggle and user menu across all pages
 */

window.FlansaGlobalNav = {
    /**
     * Initialize the global navigation
     */
    init() {
        this.createGlobalNavBar();
        this.setupThemeToggle();
        this.setupUserMenu();
        this.applyStoredTheme();
    },

    /**
     * Create the global navigation bar HTML
     */
    createGlobalNavBar() {
        const navBarHtml = `
            <div class="flansa-global-sidebar" id="flansa-global-sidebar">
                <!-- Brand Section -->
                <div class="sidebar-brand">
                    <div class="flansa-brand">
                        <img src="/assets/flansa/images/flansa-logo.svg" alt="Flansa" class="brand-logo" />
                        <span class="brand-text">Flansa</span>
                    </div>
                </div>
                
                <!-- Navigation Menu - Vertical Icons -->
                <nav class="sidebar-nav vertical-icons">
                    <div class="nav-icons-stack">
                        <a href="/app/flansa-workspace" class="nav-icon-item" data-route="workspace" title="Workspace">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                            </svg>
                        </a>
                        
                        <a href="/app/flansa-app-builder" class="nav-icon-item" data-route="app-builder" title="Apps">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                            </svg>
                        </a>
                        
                        <a href="/app/flansa-saved-reports" class="nav-icon-item" data-route="reports" title="Reports">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            </svg>
                        </a>
                    </div>
                </nav>
                
                <!-- Bottom Actions - User Menu Only -->
                <div class="sidebar-bottom">
                    <!-- User Menu -->
                    <div class="user-menu-dropdown">
                        <button class="sidebar-user-menu" id="user-menu-trigger">
                            <div class="user-avatar">
                                <span class="user-initials">${frappe.user.full_name().charAt(0).toUpperCase()}</span>
                            </div>
                            <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        
                        <div class="user-menu-panel" id="user-menu-panel">
                            <div class="menu-header">
                                <div class="user-info">
                                    <div class="user-avatar-large">
                                        <span class="user-initials">${frappe.user.full_name().charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div class="user-details">
                                        <div class="user-name">${frappe.user.full_name()}</div>
                                        <div class="user-email">${frappe.session.user}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="menu-divider"></div>
                            <a href="/app/user-profile" class="menu-item">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                                </svg>
                                Profile Settings
                            </a>
                            <button class="menu-item theme-toggle" id="theme-toggle">
                                <svg class="theme-icon sun-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
                                </svg>
                                <svg class="theme-icon moon-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: none;">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                                Toggle Dark Mode
                            </button>
                            <a href="/app/flansa-help" class="menu-item">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                                </svg>
                                Help & Support
                            </a>
                            <div class="menu-divider"></div>
                            <a href="/api/method/logout" class="menu-item danger">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
                                </svg>
                                Sign Out
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert at the beginning of body
        $('body').prepend(navBarHtml);
        
        // Mark active navigation item based on current route
        this.updateActiveNavigation();
    },

    /**
     * Setup theme toggle functionality
     */
    setupThemeToggle() {
        const themeToggle = $('#theme-toggle');
        const sunIcon = themeToggle.find('.sun-icon');
        const moonIcon = themeToggle.find('.moon-icon');
        
        themeToggle.on('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            this.setTheme(newTheme);
            this.updateThemeToggleIcons(newTheme, sunIcon, moonIcon);
            
            // Store preference
            localStorage.setItem('flansa-theme', newTheme);
            
            // Show theme change notification
            this.showThemeChangeNotification(newTheme);
        });
    },

    /**
     * Setup user menu dropdown
     */
    setupUserMenu() {
        const trigger = $('#user-menu-trigger');
        const panel = $('#user-menu-panel');
        
        // Toggle dropdown
        trigger.on('click', (e) => {
            e.stopPropagation();
            panel.toggleClass('show');
        });
        
        // Close on outside click
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.user-menu-dropdown').length) {
                panel.removeClass('show');
            }
        });
        
        // Close on escape key
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape') {
                panel.removeClass('show');
            }
        });
    },

    /**
     * Apply stored theme on page load
     */
    applyStoredTheme() {
        const storedTheme = localStorage.getItem('flansa-theme') || 'light';
        this.setTheme(storedTheme);
        
        const sunIcon = $('.sun-icon');
        const moonIcon = $('.moon-icon');
        this.updateThemeToggleIcons(storedTheme, sunIcon, moonIcon);
    },

    /**
     * Set the theme
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update CSS custom properties for theme
        if (theme === 'dark') {
            document.documentElement.style.setProperty('--bg-color', '#0f172a');
            document.documentElement.style.setProperty('--text-color', '#f1f5f9');
            document.documentElement.style.setProperty('--border-color', '#334155');
            document.documentElement.style.setProperty('--card-bg', '#1e293b');
            document.documentElement.style.setProperty('--nav-bg', '#020617');
        } else {
            document.documentElement.style.setProperty('--bg-color', '#ffffff');
            document.documentElement.style.setProperty('--text-color', '#0f172a');
            document.documentElement.style.setProperty('--border-color', '#e2e8f0');
            document.documentElement.style.setProperty('--card-bg', '#ffffff');
            document.documentElement.style.setProperty('--nav-bg', '#ffffff');
        }
    },

    /**
     * Update theme toggle icons
     */
    updateThemeToggleIcons(theme, sunIcon, moonIcon) {
        if (theme === 'dark') {
            sunIcon.hide();
            moonIcon.show();
        } else {
            sunIcon.show();
            moonIcon.hide();
        }
    },

    /**
     * Show theme change notification
     */
    showThemeChangeNotification(theme) {
        const message = theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled';
        
        // Use Frappe's notification if available
        if (typeof frappe !== 'undefined' && frappe.show_alert) {
            frappe.show_alert({
                message: message,
                indicator: 'blue'
            }, 2);
        } else {
            // Fallback notification
            this.showSimpleNotification(message);
        }
    },

    /**
     * Simple notification fallback
     */
    showSimpleNotification(message) {
        const notification = $(`
            <div class="flansa-notification">
                <div class="notification-content">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                    <span>${message}</span>
                </div>
            </div>
        `);
        
        $('body').append(notification);
        
        // Show with animation
        setTimeout(() => notification.addClass('show'), 10);
        
        // Hide after 2 seconds
        setTimeout(() => {
            notification.removeClass('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    },

    /**
     * Update active navigation state for vertical icons
     */
    updateActiveNavigation() {
        const currentPath = window.location.pathname;
        $('.nav-icon-item').removeClass('active');
        
        if (currentPath.includes('flansa-workspace')) {
            $('[data-route="workspace"]').addClass('active');
        } else if (currentPath.includes('flansa-app-builder') || currentPath.includes('flansa-table-builder')) {
            $('[data-route="app-builder"]').addClass('active');
        } else if (currentPath.includes('flansa-saved-reports') || currentPath.includes('flansa-report-viewer')) {
            $('[data-route="reports"]').addClass('active');
        }
    }
};

// CSS Styles for the global navigation
const globalNavStyles = `
<style>
/* Global Sidebar Navigation - Sleek Vertical */
.flansa-global-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 80px;
    z-index: 1000;
    background: var(--nav-bg, #f8fafc);
    border-right: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    flex-direction: column;
    transition: all 0.3s ease;
    box-shadow: 2px 0 8px rgba(0,0,0,0.1);
}

/* Adjust body for sleek sidebar */
body {
    padding-left: 80px !important;
    padding-top: 0 !important;
}

.layout-main {
    margin-top: 0 !important;
    margin-left: 0 !important;
}

/* Sleek Brand - Just Icon */
.sidebar-brand {
    padding: 1rem;
    display: flex;
    justify-content: center;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.flansa-brand {
    display: flex;
    align-items: center;
    justify-content: center;
}

.brand-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
}

.brand-text {
    display: none; /* Hide text in sleek mode */
}

/* Vertical Icon Navigation */
.sidebar-nav.vertical-icons {
    flex: 1;
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.nav-icons-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    align-items: center;
}

.nav-icon-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    color: var(--text-color, #6b7280);
    text-decoration: none;
    transition: all 0.2s ease;
    position: relative;
    background: transparent;
}

.nav-icon-item:hover {
    background: rgba(79, 70, 229, 0.1);
    color: #4f46e5;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
}

.nav-icon-item.active {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

/* Navigation sections */
.nav-left, .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
}

/* Theme Toggle */
.theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-color, #374151);
    cursor: pointer;
    transition: all 0.2s ease;
}

.theme-toggle:hover {
    background: rgba(107, 114, 128, 0.2);
    transform: translateY(-1px);
}

.theme-icon {
    transition: opacity 0.2s ease;
}

/* Bottom Section */
.sidebar-bottom {
    padding: 1rem;
    border-top: 1px solid var(--border-color, #e2e8f0);
    display: flex;
    justify-content: center;
}

/* User Menu - Sleek */
.user-menu-dropdown {
    position: relative;
}

.sidebar-user-menu {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: none;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 48px;
    height: 48px;
    position: relative;
}

.sidebar-user-menu:hover {
    background: rgba(79, 70, 229, 0.1);
    transform: translateY(-2px);
}

.user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
}

.user-avatar-large {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    margin-right: 0.75rem;
}

.sidebar-user-menu .dropdown-arrow {
    position: absolute;
    bottom: 2px;
    right: 2px;
    color: var(--text-color, #6b7280);
    transition: transform 0.2s ease;
    width: 8px;
    height: 8px;
}

.sidebar-user-menu.active .dropdown-arrow {
    transform: rotate(180deg);
}

/* User Menu Panel - Bottom Positioned */
.user-menu-panel {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    left: calc(100% + 0.5rem);
    min-width: 280px;
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 12px;
    box-shadow: 0 8px 25px -8px rgba(0, 0, 0, 0.15), 0 4px 16px -4px rgba(0, 0, 0, 0.1);
    opacity: 0;
    visibility: hidden;
    transform: translateY(10px) translateX(-10px);
    transition: all 0.3s ease;
    z-index: 1001;
}

.menu-header {
    padding: 0;
}

.user-info {
    padding: 1.25rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.user-info {
    display: flex;
    align-items: center;
}

.user-details {
    flex: 1;
}

.user-menu-panel.show {
    opacity: 1;
    visibility: visible;
    transform: translateY(0) translateX(0);
}

.user-info {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.user-name {
    font-weight: 600;
    color: var(--text-color, #111827);
    font-size: 0.875rem;
}

.user-email {
    color: #6b7280;
    font-size: 0.75rem;
    margin-top: 0.25rem;
}

.menu-divider {
    height: 1px;
    background: var(--border-color, #e5e7eb);
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--text-color, #374151);
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.2s ease;
}

.menu-item:hover {
    background: rgba(107, 114, 128, 0.1);
    color: var(--text-color, #111827);
}

.menu-item.danger {
    color: #ef4444;
}

.menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
}

/* Dark mode adjustments */
[data-theme="dark"] .flansa-global-nav {
    background: var(--nav-bg, #020617);
    border-bottom-color: var(--border-color, #334155);
}

[data-theme="dark"] .theme-toggle {
    background: rgba(148, 163, 184, 0.1);
    color: #e2e8f0;
}

[data-theme="dark"] .theme-toggle:hover {
    background: rgba(148, 163, 184, 0.2);
}

[data-theme="dark"] .user-menu-trigger:hover {
    background: rgba(148, 163, 184, 0.1);
}

/* Content spacing adjustment */
body {
    padding-top: 60px !important;
}

.layout-main {
    margin-top: 0 !important;
    padding-top: 0 !important;
}

/* Notification styles */
.flansa-notification {
    position: fixed;
    top: 80px;
    right: 1rem;
    z-index: 1001;
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
}

.flansa-notification.show {
    opacity: 1;
    transform: translateX(0);
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-color, #374151);
    font-size: 0.875rem;
}

.notification-content svg {
    color: #10b981;
    flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 640px) {
    .global-nav-container {
        padding: 0 1rem;
    }
    
    .brand-text {
        display: none;
    }
    
    .user-menu-panel {
        min-width: 200px;
        right: -1rem;
    }
}
</style>
`;

// Add styles to head
$('head').append(globalNavStyles);

// Initialize when document is ready
$(document).ready(() => {
    // Only initialize on Flansa pages
    if (window.location.pathname.includes('/app/flansa') || 
        window.location.pathname.includes('flansa-')) {
        window.FlansaGlobalNav.init();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.FlansaGlobalNav;
}