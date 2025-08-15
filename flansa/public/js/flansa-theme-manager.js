/**
 * Flansa Theme Manager - Shared theme functionality across all pages
 * Provides consistent theme handling and settings access throughout the platform
 */

class FlansaThemeManager {
    constructor() {
        this.schemes = {
            'Default Blue': ['#667eea', '#764ba2'],
            'Ocean Green': ['#2196F3', '#21CBF3'],
            'Sunset Orange': ['#f093fb', '#f5576c'],
            'Royal Purple': ['#4facfe', '#00f2fe'],
            'Cherry Red': ['#fa709a', '#fee140'],
            'Forest Green': ['#a8edea', '#fed6e3'],
            'Midnight Dark': ['#2c3e50', '#3498db']
        };
        
        // Load platform default theme settings
        this.loadPlatformDefaults();
    }
    
    async loadPlatformDefaults() {
        // Skip if frappe is not ready yet
        if (!frappe || !frappe.call) {
            this.platformDefaults = {
                scheme: 'Default Blue',
                primary: null,
                secondary: null
            };
            return;
        }
        
        try {
            // For now, just use defaults - System Settings integration can be added later
            // when proper fields are added to System Settings doctype
            this.platformDefaults = {
                scheme: 'Default Blue',
                primary: null,
                secondary: null
            };
            
            // Uncomment below when System Settings has the required fields
            // const result = await frappe.call({
            //     method: 'frappe.client.get',
            //     args: {
            //         doctype: 'System Settings',
            //         name: 'System Settings'
            //     }
            // });
            // 
            // if (result.message) {
            //     this.platformDefaults = {
            //         scheme: result.message.flansa_default_theme || 'Default Blue',
            //         primary: result.message.flansa_default_primary,
            //         secondary: result.message.flansa_default_secondary
            //     };
            // }
        } catch (error) {
            // Silently fall back to defaults
            this.platformDefaults = {
                scheme: 'Default Blue',
                primary: null,
                secondary: null
            };
        }
    }

    // Apply saved theme on page load
    applySavedTheme() {
        const userScheme = localStorage.getItem('flansa_user_scheme');
        
        if (userScheme) {
            // Apply personal preference
            const customPrimary = localStorage.getItem('flansa_custom_primary');
            const customSecondary = localStorage.getItem('flansa_custom_secondary');
            this.applyColorScheme(userScheme, customPrimary, customSecondary);
        } else if (this.platformDefaults) {
            // Apply platform default if no personal preference
            this.applyColorScheme(this.platformDefaults.scheme, this.platformDefaults.primary, this.platformDefaults.secondary);
        }
    }

    // Apply color scheme with proper text colors
    applyColorScheme(scheme, customPrimary, customSecondary) {
        let colors;
        if (scheme === 'Custom') {
            colors = [customPrimary, customSecondary];
        } else {
            colors = this.schemes[scheme];
        }
        
        if (colors) {
            const [primary, secondary] = colors;
            const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
            
            // Apply CSS custom properties
            document.documentElement.style.setProperty('--flansa-primary', primary);
            document.documentElement.style.setProperty('--flansa-secondary', secondary);
            document.documentElement.style.setProperty('--flansa-gradient-primary', gradient);
            
            // Apply theme colors to breadcrumbs
            const breadcrumbBars = document.querySelectorAll('.flansa-breadcrumb-bar');
            breadcrumbBars.forEach(bar => {
                if (bar) {
                    // Use theme-aware text color
                    if (scheme === 'Midnight Dark') {
                        bar.style.color = 'var(--flansa-text-primary, #ffffff)';
                    } else {
                        bar.style.color = primary || '#667eea';
                    }
                    
                    // Update links within breadcrumbs
                    const links = bar.querySelectorAll('a');
                    links.forEach(link => {
                        if (scheme === 'Midnight Dark') {
                            link.style.color = 'var(--flansa-text-primary, #ffffff)';
                        } else {
                            link.style.color = primary || '#667eea';
                        }
                    });
                }
            });
            
            // Set appropriate text colors based on theme darkness
            if (scheme === 'Midnight Dark') {
                document.documentElement.style.setProperty('--flansa-text-primary', '#ffffff');
                document.documentElement.style.setProperty('--flansa-text-secondary', 'rgba(255, 255, 255, 0.8)');
                document.documentElement.style.setProperty('--flansa-surface', '#1a202c');
                document.documentElement.style.setProperty('--flansa-background', '#0f141a');
                document.body.classList.add('flansa-theme-dark');
            } else {
                // Light themes
                document.documentElement.style.setProperty('--flansa-text-primary', '#2d3748');
                document.documentElement.style.setProperty('--flansa-text-secondary', '#718096');
                document.documentElement.style.setProperty('--flansa-surface', '#ffffff');
                document.documentElement.style.setProperty('--flansa-background', '#f7fafc');
                document.body.classList.remove('flansa-theme-dark');
            }
        }
    }

