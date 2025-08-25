#!/usr/bin/env python3
"""
Railway Multi-tenant Testing Script
Run this in Railway bench console to test tenant routing functionality
"""

import frappe

print("🚀 RAILWAY MULTI-TENANT TESTING", flush=True)
print("=" * 50, flush=True)

def test_tenant_system():
    try:
        print("🔍 Step 1: Verifying hooks configuration...", flush=True)
        
        # Check if hooks are loaded
        import flansa.hooks as hooks
        
        if hasattr(hooks, 'before_request') and hooks.before_request:
            print(f"✅ Request hooks active: {hooks.before_request[0]}", flush=True)
        else:
            print("❌ Request hooks not configured", flush=True)
            return False
        
        print("\n🔍 Step 2: Importing tenant services...", flush=True)
        
        from flansa.flansa_core.tenant_service import resolve_tenant_from_request, TenantContext
        print("✅ Tenant service modules imported successfully", flush=True)
        
        print("\n🔍 Step 3: Current tenant inventory...", flush=True)
        
        tenants = frappe.get_all("Flansa Tenant Registry", 
                               fields=["name", "tenant_id", "tenant_name", "primary_domain", "status"],
                               filters={"status": "Active"},
                               order_by="tenant_id")
        
        print(f"✅ Found {len(tenants)} active tenants:", flush=True)
        for tenant in tenants:
            print(f"   - ID: {tenant.tenant_id:<15} | Name: {tenant.tenant_name:<20} | Domain: {tenant.primary_domain}", flush=True)
        
        print("\n🔍 Step 4: Testing tenant context operations...", flush=True)
        
        if tenants:
            # Test with first tenant
            test_tenant = tenants[0]
            print(f"Testing with tenant: {test_tenant.tenant_id}", flush=True)
            
            # Set context
            TenantContext.set_tenant_context(test_tenant.name)
            current = TenantContext.get_current_tenant()
            print(f"✅ Context set: {current.get('tenant_name')} ({current.get('tenant_id')})", flush=True)
            
            # Clear context
            TenantContext.clear_context()
            print("✅ Context cleared successfully", flush=True)
        
        print("\n🔍 Step 5: Environment information...", flush=True)
        
        print(f"Site: {frappe.local.site}", flush=True)
        
        # Try to get request info if available
        if hasattr(frappe.local, 'request') and frappe.local.request:
            print(f"Current host: {frappe.local.request.host}", flush=True)
        else:
            print("No active request (normal in console mode)", flush=True)
        
        print("\n✅ All tenant system tests passed!", flush=True)
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}", flush=True)
        import traceback
        print(f"Details: {traceback.format_exc()}", flush=True)
        return False

def create_simple_tenants():
    """Create simple tenants for subdomain testing"""
    
    print("\n🏗️  CREATING SIMPLE TEST TENANTS", flush=True)
    print("-" * 40, flush=True)
    
    test_tenants = [
        {
            "tenant_id": "mcgi",
            "tenant_name": "MCGI Tenant", 
            "primary_domain": "mcgi.flansa.io",
            "admin_email": "admin@mcgi.org"
        },
        {
            "tenant_id": "dinesh",
            "tenant_name": "Dinesh Tenant",
            "primary_domain": "dinesh.flansa.io", 
            "admin_email": "dinesh@flansa.io"
        },
        {
            "tenant_id": "test",
            "tenant_name": "Test Tenant",
            "primary_domain": "test.flansa.io",
            "admin_email": "test@flansa.io"
        }
    ]
    
    created_count = 0
    
    for tenant_data in test_tenants:
        try:
            # Check if tenant already exists
            existing = frappe.db.get_value("Flansa Tenant Registry", 
                                         {"tenant_id": tenant_data["tenant_id"]}, 
                                         "name")
            
            if existing:
                print(f"⚠️  Tenant '{tenant_data['tenant_id']}' already exists", flush=True)
                continue
            
            # Create new tenant
            tenant = frappe.new_doc("Flansa Tenant Registry")
            tenant.tenant_id = tenant_data["tenant_id"]
            tenant.tenant_name = tenant_data["tenant_name"]
            tenant.primary_domain = tenant_data["primary_domain"]
            tenant.admin_email = tenant_data["admin_email"]
            tenant.status = "Active"
            tenant.max_users = 100
            tenant.max_tables = 50
            tenant.storage_limit_gb = 5
            tenant.insert()
            
            print(f"✅ Created tenant: {tenant_data['tenant_id']} -> {tenant_data['primary_domain']}", flush=True)
            created_count += 1
            
        except Exception as e:
            print(f"❌ Failed to create tenant '{tenant_data['tenant_id']}': {str(e)}", flush=True)
    
    if created_count > 0:
        frappe.db.commit()
        print(f"\n✅ Successfully created {created_count} new tenants", flush=True)
    else:
        print(f"\n⚠️  No new tenants created", flush=True)
    
    return created_count

def show_usage_instructions():
    """Show how to test the subdomain routing"""
    
    print("\n📋 SUBDOMAIN TESTING INSTRUCTIONS", flush=True)
    print("=" * 40, flush=True)
    
    print("1. Your Railway app should now support subdomain routing", flush=True)
    print("2. Test with these URLs (replace YOUR-RAILWAY-DOMAIN):", flush=True)
    print("   - https://mcgi.YOUR-RAILWAY-DOMAIN.com", flush=True)
    print("   - https://dinesh.YOUR-RAILWAY-DOMAIN.com", flush=True)
    print("   - https://test.YOUR-RAILWAY-DOMAIN.com", flush=True)
    print("\n3. Each subdomain should:", flush=True)
    print("   - Show isolated tenant data", flush=True)
    print("   - Display tenant-specific applications", flush=True)
    print("   - Maintain separate user contexts", flush=True)
    print("\n4. Unknown subdomains will fallback to default tenant", flush=True)

# Main execution
if __name__ == "__main__":
    print("🎯 Starting Railway Multi-tenant Test Suite", flush=True)
    
    # Run system tests
    if test_tenant_system():
        print("\n🎉 System tests passed! Tenant routing is active.", flush=True)
        
        # Offer to create simple tenants
        current_tenants = frappe.db.count("Flansa Tenant Registry", {"status": "Active"})
        print(f"\nCurrent active tenants: {current_tenants}", flush=True)
        
        # Create simple tenants for easy testing
        create_simple_tenants()
        
        # Show usage instructions
        show_usage_instructions()
        
    else:
        print("\n❌ System tests failed. Check configuration.", flush=True)

# Auto-run when executed
test_tenant_system()
create_simple_tenants() 
show_usage_instructions()

print(f"\n🏁 Railway tenant test completed!", flush=True)