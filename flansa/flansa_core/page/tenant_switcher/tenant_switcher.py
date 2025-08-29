import frappe

@frappe.whitelist()
def get_available_tenants():
    """Get list of all tenants for management"""
    
    tenants = frappe.get_all("Flansa Tenant Registry",
                           fields=["tenant_id", "tenant_name", "primary_domain", "status"],
                           order_by="status desc, tenant_name")
    
    return tenants

@frappe.whitelist()
def switch_tenant_context(tenant_id):
    """Switch to a different tenant context"""
    
    # Validate tenant exists
    if not frappe.db.exists("Flansa Tenant Registry", {"tenant_id": tenant_id}):
        frappe.throw(f"Tenant {tenant_id} not found")
    
    # Import tenant service
    from flansa.flansa_core.tenant_service import TenantContext
    
    # Set new tenant context
    TenantContext.set_tenant_context(tenant_id)
    
    # Store in session for persistence
    frappe.local.session.tenant_id = tenant_id
    
    return {"status": "success", "current_tenant": tenant_id}

@frappe.whitelist()
def get_current_tenant_info():
    """Get information about current tenant"""
    
    try:
        from flansa.flansa_core.tenant_service import TenantContext
        
        current_tenant_id = TenantContext.get_current_tenant_id()
        
        # Get tenant details - try multiple approaches
        tenant_info = None
        
        # First try: direct name lookup (most common case)
        try:
            if frappe.db.exists("Flansa Tenant Registry", current_tenant_id):
                tenant_info = frappe.get_doc("Flansa Tenant Registry", current_tenant_id)
        except:
            pass
            
        # Second try: lookup by tenant_id field
        if not tenant_info:
            try:
                tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                           filters={"tenant_id": current_tenant_id}, 
                                           fields=["name"], limit=1)
                if tenant_list:
                    tenant_info = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
            except:
                pass
                
        # Third try: get the first available tenant (fallback)
        if not tenant_info:
            tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                       fields=["name", "tenant_id", "tenant_name"], 
                                       limit=1,
                                       order_by="creation asc")
            if tenant_list:
                tenant_info = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
                # Update current_tenant_id to match what we actually found
                current_tenant_id = tenant_info.tenant_id
        
        # If we still don't have tenant info, raise an exception to trigger fallback
        if not tenant_info:
            raise Exception(f"No tenant found for tenant_id: {current_tenant_id}")
        
        # Get basic tenant statistics
        stats = {
            "apps": frappe.db.count("Flansa Application", {"tenant_id": current_tenant_id}),
            "tables": frappe.db.count("Flansa Table", {"tenant_id": current_tenant_id}),
            "relationships": frappe.db.count("Flansa Relationship", {"tenant_id": current_tenant_id}),
            "reports": frappe.db.count("Flansa Saved Report", {"tenant_id": current_tenant_id})
        }
        
        return {
            "tenant_id": tenant_info.tenant_id,
            "tenant_name": tenant_info.tenant_name,
            "primary_domain": tenant_info.primary_domain or "",
            "status": tenant_info.status,
            "stats": stats
        }
        
    except Exception as e:
        # Return default tenant info if there's an error
        return {
            "tenant_id": "default",
            "tenant_name": "Default Tenant",
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
def activate_tenant(tenant_id):
    """Activate a tenant"""
    try:
        # Find the tenant document
        tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                   filters={"tenant_id": tenant_id}, 
                                   fields=["name"], limit=1)
        
        if not tenant_list:
            frappe.throw(f"Tenant with ID '{tenant_id}' not found")
        
        tenant_doc = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
        tenant_doc.status = "Active"
        tenant_doc.save(ignore_version=True)
        frappe.db.commit()
        
        return {"status": "success", "message": f"Tenant {tenant_id} activated"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def deactivate_tenant(tenant_id):
    """Deactivate a tenant"""
    try:
        # Find the tenant document
        tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                   filters={"tenant_id": tenant_id}, 
                                   fields=["name"], limit=1)
        
        if not tenant_list:
            frappe.throw(f"Tenant with ID '{tenant_id}' not found")
        
        tenant_doc = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
        tenant_doc.status = "Inactive"
        tenant_doc.save(ignore_version=True)
        frappe.db.commit()
        
        return {"status": "success", "message": f"Tenant {tenant_id} deactivated"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def get_tenant_statistics(tenant_id):
    """Get detailed statistics for a tenant"""
    try:
        # Find the tenant document
        tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                   filters={"tenant_id": tenant_id}, 
                                   fields=["name"], limit=1)
        
        if not tenant_list:
            frappe.throw(f"Tenant with ID '{tenant_id}' not found")
        
        tenant_doc = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
        
        # Get statistics
        stats = {
            "applications": frappe.db.count("Flansa Application", {"tenant_id": tenant_id}) if frappe.db.exists("DocType", "Flansa Application") else 0,
            "tables": frappe.db.count("Flansa Table", {"tenant_id": tenant_id}) if frappe.db.exists("DocType", "Flansa Table") else 0,
            "relationships": frappe.db.count("Flansa Relationship", {"tenant_id": tenant_id}) if frappe.db.exists("DocType", "Flansa Relationship") else 0,
            "reports": frappe.db.count("Flansa Saved Report", {"tenant_id": tenant_id}) if frappe.db.exists("DocType", "Flansa Saved Report") else 0,
            "form_configs": frappe.db.count("Flansa Form Config", {"tenant_id": tenant_id}) if frappe.db.exists("DocType", "Flansa Form Config") else 0,
            "last_activity": tenant_doc.last_activity
        }
        
        return {
            "status": "success",
            "statistics": stats
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def get_tenant_details(tenant_id):
    """Get detailed tenant information for editing"""
    try:
        # Try to find tenant by tenant_id field
        tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                   filters={"tenant_id": tenant_id}, 
                                   fields=["name"], limit=1)
        
        if not tenant_list:
            frappe.throw(f"Tenant with ID '{tenant_id}' not found")
        
        tenant_doc = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
        
        # Convert custom domains to list format
        custom_domains = []
        if tenant_doc.custom_domains:
            for domain in tenant_doc.custom_domains:
                custom_domains.append({
                    'domain': domain.domain,
                    'is_verified': domain.is_verified,
                    'verification_status': domain.verification_status
                })
        
        return {
            "tenant_id": tenant_doc.tenant_id,
            "tenant_name": tenant_doc.tenant_name,
            "admin_email": tenant_doc.admin_email or "",
            "primary_domain": tenant_doc.primary_domain or "",
            "status": tenant_doc.status or "Active",
            "created_date": tenant_doc.created_date,
            "max_users": tenant_doc.max_users or 100,
            "max_tables": tenant_doc.max_tables or 50,
            "storage_limit_gb": tenant_doc.storage_limit_gb or 10.0,
            "features_enabled": tenant_doc.features_enabled or 1,
            "custom_branding": tenant_doc.custom_branding or 0,
            "workspace_logo": tenant_doc.workspace_logo or "",
            "api_access_enabled": tenant_doc.api_access_enabled or 1,
            "custom_domains": custom_domains,
            "total_applications": tenant_doc.total_applications or 0,
            "total_tables": tenant_doc.total_tables or 0,
            "total_relationships": tenant_doc.total_relationships or 0,
            "total_reports": tenant_doc.total_reports or 0,
            "total_form_configs": tenant_doc.total_form_configs or 0,
            "last_activity": tenant_doc.last_activity
        }
        
    except Exception as e:
        frappe.throw(f"Failed to load tenant details: {str(e)}")

@frappe.whitelist()
def register_new_tenant(**kwargs):
    """Register a new tenant"""
    # Import the method from tenant_registration page
    from flansa.flansa_core.page.tenant_registration.tenant_registration import register_new_tenant
    return register_new_tenant(**kwargs)

@frappe.whitelist()
def update_tenant(**kwargs):
    """Update an existing tenant"""
    # Import the method from tenant_registration page
    from flansa.flansa_core.page.tenant_registration.tenant_registration import update_tenant
    return update_tenant(**kwargs)

@frappe.whitelist()
def delete_tenant(tenant_id):
    """Delete a tenant permanently"""
    try:
        # Find the tenant document
        tenant_list = frappe.get_all("Flansa Tenant Registry", 
                                   filters={"tenant_id": tenant_id}, 
                                   fields=["name"], limit=1)
        
        if not tenant_list:
            frappe.throw(f"Tenant with ID '{tenant_id}' not found")
        
        # Delete the tenant document
        tenant_doc = frappe.get_doc("Flansa Tenant Registry", tenant_list[0].name)
        tenant_doc.delete()
        frappe.db.commit()
        
        return {"status": "success", "message": f"Tenant {tenant_id} deleted successfully"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}