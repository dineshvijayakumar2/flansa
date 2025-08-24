#!/usr/bin/env python3

import frappe
from frappe.model.document import Document

class FlansaTenantRegistry(Document):
    def validate(self):
        """Validate tenant data before saving"""
        
        # Ensure tenant_id is set and valid
        if not self.tenant_id:
            frappe.throw("Tenant ID is required")
            
        # Validate tenant_id format (alphanumeric, no spaces)
        if not self.tenant_id.replace("_", "").replace("-", "").isalnum():
            frappe.throw("Tenant ID must contain only letters, numbers, hyphens, and underscores")
            
        # Ensure tenant_name is set
        if not self.tenant_name:
            frappe.throw("Tenant Name is required")
            
        # Set default values
        if not self.status:
            self.status = "Active"
            
        if not self.created_date:
            self.created_date = frappe.utils.today()
            
    def before_save(self):
        """Update statistics before saving"""
        self.update_tenant_stats()
        
    def update_tenant_stats(self):
        """Update tenant usage statistics"""
        
        try:
            # Count applications
            self.total_applications = frappe.db.count("Flansa Application", 
                                                    {"tenant_id": self.tenant_id})
            
            # Count tables  
            self.total_tables = frappe.db.count("Flansa Table",
                                              {"tenant_id": self.tenant_id})
            
            # Count relationships
            self.total_relationships = frappe.db.count("Flansa Relationship", 
                                                     {"tenant_id": self.tenant_id})
            
            # Count saved reports
            self.total_reports = frappe.db.count("Flansa Saved Report",
                                                {"tenant_id": self.tenant_id})
            
            # Count form configs
            self.total_form_configs = frappe.db.count("Flansa Form Config",
                                                    {"tenant_id": self.tenant_id})
            
            # Update last activity
            self.last_activity = frappe.utils.now()
            
        except Exception as e:
            frappe.log_error(f"Error updating tenant stats: {str(e)}")
            
    def get_domain_list(self):
        """Get list of all domains for this tenant"""
        
        domains = [self.primary_domain] if self.primary_domain else []
        
        # Add custom domains
        for custom_domain in self.custom_domains:
            if custom_domain.domain and custom_domain.domain not in domains:
                domains.append(custom_domain.domain)
                
        return domains
        
    def is_domain_verified(self, domain):
        """Check if a domain is verified for this tenant"""
        
        if domain == self.primary_domain:
            return True
            
        # Check custom domains
        for custom_domain in self.custom_domains:
            if custom_domain.domain == domain:
                return custom_domain.is_verified
                
        return False

@frappe.whitelist()
def get_tenant_by_domain(domain):
    """Get tenant information by domain"""
    
    # Check primary domain
    tenant = frappe.db.get_value("Flansa Tenant Registry", 
                                {"primary_domain": domain}, 
                                ["name", "tenant_id", "tenant_name", "status"])
    
    if tenant:
        return {
            "name": tenant[0],
            "tenant_id": tenant[1], 
            "tenant_name": tenant[2],
            "status": tenant[3]
        }
    
    # Check custom domains
    custom_domain = frappe.db.sql("""
        SELECT tr.name, tr.tenant_id, tr.tenant_name, tr.status
        FROM `tabFlansa Tenant Registry` tr
        INNER JOIN `tabFlansa Tenant Domain` td ON td.parent = tr.name
        WHERE td.domain = %s AND td.is_verified = 1
    """, (domain,), as_dict=True)
    
    if custom_domain:
        return custom_domain[0]
        
    return None

@frappe.whitelist()
def create_default_tenant():
    """Create default tenant if none exists"""
    
    # Check if any tenants exist
    if frappe.db.count("Flansa Tenant Registry") > 0:
        return {"status": "exists", "message": "Tenants already exist"}
    
    # Create default tenant
    tenant_doc = frappe.get_doc({
        "doctype": "Flansa Tenant Registry",
        "tenant_id": "default",
        "tenant_name": "Default Tenant",
        "status": "Active",
        "primary_domain": frappe.local.site or "localhost",
        "admin_email": "admin@example.com",
        "max_users": 1000,
        "max_tables": 100,
        "storage_limit_gb": 50.0,
        "features_enabled": 1,
        "api_access_enabled": 1
    })
    
    tenant_doc.insert()
    frappe.db.commit()
    
    return {
        "status": "created",
        "tenant_id": tenant_doc.tenant_id,
        "message": "Default tenant created successfully"
    }