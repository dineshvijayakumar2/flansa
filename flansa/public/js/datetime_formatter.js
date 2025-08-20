/**
 * Flansa DateTime Formatter
 * Utility for formatting dates and times according to field configuration
 */

window.FlansaDateTimeFormatter = {
    
    /**
     * Format a datetime value according to field configuration
     */
    formatDateTime(value, fieldConfig = {}) {
        if (!value) return '';
        
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;
        
        const {
            date_format = 'dd/mm/yyyy',
            time_format = '12 Hour (AM/PM)',
            custom_date_format = '',
            show_timezone = false,
            timezone = 'User Timezone',
            custom_timezone = ''
        } = fieldConfig;
        
        let formattedDate = '';
        let formattedTime = '';
        
        // Format date part
        if (date_format === 'Custom' && custom_date_format) {
            formattedDate = this.formatWithCustomPattern(date, custom_date_format);
        } else {
            formattedDate = this.formatDatePart(date, date_format);
        }
        
        // Format time part if needed
        if (fieldConfig.field_type === 'Datetime' || fieldConfig.field_type === 'Time') {
            formattedTime = this.formatTimePart(date, time_format);
        }
        
        // Combine date and time
        let result = '';
        if (fieldConfig.field_type === 'Date') {
            result = formattedDate;
        } else if (fieldConfig.field_type === 'Time') {
            result = formattedTime;
        } else {
            result = `${formattedDate} ${formattedTime}`.trim();
        }
        
        // Add timezone if needed
        if (show_timezone && fieldConfig.field_type === 'Datetime') {
            const tz = custom_timezone || (timezone === 'User Timezone' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone);
            if (tz && tz !== 'UTC') {
                result += ` (${tz})`;
            }
        }
        
        return result;
    },
    
    /**
     * Format date part according to selected format
     */
    formatDatePart(date, format) {
        switch (format) {
            case 'mm/dd/yyyy':
                return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
            case 'yyyy-mm-dd':
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            case 'dd-mm-yyyy':
                return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            case 'dd.mm.yyyy':
                return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
            case 'Mar 15, 2024':
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            case 'March 15, 2024':
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            case '15 Mar 2024':
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
            case '15 March 2024':
                const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                return `${date.getDate()} ${fullMonths[date.getMonth()]} ${date.getFullYear()}`;
            default: // dd/mm/yyyy
                return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }
    },
    
    /**
     * Format time part according to selected format
     */
    formatTimePart(date, format) {
        switch (format) {
            case '24 Hour':
                return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            case 'HH:mm':
                return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            case 'HH:mm:ss':
                return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
            default: // 12 Hour (AM/PM)
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
    },
    
    /**
     * Format with custom pattern (simplified implementation)
     */
    formatWithCustomPattern(date, pattern) {
        return pattern
            .replace(/yyyy/g, date.getFullYear())
            .replace(/yy/g, String(date.getFullYear()).slice(-2))
            .replace(/MM/g, String(date.getMonth() + 1).padStart(2, '0'))
            .replace(/M/g, date.getMonth() + 1)
            .replace(/dd/g, String(date.getDate()).padStart(2, '0'))
            .replace(/d/g, date.getDate());
    }
};

// Make it globally available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FlansaDateTimeFormatter;
}
