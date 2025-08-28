#!/usr/bin/env python3
"""
Railway: Check and fix Frappe navbar visibility issues
Run this in Railway SSH console
"""

import frappe
import os

print("🚂 RAILWAY NAVBAR VISIBILITY FIX", flush=True)
print("=" * 50, flush=True)

try:
    print("Step 1: Checking navbar settings in database...", flush=True)
    
    # Check navbar settings
    navbar_settings = frappe.get_single("Navbar Settings")
    print(f"✅ Navbar Settings found:", flush=True)
    print(f"   • App Logo URL: {navbar_settings.app_logo_url}", flush=True)
    
    # Check if navbar is hidden in settings
    if hasattr(navbar_settings, 'hide_navbar') and navbar_settings.hide_navbar:
        print("❌ Navbar is hidden in settings - enabling...", flush=True)
        navbar_settings.hide_navbar = 0
        navbar_settings.save()
        frappe.db.commit()
        print("✅ Navbar enabled in settings", flush=True)
    else:
        print("✅ Navbar not hidden in settings", flush=True)
    
    print("Step 2: Checking app logo and brand settings...", flush=True)
    
    # Check website settings that affect navbar
    website_settings = frappe.get_single("Website Settings")
    print(f"   • Brand HTML: {website_settings.brand_html[:50] if website_settings.brand_html else 'None'}...", flush=True)
    print(f"   • App Logo: {website_settings.app_logo}", flush=True)
    
    print("Step 3: Checking flansa hooks configuration...", flush=True)
    
    # Check current CSS includes for navbar interference
    from flansa.hooks import app_include_css, app_include_js
    
    print("Current CSS includes:", flush=True)
    for css in app_include_css:
        print(f"   • {css}", flush=True)
        
        # Check if any CSS files contain navbar hiding rules
        if 'navbar' in css.lower():
            print(f"     ⚠️  Potential navbar CSS: {css}", flush=True)
    
    print("Current JS includes:", flush=True)
    navbar_js_found = False
    for js in app_include_js:
        print(f"   • {js}", flush=True)
        if 'navbar' in js.lower() or 'logo' in js.lower():
            navbar_js_found = True
            print(f"     ⚠️  Potential navbar JS: {js}", flush=True)
    
    if not navbar_js_found:
        print("✅ No obvious navbar interference JS files", flush=True)
    
    print("Step 4: Checking for hidden navbar CSS rules...", flush=True)
    
    # Check if any CSS files are hiding the navbar
    css_files_to_check = [
        "/workspace/apps/flansa/flansa/public/css/flansa-theme-vars.css",
        "/workspace/apps/flansa/flansa/public/css/flansa-theme-components.css", 
        "/workspace/apps/flansa/flansa/public/css/flansa-theme-updated.css",
        "/workspace/apps/flansa/flansa/public/css/flansa-workspace-minimal.css"
    ]
    
    navbar_hidden_by_css = False
    for css_file in css_files_to_check:
        if os.path.exists(css_file):
            try:
                with open(css_file, 'r') as f:
                    content = f.read()
                    # Check for navbar hiding rules
                    if '.navbar' in content and 'display: none' in content:
                        print(f"❌ Found navbar hiding in: {css_file}", flush=True)
                        navbar_hidden_by_css = True
                    elif '.navbar' in content and 'visibility: hidden' in content:
                        print(f"❌ Found navbar hiding in: {css_file}", flush=True)
                        navbar_hidden_by_css = True
                    else:
                        print(f"✅ {os.path.basename(css_file)} - no navbar hiding", flush=True)
            except Exception as e:
                print(f"⚠️  Could not read {css_file}: {str(e)}", flush=True)
        else:
            print(f"⚠️  File not found: {css_file}", flush=True)
    
    print("Step 5: Checking workspace configuration...", flush=True)
    
    # Check the default workspace
    try:
        flansa_workspace = frappe.get_doc("Workspace", "Flansa")
        print(f"✅ Flansa workspace found:", flush=True)
        print(f"   • Title: {flansa_workspace.title}", flush=True)
        print(f"   • Public: {flansa_workspace.public}", flush=True)
        print(f"   • Is Hidden: {flansa_workspace.is_hidden}", flush=True)
        
        if flansa_workspace.is_hidden:
            print("❌ Workspace is hidden - making visible...", flush=True)
            flansa_workspace.is_hidden = 0
            flansa_workspace.save()
            frappe.db.commit()
            print("✅ Workspace made visible", flush=True)
    except Exception as e:
        print(f"❌ Error checking workspace: {str(e)}", flush=True)
    
    print("Step 6: Clearing all caches...", flush=True)
    frappe.clear_cache()
    
    # Clear website cache specifically
    frappe.clear_website_cache()
    print("✅ All caches cleared", flush=True)
    
    print("\n🎯 NAVBAR TROUBLESHOOTING SUMMARY:", flush=True)
    
    if navbar_hidden_by_css:
        print("❌ Navbar is being hidden by CSS files", flush=True)
        print("   Solution: Update CSS files to remove navbar hiding rules", flush=True)
    else:
        print("✅ No CSS navbar hiding detected", flush=True)
    
    print("\n🔧 RAILWAY NAVBAR FIXES TO TRY:", flush=True)
    print("1. Add this CSS override in Railway browser console:", flush=True)
    print("   document.querySelector('.navbar').style.display = 'block !important';", flush=True)
    print("2. Check browser dev tools for console errors", flush=True)
    print("3. Verify user has proper roles (System Manager/Flansa Admin)", flush=True)
    print("4. Try incognito/private browsing mode", flush=True)
    print("5. Hard refresh (Ctrl+F5 or Cmd+Shift+R)", flush=True)
    
    print("\n✅ Railway navbar check completed!", flush=True)
    
except Exception as e:
    print(f"❌ Error: {str(e)}", flush=True)
    import traceback
    print(f"🔍 Details: {traceback.format_exc()}", flush=True)