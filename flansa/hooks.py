app_name = "flansa"
app_title = "Flansa"
app_publisher = "Flansa Team"
app_description = "No-code platform for citizen developers"
app_email = "info@flansa.io"
app_license = "MIT"

# App Logo
# --------
app_logo_url = "/assets/flansa/images/flansa-logo.svg"
website_context = {
    "favicon": "/assets/flansa/images/flansa-logo.svg",
    "splash_image": "/assets/flansa/images/flansa-logo.svg"
}


# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = [
    "/assets/flansa/css/flansa-logo-size.css",  # FORCE LARGER LOGO SIZE - LOAD FIRST
    "/assets/flansa/css/flansa-navbar-override.css",  # Navbar logo and branding
    "/assets/flansa/css/flansa-theme-vars.css",
    "/assets/flansa/css/flansa-theme-components.css",
    "/assets/flansa/css/flansa-theme-updated.css",
    "/assets/flansa/css/flansa-dashboard-theme.css",
    "/assets/flansa/css/flansa-workspace-minimal.css",
    "/assets/flansa/css/flansa-unified-tiles.css",
    "/assets/flansa/css/flansa.css",
    "/assets/flansa/css/gallery_field.css",
    "/assets/flansa/css/gallery_field_renderer.css"
]
app_include_js = [
    "/assets/flansa/js/flansa-browser-cache-manager.js",  # Load first for comprehensive browser cache management
    "/assets/flansa/js/flansa-global-logo.js",  # Global Flansa logo replacement with central config - MAIN LOGO SYSTEM
    "/assets/flansa/js/flansa-logo-redirect.js",  # Handle logo redirect and duplicate removal
    
    # Foundation Services - Load these first for other components to use
    "/assets/flansa/js/flansa-state-manager.js",  # Centralized state management
    "/assets/flansa/js/flansa-data-service.js",  # Unified CRUD operations
    "/assets/flansa/js/flansa-navigation-service.js",  # Navigation controller
    
    # UI Components
    "/assets/flansa/js/flansa-header-manager.js",  # Modern header component system
    "/assets/flansa/js/flansa-unified-data-view.js",  # Unified data view system for tables and reports
    "/assets/flansa/js/flansa_report_renderer.js",  # Shared report display component for consistency
    "/assets/flansa/js/flansa-theme-manager.js",
    "/assets/flansa/js/theme-migration.js",  # Temporary migration script
    "/assets/flansa/js/flansa-theme.js",
    "/assets/flansa/js/gallery_field.js",
    "/assets/flansa/js/gallery_field_renderer.js",  # Multi-image gallery renderer for JSON fields
    "/assets/flansa/js/flansa_home_redirect.js",
    
    # Legacy - to be refactored
    # "/assets/flansa/js/flansa-navigation-manager.js",  # Role-based navigation system - DISABLED TEMP
    # "/assets/flansa/js/cache-buster.js"  # DISABLED (redundant with browser cache manager)
    ]

# include js, css files in header of web template
web_include_css = "/assets/flansa/css/flansa-logo-size.css"
# web_include_js = "/assets/flansa/js/flansa.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "flansa/public/scss/website"

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Flansa Application": "public/js/flansa_application.js",
    "Flansa Table": "public/js/flansa_table.js",
}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#     "System Manager": "desk",
#     "Flansa Admin": "desk", 
#     "Flansa User": "desk",
#     "Flansa Builder": "desk"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
#     "methods": "flansa.utils.jinja_methods",
#     "filters": "flansa.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "flansa.install.before_install"
# after_install = "flansa.install.after_install"

# App startup
after_migrate = "flansa.doctype_overrides.setup_doctype_overrides"

# Uninstallation
# ------------

# before_uninstall = "flansa.uninstall.before_uninstall"
# after_uninstall = "flansa.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "flansa.utils.before_app_install"
# after_app_install = "flansa.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "flansa.utils.before_app_uninstall"
# after_app_uninstall = "flansa.utils.after_app_uninstall"

# Custom Pages
# ------------
# Custom pages for Flansa no-code platform

page_js = {
    "flansa-form-builder": "flansa_platform/page/flansa_form_builder/flansa_form_builder.js",
    "flansa-record-viewer": [
        "flansa_core/page/flansa_record_viewer/field_config_manager.js",
        "flansa_core/page/flansa_record_viewer/report_integration.js"
    ]
}

