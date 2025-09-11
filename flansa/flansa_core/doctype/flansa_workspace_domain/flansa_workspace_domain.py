#!/usr/bin/env python3

import frappe
from frappe.model.document import Document
import hashlib
import time

class FlansaWorkspaceDomain(Document):
    def validate(self):
        """Validate domain before saving"""
        
        if not self.domain:
            frappe.throw("Domain is required")
            
        # Basic domain validation
        if not self._is_valid_domain(self.domain):
            frappe.throw("Invalid domain format")
            
        # Generate verification token if not set
        if not self.verification_token:
            self.verification_token = self._generate_verification_token()
            
        # Set default status
        if not self.verification_status:
            self.verification_status = "Pending"
            
    def _is_valid_domain(self, domain):
        """Basic domain validation"""
        import re
        
        # Basic regex for domain validation
        domain_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
        return re.match(domain_pattern, domain) is not None
        
    def _generate_verification_token(self):
        """Generate verification token for domain"""
        
        unique_string = f"{self.domain}_{time.time()}_{frappe.session.user}"
        return hashlib.md5(unique_string.encode()).hexdigest()[:16]
        
    def verify_domain(self):
        """Mark domain as verified"""
        
        self.is_verified = 1
        self.verification_status = "Verified"
        self.verified_date = frappe.utils.now()
        self.last_checked = frappe.utils.now()
        self.save()
        
    def mark_verification_failed(self, reason=None):
        """Mark domain verification as failed"""
        
        self.is_verified = 0
        self.verification_status = "Failed"
        self.last_checked = frappe.utils.now()
        self.save()
        
        if reason:
            frappe.log_error(f"Domain verification failed for {self.domain}: {reason}")

@frappe.whitelist()
def verify_domain_ownership(domain, token):
    """Verify domain ownership using token"""
    
    domain_doc = frappe.get_doc("Flansa Tenant Domain", {"domain": domain, "verification_token": token})
    
    if not domain_doc:
        return {"status": "error", "message": "Invalid domain or token"}
    
    # In a real implementation, this would check DNS records or file verification
    # For now, we'll simulate verification
    domain_doc.verify_domain()
    
    return {"status": "success", "message": "Domain verified successfully"}

@frappe.whitelist()  
def check_domain_availability(domain):
    """Check if domain is available for registration"""
    
    # Check if domain is already registered
    existing = frappe.db.exists("Flansa Tenant Domain", {"domain": domain})
    if existing:
        return {"available": False, "message": "Domain already registered"}
    
    # Check if it's used as primary domain
    primary_domain = frappe.db.exists("Flansa Tenant Registry", {"primary_domain": domain})
    if primary_domain:
        return {"available": False, "message": "Domain used as primary domain"}
    
    return {"available": True, "message": "Domain is available"}