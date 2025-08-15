/**
 * Flansa Data Service
 * Centralized data management for all CRUD operations
 * Provides consistent API interface for all components
 */

class FlansaDataService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.pendingRequests = new Map();
    }

    /**
     * Get table metadata including fields and configuration
     */
    async getTableMetadata(tableName) {
        const cacheKey = `metadata_${tableName}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_table_metadata',
                args: { table_name: tableName }
            });

            if (response.message && response.message.success) {
                const metadata = {
                    tableName: tableName,
                    doctype: response.message.doctype_name,
                    fields: response.message.fields,
                    permissions: response.message.permissions || {},
                    settings: response.message.settings || {}
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: metadata,
                    timestamp: Date.now()
                });

                return metadata;
            }
            
            throw new Error(response.message?.error || 'Failed to load metadata');
            
        } catch (error) {
            console.error('❌ Error loading table metadata:', error);
            throw error;
        }
    }

    /**
     * Get multiple records with filtering, sorting, and pagination
     */
    async getRecords(tableName, options = {}) {
        const {
            filters = [],
            sort = { field: 'modified', order: 'desc' },
            page = 1,
            pageSize = 20,
            fields = ['*']
        } = options;

        // Create a request key for deduplication
        const requestKey = JSON.stringify({ tableName, filters, sort, page, pageSize });
        
        // Check if same request is already pending
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }

        const requestPromise = this._fetchRecords(tableName, options);
        this.pendingRequests.set(requestKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.pendingRequests.delete(requestKey);
        }
    }

    async _fetchRecords(tableName, options) {
        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_records',
                args: {
                    table_name: tableName,
                    filters: options.filters || [],
                    sort: options.sort || { field: 'modified', order: 'desc' },
                    page: options.page || 1,
                    page_size: options.pageSize || 20,
                    fields: options.fields || ['*']
                }
            });

            if (response.message && response.message.success) {
                return {
                    records: response.message.records || [],
                    total: response.message.total || 0,
                    page: options.page || 1,
                    pageSize: options.pageSize || 20,
                    hasMore: response.message.has_more || false
                };
            }

            throw new Error(response.message?.error || 'Failed to load records');

        } catch (error) {
            console.error('❌ Error loading records:', error);
            throw error;
        }
    }

    /**
     * Get a single record by ID
     */
    async getRecord(tableName, recordId) {
        const cacheKey = `record_${tableName}_${recordId}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout / 2) { // Shorter cache for single records
                return cached.data;
            }
        }

        try {
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.get_record',
                args: {
                    table_name: tableName,
                    record_id: recordId
                }
            });

            if (response.message && response.message.success) {
                const record = response.message.record;
                
                // Cache the result
                this.cache.set(cacheKey, {
                    data: record,
                    timestamp: Date.now()
                });

                return record;
            }

            throw new Error(response.message?.error || 'Failed to load record');

        } catch (error) {
            console.error('❌ Error loading record:', error);
            throw error;
        }
    }

    /**
     * Create a new record
     */
    async createRecord(tableName, data) {
        try {
            // Clear related caches
            this.clearTableCache(tableName);

            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.create_record',
                args: {
                    table_name: tableName,
                    values: data
                }
            });

            if (response.message && response.message.success) {
                // Emit event for other components
                $(document).trigger('flansa:record-created', {
                    table: tableName,
                    record: response.message.record
                });

                return response.message.record;
            }

            throw new Error(response.message?.error || 'Failed to create record');

        } catch (error) {
            console.error('❌ Error creating record:', error);
            throw error;
        }
    }

    /**
     * Update an existing record
     */
    async updateRecord(tableName, recordId, data) {
        try {
            // Clear related caches
            this.clearRecordCache(tableName, recordId);
            this.clearTableCache(tableName);

            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.update_record',
                args: {
                    table_name: tableName,
                    record_name: recordId,
                    values: data
                }
            });

            if (response.message && response.message.success) {
                // Emit event for other components
                $(document).trigger('flansa:record-updated', {
                    table: tableName,
                    recordId: recordId,
                    record: response.message.record
                });

                return response.message.record;
            }

            throw new Error(response.message?.error || 'Failed to update record');

        } catch (error) {
            console.error('❌ Error updating record:', error);
            throw error;
        }
    }

    /**
     * Delete a record
     */
    async deleteRecord(tableName, recordId) {
        try {
            // Show confirmation
            const confirmed = await this.confirmDelete(recordId);
            if (!confirmed) return false;

            // Clear related caches
            this.clearRecordCache(tableName, recordId);
            this.clearTableCache(tableName);

            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.delete_record',
                args: {
                    table_name: tableName,
                    record_name: recordId
                }
            });

            if (response.message && response.message.success) {
                // Emit event for other components
                $(document).trigger('flansa:record-deleted', {
                    table: tableName,
                    recordId: recordId
                });

                frappe.show_alert({
                    message: 'Record deleted successfully',
                    indicator: 'green'
                });

                return true;
            }

            throw new Error(response.message?.error || 'Failed to delete record');

        } catch (error) {
            console.error('❌ Error deleting record:', error);
            frappe.show_alert({
                message: 'Error deleting record: ' + error.message,
                indicator: 'red'
            });
            return false;
        }
    }

    /**
     * Bulk update multiple records
     */
    async bulkUpdate(tableName, recordIds, data) {
        try {
            // Clear table cache
            this.clearTableCache(tableName);

            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.bulk_update',
                args: {
                    table_name: tableName,
                    record_ids: recordIds,
                    values: data
                }
            });

            if (response.message && response.message.success) {
                // Clear individual record caches
                recordIds.forEach(id => this.clearRecordCache(tableName, id));

                // Emit event
                $(document).trigger('flansa:records-bulk-updated', {
                    table: tableName,
                    recordIds: recordIds,
                    updated: response.message.updated_count
                });

                return response.message;
            }

            throw new Error(response.message?.error || 'Failed to update records');

        } catch (error) {
            console.error('❌ Error in bulk update:', error);
            throw error;
        }
    }

    /**
     * Bulk delete multiple records
     */
    async bulkDelete(tableName, recordIds) {
        try {
            // Show confirmation
            const confirmed = await this.confirmBulkDelete(recordIds.length);
            if (!confirmed) return false;

            // Clear caches
            this.clearTableCache(tableName);
            recordIds.forEach(id => this.clearRecordCache(tableName, id));

            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.bulk_delete',
                args: {
                    table_name: tableName,
                    record_ids: recordIds
                }
            });

            if (response.message && response.message.success) {
                // Emit event
                $(document).trigger('flansa:records-bulk-deleted', {
                    table: tableName,
                    recordIds: recordIds,
                    deleted: response.message.deleted_count
                });

                frappe.show_alert({
                    message: `${response.message.deleted_count} records deleted successfully`,
                    indicator: 'green'
                });

                return response.message;
            }

            throw new Error(response.message?.error || 'Failed to delete records');

        } catch (error) {
            console.error('❌ Error in bulk delete:', error);
            frappe.show_alert({
                message: 'Error deleting records: ' + error.message,
                indicator: 'red'
            });
            return false;
        }
    }

    /**
     * Export records to specified format
     */
    async exportRecords(tableName, format = 'excel', options = {}) {
        try {
            frappe.show_alert({
                message: 'Preparing export...',
                indicator: 'blue'
            });

            const response = await frappe.call({
                method: 'flansa.flansa_core.api.table_api.export_records',
                args: {
                    table_name: tableName,
                    format: format,
                    filters: options.filters || [],
                    fields: options.fields || []
                }
            });

            if (response.message && response.message.success) {
                // Download the file
                const link = document.createElement('a');
                link.href = response.message.file_url;
                link.download = response.message.filename;
                link.click();

                frappe.show_alert({
                    message: 'Export completed successfully',
                    indicator: 'green'
                });

                return true;
            }

            throw new Error(response.message?.error || 'Export failed');

        } catch (error) {
            console.error('❌ Export error:', error);
            frappe.show_alert({
                message: 'Export failed: ' + error.message,
                indicator: 'red'
            });
            return false;
        }
    }

    /**
     * Import records from file
     */
    async importRecords(tableName, file, options = {}) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('table_name', tableName);
            formData.append('options', JSON.stringify(options));

            frappe.show_progress('Importing...', 30, 100, 'Processing file...');

            const response = await $.ajax({
                url: '/api/method/flansa.flansa_core.api.table_api.import_records',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'X-Frappe-CSRF-Token': frappe.csrf_token
                }
            });

            frappe.hide_progress();

            if (response.message && response.message.success) {
                // Clear table cache
                this.clearTableCache(tableName);

                frappe.show_alert({
                    message: `${response.message.imported_count} records imported successfully`,
                    indicator: 'green'
                });

                return response.message;
            }

            throw new Error(response.message?.error || 'Import failed');

        } catch (error) {
            frappe.hide_progress();
            console.error('❌ Import error:', error);
            frappe.show_alert({
                message: 'Import failed: ' + error.message,
                indicator: 'red'
            });
            throw error;
        }
    }

    // Cache management methods
    clearRecordCache(tableName, recordId) {
        const cacheKey = `record_${tableName}_${recordId}`;
        this.cache.delete(cacheKey);
    }

    clearTableCache(tableName) {
        // Clear all cached data for this table
        for (const [key] of this.cache) {
            if (key.includes(tableName)) {
                this.cache.delete(key);
            }
        }
    }

    clearAllCache() {
        this.cache.clear();
    }

    // Helper methods
    async confirmDelete(recordId) {
        return new Promise((resolve) => {
            frappe.confirm(
                `Are you sure you want to delete record "${recordId}"?`,
                () => resolve(true),
                () => resolve(false)
            );
        });
    }

    async confirmBulkDelete(count) {
        return new Promise((resolve) => {
            frappe.confirm(
                `Are you sure you want to delete ${count} record(s)?`,
                () => resolve(true),
                () => resolve(false)
            );
        });
    }
}

// Create singleton instance
window.FlansaDataService = window.FlansaDataService || new FlansaDataService();