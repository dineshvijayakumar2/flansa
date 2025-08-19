import frappe

@frappe.whitelist()
def get_available_tenants():
    """Get list of available tenants for switching"""
    
    tenants = frappe.get_all("Flansa Tenant Registry",
                           filters={"status": "Active"},
                           fields=["tenant_id", "tenant_name", "primary_domain", "status"],
                           order_by="tenant_name")
    
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