    // Show theme settings dialog
    showThemeSettings(refreshCallback = null) {
        const self = this;
        
        const dialog = new frappe.ui.Dialog({
            title: '🎨 Theme Customization',
            size: 'large',
            fields: [
                {
                    fieldtype: 'Section Break',
                    label: '🌈 Personal Theme Preferences'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'theme_info',
                    options: `
                        <div class="alert alert-info">
                            <strong>Personal Theme:</strong> Set your personal theme preference. If no personal theme is set, the platform default will be used.
                        </div>
                    `
                },
                {
                    label: 'Use Personal Theme',
                    fieldname: 'use_personal_theme',
                    fieldtype: 'Check',
                    default: localStorage.getItem('flansa_user_scheme') ? 1 : 0,
                    description: 'Enable to override platform default with your personal preference',
                    change: function() {
                        const fields = dialog.fields_dict;
                        const usePersonal = this.get_value();
                        
                        fields.primary_scheme.df.hidden = !usePersonal;
                        fields.theme_preview.df.hidden = !usePersonal;
                        fields.custom_primary.df.hidden = !usePersonal;
                        fields.custom_secondary.df.hidden = !usePersonal;
                        
                        dialog.refresh();
                        
                        if (!usePersonal) {
                            // Show platform default preview
                            const platformScheme = self.platformDefaults?.scheme || 'Default Blue';
                            dialog.fields_dict.platform_preview.$wrapper.html(self.generatePreviewHtml(platformScheme, 'Platform Default'));
                        }
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Platform Default Preview',
                    fieldname: 'platform_preview',
                    fieldtype: 'HTML',
                    options: '<div id="platform-preview-area">Loading platform default...</div>'
                },
                {
                    fieldtype: 'Section Break',
                    label: '🎨 Personal Theme Selection',
                    depends_on: 'eval:doc.use_personal_theme == 1'
                },
                {
                    label: 'Primary Color Scheme',
                    fieldname: 'primary_scheme',
                    fieldtype: 'Select',
                    options: [
                        'Default Blue',
                        'Ocean Green',
                        'Sunset Orange',
                        'Royal Purple',
                        'Cherry Red',
                        'Forest Green',
                        'Midnight Dark',
                        'Custom'
                    ].join('\n'),
                    default: 'Default Blue',
                    depends_on: 'eval:doc.use_personal_theme == 1',
                    change: function() {
                        self.previewColorScheme(this.get_value(), dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Theme Preview',
                    fieldname: 'theme_preview',
                    fieldtype: 'HTML',
                    depends_on: 'eval:doc.use_personal_theme == 1',
                    options: '<div id="theme-preview-area">Select a color scheme to preview</div>'
                },
                {
                    fieldtype: 'Section Break',
                    label: '🎨 Custom Colors',
                    depends_on: 'eval:doc.use_personal_theme == 1 && doc.primary_scheme == "Custom"'
                },
                {
                    label: 'Primary Color',
                    fieldname: 'custom_primary',
                    fieldtype: 'Color',
                    depends_on: 'eval:doc.use_personal_theme == 1 && doc.primary_scheme == "Custom"',
                    change: function() {
                        self.previewCustomColors(dialog);
                    }
                },
                {
                    fieldtype: 'Column Break'
                },
                {
                    label: 'Secondary Color',
                    fieldname: 'custom_secondary',
                    fieldtype: 'Color',
                    depends_on: 'eval:doc.use_personal_theme == 1 && doc.primary_scheme == "Custom"',
                    change: function() {
                        self.previewCustomColors(dialog);
                    }
                },
                {
                    fieldtype: 'Section Break',
                    label: '⚡ Actions'
                },
                {
                    fieldtype: 'HTML',
                    fieldname: 'theme_actions',
                    options: `
                        <div class="theme-actions" style="text-align: center; padding: 20px;">
                            <button class="btn btn-secondary" id="reset-theme-btn">🔄 Reset to Default</button>
                            <button class="btn btn-warning" id="export-theme-btn" style="margin-left: 10px;">📤 Export Theme</button>
                            <button class="btn btn-info" id="import-theme-btn" style="margin-left: 10px;">📥 Import Theme</button>
                        </div>
                        <div class="cache-actions" style="text-align: center; padding: 10px; border-top: 1px solid #e0e6ed; margin-top: 15px;">
                            <small class="text-muted">Cache Issues?</small><br>
                            <button class="btn btn-xs btn-default" id="soft-refresh-btn" style="margin: 5px;">🔄 Refresh Theme</button>
                            <button class="btn btn-xs btn-warning" id="force-refresh-btn" style="margin: 5px;">⚡ Force Refresh Page</button>
                        </div>
                    `
                }
            ],
            primary_action_label: '✅ Apply Theme',
            primary_action: (values) => {
                self.applyThemeSettings(values, refreshCallback);
                dialog.hide();
            }
        });
        
        // Bind theme action buttons
        dialog.$wrapper.find('#reset-theme-btn').on('click', () => {
            self.resetTheme();
            frappe.show_alert('Theme reset to default', 'blue');
            dialog.set_value('primary_scheme', 'Default Blue');
            // Don't call refreshCallback here - let user apply the changes
        });
        
        dialog.$wrapper.find('#export-theme-btn').on('click', () => {
            self.exportTheme();
        });
        
        dialog.$wrapper.find('#import-theme-btn').on('click', () => {
            self.importTheme(refreshCallback);
        });
        
        // Bind cache action buttons
        dialog.$wrapper.find('#soft-refresh-btn').on('click', () => {
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.refreshAllAssets();
                dialog.hide();
                frappe.show_alert('Theme refreshed!', 'green');
            } else {
                frappe.show_alert('Cache manager not available', 'orange');
            }
        });
        
        dialog.$wrapper.find('#force-refresh-btn').on('click', () => {
            dialog.hide();
            if (window.flansaBrowserCacheManager) {
                window.flansaBrowserCacheManager.forceReloadWithNuclearOption();
            } else {
                window.location.reload(true);
            }
        });
        
        dialog.show();
        
        // Set current theme values
        const hasPersonalTheme = localStorage.getItem('flansa_user_scheme') ? true : false;
        dialog.set_value('use_personal_theme', hasPersonalTheme ? 1 : 0);
        
        if (hasPersonalTheme) {
            const currentScheme = localStorage.getItem('flansa_user_scheme') || 'Default Blue';
            dialog.set_value('primary_scheme', currentScheme);
        }
        
        // Show platform default preview
        setTimeout(() => {
            const platformScheme = this.platformDefaults?.scheme || 'Default Blue';
            dialog.fields_dict.platform_preview.$wrapper.html(this.generatePreviewHtml(platformScheme, 'Platform Default'));
        }, 100);
    }

    previewColorScheme(scheme, dialog) {
        if (this.schemes[scheme]) {
            const colors = this.schemes[scheme];
            const [primary, secondary] = colors;
            const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
            
            const preview = `
                <div class="theme-preview" style="padding: 20px; background: ${gradient}; border-radius: 12px; color: white; text-align: center; margin: 10px 0;">
                    <h4 style="margin: 0; color: white;">🎨 ${scheme}</h4>
                    <p style="margin: 10px 0; opacity: 0.9;">Preview of your selected theme</p>
                    <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                        <div style="width: 30px; height: 30px; background: ${primary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                        <div style="width: 30px; height: 30px; background: ${secondary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                    </div>
                </div>
            `;
            dialog.fields_dict.theme_preview.$wrapper.html(preview);
        }
    }

    previewCustomColors(dialog) {
        const primary = dialog.get_value('custom_primary');
        const secondary = dialog.get_value('custom_secondary');
        
        if (primary && secondary) {
            const preview = this.generatePreviewHtml('Custom', 'Custom Theme', primary, secondary);
            dialog.fields_dict.theme_preview.$wrapper.html(preview);
        }
    }
    
    generatePreviewHtml(scheme, title, customPrimary = null, customSecondary = null) {
        let colors;
        if (customPrimary && customSecondary) {
            colors = [customPrimary, customSecondary];
        } else {
            colors = this.schemes[scheme] || this.schemes['Default Blue'];
        }
        
        const [primary, secondary] = colors;
        const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
        
        return `
            <div class="theme-preview" style="padding: 20px; background: ${gradient}; border-radius: 12px; color: white; text-align: center; margin: 10px 0;">
                <h4 style="margin: 0; color: white;">🎨 ${title}</h4>
                <p style="margin: 10px 0; opacity: 0.9;">Preview of ${scheme === 'Custom' ? 'your custom colors' : scheme.toLowerCase()}</p>
                <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                    <div style="width: 30px; height: 30px; background: ${primary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                    <div style="width: 30px; height: 30px; background: ${secondary}; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3);"></div>
                </div>
            </div>
        `;
    }

    applyThemeSettings(values, refreshCallback) {
        if (values.use_personal_theme) {
            // Store personal theme preference
            localStorage.setItem('flansa_user_scheme', values.primary_scheme);
            
            if (values.primary_scheme === 'Custom') {
                localStorage.setItem('flansa_custom_primary', values.custom_primary);
                localStorage.setItem('flansa_custom_secondary', values.custom_secondary);
            }
            
            // Apply the theme
            this.applyColorScheme(values.primary_scheme, values.custom_primary, values.custom_secondary);
            frappe.show_alert(`Personal theme "${values.primary_scheme}" applied successfully! 🎨`, 'green');
        } else {
            // Remove personal preferences to use platform default
            localStorage.removeItem('flansa_user_scheme');
            localStorage.removeItem('flansa_custom_primary');
            localStorage.removeItem('flansa_custom_secondary');
            
            // Apply platform default
            const platformScheme = this.platformDefaults?.scheme || 'Default Blue';
            this.applyColorScheme(platformScheme, this.platformDefaults?.primary, this.platformDefaults?.secondary);
            frappe.show_alert('Using platform default theme! 🏢', 'blue');
        }
        
        // Enhanced refresh with cache busting
        if (window.flansaBrowserCacheManager) {
            window.flansaBrowserCacheManager.refreshAllAssets();
        }
        
        if (refreshCallback) {
            setTimeout(refreshCallback, 200);
        }
    }

    resetTheme() {
        localStorage.removeItem('flansa_user_scheme');
        localStorage.removeItem('flansa_custom_primary');
        localStorage.removeItem('flansa_custom_secondary');
        
        // Reset to default colors
        document.documentElement.style.removeProperty('--flansa-primary');
        document.documentElement.style.removeProperty('--flansa-secondary');
        document.documentElement.style.removeProperty('--flansa-gradient-primary');
        document.documentElement.style.removeProperty('--flansa-text-primary');
        document.documentElement.style.removeProperty('--flansa-text-secondary');
        document.documentElement.style.removeProperty('--flansa-surface');
        document.documentElement.style.removeProperty('--flansa-background');
        document.body.classList.remove('flansa-theme-dark');
    }


    // Alias for backward compatibility
    showThemeDialog(refreshCallback = null) {
        return this.showThemeSettings(refreshCallback);
    }
    
        exportTheme() {
        const themeData = {
            scheme: localStorage.getItem('flansa_user_scheme') || 'Default Blue',
            custom_primary: localStorage.getItem('flansa_custom_primary'),
            custom_secondary: localStorage.getItem('flansa_custom_secondary'),
            exported_at: new Date().toISOString(),
            platform: 'Flansa Platform'
        };
        
        const blob = new Blob([JSON.stringify(themeData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flansa-theme-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        frappe.show_alert('Theme exported successfully! 📤', 'blue');
    }

    importTheme(refreshCallback) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const themeData = JSON.parse(e.target.result);
                        
                        // Apply imported theme
                        localStorage.setItem('flansa_user_scheme', themeData.scheme);
                        if (themeData.custom_primary) {
                            localStorage.setItem('flansa_custom_primary', themeData.custom_primary);
                        }
                        if (themeData.custom_secondary) {
                            localStorage.setItem('flansa_custom_secondary', themeData.custom_secondary);
                        }
                        
                        this.applyColorScheme(themeData.scheme, themeData.custom_primary, themeData.custom_secondary);
                        frappe.show_alert('Theme imported and applied successfully! 📥', 'green');
                        
                        if (refreshCallback) {
                            setTimeout(refreshCallback, 200);
                        }
                        
                    } catch (error) {
                        frappe.show_alert('Invalid theme file format! ❌', 'red');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    // Add theme settings menu item to any page
    addThemeMenuToPage(page, refreshCallback = null) {
        page.add_menu_item('🎨 Theme Settings', () => {
            this.showThemeSettings(refreshCallback);
        });
    }
}

// Create global theme manager instance
window.FlansaThemeManager = window.FlansaThemeManager || new FlansaThemeManager();

// Auto-apply saved theme on page load
$(document).ready(function() {
    if (window.FlansaThemeManager) {
        window.FlansaThemeManager.applySavedTheme();
    }
});