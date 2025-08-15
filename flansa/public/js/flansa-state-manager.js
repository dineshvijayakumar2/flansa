/**
 * Flansa State Manager
 * Manages application state across components
 * Provides centralized state management with persistence
 */

class FlansaStateManager {
    constructor() {
        this.state = {};
        this.subscribers = new Map();
        this.persistKeys = new Set();
        this.isDirty = false;
        
        this.init();
    }

    init() {
        console.log('📦 Initializing Flansa State Manager');
        
        // Load persisted state from localStorage
        this.loadPersistedState();
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Listen for state events
        this.setupEventListeners();
    }

    /**
     * Set a state value
     */
    set(key, value, options = {}) {
        const oldValue = this.state[key];
        
        // Check if value actually changed
        if (JSON.stringify(oldValue) === JSON.stringify(value)) {
            return;
        }

        // Update state
        this.state[key] = value;
        
        // Mark as dirty if this key should be persisted
        if (this.persistKeys.has(key)) {
            this.isDirty = true;
        }

        // Notify subscribers
        this.notifySubscribers(key, value, oldValue);

        // Persist if requested
        if (options.persist) {
            this.persistKeys.add(key);
            this.saveState();
        }

        // Emit global event
        $(document).trigger('flansa:state-changed', {
            key: key,
            value: value,
            oldValue: oldValue
        });

        console.log(`📝 State updated: ${key}`, value);
    }

    /**
     * Get a state value
     */
    get(key, defaultValue = null) {
        return this.state[key] !== undefined ? this.state[key] : defaultValue;
    }

