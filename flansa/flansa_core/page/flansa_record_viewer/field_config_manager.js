/**
 * Flansa Field Configuration Manager
 * Manages field visibility, formatting, and behavior across different views
 */

class FlansaFieldConfigManager {
    constructor() {
        this.default_config = {
            // Default field configuration for different views
            list: {
                max_fields: 4,
                default_width: '150px',
                show_actions: true,
                compact: true
            },
            table: {
                max_fields: 8,
                default_width: '120px', 
                show_actions: true,
                sortable: true,
                filterable: true
            },
            card: {
                max_fields: 6,
                show_image: true,
                show_status: true,
                compact_actions: true
            }
        };
        
        this.system_fields = [
            'name', 'creation', 'modified', 'modified_by', 
            'owner', 'docstatus', 'idx', '_user_tags', '_comments'
        ];
    }
    
    /**
     * Process field definitions and apply view-specific configurations
     */
    processFields(rawFields, viewType, userPreferences = {}) {
        console.log('🔧 Processing fields for view:', viewType);
        
        // Filter out system fields unless explicitly requested
        const businessFields = rawFields.filter(field => 
            !this.system_fields.includes(field.fieldname)
        );
        
        // Apply view-specific logic
        const processedFields = businessFields.map(field => 
            this.enhanceFieldForView(field, viewType, userPreferences)
        ).filter(field => field.visible);
        
        // Sort by priority and limit count
        const sortedFields = this.sortFieldsByPriority(processedFields, viewType);
        const limitedFields = this.limitFieldsForView(sortedFields, viewType);
        
        console.log(`📊 Processed ${rawFields.length} → ${limitedFields.length} fields for ${viewType} view`);
        return limitedFields;
    }
    
    /**
     * Enhance individual field with view-specific properties
     */
    enhanceFieldForView(field, viewType, userPreferences) {
        const enhanced = {
            ...field,
            visible: true,
            width: this.getFieldWidth(field, viewType),
            priority: this.getFieldPriority(field, viewType),
            sortable: this.isFieldSortable(field, viewType),
            filterable: this.isFieldFilterable(field, viewType),
            format_options: this.getFormatOptions(field, viewType)
        };
        
        // Apply user preferences if available
        if (userPreferences[field.fieldname]) {
            Object.assign(enhanced, userPreferences[field.fieldname]);
        }
        
        // View-specific visibility rules
        enhanced.visible = this.shouldShowField(enhanced, viewType);
        
        return enhanced;
    }
    
    /**
     * Determine if field should be shown in specific view
     */
    shouldShowField(field, viewType) {
        // Hide password fields in all views
        if (field.fieldtype === 'Password') return false;
        
        // Hide large text fields in table view
        if (viewType === 'table' && ['Text Editor', 'Long Text'].includes(field.fieldtype)) {
            return false;
        }
        
        // Show images only in card view
        if (field.fieldtype === 'Attach Image' && viewType !== 'card') {
            return false;
        }
        
        // Priority-based visibility for different views
        if (viewType === 'list' && field.priority > 3) return false;
        if (viewType === 'table' && field.priority > 5) return false;
        
        return true;
    }
    
    /**
     * Get field priority for sorting (lower = higher priority)
     */
    getFieldPriority(field, viewType) {
        // Name/title fields get highest priority
        if (['name', 'title', 'subject'].includes(field.fieldname.toLowerCase())) {
            return 1;
        }
        
        // Required fields get higher priority
        if (field.reqd) return 2;
        
        // Common business fields
        const businessFields = ['status', 'date', 'amount', 'customer', 'supplier'];
        if (businessFields.some(bf => field.fieldname.toLowerCase().includes(bf))) {
            return 3;
        }
        
        // Default priority based on field type
        const typepriorities = {
            'Link': 4,
            'Select': 4,
            'Data': 5,
            'Int': 5,
            'Float': 5,
            'Currency': 4,
            'Date': 4,
            'Datetime': 4,
            'Check': 6
        };
        
        return typeProperties[field.fieldtype] || 7;
    }
    
    /**
     * Get appropriate width for field in view
     */
    getFieldWidth(field, viewType) {
        const viewConfig = this.default_config[viewType];
        
        // Field type based widths
        const typeWidths = {
            'Check': '80px',
            'Int': '100px', 
            'Float': '120px',
            'Currency': '130px',
            'Date': '120px',
            'Datetime': '160px',
            'Link': '150px',
            'Select': '130px',
            'Data': viewType === 'table' ? '200px' : '150px',
            'Text': '250px'
        };
        
        return typeWidths[field.fieldtype] || viewConfig.default_width;
    }
    
    /**
     * Sort fields by priority and return limited set
     */
    sortFieldsByPriority(fields, viewType) {
        return fields.sort((a, b) => a.priority - b.priority);
    }
    
    /**
     * Limit number of fields based on view type
     */
    limitFieldsForView(fields, viewType) {
        const maxFields = this.default_config[viewType].max_fields;
        return fields.slice(0, maxFields);
    }
    
    /**
     * Check if field should be sortable in view
     */
    isFieldSortable(field, viewType) {
        if (viewType !== 'table') return false;
        
        const sortableTypes = [
            'Data', 'Int', 'Float', 'Currency', 'Date', 
            'Datetime', 'Link', 'Select'
        ];
        
        return sortableTypes.includes(field.fieldtype);
    }
    
    /**
     * Check if field should be filterable
     */
    isFieldFilterable(field, viewType) {
        if (!['table', 'list'].includes(viewType)) return false;
        
        const filterableTypes = [
            'Data', 'Link', 'Select', 'Int', 'Float', 
            'Currency', 'Date', 'Datetime', 'Check'
        ];
        
        return filterableTypes.includes(field.fieldtype);
    }
    
    /**
     * Get formatting options for field
     */
    getFormatOptions(field, viewType) {
        const options = {
            truncate: viewType === 'table' ? 50 : 100,
            show_currency_symbol: true,
            date_format: 'dd/mm/yyyy'
        };
        
        // Field-specific formatting
        switch (field.fieldtype) {
            case 'Currency':
                options.precision = field.precision || 2;
                break;
            case 'Float':
                options.precision = field.precision || 2;
                break;
            case 'Data':
                options.truncate = viewType === 'table' ? 30 : 50;
                break;
            case 'Text':
                options.truncate = viewType === 'table' ? 50 : 150;
                break;
        }
        
        return options;
    }
    
    /**
     * Generate field configuration UI for user customization
     */
    generateFieldConfigUI(fields, currentView) {
        return {
            title: `Configure ${currentView.charAt(0).toUpperCase() + currentView.slice(1)} View Fields`,
            fields: fields.map(field => ({
                fieldname: field.fieldname,
                label: field.label,
                visible: field.visible,
                width: field.width,
                sortable: field.sortable,
                filterable: field.filterable,
                priority: field.priority
            }))
        };
    }
    
    /**
     * Save user field preferences
     */
    saveUserPreferences(tableName, viewType, preferences) {
        const key = `flansa_field_prefs_${tableName}_${viewType}`;
        localStorage.setItem(key, JSON.stringify(preferences));
        console.log('💾 Saved field preferences for', tableName, viewType);
    }
    
    /**
     * Load user field preferences  
     */
    loadUserPreferences(tableName, viewType) {
        const key = `flansa_field_prefs_${tableName}_${viewType}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : {};
    }
}

// Export for use in record viewer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlansaFieldConfigManager;
} else {
    window.FlansaFieldConfigManager = FlansaFieldConfigManager;
}