"""
Clean Delete API for Flansa Apps and Tables
Safely removes apps/tables and all connected resources
"""

import frappe
import json
from frappe import _

@frappe.whitelist()
def clean_delete_app(app_name):
    """
    Completely delete a Flansa Application and all connected resources
    """
    try:
        # Validate app exists
        if not frappe.db.exists('Flansa Application', app_name):
            return {'success': False, 'error': f'Application {app_name} not found'}
        
        print(f"🗑️ Starting clean delete of application: {app_name}", flush=True)
        
        # Get app details for logging
        app_doc = frappe.get_doc('Flansa Application', app_name)
        app_label = app_doc.app_title or app_doc.app_name or app_name
        
        deletion_log = []
        
        # Step 1: Find all tables in this app
        tables = frappe.get_all('Flansa Table', 
                               filters={'application': app_name}, 
                               fields=['name', 'table_name', 'doctype_name'])
        
        print(f"📋 Found {len(tables)} tables to delete", flush=True)
        deletion_log.append(f"Found {len(tables)} tables in application")
        
        # Step 2: Delete each table cleanly
        for table in tables:
            print(f"   Deleting table: {table.name} ({table.table_name})", flush=True)
            table_result = clean_delete_table(table.name)
            
            if table_result.get('success'):
                deletion_log.append(f"✅ Table {table.table_name}: {table_result.get('summary', 'Deleted successfully')}")
            else:
                deletion_log.append(f"❌ Table {table.table_name}: {table_result.get('error', 'Failed to delete')}")
                print(f"   ⚠️ Warning: Failed to delete table {table.name}: {table_result.get('error')}", flush=True)
        
        # Step 3: Delete application-level resources
        
        # Delete relationships where this app is involved
        relationships = frappe.get_all('Flansa Relationship',
                                     filters=[
                                         ['parent_table', 'in', [t.name for t in tables]],
                                         ['child_table', 'in', [t.name for t in tables]]
                                     ])
        for rel in relationships:
            frappe.delete_doc('Flansa Relationship', rel.name, force=True)
        
        deletion_log.append(f"✅ Deleted {len(relationships)} relationships")
        
        # Delete saved reports for this app's tables
        reports = frappe.get_all('Flansa Saved Report',
                               filters={'base_table': ['in', [t.name for t in tables]]})
        for report in reports:
            frappe.delete_doc('Flansa Saved Report', report.name, force=True)
        
        deletion_log.append(f"✅ Deleted {len(reports)} saved reports")
        
        # Delete form configs for this app's tables  
        form_configs = frappe.get_all('Flansa Form Config',
                                    filters={'table_name': ['in', [t.name for t in tables]]})
        for config in form_configs:
            frappe.delete_doc('Flansa Form Config', config.name, force=True)
        
        deletion_log.append(f"✅ Deleted {len(form_configs)} form configurations")
        
        # Step 4: Finally delete the application document
        frappe.delete_doc('Flansa Application', app_name, force=True)
        deletion_log.append(f"✅ Deleted application document")
        
        # Commit all changes
        frappe.db.commit()
        
        print(f"🎉 Successfully deleted application: {app_label}", flush=True)
        
        return {
            'success': True,
            'message': f'Application "{app_label}" deleted successfully',
            'deletion_log': deletion_log,
            'summary': f'Deleted application with {len(tables)} tables, {len(relationships)} relationships, {len(reports)} reports, and {len(form_configs)} form configs'
        }
        
    except Exception as e:
        frappe.db.rollback()
        print(f"❌ Error during app deletion: {str(e)}", flush=True)
        frappe.log_error(f"Clean delete app error: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist() 
def clean_delete_table(table_name):
    """
    Completely delete a Flansa Table and all connected resources
    """
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        print(f"🗑️ Starting clean delete of table: {table_name}", flush=True)
        
        # Get table details
        table_doc = frappe.get_doc('Flansa Table', table_name)
        table_label = table_doc.table_label or table_doc.table_name
        doctype_name = table_doc.doctype_name
        
        deletion_log = []
        
        # Step 1: Delete all records in the DocType (if it exists)
        record_count = 0
        if doctype_name and frappe.db.exists('DocType', doctype_name):
            try:
                # Count records first
                record_count = frappe.db.count(doctype_name)
                
                if record_count > 0:
                    print(f"   Deleting {record_count} data records...", flush=True)
                    # Delete all records
                    frappe.db.sql(f"DELETE FROM `tab{doctype_name}`")
                    deletion_log.append(f"✅ Deleted {record_count} data records")
                
            except Exception as e:
                deletion_log.append(f"⚠️ Could not delete data records: {str(e)}")
        
        # Step 2: Delete connected resources
        
        # Delete saved reports for this table
        reports = frappe.get_all('Flansa Saved Report', filters={'base_table': table_name})
        for report in reports:
            frappe.delete_doc('Flansa Saved Report', report.name, force=True)
        deletion_log.append(f"✅ Deleted {len(reports)} saved reports")
        
        # Delete form config for this table
        if frappe.db.exists('Flansa Form Config', table_name):
            frappe.delete_doc('Flansa Form Config', table_name, force=True)
            deletion_log.append(f"✅ Deleted form configuration")
        
        # Delete relationships where this table is parent or child
        parent_rels = frappe.get_all('Flansa Relationship', filters={'parent_table': table_name})
        child_rels = frappe.get_all('Flansa Relationship', filters={'child_table': table_name})
        
        for rel in parent_rels + child_rels:
            frappe.delete_doc('Flansa Relationship', rel.name, force=True)
        
        total_rels = len(parent_rels) + len(child_rels)
        deletion_log.append(f"✅ Deleted {total_rels} relationships")
        
        # Delete logic fields for this table
        logic_fields = frappe.get_all('Flansa Logic Field', filters={'table_name': table_name})
        for field in logic_fields:
            frappe.delete_doc('Flansa Logic Field', field.name, force=True)
        deletion_log.append(f"✅ Deleted {len(logic_fields)} logic fields")
        
        # Step 3: Delete file attachments for this DocType
        if doctype_name and frappe.db.exists('DocType', doctype_name):
            try:
                # Get all files attached to records of this DocType
                files = frappe.get_all('File', 
                                     filters={'attached_to_doctype': doctype_name},
                                     fields=['name', 'file_url', 'file_name'])
                
                attachment_count = 0
                for file_doc in files:
                    try:
                        # Delete the file document (this also removes the physical file)
                        frappe.delete_doc('File', file_doc.name, force=True)
                        attachment_count += 1
                        print(f"   Deleted attachment: {file_doc.file_name}", flush=True)
                    except Exception as e:
                        print(f"   ⚠️ Could not delete file {file_doc.file_name}: {str(e)}", flush=True)
                
                if attachment_count > 0:
                    deletion_log.append(f"✅ Deleted {attachment_count} file attachments")
                
            except Exception as e:
                deletion_log.append(f"⚠️ Could not delete attachments: {str(e)}")
        
        # Step 4: Delete the DocType (if it exists and is managed by Flansa)
        if doctype_name and frappe.db.exists('DocType', doctype_name):
            try:
                # Only delete if it looks like a Flansa-generated DocType
                if doctype_name.startswith('PersonalTracker_') or doctype_name.startswith('Flansa'):
                    frappe.delete_doc('DocType', doctype_name, force=True)
                    deletion_log.append(f"✅ Deleted DocType: {doctype_name}")
                else:
                    deletion_log.append(f"⚠️ Preserved external DocType: {doctype_name}")
            except Exception as e:
                deletion_log.append(f"⚠️ Could not delete DocType: {str(e)}")
        
        # Step 5: Finally delete the table document
        frappe.delete_doc('Flansa Table', table_name, force=True)
        deletion_log.append(f"✅ Deleted table document")
        
        # Commit all changes
        frappe.db.commit()
        
        print(f"🎉 Successfully deleted table: {table_label}", flush=True)
        
        return {
            'success': True,
            'message': f'Table "{table_label}" deleted successfully',
            'deletion_log': deletion_log,
            'summary': f'Deleted table with {record_count} records, {len(reports)} reports, {total_rels} relationships, {len(logic_fields)} logic fields'
        }
        
    except Exception as e:
        frappe.db.rollback()
        print(f"❌ Error during table deletion: {str(e)}", flush=True)
        frappe.log_error(f"Clean delete table error: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_deletion_preview(resource_type, resource_name):
    """
    Preview what will be deleted without actually deleting
    """
    try:
        preview = {
            'resource': f"{resource_type}: {resource_name}",
            'items_to_delete': []
        }
        
        if resource_type == 'app':
            if not frappe.db.exists('Flansa Application', resource_name):
                return {'success': False, 'error': 'Application not found'}
            
            app_doc = frappe.get_doc('Flansa Application', resource_name)
            tables = frappe.get_all('Flansa Table', 
                                   filters={'application': resource_name},
                                   fields=['name', 'table_name', 'doctype_name'])
            
            preview['items_to_delete'].extend([
                f"📱 Application: {app_doc.app_title or app_doc.app_name or resource_name}",
                f"📋 Tables: {len(tables)} tables"
            ])
            
            # Count connected resources across all tables
            total_records = 0
            total_reports = 0
            total_forms = 0
            total_relationships = 0
            total_attachments = 0
            
            for table in tables:
                if table.doctype_name and frappe.db.exists('DocType', table.doctype_name):
                    try:
                        total_records += frappe.db.count(table.doctype_name)
                        total_attachments += frappe.db.count('File', {'attached_to_doctype': table.doctype_name})
                    except:
                        pass
                
                total_reports += frappe.db.count('Flansa Saved Report', {'base_table': table.name})
                if frappe.db.exists('Flansa Form Config', table.name):
                    total_forms += 1
                total_relationships += frappe.db.count('Flansa Relationship', 
                    filters=[['parent_table', '=', table.name]])
                total_relationships += frappe.db.count('Flansa Relationship',
                    filters=[['child_table', '=', table.name]])
            
            preview['items_to_delete'].extend([
                f"📊 Data Records: {total_records} records",
                f"📈 Saved Reports: {total_reports} reports", 
                f"📝 Form Configs: {total_forms} configurations",
                f"🔗 Relationships: {total_relationships} connections",
                f"📎 File Attachments: {total_attachments} files"
            ])
            
        elif resource_type == 'table':
            if not frappe.db.exists('Flansa Table', resource_name):
                return {'success': False, 'error': 'Table not found'}
            
            table_doc = frappe.get_doc('Flansa Table', resource_name)
            
            # Count records
            record_count = 0
            attachment_count = 0
            if table_doc.doctype_name and frappe.db.exists('DocType', table_doc.doctype_name):
                try:
                    record_count = frappe.db.count(table_doc.doctype_name)
                    attachment_count = frappe.db.count('File', {'attached_to_doctype': table_doc.doctype_name})
                except:
                    pass
            
            # Count connected resources
            reports = frappe.db.count('Flansa Saved Report', {'base_table': resource_name})
            has_form = frappe.db.exists('Flansa Form Config', resource_name)
            parent_rels = frappe.db.count('Flansa Relationship', {'parent_table': resource_name})
            child_rels = frappe.db.count('Flansa Relationship', {'child_table': resource_name})
            logic_fields = frappe.db.count('Flansa Logic Field', {'table_name': resource_name})
            
            preview['items_to_delete'].extend([
                f"📋 Table: {table_doc.table_label or table_doc.table_name}",
                f"📊 Data Records: {record_count} records",
                f"📈 Saved Reports: {reports} reports",
                f"📝 Form Config: {'1 configuration' if has_form else '0 configurations'}",
                f"🔗 Relationships: {parent_rels + child_rels} connections",
                f"🧮 Logic Fields: {logic_fields} fields",
                f"📎 File Attachments: {attachment_count} files",
                f"🗂️ DocType: {table_doc.doctype_name if table_doc.doctype_name else 'None'}"
            ])
        
        return {'success': True, 'preview': preview}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}