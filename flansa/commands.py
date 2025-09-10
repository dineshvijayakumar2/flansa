"""
Flansa management commands
"""

import click
import frappe

@click.command('clear-cache')
@click.option('--site', default='mysite.local', help='Site name')
def clear_cache(site='mysite.local'):
    """Clear all caches for Flansa site"""
    frappe.init(site=site)
    frappe.connect()
    
    try:
        frappe.clear_cache()
        click.echo(f"✅ Cache cleared for site: {site}")
    except Exception as e:
        click.echo(f"❌ Error clearing cache: {str(e)}")
    finally:
        frappe.destroy()

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

@click.command('rebuild-assets')
@click.option('--site', default='mysite.local', help='Site name')
def rebuild_assets(site='mysite.local'):
    """Rebuild and clear all assets and caches"""
    import os
    
    click.echo("🔨 Building Flansa assets...")
    os.system('bench build --app flansa')
    
    click.echo("🧹 Clearing cache...")
    os.system(f'bench --site {site} clear-cache')
    
    click.echo("✅ Assets rebuilt and cache cleared!")

@click.command('sync-workspace')
@click.option('--workspace', default='Flansa', help='Workspace name to sync')
@click.option('--force', is_flag=True, help='Force sync even if customized')
@click.option('--site', default='mysite.local', help='Site name')
def sync_workspace(workspace, force, site):
    """Sync workspace from JSON file to database"""
    frappe.init(site=site)
    frappe.connect()
    
    try:
        # Import and run the sync function
        exec(open('/home/ubuntu/frappe-bench/claude-code/sync_workspace_from_json.py').read())
        click.echo(f"✅ Workspace '{workspace}' synced successfully")
    except Exception as e:
        click.echo(f"❌ Error: {str(e)}")
    finally:
        frappe.destroy()

commands = [
    clear_cache,
    force_client_refresh,
    rebuild_assets,
    sync_workspace
]
