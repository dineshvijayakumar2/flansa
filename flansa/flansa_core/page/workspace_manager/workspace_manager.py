import frappe


# Workspace Persistence Functions
def save_user_workspace(workspace_id, workspace_name=None):
    """Save user's workspace preference to Flansa User Workspace"""
    try:
        user = frappe.session.user
        if not user or user == "Guest":
            return False
        
        # Check if user setting exists
        if frappe.db.exists("Flansa User Workspace", {"user": user}):
            # Update existing
            doc = frappe.get_doc("Flansa User Workspace", {"user": user})
            doc.workspace_id = workspace_id
            doc.workspace_name = workspace_name or workspace_id
            doc.last_switched = frappe.utils.now()
            doc.save(ignore_permissions=True)
        else:
            # Create new
            doc = frappe.get_doc({
                "doctype": "Flansa User Workspace",
                "user": user,
                "workspace_id": workspace_id,
                "workspace_name": workspace_name or workspace_id,
                "last_switched": frappe.utils.now()
            })
            doc.insert(ignore_permissions=True)
        
        frappe.db.commit()
        return True
        
    except Exception as e:
        frappe.log_error(f"Error saving user workspace: {str(e)}", "Flansa Workspace Persistence")
        return False

def load_user_workspace():
    """Load user's workspace preference from Flansa User Workspace"""
    try:
        user = frappe.session.user
        if not user or user == "Guest":
            return None
        
        workspace_id = frappe.db.get_value(
            "Flansa User Workspace",
            {"user": user},
            "workspace_id"
        )
        
        return workspace_id
        
    except Exception as e:
        frappe.log_error(f"Error loading user workspace: {str(e)}", "Flansa Workspace Persistence")
        return None

def clear_user_workspace():
    """Clear user's workspace preference"""
    try:
        user = frappe.session.user
        if not user or user == "Guest":
            return False
        
        if frappe.db.exists("Flansa User Workspace", {"user": user}):
            frappe.delete_doc("Flansa User Workspace", {"user": user})
            frappe.db.commit()
        
        return True
        
    except Exception as e:
        frappe.log_error(f"Error clearing user workspace: {str(e)}", "Flansa Workspace Persistence")
        return False

def get_all_user_workspaces():
    """Get all user workspace assignments (for admin view)"""
    try:
        return frappe.get_all("Flansa User Workspace",
                            fields=["user", "workspace_id", "workspace_name", "last_switched"],
                            order_by="last_switched desc")
    except Exception as e:
        frappe.log_error(f"Error getting all user workspaces: {str(e)}", "Flansa Workspace Persistence")
        return []

@frappe.whitelist()
def get_available_workspaces():
    """Get list of all workspaces for management"""
    
    workspaces = frappe.get_all("Flansa Workspace",
                           fields=["workspace_id", "workspace_name", "primary_domain", "status", "created_date", "workspace_logo"],
                           order_by="status desc, workspace_name")
    
    # Get current workspace from session
    current_workspace = frappe.session.get('workspace_id', 'default')
    
    return {
        "workspaces": workspaces,
        "current_workspace": current_workspace
    }

@frappe.whitelist()
def switch_workspace_context(workspace_id):
    """Switch to a different workspace context"""
    
    # Validate workspace exists
    workspace = frappe.get_value(
        "Flansa Workspace",
        {"workspace_id": workspace_id},
        ["name", "workspace_name", "status"],
        as_dict=True
    )
    
    if not workspace:
        frappe.throw(f"Workspace {workspace_id} not found")
    
    if workspace.status == "Inactive":
        frappe.throw(f"Workspace {workspace_id} is inactive")
    
        # Store workspace context in user settings for persistence
    
    save_user_workspace(workspace_id, workspace.workspace_name)
    
    frappe.db.commit()
    
    # Clear WorkspaceContext cache to ensure immediate effect
    try:
        from flansa.flansa_core.workspace_service import WorkspaceContext
        WorkspaceContext.clear_context()
    except:
        pass
    
    # Clear cache for user
    frappe.clear_cache(user=frappe.session.user)
    
    return {
        "status": "success",
        "current_workspace": workspace_id,
        "workspace_name": workspace.workspace_name,
        "message": f"Switched to workspace: {workspace.workspace_name}"
    }

