import frappe
from frappe import _

def boot_session(bootinfo):
    """Add Flansa-specific boot information"""
    
    # Don't override the default home page - let Frappe handle it
    # bootinfo["home_page"] = "flansa-workspace"
    
    # Add Flansa workspace to modules
    flansa_module = {
        "module_name": "Flansa",
        "label": _("Flansa"),
        "route": "flansa-workspace",
        "icon": "fa fa-th-large",
        "color": "#2196F3",
        "description": _("No-code application builder")
    }
    
    # Add custom desk items
    if not bootinfo.get("desk_items"):
        bootinfo["desk_items"] = []
    
    # Add Flansa workspace as primary item
    flansa_desk_item = {
        "module_name": "Flansa",
        "label": _("Flansa"),
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
    bootinfo["desk_items"].insert(0, flansa_desk_item)
    
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

def auto_configure_s3_on_boot():
    """Auto-configure S3 settings from environment variables on boot"""
    try:
        # Import the auto config function
        import sys
        import os
        sys.path.append(os.path.join(frappe.get_app_path('flansa'), 'aws-fixes'))
        
        # Import and run auto S3 configuration
        from auto_s3_config import auto_configure_s3
        return auto_configure_s3()
        
    except Exception as e:
        frappe.log_error(f"Auto S3 config error: {str(e)}", "S3 Auto Configuration")
        # Don't fail boot if S3 config fails
        return True