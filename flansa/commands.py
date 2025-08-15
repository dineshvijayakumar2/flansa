"""
Flansa management commands
"""

import click
import frappe

@click.command('resync-fields')
@click.option('--table', help='Specific table ID to resync')
@click.option('--all', is_flag=True, help='Resync all tables')
@click.option('--site', default='all', help='Site name (default: all)')
def resync_fields(table=None, all=False, site='all'):
    """Resync fields between Flansa Field and JSON storage"""
    
    frappe.init(site=site)
    frappe.connect()
    
    if all:
        # Get all tables with fields
        tables = frappe.db.sql("""
            SELECT DISTINCT flansa_table 
            FROM `tabFlansa Field` 
            WHERE flansa_table IS NOT NULL AND flansa_table != ''
        """, as_dict=True)
        
        click.echo(f"Resyncing {len(tables)} tables...")
        
        for table_info in tables:
            table_id = table_info.flansa_table
            result = resync_table_fields(table_id)
            click.echo(f"  {table_id}: {result}")
    
    elif table:
        result = resync_table_fields(table)
        click.echo(f"Resync result for {table}: {result}")
    
    else:
        click.echo("Please specify --table <table_id> or --all")

def resync_table_fields(table_id):
    """Resync fields for a specific table"""
    try:
        from flansa.flansa_core.utils.auto_sync import bulk_sync_table
        result = bulk_sync_table(table_id)
        frappe.db.commit()
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

@click.command('force-client-refresh')
@click.option('--site', required=True, help='Site name')
@click.option('--message', default='System update available. Please refresh.', help='Message to show users')
def force_client_refresh(site, message='System update available. Please refresh.'):
    """Force all connected clients to refresh their browsers"""
    
    frappe.init(site=site)
    frappe.connect()
    
    # Send real-time event to all connected users
    frappe.publish_realtime(
        event='force_refresh',
        message={
            'message': message,
            'action': 'refresh'
        },
        user='all'
    )
    
    click.echo(f"Refresh notification sent to all users on {site}")
    frappe.destroy()

@click.command('bump-version')
@click.option('--site', default='mysite.local', help='Site name')
@click.option('--version', help='Version number (e.g., 1.0.1)')
def bump_version(site='mysite.local', version=None):
    """Bump Flansa version to force cache refresh"""
    
    import datetime
    
    if not version:
        version = datetime.datetime.now().strftime('%Y%m%d.%H%M')
    
    # Update version in version manager
    version_file = '/home/ubuntu/frappe-bench/apps/flansa/flansa/public/js/flansa-version-manager.js'
    
    with open(version_file, 'r') as f:
        content = f.read()
    
    import re
    content = re.sub(
        r"this\.version = '[^']+';",
        f"this.version = 'v{version}';",
        content
    )
    
    with open(version_file, 'w') as f:
        f.write(content)
    
    click.echo(f"Version bumped to v{version}")
    click.echo("Running bench build...")
    
    import os
    os.system('bench build --app flansa')
    os.system(f'bench --site {site} clear-cache')
    
    click.echo("Done! Users will be prompted to refresh on next page load.")

commands = [
    resync_fields,
    force_client_refresh,
    bump_version
]
