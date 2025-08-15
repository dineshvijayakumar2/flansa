import frappe
from frappe import _

def boot_session(bootinfo):
    """Add Flansa-specific boot information"""
    
    # Don't override the default home page - let Frappe handle it
    # bootinfo["home_page"] = "flansa-workspace"
    
    # Add Flansa workspace to modules
            "route": "flansa-workspace",
            "icon": "fa fa-th-large",
            "color": "#2196F3",
            "description": _("No-code application builder")
        }
    
    # Add custom desk items
    if not bootinfo.get("desk_items"):
        bootinfo["desk_items"] = []
    
    # Add Flansa workspace as primary item
        "route": "flansa-workspace", 
        "type": "page",
        "icon": "fa fa-th-large",
        "color": "#2196F3",
        "description": _("Build no-code applications"),
        "category": "Main",
        "hidden": 0,
        "is_primary": 1
    }
    
    # Insert at the beginning of desk items
    
    # Add Visual Builder
    visual_builder_item = {
        "module_name": "Visual Builder",
        "label": _("Visual Builder"),
        "route": "List/Flansa Table",
        "type": "page", 
        "icon": "fa fa-table",
        "color": "#FF9800",
        "description": _("Visual table and form builder"),
        "category": "Tools",
        "hidden": 0
    }
    
    bootinfo["desk_items"].append(visual_builder_item)
    
    # Don't override user home page - add Flansa workspace as available option
    # user = frappe.session.user
    # if user and user != "Guest":
    #     # Check user roles for appropriate home page
    #     user_roles = frappe.get_roles(user)
    #     flansa_roles = ["System Manager", "Flansa Admin", "Flansa User", "Flansa Builder"]
    #     
    #     if any(role in user_roles for role in flansa_roles):
    #         bootinfo["user_home_page"] = "flansa-workspace"