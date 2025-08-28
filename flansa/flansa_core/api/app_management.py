import frappe

@frappe.whitelist()
def get_user_applications():
    """Get applications accessible to the current user"""
    try:
        # Get all applications for now (can be filtered by user permissions later)
        applications = frappe.get_all(
            "Flansa Application",
            fields=[
                "name", 
                "application_title", 
                "application_name", 
                "application_description",
                "creation",
                "modified"
            ],
            order_by="modified desc"
        )
        
        return {
            "success": True,
            "applications": applications
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting user applications: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "applications": []
        }