#!/usr/bin/env python3

import frappe
from frappe.model.document import Document

def get_db_type():
    """Get current database type"""
    return getattr(frappe.conf, 'db_type', 'mariadb')

def get_table_name(doctype):
    """Get properly quoted table name based on database type"""
    table = f"tab{doctype.replace(' ', '_')}"
    if get_db_type() == 'postgres':
        return f'"{table}"'
    else:
        return f'`{table}`'

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
        # Skip stats update if explicitly disabled (e.g., during manual edits)
        if not getattr(self.flags, 'ignore_stats_update', False):
            self.update_tenant_stats()
        
    def update_tenant_stats(self):
        """Update tenant usage statistics - works with both databases"""
        
        try:
            # Database-agnostic approach using frappe methods
            # These work with both MariaDB and PostgreSQL
            
            # Check if tables exist before counting
            doctypes_to_count = [
                ("total_applications", "Flansa Application"),
                ("total_tables", "Flansa Table"),
                ("total_relationships", "Flansa Relationship"),
                ("total_reports", "Flansa Saved Report"),
                ("total_form_configs", "Flansa Form Config")
            ]
            
            for field_name, doctype in doctypes_to_count:
                try:
                    # Check if DocType exists
                    if frappe.db.exists("DocType", doctype):
                        # Use frappe.db.count which works with both databases
                        count = frappe.db.count(doctype, {"tenant_id": self.tenant_id})
                        setattr(self, field_name, count or 0)
                    else:
                        # DocType doesn't exist yet
                        setattr(self, field_name, 0)
                except Exception:
                    # If table doesn't exist or any error, set to 0
                    setattr(self, field_name, 0)
            
            # Update last activity
            self.last_activity = frappe.utils.now()
            
        except Exception as e:
            # Don't use frappe.log_error in before_save - it can cause recursion
            # Instead, set defaults silently
            self.total_applications = 0
            self.total_tables = 0
            self.total_relationships = 0
            self.total_reports = 0
            self.total_form_configs = 0
            # Optionally log to console for debugging
            if frappe.conf.developer_mode:
                print(f"Note: Tenant stats update skipped: {str(e)}", flush=True)
            
    def get_domain_list(self):
        """Get list of all domains for this tenant"""
        
        domains = [self.primary_domain] if self.primary_domain else []
        
        # Add custom domains (handle None case)
        if self.custom_domains:
            for custom_domain in self.custom_domains:
                if custom_domain.domain and custom_domain.domain not in domains:
                    domains.append(custom_domain.domain)
                
        return domains
        
    def is_domain_verified(self, domain):
        """Check if a domain is verified for this tenant"""
        
        if domain == self.primary_domain:
            return True
            
        # Check custom domains (handle None case)
        if self.custom_domains:
            for custom_domain in self.custom_domains:
                if custom_domain.domain == domain:
                    return custom_domain.is_verified
                
        return False

@frappe.whitelist()
def get_tenant_by_domain(domain):
    """Get tenant information by domain - database agnostic"""
    
    try:
        # Method 1: Use frappe.db.get_value (works with both databases)
        tenant = frappe.db.get_value(
            "Flansa Tenant Registry", 
            {"primary_domain": domain}, 
            ["name", "tenant_id", "tenant_name", "status"],
            as_dict=True
        )
        
        if tenant:
            return tenant
        
        # Method 2: Check custom domains using frappe methods
        # Get all tenants with custom domains
        tenants = frappe.get_all(
            "Flansa Tenant Registry",
            fields=["name", "tenant_id", "tenant_name", "status"]
        )
        
        for tenant in tenants:
            doc = frappe.get_doc("Flansa Tenant Registry", tenant.name)
            if doc.custom_domains:
                for custom_domain in doc.custom_domains:
                    if custom_domain.domain == domain:
                        return {
                            "name": doc.name,
                            "tenant_id": doc.tenant_id,
                            "tenant_name": doc.tenant_name,
                            "status": doc.status
                        }
        
        return None
        
    except Exception as e:
        # Return None on error
        if frappe.conf.developer_mode:
            print(f"Error getting tenant by domain: {str(e)}", flush=True)
        return None

@frappe.whitelist()
def activate_tenant(tenant_id):
    """Activate a tenant - database agnostic"""
    try:
        # Use frappe.get_doc which works with both databases
        tenant = frappe.get_doc("Flansa Tenant Registry", {"tenant_id": tenant_id})
        tenant.status = "Active"
        tenant.save()
        frappe.db.commit()
        return {"status": "success", "message": f"Tenant {tenant_id} activated"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def deactivate_tenant(tenant_id):
    """Deactivate a tenant - database agnostic"""
    try:
        # Use frappe.get_doc which works with both databases
        tenant = frappe.get_doc("Flansa Tenant Registry", {"tenant_id": tenant_id})
        tenant.status = "Inactive"
        tenant.save()
        frappe.db.commit()
        return {"status": "success", "message": f"Tenant {tenant_id} deactivated"}
    except Exception as e:
        frappe.db.rollback()
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def get_tenant_statistics(tenant_id):
    """Get detailed statistics for a tenant - database agnostic"""
    try:
        tenant = frappe.get_doc("Flansa Tenant Registry", {"tenant_id": tenant_id})
        
        # Update stats before returning
        tenant.update_tenant_stats()
        
        return {
            "status": "success",
            "statistics": {
                "applications": tenant.total_applications,
                "tables": tenant.total_tables,
                "relationships": tenant.total_relationships,
                "reports": tenant.total_reports,
                "form_configs": tenant.total_form_configs,
                "last_activity": tenant.last_activity
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