    /**
     * Get multiple state values
     */
    getMultiple(keys) {
        const result = {};
        keys.forEach(key => {
            result[key] = this.get(key);
        });
        return result;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        this.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    /**
     * Subscribe to multiple keys
     */
    subscribeMultiple(keys, callback) {
        const unsubscribers = keys.map(key => this.subscribe(key, callback));
        
        // Return function to unsubscribe from all
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }

    /**
     * Notify subscribers of a state change
     */
    notifySubscribers(key, value, oldValue) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(value, oldValue, key);
                } catch (error) {
                    console.error('Error in state subscriber:', error);
                }
            });
        }
        
        // Also notify wildcard subscribers
        const wildcardCallbacks = this.subscribers.get('*');
        if (wildcardCallbacks) {
            wildcardCallbacks.forEach(callback => {
                try {
                    callback({ key, value, oldValue });
                } catch (error) {
                    console.error('Error in wildcard subscriber:', error);
                }
            });
        }
    }

    /**
     * Clear a state value
     */
    clear(key) {
        delete this.state[key];
        this.persistKeys.delete(key);
        this.notifySubscribers(key, undefined, this.state[key]);
        this.saveState();
    }

    /**
     * Clear all state
     */
    clearAll() {
        const oldState = { ...this.state };
        this.state = {};
        this.persistKeys.clear();
        
        // Notify all subscribers
        Object.keys(oldState).forEach(key => {
            this.notifySubscribers(key, undefined, oldState[key]);
        });
        
        this.saveState();
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const stateToSave = {};
            this.persistKeys.forEach(key => {
                if (this.state[key] !== undefined) {
                    stateToSave[key] = this.state[key];
                }
            });
            
            localStorage.setItem('flansa_state', JSON.stringify(stateToSave));
            localStorage.setItem('flansa_persist_keys', JSON.stringify([...this.persistKeys]));
            
            this.isDirty = false;
            console.log('💾 State saved to localStorage');
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    /**
     * Load persisted state from localStorage
     */
    loadPersistedState() {
        try {
            const savedState = localStorage.getItem('flansa_state');
            const savedKeys = localStorage.getItem('flansa_persist_keys');
            
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                Object.assign(this.state, parsedState);
                console.log('📂 Loaded state from localStorage:', Object.keys(parsedState));
            }
            
            if (savedKeys) {
                const parsedKeys = JSON.parse(savedKeys);
                parsedKeys.forEach(key => this.persistKeys.add(key));
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }

    /**
     * Setup auto-save for persisted state
     */
    setupAutoSave() {
        // Save every 5 seconds if dirty
        setInterval(() => {
            if (this.isDirty) {
                this.saveState();
            }
        }, 5000);
        
        // Save before page unload
        window.addEventListener('beforeunload', () => {
            if (this.isDirty) {
                this.saveState();
            }
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for state update requests
        $(document).on('flansa:set-state', (e, data) => {
            this.set(data.key, data.value, data.options);
        });
        
        // Listen for state get requests
        $(document).on('flansa:get-state', (e, data) => {
            const value = this.get(data.key, data.defaultValue);
            if (data.callback) {
                data.callback(value);
            }
        });
    }

    /**
     * Create a scoped state container
     */
    createScope(scopeName) {
        return {
            set: (key, value, options) => {
                this.set(`${scopeName}.${key}`, value, options);
            },
            get: (key, defaultValue) => {
                return this.get(`${scopeName}.${key}`, defaultValue);
            },
            clear: (key) => {
                this.clear(`${scopeName}.${key}`);
            },
            subscribe: (key, callback) => {
                return this.subscribe(`${scopeName}.${key}`, callback);
            }
        };
    }

    /**
     * Get state for debugging
     */
    debug() {
        console.group('🔍 Flansa State Debug');
        console.log('Current State:', this.state);
        console.log('Persisted Keys:', [...this.persistKeys]);
        console.log('Subscribers:', [...this.subscribers.keys()]);
        console.log('Is Dirty:', this.isDirty);
        console.groupEnd();
    }
}

// Specific state containers for different features
class ReportState {
    constructor(stateManager) {
        this.scope = stateManager.createScope('report');
    }

    setFilters(tableName, filters) {
        this.scope.set(`${tableName}.filters`, filters, { persist: true });
    }

    getFilters(tableName) {
        return this.scope.get(`${tableName}.filters`, []);
    }

    setSort(tableName, sort) {
        this.scope.set(`${tableName}.sort`, sort, { persist: true });
    }

    getSort(tableName) {
        return this.scope.get(`${tableName}.sort`, { field: 'modified', order: 'desc' });
    }

    setView(tableName, view) {
        this.scope.set(`${tableName}.view`, view, { persist: true });
    }

    getView(tableName) {
        return this.scope.get(`${tableName}.view`, 'table');
    }

    setPageSize(tableName, pageSize) {
        this.scope.set(`${tableName}.pageSize`, pageSize, { persist: true });
    }

    getPageSize(tableName) {
        return this.scope.get(`${tableName}.pageSize`, 20);
    }

    setSelectedColumns(tableName, columns) {
        this.scope.set(`${tableName}.columns`, columns, { persist: true });
    }

    getSelectedColumns(tableName) {
        return this.scope.get(`${tableName}.columns`, null);
    }
}

class RecordState {
    constructor(stateManager) {
        this.scope = stateManager.createScope('record');
    }

    setDraft(tableName, recordId, data) {
        this.scope.set(`${tableName}.${recordId}.draft`, data, { persist: true });
    }

    getDraft(tableName, recordId) {
        return this.scope.get(`${tableName}.${recordId}.draft`, null);
    }

    clearDraft(tableName, recordId) {
        this.scope.clear(`${tableName}.${recordId}.draft`);
    }

    setFormData(tableName, data) {
        this.scope.set(`${tableName}.formData`, data);
    }

    getFormData(tableName) {
        return this.scope.get(`${tableName}.formData`, {});
    }
}

class UIState {
    constructor(stateManager) {
        this.scope = stateManager.createScope('ui');
    }

    setSidebarCollapsed(collapsed) {
        this.scope.set('sidebarCollapsed', collapsed, { persist: true });
    }

    getSidebarCollapsed() {
        return this.scope.get('sidebarCollapsed', false);
    }

    setTheme(theme) {
        this.scope.set('theme', theme, { persist: true });
    }

    getTheme() {
        return this.scope.get('theme', 'light');
    }

    setLastVisitedTable(tableName) {
        this.scope.set('lastVisitedTable', tableName, { persist: true });
    }

    getLastVisitedTable() {
        return this.scope.get('lastVisitedTable', null);
    }
}

// Create singleton instances
window.FlansaState = window.FlansaState || new FlansaStateManager();
window.FlansaReportState = window.FlansaReportState || new ReportState(window.FlansaState);
window.FlansaRecordState = window.FlansaRecordState || new RecordState(window.FlansaState);
window.FlansaUIState = window.FlansaUIState || new UIState(window.FlansaState);