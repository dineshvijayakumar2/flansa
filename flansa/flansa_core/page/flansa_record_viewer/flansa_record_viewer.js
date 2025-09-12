/**
 * Flansa Record Viewer - Single Record Operations
 * Handles view, edit, and create operations for individual records
 */

frappe.pages['flansa-record-viewer'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Record Viewer',
        single_column: true
    });
    
    // Hide the default page header to keep only our sleek banner
    $(page.wrapper).find('.page-head').hide();
    
    window.recordViewer = new FlansaRecordViewer(wrapper);
};

class FlansaRecordViewer {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.page = wrapper.page;
        this.table_name = null;
        this.record_id = null;
        this.mode = 'view'; // 'view', 'edit', 'new'
        this.record_data = {};
        this.table_fields = [];
        this.doctype_name = null;
        this.form_config = {};
        this.form_sections = [];
        
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing Flansa Record Viewer');
        this.get_route_params();
        
        if (this.table_name) {
            this.setup_html();
            this.bind_events();
            this.load_data();
            
            // Fix breadcrumb navigation after HTML is fully rendered
            setTimeout(() => {
                this.fix_breadcrumb_navigation();
            }, 200);
        }
    }

    fix_breadcrumb_navigation() {
        // Apply click handler to ALL breadcrumb links after they're rendered
        const attempts = [100, 300, 500, 1000];
        let attemptIndex = 0;
        
        const tryFix = () => {
            const selectors = [
                'a[href*="/app/flansa-table-builder"]',
                'a[href*="/app/flansa-report-manager"]',
                'a[href*="/app/flansa-report-viewer"]',
                'a[href*="/app/flansa-app-builder"]',
                'a[href*="/app/flansa-workspace-builder"]',
                '.breadcrumb a[href*="/app/flansa-"]'
            ];
            
            let totalFixed = 0;
            // Apply click handlers to preserve query strings
            for (const selector of selectors) {
                const links = $(selector);
                if (links.length > 0) {
                    totalFixed += links.length;
                    
                    links.each(function() {
                        const $link = $(this);
                        
                        // Remove ALL event handlers and add our handler  
                        $link.parents().addBack().off('click.frappe');
                        $link.unbind('click').off('click');
                        $link.on('click.flansa-fix', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            const targetUrl = $(this).attr('href');
                            window.location.assign(targetUrl);
                            return false;
                        });
                        
                        // Add capturing phase handler as backup
                        this.addEventListener('click', function(e) {
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }, true);
                    });
                }
            }
            
            if (totalFixed === 0 && attemptIndex < attempts.length) {
                setTimeout(tryFix, attempts[attemptIndex]);
                attemptIndex++;
            }
        };
        
        tryFix();
    }
    
    // Helper method for API calls
    call_api(method, args) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: method,
                args: args,
                callback: (response) => {
                    if (response.message) {
                        resolve(response.message);
                    } else {
                        resolve({ success: false, error: 'No response' });
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
    
    // Load form builder configuration
    async load_form_configuration() {
        try {
            const formConfigResponse = await this.call_api(
                'flansa.flansa_core.api.form_builder.get_table_form_config',
                { table_name: this.table_name }
            );
            
            if (formConfigResponse.success) {
                this.form_config = formConfigResponse.form_config || {};
                this.form_sections = formConfigResponse.form_config?.sections || [];
                console.log('📋 Loaded form builder configuration:', this.form_config);
                return true;
            } else {
                console.warn('⚠️ No form builder configuration found, using default layout');
                this.form_config = {};
                this.form_sections = [];
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading form configuration:', error);
            this.form_config = {};
            this.form_sections = [];
            return false;
        }
    }
    
    // Gallery field detection
    is_gallery_field(field) {
        if (!field || field.fieldtype !== 'Long Text') {
            return false;
        }
        
        // Check field name for gallery keywords
        const fieldName = (field.fieldname || '').toLowerCase();
        if (fieldName.includes('gallery') || fieldName.includes('image') || fieldName.includes('photo')) {
            return true;
        }
        
        // Check field label for gallery keywords
        const fieldLabel = (field.label || '').toLowerCase();
        if (fieldLabel.includes('gallery') || fieldLabel.includes('image') || fieldLabel.includes('photo')) {
            return true;
        }
        
        return false;
    }
    
    get_route_params() {
        const route = frappe.get_route();
        const new_table_name = route[1];
        const new_record_id = route[2];
        
        // Check if we're navigating to a different record/table
        const is_different_context = (
            this.table_name !== new_table_name || 
            this.record_id !== new_record_id
        );
        
        // If context changed, clear cached data
        if (is_different_context && (this.table_name || this.record_id)) {
            console.log('🔄 Route parameters changed, clearing cached data');
            console.log('   Previous:', { table: this.table_name, record: this.record_id });
            console.log('   New:', { table: new_table_name, record: new_record_id });
            this.clear_cached_data();
        }
        
        this.table_name = new_table_name;
        this.record_id = new_record_id;
        
        // Get mode from query parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.mode = urlParams.get('mode') || 'view';
        
        // Check if we came from a report (for breadcrumb context)
        this.from_report = urlParams.get('from_report') || urlParams.get('report') || null;
        this.report_name = urlParams.get('report_name') || null;
        
        if (!this.table_name) {
            frappe.show_alert({
                message: 'No table specified in route',
                indicator: 'red'
            });
            return;
        }
        
        // Handle different route patterns
        if (this.record_id === 'new') {
            this.mode = 'new';
            this.record_id = null;
        } else if (!this.record_id) {
            // No record ID provided - redirect to report viewer for list view
            console.log('📋 No record ID provided, redirecting to report viewer');
            frappe.set_route('flansa-report-viewer', this.table_name);
            return;
        }
        
        console.log('📋 Record viewer params:', {
            table: this.table_name,
            record_id: this.record_id,
            mode: this.mode
        });
    }
    
    generate_action_buttons() {
        // Generate appropriate action buttons based on current mode
        if (this.mode === 'new') {
            return `
                <div class="action-dropdown">
                    <button class="sleek-btn primary" id="save-record">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586l-1.293-1.293z" />
                            <path d="M3 14a1 1 0 011-1h1V9a1 1 0 012 0v4h4V9a1 1 0 012 0v4h1a1 1 0 110 2H4a1 1 0 01-1-1z" />
                        </svg>
                        <span>Save</span>
                    </button>
                </div>
                <div class="action-dropdown">
                    <button class="sleek-btn secondary" id="cancel-record">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        <span>Cancel</span>
                    </button>
                </div>`;
        } else if (this.mode === 'edit') {
            return `
                <div class="action-dropdown">
                    <button class="sleek-btn primary" id="save-record">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586l-1.293-1.293z" />
                            <path d="M3 14a1 1 0 011-1h1V9a1 1 0 012 0v4h4V9a1 1 0 012 0v4h1a1 1 0 110 2H4a1 1 0 01-1-1z" />
                        </svg>
                        <span>Save</span>
                    </button>
                </div>
                <div class="action-dropdown">
                    <button class="sleek-btn secondary" id="cancel-record">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        <span>Cancel</span>
                    </button>
                </div>`;
        } else {
            // View mode - show context menu with edit, duplicate, delete options
            return `
                <div class="action-dropdown">
                    <button class="sleek-btn secondary" id="context-menu">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                    <div class="dropdown-panel" id="context-dropdown">
                        <a href="#" class="dropdown-option" id="edit-record-menu">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            <span>Edit Record</span>
                        </a>
                        <a href="#" class="dropdown-option" id="duplicate-record-menu">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm8 8v2a1 1 0 001 1h3a1 1 0 001-1v-9a1 1 0 00-1-1h-2a1 1 0 000 2h1v7h-3z" clip-rule="evenodd"></path>
                            </svg>
                            <span>Duplicate Record</span>
                        </a>
                        <a href="#" class="dropdown-option" id="delete-record-menu">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                            <span>Delete Record</span>
                        </a>
                    </div>
                </div>`;
        }
    }

    generate_breadcrumb_html() {
        // Generate dynamic breadcrumb HTML based on access path
        let breadcrumbHtml = `
            <a href="/app/flansa-workspace-builder" class="breadcrumb-link">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Workspace</span>
            </a>
            <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
            <a href="/app/flansa-app-builder" class="breadcrumb-link" id="app-breadcrumb-link">
                <span>App Builder</span>
            </a>
            <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
            <a href="/app/flansa-table-builder?table=${encodeURIComponent(this.table_name)}" class="breadcrumb-link" id="table-breadcrumb-link">
                <span>Table Builder</span>
            </a>`;
        
        // Add report breadcrumb if accessed from a report
        if (this.from_report || this.report_name) {
            breadcrumbHtml += `
                <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
                <a href="/app/flansa-report-manager?table=${encodeURIComponent(this.table_name)}" class="breadcrumb-link">
                    <span>Reports</span>
                </a>`;
            
            // Add specific report name if available
            if (this.report_name) {
                breadcrumbHtml += `
                    <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                    <a href="/app/flansa-report-viewer/${encodeURIComponent(this.table_name)}?report=${encodeURIComponent(this.from_report)}" class="breadcrumb-link" id="report-breadcrumb-link">
                        <span>${this.report_name}</span>
                    </a>`;
            }
        }
        
        // Final breadcrumb (current page)
        breadcrumbHtml += `
            <svg class="breadcrumb-divider" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
            <span class="breadcrumb-current">📋 Record Viewer</span>`;
        
        return breadcrumbHtml;
    }
    
    setup_html() {
        const modeTitle = this.mode === 'new' ? 'Create New Record' : 
                         this.mode === 'edit' ? 'Edit Record' : 'View Record';
        
        this.page.set_title(modeTitle);
        
        this.page.main.html(`
            <div class="flansa-record-viewer-page">
                <!-- Ultra-modern sleek header -->
                <div class="sleek-header">
                    <div class="header-backdrop"></div>
                    <div class="header-content">
                        <!-- Breadcrumb Trail -->
                        <nav class="breadcrumb-trail">
                            ${this.generate_breadcrumb_html()}
                        </nav>
                        
                        <!-- Application Banner below breadcrumbs -->
                        <div class="app-banner">
                            <div class="banner-left">
                                <!-- Optional Workspace Logo -->
                                <div class="workspace-logo-container" id="workspace-logo-container" style="display: none; margin-right: 8px;">
                                    <img src="" alt="Workspace Logo" class="workspace-logo" id="workspace-logo" />
                                </div>
                                <!-- App Info Section -->
                                <div class="app-info">
                                    <div class="app-details">
                                        <h1 class="app-name title-text" id="app-name-display">${modeTitle}</h1>
                                        <div class="app-type">
                                            <div class="counter-pill">
                                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                                                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                                                </svg>
                                                <span class="counter-text">Record ${this.mode.charAt(0).toUpperCase() + this.mode.slice(1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Action Buttons -->
                            <div class="banner-right">
                                <div class="action-dropdown">
                                    <span class="sleek-badge mode-badge">${this.mode.toUpperCase()}</span>
                                </div>
                                
                                ${this.generate_action_buttons()}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="record-content" id="record-content">
                    <div class="text-center" style="padding: 50px;">
                        <div class="loading-spinner" style="display: inline-block; width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p class="text-muted" style="margin-top: 20px;">Loading record...</p>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* Ultra-modern Sleek Header */
                .sleek-header {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: white;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                }
                
                .header-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    z-index: -1;
                }
                
                .header-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 1rem 1.5rem;
                }
                
                /* Breadcrumb Trail */
                .breadcrumb-trail {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    margin-bottom: 0.75rem;
                }
                
                .breadcrumb-link {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    color: #6b7280;
                    text-decoration: none;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.375rem;
                    transition: all 0.15s ease;
                }
                
                .breadcrumb-link:hover {
                    color: #4f46e5;
                    background: rgba(79, 70, 229, 0.05);
                }
                
                .breadcrumb-link span {
                    font-weight: 500;
                }
                
                .breadcrumb-divider {
                    color: #d1d5db;
                    flex-shrink: 0;
                }
                
                .breadcrumb-current {
                    color: #111827;
                    font-weight: 600;
                    padding: 0.25rem 0.5rem;
                }
                
                /* Application Banner */
                .app-banner {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                }
                
                .banner-left {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                
                .workspace-logo-container {
                    display: none;
                }
                
                .workspace-logo {
                    height: 40px;
                    width: auto;
                    max-width: 120px;
                    object-fit: contain;
                    border-radius: 4px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .app-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .app-details h1.app-name {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #111827;
                    line-height: 1.2;
                }
                
                .title-text {
                    font-size: 1.375rem;
                    font-weight: 700;
                    color: #111827;
                    letter-spacing: -0.025em;
                    line-height: 1.2;
                }
                
                .app-type {
                    margin-top: 2px;
                    margin-bottom: 16px;
                }
                
                .counter-pill {
                    background: rgba(102, 126, 234, 0.1);
                    color: #667eea;
                    padding: 4px 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .counter-text {
                    font-weight: 500;
                    color: #374151;
                }
                
                .counter-pill .counter-text {
                    color: #667eea;
                    font-weight: 600;
                }
                
                .banner-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                /* Modern Buttons */
                .sleek-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                }
                
                .sleek-btn.primary {
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                    box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3);
                }
                
                .sleek-btn.primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                }
                
                .sleek-btn.secondary {
                    background: white;
                    color: #6b7280;
                    border: 1px solid #e5e7eb;
                    padding: 0.5rem;
                    min-width: 36px;
                    justify-content: center;
                }
                
                .sleek-btn.secondary:hover {
                    background: #f9fafb;
                    color: #4f46e5;
                    border-color: #4f46e5;
                }
                
                .sleek-btn svg {
                    flex-shrink: 0;
                }
                
                /* Modern Dropdown */
                .action-dropdown {
                    position: relative;
                }
                
                .dropdown-panel {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    background: white;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    border-radius: 12px;
                    padding: 0.5rem;
                    min-width: 200px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                    display: none;
                    z-index: 1000;
                }
                
                .dropdown-option {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    color: #374151;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.15s ease;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                
                .dropdown-option:hover {
                    background: #f3f4f6;
                    color: #111827;
                    text-decoration: none;
                }
                
                .dropdown-option svg {
                    color: #6b7280;
                    flex-shrink: 0;
                }
                
                .dropdown-option:hover svg {
                    color: #4f46e5;
                }
                
                /* Badge Styling */
                .sleek-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.25rem 0.625rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .mode-badge {
                    background: rgba(34, 197, 94, 0.1);
                    color: #166534;
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }
                
                /* Logic Field Styling */
                .logic-field-readonly {
                    position: relative;
                }
                
                .logic-field-readonly::before {
                    content: '';
                    position: absolute;
                    left: -10px;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: linear-gradient(45deg, #17a2b8, #007bff);
                    border-radius: 2px;
                    opacity: 0.8;
                }
                
                .logic-field-calculated {
                    border: 1px solid #bee5eb !important;
                    background-color: #f8fdff !important;
                    position: relative;
                }
                
                .flansa-record-viewer-page {
                    background: #f8f9fa;
                    min-height: calc(100vh - 60px);
                }
                
                .btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .form-group {
                    transition: all 0.2s ease;
                }
                
                .form-group:hover {
                    background: rgba(102, 126, 234, 0.02);
                    border-radius: 4px;
                    padding: 8px;
                    margin: -8px;
                }
                
                .gallery-view img:hover,
                .gallery-edit-item img:hover {
                    transform: scale(1.05);
                    transition: transform 0.2s ease;
                }
                .wysiwyg-form-container {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .form-section {
                    transition: all 0.2s ease;
                }
                
                .form-section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                }
                
                .section-header {
                    background: linear-gradient(135deg, #f8f9fc 0%, #e9ecef 100%);
                }
                
                .form-column {
                    display: flex;
                    flex-direction: column;
                }
                
                .wysiwyg-field {
                    transition: all 0.2s ease;
                }
                
                .wysiwyg-field:hover {
                    background: rgba(102, 126, 234, 0.02);
                    border-radius: 6px;
                    margin: -4px;
                    padding: 4px;
                }
                
                .wysiwyg-input:focus,
                .wysiwyg-textarea:focus,
                .wysiwyg-select:focus {
                    outline: none;
                    border-color: #667eea !important;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
                }
                
                .wysiwyg-display {
                    word-break: break-word;
                    line-height: 1.5;
                }
                
                @media (max-width: 768px) {
                    .section-content {
                        padding: 16px !important;
                    }
                    
                    .form-column {
                        flex: 1 !important;
                        min-width: auto !important;
                        padding-right: 0 !important;
                        margin-bottom: 16px;
                    }
                    
                    .fields-grid {
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                    }
                }
                
                @media (max-width: 1024px) {
                    .fields-grid[style*="repeat(3"] {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                
                .fields-grid {
                    transition: all 0.3s ease;
                }
                
                .form-group {
                    min-width: 0; /* Prevent grid items from overflowing */
                }
                
                .enhanced-field-label {
                    position: relative;
                }
                
                .form-group:hover {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                
                .form-group:hover .enhanced-field-label {
                    color: #667eea;
                }
                
                .wysiwyg-display {
                    word-break: break-word;
                    line-height: 1.6;
                    padding: 12px 0;
                    font-size: 15px;
                    color: #495057;
                }
                
                .form-control-static {
                    padding: 12px 0;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #495057;
                    border-bottom: 1px solid transparent;
                    transition: all 0.2s ease;
                }
                
                .form-control-static:hover {
                    border-bottom-color: #e9ecef;
                }
                
                /* Simple field type indicators */
                .form-group[data-field-type="Date"]::before,
                .form-group[data-field-type="Datetime"]::before {
                    content: "📅";
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    font-size: 12px;
                    opacity: 0.5;
                }
                
                .form-group[data-field-type="Link"]::before {
                    content: "🔗";
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    font-size: 12px;
                    opacity: 0.5;
                }
                
                .form-group[data-field-type="Long Text"]::before,
                .form-group[data-field-type="Text Editor"]::before {
                    content: "📝";
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    font-size: 12px;
                    opacity: 0.5;
                }
                
                /* Frappe native link field styling */
                .frappe-link-field-container {
                    position: relative;
                }
                
                .frappe-link-field {
                    width: 100%;
                }
                
                .link-suggestions {
                    z-index: 1050 !important;
                }
                
                .link-suggestion-item {
                    font-size: 14px;
                }
                
                .link-suggestion-item:last-child {
                    border-bottom: none;
                }
                
                /* Enhanced awesomplete dropdown styling */
                .awesomplete {
                    position: relative;
                    z-index: 1000;
                }
                
                .awesomplete > ul {
                    position: fixed !important;
                    z-index: 9999 !important;
                    background: white;
                    border: 1px solid #d1d8dd;
                    border-radius: 4px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    max-height: 300px;
                    overflow-y: auto;
                    min-width: 200px;
                }
                
                .awesomplete > ul > li {
                    padding: 8px 12px;
                    border-bottom: 1px solid #f0f0f0;
                    cursor: pointer;
                    line-height: 1.4;
                }
                
                .awesomplete > ul > li:hover,
                .awesomplete > ul > li[aria-selected="true"] {
                    background-color: #f8f9fa;
                }
                
                .awesomplete > ul > li strong {
                    color: #333;
                    font-weight: 500;
                }
                
                .awesomplete > ul > li small {
                    color: #6c757d;
                    font-size: 12px;
                }
                
                /* Ensure parent containers don't clip dropdown */
                .content-container,
                .form-container,
                .fields-grid,
                .form-group {
                    overflow: visible !important;
                }
                
                /* Custom dropdown styling */
                .flansa-custom-dropdown {
                    position: relative;
                }
                
                .flansa-custom-dropdown .dropdown-clear-btn {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    background-color: #f8f9fa;
                    color: #6c757d;
                    transition: all 0.2s ease;
                    z-index: 10;
                }
                
                .flansa-custom-dropdown .dropdown-clear-btn:hover {
                    background-color: #e9ecef;
                    color: #495057;
                    transform: translateY(-50%) scale(1.1);
                }
                
                .flansa-custom-dropdown .dropdown-clear-btn svg {
                    width: 12px;
                    height: 12px;
                }
                
                .flansa-custom-dropdown .dropdown-list {
                    background: white;
                    border: 1px solid #d1d8dd;
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    max-height: 300px;
                    overflow-y: auto;
                    z-index: 9999;
                }
                
                .flansa-custom-dropdown .dropdown-item {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f0f3f4;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                }
                
                .flansa-custom-dropdown .dropdown-item:last-child {
                    border-bottom: none;
                }
                
                .flansa-custom-dropdown .dropdown-item:hover,
                .flansa-custom-dropdown .dropdown-item.selected {
                    background-color: #f8f9fa;
                }
                
                .flansa-custom-dropdown .dropdown-item-main {
                    font-weight: 500;
                    color: #333;
                    margin-bottom: 4px;
                }
                
                .flansa-custom-dropdown .dropdown-item-description {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .flansa-custom-dropdown .dropdown-loading,
                .flansa-custom-dropdown .dropdown-no-results,
                .flansa-custom-dropdown .dropdown-error {
                    padding: 12px 16px;
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                }
                
                .flansa-custom-dropdown .dropdown-error {
                    color: #dc3545;
                }
                
                /* Create new option styling */
                .flansa-custom-dropdown .dropdown-create-new {
                    background-color: #f8f9fa;
                    border: 1px dashed #dee2e6;
                    margin-bottom: 4px;
                    border-radius: 4px;
                }
                
                .flansa-custom-dropdown .dropdown-create-new:hover {
                    background-color: #e9ecef;
                    border-color: #adb5bd;
                }
                
                .flansa-custom-dropdown .dropdown-create-new .dropdown-item-main {
                    color: #007bff;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                }
                
                .flansa-custom-dropdown .dropdown-create-new .dropdown-item-description {
                    color: #6c757d;
                    font-size: 11px;
                }
                
                /* Separator styling */
                .flansa-custom-dropdown .dropdown-separator {
                    height: 1px;
                    background-color: #dee2e6;
                    margin: 4px 0;
                }
                
                /* Frappe control container styling */
                .frappe-link-field-container .form-group {
                    margin-bottom: 0;
                }
                
                .frappe-link-field-container .control-input-wrapper {
                    width: 100%;
                }
                
                /* Gallery field special styling */
                .gallery-view {
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
                }
                
                .gallery-item {
                    transition: transform 0.2s ease;
                }
                
                .gallery-item:hover {
                    transform: scale(1.02);
                    z-index: 10;
                }
            </style>
        `);
    }

    
    bind_events() {
        // Event handlers will be added here as needed
        console.log('🔗 Binding events for record viewer');
        
        // Listen for route changes to handle navigation between records
        $(window).on('hashchange.record-viewer', () => {
            console.log('🔄 Hash changed, checking for route changes');
            this.handle_route_change();
        });
        
        // Also listen for Frappe route changes
        frappe.router.on('change', () => {
            console.log('🔄 Frappe route changed, checking parameters');
            this.handle_route_change();
        });
    }
    
    handle_route_change() {
        // Get current route parameters
        const current_route = frappe.get_route();
        
        // Check if we're still in record viewer and parameters changed
        if (current_route[0] === 'flansa-record-viewer') {
            const new_table = current_route[1];
            const new_record = current_route[2];
            
            // If context changed, reload
            if (this.table_name !== new_table || this.record_id !== new_record) {
                console.log('🔄 Record viewer context changed, reloading');
                this.get_route_params();
                this.load_data();
            }
        }
    }
    
    load_data() {
        console.log('📊 Loading data for record viewer');
        
        // Clear any existing cached data first, but only for existing records
        // New records need to keep the loading state until table structure is loaded
        if (this.mode !== 'new') {
            this.clear_cached_data();
        }
        
        // First load form configuration, then load data
        this.load_form_configuration().then((hasFormConfig) => {
            if (this.mode === 'new') {
                this.load_table_structure();
            } else {
                this.load_record_data();
            }
        });
    }

    
    load_table_structure() {
        // For new records, clear previous record data but show loading state
        this.record_data = {};
        const content = document.getElementById('record-content');
        if (content) {
            content.innerHTML = '<div class="text-center"><div class="spinner"></div><p>Loading form structure...</p></div>';
        }
        
        // First check if user has access to this table
        frappe.call({
            method: 'flansa.flansa_core.role_service.get_filtered_tables',
            callback: (accessResult) => {
                const accessibleTables = accessResult.message || [];
                const hasAccess = accessibleTables.some(table => table.name === this.table_name);
                
                if (!hasAccess) {
                    this.show_error('You do not have permission to access this table');
                    return;
                }
                
                // User has access, load table structure
                this.call_api('flansa.flansa_core.api.table_api.get_table_meta', { table_name: this.table_name })
                .then(async (metaResponse) => {
                    if (metaResponse.success) {
                        this.table_fields = metaResponse.fields || [];
                        this.doctype_name = metaResponse.doctype_name;
                        this.application = metaResponse.application;
                        this.naming_config = metaResponse.naming_config || {};
                        
                                // Update banner title with real app/table name
                        this.update_banner_title();
                        
                        // Fix breadcrumb navigation after URLs are set
                        setTimeout(() => {
                            this.fix_breadcrumb_navigation();
                        }, 500);
                        
                        // Check if table is readonly for this user
                        const tableInfo = accessibleTables.find(t => t.name === this.table_name);
                        this.is_readonly = tableInfo && tableInfo.readonly;
                        
                        console.log('📋 Loaded table structure:', { 
                            fields_count: this.table_fields.length, 
                            doctype: this.doctype_name,
                            application: this.application,
                            naming_type: this.naming_config.naming_type,
                            readonly: this.is_readonly
                        });
                        
                        if (this.is_readonly && (this.mode === 'edit' || this.mode === 'new')) {
                            frappe.show_alert('This table is read-only for your role', 'orange');
                            this.mode = 'view';
                        }
                        
                        // Dashboard link no longer needed - using modern breadcrumb structure
                        await this.render_new_record_form();
                    } else {
                        this.show_error('Failed to load table structure: ' + (metaResponse.error || 'Unknown error'));
                    }
                }).catch(error => {
                    console.error('Error loading table structure:', error);
                    this.show_error('Error loading table structure');
                });
            }
        });
    }
    
    load_record_data() {
        this.call_api('flansa.flansa_core.api.table_api.get_record', { 
            table_name: this.table_name, 
            record_id: this.record_id 
        })
        .then(async (recordResponse) => {
            if (recordResponse.success) {
                this.record_data = recordResponse.record || {};
                this.table_fields = recordResponse.fields || [];
                this.doctype_name = recordResponse.doctype_name;
                this.application = recordResponse.application;
                
                // Update banner title with real app/table name
                this.update_banner_title();
                this.update_mode_display(); // Ensure mode display is consistent
                await this.render_record();
            } else {
                this.show_error('Record not found: ' + (recordResponse.error || 'Unknown error'));
            }
        }).catch(error => {
            console.error('Error loading record:', error);
            this.show_error('Error loading record');
        });
    }
    
    async render_record() {
        const content = document.getElementById('record-content');
        const actionsContainer = document.getElementById('record-actions');
        if (!content) return;
        
        // Update action buttons
        if (actionsContainer) {
            let actionHtml = '';
            if (this.mode === 'view') {
                actionHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-sm btn-primary edit-record" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-edit"></i> Edit Record
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-primary form-builder-btn" style="display: flex; align-items: center; gap: 6px;" onclick="window.open('/app/flansa-form-builder?table=${this.table_name}', '_blank')">
                            <i class="fa fa-paint-brush"></i> Customize Form
                        </button>
                    </div>
                `;
            } else if (this.mode === 'edit') {
                actionHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-sm btn-success save-record" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-save"></i> Save Changes
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary cancel-edit" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-times"></i> Cancel
                        </button>
                    </div>
                `;
            } else if (this.mode === 'new') {
                actionHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="btn btn-sm btn-success save-record" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-save"></i> Save
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-primary form-builder-btn" style="display: flex; align-items: center; gap: 6px;" onclick="window.open('/app/flansa-form-builder?table=${this.table_name}', '_blank')">
                            <i class="fa fa-paint-brush"></i> Customize Form
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-secondary cancel-create" style="display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-times"></i> Cancel
                        </button>
                    </div>
                `;
            }
            actionsContainer.innerHTML = actionHtml;
            

        }
        
        // Update status message
        const statusMessage = this.mode === 'new' ? 'Creating new record' :
                            this.mode === 'edit' ? `Editing record ${this.record_id}` : 
                            `Viewing record ${this.record_id}`;
        this.update_status(statusMessage);
        
        let html = `
            <div class="record-form-container" style="background: white; border-radius: 8px; border: 1px solid #e3e6f0; overflow: hidden;">
                <div class="record-header" style="background: #f8f9fc; padding: 16px 20px; border-bottom: 1px solid #e3e6f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #2c3e50;">${this.mode === 'new' ? 'Create New' : this.mode === 'edit' ? 'Edit' : 'View'} Record</h4>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6c757d;">${this.mode === 'new' ? 'New record creation' : `Record ID: ${this.record_id}`}</p>
                        </div>
                        <div class="record-meta" style="text-align: right; font-size: 12px; color: #6c757d;">
                            ${this.record_data.creation ? `<div>Created: ${this.formatDateTime(this.record_data.creation)} ${this.record_data.owner ? 'by ' + this.formatUser(this.record_data.owner) : ''}</div>` : ''}
                            ${this.record_data.modified ? `<div>Modified: ${this.formatDateTime(this.record_data.modified)} ${this.record_data.modified_by ? 'by ' + this.formatUser(this.record_data.modified_by) : ''}</div>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="record-fields" style="padding: 24px;">
                    ${await this.render_form_header()}
                </div>
            </div>
        `;
        
        content.innerHTML = html;
        
        // Small delay to ensure DOM is ready, then bind events
        setTimeout(() => {
            this.bind_record_events();
            this.apply_form_builder_styles();
            // Extra retry for context menu binding
            setTimeout(() => {
                this.bind_context_menu_events();
            }, 100);
        }, 50);
    }
    

    async render_form_header() {
        // Add form title and description from form builder config
        if (this.form_config && (this.form_config.form_title || this.form_config.form_description)) {
            let headerHtml = '';
            
            if (this.form_config.form_title) {
                headerHtml += `<h4 style="margin: 0 0 8px 0; color: #2c3e50; font-weight: 600;">${this.form_config.form_title}</h4>`;
            }
            
            if (this.form_config.form_description) {
                headerHtml += `<p style="margin: 0 0 16px 0; color: #6c757d; font-size: 14px;">${this.form_config.form_description}</p>`;
            }
            
            if (headerHtml) {
                return `
                    <div class="form-builder-header" style="margin-bottom: 20px; padding: 16px; background: #f8f9fc; border-radius: 6px; border-left: 4px solid #667eea;">
                        ${headerHtml}
                        <div style="margin-top: 8px; font-size: 11px; color: #667eea; display: flex; align-items: center; gap: 6px;">
                            <i class="fa fa-paint-brush"></i>
                            <span>Form layout configured with Form Builder</span>
                        </div>
                    </div>
                `;
            }
        }
        
        // Render fields with sections
        if (this.table_fields && this.table_fields.length > 0) {
            // Group fields into sections for better organization
            const sections = this.organize_fields_into_sections(this.table_fields);
            
            let fieldsHtml = '';
            for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
                const section = sections[sectionIndex];
                fieldsHtml += `
                    <div class="field-section" style="margin-bottom: ${sectionIndex < sections.length - 1 ? '32px' : '0'};">
                        ${section.title ? `<h5 class="section-title-enhanced" style="
                            margin: 0 0 16px 0; 
                            color: #495057; 
                            font-weight: 600; 
                            font-size: 16px;
                            display: flex; 
                            align-items: center; 
                            gap: 8px;
                            padding: 12px 0 8px 0;
                            border-bottom: 2px solid #e9ecef;
                        ">
                            <i class="fa fa-${section.icon || 'folder-o'}" style="
                                color: #667eea; 
                                font-size: 14px;
                            "></i>
                            ${section.title}
                            ${section.column_count && section.column_count > 1 ? 
                                `<span style="
                                    background: #f8f9fa; 
                                    color: #6c757d; 
                                    padding: 2px 8px; 
                                    border-radius: 12px; 
                                    font-size: 11px; 
                                    font-weight: 500;
                                    margin-left: auto;
                                    border: 1px solid #e9ecef;
                                ">${section.column_count} Col</span>` : ''}
                        </h5>` : ''}
                        <div class="fields-grid" style="display: grid; grid-template-columns: ${section.columns || 'repeat(auto-fit, minmax(300px, 1fr))'}; gap: 20px;">
                `;
                
                for (const field of section.fields) {
                    fieldsHtml += await this.render_field(field);
                }
                
                fieldsHtml += `
                        </div>
                        ${section.column_count && section.column_count > 1 ? 
                            `<div class="column-indicator" style="margin-top: 8px; text-align: right; font-size: 11px; color: #6c757d; opacity: 0.7;">
                                <i class="fa fa-columns"></i> ${section.column_count} columns
                             </div>` : ''}
                    </div>
                `;
            }
            
            return fieldsHtml;
        } else {
            return `
                <div class="empty-state" style="text-align: center; padding: 40px;">
                    <i class="fa fa-inbox fa-3x" style="color: #dee2e6; margin-bottom: 16px;"></i>
                    <h5 style="color: #6c757d; margin-bottom: 8px;">No Fields Defined</h5>
                    <p class="text-muted">This table doesn't have any fields configured yet.</p>
                </div>
            `;
        }
    }
    
    clear_cached_data() {
        // Clear all cached record data to prevent showing previous record's data
        console.log('🧹 Clearing cached record data');
        this.record_data = {};
        this.table_fields = [];
        this.doctype_name = null;
        this.form_config = {};
        
        // Clear any form input values that might be cached
        this.clear_form_inputs();
        
        // Also clear any DOM elements that might contain cached data
        const content = document.getElementById('record-content');
        if (content) {
            content.innerHTML = '<div class="text-center"><div class="spinner"></div><p>Loading record...</p></div>';
        }
        
        // Clear actions container
        const actionsContainer = document.getElementById('record-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = '';
        }
    }
    
    clear_form_inputs() {
        // Clear all form inputs to prevent cached values from showing
        const content = document.getElementById('record-content');
        if (content) {
            const inputs = content.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
                // Clear data attributes that might cache values
                input.removeAttribute('data-value');
                
                // Clear Frappe link field data
                if (input._frappe_link_field) {
                    try {
                        input._frappe_link_field.set_value('');
                    } catch (e) {
                        console.log('Could not clear Frappe link field:', e);
                    }
                }
            });
        }
    }
    
    async render_new_record_form() {
        // Use the same render_record method but with empty data
        // Only clear record data, but keep table_fields and doctype_name for rendering
        console.log('🆕 Rendering new record form');
        this.record_data = {}; // Clear only record data for empty form
        await this.render_record();
    }
    
    async render_field(field, value = null, isEdit = false) {
        if (!field) return '';
        
        const fieldName = field.fieldname || 'unnamed_field';
        const fieldLabel = field.label || fieldName;
        const fieldValue = value !== null ? value : (this.record_data[fieldName] || '');
        
        // Special handling for the 'name' field based on naming configuration
        if (fieldName === 'name' && this.naming_config) {
            return this.render_name_field(field, fieldValue, isEdit);
        }
        
        // Filter out system fields that shouldn't be displayed
        const systemFields = ['owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx'];
        if (systemFields.includes(fieldName) && this.mode !== 'view') {
            return ''; // Hide system fields in edit/new modes
        }
        
        // Check both mode and field's read_only property
        const isFieldReadOnly = field.read_only || field.readonly || false;
        const isReadonly = (this.mode === 'view' && !isEdit) || isFieldReadOnly;
        
        // Enhanced label styling with prominence and custom options
        const labelStyle = this.getLabelStyle(field);
        const fieldContainerStyle = this.getFieldContainerStyle(field);
        
        // Add read-only indicator for Logic Fields
        const readOnlyIndicator = isFieldReadOnly ? 
            `<small class="text-muted" style="font-size: 11px; margin-left: 8px;">
                <i class="fa fa-lock" title="Read-only field - cannot be edited"></i> Read-only
             </small>` : '';
        
        let html = `
            <div class="form-group ${isFieldReadOnly ? 'logic-field-readonly' : ''}" style="${fieldContainerStyle}">
                <label class="control-label enhanced-field-label" style="${labelStyle}">
                    ${fieldLabel}${readOnlyIndicator}
                </label>
        `;
        
        // Check if this is a gallery field
        if (this.is_gallery_field(field)) {
            if (isReadonly) {
                // View mode - show gallery
                html += this.render_gallery_view(fieldValue);
            } else {
                // Edit mode - show editable gallery
                html += this.render_gallery_edit(fieldValue, fieldName);
            }
        } else if (isReadonly) {
            // View mode for regular fields
            const readOnlyClass = isFieldReadOnly ? 'logic-field-calculated' : '';
            const readOnlyStyle = isFieldReadOnly ? 
                'background: #f8f9fa; border-left: 3px solid #17a2b8; padding: 8px 12px; border-radius: 4px; font-family: monospace;' : '';
            
            // Special handling for link fields in view mode
            if ((field.fieldtype || 'Data') === 'Link') {
                const displayValue = await this.getDisplayValueForLinkField(field, fieldValue, field.options);
                const showDisplayValue = displayValue !== fieldValue;
                
                html += `<div class="form-control-static ${readOnlyClass}" style="${readOnlyStyle}">
                    ${showDisplayValue ? 
                        `${this.escapeHtml(displayValue)} <small class="text-muted">(${this.escapeHtml(fieldValue)})</small>` :
                        `${this.escapeHtml(fieldValue) || '<em class="text-muted">No value</em>'}`
                    }
                </div>`;
            } else {
                html += `<div class="form-control-static ${readOnlyClass}" style="${readOnlyStyle}">
                    ${this.escapeHtml(fieldValue) || '<em class="text-muted">No value</em>'}
                </div>`;
            }
        } else {
            // Edit mode for regular fields
            const fieldType = field.fieldtype || 'Data';
            
            switch (fieldType) {
                case 'Long Text':
                case 'Text Editor':
                    html += `<textarea class="form-control" name="${fieldName}" rows="4">${this.escapeHtml(fieldValue)}</textarea>`;
                    break;
                case 'Check':
                    html += `<input type="checkbox" name="${fieldName}" ${fieldValue ? 'checked' : ''}>`;
                    break;
                case 'Date':
                    html += `<input type="date" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}">`;
                    break;
                case 'Link':
                    html += await this.render_link_field(field, fieldValue, fieldName);
                    break;
                case 'Int':
                case 'Float':
                    html += `<input type="number" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}">`;
                    break;
                default:
                    html += `<input type="text" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}">`;
            }
        }
        
        html += '</div>';
        
        // Add field type data attribute and enhanced styling to the container
        const fieldType = field.fieldtype || field.field_type || 'Data';
        html = html.replace('class="form-group"', `class="form-group" data-field-type="${fieldType}"`);
        
        return html;
    }
    
    render_name_field(field, fieldValue, isEdit) {
        const namingType = this.naming_config.naming_type;
        const isNewRecord = this.mode === 'new';
        
        // For existing records in view mode, always show the name
        if (!isNewRecord && this.mode === 'view') {
            return `
                <div class="form-group">
                    <label class="control-label">ID</label>
                    <div class="form-control-static">
                        ${this.escapeHtml(fieldValue) || '<em class="text-muted">No ID</em>'}
                    </div>
                </div>
            `;
        }
        
        // For new records, handle based on naming type
        if (isNewRecord) {
            switch (namingType) {
                case 'Set by user':
                    // Show editable name field for user input
                    return `
                        <div class="form-group">
                            <label class="control-label">
                                ID <span class="text-danger">*</span>
                                <small class="text-muted" style="font-size: 11px; margin-left: 8px;">
                                    <i class="fa fa-user" title="User-defined ID"></i> Custom ID required
                                </small>
                            </label>
                            <input type="text" 
                                   class="form-control" 
                                   name="name" 
                                   value="${this.escapeHtml(fieldValue)}"
                                   placeholder="Enter unique ID for this record"
                                   required>
                            <small class="help-text text-muted">Enter a unique identifier for this record</small>
                        </div>
                    `;
                    
                case 'By "Naming Series" field':
                    // Hide name field, will be auto-generated with prefix
                    return `
                        <div class="form-group" style="display: none;">
                            <small class="text-muted">
                                <i class="fa fa-magic"></i> ID will be auto-generated: ${this.naming_config.naming_prefix || 'PREFIX'}-00001
                            </small>
                        </div>
                    `;
                    
                case 'By fieldname':
                    // Hide name field, will be generated from another field
                    const fieldName = this.naming_config.naming_field || 'field';
                    return `
                        <div class="form-group" style="display: none;">
                            <small class="text-muted">
                                <i class="fa fa-link"></i> ID will be generated from: ${fieldName}
                            </small>
                        </div>
                    `;
                    
                case 'Random':
                    // Hide name field, will be auto-generated randomly
                    return `
                        <div class="form-group" style="display: none;">
                            <small class="text-muted">
                                <i class="fa fa-random"></i> ID will be auto-generated randomly
                            </small>
                        </div>
                    `;
                    
                case 'Autoincrement':
                default:
                    // Hide name field, will be auto-incremented
                    return `
                        <div class="form-group" style="display: none;">
                            <small class="text-muted">
                                <i class="fa fa-sort-numeric-asc"></i> ID will be auto-generated: 1, 2, 3...
                            </small>
                        </div>
                    `;
            }
        }
        
        // For existing records in edit mode, show as read-only
        return `
            <div class="form-group">
                <label class="control-label">ID</label>
                <div class="form-control-static" style="background: #f8f9fa; padding: 8px 12px; border-radius: 4px;">
                    ${this.escapeHtml(fieldValue)} <small class="text-muted">(cannot be changed)</small>
                </div>
            </div>
        `;
    }

    getLabelStyle(field) {
        // Simple clean label styling
        let style = `
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
            font-size: 13px;
            color: #495057;
        `;
        
        // Check if field has custom label styling from form builder
        if (field.form_config && field.form_config.label_style) {
            style += field.form_config.label_style;
        }
        
        // Add emphasis for required fields
        if (field.reqd || field.is_required) {
            style += `
                color: #dc3545;
                font-weight: 700;
            `;
        }
        
        return style;
    }
    
    getFieldContainerStyle(field) {
        // Simple clean container styling
        let style = `
            margin-bottom: 20px;
            padding: 12px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e9ecef;
            transition: all 0.2s ease;
        `;
        
        // Subtle left border for field type indication
        const fieldType = field.fieldtype || field.field_type;
        if (this.is_gallery_field(field)) {
            style += `border-left: 3px solid #6f42c1;`;
        } else if (fieldType === 'Long Text' || fieldType === 'Text Editor') {
            style += `border-left: 3px solid #17a2b8;`;
        } else if (fieldType === 'Date' || fieldType === 'Datetime') {
            style += `border-left: 3px solid #28a745;`;
        } else if (fieldType === 'Link') {
            style += `border-left: 3px solid #fd7e14;`;
        }
        
        // Check for custom container styling from form builder
        if (field.form_config && field.form_config.container_style) {
            style += field.form_config.container_style;
        }
        
        return style;
    }
    

    async render_link_field(field, fieldValue, fieldName) {
        const linkDoctype = field.options || field.link_doctype || '';
        const uniqueId = `link_field_${fieldName}_${Date.now()}`;
        
        if (!linkDoctype) {
            // Fallback to text input if no link doctype specified
            return `<input type="text" class="form-control" name="${fieldName}" value="${this.escapeHtml(fieldValue)}" placeholder="Link target not specified">`;
        }
        
        // Get display value for this link field
        const displayValue = await this.getDisplayValueForLinkField(field, fieldValue, linkDoctype);
        const showDisplayValue = displayValue !== fieldValue; // Only show display format if different from raw value
        
        // Debug logging
        console.log(`🔗 Link field ${fieldName}:`, {
            fieldValue,
            displayValue,
            showDisplayValue,
            linkDoctype
        });
        
        // Get table label for better user experience
        const tableLabel = await this.getTableLabelForDoctype(linkDoctype);
        
        // Create a container for Frappe's native link field
        return `
            <div class="frappe-link-field-container" data-link-doctype="${linkDoctype}" data-field-name="${fieldName}">
                <input type="text" 
                       class="form-control frappe-link-field" 
                       id="${uniqueId}"
                       name="${fieldName}" 
                       value="${this.escapeHtml(fieldValue)}" 
                       data-raw-value="${this.escapeHtml(fieldValue)}"
                       data-display-value="${this.escapeHtml(displayValue)}"
                       placeholder="Search ${tableLabel}..."
                       data-field-name="${fieldName}"
                       data-link-doctype="${linkDoctype}"
                       data-fieldtype="Link"
                       data-options="${linkDoctype}">
                ${showDisplayValue ? 
                    `<small class="text-success">Current: ${this.escapeHtml(displayValue)}</small>` :
                    `<small class="text-muted">Search and select from ${tableLabel} records</small>`
                }
            </div>
        `;
    }
    
    async getDisplayValueForLinkField(field, fieldValue, linkDoctype) {
        if (!fieldValue) {
            return '';
        }
        
        // Try to get display field configuration from Flansa Logic Field
        try {
            const logicFields = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Logic Field',
                    filters: {
                        table_name: this.table_name,
                        field_name: field.fieldname,
                        logic_type: 'link'
                    },
                    fields: ['link_display_field'],
                    limit_page_length: 1
                }
            });
            
            console.log(`📋 Logic field lookup result for ${field.fieldname}:`, logicFields);
            
            if (logicFields.message && logicFields.message.length > 0) {
                const logicField = logicFields.message[0];
                if (logicField.link_display_field) {
                    console.log(`✅ Found display field config: ${logicField.link_display_field} for ${field.fieldname}`);
                    // Fetch the display value from the linked record
                    console.log(`🎯 CALLING fetchDisplayValue with fieldValue: ${fieldValue}`);
                    const displayValue = await this.fetchDisplayValue(fieldValue, linkDoctype, logicField.link_display_field);
                    console.log(`🎯 Display value result for ${field.fieldname}:`, { displayValue, fallback: displayValue || fieldValue });
                    return displayValue || fieldValue; // Fallback to raw value if display value not found
                } else {
                    console.log(`⚠️  Logic field found but no display field configured for ${field.fieldname}`);
                }
            }
        } catch (error) {
            console.error('Error loading display field configuration:', error);
        }
        
        // No display field configured or error, return raw value
        return fieldValue;
    }
    
    async fetchDisplayValue(recordId, linkDoctype, displayField) {
        try {
            // Use get_list instead of get_value for better reliability
            const result = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: linkDoctype,
                    filters: { name: recordId },
                    fields: [displayField],
                    limit_page_length: 1
                }
            });
            
            if (result.message && result.message.length > 0 && result.message[0][displayField]) {
                return result.message[0][displayField];
            }
        } catch (error) {
            console.error(`Error fetching display value for ${recordId}:`, error);
        }
        
        return null;
    }
    
    async getTableLabelForDoctype(linkDoctype) {
        try {
            // First check if it's a Flansa Table by looking for a table with this DocType name
            const flansaTable = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    filters: { doctype_name: linkDoctype },
                    fields: ['table_label', 'name']
                }
            });
            
            if (flansaTable.message && flansaTable.message.length > 0) {
                const tableLabel = flansaTable.message[0].table_label;
                return tableLabel || linkDoctype; // Use table label if available
            }
            
            // If not a Flansa Table, try to get a more user-friendly name
            // For system DocTypes, just use the DocType name as is
            return linkDoctype;
            
        } catch (error) {
            console.error(`Error getting table label for ${linkDoctype}:`, error);
            return linkDoctype; // Fallback to DocType name
        }
    }
    
    async loadDisplayValueAsync(fieldName, recordId, linkDoctype, displayField) {
        try {
            // Fetch the linked record to get the display field value
            const result = await frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: linkDoctype,
                    name: recordId,
                    fieldname: displayField
                }
            });
            
            if (result.message && result.message[displayField]) {
                const displayValue = result.message[displayField];
                
                // Update the input field to show the display value
                const input = document.querySelector(`input[data-field-name="${fieldName}"][value="${recordId}"]`);
                if (input) {
                    input.setAttribute('data-display-value', displayValue);
                    // Show display value in the field but keep raw ID as the actual value
                    input.setAttribute('placeholder', `${displayValue} (${recordId})`);
                    
                    // If this is view mode, show the display value directly
                    if (this.mode === 'view') {
                        const container = input.closest('.form-group');
                        if (container) {
                            const displaySpan = container.querySelector('.field-value-display');
                            if (displaySpan) {
                                displaySpan.innerHTML = `${this.escapeHtml(displayValue)} <small class="text-muted">(${recordId})</small>`;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error loading display value for ${fieldName}:`, error);
        }
    }
    
    // Gallery rendering methods
    render_gallery_view(value) {
        if (!value) {
            return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No images uploaded</div>';
        }
        
        const images = this.parseGalleryData(value);
        if (images.length === 0) {
            return '<div class="text-muted" style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 4px;">No images found</div>';
        }
        
        let html = '<div class="gallery-view" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; max-height: 300px; overflow-y: auto;">';
        
        images.forEach((image, index) => {
            const imageUrl = this.safeImageUrl(image);
            if (imageUrl && imageUrl !== '/assets/frappe/images/default-avatar.png') {
                html += `
                    <div class="gallery-item" style="position: relative; aspect-ratio: 1; border-radius: 4px; overflow: hidden; border: 1px solid #eee;">
                        <img src="${imageUrl}" 
                             style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                             alt="Gallery image ${index + 1}"
                             onclick="window.recordViewer && window.recordViewer.show_image_lightbox(${index})"
                             title="Click to view full size"
                             onerror="this.src='/assets/frappe/images/default-avatar.png'">
                    </div>
                `;
            }
        });
        
        html += '</div>';
        html += `<div class="text-muted" style="margin-top: 8px; font-size: 12px;">${images.length} image(s) - Click to view full size</div>`;
        
        return html;
    }
    
    render_gallery_edit(value, fieldName) {
        let html = `
            <div class="gallery-edit-container" data-field-name="${fieldName}">
                <div class="gallery-controls" style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm btn-primary add-gallery-images">
                        <i class="fa fa-plus"></i> Add Images
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary clear-gallery">
                        <i class="fa fa-trash"></i> Clear All
                    </button>
                    <small class="text-muted">JPG, PNG, GIF supported • Click images to view or remove</small>
                </div>
                <div class="gallery-display-area">
                    ${this.render_gallery_edit_content(value, fieldName)}
                </div>
                <input type="hidden" name="${fieldName}" value="${this.escapeHtml(value || '')}">
                <input type="file" class="gallery-file-input" multiple accept="image/*" style="display: none;">
            </div>
        `;
        
        return html;
    }

    
    // Helper methods for gallery functionality
    parseGalleryData(value) {
        if (!value) return [];
        
        try {
            if (typeof value === 'string') {
                if (value.startsWith('[') && value.endsWith(']')) {
                    return JSON.parse(value);
                } else if (value.includes('\n')) {
                    // Handle newline-separated URLs
                    return value.split('\n').filter(url => url.trim()).map(url => ({
                        file_url: url.trim(),
                        file_name: url.trim().split('/').pop(),
                        description: 'Image'
                    }));
                } else if (value.trim()) {
                    // Single URL
                    return [{
                        file_url: value.trim(),
                        file_name: value.trim().split('/').pop(),
                        description: 'Image'
                    }];
                }
            } else if (Array.isArray(value)) {
                return value;
            }
        } catch (e) {
            console.error('Error parsing gallery data:', e);
        }
        
        return [];
    }
    
    safeImageUrl(image) {
        if (!image) return '/assets/frappe/images/default-avatar.png';
        
        let url = '';
        if (typeof image === 'object') {
            url = image.file_url || image.url || image.name || '';
        } else {
            url = String(image).trim();
        }
        
        if (!url) return '/assets/frappe/images/default-avatar.png';
        
        // Validate URL format
        if (url.includes('<') || url.includes('>')) {
            console.warn('Potentially unsafe image URL:', url);
            return '/assets/frappe/images/default-avatar.png';
        }
        
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        } else if (url.startsWith('/files/')) {
            return window.location.origin + url;
        } else if (url.startsWith('/assets/')) {
            return window.location.origin + url;
        } else if (url && !url.includes(' ')) {
            return window.location.origin + '/files/' + url;
        }
        
        return '/assets/frappe/images/default-avatar.png';
    }
    
    escapeJsString(str) {
        if (!str) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }
    
    bind_record_events() {
        console.log('🔗 Binding record events...');
        
        const content = document.getElementById('record-content');
        const actionsContainer = document.getElementById('record-actions');
        const page = document.querySelector('.flansa-record-viewer-page');
        
        console.log('Elements found:', { content: !!content, actionsContainer: !!actionsContainer, page: !!page });
        
        if (!content) {
            console.error('Record content not found!');
            return;
        }
        
        // Context menu binding is now handled by dedicated bind_context_menu_events() method
        console.log('Context menu binding delegated to dedicated method');
        
        // Legacy action bar compatibility (if any old elements exist)
        const legacyActionsContainer = document.getElementById('record-actions');
        if (legacyActionsContainer) {
            const editBtn = legacyActionsContainer.querySelector('.edit-record');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    console.log('Legacy edit button clicked!');
                    e.preventDefault();
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('mode', 'edit');
                    window.location.href = currentUrl.toString();
                });
            }
            
            // Save button
            const saveBtn = legacyActionsContainer.querySelector('.save-record');
            console.log('Save button found:', !!saveBtn);
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    console.log('Save button clicked!');
                    e.preventDefault();
                    this.save_record();
                });
            }
            
            // Cancel buttons
            const cancelEdit = legacyActionsContainer.querySelector('.cancel-edit');
            console.log('Cancel edit button found:', !!cancelEdit);
            if (cancelEdit) {
                cancelEdit.addEventListener('click', (e) => {
                    console.log('Cancel edit clicked!');
                    e.preventDefault();
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('mode', 'view');
                    window.location.href = currentUrl.toString();
                });
            }
            
            const cancelCreate = legacyActionsContainer.querySelector('.cancel-create');
            console.log('Cancel create button found:', !!cancelCreate);
            if (cancelCreate) {
                cancelCreate.addEventListener('click', (e) => {
                    console.log('Cancel create clicked!');
                    e.preventDefault();
                    frappe.set_route('flansa-report-viewer', this.table_name);
                });
            }
        } else {
            console.log('No legacy actions container found - using modern header actions');
        }
        
        // Bind navigation events (these are in the page container)
        if (page) {
            const backToListBtn = page.querySelector('.back-to-list');
            console.log('Back to list button found:', !!backToListBtn);
            if (backToListBtn) {
                backToListBtn.addEventListener('click', (e) => {
                    console.log('Back to list clicked!');
                    e.preventDefault();
                    frappe.set_route('flansa-report-viewer', this.table_name);
                });
            }
        }
        
        // Bind lightbox events for gallery images
        const lightboxImages = content.querySelectorAll('.gallery-lightbox-trigger, .gallery-view img, .gallery-edit-item img');
        console.log('Lightbox images found:', lightboxImages.length);
        lightboxImages.forEach(img => {
            img.addEventListener('click', (e) => {
                e.preventDefault();
                const imageUrl = img.src;
                console.log('Image clicked for lightbox:', imageUrl);
                this.show_image_lightbox(imageUrl);
            });
        });
        
        // Gallery event handlers (these are in the content area)
        this.bind_gallery_events(content);
        
        // Link field event handlers
        this.bind_link_field_events(content);
        
        console.log('✅ Event binding completed');
    }
    
    bind_gallery_events(content) {
        // Add Images button
        const addImagesBtns = content.querySelectorAll('.add-gallery-images');
        addImagesBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = btn.closest('.gallery-edit-container');
                const fieldName = container.dataset.fieldName;
                this.add_gallery_images(fieldName);
            });
        });
        
        // Clear All button
        const clearBtns = content.querySelectorAll('.clear-gallery');
        clearBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = btn.closest('.gallery-edit-container');
                const fieldName = container.dataset.fieldName;
                this.clear_gallery_images(fieldName);
            });
        });
        
        // Remove individual image buttons
        const removeBtns = content.querySelectorAll('.gallery-remove-image');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = btn.closest('.gallery-edit-container');
                const fieldName = container.dataset.fieldName;
                const imageIndex = parseInt(btn.dataset.imageIndex);
                this.remove_gallery_image(fieldName, imageIndex);
            });
        });
    }

    

    validate_form_data_before_save() {
        const content = document.getElementById('record-content');
        if (!content) return true;
        
        // Sync all Frappe link field values before saving
        const linkFields = content.querySelectorAll('.frappe-link-field');
        linkFields.forEach(input => {
            if (input._frappe_link_field) {
                const linkValue = input._frappe_link_field.get_value();
                input.value = linkValue;
                input.dataset.value = linkValue;
                console.log(`🔄 Pre-save sync for ${input.name}: ${linkValue}`);
            }
        });
        
        // Special validation for naming when user must provide ID
        if (this.mode === 'new' && this.naming_config && this.naming_config.naming_type === 'Set by user') {
            const nameInput = content.querySelector('input[name="name"]');
            if (!nameInput || !nameInput.value.trim()) {
                frappe.show_alert({
                    message: 'ID is required. Please enter a unique identifier for this record.',
                    indicator: 'red'
                });
                if (nameInput) {
                    nameInput.focus();
                }
                return false;
            }
            
            // Basic ID validation
            const nameValue = nameInput.value.trim();
            if (nameValue.length < 3) {
                frappe.show_alert({
                    message: 'ID must be at least 3 characters long.',
                    indicator: 'red'
                });
                nameInput.focus();
                return false;
            }
            
            // Check for invalid characters (basic check)
            if (!/^[a-zA-Z0-9_-]+$/.test(nameValue)) {
                frappe.show_alert({
                    message: 'ID can only contain letters, numbers, underscores, and hyphens.',
                    indicator: 'red'
                });
                nameInput.focus();
                return false;
            }
        }
        
        return true;
    }
    
    save_record() {
        // Validate and sync form data before saving
        if (!this.validate_form_data_before_save()) {
            return;
        }
        
        const formData = this.collect_form_data();
        
        console.log('💾 Saving record with form data:', formData);
        frappe.show_alert({
            message: 'Saving record...',
            indicator: 'blue'
        });
        
        if (this.mode === 'new') {
            // Create new record
            frappe.call({
                method: 'flansa.flansa_core.api.table_api.create_record',
                args: {
                    table_name: this.table_name,
                    values: formData
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert({
                            message: 'Record created successfully',
                            indicator: 'green'
                        });
                        
                        // Redirect to view mode of the newly created record
                        const newRecordId = response.message.record_name || response.message.name;
                        if (newRecordId) {
                            window.location.href = `/app/flansa-record-viewer/${this.table_name}/${newRecordId}?mode=view`;
                        } else {
                            // Fallback: redirect to the table's report view if no record ID returned
                            window.location.href = `/app/flansa-report-viewer/${this.table_name}?type=table`;
                        }
                    } else {
                        frappe.show_alert({
                            message: 'Failed to create record: ' + (response.message?.error || 'Unknown error'),
                            indicator: 'red'
                        });
                    }
                },
                error: (error) => {
                    console.error('Error creating record:', error);
                    frappe.show_alert({
                        message: 'Error creating record',
                        indicator: 'red'
                    });
                }
            });
        } else {
            // Update existing record
            frappe.call({
                method: 'flansa.flansa_core.api.table_api.update_record',
                args: {
                    table_name: this.table_name,
                    record_name: this.record_id,
                    values: formData
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert({
                            message: 'Record updated successfully',
                            indicator: 'green'
                        });
                        
                        // Switch to view mode of the current record
                        window.location.href = `/app/flansa-record-viewer/${this.table_name}/${this.record_id}?mode=view`;
                    } else {
                        frappe.show_alert({
                            message: 'Failed to update record: ' + (response.message?.error || 'Unknown error'),
                            indicator: 'red'
                        });
                    }
                },
                error: (error) => {
                    console.error('Error updating record:', error);
                    frappe.show_alert({
                        message: 'Error updating record',
                        indicator: 'red'
                    });
                }
            });
        }
    }
    
    cancel_edit() {
        // Handle cancel action based on current mode
        if (this.mode === 'new') {
            // For new records, go back to previous page or table report
            if (window.history.length > 1) {
                window.history.back();
            } else {
                // Fallback: redirect to the table's report view
                window.location.href = `/app/flansa-report-viewer/${this.table_name}?type=table`;
            }
        } else if (this.mode === 'edit') {
            // For edit mode, switch back to view mode
            const currentUrl = new URL(window.location);
            currentUrl.searchParams.set('mode', 'view');
            window.location.href = currentUrl.toString();
        }
    }
    
    collect_form_data() {
        const formData = {};
        const content = document.getElementById('record-content');
        if (!content) return formData;
        
        const inputs = content.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    formData[input.name] = input.checked ? 1 : 0;
                } else if (input.classList.contains('frappe-link-field')) {
                    // Handle Frappe link fields specially
                    if (input._frappe_link_field) {
                        // Get value from the Frappe control
                        const linkValue = input._frappe_link_field.get_value();
                        formData[input.name] = linkValue || input.value;
                        console.log(`📊 Collecting link field ${input.name}: ${formData[input.name]}`);
                    } else {
                        // For link fields with display values, use the raw ID value
                        if (input.dataset.rawValue) {
                            formData[input.name] = input.dataset.rawValue;
                            console.log(`📊 Collecting link field ${input.name}: ${formData[input.name]} (using raw value)`);
                        } else {
                            formData[input.name] = input.dataset.value || input.value;
                            console.log(`📊 Collecting link field ${input.name}: ${formData[input.name]} (fallback)`);
                        }
                    }
                } else {
                    formData[input.name] = input.value;
                }
            }
        });
        
        console.log('📊 Collected form data:', formData);
        return formData;
    }
    

    // Gallery action methods
    add_gallery_images(fieldName) {
        console.log('🖼️ Adding images to gallery field:', fieldName);
        
        // Create file input dialog
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            this.upload_gallery_images(fieldName, files);
        });
        
        fileInput.click();
    }
    
    async upload_gallery_images(fieldName, files) {
        console.log(`📤 Uploading ${files.length} images for field:`, fieldName);
        
        try {
            frappe.show_alert({
                message: `Uploading ${files.length} image(s)...`,
                indicator: 'blue'
            });
            
            const uploadedImages = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`Uploading file ${i + 1}:`, file.name);
                
                const uploadResult = await this.upload_single_file(file);
                if (uploadResult && uploadResult.file_url) {
                    uploadedImages.push({
                        file_url: uploadResult.file_url,
                        file_name: uploadResult.file_name || file.name,
                        description: 'Gallery Image'
                    });
                }
            }
            
            if (uploadedImages.length > 0) {
                // Get current gallery data
                const currentValue = this.record_data[fieldName] || '';
                const currentImages = this.parseGalleryData(currentValue);
                
                // Add new images
                const allImages = [...currentImages, ...uploadedImages];
                
                // Update the field value
                const newValue = JSON.stringify(allImages);
                this.record_data[fieldName] = newValue;
                
                // Update the hidden input
                const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
                if (hiddenInput) {
                    hiddenInput.value = newValue;
                }
                
                // Re-render the gallery
                this.refresh_gallery_display(fieldName, newValue);
                
                frappe.show_alert({
                    message: `Successfully uploaded ${uploadedImages.length} image(s)`,
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Error uploading images:', error);
            frappe.show_alert({
                message: 'Error uploading images: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    upload_single_file(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('is_private', 0);
            formData.append('folder', 'Home/Attachments');
            formData.append('doctype', this.doctype_name || '');
            formData.append('docname', this.record_id || '');
            
            // Use the correct Frappe upload API endpoint
            fetch('/api/method/upload_file', {
                method: 'POST',
                headers: {
                    'X-Frappe-CSRF-Token': frappe.csrf_token
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    resolve(data.message);
                } else {
                    reject(new Error('Upload failed - no response'));
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                reject(error);
            });
        });
    }


    
    async clear_gallery_images(fieldName) {
        console.log('🧹 Clearing gallery field:', fieldName);
        
        const currentValue = this.record_data[fieldName] || '';
        const images = this.parseGalleryData(currentValue);
        
        if (images.length === 0) {
            frappe.show_alert({
                message: 'Gallery is already empty',
                indicator: 'blue'
            });
            return;
        }
        
        // Show confirmation dialog
        const confirmDelete = await new Promise((resolve) => {
            frappe.confirm(
                `Are you sure you want to delete all ${images.length} images? This action cannot be undone.`,
                () => resolve(true),
                () => resolve(false)
            );
        });
        
        if (!confirmDelete) return;
        
        try {
            frappe.show_alert({
                message: `Deleting ${images.length} images...`,
                indicator: 'blue'
            });
            
            // Clear the field value
            this.record_data[fieldName] = '';
            
            // Update the hidden input
            const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
            if (hiddenInput) {
                hiddenInput.value = '';
            }
            
            // Re-render the gallery
            this.refresh_gallery_display(fieldName, '');
            
            frappe.show_alert({
                message: 'Gallery cleared successfully',
                indicator: 'green'
            });
            
        } catch (error) {
            console.error('Error clearing gallery:', error);
            frappe.show_alert({
                message: 'Error clearing gallery: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    async remove_gallery_image(fieldName, imageIndex) {
        console.log(`🗑️ Removing image ${imageIndex} from field:`, fieldName);
        
        try {
            const currentValue = this.record_data[fieldName] || '';
            const images = this.parseGalleryData(currentValue);
            
            if (imageIndex < 0 || imageIndex >= images.length) {
                frappe.show_alert({
                    message: 'Invalid image index',
                    indicator: 'red'
                });
                return;
            }
            
            // Remove the image from the array
            images.splice(imageIndex, 1);
            
            // Update the field value
            const newValue = images.length > 0 ? JSON.stringify(images) : '';
            this.record_data[fieldName] = newValue;
            
            // Update the hidden input
            const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
            if (hiddenInput) {
                hiddenInput.value = newValue;
            }
            
            // Re-render the gallery
            this.refresh_gallery_display(fieldName, newValue);
            
            frappe.show_alert({
                message: 'Image removed successfully',
                indicator: 'green'
            });
            
        } catch (error) {
            console.error('Error removing image:', error);
            frappe.show_alert({
                message: 'Error removing image: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    refresh_gallery_display(fieldName, newValue) {
        const container = document.querySelector(`.gallery-edit-container[data-field-name="${fieldName}"]`);
        if (!container) return;
        
        const displayArea = container.querySelector('.gallery-display-area');
        if (!displayArea) return;
        
        // Re-render the gallery content
        const galleryHtml = this.render_gallery_edit_content(newValue, fieldName);
        displayArea.innerHTML = galleryHtml;
        
        // Rebind events for the new content
        this.bind_gallery_events(container);
    }
    
    render_gallery_edit_content(value, fieldName) {
        if (!value) {
            return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No images uploaded yet. Click "Add Images" to start.</div>';
        }
        
        const images = this.parseGalleryData(value);
        if (images.length === 0) {
            return '<div class="gallery-empty text-muted" style="padding: 40px; text-align: center; border: 2px dashed #ddd; border-radius: 8px; background: #fafafa;">No images found</div>';
        }
        
        let html = '<div class="gallery-edit-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: white;">';
        
        images.forEach((image, index) => {
            const imageUrl = this.safeImageUrl(image);
            if (imageUrl && imageUrl !== '/assets/frappe/images/default-avatar.png') {
                html += `
                    <div class="gallery-edit-item" style="position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden; border: 1px solid #eee; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <img src="${imageUrl}" 
                             style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" 
                             alt="Gallery image ${index + 1}"
                             onclick="window.recordViewer && window.recordViewer.show_image_lightbox(${index})"
                             title="Click to view full size"
                             onerror="this.src='/assets/frappe/images/default-avatar.png'">
                        <div class="gallery-item-actions" style="position: absolute; top: 5px; right: 5px;">
                            <button type="button" class="gallery-remove-image" data-image-index="${index}" 
                                    style="background: rgba(220,53,69,0.95); border: 1px solid #dc3545; color: white; border-radius: 50%; width: 28px; height: 28px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
                                    title="Remove image">
                                <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        html += `<div class="text-muted mt-2" style="font-size: 12px;">${images.length} image(s) - Click <i class="fa fa-trash"></i> to remove</div>`;
        
        return html;
    }
    
// Organize fields into sections using only form builder configuration
    organize_fields_into_sections(fields) {
        // If we have form builder sections, use only those fields
        if (this.form_sections && this.form_sections.length > 0) {
            console.log('📋 Using form builder sections exclusively');
            return this.organize_fields_with_form_config(fields);
        }
        
        // If no form builder configuration, show empty state
        console.log('📋 No form builder configuration - showing empty state');
        return [];
    }
    
    organize_fields_with_form_config(fields) {
        const sections = [];
        let currentSection = null;
        
        // Create field lookup for quick access
        const fieldLookup = {};
        fields.forEach(field => {
            fieldLookup[field.fieldname] = field;
        });
        
        this.form_sections.forEach(sectionField => {
            if (sectionField.is_layout_element && sectionField.layout_type === 'Section Break') {
                // Start new section
                if (currentSection && currentSection.fields.length > 0) {
                    sections.push(currentSection);
                }
                
                currentSection = {
                    title: sectionField.field_label || 'Section',
                    icon: this.getSectionIcon(sectionField.field_label),
                    columns: this.getSectionColumns(sectionField),
                    column_count: sectionField.column_count,
                    column_layout: sectionField.column_layout,
                    fields: []
                };
            } else if (sectionField.is_layout_element && sectionField.layout_type === 'Column Break') {
                // Handle column breaks within sections (visual hint for responsive layout)
                if (currentSection) {
                    currentSection.has_column_break = true;
                }
            } else if (sectionField.field_name && fieldLookup[sectionField.field_name]) {
                // Add field to current section
                if (!currentSection) {
                    currentSection = {
                        title: 'Basic Information',
                        icon: 'info-circle',
                        columns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        fields: []
                    };
                }
                
                // Use the actual field from the table with form builder customizations
                const actualField = fieldLookup[sectionField.field_name];
                const configuredField = {
                    ...actualField,
                    // Apply form builder customizations if any
                    label: sectionField.field_label || actualField.label,
                    description: sectionField.description || actualField.description,
                    form_config: sectionField // Store form config for advanced features
                };
                
                currentSection.fields.push(configuredField);
            }
        });
        
        // Add the last section
        if (currentSection && currentSection.fields.length > 0) {
            sections.push(currentSection);
        }
        
        return sections;
    }
    
    getSectionIcon(sectionTitle) {
        if (!sectionTitle) return 'folder-o';
        
        const title = sectionTitle.toLowerCase();
        if (title.includes('basic') || title.includes('general')) return 'info-circle';
        if (title.includes('contact') || title.includes('personal')) return 'user';
        if (title.includes('address') || title.includes('location')) return 'map-marker';
        if (title.includes('financial') || title.includes('payment')) return 'credit-card';
        if (title.includes('date') || title.includes('time')) return 'calendar';
        if (title.includes('attachment') || title.includes('media') || title.includes('image')) return 'paperclip';
        if (title.includes('additional') || title.includes('other')) return 'plus-circle';
        if (title.includes('related') || title.includes('reference')) return 'link';
        
        return 'folder-o';
    }
    
    getSectionColumns(sectionField) {
        // First check if the specific section has column_count configured
        if (sectionField && sectionField.column_count) {
            const columnCount = parseInt(sectionField.column_count);
            if (columnCount === 1) {
                return '1fr';
            } else if (columnCount === 2) {
                return 'repeat(2, 1fr)';
            } else if (columnCount === 3) {
                return 'repeat(3, 1fr)';
            } else if (columnCount > 3) {
                return `repeat(${columnCount}, 1fr)`;
            }
        }
        
        // Check if section has custom column_layout CSS
        if (sectionField && sectionField.column_layout) {
            return sectionField.column_layout;
        }
        
        // Fall back to global form config
        if (this.form_config && this.form_config.column_layout === 'two-column') {
            return 'repeat(2, 1fr)';
        } else if (this.form_config && this.form_config.column_layout === 'three-column') {
            return 'repeat(3, 1fr)';
        } else if (this.form_config && this.form_config.column_layout === 'single') {
            return '1fr';
        }
        
        // Default responsive grid
        return 'repeat(auto-fit, minmax(300px, 1fr))';
    }

    update_status(message) {
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
    
    show_image_lightbox(startingIndex = 0) {
        const allImages = this.getAllImagesFromCurrentRecord();
        if (!allImages || allImages.length === 0) {
            console.log('No images found for lightbox');
            return;
        }
        
        console.log('📷 Showing advanced lightbox, starting at index:', startingIndex);
        
        // Create lightbox HTML
        const lightboxHtml = `
            <div class="image-lightbox-overlay" id="record-image-lightbox" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.2s ease;
            ">
                <div class="lightbox-content" style="
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                ">
                    <div class="lightbox-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 15px 20px;
                        background: rgba(0, 0, 0, 0.8);
                        color: white;
                    ">
                        <span class="lightbox-title" style="font-weight: 600; font-size: 16px;">${this.record_id || 'Image Gallery'}</span>
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <span class="lightbox-counter" style="font-size: 14px; color: rgba(255,255,255,0.8);">
                                <span class="current-img">1</span> / <span class="total-imgs">${allImages.length}</span>
                            </span>
                            <button class="lightbox-close" title="Close (Esc)" style="
                                background: none;
                                border: none;
                                color: white;
                                font-size: 20px;
                                cursor: pointer;
                                padding: 5px;
                            ">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="lightbox-body" style="
                        flex: 1;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        position: relative;
                        padding: 20px;
                    ">
                        <div class="lightbox-image-container" style="
                            position: relative;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            max-width: 100%;
                            max-height: 100%;
                        ">
                            <img src="" alt="Image" class="lightbox-image" id="record-lightbox-img" style="
                                max-width: 100%;
                                max-height: 100%;
                                object-fit: contain;
                                border-radius: 8px;
                                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                                transition: opacity 0.1s ease;
                            ">
                            ${allImages.length > 1 ? `
                                <button class="lightbox-nav lightbox-prev" title="Previous (←)" style="
                                    position: absolute;
                                    left: -60px;
                                    top: 50%;
                                    transform: translateY(-50%);
                                    background: rgba(255, 255, 255, 0.9);
                                    border: none;
                                    border-radius: 50%;
                                    width: 50px;
                                    height: 50px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 18px;
                                    color: #333;
                                    transition: all 0.2s ease;
                                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                                ">
                                    <i class="fa fa-chevron-left"></i>
                                </button>
                                <button class="lightbox-nav lightbox-next" title="Next (→)" style="
                                    position: absolute;
                                    right: -60px;
                                    top: 50%;
                                    transform: translateY(-50%);
                                    background: rgba(255, 255, 255, 0.9);
                                    border: none;
                                    border-radius: 50%;
                                    width: 50px;
                                    height: 50px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 18px;
                                    color: #333;
                                    transition: all 0.2s ease;
                                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                                ">
                                    <i class="fa fa-chevron-right"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing lightbox
        const existing = document.getElementById('record-image-lightbox');
        if (existing) {
            existing.remove();
        }
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', lightboxHtml);
        const lightbox = document.getElementById('record-image-lightbox');
        
        // Store current state
        this.lightbox_images = allImages;
        this.lightbox_current_index = startingIndex;
        
        // Bind events
        this.bind_lightbox_events();
        
        // Show lightbox and load starting image
        setTimeout(() => {
            lightbox.style.opacity = '1';
            document.getElementById('record-lightbox-img').src = allImages[startingIndex];
            document.querySelector('#record-image-lightbox .current-img').textContent = startingIndex + 1;
            document.body.style.overflow = 'hidden';
        }, 10);
    }
    
    getAllImagesFromCurrentRecord() {
        const images = [];
        
        // Get all image fields from current record
        if (this.record_data) {
            Object.keys(this.record_data).forEach(fieldName => {
                const value = this.record_data[fieldName];
                if (value && typeof value === 'string') {
                    // Check if it's an attachment field with images
                    if (value.includes('[') || value.includes('http') || value.includes('/files/')) {
                        const fieldImages = this.parseGalleryData(value);
                        fieldImages.forEach(img => {
                            const imageUrl = this.safeImageUrl(img);
                            if (imageUrl && imageUrl !== '/assets/frappe/images/default-avatar.png' && !images.includes(imageUrl)) {
                                images.push(imageUrl);
                            }
                        });
                    }
                }
            });
        }
        
        return images;
    }
    
    bind_lightbox_events() {
        const lightbox = document.getElementById('record-image-lightbox');
        if (!lightbox) return;
        
        // Close events
        lightbox.querySelector('.lightbox-close').addEventListener('click', () => this.close_lightbox());
        
        // Click outside to close (but not on image)
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-body') || e.target.classList.contains('lightbox-image-container')) {
                this.close_lightbox();
            }
        });
        
        // Navigation events
        const prevBtn = lightbox.querySelector('.lightbox-prev');
        const nextBtn = lightbox.querySelector('.lightbox-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigate_lightbox(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigate_lightbox(1));
        }
        
        // Keyboard events
        this.lightbox_keydown_handler = (e) => {
            switch(e.key) {
                case 'Escape':
                    this.close_lightbox();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigate_lightbox(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigate_lightbox(1);
                    break;
            }
        };
        
        document.addEventListener('keydown', this.lightbox_keydown_handler);
    }
    
    navigate_lightbox(direction) {
        if (!this.lightbox_images || this.lightbox_images.length <= 1) return;
        
        let newIndex = this.lightbox_current_index + direction;
        
        // Handle wraparound
        if (newIndex < 0) {
            newIndex = this.lightbox_images.length - 1;
        } else if (newIndex >= this.lightbox_images.length) {
            newIndex = 0;
        }
        
        this.lightbox_current_index = newIndex;
        
        // Update image with fade effect
        const img = document.getElementById('record-lightbox-img');
        if (img) {
            img.style.opacity = '0';
            setTimeout(() => {
                img.src = this.lightbox_images[newIndex];
                img.style.opacity = '1';
            }, 100);
        }
        
        // Update counter
        const currentImg = document.querySelector('#record-image-lightbox .current-img');
        if (currentImg) {
            currentImg.textContent = newIndex + 1;
        }
    }
    
    close_lightbox() {
        const lightbox = document.getElementById('record-image-lightbox');
        if (lightbox) {
            lightbox.style.opacity = '0';
            setTimeout(() => {
                lightbox.remove();
                document.body.style.overflow = '';
            }, 200);
        }
        
        // Clean up event handlers
        if (this.lightbox_keydown_handler) {
            document.removeEventListener('keydown', this.lightbox_keydown_handler);
            this.lightbox_keydown_handler = null;
        }
    }

    // Apply custom CSS from form builder configuration
    apply_form_builder_styles() {
        if (this.form_config && this.form_config.custom_css) {
            // Remove any existing form builder styles
            const existingStyle = document.getElementById('form-builder-custom-css');
            if (existingStyle) {
                existingStyle.remove();
            }
            
            // Add new custom styles
            const styleElement = document.createElement('style');
            styleElement.id = 'form-builder-custom-css';
            styleElement.textContent = this.form_config.custom_css;
            try {
                document.head.appendChild(styleElement);
                console.log('🎨 Applied custom CSS from form builder');
            } catch (error) {
                console.error('Error applying custom CSS:', error);
            }
        }
    }
    


    bind_link_field_events(content) {
        // Initialize Frappe's native link fields
        const linkInputs = content.querySelectorAll('.frappe-link-field');
        linkInputs.forEach(async (input) => {
            await this.init_frappe_link_field(input);
        });
    }
    
    async init_frappe_link_field(input) {
        const linkDoctype = input.dataset.linkDoctype;
        const fieldName = input.dataset.fieldName;
        
        if (!linkDoctype || !window.frappe) return;
        
        try {
            console.log(`🔍 Initializing link field: ${fieldName} -> ${linkDoctype}`);
            
            // Check if this field has display field configuration
            const displayFieldConfig = await this.getDisplayFieldConfig(fieldName);
            
            // Create Frappe link field using frappe.ui.form.make_control
            let fieldDef = {
                fieldtype: 'Link',
                fieldname: fieldName,
                options: linkDoctype,
                placeholder: `Search ${linkDoctype}...`
            };
            
            // If display field is configured, add custom query to field definition
            if (displayFieldConfig && displayFieldConfig.link_display_field) {
                console.log(`🎯 Adding custom query to field definition`);
                fieldDef.get_query = () => {
                    console.log(`🎯 Field def get_query called for ${fieldName}`);
                    return {
                        query: 'flansa.flansa_core.api.link_search.search_with_display_field',
                        filters: {
                            'display_field': displayFieldConfig.link_display_field,
                            'doctype': linkDoctype
                        }
                    };
                };
            }
            
            const linkField = frappe.ui.form.make_control({
                df: fieldDef,
                parent: input.parentElement,
                render_input: true
            });
            
            // If display field is configured, override the search behavior
            if (displayFieldConfig && displayFieldConfig.link_display_field) {
                console.log(`🎯 Found display field config: ${displayFieldConfig.link_display_field}`);
                this.customizeLinkFieldSearch(linkField, linkDoctype, displayFieldConfig.link_display_field);
            } else {
                console.log(`ℹ️ No display field configuration found for ${fieldName}`);
            }
            
            // Set initial value
            if (input.value) {
                linkField.set_input(input.value);
                linkField.set_value(input.value);
            }
            
            // Store reference to the link field on the input for later access
            input._frappe_link_field = linkField;
            
            // Hide the original input and show the Frappe control
            input.style.display = 'none';
            
            // Handle value changes with multiple event types
            const updateValue = () => {
                const newValue = linkField.get_value();
                input.value = newValue;
                input.dataset.value = newValue; // Store in data attribute as well
                
                // Trigger both change and input events for better compatibility
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log(`🔄 Link field ${fieldName} value updated to: ${newValue}`);
            };
            
            // Bind to multiple events to catch all value changes
            linkField.$input.on('change', updateValue);
            linkField.$input.on('awesomplete-selectcomplete', updateValue);
            linkField.$input.on('blur', updateValue);
            
            // Also bind to the link field's change event if available
            if (linkField.change) {
                linkField.change = function() {
                    updateValue();
                };
            }
            
            console.log(`✅ Initialized Frappe link field for ${fieldName} -> ${linkDoctype}`);
            
        } catch (error) {
            console.warn('Failed to initialize Frappe link field, falling back to simple input:', error);
            // Fallback: add basic autocomplete
            this.add_basic_link_autocomplete(input);
        }
    }
    
    add_basic_link_autocomplete(input) {
        const linkDoctype = input.dataset.linkDoctype;
        
        // Add basic search functionality
        let searchTimeout;
        input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.suggest_link_values(e.target);
            }, 300);
        });
    }
    
    async suggest_link_values(input) {
        const linkDoctype = input.dataset.linkDoctype;
        const searchTerm = input.value;
        
        if (!searchTerm || searchTerm.length < 2) return;
        
        try {
            // Check if this field has a display field configured
            const fieldName = input.dataset.fieldName;
            const displayFieldConfig = await this.getDisplayFieldConfig(fieldName);
            
            if (displayFieldConfig && displayFieldConfig.link_display_field) {
                // Use enhanced search with display values
                const response = await this.searchWithDisplayValues(linkDoctype, searchTerm, displayFieldConfig.link_display_field);
                if (response && response.length > 0) {
                    this.show_enhanced_link_suggestions(input, response, displayFieldConfig.link_display_field);
                }
            } else {
                // Fallback to Frappe's native search API
                const response = await frappe.call({
                    method: 'frappe.desk.search.search_link',
                    args: {
                        doctype: linkDoctype,
                        txt: searchTerm,
                        page_length: 10
                    }
                });
                
                if (response.message && response.message.length > 0) {
                    this.show_link_suggestions(input, response.message);
                }
            }
        } catch (error) {
            console.warn('Error fetching link suggestions:', error);
        }
    }
    
    customizeLinkFieldSearch(linkField, linkDoctype, displayField) {
        console.log(`🎯 Creating custom dropdown for ${linkField.df.fieldname}`);
        
        // Hide the original Frappe awesomplete dropdown
        if (linkField.awesomplete && linkField.awesomplete.ul) {
            linkField.awesomplete.ul.style.display = 'none';
        }
        
        // Create our custom dropdown container
        this.createCustomDropdown(linkField, linkDoctype, displayField);
        
        console.log(`✅ Custom dropdown created for ${linkField.df.fieldname}`);
    }
    
    createCustomDropdown(linkField, linkDoctype, displayField) {
        const input = linkField.$input[0];
        const container = input.parentElement;
        
        // Create dropdown container with clear button
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'flansa-custom-dropdown';
        dropdownContainer.innerHTML = `
            <div class="dropdown-clear-btn" title="Clear selection" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>
            <div class="dropdown-list" style="display: none;">
                <div class="dropdown-loading">Searching...</div>
            </div>
        `;
        
        container.appendChild(dropdownContainer);
        const dropdownList = dropdownContainer.querySelector('.dropdown-list');
        const loadingEl = dropdownContainer.querySelector('.dropdown-loading');
        const clearBtn = dropdownContainer.querySelector('.dropdown-clear-btn');
        
        let searchTimeout;
        let currentSelectedIndex = -1;
        
        // Show/hide clear button based on input value
        const updateClearButton = () => {
            if (input.value && input.value.trim()) {
                clearBtn.style.display = 'block';
            } else {
                clearBtn.style.display = 'none';
            }
        };
        
        // Handle clear button click
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log(`🗑️ Clearing selection`);
            
            input.value = '';
            linkField.set_value('');
            this.hideCustomDropdown(dropdownList);
            updateClearButton();
            
            // Trigger change events
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.focus();
        });
        
        // Update clear button on input changes
        input.addEventListener('input', updateClearButton);
        
        // Initial clear button state
        updateClearButton();
        
        // Handle focus event to show initial suggestions
        input.addEventListener('focus', (e) => {
            console.log(`🔍 Custom dropdown focus - showing initial suggestions`);
            
            // Show loading
            this.showCustomDropdown(dropdownList, input);
            dropdownList.innerHTML = '<div class="dropdown-loading">Loading suggestions...</div>';
            
            // Load initial suggestions (first 10 records)
            setTimeout(async () => {
                await this.performCustomSearch('', linkDoctype, displayField, dropdownList, input, linkField);
            }, 100);
        });
        
        // Handle input events
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            console.log(`🔍 Custom dropdown search: "${query}"`);
            
            // Clear previous timeout
            clearTimeout(searchTimeout);
            
            // Show loading
            this.showCustomDropdown(dropdownList, input);
            loadingEl.style.display = 'block';
            dropdownList.innerHTML = '<div class="dropdown-loading">Searching...</div>';
            
            // Debounce search
            searchTimeout = setTimeout(async () => {
                await this.performCustomSearch(query, linkDoctype, displayField, dropdownList, input, linkField);
            }, 300);
        });
        
        // Handle keyboard navigation
        input.addEventListener('keydown', (e) => {
            const items = dropdownList.querySelectorAll('.dropdown-item:not(.dropdown-loading)');
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    currentSelectedIndex = Math.min(currentSelectedIndex + 1, items.length - 1);
                    this.updateSelection(items, currentSelectedIndex);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    currentSelectedIndex = Math.max(currentSelectedIndex - 1, -1);
                    this.updateSelection(items, currentSelectedIndex);
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (currentSelectedIndex >= 0 && items[currentSelectedIndex]) {
                        this.selectCustomDropdownItem(items[currentSelectedIndex], input, linkField, dropdownList);
                    }
                    break;
                    
                case 'Escape':
                    this.hideCustomDropdown(dropdownList);
                    break;
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.hideCustomDropdown(dropdownList);
            }
        });
    }
    
    async performCustomSearch(query, linkDoctype, displayField, dropdownList, input, linkField) {
        try {
            console.log(`🎯 Performing search: ${query} in ${linkDoctype}.${displayField}`);
            
            const response = await frappe.call({
                method: 'flansa.flansa_core.api.link_search.search_with_display_field',
                args: {
                    doctype: linkDoctype,
                    txt: query,
                    searchfield: 'name',
                    start: 0,
                    page_len: 10,
                    filters: {
                        'display_field': displayField,
                        'doctype': linkDoctype
                    }
                }
            });
            
            const results = response.message || [];
            console.log(`✅ Search results:`, results);
            
            // Clear loading and populate results
            dropdownList.innerHTML = '';
            
            // Add existing results first
            results.forEach((result, index) => {
                const [value, label, description] = result;
                
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.dataset.value = value;
                item.innerHTML = `
                    <div class="dropdown-item-main">${label}</div>
                    <div class="dropdown-item-description">${description}</div>
                `;
                
                item.addEventListener('click', () => {
                    this.selectCustomDropdownItem(item, input, linkField, dropdownList);
                });
                
                dropdownList.appendChild(item);
            });
            
            // Add separator before "Create New" if we have results
            if (results.length > 0) {
                const separator = document.createElement('div');
                separator.className = 'dropdown-separator';
                dropdownList.appendChild(separator);
            }
            
            // Always add "Create New" option at the end
            const createText = query && query.trim() ? query : 'New Record';
            const createNewItem = document.createElement('div');
            createNewItem.className = 'dropdown-item dropdown-create-new';
            createNewItem.innerHTML = `
                <div class="dropdown-item-main">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: text-bottom;">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    ${query && query.trim() ? `Create "${query}"` : `Create New ${this.getDocTypeDisplayName(linkDoctype)}`}
                </div>
                <div class="dropdown-item-description">Opens form in new tab</div>
            `;
            
            createNewItem.addEventListener('click', async () => {
                await this.createNewLinkedRecord(linkDoctype, createText, input, linkField, dropdownList);
            });
            
            dropdownList.appendChild(createNewItem);
            
            // Show message only if no results and no query (initial state)
            if (results.length === 0 && (!query || !query.trim())) {
                // Replace the dropdown content with just the message and create option
                dropdownList.innerHTML = '<div class="dropdown-no-results">Start typing to search or select from options</div>';
                
                // Add separator
                const separator = document.createElement('div');
                separator.className = 'dropdown-separator';
                dropdownList.appendChild(separator);
                
                // Re-add the create new option
                const createNewItem = document.createElement('div');
                createNewItem.className = 'dropdown-item dropdown-create-new';
                createNewItem.innerHTML = `
                    <div class="dropdown-item-main">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: text-bottom;">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Create New ${this.getDocTypeDisplayName(linkDoctype)}
                    </div>
                    <div class="dropdown-item-description">Opens form in new tab</div>
                `;
                
                createNewItem.addEventListener('click', async () => {
                    await this.createNewLinkedRecord(linkDoctype, 'New Record', input, linkField, dropdownList);
                });
                
                dropdownList.appendChild(createNewItem);
            }
            
        } catch (error) {
            console.error('❌ Search error:', error);
            dropdownList.innerHTML = '<div class="dropdown-error">Search failed</div>';
        }
    }
    
    selectCustomDropdownItem(item, input, linkField, dropdownList) {
        const value = item.dataset.value;
        const label = item.querySelector('.dropdown-item-main').textContent;
        
        console.log(`✅ Selected: ${value} (${label})`);
        
        // Update input value
        input.value = value;
        linkField.set_value(value);
        
        // Hide dropdown
        this.hideCustomDropdown(dropdownList);
        
        // Trigger change events
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    showCustomDropdown(dropdownList, input) {
        const inputRect = input.getBoundingClientRect();
        
        dropdownList.style.display = 'block';
        dropdownList.style.position = 'fixed';
        dropdownList.style.top = (inputRect.bottom + 2) + 'px';
        dropdownList.style.left = inputRect.left + 'px';
        dropdownList.style.minWidth = inputRect.width + 'px';
        dropdownList.style.zIndex = '9999';
    }
    
    hideCustomDropdown(dropdownList) {
        dropdownList.style.display = 'none';
    }
    
    updateSelection(items, selectedIndex) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }
    
    getDocTypeDisplayName(linkDoctype) {
        // Convert DocType name to user-friendly display name
        // e.g., "FLS_0kb10t59kc_f41h2vd9_gljvedbl" -> "Category"
        if (linkDoctype.includes('_')) {
            // For generated DocTypes, try to get a friendly name
            return "record";
        }
        return linkDoctype.replace(/([A-Z])/g, ' $1').trim();
    }
    
    async createNewLinkedRecord(linkDoctype, suggestedName, input, linkField, dropdownList) {
        console.log(`🪟 Opening new ${linkDoctype} form in new tab with suggested name: ${suggestedName}`);
        
        try {
            // Hide dropdown first
            this.hideCustomDropdown(dropdownList);
            
            // Build the new record URL using Flansa record-viewer
            // We need to get the table name from the linked DocType
            let newRecordUrl = await this.getFlansaRecordViewerUrl(linkDoctype, suggestedName);
            
            if (!newRecordUrl) {
                throw new Error('Could not determine table name for linked DocType');
            }
            
            console.log(`🔗 Opening URL: ${newRecordUrl}`);
            
            // Open in new tab
            const newWindow = window.open(newRecordUrl, '_blank');
            
            if (newWindow) {
                // Show helpful message
                frappe.show_alert({
                    message: `Opening new ${this.getDocTypeDisplayName(linkDoctype)} form in new tab`,
                    indicator: 'blue'
                });
                
                // Focus on the new window
                newWindow.focus();
                
                // Optional: Add event listener to detect when the new tab is closed
                // and refresh the dropdown to show the newly created record
                this.monitorNewRecordCreation(newWindow, linkDoctype, input, linkField, dropdownList);
                
            } else {
                // Popup blocked
                frappe.show_alert({
                    message: 'Please allow popups to create new records',
                    indicator: 'orange'
                });
            }
            
        } catch (error) {
            console.error('❌ Error opening new record form:', error);
            frappe.show_alert({
                message: `Failed to open new record form: ${error.message}`,
                indicator: 'red'
            });
        }
    }
    
    monitorNewRecordCreation(newWindow, linkDoctype, input, linkField, dropdownList) {
        // Check if the new window is closed periodically
        const checkClosed = setInterval(() => {
            if (newWindow.closed) {
                clearInterval(checkClosed);
                console.log(`🔄 New record form closed, refreshing dropdown options`);
                
                // Show a brief message
                frappe.show_alert({
                    message: 'Refreshed dropdown options',
                    indicator: 'green'
                });
                
                // Optionally refresh the dropdown with updated data
                // You could trigger a new search here if needed
            }
        }, 1000);
        
        // Stop checking after 5 minutes to prevent memory leaks
        setTimeout(() => {
            clearInterval(checkClosed);
        }, 300000);
    }
    
    async getFlansaRecordViewerUrl(linkDoctype, suggestedName) {
        try {
            console.log(`🔍 Getting Flansa table name for DocType: ${linkDoctype}`);
            
            // Look up the Flansa Table that corresponds to this DocType
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Table',
                    filters: {
                        doctype_name: linkDoctype
                    },
                    fields: ['name'],
                    limit_page_length: 1
                }
            });
            
            if (response.message && response.message.length > 0) {
                const tableName = response.message[0].name;
                console.log(`✅ Found Flansa table: ${tableName}`);
                
                // Build the Flansa record-viewer URL in new mode
                let recordViewerUrl = `/app/flansa-record-viewer/${tableName}/new?mode=new`;
                
                // Add suggested name as query parameter if provided
                if (suggestedName && suggestedName !== 'New Record') {
                    recordViewerUrl += `&suggested_title=${encodeURIComponent(suggestedName)}`;
                }
                
                return recordViewerUrl;
            } else {
                console.warn(`❌ No Flansa table found for DocType: ${linkDoctype}`);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Error getting Flansa table name:', error);
            return null;
        }
    }
    
    async getDisplayFieldConfig(fieldName) {
        try {
            console.log(`🔍 Looking for display field config - table: ${this.table_name}, field: ${fieldName}`);
            
            const logicFields = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Flansa Logic Field',
                    filters: {
                        table_name: this.table_name,
                        field_name: fieldName,
                        logic_type: 'link'
                    },
                    fields: ['link_display_field'],
                    limit_page_length: 1
                }
            });
            
            console.log(`📋 Display field config response:`, logicFields);
            
            if (logicFields.message && logicFields.message.length > 0) {
                console.log(`✅ Found display field config:`, logicFields.message[0]);
                return logicFields.message[0];
            }
        } catch (error) {
            console.error('Error loading display field config:', error);
        }
        return null;
    }
    
    async searchWithDisplayValues(linkDoctype, searchTerm, displayField) {
        try {
            // Search both name and display field
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: linkDoctype,
                    filters: [
                        ['name', 'like', `%${searchTerm}%`],
                        'OR',
                        [displayField, 'like', `%${searchTerm}%`]
                    ],
                    fields: ['name', displayField],
                    limit_page_length: 10,
                    order_by: displayField
                }
            });
            
            return response.message || [];
        } catch (error) {
            console.error('Error searching with display values:', error);
            return [];
        }
    }
    
    show_enhanced_link_suggestions(input, suggestions, displayField) {
        // Remove existing suggestions
        this.hide_link_suggestions();
        
        if (!suggestions || suggestions.length === 0) return;
        
        const container = input.closest('.frappe-link-field-container');
        const suggestionsList = document.createElement('div');
        suggestionsList.className = 'link-suggestions enhanced-suggestions';
        suggestionsList.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #d1d8dd;
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1050;
        `;
        
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #f5f5f5;
            `;
            item.innerHTML = `
                <div style="font-weight: 500;">${suggestion[displayField] || suggestion.name}</div>
                <small style="color: #6c757d;">ID: ${suggestion.name}</small>
            `;
            
            item.addEventListener('click', () => {
                input.value = suggestion.name;
                input.dataset.value = suggestion.name;
                input.dataset.displayValue = suggestion[displayField] || suggestion.name;
                
                // Update Frappe link field if it exists
                if (input._frappe_link_field) {
                    input._frappe_link_field.set_value(suggestion.name);
                }
                
                // Trigger change events
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                this.hide_link_suggestions();
            });
            
            suggestionsList.appendChild(item);
        });
        
        container.appendChild(suggestionsList);
    }
    
    hide_link_suggestions() {
        document.querySelectorAll('.link-suggestions').forEach(el => el.remove());
    }
    
    show_link_suggestions(input, suggestions) {
        // Remove existing suggestions
        const existingSuggestions = input.parentElement.querySelector('.link-suggestions');
        if (existingSuggestions) {
            existingSuggestions.remove();
        }
        
        if (!suggestions || suggestions.length === 0) return;
        
        // Create suggestions dropdown
        const suggestionsEl = document.createElement('div');
        suggestionsEl.className = 'link-suggestions';
        suggestionsEl.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-height: 200px;
            overflow-y: auto;
        `;
        
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'link-suggestion-item';
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #f8f9fa;
                transition: background 0.2s;
            `;
            item.textContent = suggestion.value || suggestion;
            
            item.addEventListener('click', () => {
                const newValue = suggestion.value || suggestion;
                input.value = newValue;
                input.dataset.value = newValue;
                
                // Update Frappe link field if it exists
                if (input._frappe_link_field) {
                    input._frappe_link_field.set_value(newValue);
                }
                
                // Trigger change events
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                suggestionsEl.remove();
                console.log(`🔄 Link suggestion selected: ${newValue}`);
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f8f9fa';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
            });
            
            suggestionsEl.appendChild(item);
        });
        
        // Position relative container
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(suggestionsEl);
        
        // Close suggestions on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeSuggestions(e) {
                if (!suggestionsEl.contains(e.target) && e.target !== input) {
                    suggestionsEl.remove();
                    document.removeEventListener('click', closeSuggestions);
                }
            });
        }, 100);
    }
    
    
    
    
    
    
    
    show_error(message) {
        const content = document.getElementById('record-content');
        if (content) {
            content.innerHTML = `
                <div class="text-center" style="padding: 50px;">
                    <i class="fa fa-exclamation-triangle fa-3x text-danger"></i>
                    <h4 style="margin-top: 20px; color: #d9534f;">${message}</h4>
                    <button class="btn btn-default" onclick="window.history.back()" style="margin-top: 20px;">
                        ← Go Back
                    </button>
                </div>
            `;
        }
    }
    
    // Dashboard link functionality removed - now using modern breadcrumb structure in sleek header
    
    update_mode_display() {
        // Update mode badge
        const modeBadge = document.querySelector('.mode-badge');
        if (modeBadge) {
            modeBadge.textContent = this.mode.toUpperCase();
        }
        
        // Update action buttons based on new mode
        const bannerRight = document.querySelector('.banner-right');
        if (bannerRight) {
            // Regenerate the entire banner-right section with new action buttons
            bannerRight.innerHTML = `
                <div class="action-dropdown">
                    <span class="sleek-badge mode-badge">${this.mode.toUpperCase()}</span>
                </div>
                ${this.generate_action_buttons()}
            `;
            
            // Re-bind events for the new buttons
            setTimeout(() => {
                this.bind_context_menu_events();
            }, 50);
        }
        
        // Keep breadcrumb current text consistent (always "Record Viewer")
        const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
        if (breadcrumbCurrent) {
            breadcrumbCurrent.textContent = '📋 Record Viewer';
        }
        
        // Update page title
        const modeTitle = this.mode === 'new' ? 'Create New Record' : 
                         this.mode === 'edit' ? 'Edit Record' : 'View Record';
        this.page.set_title(modeTitle);
    }
    
    bind_save_cancel_buttons(page) {
        // Bind save and cancel button events for new/edit modes
        const saveBtn = page.querySelector('#save-record');
        const cancelBtn = page.querySelector('#cancel-record');
        
        if (saveBtn && !saveBtn.hasAttribute('data-bound')) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.save_record();
            });
            saveBtn.setAttribute('data-bound', 'true');
        }
        
        if (cancelBtn && !cancelBtn.hasAttribute('data-bound')) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.cancel_edit();
            });
            cancelBtn.setAttribute('data-bound', 'true');
        }
    }

    bind_context_menu_events() {
        // Dedicated method to bind context menu events with retry logic
        const page = document.querySelector('.flansa-record-viewer-page');
        if (!page) {
            console.log('Page not ready for context menu binding, retrying...');
            setTimeout(() => this.bind_context_menu_events(), 200);
            return;
        }
        
        // Bind save/cancel buttons for new/edit modes
        this.bind_save_cancel_buttons(page);
        
        // Bind context menu for view mode
        const contextMenuBtn = page.querySelector('#context-menu');
        const contextDropdown = page.querySelector('#context-dropdown');
        
        if (!contextMenuBtn || !contextDropdown) {
            // Context menu not present (likely in new/edit mode)
            return;
        }
        
        console.log('Binding context menu events...');
        
        // Remove any existing handlers first
        contextMenuBtn.removeEventListener('click', this.contextMenuClickHandler);
        
        // Store handler reference for removal
        this.contextMenuClickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle dropdown
            const isVisible = contextDropdown.style.display === 'block';
            contextDropdown.style.display = isVisible ? 'none' : 'block';
        };
        
        contextMenuBtn.addEventListener('click', this.contextMenuClickHandler);
        
        // Close dropdown when clicking outside (only add once)
        if (!this.outsideClickHandlerAdded) {
            document.addEventListener('click', (e) => {
                if (!contextMenuBtn.contains(e.target) && !contextDropdown.contains(e.target)) {
                    contextDropdown.style.display = 'none';
                }
            });
            this.outsideClickHandlerAdded = true;
        }
        
        // Bind dropdown actions
        this.bind_dropdown_actions(contextDropdown);
    }
    
    bind_dropdown_actions(contextDropdown) {
        const editRecordBtn = contextDropdown.querySelector('#edit-record-menu');
        const duplicateRecordBtn = contextDropdown.querySelector('#duplicate-record-menu');
        const deleteRecordBtn = contextDropdown.querySelector('#delete-record-menu');
        
        if (editRecordBtn && !editRecordBtn.hasAttribute('data-bound')) {
            editRecordBtn.addEventListener('click', (e) => {
                console.log('Edit record clicked!');
                e.preventDefault();
                contextDropdown.style.display = 'none';
                
                // Update URL to include mode=edit
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('mode', 'edit');
                window.history.pushState(null, '', currentUrl.toString());
                
                // Update mode and re-render
                this.mode = 'edit';
                this.update_mode_display();
                this.render_record();
            });
            editRecordBtn.setAttribute('data-bound', 'true');
        }
        
        if (duplicateRecordBtn && !duplicateRecordBtn.hasAttribute('data-bound')) {
            duplicateRecordBtn.addEventListener('click', (e) => {
                console.log('Duplicate record clicked!');
                e.preventDefault();
                contextDropdown.style.display = 'none';
                this.duplicate_record();
            });
            duplicateRecordBtn.setAttribute('data-bound', 'true');
        }
        
        if (deleteRecordBtn && !deleteRecordBtn.hasAttribute('data-bound')) {
            deleteRecordBtn.addEventListener('click', (e) => {
                console.log('Delete record clicked!');
                e.preventDefault();
                contextDropdown.style.display = 'none';
                this.delete_record();
            });
            deleteRecordBtn.setAttribute('data-bound', 'true');
        }
    }
    
    duplicate_record() {
        if (!this.record_data || !this.record_id) {
            frappe.show_alert('No record to duplicate', 'red');
            return;
        }
        
        frappe.confirm('Are you sure you want to duplicate this record?', () => {
            // Navigate to new record page with current record data as template
            const currentUrl = new URL(window.location);
            currentUrl.pathname = currentUrl.pathname.replace(this.record_id, 'new');
            currentUrl.searchParams.set('duplicate_from', this.record_id);
            window.location.href = currentUrl.toString();
        });
    }
    
    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true
        });
        return `${dateStr} at ${timeStr}`;
    }
    
    formatUser(userString) {
        if (!userString) return '';
        // Remove @domain if it's an email, otherwise return as-is
        return userString.includes('@') ? userString.split('@')[0] : userString;
    }
    
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    update_banner_title() {
        // Update banner title and breadcrumb URLs with proper context
        // Use a promise-based approach to handle app title priority correctly
        let appTitlePromise = null;
        
        if (this.application) {
            // Update app breadcrumb URL now that we have application context
            const newUrl = `/app/flansa-app-builder?app=${encodeURIComponent(this.application)}`;
            
            // Use timeout to ensure DOM is ready
            setTimeout(() => {
                const $appLink = $('#app-breadcrumb-link');
                if ($appLink.length > 0) {
                    $appLink.attr('href', newUrl);
                }
            }, 100);
            
            // Get app name for banner display
            appTitlePromise = new Promise((resolve) => {
                frappe.call({
                    method: 'frappe.client.get_value',
                    args: {
                        doctype: 'Flansa Application',
                        filters: { name: this.application },
                        fieldname: ['app_title']
                    },
                    callback: (r) => {
                        if (r.message && r.message.app_title) {
                            $('#app-name-display').text(r.message.app_title);
                            resolve(true); // App title was set
                        } else {
                            resolve(false); // No app title available
                        }
                    },
                    error: () => resolve(false)
                });
            });
        }
        
        if (this.table_name) {
            // Ensure table breadcrumb URL is correct (in case it changed)
            $('#table-breadcrumb-link').attr('href', `/app/flansa-table-builder?table=${encodeURIComponent(this.table_name)}`);
            
            // Get table label as fallback only if app title is not available
            const handleTableLabel = () => {
                frappe.call({
                    method: 'frappe.client.get_value',
                    args: {
                        doctype: 'Flansa Table',
                        filters: { name: this.table_name },
                        fieldname: ['table_label']
                    },
                    callback: (r) => {
                        if (r.message && r.message.table_label) {
                            // Only use table label if no app is available
                            if (!this.application) {
                                $('#app-name-display').text(r.message.table_label);
                            }
                        }
                    }
                });
            };
            
            // If we have an app, wait for app title result, then handle table label if needed
            if (appTitlePromise) {
                appTitlePromise.then((appTitleSet) => {
                    if (!appTitleSet) {
                        // App title failed, use table label as fallback
                        handleTableLabel();
                    }
                    // If app title succeeded, don't set table label
                });
            } else {
                // No app available, use table label immediately
                handleTableLabel();
            }
        }
        
        // Report breadcrumb URL already set in generated HTML
    }
}