# Website Pages (Custom Routes)
# ------------------------------
# website_route_rules = [
#     {"from_route": "/flansa-workspace", "to_route": "/app/flansa-workspace"},
#     {"from_route": "/flansa-form-builder", "to_route": "/app/flansa-form-builder"}
# ]

# User Roles and Permissions
# ---------------------------
# Custom role permissions for Flansa platform users

user_data_fields = [
    {
        "fieldname": "flansa_role",
        "label": "Flansa Role",
        "fieldtype": "Select",
        "options": "Flansa Builder\nFlansa Admin"
    }
]

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "flansa.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
#     "Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
#     "Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
#     "ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# Document Events for Logic Field calculations, validation, and tenant context
doc_events = {
    "*": {
        "validate": "flansa.flansa_core.doctype_hooks.validate_logic_fields",
        "before_save": "flansa.flansa_core.doctype_hooks.calculate_logic_fields",
        "on_update": "flansa.flansa_core.doctype_hooks.calculate_logic_fields"
    },
    "Flansa Application": {
        "before_insert": "flansa.flansa_core.tenant_service.before_insert",
        "validate": "flansa.flansa_core.tenant_service.validate_tenant_access"
    },
    "Flansa Table": {
        "before_insert": "flansa.flansa_core.tenant_service.before_insert",
        "validate": "flansa.flansa_core.tenant_service.validate_tenant_access"
    },
    "Flansa Relationship": {
        "before_insert": "flansa.flansa_core.tenant_service.before_insert",
        "validate": "flansa.flansa_core.tenant_service.validate_tenant_access"
    },
    "Flansa Saved Report": {
        "before_insert": "flansa.flansa_core.tenant_service.before_insert",
        "validate": "flansa.flansa_core.tenant_service.validate_tenant_access"
    },
    "Flansa Form Config": {
        "before_insert": "flansa.flansa_core.tenant_service.before_insert",
        "validate": "flansa.flansa_core.tenant_service.validate_tenant_access"
    },
    "Flansa Computed Field": {
        "before_insert": "flansa.flansa_core.tenant_service.before_insert",
        "validate": "flansa.flansa_core.tenant_service.validate_tenant_access"
    }
}


# Scheduled Tasks
# ---------------

# scheduler_events = {
#     "all": [
#         "flansa.tasks.all"
#     ],
#     "daily": [
#         "flansa.tasks.daily"
#     ],
#     "hourly": [
#         "flansa.tasks.hourly"
#     ],
#     "weekly": [
#         "flansa.tasks.weekly"
#     ],
#     "monthly": [
#         "flansa.tasks.monthly"
#     ],
# }

# Testing
# -------

# before_tests = "flansa.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
#     "frappe.desk.doctype.event.event.get_events": "flansa.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
#     "Task": "flansa.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["flansa.utils.before_request"]
# after_request = ["flansa.utils.after_request"]

# Boot Session
# ------------
# boot_session = "flansa.boot.boot_session"

# Override Home Page
# ------------------
# override_whitelisted_methods = {
#     "frappe.www.desk.get_desk_sidebar_items": "flansa.overrides.get_desk_sidebar_items"
# }

# Job Events
# ----------
# before_job = ["flansa.utils.before_job"]
# after_job = ["flansa.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
#     {
#         "doctype": "{doctype_1}",
#         "filter_by": "{filter_by}",
#         "redact_fields": ["{field_1}", "{field_2}"],
#         "partial": 1,
#     },
#     {
#         "doctype": "{doctype_2}",
#         "filter_by": "{filter_by}",
#         "partial": 1,
#     },
#     {
#         "doctype": "{doctype_3}",
#         "strict": False,
#     },
#     {
#         "doctype": "{doctype_4}"
#     }
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
#     "flansa.auth.validate"
# ]

# Fixtures
# --------
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [["module", "in", ["Flansa Core", "Flansa Builder", "Flansa Public", "Flansa Generated"]]]
    },
    {
        "dt": "Property Setter",
        "filters": [["module", "in", ["Flansa Core", "Flansa Builder", "Flansa Public", "Flansa Generated"]]]
    }
]
