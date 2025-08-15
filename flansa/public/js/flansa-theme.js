/**
 * Flansa Theme Utilities
 * =====================
 * 
 * JavaScript utilities for managing Flansa platform theming.
 * Provides functions for theme switching, color manipulation, and theme persistence.
 */

class FlansaTheme {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'light';
        this.themes = ['light', 'dark', 'auto'];
        this.init();
    }
    
    init() {
        this.applyTheme(this.currentTheme);
        this.watchSystemTheme();
    }
    
    /**
     * Apply a theme to the document
     * @param {string} theme - Theme name ('light', 'dark', 'auto')
     */
    applyTheme(theme) {
        const root = document.documentElement;
        
        // Remove existing theme classes
        root.classList.remove('flansa-theme-light', 'flansa-theme-dark');
        
        if (theme === 'auto') {
            // Use system preference
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(`flansa-theme-${systemTheme}`);
        } else {
            root.classList.add(`flansa-theme-${theme}`);
        }
        
        this.currentTheme = theme;
        this.storeTheme(theme);
        
        // Emit theme change event
        this.emit('themeChanged', { theme, resolvedTheme: this.getResolvedTheme() });
    }
    
    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }
    
    /**
     * Get the currently resolved theme (not 'auto')
     */
    getResolvedTheme() {
        if (this.currentTheme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }
    
    /**
     * Get CSS variable value
     * @param {string} varName - CSS variable name (with or without --)
     */
    getCSSVar(varName) {
        const cleanName = varName.startsWith('--') ? varName : `--${varName}`;
        return getComputedStyle(document.documentElement).getPropertyValue(cleanName).trim();
    }
    
    /**
     * Set CSS variable value
     * @param {string} varName - CSS variable name (with or without --)
     * @param {string} value - CSS value
     */
    setCSSVar(varName, value) {
        const cleanName = varName.startsWith('--') ? varName : `--${varName}`;
        document.documentElement.style.setProperty(cleanName, value);
    }
    
    /**
     * Get Flansa theme color
     * @param {string} colorName - Color name (e.g., 'primary', 'secondary')
     */
    getColor(colorName) {
        return this.getCSSVar(`--flansa-${colorName}`);
    }
    
    /**
     * Set Flansa theme color
     * @param {string} colorName - Color name (e.g., 'primary', 'secondary')  
     * @param {string} value - Color value
     */
    setColor(colorName, value) {
        this.setCSSVar(`--flansa-${colorName}`, value);
    }
    
    /**
     * Store theme preference
     */
    storeTheme(theme) {
        try {
            localStorage.setItem('flansa-theme', theme);
        } catch (e) {
            // Handle localStorage errors gracefully
        }
    }
    
    /**
     * Get stored theme preference
     */
    getStoredTheme() {
        try {
            return localStorage.getItem('flansa-theme');
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Watch for system theme changes when using 'auto' mode
     */
    watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.applyTheme('auto'); // Re-apply to update resolved theme
            }
        });
    }
    
    /**
     * Simple event emitter
     */
    emit(eventName, data) {
        const event = new CustomEvent(`flansa:${eventName}`, { detail: data });
        document.dispatchEvent(event);
    }
    
    /**
     * Listen to theme events
     * @param {string} eventName - Event name
     * @param {Function} callback - Callback function
     */
    on(eventName, callback) {
        document.addEventListener(`flansa:${eventName}`, callback);
    }
    
    /**
     * Create theme selector UI component
     * @param {HTMLElement} container - Container element
     */
    createThemeSelector(container) {
        const selector = document.createElement('div');
        selector.className = 'flansa-theme-selector';
        selector.innerHTML = `
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" data-theme="light">
                    <i class="fa fa-sun"></i> Light
                </button>
                <button class="btn btn-outline-secondary" data-theme="dark">
                    <i class="fa fa-moon"></i> Dark
                </button>
                <button class="btn btn-outline-secondary" data-theme="auto">
                    <i class="fa fa-adjust"></i> Auto
                </button>
            </div>
        `;
        
        // Add event listeners
        selector.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyTheme(theme);
                this.updateSelectorUI(selector);
            });
        });
        
        container.appendChild(selector);
        this.updateSelectorUI(selector);
        
        return selector;
    }
    
    /**
     * Update theme selector UI
     */
    updateSelectorUI(selector) {
        selector.querySelectorAll('[data-theme]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.currentTheme);
        });
    }
    
    /**
     * Generate color variations (lighter/darker versions)
     * @param {string} color - Base color in hex format
     * @param {number} percentage - Percentage to lighten (positive) or darken (negative)
     */
    adjustColor(color, percentage) {
        // Convert hex to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Adjust brightness
        const adjust = (c) => {
            const adjusted = Math.round(c + (c * percentage / 100));
            return Math.max(0, Math.min(255, adjusted));
        };
        
        const newR = adjust(r);
        const newG = adjust(g);
        const newB = adjust(b);
        
        // Convert back to hex
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
    }
}

// Initialize theme manager
window.flansaTheme = new FlansaTheme();

// Frappe integration
if (typeof frappe !== 'undefined') {
    frappe.provide('frappe.ui');
    frappe.ui.ThemeManager = window.flansaTheme;
    
    // Add theme toggle to navbar if in Frappe context
    $(document).ready(() => {
        const navbar = $('.navbar-right');
        if (navbar.length) {
            const themeToggle = $(`
                <li class="dropdown">
                    <a href="#" class="dropdown-toggle" data-toggle="dropdown" title="Theme">
                        <i class="fa fa-adjust"></i>
                    </a>
                    <ul class="dropdown-menu" id="flansa-theme-menu">
                        <li><a href="#" data-theme="light"><i class="fa fa-sun"></i> Light Theme</a></li>
                        <li><a href="#" data-theme="dark"><i class="fa fa-moon"></i> Dark Theme</a></li>
                        <li><a href="#" data-theme="auto"><i class="fa fa-adjust"></i> Auto Theme</a></li>
                    </ul>
                </li>
            `);
            
            themeToggle.find('[data-theme]').on('click', function(e) {
                e.preventDefault();
                const theme = $(this).data('theme');
                window.flansaTheme.applyTheme(theme);
            });
            
            navbar.prepend(themeToggle);
        }
    });
}
