import frappe

def get_context(context):
    context.no_cache = 1
    
    # Add any initial data needed for the page
    return context