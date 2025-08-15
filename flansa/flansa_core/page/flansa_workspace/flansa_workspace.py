import frappe

def get_context(context):
    """Context for Flansa Workspace page"""
    
    # Check if user has Flansa access
    if not has_flansa_access(frappe.session.user):
        frappe.throw("Access denied to Flansa Platform")
    
    context.no_cache = 1
    context.show_sidebar = False
    
    return context

def has_flansa_access(user):
    """Check if user has access to Flansa platform"""
    user_roles = frappe.get_roles(user)
    allowed_roles = ["System Manager", "Flansa Admin", "Flansa Builder"]
    return any(role in user_roles for role in allowed_roles)