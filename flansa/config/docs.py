"""
Configuration for documentation
"""

source_link = "https://github.com/flansa-team/flansa"
docs_base_url = "https://flansa.io/docs"
headline = "No-code platform for citizen developers"
sub_heading = "Build powerful applications without coding"

def get_context(context):
    context.brand_html = "Flansa"
    context.top_bar_items = [
        {"label": "Workspace", "url": "/app/flansa-workspace"},
        {"label": "Visual Builder", "url": "/app/List/Flansa Table"},
        {"label": "Documentation", "url": "https://flansa.io/docs"},
    ]