@frappe.whitelist()
def get_current_workspace_info():
    """Get information about current workspace"""
    
    try:
        # Get current workspace from user settings
        
        current_workspace_id = load_user_workspace()
        
        # Get workspace details - try multiple approaches
        workspace_info = None
        
        # First try: direct name lookup (most common case)
        try:
            if frappe.db.exists("Flansa Workspace", current_workspace_id):
                workspace_info = frappe.get_doc("Flansa Workspace", current_workspace_id)
        except:
            pass
            
        # Second try: lookup by workspace_id field
        if not workspace_info:
            try:
                workspace_list = frappe.get_all("Flansa Workspace", 
                                           filters={"workspace_id": current_workspace_id}, 
                                           fields=["name"], limit=1)
                if workspace_list:
                    workspace_info = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
            except:
                pass
                
        # Third try: get the first available workspace (fallback)
        if not workspace_info:
            workspace_list = frappe.get_all("Flansa Workspace", 
                                       fields=["name", "workspace_id", "workspace_name"], 
                                       limit=1,
                                       order_by="creation asc")
            if workspace_list:
                workspace_info = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
                # Update current_workspace_id to match what we actually found
                current_workspace_id = workspace_info.workspace_id
        
        # If we still don't have workspace info, raise an exception to trigger fallback
        if not workspace_info:
            raise Exception(f"No workspace found for workspace_id: {current_workspace_id}")
        
        # Get basic workspace statistics
        stats = {
            "apps": frappe.db.count("Flansa Application", {"workspace_id": current_workspace_id}),
            "tables": frappe.db.count("Flansa Table", {"workspace_id": current_workspace_id}),
            "relationships": frappe.db.count("Flansa Relationship", {"workspace_id": current_workspace_id}),
            "reports": frappe.db.count("Flansa Saved Report", {"workspace_id": current_workspace_id})
        }
        
        return {
            "workspace_id": workspace_info.workspace_id,
            "workspace_name": workspace_info.workspace_name,
            "primary_domain": workspace_info.primary_domain or "",
            "status": workspace_info.status,
            "stats": stats
        }
        
    except Exception as e:
        # Return default workspace info if there's an error
        return {
            "workspace_id": "default",
            "workspace_name": "Default Workspace",
            "primary_domain": frappe.local.site or "localhost",
            "status": "Active",
            "stats": {
                "apps": 0,
                "tables": 0,
                "relationships": 0,
                "reports": 0
            }
        }

