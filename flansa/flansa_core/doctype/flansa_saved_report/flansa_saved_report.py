#!/usr/bin/env python3
"""
Flansa Saved Report DocType

Stores user-created reports with their configurations for reuse and sharing.
"""

import frappe
import json
from frappe.model.document import Document
from frappe.utils import now

class FlansaSavedReport(Document):
    def before_save(self):
        """Set metadata before saving"""
        if self.is_new():
            self.created_by_user = frappe.session.user
            self.created_on = now()
        
        self.modified_by_user = frappe.session.user
        self.last_modified = now()
    
    def validate(self):
        """Validate the report configuration"""
        # Validate JSON configuration
        if self.report_config:
            try:
                config = json.loads(self.report_config)
                if not config.get('selected_fields'):
                    frappe.throw("Report configuration must include selected_fields")
            except json.JSONDecodeError:
                frappe.throw("Invalid report configuration JSON")
        
        # Validate base table exists
        if self.base_table and not frappe.db.exists("Flansa Table", self.base_table):
            frappe.throw(f"Base table {self.base_table} does not exist")
    
    def get_config_dict(self):
        """Get report configuration as dictionary"""
        if self.report_config:
            return json.loads(self.report_config)
        return {}
    
    def get_view_options_dict(self):
        """Get view options as dictionary"""
        if self.view_options:
            return json.loads(self.view_options)
        return {}
    
    def can_user_access(self, user=None):
        """Check if user can access this report"""
        if not user:
            user = frappe.session.user
        
        # System managers can access all reports
        if "System Manager" in frappe.get_roles(user):
            return True
        
        # Public reports can be accessed by anyone
        if self.is_public:
            return True
        
        # Owner can always access their reports
        if self.created_by_user == user:
            return True
        
        return False

@frappe.whitelist()
def get_user_reports(base_table=None):
    """Get reports accessible to current user with workspace-aware filtering"""
    filters = {}

    # Add base table filter if specified
    if base_table:
        filters['base_table'] = base_table

    # Get current workspace for filtering
    try:
        from flansa.flansa_core.workspace_service import WorkspaceContext
        current_workspace = WorkspaceContext.get_current_workspace_id()
    except:
        current_workspace = None

    # Get all reports that could match
    all_reports = frappe.get_all(
        "Flansa Saved Report",
        fields=[
            "name", "report_title", "description", "base_table",
            "report_type", "is_public", "created_by_user", "created_on", "workspace_id"
        ],
        filters=filters,
        order_by="created_on desc"
    )

    # Filter by access permissions and workspace
    accessible_reports = []
    for report in all_reports:
        # Check user access first
        report_doc = frappe.get_doc("Flansa Saved Report", report.name)
        if not report_doc.can_user_access():
            continue

        # Workspace filtering with fallback to base_table workspace
        report_workspace = report.workspace_id

        # If report has no workspace_id, get it from base_table
        if not report_workspace and report.base_table:
            try:
                table_workspace = frappe.db.get_value('Flansa Table', report.base_table, 'workspace_id')
                if table_workspace:
                    report_workspace = table_workspace
            except:
                pass

        # Include report if:
        # 1. No workspace filtering needed (System Manager, etc.)
        # 2. Report workspace matches current workspace
        # 3. Report is public
        if (not current_workspace or
            report_workspace == current_workspace or
            report.is_public):
            accessible_reports.append(report)

    return accessible_reports

@frappe.whitelist()
def save_report(report_title, description, base_table, report_type, report_config, view_options=None, is_public=0):
    """Save a new report"""
    try:
        # Validate inputs
        if not report_title or not base_table or not report_config:
            return {"success": False, "error": "Missing required fields"}
        
        # Create new report
        report = frappe.new_doc("Flansa Saved Report")
        report.report_title = report_title
        report.description = description or ""
        report.base_table = base_table
        report.report_type = report_type or "Table"
        report.report_config = json.dumps(report_config) if isinstance(report_config, dict) else report_config
        report.view_options = json.dumps(view_options) if view_options and isinstance(view_options, dict) else (view_options or "{}")
        report.is_public = int(is_public)
        
        # Save the report
        report.insert()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Report '{report_title}' saved successfully",
            "report_id": report.name
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving report: {str(e)}", "Save Report")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def update_report(report_id, report_title, description, base_table, report_type, report_config, view_options=None, is_public=0):
    """Update an existing report"""
    try:
        # Validate inputs
        if not report_id or not report_title or not base_table or not report_config:
            return {"success": False, "error": "Missing required fields"}
        
        # Check if report exists and user has permission to edit
        if not frappe.db.exists("Flansa Saved Report", report_id):
            return {"success": False, "error": "Report not found"}
        
        report = frappe.get_doc("Flansa Saved Report", report_id)
        
        # Check if user can edit this report
        if not report.can_user_access():
            return {"success": False, "error": "Access denied"}
        
        # Only owner or system manager can edit
        if report.created_by_user != frappe.session.user and "System Manager" not in frappe.get_roles():
            return {"success": False, "error": "Only the report creator can edit this report"}
        
        # Update the report
        report.report_title = report_title
        report.description = description or ""
        report.base_table = base_table
        report.report_type = report_type or "Table"
        report.report_config = json.dumps(report_config) if isinstance(report_config, dict) else report_config
        report.view_options = json.dumps(view_options) if view_options and isinstance(view_options, dict) else (view_options or "{}")
        report.is_public = int(is_public)
        
        # Save the report
        report.save()
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Report '{report_title}' updated successfully",
            "report_id": report.name
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating report: {str(e)}", "Update Report")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def delete_report(report_id):
    """Delete a saved report"""
    try:
        if not report_id:
            return {"success": False, "error": "report_id parameter is required"}
        
        # Check if report exists
        if not frappe.db.exists("Flansa Saved Report", report_id):
            return {"success": False, "error": "Report not found"}
        
        report = frappe.get_doc("Flansa Saved Report", report_id)
        
        # Check permissions - only owner or system manager can delete
        if report.created_by_user != frappe.session.user and "System Manager" not in frappe.get_roles():
            return {"success": False, "error": "Only the report creator can delete this report"}
        
        # Store report title for response
        report_title = report.report_title
        
        # Delete the report
        frappe.delete_doc("Flansa Saved Report", report_id)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Report '{report_title}' deleted successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting report: {str(e)}", "Delete Report")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def load_report(report_id=None):
    """Load a saved report"""
    # Handle both positional and keyword arguments
    if not report_id:
        # Try to get from form_dict for backward compatibility
        report_id = frappe.form_dict.get('report_id')
    
    if not report_id:
        return {"success": False, "error": "report_id parameter is required"}
    
    try:
        if not frappe.db.exists("Flansa Saved Report", report_id):
            return {"success": False, "error": "Report not found"}
        
        report = frappe.get_doc("Flansa Saved Report", report_id)
        
        # Check access permissions
        if not report.can_user_access():
            return {"success": False, "error": "Access denied"}
        
        return {
            "success": True,
            "report": {
                "id": report.name,
                "title": report.report_title,
                "description": report.description,
                "base_table": report.base_table,
                "report_type": report.report_type,
                "is_public": report.is_public,
                "config": report.get_config_dict(),
                "view_options": report.get_view_options_dict(),
                "created_by": report.created_by_user,
                "created_on": report.created_on
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error loading report: {str(e)}", "Load Report")
        return {"success": False, "error": str(e)}

print("Flansa Saved Report DocType created!")
print("Features:")
print("  ✅ Report saving with JSON configuration")
print("  ✅ User access control and public sharing")
print("  ✅ Report metadata tracking")
print("  ✅ Load and save API functions")