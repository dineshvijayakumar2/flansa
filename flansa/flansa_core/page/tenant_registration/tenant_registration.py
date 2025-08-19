import frappe
import re
import hashlib
import time

@frappe.whitelist()
def register_new_tenant(**kwargs):
    """Register a new tenant in the system"""
    
    try:
        # Extract parameters from kwargs
        tenant_name = kwargs.get('tenant_name')
        admin_email = kwargs.get('admin_email')
        primary_domain = kwargs.get('primary_domain')
        max_users = kwargs.get('max_users', 100)
        max_tables = kwargs.get('max_tables', 50)
        storage_limit_gb = kwargs.get('storage_limit_gb', 10.0)
        custom_branding = kwargs.get('custom_branding', 0)
        custom_domains = kwargs.get('custom_domains')
        
        # Validate required fields
        if not tenant_name:
            frappe.throw("Tenant Name is required")
        
        if not admin_email:
            frappe.throw("Admin Email is required")
        
        # Generate tenant ID from tenant name
        tenant_id = generate_tenant_id(tenant_name)
        
        # Check if tenant ID already exists
        if frappe.db.exists("Flansa Tenant Registry", {"tenant_id": tenant_id}):
            frappe.throw(f"Tenant with ID '{tenant_id}' already exists")
        
        # Validate email format
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', admin_email):
            frappe.throw("Invalid email format")
        
        # Generate primary domain if not provided
        if not primary_domain:
            primary_domain = f"{tenant_id}.flansa.local"
        
        # Create tenant registry document
        tenant_doc = frappe.get_doc({
            "doctype": "Flansa Tenant Registry",
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "status": "Active",
            "primary_domain": primary_domain,
            "admin_email": admin_email,
            "max_users": int(max_users),
            "max_tables": int(max_tables),
            "storage_limit_gb": float(storage_limit_gb),
            "features_enabled": 1,
            "api_access_enabled": 1,
            "custom_branding": int(custom_branding)
        })
        
        # Add custom domains if provided
        if custom_domains:
            # Handle string input
            if isinstance(custom_domains, str) and custom_domains.strip():
                domains_list = custom_domains.split('\n')
            elif isinstance(custom_domains, list):
                domains_list = custom_domains
            else:
                domains_list = []
                
            for domain in domains_list:
                if domain and domain.strip():
                    tenant_doc.append('custom_domains', {
                        'domain': domain.strip(),
                        'is_verified': 0,
                        'verification_status': 'Pending'
                    })
        
        tenant_doc.insert()
        frappe.db.commit()
        
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "primary_domain": primary_domain,
            "message": f"Tenant '{tenant_name}' registered successfully"
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.throw(f"Failed to register tenant: {str(e)}")

def generate_tenant_id(tenant_name):
    """Generate a unique tenant ID from tenant name"""
    
    # Clean the tenant name
    cleaned_name = re.sub(r'[^a-zA-Z0-9\s]', '', tenant_name.lower())
    cleaned_name = re.sub(r'\s+', '_', cleaned_name.strip())
    
    # Take first 20 characters
    base_id = cleaned_name[:20]
    
    # Add timestamp-based suffix to ensure uniqueness
    timestamp_suffix = str(int(time.time()))[-6:]
    
    tenant_id = f"{base_id}_{timestamp_suffix}"
    
    # Ensure it's not too long
    if len(tenant_id) > 30:
        tenant_id = tenant_id[:30]
    
    return tenant_id

@frappe.whitelist()
def check_tenant_id_availability(tenant_name):
    """Check if a tenant ID generated from the name is available"""
    
    tenant_id = generate_tenant_id(tenant_name)
    exists = frappe.db.exists("Flansa Tenant Registry", {"tenant_id": tenant_id})
    
    return {
        "tenant_id": tenant_id,
        "available": not exists
    }

@frappe.whitelist()
def validate_domain(domain):
    """Validate a domain name"""
    
    # Basic domain validation
    domain_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
    
    if not re.match(domain_pattern, domain):
        return {"valid": False, "message": "Invalid domain format"}
    
    # Check if domain is already in use
    existing_primary = frappe.db.exists("Flansa Tenant Registry", {"primary_domain": domain})
    if existing_primary:
        return {"valid": False, "message": "Domain already used as primary domain"}
    
    existing_custom = frappe.db.sql("""
        SELECT parent FROM `tabFlansa Tenant Domain` 
        WHERE domain = %s
    """, (domain,))
    
    if existing_custom:
        return {"valid": False, "message": "Domain already registered as custom domain"}
    
    return {"valid": True, "message": "Domain is available"}

@frappe.whitelist()
def get_tenant_limits():
    """Get available tenant limit options"""
    
    return {
        "user_limits": [10, 25, 50, 100, 250, 500, 1000],
        "table_limits": [5, 10, 25, 50, 100, 200],
        "storage_limits": [1, 5, 10, 25, 50, 100]  # GB
    }

@frappe.whitelist()
def get_available_tenants():
    """Get list of available tenants for display"""
    
    tenants = frappe.get_all("Flansa Tenant Registry",
                           filters={"status": "Active"},
                           fields=["tenant_id", "tenant_name", "primary_domain", "status"],
                           order_by="tenant_name")
    
    return tenants