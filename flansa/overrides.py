import frappe
from frappe import _

def get_desk_sidebar_items():
    """Override desk sidebar to add Flansa workspace prominently"""
    
    # Get default sidebar items
    from frappe.www.desk import get_desk_sidebar_items as get_default_items
    items = get_default_items()
    
    # Add Flansa workspace at the top
    flansa_items = [
        {
            "route": "flansa-workspace-builder",
            "type": "page",
            "icon": "fa fa-th-large",
            "color": "#2196F3",
            "category": "Main",
            "is_primary": True,
            "description": _("No-code application builder and workspace")
        },
        {
            "module_name": "Visual Builder", 
            "label": _("🔧 Visual Builder"),
            "route": "List/Flansa Table",
            "type": "list",
            "icon": "fa fa-table", 
            "color": "#FF9800",
            "category": "Tools",
            "description": _("Build tables and forms visually")
        }
    ]
    
    # Insert Flansa items at the beginning
    return flansa_items + items

@frappe.whitelist()
def get_home_page():
    """Get appropriate home page for current user"""
    user = frappe.session.user
    
    if user == "Guest":
        return "login"
    
    # Check user roles
    user_roles = frappe.get_roles(user)
    flansa_roles = ["System Manager", "Flansa Admin", "Flansa User", "Flansa Builder"]
    
    if any(role in user_roles for role in flansa_roles):
        return "flansa-workspace-builder"
    
    # Default Frappe home page for non-Flansa users
    return "desk"