@frappe.whitelist()
def activate_workspace(workspace_id):
    """Activate a workspace"""
    try:
        # Find the tenant document
        workspace_list = frappe.get_all("Flansa Workspace", 
                                   filters={"workspace_id": workspace_id}, 
                                   fields=["name"], limit=1)
        
        if not workspace_list:
            frappe.throw(f"Workspace with ID '{workspace_id}' not found")
        
        workspace_doc = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
        workspace_doc.status = "Active"
        workspace_doc.save(ignore_version=True)
        frappe.db.commit()
        
        return {"status": "success", "message": f"Workspace {workspace_id} activated"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def deactivate_workspace(workspace_id):
    """Deactivate a workspace"""
    try:
        # Find the tenant document
        workspace_list = frappe.get_all("Flansa Workspace", 
                                   filters={"workspace_id": workspace_id}, 
                                   fields=["name"], limit=1)
        
        if not workspace_list:
            frappe.throw(f"Workspace with ID '{workspace_id}' not found")
        
        workspace_doc = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
        workspace_doc.status = "Inactive"
        workspace_doc.save(ignore_version=True)
        frappe.db.commit()
        
        return {"status": "success", "message": f"Workspace {workspace_id} deactivated"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def get_workspace_statistics(workspace_id):
    """Get detailed statistics for a workspace"""
    try:
        # Find the tenant document
        workspace_list = frappe.get_all("Flansa Workspace", 
                                   filters={"workspace_id": workspace_id}, 
                                   fields=["name"], limit=1)
        
        if not workspace_list:
            frappe.throw(f"Workspace with ID '{workspace_id}' not found")
        
        workspace_doc = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
        
        # Get statistics
        stats = {
            "applications": frappe.db.count("Flansa Application", {"workspace_id": workspace_id}) if frappe.db.exists("DocType", "Flansa Application") else 0,
            "tables": frappe.db.count("Flansa Table", {"workspace_id": workspace_id}) if frappe.db.exists("DocType", "Flansa Table") else 0,
            "relationships": frappe.db.count("Flansa Relationship", {"workspace_id": workspace_id}) if frappe.db.exists("DocType", "Flansa Relationship") else 0,
            "reports": frappe.db.count("Flansa Saved Report", {"workspace_id": workspace_id}) if frappe.db.exists("DocType", "Flansa Saved Report") else 0,
            "form_configs": frappe.db.count("Flansa Form Config", {"workspace_id": workspace_id}) if frappe.db.exists("DocType", "Flansa Form Config") else 0,
            "last_activity": workspace_doc.last_activity
        }
        
        return {
            "status": "success",
            "statistics": stats
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def get_workspace_details(workspace_id):
    """Get detailed workspace information for editing"""
    try:
        # Try to find tenant by workspace_id field
        workspace_list = frappe.get_all("Flansa Workspace", 
                                   filters={"workspace_id": workspace_id}, 
                                   fields=["name"], limit=1)
        
        if not workspace_list:
            frappe.throw(f"Workspace with ID '{workspace_id}' not found")
        
        workspace_doc = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
        
        # Convert custom domains to list format
        custom_domains = []
        if workspace_doc.custom_domains:
            for domain in workspace_doc.custom_domains:
                custom_domains.append({
                    'domain': domain.domain,
                    'is_verified': domain.is_verified,
                    'verification_status': domain.verification_status
                })
        
        return {
            "workspace_id": workspace_doc.workspace_id,
            "workspace_name": workspace_doc.workspace_name,
            "primary_domain": workspace_doc.primary_domain or "",
            "status": workspace_doc.status or "Active",
            "created_date": workspace_doc.created_date,
            "custom_branding": workspace_doc.custom_branding or 0,
            "workspace_logo": workspace_doc.workspace_logo or "",
            "custom_domains": custom_domains,
            "total_applications": workspace_doc.total_applications or 0,
            "total_tables": workspace_doc.total_tables or 0,
            "total_relationships": workspace_doc.total_relationships or 0,
            "total_reports": workspace_doc.total_reports or 0,
            "total_form_configs": workspace_doc.total_form_configs or 0,
            "last_activity": workspace_doc.last_activity
        }
        
    except Exception as e:
        frappe.throw(f"Failed to load workspace details: {str(e)}")

@frappe.whitelist()
def register_new_workspace(**kwargs):
    """Register a new workspace"""
    try:
        workspace_doc = frappe.get_doc({
            "doctype": "Flansa Workspace",
            "workspace_id": kwargs.get("workspace_id"),
            "workspace_name": kwargs.get("workspace_name", "New Workspace"),
            "status": kwargs.get("status", "Active"),
            "primary_domain": kwargs.get("primary_domain"),
            "created_date": frappe.utils.now(),
            "custom_branding": kwargs.get("custom_branding", 0),
            "workspace_logo": kwargs.get("workspace_logo")
        })
        workspace_doc.insert()
        frappe.db.commit()
        return {"success": True, "workspace_id": workspace_doc.workspace_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def create_workspace(workspace_data):
    """Create a new workspace - API for workspace manager page"""
    try:
        import json
        
        # Parse data if it's a string
        if isinstance(workspace_data, str):
            workspace_data = json.loads(workspace_data)
        
        # Create new workspace document
        workspace = frappe.new_doc("Flansa Workspace")
        
        # Set fields
        workspace.workspace_id = workspace_data.get("workspace_id")
        workspace.workspace_name = workspace_data.get("workspace_name")
        workspace.status = workspace_data.get("status", "Active")
        workspace.primary_domain = workspace_data.get("primary_domain", "")
        workspace.custom_branding = workspace_data.get("custom_branding", 0)
        workspace.workspace_logo = workspace_data.get("workspace_logo", "")
        workspace.created_date = frappe.utils.now()
        
        # Insert the document
        workspace.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "status": "success",
            "message": f"Workspace {workspace.workspace_id} created successfully",
            "workspace": workspace.as_dict()
        }
    except Exception as e:
        frappe.log_error(f"Error creating workspace: {str(e)}", "Workspace Manager")
        frappe.throw(str(e))

@frappe.whitelist()
def update_workspace(**kwargs):
    """Update an existing workspace"""
    try:
        import json
        
        workspace_id = kwargs.get("workspace_id")
        updates = kwargs.get("updates")
        
        # Parse updates if it's a string
        if isinstance(updates, str):
            updates = json.loads(updates)
        
        # Find the document by workspace_id field, not by name
        workspace_list = frappe.get_all("Flansa Workspace", 
                                   filters={"workspace_id": workspace_id}, 
                                   fields=["name"], limit=1)
        
        if not workspace_list:
            return {"success": False, "error": f"Workspace with ID '{workspace_id}' not found"}
        
        workspace_doc = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
        
        # Update fields - handle both kwargs and updates dict
        allowed_fields = ["workspace_name", "status", "primary_domain", "custom_branding", "workspace_logo"]
        
        # First check direct kwargs
        for field in allowed_fields:
            if field in kwargs and kwargs[field] is not None:
                setattr(workspace_doc, field, kwargs[field])
        
        # Then check updates dict
        if updates:
            for field, value in updates.items():
                if field in allowed_fields and hasattr(workspace_doc, field):
                    setattr(workspace_doc, field, value)
        
        workspace_doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Clear cache
        frappe.clear_cache()
        
        return {
            "success": True, 
            "status": "success",
            "message": f"Workspace {workspace_id} updated successfully",
            "workspace": workspace_doc.as_dict()
        }
    except Exception as e:
        frappe.db.rollback()
        return {"success": False, "status": "error", "error": str(e)}

@frappe.whitelist()
def delete_workspace(workspace_id):
    """Delete a workspace permanently"""
    try:
        # Find the tenant document
        workspace_list = frappe.get_all("Flansa Workspace", 
                                   filters={"workspace_id": workspace_id}, 
                                   fields=["name"], limit=1)
        
        if not workspace_list:
            frappe.throw(f"Workspace with ID '{workspace_id}' not found")
        
        # Delete the tenant document
        workspace_doc = frappe.get_doc("Flansa Workspace", workspace_list[0].name)
        workspace_doc.delete()
        frappe.db.commit()
        
        return {"status": "success", "message": f"Workspace {workspace_id} deleted successfully"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

    