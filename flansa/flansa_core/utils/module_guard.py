"""
Module Guard - Prevents unwanted module/folder creation outside flansa_core
"""

import frappe
import os
from frappe import _

# List of allowed modules for Flansa app
ALLOWED_MODULES = [
    'Flansa Core',      # Main development module
    'Flansa Public',    # Public forms and APIs
    'Flansa Generated'  # Auto-generated content
]

# Folders that should NOT be created
FORBIDDEN_FOLDERS = [
    'flansa_builder',
    'flansa_platform', 
    'flansa_table_builder',
    'flansa_app_builder'
]

def validate_module_creation(module_name, app_name='flansa'):
    """
    Validate if a module can be created
    
    Args:
        module_name (str): Name of the module to create
        app_name (str): Name of the app (default: flansa)
    
    Raises:
        frappe.ValidationError: If module creation is not allowed
    """
    
    if app_name != 'flansa':
        return  # Only guard Flansa app
    
    if module_name not in ALLOWED_MODULES:
        frappe.throw(_(
            "⚠️  MODULE CREATION BLOCKED\n\n"
            "Module '{0}' is not allowed for Flansa app.\n\n"
            "✅ ALLOWED MODULES:\n"
            "• Flansa Core (main development)\n"
            "• Flansa Public (public forms/APIs)\n"
            "• Flansa Generated (auto-generated)\n\n"
            "❌ All new UI components should be created within 'Flansa Core' module.\n\n"
            "Please confirm with the development team before creating new modules."
        ).format(module_name))

def validate_folder_creation(folder_path):
    """
    Validate if a folder can be created in the Flansa app
    
    Args:
        folder_path (str): Path of the folder to create
    
    Raises:
        frappe.ValidationError: If folder creation is not allowed
    """
    
    # Check if this is within the Flansa app
    if '/apps/flansa/flansa/' not in folder_path:
        return  # Only guard Flansa app folders
    
    # Extract folder name
    folder_name = os.path.basename(folder_path)
    
    # Check forbidden folders
    if folder_name in FORBIDDEN_FOLDERS:
        frappe.throw(_(
            "⚠️  FOLDER CREATION BLOCKED\n\n"
            "Folder '{0}' is not allowed.\n\n"
            "❌ FORBIDDEN FOLDERS:\n"
            "{1}\n\n"
            "✅ All new components should be created within:\n"
            "• /flansa_core/ folder structure\n\n"
            "This prevents module conflicts and migration issues.\n"
            "Please confirm with the development team if you need this folder."
        ).format(folder_name, '\n'.join(f'• {f}' for f in FORBIDDEN_FOLDERS)))
    
    # Check if trying to create new flansa_* folders
    if folder_name.startswith('flansa_') and folder_name not in ['flansa_core', 'flansa_public', 'flansa_generated']:
        frappe.throw(_(
            "⚠️  NEW FLANSA FOLDER BLOCKED\n\n"
            "Creating new 'flansa_*' folders is not allowed: '{0}'\n\n"
            "✅ USE EXISTING STRUCTURE:\n"
            "• flansa_core/ - Main development\n"
            "• flansa_public/ - Public forms/APIs\n"
            "• flansa_generated/ - Auto-generated content\n\n"
            "Create your components within these existing folders.\n"
            "Please confirm with the development team if you need a new module structure."
        ).format(folder_name))

def check_modules_txt_consistency():
    """
    Check if modules.txt matches allowed modules
    
    Returns:
        dict: Status and issues found
    """
    
    modules_file = '/home/ubuntu/frappe-bench/apps/flansa/flansa/modules.txt'
    
    try:
        with open(modules_file, 'r') as f:
            file_modules = [line.strip() for line in f.readlines() if line.strip()]
        
        issues = []
        
        # Check for forbidden modules in file
        for module in file_modules:
            if module not in ALLOWED_MODULES:
                issues.append(f"Unauthorized module in modules.txt: {module}")
        
        # Check for missing allowed modules
        for module in ALLOWED_MODULES:
            if module not in file_modules:
                issues.append(f"Missing allowed module in modules.txt: {module}")
        
        return {
            'status': 'clean' if not issues else 'issues',
            'file_modules': file_modules,
            'allowed_modules': ALLOWED_MODULES,
            'issues': issues
        }
        
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }

@frappe.whitelist()
def get_module_guard_status():
    """
    Get current module guard status
    
    Returns:
        dict: Current status and configuration
    """
    
    # Check modules.txt
    modules_check = check_modules_txt_consistency()
    
    # Check database modules
    db_modules = frappe.db.sql("""
        SELECT name FROM `tabModule Def` 
        WHERE app_name = 'flansa'
        ORDER BY name
    """, as_dict=True)
    
    db_module_names = [m.name for m in db_modules]
    
    return {
        'allowed_modules': ALLOWED_MODULES,
        'forbidden_folders': FORBIDDEN_FOLDERS,
        'modules_txt_check': modules_check,
        'database_modules': db_module_names,
        'guard_active': True,
        'message': 'Module guard is active. All new components should be created within flansa_core.'
    }

# Hook functions to integrate with Frappe
def before_insert_module_def(doc, method):
    """Hook: Validate module creation before insert"""
    if doc.app_name == 'flansa':
        validate_module_creation(doc.name, doc.app_name)

def before_insert_doctype(doc, method):  
    """Hook: Validate DocType module assignment"""
    if doc.app == 'flansa' and doc.module not in ALLOWED_MODULES:
        frappe.throw(_(
            "DocType '{0}' cannot be created in module '{1}'.\n"
            "Use one of the allowed modules: {2}"
        ).format(doc.name, doc.module, ', '.join(ALLOWED_MODULES)))

def before_insert_page(doc, method):
    """Hook: Validate Page module assignment"""  
    if hasattr(doc, 'app') and doc.app == 'flansa' and doc.module not in ALLOWED_MODULES:
        frappe.throw(_(
            "Page '{0}' cannot be created in module '{1}'.\n"
            "Use one of the allowed modules: {2}"
        ).format(doc.name, doc.module, ', '.join(ALLOWED_MODULES)))
    elif doc.name and 'flansa' in doc.name.lower() and doc.module not in ALLOWED_MODULES:
        frappe.throw(_(
            "Flansa page '{0}' cannot be created in module '{1}'.\n"
            "Use 'Flansa Core' module for all Flansa pages."
        ).format(doc.name, doc.module))