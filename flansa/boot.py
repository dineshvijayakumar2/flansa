import frappe
from frappe import _

def boot_session(bootinfo):
    """Add Flansa-specific boot information"""
    
    # Auto-configure S3 if needed
    auto_configure_s3_on_boot(bootinfo)
    
    # Auto-restore missing DocTypes if needed (commented out until tested)
    # restore_missing_doctypes_on_boot()
    
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

def auto_configure_s3_on_boot(bootinfo):
    """Auto-configure S3 settings from environment variables on boot"""
    try:
        import os
        
        # Check if we're in AWS environment (ECS)
        if not os.getenv('ECS_CONTAINER_METADATA_URI_V4'):
            # Not in AWS environment, skip S3 auto-config
            return True
            
        # Simple S3 environment check and config
        s3_env_vars = {
            'S3_BUCKET': os.getenv('S3_BUCKET'),
            'S3_REGION': os.getenv('S3_REGION'),
            'USE_S3': os.getenv('USE_S3')
        }
        
        # Only proceed if S3 environment variables are set
        s3_vars_set = [v for v in s3_env_vars.values() if v]
        if not s3_vars_set:
            return True
            
        # Basic S3 configuration from environment
        import json
        site_config_path = frappe.get_site_path('site_config.json')
        
        try:
            with open(site_config_path, 'r') as f:
                site_config = json.load(f)
        except:
            site_config = {}
            
        # Apply basic S3 settings if environment variables exist
        updated = False
        if s3_env_vars['S3_BUCKET'] and site_config.get('s3_bucket') != s3_env_vars['S3_BUCKET']:
            site_config['s3_bucket'] = s3_env_vars['S3_BUCKET']
            updated = True
            
        if s3_env_vars['USE_S3'] and str(site_config.get('use_s3')) != s3_env_vars['USE_S3']:
            site_config['use_s3'] = int(s3_env_vars['USE_S3'])
            updated = True
            
        if updated:
            with open(site_config_path, 'w') as f:
                json.dump(site_config, f, indent=2)
                
        return True
        
    except Exception as e:
        frappe.log_error(f"Auto S3 config error: {str(e)}", "S3 Auto Configuration")
        # Don't fail boot if S3 config fails
        return True

