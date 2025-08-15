from frappe import _

def get_data():
    return [
        {
            "category": "Modules",
            "color": "#2196F3",
            "icon": "/assets/flansa/images/flansa-icon.svg",
            "type": "page",
            "link": "flansa-workspace",
            "description": _("Build no-code applications visually"),
            "_doctype": "",
            "hidden": 0
        },
        {
            "module_name": "Flansa Core",
            "category": "Modules", 
            "label": _("Visual Builder"),
            "color": "#FF9800",
            "icon": "/assets/frappe/images/frappe-framework-logo.svg",
            "type": "list",
            "link": "List/Flansa Table",
            "description": _("Create and manage tables, fields, and relationships"),
            "_doctype": "Flansa Table",
            "hidden": 0
        }
    ]