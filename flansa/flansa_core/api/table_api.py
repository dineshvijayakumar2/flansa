import frappe
from flansa.flansa_core.doctype_hooks import calculate_logic_fields
from frappe import _

@frappe.whitelist()
def get_tables_list(app_name=None):
    """Get list of Flansa tables for dropdown options, optionally filtered by app"""
    
    try:
        # Build filters
        filters = {"status": ["!=", "Deleted"]}
        if app_name:
            filters["application"] = app_name
            
        tables = frappe.get_all("Flansa Table", 
            fields=["name", "table_name", "table_label", "description", "status", "application"],
            filters=filters,
            order_by="table_label asc"
        )
        
        # Format for frontend consumption
        formatted_tables = []
        for table in tables:
            formatted_tables.append({
                "value": table.name,
                "label": table.table_label or table.table_name,
                "description": table.description or '',
                "table_name": table.table_name,
                "status": table.status
            })
        
        return {
            "success": True,
            "tables": formatted_tables
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting tables list: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e),
            "tables": []
        }

@frappe.whitelist()
def get_table_info(table_name):
    """Get detailed information about a specific table"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        return {
            "success": True,
            "table": {
                "name": table_doc.name,
                "table_name": table_doc.table_name,
                "table_label": table_doc.table_label,
                "description": table_doc.description,
                "status": table_doc.status,
                "doctype_name": getattr(table_doc, "doctype_name", ""),
                "application": getattr(table_doc, "application", "")
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table info for {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_table_fields(table_name):
    """Get fields for a specific table"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Get fields from DocType only - legacy JSON removed
        fields = []
        if hasattr(table_doc, "doctype_name") and table_doc.doctype_name:
            if frappe.db.exists("DocType", table_doc.doctype_name):
                doctype_meta = frappe.get_meta(table_doc.doctype_name)
                fields = []
                for field in doctype_meta.fields:
                    if field.fieldtype not in ["Section Break", "Column Break", "Tab Break"]:
                        fields.append({
                            "fieldname": field.fieldname,
                            "label": field.label,
                            "fieldtype": field.fieldtype,
                            "options": field.options,
                            "reqd": field.reqd,
                            "read_only": field.read_only
                        })
        
        return {
            "success": True,
            "fields": fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting fields for table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e),
            "fields": []
        }

@frappe.whitelist()
def get_table_records(table_name):
    """Get records for a table"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Get records from DocType
        records = []
        fields = []
        
        if hasattr(table_doc, "doctype_name") and table_doc.doctype_name:
            if frappe.db.exists("DocType", table_doc.doctype_name):
                # Get fields
                doctype_meta = frappe.get_meta(table_doc.doctype_name)
                for field in doctype_meta.fields:
                    if field.fieldtype not in ["Section Break", "Column Break", "Tab Break"]:
                        fields.append({
                            "fieldname": field.fieldname,
                            "label": field.label,
                            "fieldtype": field.fieldtype,
                            "options": field.options,
                            "reqd": field.reqd,
                            "read_only": field.read_only
                        })
                
                # Get records
                records = frappe.get_all(table_doc.doctype_name, fields=['*'])
        
        return {
            "success": True,
            "records": records,
            "fields": fields,
            "doctype_name": table_doc.doctype_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting records for table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e),
            "records": [],
            "fields": []
        }

@frappe.whitelist()
def create_record(table_name, values):
    """Create a new record"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not hasattr(table_doc, "doctype_name") or not table_doc.doctype_name:
            return {
                "success": False,
                "error": "No doctype associated with table"
            }
        
        # Create new document
        doc = frappe.get_doc({
            "doctype": table_doc.doctype_name,
            **values
        })
        
        doc.insert()
        frappe.db.commit()
        
        return {
            "success": True,
            "record_name": doc.name
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error creating record in table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def update_record(table_name, record_name, values):
    """Update an existing record"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not hasattr(table_doc, "doctype_name") or not table_doc.doctype_name:
            return {
                "success": False,
                "error": "No doctype associated with table"
            }
        
        # Check if record exists
        if not frappe.db.exists(table_doc.doctype_name, record_name):
            return {
                "success": False,
                "error": "Record not found"
            }
        
        # Update document
        doc = frappe.get_doc(table_doc.doctype_name, record_name)
        
        # Debug: log what we received
        frappe.logger().debug(f"Updating record {record_name} with values: {values} (type: {type(values)})")
        
        # Ensure values is a dictionary
        if isinstance(values, str):
            try:
                import json
                values = json.loads(values)
            except:
                frappe.logger().error(f"Failed to parse values string: {values}")
                raise ValueError("Values must be a dictionary or valid JSON string")
        
        for field, value in values.items():
            if hasattr(doc, field):
                # Get field metadata to check field type
                field_meta = doc.meta.get_field(field) if hasattr(doc.meta, 'get_field') else None
                
                # Handle empty gallery fields (Long Text fields)
                if field_meta and field_meta.fieldtype == 'Long Text':
                    if value == '' or value == 'null' or value == 'undefined' or value is None:
                        # For Long Text fields, set to empty string
                        setattr(doc, field, '')
                        frappe.logger().debug(f"Clearing Long Text field {field}")
                    else:
                        setattr(doc, field, value)
                else:
                    # Regular fields
                    setattr(doc, field, value)
                
                frappe.logger().debug(f"Set field {field} to {getattr(doc, field)} (was: {value})")
        
        doc.save()
        frappe.db.commit()
        
        return {
            "success": True,
            "record_name": doc.name
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error updating record {record_name} in table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def delete_record(table_name, record_name):
    """Delete a record"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not hasattr(table_doc, "doctype_name") or not table_doc.doctype_name:
            return {
                "success": False,
                "error": "No doctype associated with table"
            }
        
        # Check if record exists
        if not frappe.db.exists(table_doc.doctype_name, record_name):
            return {
                "success": False,
                "error": "Record not found"
            }
        
        # Delete document
        frappe.delete_doc(table_doc.doctype_name, record_name)
        frappe.db.commit()
        
        return {
            "success": True
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error deleting record {record_name} in table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e)
        }

