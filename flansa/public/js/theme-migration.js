
// Migration to ensure consistent theme localStorage keys
(function() {
    // Check if migration is needed - move from flansa_color_scheme to flansa_user_scheme
    const oldScheme = localStorage.getItem('flansa_color_scheme');
    const currentScheme = localStorage.getItem('flansa_user_scheme');
    
    if (oldScheme && !currentScheme) {
        // Migrate from old key to new key
        localStorage.setItem('flansa_user_scheme', oldScheme);
        localStorage.removeItem('flansa_color_scheme');
        console.log('Theme settings migrated to user scheme');
    }
    
    // Also check for the flansa-theme key used by old theme system
    const oldTheme = localStorage.getItem('flansa-theme');
    if (oldTheme) {
        localStorage.removeItem('flansa-theme');
        console.log('Removed old theme key');
    }
})();
