/**
 * Flansa Simple Logo Configuration 
 * Minimal logo management - preserves hooks.py functionality
 */

// Simple Logo Configuration - text-based only, no file loading
window.FlansaLogoConfig = {
    LOGO_ALT: 'Flansa',
    LOGO_TITLE: 'Flansa - Workspace',
    WORKSPACE_URL: '/app/flansa-workspace'
};

// Make it globally available for compatibility
window.FLANSA_LOGO = window.FlansaLogoConfig;

console.log('📝 Flansa simple configuration loaded - hooks.py logo functionality preserved');