"""
Modern Form Builder API for Flansa - Phase 2 Implementation
Creates custom form layouts with gallery fields and drag-drop functionality
"""

import frappe
import json
from frappe import _

@frappe.whitelist()
def get_form_layout(table_name):
    """Get custom form layout for a Flansa table"""
    try:
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not table_doc.fields_json:
            return {"success": False, "error": "No fields defined"}
        
        fields = json.loads(table_doc.fields_json)
        
        # Build modern form layout
        form_layout = {
            "sections": [],
            "gallery_fields": [],
            "form_config": {
                "responsive": True,
                "theme": "modern",
                "drag_drop": True
            }
        }
        
        current_section = {
            "title": "Basic Information",
            "fields": [],
            "columns": 2
        }
        
        for field in fields:
            field_config = {
                "fieldname": field.get('field_name'),
                "label": field.get('field_label'),
                "fieldtype": field.get('field_type'),
                "options": field.get('options', ''),
                "reqd": field.get('is_required', 0),
                "read_only": field.get('is_readonly', 0)
            }
            
            # Handle gallery fields specially
            if field.get('field_type') == 'JSON' and 'gallery' in field.get('options', '').lower():
                try:
                    gallery_config = json.loads(field.get('options', '{}'))
                    if gallery_config.get('is_gallery'):
                        form_layout["gallery_fields"].append({
                            "fieldname": field.get('field_name'),
                            "label": field.get('field_label'),
                            "config": gallery_config
                        })
                        continue
                except:
                    pass
            
            current_section["fields"].append(field_config)
        
        if current_section["fields"]:
            form_layout["sections"].append(current_section)
        
        return {
            "success": True,
            "layout": form_layout
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting form layout: {str(e)}", "Form Builder")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def save_form_layout(table_name, layout_data):
    """Save custom form layout"""
    try:
        # Parse layout data if string
        if isinstance(layout_data, str):
            layout_data = json.loads(layout_data)
        
        # Save layout to table metadata
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Store custom layout in a new field
        if not hasattr(table_doc, 'custom_form_layout'):
            # Add custom field to store layout
            pass
        
        # For now, store in description or custom field
        table_doc.db_set('form_layout_json', json.dumps(layout_data))
        
        return {"success": True, "message": "Form layout saved successfully"}
        
    except Exception as e:
        frappe.log_error(f"Error saving form layout: {str(e)}", "Form Builder")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def render_gallery_field(docname, fieldname, doctype_name):
    """Render gallery field with drag-drop functionality"""
    try:
        if not frappe.db.exists(doctype_name, docname):
            return {"success": False, "error": "Document not found"}
        
        doc = frappe.get_doc(doctype_name, docname)
        field_value = getattr(doc, fieldname, None)
        
        # Parse gallery data
        gallery_data = []
        if field_value:
            try:
                if isinstance(field_value, str):
                    gallery_data = json.loads(field_value)
                elif isinstance(field_value, list):
                    gallery_data = field_value
            except:
                gallery_data = []
        
        # Build gallery HTML
        gallery_html = f"""
        <div class="flansa-gallery-field" data-fieldname="{fieldname}" data-docname="{docname}" data-doctype="{doctype_name}">
            <div class="gallery-header">
                <h5>{fieldname.replace('_', ' ').title()}</h5>
                <button class="btn btn-sm btn-primary add-gallery-item">
                    <i class="fa fa-plus"></i> Add Images
                </button>
            </div>
            <div class="gallery-container" data-max-files="10">
                <div class="gallery-grid">
        """
        
        # Add existing items
        for item in gallery_data:
            if isinstance(item, dict) and item.get('file_url'):
                gallery_html += f"""
                    <div class="gallery-item" data-file-url="{item['file_url']}">
                        <img src="{item['file_url']}" alt="{item.get('description', '')}" />
                        <div class="gallery-item-overlay">
                            <button class="btn btn-sm btn-danger remove-item">
                                <i class="fa fa-trash"></i>
                            </button>
                            <button class="btn btn-sm btn-primary edit-item">
                                <i class="fa fa-edit"></i>
                            </button>
                        </div>
                        <div class="gallery-item-meta">
                            <small>{item.get('description', '')}</small>
                        </div>
                    </div>
                """
        
        # Add drop zone
        gallery_html += """
                    <div class="gallery-drop-zone">
                        <div class="drop-zone-content">
                            <i class="fa fa-cloud-upload fa-2x"></i>
                            <p>Drag & drop images here or click to upload</p>
                            <input type="file" multiple accept="image/*" class="gallery-file-input" style="display: none;">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        """
        
        return {
            "success": True,
            "html": gallery_html,
            "data": gallery_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error rendering gallery field: {str(e)}", "Gallery Renderer")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def upload_gallery_image(docname, fieldname, doctype_name):
    """Handle gallery image upload via drag-drop"""
    try:
        from frappe.utils.file_manager import save_file
        
        # Get uploaded files
        files = frappe.request.files
        if not files:
            return {"success": False, "error": "No files uploaded"}
        
        uploaded_items = []
        
        for file_obj in files.values():
            if file_obj:
                # Save file
                file_doc = save_file(
                    file_obj.filename,
                    file_obj.read(),
                    doctype_name,
                    docname,
                    is_private=0
                )
                
                uploaded_items.append({
                    "file_url": file_doc.file_url,
                    "file_name": file_doc.file_name,
                    "file_size": file_doc.file_size or 0,
                    "description": "",
                    "sort_order": len(uploaded_items)
                })
        
        # Update document field
        doc = frappe.get_doc(doctype_name, docname)
        existing_data = getattr(doc, fieldname, None)
        
        gallery_data = []
        if existing_data:
            try:
                if isinstance(existing_data, str):
                    gallery_data = json.loads(existing_data)
                elif isinstance(existing_data, list):
                    gallery_data = existing_data
            except:
                gallery_data = []
        
        # Add new items
        gallery_data.extend(uploaded_items)
        
        # Update document
        doc.db_set(fieldname, json.dumps(gallery_data))
        
        return {
            "success": True,
            "message": f"Uploaded {len(uploaded_items)} images",
            "items": uploaded_items,
            "total_items": len(gallery_data)
        }
        
    except Exception as e:
        frappe.log_error(f"Error uploading gallery images: {str(e)}", "Gallery Upload")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_table_form_config(table_name, force_refresh=False):
    """Get form configuration for a Flansa table using native fields"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get table document
        table_doc = frappe.get_doc('Flansa Table', table_name)
        
        # Use native fields instead of Flansa Field doctype
        from flansa.native_fields import get_table_fields_native
        
        # Clear any caching if force refresh requested
        if force_refresh:
            frappe.clear_cache(doctype=table_doc.doctype_name)
            # Also clear document cache
            frappe.clear_document_cache(table_doc.doctype_name, table_name)
        
        native_result = get_table_fields_native(table_name)
        if not native_result.get('success'):
            return native_result
        
        # Debug logging for field sync issues
        if force_refresh:
            raw_fields = native_result.get('fields', [])
            flansa_fields = [f for f in raw_fields if f.get('created_by_flansa')]
            
            # Also get fields directly from DocType for comparison
            direct_fields = []
            if table_doc.doctype_name:
                try:
                    doctype_meta = frappe.get_meta(table_doc.doctype_name)
                    direct_fields = [f.fieldname for f in doctype_meta.fields if not f.fieldname.startswith('_')]
                except:
                    pass
            
            frappe.logger().info(f"Form Builder Sync Debug for {table_name}:")
            frappe.logger().info(f"Raw fields from native function: {[f.get('fieldname') for f in raw_fields]}")
            frappe.logger().info(f"Flansa fields only: {[f.get('fieldname') for f in flansa_fields]}")
            frappe.logger().info(f"Direct DocType fields: {direct_fields}")
        
        # Format fields for form builder
        formatted_fields = []
        for field in native_result.get('fields', []):
            # Only include fields created by Flansa (exclude standard Frappe fields)
            if field.get('created_by_flansa'):
                formatted_fields.append({
                    'field_name': field['fieldname'],
                    'field_label': field['label'],
                    'field_type': field['fieldtype'],
                    'options': field.get('options', ''),
                    'is_required': field.get('reqd', 0),
                    'is_readonly': field.get('read_only', 0),
                    'description': field.get('description', ''),
                    'default_value': field.get('default', ''),
                    'hidden': field.get('hidden', 0),
                    'in_list_view': field.get('in_list_view', 0),
                    'bold': field.get('bold', 0),
                    'collapsible': field.get('collapsible', 0),
                    'depends_on': field.get('depends_on', ''),
                    'width': field.get('width', ''),
                    'field_order': field.get('idx', 0)
                })
        
        # Check if form configuration already exists
        form_config = {}
        field_overrides = {}
        if frappe.db.exists('Flansa Form Config', table_name):
            form_doc = frappe.get_doc('Flansa Form Config', table_name)
            form_config = {
                'layout_type': form_doc.layout_type,
                'sections': json.loads(form_doc.sections) if form_doc.sections else [],
                'custom_css': form_doc.custom_css,
                'custom_js': form_doc.custom_js,
                'form_title': form_doc.form_title,
                'form_description': form_doc.form_description
            }
            # Parse field overrides for display customization
            if form_doc.field_overrides:
                try:
                    field_overrides = json.loads(form_doc.field_overrides)
                except:
                    field_overrides = {}
        
        # Apply field overrides to formatted fields
        for field in formatted_fields:
            field_name = field['field_name']
            if field_name in field_overrides:
                override = field_overrides[field_name]
                # Apply display overrides
                if override.get('hide_description'):
                    field['description'] = ''
                if override.get('custom_label'):
                    field['field_label'] = override['custom_label']
                if override.get('show_custom_help'):
                    field['description'] = override['show_custom_help']
        
        return {
            'success': True,
            'table_name': table_name,
            'table_label': table_doc.table_label,
            'doctype_name': table_doc.doctype_name,
            'fields': formatted_fields,
            'form_config': form_config,
            'field_overrides': field_overrides
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table form config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def save_form_config(table_name, form_config):
    """Save form configuration for a Flansa table"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Parse form config if it's a string
        if isinstance(form_config, str):
            form_config = json.loads(form_config)
        
        # Create or update form configuration document
        if frappe.db.exists('Flansa Form Config', table_name):
            doc = frappe.get_doc('Flansa Form Config', table_name)
        else:
            doc = frappe.new_doc('Flansa Form Config')
            doc.name = table_name
            doc.table_name = table_name
        
        # Update form configuration
        doc.layout_type = form_config.get('layout_type', 'standard')
        doc.sections = json.dumps(form_config.get('sections', []))
        doc.custom_css = form_config.get('custom_css', '')
        doc.custom_js = form_config.get('custom_js', '')
        doc.form_title = form_config.get('form_title', '')
        doc.form_description = form_config.get('form_description', '')
        doc.field_overrides = json.dumps(form_config.get('field_overrides', {}))
        
        # Save document
        if doc.is_new():
            doc.insert()
        else:
            doc.save()
        
        return {
            'success': True,
            'message': 'Form configuration saved successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving form config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_form_preview_data(table_name, record_name=None):
    """Get data for form preview"""
    try:
        # Validate table exists
        if not frappe.db.exists('Flansa Table', table_name):
            return {'success': False, 'error': f'Table {table_name} not found'}
        
        # Get table document
        table_doc = frappe.get_doc('Flansa Table', table_name)
        doctype_name = table_doc.doctype_name
        
        if not doctype_name:
            return {'success': False, 'error': f'DocType not generated for table {table_name}'}
        
        # Get record data if record_name is provided
        record_data = {}
        if record_name and frappe.db.exists(doctype_name, record_name):
            record_data = frappe.get_doc(doctype_name, record_name).as_dict()
        
        # Get form configuration
        form_config_response = get_table_form_config(table_name)
        if not form_config_response.get('success'):
            return form_config_response
        
        return {
            'success': True,
            'record_data': record_data,
            'form_config': form_config_response['form_config'],
            'fields': form_config_response['fields']
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting form preview data: {str(e)}")
        return {'success': False, 'error': str(e)}