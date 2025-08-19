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
    
    from flansa.flansa_core.tenant_service import TenantContext, get_tenant_stats
    
    current_tenant_id = TenantContext.get_current_tenant_id()
    
    # Get tenant details
    tenant_info = frappe.get_doc("Flansa Tenant Registry", {"tenant_id": current_tenant_id})
    
    # Get tenant statistics
    stats = get_tenant_stats(current_tenant_id)
    
    return {
        "tenant_id": tenant_info.tenant_id,
        "tenant_name": tenant_info.tenant_name,
        "primary_domain": tenant_info.primary_domain,
        "status": tenant_info.status,
        "stats": stats
    }