# Additional API methods for enhanced functionality

@frappe.whitelist()
def get_records(table_name, filters=None, sort=None, page=1, page_size=20, fields=None):
    """Enhanced get records with filtering, sorting, and pagination"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not hasattr(table_doc, "doctype_name") or not table_doc.doctype_name:
            return {
                "success": False,
                "error": "No doctype associated with table"
            }
        
        # Build filters
        frappe_filters = {}
        if filters:
            for filter_item in filters:
                if isinstance(filter_item, dict) and 'field' in filter_item:
                    field = filter_item['field']
                    operator = filter_item.get('operator', '=')
                    value = filter_item.get('value')
                    
                    if operator == '=':
                        frappe_filters[field] = value
                    elif operator == 'like':
                        frappe_filters[field] = ['like', f'%{value}%']
                    else:
                        frappe_filters[field] = [operator, value]
        
        # Build sort
        order_by = 'modified desc'  # default
        if sort and isinstance(sort, dict):
            field = sort.get('field', 'modified')
            order = sort.get('order', 'desc')
            order_by = f'{field} {order}'
        
        # Get field list
        field_list = ['*']
        if fields and isinstance(fields, list):
            field_list = fields
        
        # Calculate offset
        offset = (int(page) - 1) * int(page_size)
        
        # Get records with pagination
        records = frappe.get_all(
            table_doc.doctype_name,
            filters=frappe_filters,
            fields=field_list,
            order_by=order_by,
            start=offset,
            page_length=int(page_size) + 1  # Get one extra to check if there are more
        )
        
        # Check if there are more records
        has_more = len(records) > int(page_size)
        if has_more:
            records = records[:-1]  # Remove the extra record
        
        # Get total count
        total = frappe.db.count(table_doc.doctype_name, filters=frappe_filters)
        
        return {
            "success": True,
            "records": records,
            "total": total,
            "page": int(page),
            "page_size": int(page_size),
            "has_more": has_more
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting records for table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e),
            "records": [],
            "total": 0
        }

@frappe.whitelist()
def get_record(table_name, record_id):
    """Get a single record by ID"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not hasattr(table_doc, "doctype_name") or not table_doc.doctype_name:
            return {
                "success": False,
                "error": "No doctype associated with table"
            }
        
        # Check if record exists
        if not frappe.db.exists(table_doc.doctype_name, record_id):
            return {
                "success": False,
                "error": "Record not found"
            }
        
        # Get the record
        record = frappe.get_doc(table_doc.doctype_name, record_id).as_dict()
        
        # Get fields metadata (similar to get_table_meta)
        fields = []
        if frappe.db.exists("DocType", table_doc.doctype_name):
            doctype_meta = frappe.get_meta(table_doc.doctype_name)
            
            for field in doctype_meta.fields:
                fields.append({
                    "fieldname": field.fieldname,
                    "fieldtype": field.fieldtype,
                    "label": field.label,
                    "reqd": field.reqd,
                    "options": field.options,
                    "description": field.description,
                    "read_only": field.read_only,
                    "hidden": field.hidden,
                    "default": field.default
                })
        
        return {
            "success": True,
            "record": record,
            "fields": fields,
            "doctype_name": table_doc.doctype_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting record {record_id} from table {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_table_metadata(table_name):
    """Get comprehensive table metadata"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        # Get fields metadata
        fields = []
        permissions = {}
        settings = {}
        
        if hasattr(table_doc, "doctype_name") and table_doc.doctype_name:
            if frappe.db.exists("DocType", table_doc.doctype_name):
                # Get detailed field metadata
                doctype_meta = frappe.get_meta(table_doc.doctype_name)
                for field in doctype_meta.fields:
                    if field.fieldtype not in ["Section Break", "Column Break", "Tab Break"]:
                        fields.append({
                            "fieldname": field.fieldname,
                            "label": field.label,
                            "fieldtype": field.fieldtype,
                            "options": field.options,
                            "reqd": field.reqd,
                            "read_only": field.read_only,
                            "hidden": field.hidden,
                            "default": field.default,
                            "description": field.description,
                            "width": field.width,
                            "precision": field.precision,
                            "length": field.length
                        })
                
                # Get permissions
                permissions = {
                    "read": frappe.has_permission(table_doc.doctype_name, "read"),
                    "write": frappe.has_permission(table_doc.doctype_name, "write"),
                    "create": frappe.has_permission(table_doc.doctype_name, "create"),
                    "delete": frappe.has_permission(table_doc.doctype_name, "delete")
                }
                
                # Get settings from DocType
                settings = {
                    "is_submittable": doctype_meta.is_submittable,
                    "track_changes": doctype_meta.track_changes,
                    "allow_copy": doctype_meta.allow_copy,
                    "allow_import": doctype_meta.allow_import
                }
        
        return {
            "success": True,
            "doctype_name": table_doc.doctype_name,
            "fields": fields,
            "permissions": permissions,
            "settings": settings
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table metadata for {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e),
            "fields": [],
            "permissions": {},
            "settings": {}
        }

@frappe.whitelist()
def get_table_meta(table_name):
    """Get table metadata for new record creation"""
    
    try:
        if not frappe.db.exists("Flansa Table", table_name):
            return {
                "success": False,
                "error": "Table not found"
            }
        
        table_doc = frappe.get_doc("Flansa Table", table_name)
        
        if not hasattr(table_doc, "doctype_name") or not table_doc.doctype_name:
            return {
                "success": False,
                "error": "No doctype associated with table"
            }
        
        # Get fields metadata
        fields = []
        if frappe.db.exists("DocType", table_doc.doctype_name):
            doctype_meta = frappe.get_meta(table_doc.doctype_name)
            
            for field in doctype_meta.fields:
                fields.append({
                    "fieldname": field.fieldname,
                    "fieldtype": field.fieldtype,
                    "label": field.label,
                    "reqd": field.reqd,
                    "options": field.options,
                    "description": field.description,
                    "read_only": field.read_only,
                    "hidden": field.hidden,
                    "default": field.default
                })
        
        return {
            "success": True,
            "doctype_name": table_doc.doctype_name,
            "fields": fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting table meta for {table_name}: {str(e)}", "Table API Error")
        return {
            "success": False,
            "error": str(e),
            "fields": []
        }

@frappe.whitelist()
def get_link_options(doctype, search_term="", limit=20):
    """
    Get available options for a link field
    
    Args:
        doctype (str): The target doctype for the link field
        search_term (str): Search term to filter options
        limit (int): Maximum number of options to return
    
    Returns:
        dict: Response with success status and options list
    """
    try:
        # Validate doctype exists
        if not frappe.db.exists("DocType", doctype):
            return {
                "success": False,
                "error": f"DocType '{doctype}' does not exist"
            }
        
        # Get meta information for the doctype
        meta = frappe.get_meta(doctype)
        
        # Determine which field to use for display (title field or name)
        title_field = meta.get_title_field()
        search_fields = []
        
        # Build search fields list
        if title_field:
            search_fields.append(title_field)
        
        # Add other searchable fields
        for field in meta.fields:
            if field.fieldtype in ['Data', 'Text', 'Small Text'] and field.fieldname not in search_fields:
                search_fields.append(field.fieldname)
                if len(search_fields) >= 3:  # Limit to avoid too many fields
                    break
        
        # Always include name field
        if 'name' not in search_fields:
            search_fields.append('name')
        
        # Build query
        fields = ['name']
        if title_field and title_field != 'name':
            fields.append(title_field)
        
        # Build filters
        filters = {}
        or_filters = []
        
        if search_term:
            # Create OR filters for searching across multiple fields
            for field in search_fields[:3]:  # Limit to avoid too complex queries
                or_filters.append([field, 'like', f'%{search_term}%'])
        
        # Query the records
        try:
            if or_filters:
                records = frappe.get_all(
                    doctype,
                    fields=fields,
                    or_filters=or_filters,
                    limit=limit,
                    order_by='modified desc'
                )
            else:
                records = frappe.get_all(
                    doctype,
                    fields=fields,
                    limit=limit,
                    order_by='modified desc'
                )
        except Exception as e:
            # Fallback to simpler query if complex query fails
            records = frappe.get_all(
                doctype,
                fields=['name'],
                limit=limit,
                order_by='modified desc'
            )
        
        # Format options
        options = []
        for record in records:
            name = record.get('name', '')
            title = record.get(title_field) if title_field else name
            
            option = {
                'name': name,
                'value': name,
                'title': title or name,
                'label': title or name
            }
            
            # Add description if available
            if hasattr(record, 'description'):
                option['description'] = record.get('description', '')
            
            options.append(option)
        
        return {
            "success": True,
            "options": options,
            "total": len(options),
            "search_term": search_term,
            "doctype": doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting link options for {doctype}: {str(e)}")
        return {
            "success": False,
            "error": f"Error loading options: {str(e)}"
        }


# ====== FLANSALOGIC ENGINE INTEGRATION ======

@frappe.whitelist()
def get_logic_fields_for_table(table_name):
    """Get all active Logic Fields for a table"""
    try:
        logic_fields = frappe.get_all("Flansa Logic Field",
            filters={"table_name": table_name, "is_active": 1},
            fields=["name", "field_name", "label", "expression", "result_type"]
        )
        
        return {
            "success": True,
            "logic_fields": logic_fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting logic fields: {str(e)}", "FlansaLogic Integration")
        return {
            "success": False,
            "error": str(e),
            "logic_fields": []
        }

@frappe.whitelist()
def calculate_record_logic(table_name, record_name):
    """Calculate all Logic Fields for a specific record"""
    try:
        # Get Logic Fields for this table
        logic_fields = frappe.get_all("Flansa Logic Field",
            filters={"table_name": table_name, "is_active": 1},
            fields=["field_name", "expression", "result_type"]
        )
        
        if not logic_fields:
            return {"success": True, "logic_values": {}}
        
        # Get record data - find the actual DocType
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        actual_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        record = frappe.get_doc(actual_doctype, record_name)
        doc_context = record.as_dict()
        
        # Import Logic Engine
        from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine
        engine = get_logic_engine()
        
        # Calculate each Logic Field
        logic_values = {}
        for field in logic_fields:
            try:
                result = engine.evaluate(field.expression, doc_context)
                logic_values[field.field_name] = result
            except Exception as field_error:
                frappe.log_error(f"Error calculating {field.field_name}: {str(field_error)}")
                logic_values[field.field_name] = 0
        
        return {
            "success": True,
            "logic_values": logic_values
        }
        
    except Exception as e:
        frappe.log_error(f"Error calculating record logic: {str(e)}", "FlansaLogic Integration")
        return {
            "success": False,
            "error": str(e),
            "logic_values": {}
        }

@frappe.whitelist()
def get_record_with_logic(table_name, record_name):
    """Get record data including calculated Logic Field values"""
    try:
        # Get base record using existing method
        record_result = get_record(table_name, record_name)
        
        if not record_result.get("success"):
            return record_result
        
        # Calculate Logic Fields
        logic_result = calculate_record_logic(table_name, record_name)
        
        # Merge logic values into record
        if logic_result.get("success") and logic_result.get("logic_values"):
            if "record" in record_result:
                record_result["record"].update(logic_result["logic_values"])
            record_result["logic_fields"] = logic_result["logic_values"]
            record_result["has_logic_fields"] = True
        else:
            record_result["has_logic_fields"] = False
        
        return record_result
        
    except Exception as e:
        frappe.log_error(f"Error getting record with logic: {str(e)}", "FlansaLogic Integration")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def add_logic_field_to_table(table_name, field_config):
    """Add a Logic Field to a table with Phase 1 smart auto-detection"""
    try:
        # Handle Frappe's JSON string conversion
        if isinstance(field_config, str):
            try:
                import json
                field_config = json.loads(field_config)
            except (json.JSONDecodeError, ValueError):
                return {"success": False, "error": f"field_config is a string but not valid JSON: {field_config}"}
        
        if not isinstance(field_config, dict):
            return {"success": False, "error": f"field_config must be a dictionary, got {type(field_config)}"}
        
        # Phase 1: Auto-detect calculation type and strategy
        expression = field_config.get("expression", "")
        calc_type = detect_calculation_type(expression)
        storage_strategy = get_storage_strategy(calc_type)
        field_type = auto_detect_field_type(expression, calc_type)
        
        # Get target DocType
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        # Validate target DocType exists
        frappe.get_meta(target_doctype)
        
        # Check if Custom Field already exists
        if frappe.db.exists("Custom Field", {"dt": target_doctype, "fieldname": field_config.get("field_name")}):
            return {
                "success": False,
                "error": f"Field '{field_config.get('field_name')}' already exists in {target_doctype}"
            }
        
        # Create Logic Field document with auto-detected metadata
        logic_field = frappe.new_doc("Flansa Logic Field")
        logic_field.name = f"LOGIC-{table_name}-{field_config.get('field_name')}"
        logic_field.table_name = table_name
        logic_field.field_name = field_config.get("field_name")
        logic_field.label = field_config.get("label")
        logic_field.expression = expression
        logic_field.result_type = field_type
        logic_field.calculation_type = calc_type
        logic_field.storage_strategy = storage_strategy
        logic_field.is_active = 1
        logic_field.insert()
        
        # Create Custom Field based on storage strategy
        custom_field = frappe.new_doc("Custom Field")
        custom_field.dt = target_doctype
        custom_field.fieldname = field_config.get("field_name")
        custom_field.label = field_config.get("label")
        custom_field.fieldtype = field_type
        custom_field.insert_after = "name"  # Use 'name' which always exists
        custom_field.read_only = 1
        custom_field.module = "Flansa Core"
        custom_field.description = f"{calc_type.title()} calculation ({storage_strategy}): {expression}"
        
        # All Logic Fields are now real database fields (Option 1)
        # No more virtual fields - all calculations stored in database
        
        custom_field.insert()
        
        # Populate existing records for all Logic Fields (now all are stored)
        populate_existing_records_for_cached_field(target_doctype, logic_field)
        
        frappe.clear_cache(doctype=target_doctype)
        frappe.db.commit()
        
        return {
            "success": True,
            "logic_field_name": logic_field.name,
            "custom_field_name": custom_field.name,
            "target_doctype": target_doctype,
            "calculation_type": calc_type,
            "storage_strategy": storage_strategy,
            "field_type": field_type,
            "message": f"{calc_type.title()} field created using {storage_strategy} strategy"
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding logic field: {str(e)}", "FlansaLogic Integration")
        frappe.db.rollback()
        return {
            "success": False,
            "error": str(e)
        }

# ====== PHASE 1 AUTO-DETECTION FUNCTIONS ======

def detect_calculation_type(expression):
    """Auto-detect calculation type for Phase 1"""
    import re
    
    expression_upper = expression.upper()
    
    # Check for lookup patterns
    if 'LOOKUP(' in expression_upper:
        return 'lookup'
    
    # Check for summary patterns (child table operations)
    if any(func in expression_upper for func in ['SUM(', 'COUNT(', 'AVERAGE(']) and ',' in expression:
        # If it has comma-separated args, it might be summary: SUM(child_table, field)
        args = extract_function_args('SUM|COUNT|AVERAGE', expression)
        if len(args) >= 2:
            return 'summary'
    
    # Check for text operations
    if any(func in expression_upper for func in ['CONCAT(', 'UPPER(', 'LOWER(']):
        return 'text'
    
    # Check for numerical operations
    if any(op in expression for op in ['+', '-', '*', '/', 'SUM(', 'AVERAGE(']):
        return 'numerical'
    
    # Default to numerical for simple expressions
    return 'numerical'

def get_storage_strategy(calc_type):
    """Get optimal storage strategy for calculation type"""
    
    if calc_type in ['numerical', 'text']:
        return 'real_time'  # Fast, calculated on-demand
    else:
        return 'cached'     # Store values, recalculate on dependency changes

def auto_detect_field_type(expression, calc_type):
    """Auto-detect Frappe field type based on expression"""
    
    if calc_type == 'text':
        return 'Data'
    elif 'COUNT(' in expression.upper():
        return 'Int'
    elif any(func in expression.upper() for func in ['SUM(', 'AVERAGE(']) or any(op in expression for op in ['*', '/']):
        return 'Float'
    elif 'LOOKUP(' in expression.upper():
        return 'Data'  # Default for lookups, could be refined
    else:
        return 'Data'  # Safe default

def extract_function_args(function_name, expression):
    """Extract arguments from function call"""
    import re
    pattern = f'{function_name}\\s*\\(([^)]+)\\)'
    match = re.search(pattern, expression, re.IGNORECASE)
    if match:
        args_str = match.group(1)
        args = [arg.strip() for arg in args_str.split(',')]
        return args
    return []

def populate_existing_records_for_cached_field(doctype, logic_field):
    """Populate existing records for cached fields"""
    
    record_count = frappe.db.count(doctype)
    
    if record_count < 1000:
        # Small dataset: populate immediately
        populate_cached_field_immediately(doctype, logic_field)
    else:
        # Large dataset: queue background job
        frappe.enqueue(
            'flansa.flansa_core.api.table_api.populate_cached_field_background',
            doctype=doctype,
            logic_field_name=logic_field.name,
            job_name=f"populate_{logic_field.field_name}",
            timeout=3600
        )

def populate_cached_field_immediately(doctype, logic_field):
    """Immediately populate cached field for small datasets"""
    
    records = frappe.get_all(doctype, fields=["name"], limit=1000)
    
    for record in records:
        try:
            doc = frappe.get_doc(doctype, record.name)
            calculated_value = calculate_field_value_by_type(doc, logic_field)
            frappe.db.set_value(doctype, record.name, logic_field.field_name, calculated_value)
        except Exception as e:
            frappe.log_error(f"Error calculating {logic_field.field_name} for {record.name}: {str(e)}")
            continue
    
    frappe.db.commit()

def populate_cached_field_background(doctype, logic_field_name):
    """Background population for large datasets"""
    
    logic_field = frappe.get_doc("Flansa Logic Field", logic_field_name)
    total_records = frappe.db.count(doctype)
    batch_size = 100
    processed = 0
    
    for offset in range(0, total_records, batch_size):
        records = frappe.get_all(doctype, fields=["name"], start=offset, page_length=batch_size)
        
        for record in records:
            try:
                doc = frappe.get_doc(doctype, record.name)
                calculated_value = calculate_field_value_by_type(doc, logic_field)
                frappe.db.set_value(doctype, record.name, logic_field.field_name, calculated_value)
                processed += 1
                
                if processed % 50 == 0:
                    frappe.publish_progress(
                        percent=(processed / total_records) * 100,
                        title=f"Calculating {logic_field.field_name}",
                        description=f"{processed}/{total_records} records processed"
                    )
                    
            except Exception as e:
                frappe.log_error(f"Error calculating field for {record.name}: {str(e)}")
                continue
        
        frappe.db.commit()

def calculate_field_value_by_type(doc, logic_field):
    """Calculate field value based on type"""
    
    expression = logic_field.expression
    
    # Auto-detect calculation type from expression if not set
    calc_type = getattr(logic_field, 'calculation_type', None)
    if not calc_type:
        calc_type = auto_detect_calculation_type(expression)
    
    if calc_type == 'fetch' or 'FETCH(' in expression.upper():
        return calculate_fetch_field(doc, expression)
    elif calc_type == 'lookup' or 'LOOKUP(' in expression.upper():
        return calculate_lookup_field(doc, expression)
    elif calc_type == 'summary' or any(func in expression.upper() for func in ['SUM(', 'COUNT(', 'AVERAGE(']):
        return calculate_summary_field(doc, expression)
    elif calc_type == 'numerical' or any(op in expression for op in ['+', '-', '*', '/', 'IF(']):
        return calculate_numerical_field(doc, expression)
    elif calc_type == 'text':
        return calculate_text_field(doc, expression)
    else:
        # Default to numerical calculation
        return calculate_numerical_field(doc, expression)

def auto_detect_calculation_type(expression):
    """Auto-detect calculation type from expression"""
    expression_upper = expression.upper()
    
    if 'FETCH(' in expression_upper:
        return 'fetch'
    elif 'LOOKUP(' in expression_upper:
        return 'lookup'
    elif any(func in expression_upper for func in ['SUM(', 'COUNT(', 'AVERAGE(', 'MAX(', 'MIN(']):
        return 'summary'
    elif any(op in expression for op in ['+', '-', '*', '/', 'IF(', 'AND(', 'OR(']):
        return 'numerical'
    else:
        return 'text'

def calculate_numerical_field(doc, expression):
    """Calculate numerical expressions"""
    try:
        from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine
        engine = get_logic_engine()
        return engine.evaluate(expression, doc.as_dict())
    except:
        return 0

def calculate_text_field(doc, expression):
    """Calculate text concatenation"""
    try:
        from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine
        engine = get_logic_engine()
        return engine.evaluate(expression, doc.as_dict())
    except:
        return ""

def calculate_fetch_field(doc, expression):
    """Calculate fetch from linked field"""
    try:
        args = extract_function_args('FETCH', expression)
        if len(args) >= 2:
            link_field, target_field = args[0].strip(), args[1].strip()
            
            # Get the value from the link field
            link_value = getattr(doc, link_field, None)
            if link_value:
                # Get the DocType of the link field
                meta = frappe.get_meta(doc.doctype)
                link_field_meta = None
                
                for field in meta.fields:
                    if field.fieldname == link_field:
                        link_field_meta = field
                        break
                
                if link_field_meta and link_field_meta.fieldtype == 'Link':
                    linked_doctype = link_field_meta.options
                    result = frappe.db.get_value(linked_doctype, link_value, target_field)
                    return result
        return None
    except Exception as e:
        frappe.log_error(f"Error in calculate_fetch_field: {str(e)}")
        return None

def calculate_lookup_field(doc, expression):
    """Calculate lookup from parent table"""
    try:
        args = extract_function_args('LOOKUP', expression)
        if len(args) >= 3:
            table_name, field_name, target_field = args[0].strip(), args[1].strip(), args[2].strip()
            
            field_value = getattr(doc, field_name, None)
            if field_value:
                result = frappe.db.get_value(table_name, field_value, target_field)
                return result
        return None
    except Exception as e:
        frappe.log_error(f"Error in calculate_lookup_field: {str(e)}")
        return None

def calculate_summary_field(doc, expression):
    """Calculate summary from child table"""
    try:
        if 'SUM(' in expression.upper():
            args = extract_function_args('SUM', expression)
            if len(args) >= 2:
                child_table, field_name = args[0].strip(), args[1].strip()
                child_records = getattr(doc, child_table, [])
                total = sum(getattr(child, field_name, 0) for child in child_records)
                return total
        
        elif 'COUNT(' in expression.upper():
            args = extract_function_args('COUNT', expression)
            if len(args) >= 1:
                child_table = args[0].strip()
                child_records = getattr(doc, child_table, [])
                return len(child_records)
        
        return 0
    except:
        return 0

@frappe.whitelist()
def remove_logic_field_from_table(table_name, field_name):
    """Remove a Logic Field and its Custom Field from a table"""
    try:
        # Get target DocType
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
        
        # Find and remove Logic Field record
        logic_field_name = f"LOGIC-{table_name}-{field_name}"
        if frappe.db.exists("Flansa Logic Field", logic_field_name):
            frappe.delete_doc("Flansa Logic Field", logic_field_name)
            print(f"✅ Removed Logic Field record: {logic_field_name}", flush=True)
        else:
            print(f"⚠️ Logic Field record not found: {logic_field_name}", flush=True)
        
        # Find and remove Custom Field
        custom_field_filters = {"dt": target_doctype, "fieldname": field_name}
        if frappe.db.exists("Custom Field", custom_field_filters):
            custom_field_name = frappe.db.get_value("Custom Field", custom_field_filters, "name")
            frappe.delete_doc("Custom Field", custom_field_name)
            print(f"✅ Removed Custom Field: {custom_field_name}", flush=True)
        else:
            print(f"⚠️ Custom Field not found: {field_name} in {target_doctype}", flush=True)
        
        # Clear cache to update DocType immediately
        frappe.clear_cache(doctype=target_doctype)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Logic Field '{field_name}' removed successfully from {target_doctype}"
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def cleanup_all_logic_fields(table_name=None):
    """Remove all Logic Fields, optionally for a specific table"""
    try:
        # Get Logic Fields to remove
        filters = {}
        if table_name:
            filters["table_name"] = table_name
        
        logic_fields = frappe.get_all("Flansa Logic Field", 
                                    filters=filters,
                                    fields=["name", "table_name", "field_name"])
        
        removed_count = 0
        
        for lf in logic_fields:
            try:
                result = remove_logic_field_from_table(lf.table_name, lf.field_name)
                if result.get("success"):
                    removed_count += 1
                    print(f"✅ Removed: {lf.field_name} from {lf.table_name}", flush=True)
                else:
                    print(f"❌ Failed to remove: {lf.field_name} - {result.get('error')}", flush=True)
            except Exception as e:
                print(f"❌ Error removing {lf.field_name}: {str(e)}", flush=True)
                continue
        
        return {
            "success": True,
            "removed_count": removed_count,
            "total_found": len(logic_fields),
            "message": f"Removed {removed_count} of {len(logic_fields)} Logic Fields"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def list_logic_fields(table_name=None):
    """List all Logic Fields with their details"""
    try:
        filters = {}
        if table_name:
            filters["table_name"] = table_name
        
        logic_fields = frappe.get_all("Flansa Logic Field",
                                    filters=filters,
                                    fields=["name", "table_name", "field_name", "label", "expression", 
                                           "calculation_type", "storage_strategy", "is_active"])
        
        # Add DocType information
        for lf in logic_fields:
            try:
                flansa_table = frappe.get_doc("Flansa Table", lf.table_name)
                target_doctype = flansa_table.doctype_name if hasattr(flansa_table, 'doctype_name') and flansa_table.doctype_name else flansa_table.table_name
                lf["target_doctype"] = target_doctype
                
                # Check if Custom Field exists
                custom_field_exists = frappe.db.exists("Custom Field", {"dt": target_doctype, "fieldname": lf.field_name})
                lf["custom_field_exists"] = bool(custom_field_exists)
                
            except Exception as e:
                lf["target_doctype"] = "Unknown"
                lf["custom_field_exists"] = False
        
        return {
            "success": True,
            "logic_fields": logic_fields,
            "count": len(logic_fields)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def test_logic_field(expression, sample_data=None):
    """Test a Logic Field expression with sample data"""
    try:
        if not sample_data:
            sample_data = {"price": 100, "quantity": 2, "status": "Active"}
        
        if isinstance(sample_data, str):
            import json
            sample_data = json.loads(sample_data)
        
        # Import and test Logic Engine
        from flansa.flansa_core.api.flansa_logic_engine import get_logic_engine
        engine = get_logic_engine()
        result = engine.evaluate(expression, sample_data)
        
        return {
            "success": True,
            "result": result,
            "sample_data": sample_data,
            "message": "Logic Field test successful"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "result": None
        }

@frappe.whitelist()
def update_logic_field(table_name, field_name, field_label=None, calculation_method=None, options=None, template_type=None):
    """Update an existing Logic Field"""
    try:
        # Find the Logic Field document
        logic_field_name = f"LOGIC-{table_name}-{field_name}"
        
        if not frappe.db.exists("Flansa Logic Field", logic_field_name):
            return {
                "success": False,
                "error": f"Logic Field {logic_field_name} not found"
            }
        
        # Get and update the Logic Field document
        logic_field = frappe.get_doc("Flansa Logic Field", logic_field_name)
        
        if field_label:
            logic_field.label = field_label
        
        if calculation_method:
            logic_field.expression = calculation_method
        
        # Save the Logic Field
        logic_field.save()
        
        # Update the corresponding Custom Field if it exists
        flansa_table = frappe.get_doc("Flansa Table", table_name)
        if flansa_table.doctype_name:
            custom_field_name = f"{flansa_table.doctype_name}-{field_name}"
            
            if frappe.db.exists("Custom Field", custom_field_name):
                custom_field = frappe.get_doc("Custom Field", custom_field_name)
                
                if field_label:
                    custom_field.label = field_label
                
                if options and template_type == 'link':
                    custom_field.options = options
                
                custom_field.save()
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Logic Field '{field_label or field_name}' updated successfully"
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating Logic Field: {str(e)}", "Logic Field Update")
        return {
            "success": False,
            "error": str(e)
        }

